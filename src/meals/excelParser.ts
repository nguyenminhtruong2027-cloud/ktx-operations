import * as XLSX from 'xlsx';
import { DayCode, DayMenu, DishRow, NccInfo, WeeklyMenu } from './types';

export interface SheetPreview {
  sheetName: string;
  rows: string[][];
}

export interface ManualColumnMap {
  dayCol: number;
  sangMonCol: number;
  sangTlCol: number;
  truaMonCol: number;
  truaTlCol: number;
  toiMonCol: number;
  toiTlCol: number;
}

export interface ParsedFileResult {
  menus: WeeklyMenu[];
  rawSheets: SheetPreview[];
  needsManualMapping: boolean;
  error?: string;
}

const DAY_CODES: DayCode[] = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function normNFC(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).normalize('NFC').replace(/\s+/g, ' ').trim();
}

function matchDayCode(text: string): DayCode | null {
  const s = normNFC(text).toLowerCase();
  if (!s || s === 'thứ' || s === 'thu') return null;
  if (/^thứ\s*2\b|^t2\b/.test(s)) return 'T2';
  if (/^thứ\s*3\b|^t3\b/.test(s)) return 'T3';
  if (/^thứ\s*4\b|^t4\b/.test(s)) return 'T4';
  if (/^thứ\s*5\b|^t5\b/.test(s)) return 'T5';
  if (/^thứ\s*6\b|^t6\b/.test(s)) return 'T6';
  if (/^thứ\s*7\b|^t7\b/.test(s)) return 'T7';
  if (/^(thứ\s*cn|chủ\s*nhật|chủ\s*\/?\s*nhật|cn)\b/.test(s)) return 'CN';
  return null;
}

