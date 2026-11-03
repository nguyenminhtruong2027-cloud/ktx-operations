// src/meals/menuFileParser.ts
// Bộ giải mã file phía client (Excel/CSV, Text) và các tiện ích nén ảnh, SHA-256 hash, cache

import * as XLSX from 'xlsx';
import {
  extractDishPortions,
  isVegetarianDish,
  normalizeShiftName,
  normalizeVietnameseText,
  detectSupplierFromText,
  validateAndAlignDate
} from './menuNormalization';
import { DAY_NAMES, getDateOfDayInWeek, formatISODate, formatDMY } from './dateUtils';
import { DayWeeklyMenu, ShiftMealDetail } from './types';

// ===================== Lỗi cấu trúc file có hướng dẫn =====================

export type FileIssueCode = 'EMPTY_FILE' | 'UNKNOWN_STRUCTURE' | 'UNSUPPORTED_MIME';

export class StructuredFileError extends Error {
  code: FileIssueCode;
  guidance: string[];

  constructor(code: FileIssueCode, message: string, guidance: string[]) {
    super(message);
    this.name = 'StructuredFileError';
    this.code = code;
    this.guidance = guidance;
  }
}

/**
 * Nhận diện chỉ số ngày (0..6) từ 1 ô văn bản bất kỳ: "Thứ 2, Thứ Ba, T3, T.4, Chủ nhật, CN..."
 * Trả về -1 nếu không tìm thấy.
 */
export function matchDayLabel(text: string): number {
  if (!text) return -1;
  const lower = normalizeVietnameseText(text).toLowerCase();
  if (!lower) return -1;

  // 'thứ N'/'thu N' (N = 2..8, 8 = Chủ nhật)
  const thuMatch = lower.match(/th[uưu]\s*\.?\s*([2-8])/);
  if (thuMatch) {
    const n = Number(thuMatch[1]);
    return n === 8 ? 6 : n - 2;
  }

  // Tên đầy đủ: Thứ Hai... (DAY_NAMES) hoặc 'T2'..'T8'
  for (let d = 0; d < DAY_NAMES.length; d++) {
    const dayName = normalizeVietnameseText(DAY_NAMES[d]).toLowerCase();
    if (lower.includes(dayName)) return d;
  }
  const tMatch = lower.match(/(?:^|[\s\.\-_>(])t\.?\s?([2-8])(?=$|[\s\.\-_):,])/);
  if (tMatch) {
    const n = Number(tMatch[1]);
    return n === 8 ? 6 : n - 2;
  }

  if (/chu\s*nh[âa]t|cn\b/.test(lower)) return 6;
  return -1;
}

/**
 * Nhận diện ca ăn từ 1 ô/1 dòng văn bản. Trả về null nếu không phải nhãn ca.
 */
export function matchShiftLabel(text: string): 'breakfast' | 'lunch' | 'dinner' | null {
  const lower = (text || '').toLowerCase();
  if (!lower) return null;
  if (lower.includes('sáng') || lower.includes('sang') || lower.includes('ăn nhẹ') || lower.includes('an nhe')) return 'breakfast';
  if (lower.includes('trưa') || lower.includes('trua') || lower.includes('bữa chính') || lower.includes('chính')) return 'lunch';
  if (lower.includes('tối') || lower.includes('toi') || lower.includes('tăng ca') || lower.includes('tang ca')) return 'dinner';
  return null;
}

/**
 * Xác định nhóm món theo PREFIX dòng ('Mặn: ...', 'Chay: ...', 'Tráng miệng: ...') trước khi đoán theo từ khóa chay.
 */
export function matchDishBucket(line: string): 'man' | 'chay' | 'dessert' | null {
  const lower = (line || '').trim().toLowerCase();
  if (!lower) return null;
  if (/(^|[\s\-:>•*.])tr[áa]ng\s*mi[ệe]ng|^tm[:\s]/.test(lower) || lower.includes('trái cây')) return 'dessert';
  if (/m[ạa]n\b/.test(lower.slice(0, 12)) || lower.startsWith('mặn:') || lower.startsWith('mặn ')) return 'man';
  if (/chay\b/.test(lower.slice(0, 12)) || lower.startsWith('chay:')) return 'chay';
  return null;
}

// ===================== BỘC TÁCH ĐẦY ĐỦ 100% DANH SÁCH MÓN =====================

