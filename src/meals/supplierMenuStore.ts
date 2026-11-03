// src/meals/supplierMenuStore.ts
// CSDL tập trung `supplier_menus`: thực đơn theo NCC × ngày × ca ăn (Sáng/Trưa/Tối).
// MỘT nguồn sự thật duy nhất — mọi tab/bảng báo cáo/xuất văn bản đọc hết từ đây.
// Repository pattern trên localStorage: sau này chỉ cần thay load/save bằng Firestore/REST.

import type {
  DayWeeklyMenu,
  PortionCheckSummary,
  PortionRule,
  ShiftMealDetail,
  SupplierMenuDB,
  SupplierMenuEntry,
  SupplierShiftKey,
  UploadedMenuFile
} from './types';
import {
  DAY_NAMES,
  getDateOfDayInWeek,
  getWeekDaysInfo,
  formatDMY,
  formatISODate,
  parseDateSafe
} from './dateUtils';
import { evaluateMenuWeekly, detectDuplicateDishes } from './ruleEngine';

export const SUPPLIER_MENU_STORAGE_KEY = 'meals_supplier_menus_v12';

export const EMPTY_SHIFT_DETAIL: ShiftMealDetail = {
  meatDishes: [],
  meatDessert: '—',
  vegDishes: [],
  vegDessert: '—'
};

// ===================== Mapping tên ca =====================

const SHIFT_KEY_BY_NAME: Record<string, SupplierShiftKey> = {
  'Bữa sáng': 'sang',
  'Bữa trưa': 'trua',
  'Bữa tối': 'toi'
};

const SHIFT_NAME_BY_KEY: Record<SupplierShiftKey, string> = {
  sang: 'Bữa sáng',
  trua: 'Bữa trưa',
  toi: 'Bữa tối'
};

export function shiftKeyFromShiftName(name: string): SupplierShiftKey {
  return SHIFT_KEY_BY_NAME[name] || 'toi';
}

export function shiftKeyToShiftName(key: SupplierShiftKey): string {
  return SHIFT_NAME_BY_KEY[key];
}

export function shiftKeyFromDayKey(key: 'breakfast' | 'lunch' | 'dinner'): SupplierShiftKey {
  return key === 'breakfast' ? 'sang' : key === 'lunch' ? 'trua' : 'toi';
}

// ===================== Ngày =====================

export function dayIndexFromDate(weekStart: string, isoDate: string): number {
  const start = parseDateSafe(weekStart).getTime();
  const target = parseDateSafe(isoDate).getTime();
  if (Number.isNaN(start) || Number.isNaN(target)) return 0;
  return Math.max(0, Math.min(6, Math.round((target - start) / 86400000)));
}

// ===================== UI persistence =====================

export function loadStore(): SupplierMenuDB {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SUPPLIER_MENU_STORAGE_KEY) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as SupplierMenuDB : {};
  } catch {
    return {};
  }
}

export function saveStore(db: SupplierMenuDB) {
  try {
    localStorage.setItem(SUPPLIER_MENU_STORAGE_KEY, JSON.stringify(db));
  } catch {
    // localStorage đầy — bỏ qua, state vẫn giữ được trong phiên
  }
}

export function hasPersistedStore(): boolean {
  try {
    return Boolean(localStorage.getItem(SUPPLIER_MENU_STORAGE_KEY));
  } catch {
    return false;
  }
}

// ===================== Entry CRUD =====================

export function buildEntryId(vendorId: string, weekStart: string, dayIndex: number, shiftKey: SupplierShiftKey): string {
  return `${vendorId}__${weekStart}__${dayIndex}__${shiftKey}`;
}

export function getShiftEntry(
  db: SupplierMenuDB,
  vendorId: string,
  weekStart: string,
  dayIndex: number,
  shiftKey: SupplierShiftKey
): SupplierMenuEntry | null {
  return db[buildEntryId(vendorId, weekStart, dayIndex, shiftKey)] || null;
}

export function getShiftDetail(
  db: SupplierMenuDB,
  vendorId: string,
  weekStart: string,
  dayIndex: number,
  shiftKey: SupplierShiftKey
): ShiftMealDetail | null {
  const e = getShiftEntry(db, vendorId, weekStart, dayIndex, shiftKey);
  if (!e) return null;
  const hasData = e.detail.meatDishes.length > 0 || e.detail.vegDishes.length > 0;
  return hasData ? e.detail : null;
}

export function upsertShift(
  db: SupplierMenuDB,
  params: {
    vendorId: string;
    weekStart: string;
    dayIndex: number;
    shiftKey: SupplierShiftKey;
    detail: ShiftMealDetail;
    source: SupplierMenuEntry['source'];
    sourceFileId?: string;
  }
): SupplierMenuDB {
  const { vendorId, weekStart, dayIndex, shiftKey, detail, source, sourceFileId } = params;
  const id = buildEntryId(vendorId, weekStart, dayIndex, shiftKey);
  const prev = db[id];
  const next: SupplierMenuEntry = {
    ...(prev ? { portionCheck: prev.portionCheck } : {}),
    id,
    vendorId,
    weekStart,
    dayIndex,
    shiftKey,
    detail: JSON.parse(JSON.stringify(detail)),
    source,
    sourceFileId,
    updatedAt: Date.now()
  };
  return { ...db, [id]: next };
}

