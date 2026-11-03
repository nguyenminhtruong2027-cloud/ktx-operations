// src/meals/components/MenuUploadWizard.tsx
// Wizard 4 bước trích xuất thực đơn tự động:
// 1) Tải lên (kéo-thả, Ctrl+V, nhiều file) -> 2) Trích xuất (tiến độ, hủy, thử lại)
// -> 3) Xem trước & sửa (bảng tuần + ảnh gốc, viền vàng confidence<0.8, viền đỏ thiếu)
// -> 4) Áp dụng (Ghi đè / Bổ sung ô trống / Gộp + diff)

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload, FileSpreadsheet, Trash2, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Camera, Sparkles, ArrowRight, ArrowLeft, RefreshCw, X, Eye, Image as ImageIcon, Wand2
} from 'lucide-react';
import ImageLightboxModal from '../../components/ImageLightboxModal';
import {
  extractMenuWithGemini,
  GeminiExtractError,
  isAbortError,
  checkProxyHealth,
  getGeminiCacheCount,
  type ProxyHealth
} from '../geminiMenuService';
import {
  parseExcelOrCsvFile,
  parsePlainTextMenu,
  createEmptyParsedWeek,
  type ParseResult
} from '../menuFileParser';
import { extractDishPortions, normalizeVietnameseText } from '../menuNormalization';
import { getWeekRangeStr } from '../dateUtils';
import {
  APPLY_MODES,
  applyParsedToMenu,
  computeMenuDiff,
  parsedDaysToWeeklyMenu,
  type ApplyMode,
  type MenuDiff
} from '../menuApplyService';
import { type DayWeeklyMenu } from '../types';

// ===================== Types =====================

type UploadSource = 'ai' | 'excel' | 'text';
type ItemStatus = 'pending' | 'parsing' | 'done' | 'error' | 'canceled';

interface UploadItem {
  id: string;
  file: File;
  source: UploadSource;
  previewUrl?: string;
  status: ItemStatus;
  statusLabel: string;
  result?: ParseResult;
  error?: string;
  cacheHit?: boolean;
}

interface CellRef {
  dayIdx: number;
  shiftKey: 'breakfast' | 'lunch' | 'dinner';
  bucket: 'man' | 'chay';
}

export interface WizardApplyPayload {
  finalMenu: DayWeeklyMenu[];
  mode: ApplyMode;
  supplierId: string;
  supplierName: string;
  diff: MenuDiff;
  fileNames: string[];
  sourceTypes: string[];
  cacheHits: number;
}

interface MenuUploadWizardProps {
  open: boolean;
  onClose: () => void;
  weekStartDate: string;
  currentMenu: DayWeeklyMenu[];
  onApply: (payload: WizardApplyPayload) => void;
  // Khi mở từ Không gian NCC: khóa NCC (không cho đổi tổ chức trích xuất)
  lockedVendorId?: string;
  lockedVendorName?: string;
}

function detectSource(file: File): UploadSource {
  const lower = file.name.toLowerCase();
  if (file.type === 'application/pdf' || lower.endsWith('.pdf')) return 'ai';
  if (file.type.startsWith('image/')) return 'ai';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) return 'excel';
  if (lower.endsWith('.txt') || file.type.startsWith('text/')) return 'text';
  return 'ai';
}

const SOURCE_TAGS: Record<UploadSource, { label: string; className: string }> = {
  ai: { label: 'AI (ảnh/PDF)', className: 'bg-purple-100 text-purple-700' },
  excel: { label: 'Excel/CSV', className: 'bg-emerald-100 text-emerald-700' },
  text: { label: 'Văn bản', className: 'bg-blue-100 text-blue-700' }
};

const SHIFT_TITLES = { breakfast: 'Bữa sáng', lunch: 'Bữa trưa', dinner: 'Bữa tối' } as const;

// ===================== Component =====================