const LEADING_LABEL_RE = /^(b[ừu]a\s+(?:s[áa]ng|tr[ưư]a|t[ốo]i)|m[ôo]n\s*(?:m[ạa]n|chay)|tr[áa]ng\s*mi[ệe]ng|ca\s+(?:s[áa]ng|tr[ưư]a|t[ốo]i)|s[áa]ng|tr[ưư]a|t[ốo]i|ngày\s+\S+)\s*[:\-–—]?\s*/i;
const DISH_LINE_NOISE_RE = /^\s*(?:\d+\s*[\.\)]\s*|[a-hA-H]\s*[\.\)]\s*|[-–—•▪»·"]+\s*)+/;

/**
 * Tách 1 ô/1 dòng thành danh sách món ĐẦY ĐỦ:
 * • Phân tách: ngắt dòng / ; / dấu phẩy / gạch đứng / bullet — NHƯNG dấu phẩy & '·'
 *   BÊN TRONG ngoặc (định lượng "Thịt 45–50g, Nước 20ml") được giữ nguyên, không tách sai.
 * • Bỏ số thứ tự ("1.", "a)", "—") đầu từng món — không làm mất món.
 */
export function splitDishLines(text: string): string[] {
  const normalized = String(text || '').replace(/\r\n?/g, '\n');
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  const push = () => {
    const s = cur.replace(DISH_LINE_NOISE_RE, '').replace(/\s+/g, ' ').trim();
    if (s.length >= 2) out.push(s);
    cur = '';
  };
  for (const ch of normalized) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    const isSep = ch === '\n' || ch === ';' || ch === ',' || ch === '|' || ch === '•' || ch === '▪' || ch === '·';
    if (isSep && depth === 0) {
      push();
      continue;
    }
    if ((ch === '\n' || ch === '|' || ch === '•' || ch === '▪' || ch === '·') && depth > 0) {
      cur += ' ';
      continue;
    }
    cur += ch;
  }
  push();
  return out;
}

/**
 * Bỏ nhãn đầu ô/dòng ("Bữa trưa:", "Món mặn:", "Ca tối:", "Sáng", "Thứ 3") nhưng
 * GIỮ NGUYÊN nội dung món phía sau — không được vứt bỏ cả ô như cũ.
 */
export function stripLeadingDishLabel(
  cellText: string
): { rest: string; isPureLabel: boolean; shiftHit: 'breakfast' | 'lunch' | 'dinner' | null; dayHit: number } {
  const raw = String(cellText || '').trim();
  const dayHit = raw.length <= 40 ? matchDayLabel(raw) : -1;
  const m = raw.match(LEADING_LABEL_RE);
  if (!m) {
    const shiftHit = raw.length <= 24 ? matchShiftLabel(raw) : null;
    return { rest: raw, isPureLabel: Boolean(shiftHit) && raw.trim().length <= 12, shiftHit, dayHit };
  }
  const rest = raw.slice(m[0].length).trim();
  const shiftHit = matchShiftLabel(m[0].trim());
  return {
    rest,
    isPureLabel: rest.length < 3,
    shiftHit,
    dayHit
  };
}

export interface ParsedDishWithConfidence {
  name: string;
  raw: string;
  portions: Array<{ item: string; min: number | null; max: number | null; unit: 'g' | 'ml' | 'qua' | 'cai' }>;
  confidence: number;
}

export interface ParsedShiftData {
  shiftKey: 'sang' | 'trua' | 'toi';
  shiftTitle: string;
  man: ParsedDishWithConfidence[];
  chay: ParsedDishWithConfidence[];
  trangMiengMan: string;
  trangMiengChay: string;
  confidence: number;
}

export interface ParsedDayData {
  dayIndex: number; // 0..6 (Thứ 2..CN)
  weekday: number;  // 2..8
  dayOfWeek: string;
  dateStr: string;
  isoDate: string;
  shifts: {
    breakfast: ParsedShiftData;
    lunch: ParsedShiftData;
    dinner: ParsedShiftData;
  };
}

export interface ParseResult {
  supplierId: string | null;
  supplierName: string | null;
  weekStartDate: string; // YYYY-MM-DD
  days: ParsedDayData[];
  warnings: string[];
  fileHash: string;
  sourceType: 'excel' | 'csv' | 'text' | 'image' | 'pdf';
}

/**
 * 1. Tính toán mã băm SHA-256 của file để làm khóa cache
 */
export async function computeFileHash(file: File | Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 2. Nén và thu nhỏ ảnh: Đảm bảo cạnh dài nhất <= maxDimension (mặc định 2000px)
 */
export async function resizeImageIfNeeded(
  file: File,
  maxDimension: number = 2000
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Không thể khởi tạo Canvas 2D'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ blob, dataUrl, width, height });
          } else {
            reject(new Error('Không thể nén ảnh blob'));
          }
        }, 'image/jpeg', 0.88);
      };
      img.onerror = () => reject(new Error('Lỗi tải dữ liệu ảnh'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Lỗi đọc file ảnh'));
    reader.readAsDataURL(file);
  });
}

/**
 * Khởi tạo khung 7 ngày trống cho 1 tuần
 */
export function createEmptyParsedWeek(weekStartDate: string): ParsedDayData[] {
  return DAY_NAMES.map((dayName, idx) => {
    const dayDate = getDateOfDayInWeek(weekStartDate, idx);
    const isoDate = formatISODate(dayDate);
    const dateStr = formatDMY(dayDate);

    const emptyShift = (key: 'sang' | 'trua' | 'toi', title: string): ParsedShiftData => ({
      shiftKey: key,
      shiftTitle: title,
      man: [],
      chay: [],
      trangMiengMan: 'Trái cây theo mùa',
      trangMiengChay: 'Trái cây theo mùa',
      confidence: 1.0
    });

    return {
      dayIndex: idx,
      weekday: idx + 2,
      dayOfWeek: dayName,
      dateStr,
      isoDate,
      shifts: {
        breakfast: emptyShift('sang', 'Bữa sáng'),
        lunch: emptyShift('trua', 'Bữa trưa'),
        dinner: emptyShift('toi', 'Bữa tối')
      }
    };
  });
}

