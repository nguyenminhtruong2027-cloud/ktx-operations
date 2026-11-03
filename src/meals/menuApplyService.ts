// src/meals/menuApplyService.ts
// Áp dụng kết quả trích xuất vào weeklyMenu: 3 chế độ (Ghi đè / Bổ sung ô trống / Gộp),
// tính diff trước khi ghi, và quản lý giao dịch hoàn tác 30 phút (localStorage).

import {
  type ParseResult,
  type ParsedShiftData,
  type ParsedDishWithConfidence
} from './menuFileParser';
import { getWeekDaysInfo } from './dateUtils';
import { type DayWeeklyMenu, type ShiftMealDetail } from './types';

// ===================== Chế độ áp dụng =====================

export type ApplyMode = 'overwrite' | 'fill-empty' | 'merge';

export const APPLY_MODES: Array<{ id: ApplyMode; label: string; desc: string }> = [
  { id: 'overwrite', label: 'Ghi đè', desc: 'Thay toàn bộ thực đơn tuần bằng dữ liệu trích xuất.' },
  { id: 'fill-empty', label: 'Bổ sung ô trống', desc: 'Chỉ điền vào ô (món mặn/chay/tráng miệng) hiện đang trống.' },
  { id: 'merge', label: 'Gộp', desc: 'Giữ nguyên món hiện có, thêm món mới từ trích xuất (bỏ trùng lặp).' }
];

// ===================== Đưa dữ liệu trích xuất về dạng menu App =====================

function formatPortion(p: ParsedDishWithConfidence['portions'][number]): string {
  const range = p.max != null && p.min != null ? `${p.min}–${p.max}` : `${p.min ?? p.max ?? ''}`;
  const unit = p.unit === 'g' ? 'g' : p.unit === 'ml' ? 'ml' : p.unit === 'qua' ? ' quả' : ' cái';
  return `${range}${unit}`;
}

export function dishToMenuString(d: ParsedDishWithConfidence): string {
  if (!d.portions.length) return d.name;
  const parts = d.portions.map(p => `${p.item ? `${p.item} ` : ''}${formatPortion(p)}`);
  return `${d.name} (${parts.join(' · ')})`;
}

function shortDishName(menuStr: string): string {
  const idx = menuStr.indexOf(' (');
  return idx > 0 ? menuStr.slice(0, idx) : menuStr;
}

export function parsedShiftToDetail(s: ParsedShiftData): ShiftMealDetail {
  const meat = s.man.map(dishToMenuString);
  const veg = s.chay.map(dishToMenuString);
  const titleParts = meat.slice(0, 2).map(shortDishName);
  if (!titleParts.length) titleParts.push(...veg.slice(0, 2).map(shortDishName));

  return {
    title: titleParts.length ? titleParts.join(' & ') : 'Chưa có thực đơn',
    priceNote: '',
    meatDishes: meat,
    meatDessert: (s.trangMiengMan || '').trim() || '—',
    vegDishes: veg,
    vegDessert: (s.trangMiengChay || '').trim() || '—'
  };
}

/**
 * Chuyển 7 ParsedDayData thành DayWeeklyMenu[] (đóng khung ngày theo weekStart)
 */
export function parsedDaysToWeeklyMenu(days: ParseResult['days'], weekStartDate: string): DayWeeklyMenu[] {
  const daysInfo = getWeekDaysInfo(weekStartDate);
  return days.map((d, i) => ({
    dayOfWeek: daysInfo[i]?.dayOfWeek || d.dayOfWeek,
    dateStr: daysInfo[i]?.dateStr || d.dateStr,
    breakfast: parsedShiftToDetail(d.shifts.breakfast),
    lunch: parsedShiftToDetail(d.shifts.lunch),
    dinner: parsedShiftToDetail(d.shifts.dinner)
  }));
}

// ===================== Áp dụng theo chế độ =====================

function shiftEquals(a: ShiftMealDetail, b: ShiftMealDetail): boolean {
  return JSON.stringify(a.meatDishes) === JSON.stringify(b.meatDishes)
    && JSON.stringify(a.vegDishes) === JSON.stringify(b.vegDishes)
    && a.meatDessert === b.meatDessert
    && a.vegDessert === b.vegDessert;
}

function mergeShift(current: ShiftMealDetail, incoming: ShiftMealDetail, mode: ApplyMode): ShiftMealDetail {
  if (mode === 'overwrite') return incoming;

  if (mode === 'fill-empty') {
    return {
      ...current,
      meatDishes: current.meatDishes.length ? current.meatDishes : incoming.meatDishes,
      vegDishes: current.vegDishes.length ? current.vegDishes : incoming.vegDishes,
      meatDessert: current.meatDessert && current.meatDessert !== '—' ? current.meatDessert : incoming.meatDessert,
      vegDessert: current.vegDessert && current.vegDessert !== '—' ? current.vegDessert : incoming.vegDessert,
      title: incoming.title || current.title,
      priceNote: current.priceNote || incoming.priceNote
    };
  }

  // merge: gộp món, bỏ trùng lặp tên món (bỏ định lượng khi so trùng)
  const norm = (list: string[], seed: string[]) => {
    const seen = new Set(seed.map(s => shortDishName(s).toLowerCase()));
    return [...seed, ...list.filter(s => !seen.has(shortDishName(s).toLowerCase()))];
  };

  const meatBase = current.meatDishes.length ? current.meatDishes : incoming.meatDishes;
  const vegBase = current.vegDishes.length ? current.vegDishes : incoming.vegDishes;

  return {
    ...current,
    meatDishes: meatBase.length ? norm(incoming.meatDishes, meatBase) : incoming.meatDishes,
    vegDishes: vegBase.length ? norm(incoming.vegDishes, vegBase) : incoming.vegDishes,
    meatDessert: current.meatDessert && current.meatDessert !== '—' ? current.meatDessert : incoming.meatDessert,
    vegDessert: current.vegDessert && current.vegDessert !== '—' ? current.vegDessert : incoming.vegDessert,
    title: current.title || incoming.title,
    priceNote: current.priceNote || incoming.priceNote
  };
}