export default function MenuUploadWizard({ open, onClose, weekStartDate, currentMenu, onApply, lockedVendorId, lockedVendorName }: MenuUploadWizardProps) {
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedCell, setSelectedCell] = useState<CellRef | null>(null);
  const [editorText, setEditorText] = useState<string>('');
  const [applyMode, setApplyMode] = useState<ApplyMode>('overwrite');
  const [supplierName, setSupplierName] = useState<string>('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [proxyHealth, setProxyHealth] = useState<ProxyHealth | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const itemsRef = useRef<UploadItem[]>([]);
  itemsRef.current = items;

  // Kiểm tra proxy có sẵn sàng không (key được giữ phía server)
  useEffect(() => {
    if (!open) return;
    setProxyHealth(null);
    let alive = true;
    checkProxyHealth().then(h => { if (alive) setProxyHealth(h); });
    return () => { alive = false; };
  }, [open]);

  // Dọn object URL khi đóng wizard
  useEffect(() => () => {
    abortRef.current?.abort();
    itemsRef.current.forEach(i => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
  }, []);

  // ---------- Thêm file ----------
  const addFiles = useCallback((files: FileList | File[]) => {
    const list = Array.from(files).filter(f => f.size > 0);
    if (!list.length) return;
    setItems(prev => [
      ...prev,
      ...list.map(file => {
        const source = detectSource(file);
        const isImage = file.type.startsWith('image/');
        return {
          id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          source,
          previewUrl: isImage ? URL.createObjectURL(file) : undefined,
          status: 'pending' as ItemStatus,
          statusLabel: 'Chờ trích xuất'
        };
      })
    ]);
  }, []);

  // Ctrl+V / Cmd+V dán file
  useEffect(() => {
    if (!open) return;
    const handler = (e: ClipboardEvent) => {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [open, addFiles]);

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  // ---------- Chạy trích xuất ----------
  const runItem = useCallback(async (item: UploadItem, signal: AbortSignal) => {
    const update = (patch: Partial<UploadItem>) =>
      setItems(prev => prev.map(i => (i.id === item.id ? { ...i, ...patch } : i)));

    update({ status: 'parsing', statusLabel: 'Đang xử lý...', error: undefined, cacheHit: false });
    try {
      let result: ParseResult;
      if (item.source === 'ai') {
        update({ statusLabel: 'Gemini đang đọc tài liệu...' });
        result = await extractMenuWithGemini(item.file, {
          weekStartDate,
          signal,
          targetSupplierId: lockedVendorId,
          supplierHint: lockedVendorName,
          onCacheHit: () => update({ cacheHit: true, statusLabel: 'Trùng hash — dùng kết quả cache' })
        });
      } else if (item.source === 'excel') {
        update({ statusLabel: 'Đang giải mã bảng tính...' });
        // Gắn kết quả ĐỘC LẬP cho đúng NCC được chọn (không ghi chéo giữa các NCC)
        result = await parseExcelOrCsvFile(item.file, weekStartDate, lockedVendorId);
      } else {
        update({ statusLabel: 'Đang phân tích văn bản...' });
        const text = await item.file.text();
        result = await parsePlainTextMenu(text, weekStartDate, lockedVendorId);
      }
      update({
        status: 'done',
        statusLabel: 'Đã trích xuất',
        result
      });
    } catch (err) {
      if (isAbortError(err)) {
        update({ status: 'canceled', statusLabel: 'Đã hủy' });
        return;
      }
      update({
        status: 'error',
        statusLabel: 'Thất bại',
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }, [weekStartDate, lockedVendorId, lockedVendorName]);

  const busyItems = items.filter(i => i.status === 'parsing');
  const startExtraction = useCallback(async () => {
    if (busyItems.length > 0) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStep(1);
    const targets = itemsRef.current.filter(i => i.status === 'pending' || i.status === 'canceled' || i.status === 'error');
    await Promise.allSettled(targets.map(item => runItem(item, controller.signal)));
    abortRef.current = null;
  }, [runItem, items, busyItems.length]);

  const cancelExtraction = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const retryItem = async (id: string) => {
    const item = itemsRef.current.find(i => i.id === id);
    if (!item) return;
    const controller = abortRef.current || new AbortController();
    abortRef.current = controller;
    await runItem(item, controller.signal);
  };

  const hasProcessing = items.some(i => i.status === 'parsing');
  const doneCount = items.filter(i => i.status === 'done').length;
  const doneItems = items.filter(i => i.status === 'done' && i.result);

  // ---------- Gộp kết quả nhiều file ----------
  const supplierNameRef = supplierName;
  const merged = useMemo(() => {
    if (!doneItems.length) return null;
    const warnings: string[] = [];
    const days = createEmptyParsedWeek(weekStartDate);
    let supplierId: string | null = null;
    let supplierLabel = '';

    for (const item of doneItems) {
      const r = item.result!;
      if (!supplierId) {
        supplierId = r.supplierId;
        supplierLabel = supplierNameRef || r.supplierName || 'Tám Phương';
      }
      r.days.forEach((rd, dIdx) => {
        const target = days[dIdx];
        if (!target) return;
        (['breakfast', 'lunch', 'dinner'] as const).forEach(shiftKey => {
          const src = rd.shifts[shiftKey];
          const dst = target.shifts[shiftKey];
          for (const [bucket, srcList, dstList] of [
            ['man', src.man, dst.man],
            ['chay', src.chay, dst.chay]
          ] as const) {
            for (const dish of srcList) {
              const key = normalizeVietnameseText(dish.name).toLowerCase();
              if (!dstList.some(d => normalizeVietnameseText(d.name).toLowerCase() === key)) {
                dstList.push({ ...dish });
              }
            }
          }
          const tm = (src.trangMiengMan || '').trim();
          if (tm && (!dst.trangMiengMan || dst.trangMiengMan === 'Trái cây theo mùa')) dst.trangMiengMan = tm;
          const tmC = (src.trangMiengChay || '').trim();
          if (tmC && (!dst.trangMiengChay || dst.trangMiengChay === 'Trái cây theo mùa')) dst.trangMiengChay = tmC;
        });
      });
      r.warnings.forEach(w => warnings.push(`[${item.file.name}] ${w}`));
    }

    return {
      supplierId: supplierId || 'tam-phuong',
      supplierName: supplierLabel || 'Tám Phương',
      days,
      warnings,
      fileNames: doneItems.map(i => i.file.name),
      sourceTypes: doneItems.map(i => i.result!.sourceType),
      cacheHits: doneItems.filter(i => i.cacheHit).length
    };
  }, [doneItems, weekStartDate, supplierNameRef]);

  useEffect(() => {
    if (merged && !supplierName) setSupplierName(merged.supplierName);
  }, [merged, supplierName]);

  // ---------- Sửa ô ----------
  const updateCellDishes = (cell: CellRef, lines: string[]) => {
    setItems(prev => prev.map(item => {
      if (item.status !== 'done' || !item.result) return item;
      const days = item.result.days.map((day, dI) => {
        if (dI !== cell.dayIdx) return day;
        const shift = day.shifts[cell.shiftKey];
        const existing = cell.bucket === 'man' ? shift.man : shift.chay;
        const kept = existing.filter(d => lines.some(l => l.trim() === d.raw));
        const fresh = lines
          .map(l => l.trim())
          .filter(Boolean)
          .filter(l => extractDishPortions(l).cleanName.length >= 2)
          .map(l => ({ name: extractDishPortions(l).cleanName, raw: l, portions: extractDishPortions(l).portions, confidence: 1 }))
          .filter(nd => !existing.some(d => d.raw === nd.raw));
        return {
          ...day,
          shifts: { ...day.shifts, [cell.shiftKey]: { ...shift, [cell.bucket]: [...kept, ...fresh] } }
        };
      });
      return { ...item, result: { ...item.result, days } };
    }));
  };

  const selectCell = (cell: CellRef) => {
    const day = merged?.days[cell.dayIdx];
    if (!day) return;
    const shift = day.shifts[cell.shiftKey];
    const list = cell.bucket === 'man' ? shift.man : shift.chay;
    setSelectedCell(cell);
    setEditorText(list.map(d => d.raw).join('\n'));
  };

  const commitCell = () => {
    if (!selectedCell) return;
    updateCellDishes(selectedCell, editorText.split(/\r?\n/).map(l => l.replace(/^[-•*]\s*/, '')));
  };

  const getBucketList = (cell: CellRef) => {
    const shift = merged?.days[cell.dayIdx]?.shifts[cell.shiftKey];
    if (!shift) return [];
    return cell.bucket === 'man' ? shift.man : shift.chay;
  };

  const cellState = (dayIdx: number, shiftKey: 'breakfast' | 'lunch' | 'dinner', bucket: 'man' | 'chay'): 'ok' | 'warn' | 'missing' => {
    const dishes = getBucketList({ dayIdx, shiftKey, bucket });
    if (!dishes.length) {
      // Bữa sáng thường không có trong nhiều thực đơn NCC -> không đánh dấu đỏ
      if (shiftKey === 'breakfast') return 'ok';
      return 'missing';
    }
    return dishes.some(d => d.confidence < 0.8) ? 'warn' : 'ok';
  };

  const cellBorder = (state: 'ok' | 'warn' | 'missing') =>
    state === 'warn'
      ? 'border-2 border-amber-400 bg-amber-50/60 hover:border-amber-500'
      : state === 'missing'
        ? 'border-2 border-red-400 bg-red-50/70 hover:border-red-500'
        : 'border border-slate-200 hover:border-teal-500 bg-white';

  // ---------- Áp dụng ----------
  const proposedMenu = useMemo(
    () => (merged ? parsedDaysToWeeklyMenu(merged.days, weekStartDate) : []),
    [merged, weekStartDate]
  );

  const appliedMenu = useMemo(
    () => (proposedMenu.length ? applyParsedToMenu(currentMenu, proposedMenu, applyMode) : []),
    [proposedMenu, currentMenu, applyMode]
  );

  const diff = useMemo(
    () => (appliedMenu.length ? computeMenuDiff(currentMenu, appliedMenu) : null),
    [appliedMenu, currentMenu, applyMode]
  );

  const lowConfidenceCount = merged
    ? merged.days.reduce((acc, day) =>
        acc + (['breakfast', 'lunch', 'dinner'] as const).reduce((a, sk) => {
          const s = day.shifts[sk];
          return a + s.man.filter(d => d.confidence < 0.8).length + s.chay.filter(d => d.confidence < 0.8).length;
        }, 0), 0)
    : 0;

  const handleApply = () => {
    if (!merged || !appliedMenu.length) return;
    onApply({
      finalMenu: appliedMenu,
      mode: applyMode,
      supplierId: lockedVendorId || merged.supplierId,
      supplierName: lockedVendorId ? (lockedVendorName || supplierName) : supplierName,
      diff: diff!,
      fileNames: merged.fileNames,
      sourceTypes: merged.sourceTypes,
      cacheHits: merged.cacheHits
    });
    itemsRef.current.forEach(i => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
    setItems([]);
    setStep(0);
    setSupplierName('');
    onClose();
  };

  const closeWizard = () => {
    abortRef.current?.abort();
    itemsRef.current.forEach(i => { if (i.previewUrl) URL.revokeObjectURL(i.previewUrl); });
    setItems([]);
    setStep(0);
    setSupplierName('');
    onClose();
  };

  if (!open) return null;

  const weekRange = getWeekRangeStr(weekStartDate);
  const canGoPreview = doneCount > 0 && !hasProcessing;
  const canGoApply = Boolean(merged) && !hasProcessing;

  // ===================== RENDER =====================

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-7xl rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden">
        {/* Header + step chips */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-amber-50 rounded-xl"><Sparkles className="w-4 h-4 text-amber-600" /></div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Trích xuất thực đơn bằng AI</h3>
              <p className="text-[10px] text-slate-500">Tuần {weekRange} • Gemini đa phương thức • tối đa 3 file song song</p>
            </div>
          </div>
          <button onClick={closeWizard} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex items-center justify-center gap-1 sm:gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100 overflow-x-auto">
          {['1. Tải lên', '2. Trích xuất', '3. Kiểm tra & sửa', '4. Áp dụng'].map((label, idx) => {
            const reachable =
              idx === 0 ||
              (idx === 1 && items.length > 0) ||
              (idx === 2 && doneCount > 0) ||
              (idx === 3 && canGoPreview);
            const active = step === idx;
            return (
              <button
                key={label}
                onClick={() => reachable && setStep(idx)}
                disabled={!reachable}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold whitespace-nowrap transition ${
                  active ? 'bg-amber-500 text-white shadow-sm'
                    : reachable ? 'bg-white text-slate-600 border border-slate-200 hover:border-amber-400'
                    : 'bg-slate-100 text-slate-400 border border-slate-100 cursor-not-allowed'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* ---------- BƯỚC 1: TẢI LÊN ---------- */}
          {step === 0 && (
            <div className="space-y-4">
              {proxyHealth && !proxyHealth.reachable && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800 font-medium">
                  Máy chủ Gemini proxy chưa chạy. Trích xuất ảnh/PDF cần server.js (lệnh <code className="font-mono">npm run dev</code> hoặc <code className="font-mono">npm run dev:proxy</code>). File Excel/CSV/Text vẫn hoạt động.
                </div>
              )}
              {proxyHealth?.reachable && !proxyHealth.hasKey && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium">
                  Server Gemini đã chạy nhưng <b>chưa cấu hình GEMINI_API_KEY</b> trong file .env (hoặc Secrets của AI Studio).
                </div>
              )}

              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center space-y-2 cursor-pointer transition bg-slate-50 ${
                  dragOver ? 'border-amber-500 bg-amber-50' : 'border-slate-300 hover:border-amber-400'
                }`}
              >
                <Upload className="w-8 h-8 text-amber-600 mx-auto" />
                <div className="text-xs font-bold text-slate-800">Kéo-thả file vào đây, hoặc bấm để chọn, hoặc <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono">Ctrl+V</kbd> dán ảnh từ clipboard</div>
                <div className="text-[10px] text-slate-500">Hỗ trợ nhiều file cùng lúc: ảnh (JPG/PNG/WEBP), PDF, Excel (.xlsx/.xls), CSV, .txt — thực đơn theo tuần</div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.csv,.txt,.pdf,image/*"
                className="hidden"
                onChange={e => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }}
              />

              {items.length > 0 && (
                <div className="space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center space-x-3 p-2.5 rounded-xl border border-slate-200 bg-white">
                      <div className="p-2 bg-slate-100 rounded-lg shrink-0">
                        {item.source === 'ai' && item.previewUrl ? (
                          <img src={item.previewUrl} alt="" className="w-9 h-9 rounded object-cover" />
                        ) : item.source === 'excel' ? (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <span className="block w-4 h-4 text-slate-500 text-center"><Camera className="w-4 h-4 text-slate-500" /></span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${SOURCE_TAGS[item.source].className}`}>{SOURCE_TAGS[item.source].label}</span>
                          <span className="text-xs font-bold text-slate-900 truncate" title={item.file.name}>{item.file.name}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {(item.file.size / 1024).toFixed(0)} KB • {item.status === 'parsing' ? item.statusLabel : item.statusLabel}
                          {item.cacheHit && <span className="ml-1 text-teal-600 font-bold">• cache</span>}
                        </div>
                        {item.error && <div className="text-[10px] text-rose-600">{item.error}</div>}
                      </div>
                      {item.previewUrl && (
                        <button onClick={() => setLightboxUrl(item.previewUrl!)} className="p-1.5 text-slate-400 hover:text-slate-700" title="Xem ảnh gốc">
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      {item.status === 'error' && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                      {(item.status === 'error' || item.status === 'canceled') && (
                        <button onClick={() => void retryItem(item.id)} className="p-1.5 text-amber-600 hover:text-amber-800" title="Thử lại">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => removeItem(item.id)} className="p-1.5 text-slate-300 hover:text-rose-600" title="Bỏ file">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {items.length > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => void startExtraction()}
                    disabled={items.every(i => i.status !== 'pending' && i.status !== 'error' && i.status !== 'canceled')}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                  >
                    <Wand2 className="w-4 h-4" />
                    <span>Bắt đầu trích xuất</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---------- BƯỚC 2: TRÍCH XUẤT ---------- */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800">
                  {hasProcessing ? 'Đang trích xuất...' : 'Trích xuất hoàn tất'} • {doneCount}/{items.length} file
                </div>
                {hasProcessing ? (
                  <button onClick={cancelExtraction} className="px-3 py-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition">
                    Hủy tất cả
                  </button>
                ) : (
                  <button onClick={() => void startExtraction()} disabled={!items.some(i => i.status !== 'done')} className="px-3 py-1.5 border border-teal-200 text-teal-700 hover:bg-teal-50 rounded-xl text-xs font-bold transition disabled:opacity-50">
                    Chạy lại các file chưa xong
                  </button>
                )}
              </div>

              {/* Thanh tiến độ */}
              <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${hasProcessing ? 'bg-gradient-to-r from-amber-400 to-amber-600 animate-pulse' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`}
                  style={{ width: `${items.length ? Math.round(((doneCount + items.filter(i => i.status === 'error').length) / items.length) * 100) : 0}%` }}
                />
              </div>

              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    {item.status === 'parsing' ? (
                      <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
                    ) : item.status === 'done' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : item.status === 'error' ? (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-slate-700 truncate flex-1" title={item.file.name}>{item.file.name}</span>
                    <span className={`text-[10px] font-semibold ${item.status === 'done' ? 'text-emerald-600' : item.status === 'error' ? 'text-rose-600' : 'text-slate-500'}`}>
                      {item.statusLabel}
                    </span>
                    {item.error && <span className="text-[10px] text-rose-500 truncate max-w-48" title={item.error || ''}>{item.error}</span>}
                    {item.status === 'error' && (
                      <button onClick={() => void retryItem(item.id)} className="px-2 py-1 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-[10px] font-bold hover:bg-amber-100 transition">
                        Thử lại
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {canGoPreview && (
                <div className="flex justify-end">
                  <button onClick={() => setStep(2)} className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5">
                    <span>Xem trước & sửa</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---------- BƯỚC 3: XEM TRƯỚC & SỬA ---------- */}
          {step === 2 && merged && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Bảng tuần */}
              <div className="xl:col-span-2 overflow-x-auto">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500">Ô viền <span className="inline-block w-2.5 h-2.5 align-middle rounded border-2 border-amber-400 bg-amber-50 mx-1" /> vàng = độ tin cậy &lt; 0.8 • viền <span className="inline-block w-2.5 h-2.5 align-middle rounded border-2 border-red-400 bg-red-50 mx-1" /> đỏ = thiếu dữ liệu • bấm vào ô để sửa</div>
                </div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left text-[10px] font-black text-slate-500 uppercase p-2 w-20">Ngày</th>
                      {(['breakfast', 'lunch', 'dinner'] as const).map(sk => (
                        <th key={sk} className="text-[10px] font-black text-slate-500 uppercase p-2">{SHIFT_TITLES[sk]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {merged.days.map((day, dayIdx) => (
                      <tr key={dayIdx}>
                        <td className="p-2 align-top">
                          <div className="text-xs font-black text-slate-800">{day.dayOfWeek}</div>
                          <div className="text-[10px] text-slate-400">{day.dateStr}</div>
                        </td>
                        {(['breakfast', 'lunch', 'dinner'] as const).map(sk => {
                          const shift = day.shifts[sk];
                          return (
                            <td key={sk} className="p-1.5 align-top">
                              <div className="space-y-1">
                                {(['man', 'chay'] as const).map(bucket => {
                                  const list = bucket === 'man' ? shift.man : shift.chay;
                                  const state = cellState(dayIdx, sk, bucket);
                                  const isSel = selectedCell?.dayIdx === dayIdx && selectedCell?.shiftKey === sk && selectedCell?.bucket === bucket;
                                  return (
                                    <div key={bucket} className={`rounded-lg p-1.5 text-[10px] cursor-pointer transition ${cellBorder(state)} ${isSel ? 'ring-2 ring-teal-500 ring-offset-1' : ''}`}
                                      onClick={() => selectCell({ dayIdx, shiftKey: sk, bucket })}>
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className={`text-[8px] font-black uppercase ${(bucket === 'man' ? 'text-rose-500' : 'text-emerald-600')}`}>{bucket === 'man' ? 'Mặn' : 'Chay'}</span>
                                        <span className="text-[8px] text-slate-400">{list.length}</span>
                                      </div>
                                      {list.length ? list.map((d, idx) => (
                                        <div key={idx} className="flex items-center space-x-1 leading-tight">
                                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${d.confidence < 0.5 ? 'bg-amber-500' : d.confidence < 0.8 ? 'bg-amber-400' : 'bg-emerald-500'}`} />
                                          <span className={d.confidence < 0.8 ? 'font-semibold' : ''}>{d.raw.length > 42 ? d.raw.slice(0, 42) + '…' : d.raw}</span>
                                        </div>
                                      )) : <div className="text-red-400 italic text-[9px]">Trống — bấm để thêm</div>}
                                    </div>
                                  );
                                })}
                                <div
                                  className="rounded p-1 text-[9px] text-slate-500 border border-slate-100 bg-slate-50">
                                  <span className="font-bold text-slate-600">TM: </span>{shift.trangMiengMan} <span className="text-slate-300">/</span> <span>{shift.trangMiengChay}</span>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cột phải: ảnh gốc + sửa ô + cảnh báo */}
              <div className="space-y-3">
                {/* Sửa ô đang chọn */}
                {selectedCell && (
                  <div className="p-3 rounded-xl border-2 border-teal-500 bg-teal-50/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-slate-900">
                        Sửa: {merged.days[selectedCell.dayIdx]?.dayOfWeek} • {SHIFT_TITLES[selectedCell.shiftKey]} • {selectedCell.bucket === 'man' ? 'Món mặn' : 'Món chay'}
                      </div>
                      <button onClick={() => setSelectedCell(null)} className="text-slate-400 hover:text-slate-700"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    <textarea
                      value={editorText}
                      onChange={e => setEditorText(e.target.value)}
                      onBlur={commitCell}
                      rows={7}
                      spellCheck={false}
                      className="w-full p-2 text-[11px] font-medium border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      placeholder="Mỗi dòng một món, giữ nguyên định lượng trong ngoặc..."
                    />
                    <p className="text-[9px] text-teal-700">Mỗi dòng 1 món. Định lượng đặt trong ngoặc, VD: "Vịt kho chao (Vịt 55–65g · Khoai môn 25–30g)". Giá trị sửa tay được đánh độ tin cậy 1.0.</p>
                  </div>
                )}

                {/* Ảnh gốc / file gốc */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="text-[10px] font-black text-slate-500 uppercase mb-2">Tài liệu gốc ({items.filter(i => i.previewUrl || i.source === 'ai').length})</div>
                  <div className="grid grid-cols-2 gap-2">
                    {items.filter(i => i.previewUrl || i.source === 'ai' || i.status === 'done').map(item => (
                      <div key={item.id} className="p-2 bg-white rounded-lg border border-slate-200 flex items-center space-x-2">
                        {item.previewUrl ? (
                          <>
                            <img src={item.previewUrl} alt="" className="w-10 h-10 rounded object-cover" />
                            <button onClick={() => setLightboxUrl(item.previewUrl!)} className="flex-1 min-w-0 text-left">
                              <span className="text-[9px] font-bold text-slate-700 truncate block">{item.file.name}</span>
                              <span className="text-[9px] text-amber-600 font-bold flex items-center"><ImageIcon className="w-3 h-3 mr-0.5" />Xem ảnh gốc</span>
                            </button>
                          </>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <span className="text-[9px] font-bold text-slate-700 truncate block">{item.file.name}</span>
                            <span className="text-[9px] text-slate-400">{item.source === 'ai' ? 'PDF' : 'Dữ liệu'} trích xuất trực tiếp</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cảnh báo */}
                {merged.warnings.length > 0 && (
                  <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 max-h-48 overflow-y-auto">
                    <div className="flex items-center space-x-1.5 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span className="text-[10px] font-black text-amber-800 uppercase">Cảnh báo ({merged.warnings.length})</span>
                    </div>
                    <ul className="space-y-1">
                      {merged.warnings.map((w, i) => (
                        <li key={i} className="text-[10px] text-amber-800 leading-snug">• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* NCC */}
                <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">
                    Nhà cung cấp thực đơn {lockedVendorId ? '(đã khóa — trích xuất cho NCC này)' : ''}
                  </label>
                  <input
                    value={lockedVendorId ? (lockedVendorName || supplierName) : supplierName}
                    onChange={e => setSupplierName(e.target.value)}
                    disabled={Boolean(lockedVendorId)}
                    className={`w-full px-2.5 py-1.5 text-xs font-bold border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white ${lockedVendorId ? 'opacity-70' : ''}`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---------- BƯỚC 4: ÁP DỤNG ---------- */}
          {step === 3 && merged && diff && (
            <div className="space-y-4">
              {/* Chế độ áp dụng */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {APPLY_MODES.map(m => (
                  <button key={m.id} onClick={() => setApplyMode(m.id)}
                    className={`p-3 rounded-xl border-2 text-left transition ${applyMode === m.id ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300 bg-white'}`}>
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-3.5 h-3.5 rounded-full border-2 ${applyMode === m.id ? 'bg-amber-500 border-amber-500' : 'border-slate-300'}`}>
                        {applyMode === m.id && <div className="w-1.5 h-1.5 bg-white rounded-full m-0.5" />}
                      </div>
                      <span className="text-xs font-black text-slate-900">{m.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">{m.desc}</p>
                  </button>
                ))}
              </div>

              {/* Thông tin nguồn */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div><b>{merged.fileNames.length}</b> tài liệu: {merged.fileNames.join(', ')}</div>
                <div>NCC: <b>{supplierName}</b> • Kết quả từ cache: <b>{merged.cacheHits}</b> file {getGeminiCacheCount() > 0 ? `• tổng ${getGeminiCacheCount()} mục cache` : ''}</div>
              </div>

              {lowConfidenceCount > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 font-medium">
                  <b>{lowConfidenceCount}</b> món có độ tin cậy đọc &lt; 0.8. Hãy kiểm tra lại ở bước 3 trước khi ghi.
                </div>
              )}

              {/* Diff */}
              <div className="p-3 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase">Diff so với thực đơn hiện tại</span>
                  <span className="text-[10px] font-bold text-emerald-600">+{diff.addedCount} món mới</span>
                  <span className="text-[10px] font-bold text-rose-600">−{diff.removedCount} món bỏ</span>
                  <span className="text-[10px] font-bold text-slate-600">{diff.changedShifts} bữa thay đổi</span>
                </div>
                {diff.rows.length === 0 ? (
                  <div className="text-[11px] text-slate-400 italic p-2 bg-slate-50 rounded-lg">Không có thay đổi nào giữa thực đơn trích xuất và thực đơn hiện tại.</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-1.5">
                    {diff.rows.map((row, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <div className="text-[10px] font-black text-slate-700">{row.dayOfWeek} {row.dateStr} • {row.shift}</div>
                        {row.additions.map((a, j) => (
                          <div key={`a${j}`} className="text-[10px] font-semibold text-emerald-700 leading-snug"><span className="font-black">+ </span>{a}</div>
                        ))}
                        {row.removals.map((r, j) => (
                          <div key={`r${j}`} className="text-[10px] font-semibold text-rose-600 leading-snug"><span className="font-black">− </span>{r}</div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer điều hướng */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-slate-100 bg-slate-50">
          <div className="text-[10px] text-slate-400 hidden sm:block">
            Thực đơn ghi vào tuần {weekRange} có thể Hoàn tác trong 30 phút sau khi áp dụng.
          </div>
          <div className="flex space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
              className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition disabled:opacity-40 flex items-center space-x-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /><span>Quay lại</span>
            </button>
            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={(step === 1 && !canGoPreview) || (step === 0 && items.length === 0)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
              >
                <span>{step === 0 && items.length > 0 ? 'Trích xuất' : 'Tiếp tục'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={handleApply}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Áp dụng vào thực đơn tuần</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {lightboxUrl && <ImageLightboxModal imageUrl={lightboxUrl} title="Ảnh gốc thực đơn" onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}