/**
 * 3. Parser Excel & CSV trực tiếp phía client (SheetJS) — MULTISHEET:
 * Duyệt TOÀN BỘ sheet của file, dùng sheet đầu tiên có dữ liệu thực đơn hợp lệ.
 * Chỉ báo lỗi khi mọi sheet trống / đều không nhận diện được cấu trúc.
 */
export async function parseExcelOrCsvFile(
  file: File,
  currentWeekStart: string,
  targetSupplierId?: string
): Promise<ParseResult> {
  const hash = await computeFileHash(file);
  const buffer = await file.arrayBuffer();

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    throw new StructuredFileError(
      'UNKNOWN_STRUCTURE',
      `${file.name} không đọc được như bảng tính (file hỏng hoặc không đúng chuẩn xlsx/xls/ods/csv).`,
      [
        'Mở file gốc và lưu lại dạng "Excel Workbook (.xlsx)" hoặc xuất thành CSV rồi tải lên lại.',
        'Nếu là ảnh/PDF, dùng luồng AI trích xuất hoặc chụp lại rõ nét hơn.'
      ]
    );
  }

  const attempts: string[] = [];
  const lower = file.name.toLowerCase();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const parsed = parseSheetMenuData(rows, {
      fileName: file.name,
      sheetName,
      currentWeekStart,
      targetSupplierId
    });

    if (parsed.blank) {
      attempts.push(`"${sheetName}": sheet trống — không có dữ liệu`);
      continue; // thử sheet kế tiếp, KHÔNG lỗi ngay
    }
    if (parsed.dishCount > 0) {
      return {
        supplierId: parsed.supplierId,
        supplierName: parsed.supplierName,
        weekStartDate: currentWeekStart,
        days: parsed.days,
        warnings: parsed.warnings,
        fileHash: hash,
        sourceType: lower.endsWith('.csv') ? 'csv' : 'excel'
      };
    }
    attempts.push(`"${sheetName}": đọc được ${parsed.dishCount} món — cấu trúc chưa khớp ca/ngày/món`);
  }

  const allBlank = attempts.length > 0 && attempts.every(a => a.includes('sheet trống'));
  throw new StructuredFileError(
    allBlank ? 'EMPTY_FILE' : 'UNKNOWN_STRUCTURE',
    allBlank
      ? `${file.name} trống ở TẤT CẢ ${attempts.length} sheet — không có dữ liệu thực đơn nào để đọc.`
      : `${file.name} có dữ liệu nhưng không sheet nào khớp cấu trúc thực đơn (ca/ngày/món).`,
    allBlank
      ? [
          'File có thể đang lỗi hoặc chứa sheet nháp — phối lại file rồi tải lên.',
          'Dùng ngay BẢNG NHẬP TAY NHANH (đã mở sẵn bên dưới) để điền thực đơn trực tiếp, không gián đoạn công việc.',
          'Hoặc chụp màn hình bảng thực đơn thành ảnh (PNG/JPG) để AI trích xuất.'
        ]
      : [
          'Đã quét toàn bộ sheet của file, kết quả từng sheet:',
          ...attempts.map(a => `• ${a}`),
          'Dùng "Chọn cột thủ công" bên dưới để chỉ rõ cột Món mặn / Món chay / Tráng miệng / Ngày / Ca ăn rồi phân tích lại.'
        ]
  );
}

interface SheetParseOpts {
  fileName: string;
  sheetName: string;
  currentWeekStart: string;
  targetSupplierId?: string;
}

/**
 * Phân tích 1 sheet (tái sử dụng cho multi-sheet): trả về dishCount để caller quyết định tiếp tục hay dừng.
 */
