// src/meals/geminiMenuService.ts
// Service gọi Gemini đa phương thức (ảnh/PDF) QUA PROXY server (/api/extract-menu) — API key không bao giờ có mặt ở client.
// - responseSchema JSON, temperature 0 (cấu hình phía server.js)
// - Tối đa 3 request song song (semaphore)
// - Retry exponential backoff tối đa 3 lần (429/5xx/lỗi mạng)
// - Cache theo hash SHA-256 của file (localStorage), không gọi lại Gemini với file đã trích xuất

import {
  computeFileHash,
  resizeImageIfNeeded,
  createEmptyParsedWeek,
  type ParseResult,
  type ParsedDayData,
  type ParsedDishWithConfidence,
  type ParsedShiftData
} from './menuFileParser';
import {
  extractDishPortions,
  fuzzyMatchDishName,
  isVegetarianDish,
  normalizeVietnameseText,
  detectSupplierFromText,
  validateAndAlignDate
} from './menuNormalization';
import { DAY_NAMES } from './dateUtils';

// ===================== Cấu hình =====================

const MAX_CONCURRENT_REQUESTS = 3;
const MAX_ATTEMPTS = 3; // 1 lần gọi + tối đa 2 lần retry => tổng 3 lần
const BASE_BACKOFF_MS = 1000; // 1s -> 2s -> 4s
const CACHE_STORAGE_KEY = 'meals_gemini_cache_v2';
const CACHE_MAX_ENTRIES = 30;
const PDF_MAX_BYTES = 20 * 1024 * 1024;
const FUZZY_AUTO_FIX_THRESHOLD = 0.8;

// ===================== Lỗi có thể retry =====================

export class GeminiExtractError extends Error {
  status: number;
  retryable: boolean;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'GeminiExtractError';
    this.status = status;
    this.code = code;
    this.retryable = status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
  }
}

// ===================== Semaphore (tối đa 3 song song) =====================

class Semaphore {
  private active = 0;
  private queue: Array<(release: () => void) => void> = [];

  constructor(private max: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.max) {
      this.active++;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release() {
    const next = this.queue.shift();
    if (next) {
      next(() => this.release());
      return;
    }
    this.active--;
  }
}

const semaphore = new Semaphore(MAX_CONCURRENT_REQUESTS);

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => resolve(), ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(abortError());
    }, { once: true });
  });
}

function abortError(): Error {
  const e = new Error('Đã hủy tác vụ trích xuất');
  e.name = 'AbortError';
  return e;
}

export function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError';
}

// ===================== Cache SHA-256 =====================

interface CacheEntry {
  savedAt: number;
  result: ParseResult;
}

let cache: Record<string, CacheEntry> | null = null;

function loadCache(): Record<string, CacheEntry> {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(CACHE_STORAGE_KEY) || '{}');
  } catch {
    cache = {};
  }
  return cache!;
}

function saveCache() {
  try {
    const entries = Object.entries(loadCache());
    // Giữ tối đa CACHE_MAX_ENTRIES bản ghi mới nhất
    const trimmed = entries
      .sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0))
      .slice(0, CACHE_MAX_ENTRIES);
    cache = Object.fromEntries(trimmed);
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage đầy / không khả dụng — bỏ qua
  }
}

export function getCachedExtraction(hash: string): ParseResult | null {
  const entry = loadCache()[hash];
  return entry ? JSON.parse(JSON.stringify(entry.result)) : null;
}

export function putCachedExtraction(hash: string, result: ParseResult) {
  loadCache()[hash] = { savedAt: Date.now(), result: JSON.parse(JSON.stringify(result)) };
  saveCache();
}

export function clearGeminiCache() {
  cache = {};
  try {
    localStorage.removeItem(CACHE_STORAGE_KEY);
  } catch {
    // noop
  }
}

export function getGeminiCacheCount(): number {
  return Object.keys(loadCache()).length;
}

// ===================== Kiểm tra proxy =====================

export interface ProxyHealth {
  reachable: boolean;
  hasKey: boolean;
  model?: string;
}

export async function checkProxyHealth(): Promise<ProxyHealth> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { reachable: false, hasKey: false };
    const json = await res.json();
    return { reachable: true, hasKey: Boolean(json.hasKey), model: json.model };
  } catch {
    return { reachable: false, hasKey: false };
  }
}

// ===================== Chuẩn bị payload (nén ảnh / kiểm tra PDF) =====================

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      resolve(commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error('Không thể đọc dữ liệu file để gửi Gemini'));
    reader.readAsDataURL(blob);
  });
}

export interface Payload {
  mimeType: string;
  data: string;
}

export async function prepareGeminiPayload(file: File): Promise<Payload> {
  if (file.type.startsWith('image/')) {
    const resized = await resizeImageIfNeeded(file, 2000);
    return { mimeType: 'image/jpeg', data: await blobToBase64(resized.blob) };
  }
  if (file.type === 'application/pdf') {
    if (file.size > PDF_MAX_BYTES) {
      throw new GeminiExtractError('PDF quá lớn (giới hạn 20MB). Hãy tách hồ sơ hoặc xuất thành ảnh.', 0, 'PDF_TOO_LARGE');
    }
    return { mimeType: 'application/pdf', data: await blobToBase64(file) };
  }
  throw new GeminiExtractError('Loại file không hỗ trợ trích xuất bằng Gemini (chỉ ảnh hoặc PDF).', 0, 'UNSUPPORTED_MIME');
}