/**
 * Nhập nguyên 1 tuần (7 ngày × 3 ca) của 1 NCC vào CSDL — dùng cho wizard/excel/archive
 */
export function importWeeklyMenu(
  db: SupplierMenuDB,
  vendorId: string,
  weekStart: string,
  menu: DayWeeklyMenu[],
  source: SupplierMenuEntry['source'],
  sourceFileId?: string
): SupplierMenuDB {
  let next = db;
  menu.slice(0, 7).forEach((day, i) => {
    (['breakfast', 'lunch', 'dinner'] as const).forEach((dayKey, sIdx) => {
      const shiftKey: SupplierShiftKey = sIdx === 0 ? 'sang' : sIdx === 1 ? 'trua' : 'toi';
      const detail = day[dayKey];
      const hasData = detail && (detail.meatDishes.length > 0 || detail.vegDishes.length > 0);
      if (!hasData) return; // ca trống không ghi đè dữ liệu có sẵn
      next = upsertShift(next, {
        vendorId,
        weekStart,
        dayIndex: i,
        shiftKey,
        detail,
        source,
        sourceFileId
      });
    });
  });
  return next;
}

export function clearVendorWeek(db: SupplierMenuDB, vendorId: string, weekStart: string): SupplierMenuDB {
  const next: SupplierMenuDB = { ...db };
  Object.values(next).forEach(e => {
    if (e.vendorId === vendorId && e.weekStart === weekStart) delete next[e.id];
  });
  return next;
}

// ===================== Truy vấn dạng bảng =====================

/**
 * Xuất 1 tuần của NCC về DayWeeklyMenu[] (đủ 7 ngày, ca thiếu → rỗng)
 * để ăn thẳng vào evaluateMenuWeekly / WeeklyMenuTable
 */
export function getVendorWeekAsDayWeeklyMenu(db: SupplierMenuDB, vendorId: string, weekStart: string): DayWeeklyMenu[] {
  const daysInfo = getWeekDaysInfo(weekStart);
  return daysInfo.map((info, i) => {
    const pick = (key: SupplierShiftKey): ShiftMealDetail =>
      getShiftDetail(db, vendorId, weekStart, i, key) || { ...EMPTY_SHIFT_DETAIL };
    return {
      dayOfWeek: info.dayOfWeek,
      dateStr: info.dateStr,
      breakfast: pick('sang'),
      lunch: pick('trua'),
      dinner: pick('toi')
    };
  });
}

export function getShiftEntriesForWeek(db: SupplierMenuDB, weekStart: string): SupplierMenuEntry[] {
  return Object.values(db).filter(e => e.weekStart === weekStart);
}

export function getShiftEntriesForVendorWeek(db: SupplierMenuDB, vendorId: string, weekStart: string): SupplierMenuEntry[] {
  return Object.values(db).filter(e => e.vendorId === vendorId && e.weekStart === weekStart);
}

export function getVendorsWithMenuForWeek(db: SupplierMenuDB, weekStart: string): string[] {
  return Array.from(new Set(getShiftEntriesForWeek(db, weekStart).map(e => e.vendorId)));
}

export function getWeeksForVendor(db: SupplierMenuDB, vendorId: string): string[] {
  return Array.from(new Set(Object.values(db).filter(e => e.vendorId === vendorId).map(e => e.weekStart))).sort();
}

// ===================== Kiểm định định lượng theo NCC =====================

export interface VendorPortionCheckResult {
  vendorId: string;
  weekStart: string;
  sourceLabel: string;
  score: number;
  warnings: ReturnType<typeof evaluateMenuWeekly>['warnings'];
  duplicates: ReturnType<typeof detectDuplicateDishes>;
  summary: PortionCheckSummary;
  checkedAt: number;
  weekMenu: DayWeeklyMenu[];
}

/**
 * Kiểm tra định lượng (gram/ml) + món trùng cho 1 NCC trong 1 tuần,
 * và LƯU kết quả portionCheck vào các entry của tuần đó.
 */