function parseSheetMenuData(
  rows: any[][],
  opts: SheetParseOpts
): { blank: boolean; dishCount: number; days: ReturnType<typeof createEmptyParsedWeek>; warnings: string[]; supplierId: string; supplierName: string } {
  const warnings: string[] = [];

  // Tự nhận diện NCC từ tên file hoặc tên sheet
  const detectedSup = detectSupplierFromText(`${opts.fileName} ${opts.sheetName}`);
  const supplierId = opts.targetSupplierId || detectedSup?.supplierId || 'tam-phuong';
  const supplierName = detectedSup?.supplierName || 'Tám Phương';

  const days = createEmptyParsedWeek(opts.currentWeekStart);

  let currentDayIdx = -1;
  let currentShiftKey: 'breakfast' | 'lunch' | 'dinner' = 'lunch';
  let sawShiftLabel = false;

  const isBlankRow = (row: any[]): boolean => !row || row.length === 0 || row.every(c => !c || String(c).trim() === '');
  if (rows.length === 0 || rows.every(isBlankRow)) {
    return { blank: true, dishCount: 0, days, warnings, supplierId, supplierName };
  }

  // =========================================================
  // STRATEGY GRID (thử trước): nhận diện TRỤC CA + TRỤC NGÀY
  //  • Cột = ca ăn (header có 'Sáng/Trưa/Tối') × hàng = ngày (cột đầu các dòng 'Thứ N')
  //  • Hoặc hàng = ca × cột = ngày (bảng xoay ngang)
  // Chống lỗi "dồn toàn bộ món vào một cột ca"
  // =========================================================
  const addDishIntoCell = (dayIdx: number, shiftKey: 'breakfast' | 'lunch' | 'dinner', cellText: string) => {
    const shift = days[dayIdx]?.shifts[shiftKey];
    if (!shift || !cellText) return 0;
    let added = 0;
    const parsedLbl = stripLeadingDishLabel(cellText);
    const lines = splitDishLines(parsedLbl.rest);
    for (const trimmedLine of lines) {
      const bucket = matchDishBucket(trimmedLine);
      const { cleanName, portions } = extractDishPortions(trimmedLine);
      const dishItem: ParsedDishWithConfidence = { name: cleanName, raw: trimmedLine, portions, confidence: 0.95 };
      if (bucket === 'dessert') {
        shift.trangMiengMan = trimmedLine;
        shift.trangMiengChay = trimmedLine;
        continue;
      }
      const isVeg = bucket === 'chay' ? true : bucket === 'man' ? false : isVegetarianDish(cleanName);
      if (isVeg) shift.chay.push(dishItem); else shift.man.push(dishItem);
      added++;
    }
    return added;
  };

  let gridDishCount = 0;
  // Tìm hàng header có nhãn ca trên NHIỀU cột (>=2) — trục ca theo CỘT
  let shiftAxisRow = -1;
  const shiftColMap: Record<number, 'breakfast' | 'lunch' | 'dinner'> = {};
  for (let r = 0; r < Math.min(rows.length, 12); r++) {
    const map: Record<number, 'breakfast' | 'lunch' | 'dinner'> = {};
    let dayInRow = 0;
    for (let c = 0; c < (rows[r] || []).length; c++) {
      const cellText = String(rows[r][c] || '').trim();
      if (cellText.length < 2 || cellText.length > 24) continue;
      const hit = matchShiftLabel(cellText);
      if (hit) map[c] = hit;
    }
    for (let c = 0; c < (rows[r] || []).length; c++) {
      if (matchDayLabel(String(rows[r][c] || '')) >= 0) dayInRow++;
    }
    if (Object.keys(map).length >= 3 && dayInRow === 0) {
      shiftAxisRow = r;
      Object.assign(shiftColMap, map);
      break;
    }
  }

  if (shiftAxisRow >= 0) {
    // Ca theo CỘT: tìm trục ngày theo HÀNG (cột nào mà nhiều dòng là nhãn ngày)
    const scanCols = Math.max(...rows.slice(0, 12).map((r: any[]) => (r || []).length), (rows[shiftAxisRow] || []).length, 1);
    let dayAxisCol = -1;
    let dayHitCount = 0;
    for (let c = 0; c < scanCols; c++) {
      let hits = 0;
      for (let r = shiftAxisRow + 1; r < rows.length; r++) {
        const cellText = String(rows[r][c] || '').trim();
        if (cellText.length > 0 && cellText.length <= 24 && matchDayLabel(cellText) >= 0) hits++;
      }
      // Nhãn ca cũng có thể bị tính ngày trùng? hạn chế: cột trục ca không được là cột ca
      if (shiftColMap[c] === undefined && hits >= 3 && hits > dayHitCount) {
        dayHitCount = hits;
        dayAxisCol = c;
      }
    }

    if (dayAxisCol >= 0) {
      for (let r = shiftAxisRow + 1; r < rows.length; r++) {
        const row = rows[r];
        if (isBlankRow(row)) continue;
        const dayHit = matchDayLabel(String(row[dayAxisCol] || ''));
        if (dayHit < 0) continue;
        for (const [colStr, shiftKey] of Object.entries(shiftColMap)) {
          const c = Number(colStr);
          gridDishCount += addDishIntoCell(dayHit, shiftKey, String(row[c] ?? '').trim());
        }
      }
      sawShiftLabel = gridDishCount > 0;
    }
  }

  if (gridDishCount === 0) {
    // Biến thể xoay ngang: hàng = ca (cột đầu nhãn ca), cột = ngày (header 'Thứ N'...)
    // Tìm header ngày theo cột: hàng đầu có >=3 nhãn ngày
    let dayHeaderRow = -1;
    const dayColMap: Record<number, number> = {};
    for (let r = 0; r < Math.min(rows.length, 8); r++) {
      const map: Record<number, number> = {};
      for (let c = 0; c < (rows[r] || []).length; c++) {
        const hit = matchDayLabel(String(rows[r][c] || ''));
        if (hit >= 0) map[c] = hit;
      }
      if (Object.keys(map).length >= 3) {
        Object.assign(dayColMap, map);
        dayHeaderRow = r;
        break;
      }
    }
    if (dayHeaderRow >= 0) {
      for (let r = dayHeaderRow + 1; r < rows.length; r++) {
        const row = rows[r];
        if (isBlankRow(row)) continue;
        const rowShift = matchShiftLabel(String(row[0] || '')) || matchShiftLabel(String(row[1] || ''));
        if (!rowShift) continue;
        sawShiftLabel = true;
        for (const [colStr, dayIdx] of Object.entries(dayColMap)) {
          const c = Number(colStr);
          gridDishCount += addDishIntoCell(dayIdx, rowShift, String(row[c] ?? '').trim());
        }
      }
    }
  }

  const gridParsed = gridDishCount > 0;

  if (!gridParsed) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (isBlankRow(row)) continue;

    // 1. Nhận diện ngày/thứ bằng matchDayLabel (chấp nhận 'Thứ 2', 'Thứ Ba', 'T2', 'T.3', 'CN'...)
    for (const cell of row) {
      if (!cell) continue;
      const cellText = String(cell).trim();
      if (cellText.length < 1 || cellText.length > 40) continue;
      const dayHit = matchDayLabel(cellText);
      if (dayHit >= 0) {
        currentDayIdx = dayHit;
        break;
      }
    }

    // 2. Nhận diện ca ăn — chỉ nhận nhãn CA THUẦN (ô ngắn, không chứa số/chữ dài) để tránh
    //    nhầm tiêu đề/ô chứa nhiều dữ liệu khiến mọi món bị đổ vào 1 ca
    for (const cell of row) {
      if (!cell) continue;
      const cellText = String(cell).trim();
      if (cellText.length < 2 || cellText.length > 24) continue;
      if (matchDayLabel(cellText) >= 0) continue; // ô nhãn ngày ưu tiên cho trục ngày
      const shiftHit = matchShiftLabel(cellText);
      if (shiftHit) {
        currentShiftKey = shiftHit;
        sawShiftLabel = true;
        break;
      }
    }

    // 3. Nếu đang trong 1 ngày cụ thể, quét các cột để lấy món ăn
    if (currentDayIdx >= 0 && currentDayIdx < 7) {
      for (const cell of row) {
        if (!cell) continue;
        let cellText = String(cell).trim();
        if (cellText.length < 3) continue;

        // Bóc nhãn đầu ô ("Bữa trưa:", "Món mặn:", "Ca tối:", "Sáng", "Thứ 3: ...") —
        // nếu sau nhãn còn món thì VẪN PHÂN TÍCH món (không vứt cả ô như logic cũ)
        const parsedLbl = stripLeadingDishLabel(cellText);
        if (parsedLbl.shiftHit) {
          currentShiftKey = parsedLbl.shiftHit;
          sawShiftLabel = true;
        }
        if (parsedLbl.isPureLabel) continue; // ô thuần nhãn (không món) → chỉ đổi ca/ngày
        cellText = parsedLbl.rest;
        if (parsedLbl.rest.length < 3 && parsedLbl.dayHit >= 0) {
          // ô là nhãn ngày thuần → đã cập nhật ở bước 1
          continue;
        }

        // Bỏ qua các nhãn tiêu đề PHI MÓN — chỉ khi ô thuần nhãn (ngắn)
        const lower = cellText.toLowerCase();
        if (lower.length <= 20 && (
          lower.startsWith('thực đơn') ||
          lower.startsWith('stt') ||
          lower.startsWith('thứ') ||
          lower.startsWith('ngày')
        )) {
          continue;
        }

        // Tách ĐẦY ĐỦ danh sách món (ngắt dòng / ; / , / | / bullet / bỏ số thứ tự)
        const lines = splitDishLines(cellText);
        for (const trimmedLine of lines) {
          // Bảng dish prefix ('Mặn: / Chay: / Tráng miệng:') ưu tiên trước từ khóa chay
          const bucket = matchDishBucket(trimmedLine);

          const { cleanName, portions } = extractDishPortions(trimmedLine);
          if (cleanName.length < 2) continue;

          const dishItem: ParsedDishWithConfidence = {
            name: cleanName,
            raw: trimmedLine,
            portions,
            confidence: 0.95
          };

          if (bucket === 'dessert') {
            days[currentDayIdx].shifts[currentShiftKey].trangMiengMan = trimmedLine;
            days[currentDayIdx].shifts[currentShiftKey].trangMiengChay = trimmedLine;
            continue;
          }

          const isVeg = bucket === 'chay' ? true : bucket === 'man' ? false : isVegetarianDish(cleanName);

          if (isVeg) {
            days[currentDayIdx].shifts[currentShiftKey].chay.push(dishItem);
          } else {
            days[currentDayIdx].shifts[currentShiftKey].man.push(dishItem);
          }
        }
      }
    }
  }

  // Nếu file excel dạng bảng cột (Header là Thứ 2 -> CN ở hàng 0 hoặc 1)
  // Kiểm tra nếu các ngày chưa có dữ liệu thì thử quét theo ma trận cột
  const totalDishesExtracted = days.reduce(
    (acc, d) => acc
      + d.shifts.breakfast.man.length + d.shifts.breakfast.chay.length
      + d.shifts.lunch.man.length + d.shifts.lunch.chay.length
      + d.shifts.dinner.man.length + d.shifts.dinner.chay.length,
    0
  );

  if (totalDishesExtracted === 0 && rows.length > 2) {
    // Thử map cột: Tìm hàng header có Thứ 2..CN
    let headerRowIdx = -1;
    const colDayMap: Record<number, number> = {};

    for (let r = 0; r < Math.min(rows.length, 5); r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const val = String(rows[r][c] || '');
        const dayHit = matchDayLabel(val);
        if (dayHit >= 0) {
          colDayMap[c] = dayHit;
          headerRowIdx = r;
        }
      }
      if (headerRowIdx >= 0) break;
    }

    if (headerRowIdx >= 0) {
      let activeShift: 'breakfast' | 'lunch' | 'dinner' = 'lunch';
      for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const firstCol = String(rows[r][0] || '').toLowerCase();
        if (firstCol.includes('sáng') || firstCol.includes('nhẹ')) { activeShift = 'breakfast'; sawShiftLabel = true; }
        else if (firstCol.includes('trưa') || firstCol.includes('chính')) { activeShift = 'lunch'; sawShiftLabel = true; }
        else if (firstCol.includes('tối') || firstCol.includes('tăng ca')) { activeShift = 'dinner'; sawShiftLabel = true; }

        for (const [colStr, dayIdx] of Object.entries(colDayMap)) {
          const c = parseInt(colStr, 10);
          const cellVal = String(rows[r][c] || '').trim();
          if (cellVal.length > 2) {
            const { cleanName, portions } = extractDishPortions(cellVal);
            const bucket = matchDishBucket(cellVal);
            const isVeg = bucket === 'chay' ? true : bucket === 'man' ? false : isVegetarianDish(cleanName);
            const item: ParsedDishWithConfidence = {
              name: cleanName,
              raw: cellVal,
              portions,
              confidence: 0.95
            };
            if (isVeg) {
              days[dayIdx].shifts[activeShift].chay.push(item);
            } else {
              days[dayIdx].shifts[activeShift].man.push(item);
            }
          }
        }
      }
    }
  }
  } // end: chỉ chạy chiến lược tuần tự khi GRID không phân tích được

  // Cảnh báo phân bổ ca: nếu file không có nhãn ca nào mà toàn bộ món rơi về 1 ca mặc định
  if (gridParsed === false && sawShiftLabel === false) {
    warnings.push('File không có nhãn ca ăn rõ ràng — toàn bộ món đang xếp vào một bữa duy nhất (mặc định). Dùng "Phân bổ lại ca" để cắt dòng vào đúng Sáng/Trưa/Tối.');
  }

  // Rà soát các cảnh báo (thiếu món mặn/chay)
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

  const dishCount = days.reduce(
    (acc, d) => acc
      + d.shifts.breakfast.man.length + d.shifts.breakfast.chay.length
      + d.shifts.lunch.man.length + d.shifts.lunch.chay.length
      + d.shifts.dinner.man.length + d.shifts.dinner.chay.length,
    0
  );

  return { blank: false, dishCount, days, warnings, supplierId, supplierName };
}