// ===================== Gọi proxy với retry exponential backoff =====================

async function callExtractMenu(payload: Payload, opts: ExtractMenuOptions): Promise<any> {
  let res: Response;
  try {
    res = await fetch('/api/extract-menu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mimeType: payload.mimeType,
        data: payload.data,
        weekStartDate: opts.weekStartDate,
        supplierHint: opts.supplierHint
      }),
      signal: opts.signal
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    // Lỗi mạng/proxy — retryable
    throw new GeminiExtractError(
      'Không thể kết nối máy chủ Gemini proxy. Hãy chắc chắn server.js đã chạy (npm run dev).',
      503,
      'NETWORK'
    );
  }

  let json: any = null;
  try {
    json = await res.json();
  } catch {
    // bỏ qua — dùng status bên dưới
  }

  if (!res.ok) {
    throw new GeminiExtractError(
      (json && json.message) || `Lỗi proxy Gemini (HTTP ${res.status})`,
      res.status,
      (json && json.error) || 'HTTP_ERROR'
    );
  }
  return json && json.data ? json.data : {};
}

export interface ExtractMenuOptions {
  weekStartDate: string;
  supplierHint?: string;
  targetSupplierId?: string;
  signal?: AbortSignal;
  onRetry?: (attempt: number, delayMs: number) => void;
  onCacheHit?: () => void;
}

// ===================== API chính =====================

export async function extractMenuWithGemini(file: File, opts: ExtractMenuOptions): Promise<ParseResult> {
  const hash = await computeFileHash(file);

  // Cache theo hash SHA-256
  const cached = getCachedExtraction(hash);
  if (cached) {
    opts.onCacheHit?.();
    return cached;
  }

  const payload = await prepareGeminiPayload(file);

  const release = await semaphore.acquire();
  try {
    let lastError: GeminiExtractError | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        const modelJson = await callExtractMenu(payload, opts);
        const result = mapModelJsonToParseResult(modelJson, {
          weekStartDate: opts.weekStartDate,
          fileName: file.name,
          targetSupplierId: opts.targetSupplierId,
          supplierHint: opts.supplierHint,
          fileHash: hash,
          sourceType: file.type === 'application/pdf' ? 'pdf' : 'image'
        });
        putCachedExtraction(hash, result);
        return result;
      } catch (err) {
        if (isAbortError(err)) throw err;
        const apiErr = err instanceof GeminiExtractError ? err : new GeminiExtractError(err instanceof Error ? err.message : String(err), 500, 'UNKNOWN');
        if (!apiErr.retryable || attempt === MAX_ATTEMPTS - 1) throw apiErr;
        const delay = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 250;
        opts.onRetry?.(attempt + 1, delay);
        await sleep(delay, opts.signal);
        lastError = apiErr;
      }
    }
    throw lastError || new GeminiExtractError('Trích xuất thất bại sau nhiều lần thử.', 500, 'UNKNOWN');
  } finally {
    release();
  }
}

// ===================== Chuẩn hóa model JSON -> ParseResult =====================

interface ModelDish {
  name?: string;
  raw?: string;
  confidence?: number;
}

interface ModelShift {
  man?: ModelDish[];
  chay?: ModelDish[];
  trangMiengMan?: string;
  trangMiengChay?: string;
}

interface ModelDay {
  dayLabel?: string;
  isoDate?: string;
  shifts?: { sang?: ModelShift; trua?: ModelShift; toi?: ModelShift };
}

interface ModelOutput {
  supplier?: string;
  weekNote?: string;
  days?: ModelDay[];
}

function clampConfidence(v: unknown): number {
  const n = typeof v === 'number' && isFinite(v) ? v : 0.85;
  return Math.max(0, Math.min(1, n));
}

function findDayIndexFromLabel(label: string): number {
  const lower = normalizeVietnameseText(label || '').toLowerCase();
  for (let d = 0; d < DAY_NAMES.length; d++) {
    const dayName = normalizeVietnameseText(DAY_NAMES[d]).toLowerCase();
    if (lower.includes(dayName) || lower.includes(`thu ${d + 2}`) || lower.includes(`t${d + 2}`)) {
      return d;
    }
  }
  if (lower.includes('chu nhat')) return 6;
  return -1;
}