export function portionCheckVendorWeek(
  db: SupplierMenuDB,
  opts: {
    vendorId: string;
    weekStart: string;
    rules: PortionRule[];
    archivesForVendor: UploadedMenuFile[];
    compareFileId?: string; // file làm mốc đối chiếu món trùng (nếu kiểm theo archive)
    sourceLabel: string;
  }
): { db: SupplierMenuDB; result: VendorPortionCheckResult } {
  const { vendorId, weekStart, rules } = opts;
  const weekMenu = getVendorWeekAsDayWeeklyMenu(db, vendorId, weekStart);
  const evalRes = evaluateMenuWeekly(weekMenu, rules);
  const duplicates = detectDuplicateDishes(
    weekMenu,
    opts.archivesForVendor,
    opts.compareFileId // kiểm theo tuần hiện tại: đối chiếu với mọi archive
  );

  const errors = evalRes.warnings.filter(w => w.severity === 'error').length;
  const summary: PortionCheckSummary = {
    checkedAt: Date.now(),
    ok: errors === 0,
    warningsCount: evalRes.warnings.length,
    duplicatesCount: duplicates.length
  };

  let next = db;
  for (const shiftKey of ['sang', 'trua', 'toi'] as const) {
    for (let d = 0; d < 7; d++) {
      const existing = getShiftEntry(next, vendorId, weekStart, d, shiftKey);
      if (existing) {
        next = { ...next, [existing.id]: { ...existing, portionCheck: summary, updatedAt: Date.now() } };
      }
    }
  }

  return {
    db: next,
    result: {
      vendorId,
      weekStart,
      sourceLabel: opts.sourceLabel,
      score: evalRes.score,
      warnings: evalRes.warnings,
      duplicates,
      summary,
      checkedAt: summary.checkedAt,
      weekMenu
    }
  };
}

// ===================== Migration từ key cũ (v11) =====================

export interface BootstrapSources {
  weekStart: string;
  defaultShiftName: 'Bữa sáng' | 'Bữa trưa' | 'Bữa tối';
  weeklyMenu: DayWeeklyMenu[];
  archives: UploadedMenuFile[];
  mealsByVendorId: Record<string, ShiftMealDetail>;
  vendors: Array<{ id: string; name?: string; ktx?: 'KTX1' | 'KTX2' }>;
}

/**
 * Bootstrap 1 lần: dựng CSDL từ dữ liệu cũ (ma trận weeklyMenu, archives, mealsByVendorId).
 * Chưa có key v12 mới gọi — giữ nguyên key cũ cho rollback.
 */
export function bootstrapSupplierMenuDB(sources: BootstrapSources): SupplierMenuDB {
  const { weekStart, defaultShiftName, weeklyMenu, archives, mealsByVendorId, vendors } = sources;
  let db: SupplierMenuDB = {};

  // 1. weeklyMenu ma trận tuần hiện tại → NCC 'tam-phuong' (menu gốc của hệ thống)
  if (weeklyMenu.length > 0) {
    db = importWeeklyMenu(db, 'tam-phuong', weekStart, weeklyMenu, 'archive');
  }

  // 2. Mọi archive (UploadedMenuFile) → NCC + tuần tương ứng
  archives.forEach(a => {
    if (!a.vendorId || !a.menu || a.menu.length === 0) return;
    const aWeekStart = a.startDate || weekStart;
    db = importWeeklyMenu(db, a.vendorId, aWeekStart, a.menu, 'archive', a.id);
  });

  // 3. mealsByVendorId (snapshot 1 ca của từng NCC) → seed ca mặc định của tuần hiện tại
  const shiftKey = shiftKeyFromShiftName(defaultShiftName);
  const dayIdx = 0;
  Object.entries(mealsByVendorId || {}).forEach(([vendorId, detail]) => {
    if (!vendors.some(v => v.id === vendorId)) return;
    if (!detail || (detail.meatDishes.length === 0 && detail.vegDishes.length === 0)) return;
    // Chỉ seed khi ô còn trống — dữ liệu đã ghi từ ma trận tuần/archive ở bước 1-2 giữ nguyên
    if (getShiftDetail(db, vendorId, weekStart, dayIdx, shiftKey)) return;
    db = upsertShift(db, {
      vendorId,
      weekStart,
      dayIndex: dayIdx,
      shiftKey,
      detail,
      source: 'archive'
    });
  });

  return db;
}

// ===================== Tiện ích hiển thị =====================

export function supplierHasDataInShift(detail: ShiftMealDetail | null): boolean {
  return Boolean(detail && (detail.meatDishes.length > 0 || detail.vegDishes.length > 0));
}

export function supplierMenuStats(db: SupplierMenuDB, vendorId: string, weekStart: string) {
  const entries = getShiftEntriesForVendorWeek(db, vendorId, weekStart);
  const lastCheck = entries
    .map(e => e.portionCheck)
    .filter((c): c is PortionCheckSummary => Boolean(c))
    .sort((a: PortionCheckSummary, b: PortionCheckSummary) => b.checkedAt - a.checkedAt)[0];
  return {
    entryCount: entries.length,
    weeks: getWeeksForVendor(db, vendorId).length,
    lastCheck: lastCheck || null,
    sources: Array.from(new Set(entries.map(e => e.source)))
  };
}

// Expose DAY_NAMES/formatISODate cho thành phần nào cần khung tuần
export { DAY_NAMES, formatISODate, formatDMY, getDateOfDayInWeek, parseDateSafe };