/**
 * 4. Parser văn bản thô / dán text (Clipboard / .txt)
 */
export async function parsePlainTextMenu(
  text: string,
  currentWeekStart: string,
  targetSupplierId?: string
): Promise<ParseResult> {
  const hash = await computeFileHash(new Blob([text]));
  const detectedSup = detectSupplierFromText(text);
  const supplierId = targetSupplierId || detectedSup?.supplierId || 'tam-phuong';
  const supplierName = detectedSup?.supplierName || 'Tám Phương';

  const days = createEmptyParsedWeek(currentWeekStart);
  const warnings: string[] = [];

  const lines = text.split(/\r?\n/);
  let currentDayIdx = 0;
  let currentShiftKey: 'breakfast' | 'lunch' | 'dinner' = 'lunch';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Bóc nhãn đầu dòng (Thứ/Ngày, Ca, Tráng miệng...) — giữ món phía sau, không vứt dòng
    const lbl = stripLeadingDishLabel(line);

    // 1. Nhãn NGÀY ('Thứ 2', 'Thứ Ba', 'T2', 'CN')
    let matchedDay = lbl.dayHit >= 0;
    if (!matchedDay) {
      for (let d = 0; d < DAY_NAMES.length; d++) {
        if (line.toLowerCase().startsWith(DAY_NAMES[d].toLowerCase()) || line.toLowerCase().startsWith(`thứ ${d + 2}`)) {
          currentDayIdx = d;
          matchedDay = true;
          lbl.dayHit = d;
          break;
        }
      }
    }
    if (matchedDay) {
      currentDayIdx = lbl.dayHit;
      // Sau nhãn ngày còn món trên cùng dòng → vẫn phân tích vào ngày vừa đổi
      if (lbl.rest && lbl.rest.length >= 3) {
        const parsedLbl2 = splitDishLines(lbl.rest);
        for (const dishLine of parsedLbl2) {
          const bucket = matchDishBucket(dishLine);
          if (bucket === 'dessert') {
            days[currentDayIdx].shifts[currentShiftKey].trangMiengMan = dishLine;
            days[currentDayIdx].shifts[currentShiftKey].trangMiengChay = dishLine;
            continue;
          }
          const { cleanName, portions } = extractDishPortions(dishLine);
          if (cleanName.length < 2) continue;
          const isVeg = bucket === 'chay' ? true : bucket === 'man' ? false : isVegetarianDish(cleanName);
          const item: ParsedDishWithConfidence = { name: cleanName, raw: dishLine, portions, confidence: 0.9 };
          if (isVeg) days[currentDayIdx].shifts[currentShiftKey].chay.push(item);
          else days[currentDayIdx].shifts[currentShiftKey].man.push(item);
        }
      }
      continue;
    }

    // 2. Nhãn CA ('Bữa sáng: <món>...' — có món sau nhãn thì VẪN PARSE món)
    if (lbl.shiftHit) {
      currentShiftKey = lbl.shiftHit;
      if (lbl.isPureLabel) continue; // thuần nhãn — dòng tiếp theo là món
      // parse món phía sau nhãn ca trên cùng dòng
      for (const dishLine of splitDishLines(lbl.rest)) {
        const bucket = matchDishBucket(dishLine);
        const { cleanName, portions } = extractDishPortions(dishLine);
        if (cleanName.length < 2) continue;
        const isVeg = bucket === 'chay' ? true : bucket === 'man' ? false : isVegetarianDish(cleanName);
        const item: ParsedDishWithConfidence = { name: cleanName, raw: dishLine, portions, confidence: 0.9 };
        if (bucket === 'dessert') {
          days[currentDayIdx].shifts[currentShiftKey].trangMiengMan = dishLine;
          days[currentDayIdx].shifts[currentShiftKey].trangMiengChay = dishLine;
          continue;
        }
        if (isVeg) days[currentDayIdx].shifts[currentShiftKey].chay.push(item);
        else days[currentDayIdx].shifts[currentShiftKey].man.push(item);
      }
      continue;
    }

    // 3. Trích xuất món (đầy đủ từng dòng)
    for (const dishLine of splitDishLines(line)) {
      const bucket = matchDishBucket(dishLine);
      if (bucket === 'dessert' || dishLine.toLowerCase().includes('tráng miệng') || dishLine.toLowerCase().includes('trái cây')) {
        const tm = dishLine.replace(/^[•\-\*\s:]+/, '').trim();
        days[currentDayIdx].shifts[currentShiftKey].trangMiengMan = tm;
        days[currentDayIdx].shifts[currentShiftKey].trangMiengChay = tm;
        continue;
      }
      const { cleanName, portions } = extractDishPortions(dishLine);
      if (cleanName.length < 2) continue;
      const isVeg = bucket === 'chay' ? true : bucket === 'man' ? false : isVegetarianDish(cleanName);
      const item: ParsedDishWithConfidence = {
        name: cleanName,
        raw: dishLine,
        portions,
        confidence: 0.9
      };
      if (isVeg) {
        days[currentDayIdx].shifts[currentShiftKey].chay.push(item);
      } else {
        days[currentDayIdx].shifts[currentShiftKey].man.push(item);
      }
    }
  }

  return {
    supplierId,
    supplierName,
    weekStartDate: currentWeekStart,
    days,
    warnings,
    fileHash: hash,
    sourceType: 'text'
  };
}