function convertDishes(list: ModelDish[] | undefined, shiftTitle: string, warnings: string[], dayLabel: string): ParsedDishWithConfidence[] {
  const out: ParsedDishWithConfidence[] = [];
  for (const dish of list || []) {
    const raw = normalizeVietnameseText(String(dish?.raw || dish?.name || '').trim());
    if (!raw) continue;
    const { cleanName, portions } = extractDishPortions(raw);
    if (cleanName.length < 2) continue;

    // Tự phục hồi tên món theo từ điển chuẩn (fuzzy match)
    let name = cleanName;
    const fuzzy = fuzzyMatchDishName(name);
    if (fuzzy && fuzzy.score >= FUZZY_AUTO_FIX_THRESHOLD && fuzzy.matchedName.toLowerCase() !== name.toLowerCase()) {
      warnings.push(`${dayLabel} (${shiftTitle}): "${name}" đã được khớp về "${fuzzy.matchedName}".`);
      name = fuzzy.matchedName;
    }

    out.push({
      name,
      raw,
      portions,
      confidence: clampConfidence(dish?.confidence)
    });
  }
  return out;
}

function convertShift(
  modelShift: ModelShift | undefined,
  shiftKey: 'sang' | 'trua' | 'toi',
  warnings: string[],
  dayLabel: string
): ParsedShiftData {
  const title = shiftKey === 'sang' ? 'Bữa sáng' : shiftKey === 'trua' ? 'Bữa trưa' : 'Bữa tối';
  const manDishes = convertDishes(modelShift?.man, title, warnings, dayLabel);
  const chayDishes = convertDishes(modelShift?.chay, title, warnings, dayLabel);

  // Re-bucket bằng bộ phân loại chay phong phú phía client
  const man: ParsedDishWithConfidence[] = [];
  const chay: ParsedDishWithConfidence[] = [];
  for (const dish of [...manDishes, ...chayDishes]) {
    if (isVegetarianDish(dish.name, title)) chay.push(dish);
    else man.push(dish);
  }

  return {
    shiftKey,
    shiftTitle: title,
    man,
    chay,
    trangMiengMan: normalizeVietnameseText(String(modelShift?.trangMiengMan || 'Trái cây theo mùa').trim()) || 'Trái cây theo mùa',
    trangMiengChay: normalizeVietnameseText(String(modelShift?.trangMiengChay || 'Trái cây theo mùa').trim()) || 'Trái cây theo mùa',
    confidence: clampConfidence(0.9)
  };
}

/**
 * Map JSON trả về từ Gemini (qua proxy) về ParseResult chuẩn hóa đầy đủ
 */
export function mapModelJsonToParseResult(
  modelJson: ModelOutput,
  ctx: {
    weekStartDate: string;
    fileName: string;
    targetSupplierId?: string;
    supplierHint?: string;
    fileHash: string;
    sourceType: 'image' | 'pdf';
  }
): ParseResult {
  const warnings: string[] = [];
  const days: ParsedDayData[] = createEmptyParsedWeek(ctx.weekStartDate);

  (modelJson.days || []).forEach((modelDay, arrIdx) => {
    let dayIdx = findDayIndexFromLabel(String(modelDay?.dayLabel || ''));
    if (dayIdx < 0) dayIdx = arrIdx; // fallback: theo thứ tự mảng (Thứ 2 -> CN)
    if (dayIdx < 0 || dayIdx > 6) return;

    const frame = days[dayIdx];

    // Xác thực ngày: cảnh báo nếu ngày trong tài liệu lệch khung tuần
    const dateValidation = validateAndAlignDate(dayIdx, ctx.weekStartDate, modelDay?.isoDate || undefined);
    if (dateValidation.warning) {
      warnings.push(`${frame.dayOfWeek}: ${dateValidation.warning}`);
    }

    frame.shifts = {
      breakfast: convertShift(modelDay.shifts?.sang, 'sang', warnings, frame.dayOfWeek),
      lunch: convertShift(modelDay.shifts?.trua, 'trua', warnings, frame.dayOfWeek),
      dinner: convertShift(modelDay.shifts?.toi, 'toi', warnings, frame.dayOfWeek)
    };
  });

  // Cảnh báo thiếu món (giống các parser khác)
  days.forEach(d => {
    (['breakfast', 'lunch', 'dinner'] as const).forEach(shiftKey => {
      const shift = d.shifts[shiftKey];
      if (shiftKey !== 'breakfast' && shift.man.length === 0) {
        warnings.push(`${d.dayOfWeek} (${shift.shiftTitle}): Chưa có món mặn`);
      }
      if (shiftKey !== 'breakfast' && shift.man.length > 0 && shift.chay.length === 0) {
        warnings.push(`${d.dayOfWeek} (${shift.shiftTitle}): Chưa có món chay`);
      }
    });
  });

  // Nhận diện NCC
  const supFromModel = detectSupplierFromText(String(modelJson.supplier || ''));
  const supFromFile = detectSupplierFromText(`${ctx.fileName} ${String(modelJson.supplier || '')}`);
  const supplierId = ctx.targetSupplierId || supFromModel?.supplierId || supFromFile?.supplierId || 'tam-phuong';
  const supplierName = supFromModel?.supplierName || supFromFile?.supplierName || 'Tám Phương';

  return {
    supplierId,
    supplierName,
    weekStartDate: ctx.weekStartDate,
    days,
    warnings,
    fileHash: ctx.fileHash,
    sourceType: ctx.sourceType
  };
}