export function detectNccFromText(text: string, nccList: NccInfo[]): string | null {
  const lower = normNFC(text).toLowerCase();
  if (!lower) return null;

  for (const ncc of nccList) {
    if (lower.includes(ncc.name.toLowerCase())) return ncc.code;
    if (ncc.aliases) {
      for (const alias of ncc.aliases) {
        if (alias.length >= 3 && lower.includes(alias.toLowerCase())) {
          return ncc.code;
        }
      }
    }
  }
  for (const ncc of nccList) {
    const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${ncc.code.toLowerCase()}(?:$|[^\\p{L}\\p{N}])`, 'iu');
    if (re.test(lower)) return ncc.code;
  }
  return null;
}

function formatDateDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeDMY(dmy: string, fallbackYear?: string): string {
  const mFull = dmy.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (mFull) {
    const y = mFull[3].length === 2 ? `20${mFull[3]}` : mFull[3];
    return `${mFull[1].padStart(2, '0')}/${mFull[2].padStart(2, '0')}/${y}`;
  }
  const mShort = dmy.trim().match(/^(\d{1,2})[\/\-](\d{1,2})$/);
  if (mShort && fallbackYear) {
    return `${mShort[1].padStart(2, '0')}/${mShort[2].padStart(2, '0')}/${fallbackYear}`;
  }
  return dmy.trim();
}

function parseDMY(str: string): Date | null {
  const norm = normalizeDMY(str);
  const m = norm.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

function addDaysDMY(dmy: string, days: number): string {
  const d = parseDMY(dmy);
  if (!d) return dmy;
  d.setDate(d.getDate() + days);
  return formatDateDMY(d);
}

function detectWeekFromText(text: string): { tuanTu: string; tuanDen: string } {
  const s = normNFC(text);
  const rangeFull = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s*(?:đến|den|\-|~|–)\s*(?:ngày\s*)?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (rangeFull) {
    const tuanTu = `${rangeFull[1].padStart(2, '0')}/${rangeFull[2].padStart(2, '0')}/${rangeFull[3]}`;
    const tuanDen = `${rangeFull[4].padStart(2, '0')}/${rangeFull[5].padStart(2, '0')}/${rangeFull[6]}`;
    return { tuanTu, tuanDen };
  }

  const rangeShort = s.match(/(\d{1,2})[\/\-](\d{1,2})\s*(?:đến|den|\-|~|–)\s*(?:ngày\s*)?(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i);
  if (rangeShort) {
    const year = rangeShort[5];
    const tuanTu = `${rangeShort[1].padStart(2, '0')}/${rangeShort[2].padStart(2, '0')}/${year}`;
    const tuanDen = `${rangeShort[3].padStart(2, '0')}/${rangeShort[4].padStart(2, '0')}/${year}`;
    return { tuanTu, tuanDen };
  }

  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { tuanTu: formatDateDMY(monday), tuanDen: formatDateDMY(sunday) };
}

function detectAnomaliesInSheet(rows: string[][], tuanTu: string): string[] {
  const anomalies: string[] = [];
  const fullText = rows.map(r => r.join(' ')).join(' ');

  if (/\bÔỉ\b/.test(fullText)) {
    anomalies.push('Lỗi chính tả trong file: "Ôỉ" (đã nhận diện là Ổi - trái cây).');
  }
  if (/Nuôi xào/i.test(fullText)) {
    anomalies.push('Lỗi chính tả trong file: "Nuôi xào" (Nui xào).');
  }
  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const cell = rows[r][c];
      if (cell === 'ồ' || cell === 'Ồ') {
        anomalies.push(`Ô rác tại dòng ${r + 1}, cột ${c + 1}: "${cell}".`);
      }
    }
  }

  // Compare normalized dd/mm/yyyy dates
  const normTuanTu = normalizeDMY(tuanTu);
  const year = normTuanTu.split('/')[2] || String(new Date().getFullYear());
  const topText = rows.slice(0, 6).map(r => r.join(' ')).join(' ');
  const dateMatches = topText.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/g);
  if (dateMatches && normTuanTu) {
    const normalizedMatches = dateMatches.map(d => normalizeDMY(d, year));
    const hasStart = normalizedMatches.some(d => d === normTuanTu);
    if (!hasStart && normalizedMatches.length > 0) {
      anomalies.push(
        `Ngày ở tiêu đề file (${normalizedMatches[0]}) có thể lệch với ngày bắt đầu tuần (${normTuanTu}).`
      );
    }
  }

  return Array.from(new Set(anomalies));
}

function findHeaderColumns(rows: string[][]): ManualColumnMap | null {
  let sangCol = -1;
  let truaCol = -1;
  let toiCol = -1;
  let headerRowIdx = -1;

  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r];
    let s = -1, tr = -1, to = -1;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c].toLowerCase();
      if (/\b(bữa\s*)?sáng\b/.test(cell) && s === -1) s = c;
      if (/\b(bữa\s*)?trưa\b/.test(cell) && tr === -1) tr = c;
      if (/\b(bữa\s*)?(tối|chiều)\b/.test(cell) && to === -1) to = c;
    }
    if (tr !== -1 && to !== -1) {
      sangCol = s;
      truaCol = tr;
      toiCol = to;
      headerRowIdx = r;
      break;
    }
  }

  if (headerRowIdx === -1) return null;

  let dayCol = 0;
  for (let r = headerRowIdx + 1; r < Math.min(rows.length, headerRowIdx + 20); r++) {
    for (let c = 0; c < Math.max(1, truaCol); c++) {
      if (matchDayCode(rows[r][c])) {
        dayCol = c;
        break;
      }
    }
  }

  const findWeightCol = (startCol: number, nextSectionCol: number): number => {
    if (startCol === -1) return -1;
    const limit = nextSectionCol > startCol ? nextSectionCol : startCol + 3;
    for (let r = headerRowIdx; r <= Math.min(headerRowIdx + 2, rows.length - 1); r++) {
      for (let c = startCol + 1; c < Math.min(limit, rows[r].length); c++) {
        const h = rows[r][c].toLowerCase();
        if (/trọng\s*lượng|định\s*lượng|tl|gram|gr\b/.test(h)) {
          return c;
        }
      }
    }
    return startCol + 1 < limit ? startCol + 1 : -1;
  };

  return {
    dayCol,
    sangMonCol: sangCol,
    sangTlCol: findWeightCol(sangCol, truaCol),
    truaMonCol: truaCol,
    truaTlCol: findWeightCol(truaCol, toiCol),
    toiMonCol: toiCol,
    toiTlCol: findWeightCol(toiCol, toiCol + 3),
  };
}

export function parseSheetWithMap(
  rows: string[][],
  map: ManualColumnMap,
  ncc: string,
  tuanTu: string,
  tuanDen: string,
  loai: 'man' | 'chay',
  fileName?: string
): { menu: WeeklyMenu | null; error?: string } {
  const dayStarts: { code: DayCode; rowIdx: number }[] = [];

  for (let r = 0; r < rows.length; r++) {
    const cell = rows[r][map.dayCol] || '';
    const code = matchDayCode(cell);
    if (code) {
      if (dayStarts.length === 0 || dayStarts[dayStarts.length - 1].code !== code) {
        dayStarts.push({ code, rowIdx: r });
      }
    }
  }

  if (dayStarts.length < 7) {
    return {
      menu: null,
      error: `Chỉ tìm thấy ${dayStarts.length}/7 ngày trong sheet (cần đủ Thứ 2 đến Chủ nhật). Vui lòng kiểm tra lại hoặc dùng "Ghép cột thủ công".`
    };
  }

  const ngay: DayMenu[] = [];
  for (let i = 0; i < 7; i++) {
    const start = dayStarts[i].rowIdx;
    const nextStart = i + 1 < dayStarts.length ? dayStarts[i + 1].rowIdx : Math.min(rows.length, start + 7);
    const blockSize = Math.min(7, Math.max(1, nextStart - start));
    const ngayThang = addDaysDMY(tuanTu, i);

    let sangMon = '';
    const sangIngredients: string[] = [];
    if (map.sangMonCol >= 0) {
      sangMon = rows[start]?.[map.sangMonCol] || '';
      const firstTl = map.sangTlCol >= 0 ? (rows[start]?.[map.sangTlCol] || '') : '';
      if (firstTl) sangIngredients.push(firstTl);
      for (let offset = 1; offset < blockSize; offset++) {
        const rIdx = start + offset;
        const ing = rows[rIdx]?.[map.sangMonCol] || '';
        const ingTl = map.sangTlCol >= 0 ? (rows[rIdx]?.[map.sangTlCol] || '') : '';
        if (ing || ingTl) {
          sangIngredients.push([ing, ingTl].filter(Boolean).join(' '));
        }
      }
    }

    const trua: DishRow[] = [];
    const toi: DishRow[] = [];
    for (let offset = 0; offset < 7; offset++) {
      const rIdx = start + offset;
      trua.push({
        ten: rIdx < nextStart && map.truaMonCol >= 0 ? (rows[rIdx]?.[map.truaMonCol] || '') : '',
        tl: rIdx < nextStart && map.truaTlCol >= 0 ? (rows[rIdx]?.[map.truaTlCol] || '') : ''
      });
      toi.push({
        ten: rIdx < nextStart && map.toiMonCol >= 0 ? (rows[rIdx]?.[map.toiMonCol] || '') : '',
        tl: rIdx < nextStart && map.toiTlCol >= 0 ? (rows[rIdx]?.[map.toiTlCol] || '') : ''
      });
    }

    ngay.push({
      ma: DAY_CODES[i],
      ngayThang,
      sang: { mon: sangMon, thanhPhan: sangIngredients.join(', ') },
      trua,
      toi
    });
  }

  const batThuongFile = detectAnomaliesInSheet(rows, tuanTu);

  return {
    menu: {
      id: `menu-${ncc || 'UNKNOWN'}-${loai}-${tuanTu.replace(/\//g, '')}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ncc,
      tuanTu,
      tuanDen,
      loai,
      ngay,
      batThuongFile,
      fileName,
      uploadedAt: new Date().toISOString()
    }
  };
}

export async function parseExcelOrCsvFile(
  file: File,
  nccList: NccInfo[]
): Promise<ParsedFileResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  const rawSheets: SheetPreview[] = [];
  const menus: WeeklyMenu[] = [];
  let needsManualMapping = false;
  let lastError = '';

  // 1. Detect NCC from filename first, or from any sheet in the workbook
  let workbookNcc: string | null = detectNccFromText(file.name, nccList);

  const validSheets: { sheetName: string; rows: string[][]; sheetNcc: string | null }[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
    const rows: string[][] = rawRows
      .map(r => (Array.isArray(r) ? r.map(normNFC) : []))
      .filter(r => r.some(cell => cell.length > 0));

    if (rows.length < 5) continue;
    rawSheets.push({ sheetName: normNFC(sheetName), rows });

    const topText = rows.slice(0, 8).map(r => r.join(' ')).join(' ');
    const sheetNcc = detectNccFromText(`${sheetName} ${topText}`, nccList);
    if (!workbookNcc && sheetNcc) {
      workbookNcc = sheetNcc;
    }
    validSheets.push({ sheetName: normNFC(sheetName), rows, sheetNcc });
  }

  for (const { sheetName, rows, sheetNcc } of validSheets) {
    const topText = rows.slice(0, 8).map(r => r.join(' ')).join(' ');
    const ncc = sheetNcc || workbookNcc || '';
    const { tuanTu, tuanDen } = detectWeekFromText(`${file.name} ${sheetName} ${topText}`);
    const isChay =
      (/\bchay\b/i.test(sheetName) && !/\bmặn\b/i.test(sheetName)) ||
      (/thực\s*đơn\s*chay/i.test(topText) && !/thực\s*đơn\s*mặn/i.test(topText));
    const loai: 'man' | 'chay' = isChay ? 'chay' : 'man';

    const colMap = findHeaderColumns(rows);
    if (!colMap) {
      needsManualMapping = true;
      lastError = `Không nhận diện được hàng tiêu đề Sáng/Trưa/Tối trong sheet "${sheetName}".`;
      continue;
    }

    const res = parseSheetWithMap(rows, colMap, ncc, tuanTu, tuanDen, loai, file.name);
    if (res.menu) {
      menus.push(res.menu);
    } else {
      needsManualMapping = true;
      lastError = res.error || 'Lỗi cấu trúc bảng.';
    }
  }

  if (rawSheets.length === 0) {
    return {
      menus: [],
      rawSheets: [],
      needsManualMapping: false,
      error: 'File không có dữ liệu hoặc tất cả các sheet đều trống.'
    };
  }

  return {
    menus,
    rawSheets,
    needsManualMapping: menus.length === 0 && needsManualMapping,
    error: menus.length === 0 ? lastError : undefined
  };
}