// ===================== 5. Snapshot & Map cột thủ công =====================

export interface ManualColumnMap {
  colDay: number | null;    // cột chứa nhãn ngày (Thứ 2 → CN)
  colShift: number | null;  // cột chứa nhãn ca (Sáng/Trưa/Tối)
  colMan: number | null;    // cột món mặn
  colChay: number | null;   // cột món chay
  colDessert: number | null; // cột tráng miệng
}

export interface SheetSnapshot {
  fileName: string;
  headers: string[];
  sampleRows: string[][];
  totalRows: number;
}

const isBlankRow = (row: any[] | undefined): boolean =>
  !row || row.length === 0 || row.every(c => !c || String(c).trim() === '');

/**
 * Chọn sheet đầu tiên CÓ dữ liệu (multi-sheet): bỏ qua sheet trống; trả về null nếu mọi sheet trống.
 */
function firstMeaningfulSheet(workbook: XLSX.WorkBook): { rows: any[][]; sheetName: string } | null {
  for (const sheetName of workbook.SheetNames) {
    const rows: any[][] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false });
    if (rows.length > 0 && !rows.every(isBlankRow)) {
      return { rows, sheetName };
    }
  }
  return null;
}

/** Tách các ô của bảng tính thành snapshot để UI hiển thị & chọn cột */
export async function makeSheetSnapshot(file: File): Promise<SheetSnapshot> {
  const buffer = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array' });
  } catch {
    throw new StructuredFileError(
      'UNKNOWN_STRUCTURE',
      `${file.name} không đọc được bằng bảng tính (file hỏng hoặc không đúng chuẩn xlsx/xls/ods/csv).`,
      [
        'Mở file gốc và lưu lại dạng "Excel Workbook (.xlsx)" hoặc xuất thành CSV rồi tải lên lại.',
        'Nếu là ảnh/PDF, dùng luồng AI trích xuất hoặc chụp lại rõ nét hơn.'
      ]
    );
  }

  const found = firstMeaningfulSheet(workbook);
  if (!found) {
    throw new StructuredFileError(
      'EMPTY_FILE',
      `${file.name} trống ở TẤT CẢ ${workbook.SheetNames.length} sheet — không còn dữ liệu nào để chụp preview.`,
      ['Dùng BẢNG NHẬP TAY NHANH bên dưới để điền thực đơn trực tiếp.']
    );
  }
  const rows = found.rows;

  // Header: hàng đầu tiên có >= 2 ô có nội dung; fallback hàng 0
  let headerRowIdx = rows.findIndex(row => row && row.filter(c => c && String(c).trim()).length >= 2);
  const headers = ((headerRowIdx >= 0 ? rows[headerRowIdx] : rows[0]) || []).map(c => String(c ?? '').trim());
  // 8 dòng mẫu ngay dưới header
  const start = headerRowIdx >= 0 ? headerRowIdx + 1 : 1;
  const sampleRows = rows.slice(start, start + 8).map(row =>
    Array.from({ length: Math.max(headers.length, 8) }, (_, i) => String(row?.[i] ?? '').trim())
  );

  return {
    fileName: file.name,
    headers: headers.length ? headers : Array.from({ length: 8 }, () => ''),
    sampleRows,
    totalRows: rows.length
  };
}