export function applyParsedToMenu(current: DayWeeklyMenu[], incoming: DayWeeklyMenu[], mode: ApplyMode): DayWeeklyMenu[] {
  return current.map((day, i) => {
    const inc = incoming[i] || day;
    return {
      ...day,
      breakfast: shiftEquals(day.breakfast, inc.breakfast) ? day.breakfast : mergeShift(day.breakfast, inc.breakfast, mode),
      lunch: shiftEquals(day.lunch, inc.lunch) ? day.lunch : mergeShift(day.lunch, inc.lunch, mode),
      dinner: shiftEquals(day.dinner, inc.dinner) ? day.dinner : mergeShift(day.dinner, inc.dinner, mode)
    };
  });
}

// ===================== Diff =====================

export interface MenuDiffRow {
  dayOfWeek: string;
  dateStr: string;
  shift: string;
  removals: string[];
  additions: string[];
}

export interface MenuDiff {
  addedCount: number;
  removedCount: number;
  changedShifts: number;
  rows: MenuDiffRow[];
}

const SHIFT_FIELDS = [['Bữa sáng', 'breakfast'], ['Bữa trưa', 'lunch'], ['Bữa tối', 'dinner']] as const;

export function computeMenuDiff(current: DayWeeklyMenu[], proposed: DayWeeklyMenu[]): MenuDiff {
  const rows: MenuDiffRow[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let changedShifts = 0;

  proposed.forEach(day => {
    const currentDay = current.find(c => c.dayOfWeek === day.dayOfWeek) || current[proposed.indexOf(day)];
    if (!currentDay) return;

    for (const [shiftLabel, key] of SHIFT_FIELDS) {
      const cur = currentDay[key];
      const nx = day[key];

      const compare = (curList: string[], nxList: string[]) => {
        const curSet = new Map(curList.map(s => [shortDishName(s).toLowerCase(), s]));
        const nxSet = new Map(nxList.map(s => [shortDishName(s).toLowerCase(), s]));
        const removals = [...curSet.entries()].filter(([k]) => !nxSet.has(k)).map(([, v]) => v);
        const additions = [...nxSet.entries()].filter(([k]) => !curSet.has(k)).map(([, v]) => v);
        return { removals, additions };
      };

      const meat = compare(cur.meatDishes, nx.meatDishes);
      const veg = compare(cur.vegDishes, nx.vegDishes);
      const dessertChanges =
        cur.meatDessert !== nx.meatDessert || cur.vegDessert !== nx.vegDessert
          ? [
              `MT: ${cur.meatDessert || '(trống)'} → ${nx.meatDessert || '(trống)'}`,
              `CT: ${cur.vegDessert || '(trống)'} → ${nx.vegDessert || '(trống)'}`
            ]
          : [];

      const allRemovals = [...meat.removals, ...veg.removals];
      const allAdditions = [...meat.additions, ...veg.additions, ...dessertChanges];
      if (!allRemovals.length && !allAdditions.length) continue;

      changedShifts++;
      addedCount += allAdditions.length;
      removedCount += allRemovals.length;
      rows.push({
        dayOfWeek: day.dayOfWeek,
        dateStr: day.dateStr,
        shift: shiftLabel,
        removals: allRemovals,
        additions: allAdditions
      });
    }
  });

  return { addedCount, removedCount, changedShifts, rows };
}

// ===================== Giao dịch hoàn tác 30 phút =====================

const UNDO_KEY = 'meals_menu_undo_v1';
export const UNDO_WINDOW_MS = 30 * 60 * 1000; // 30 phút

export interface UndoSnapshot {
  id: string;
  savedAt: number;
  expiresAt: number;
  menu: DayWeeklyMenu[];
}

function readUndoStorage(): UndoSnapshot | null {
  try {
    const item = typeof localStorage !== 'undefined' ? localStorage.getItem(UNDO_KEY) : null;
    if (!item) return null;
    const snap = JSON.parse(item) as UndoSnapshot;
    if (!snap || !snap.menu) return null;
    return snap;
  } catch {
    return null;
  }
}

function writeUndoStorage(snap: UndoSnapshot | null) {
  try {
    if (!snap) localStorage.removeItem(UNDO_KEY);
    else localStorage.setItem(UNDO_KEY, JSON.stringify(snap));
  } catch {
    // localStorage đầy / không khả dụng
  }
}

export function saveUndoSnapshot(menu: DayWeeklyMenu[]): UndoSnapshot {
  const now = Date.now();
  const snap: UndoSnapshot = {
    id: `undo-${now}-${Math.floor(Math.random() * 1e6)}`,
    savedAt: now,
    expiresAt: now + UNDO_WINDOW_MS,
    menu: JSON.parse(JSON.stringify(menu))
  };
  writeUndoStorage(snap);
  return snap;
}

export function peekUndoSnapshot(): UndoSnapshot | null {
  const snap = readUndoStorage();
  if (!snap) return null;
  if (snap.expiresAt <= Date.now()) {
    writeUndoStorage(null);
    return null;
  }
  return snap;
}

export function popUndoSnapshot(): UndoSnapshot | null {
  const snap = peekUndoSnapshot();
  if (snap) writeUndoStorage(null);
  return snap;
}

export function discardUndoSnapshot() {
  writeUndoStorage(null);
}