/**
 * Phân tích lại bảng tính với mapping cột người dùng chọn.
 * Mỗi dòng: chọn Ngày (từ cột Ngày, giữ nguyên nếu không khớp), Ca (từ cột Ca),
 * món từng dòng trong cột Mặn / Chay, tráng miệng trong cột Tráng miệng.
 */
export async function parseWithManualMap(
  file: File,
  map: ManualColumnMap,
  currentWeekStart: string,
  targetSupplierId?: string
): Promise<ParseResult> {
  const hash = await computeFileHash(file);
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const found = firstMeaningfulSheet(workbook);
  const rows: any[][] = found ? found.rows : [];
  const sheetName = found?.sheetName || workbook.SheetNames[0] || 'Sheet1';

  const warnings: string[] = [];
  const days = createEmptyParsedWeek(currentWeekStart);

  const detectedSup = detectSupplierFromText(`${file.name} ${sheetName}`);
  const supplierId = targetSupplierId || detectedSup?.supplierId || 'tam-phuong';
  const supplierName = detectedSup?.supplierName || 'Tám Phương';

  let currentDayIdx = 0;
  let currentShiftKey: 'breakfast' | 'lunch' | 'dinner' = 'lunch';

  for (const row of rows) {
    if (!row || row.every(c => !c || String(c).trim() === '')) continue;

    if (map.colDay != null) {
      const dayHit = matchDayLabel(String(row[map.colDay] ?? ''));
      if (dayHit >= 0) currentDayIdx = dayHit;
    }
    if (map.colShift != null) {
      const shiftHit = matchShiftLabel(String(row[map.colShift] ?? ''));
      if (shiftHit) currentShiftKey = shiftHit;
    }

    const ingestCell = (col: number | null, bucket: 'man' | 'chay' | 'dessert') => {
      if (col == null) return;
      const cellText = String(row[col] ?? '').trim();
      if (!cellText) return;
      const shift = days[currentDayIdx]?.shifts[currentShiftKey];
      if (!shift) return;

      const parsedLbl = stripLeadingDishLabel(cellText);
      const lines = splitDishLines(parsedLbl.rest);
      for (const trimmed of lines) {
        if (trimmed.length < 2) continue;
        const detected = matchDishBucket(trimmed) || bucket;

        if (detected === 'dessert') {
          shift.trangMiengMan = trimmed;
          shift.trangMiengChay = trimmed;
          continue;
        }
        const { cleanName, portions } = extractDishPortions(trimmed);
        if (cleanName.length < 2) continue;
        const item: ParsedDishWithConfidence = { name: cleanName, raw: trimmed, portions, confidence: 0.9 };
        if (detected === 'chay') shift.chay.push(item);
        else shift.man.push(item);
      }
    };

    ingestCell(map.colMan, 'man');
    ingestCell(map.colChay, 'chay');
    ingestCell(map.colDessert, 'dessert');
  }

  const total = days.reduce((acc, d) => acc
    + d.shifts.breakfast.man.length + d.shifts.breakfast.chay.length
    + d.shifts.lunch.man.length + d.shifts.lunch.chay.length
    + d.shifts.dinner.man.length + d.shifts.dinner.chay.length, 0);

  if (total === 0) {
    throw new StructuredFileError(
      'UNKNOWN_STRUCTURE',
      'Sau khi phân tích lại với cột đã chọn vẫn không tìm thấy món ăn nào.',
      [
        'Kiểm tra lại mapping: cột "Món mặn" hoặc "Món chay" phải là cột chứa tên món (hoặc nhóm ô chứa nhiều dòng món).',
        'Nếu món của bảng nằm trong 1 cột duy nhất kèm nhãn "Mặn: / Chay:" tại dòng riêng, hãy chọn cùng cột đó cho cả Mặn và Chay.'
      ]
    );
  }

  if (map.colDay == null) {
    warnings.push('Chưa chọn cột Ngày — hệ thống mặc định đẩy món rơi vào nhóm đầu bảng (Thứ 2).');
  }

  days.forEach(d => {
    (['breakfast', 'lunch', 'dinner'] as const).forEach(shiftKey => {
      if (shiftKey !== 'breakfast' && d.shifts[shiftKey].man.length === 0) {
        warnings.push(`${d.dayOfWeek}: Chưa có món mặn`);
      }
    });
  });

  const lower = file.name.toLowerCase();
  return {
    supplierId,
    supplierName,
    weekStartDate: currentWeekStart,
    days,
    warnings,
    fileHash: hash,
    sourceType: lower.endsWith('.csv') ? 'csv' : lower.endsWith('.ods') ? 'excel' : 'excel'
  };
}
