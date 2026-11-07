import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Copy,
  Check,
  CheckCircle2,
  Lock,
  Unlock,
  Building2,
  Utensils,
  Plus,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { MealCountEntry, NccInfo, ShiftType, WeeklyMenu } from '../types';

interface StatisticsWorkspaceTabProps {
  nccList: NccInfo[];
  menus: WeeklyMenu[];
  unitPrice: number;
  columnLabels: string[];
  mealCounts: Record<string, MealCountEntry>;
  onUpdateMealCount: (key: string, entry: MealCountEntry) => void;
  onNavigateToReport?: () => void;
}

type StatViewPeriod = 'workspace' | 'by_shift' | 'by_day' | 'by_week' | 'by_variance' | 'by_month';

interface LockedSessionInfo {
  lockedAt: string;
  lockedBy: string;
  totalMeals: number;
}

const STORAGE_KEY_LOCKED = 'meals_v2_locked_sessions';
const STORAGE_KEY_PRICES = 'meals_v2_session_prices';

const DEFAULT_SHIFT_PRICES: Record<ShiftType, number> = {
  sang: 25000,
  trua: 40000,
  toi: 40000,
};

const SHIFT_LABELS: Record<ShiftType, string> = {
  sang: 'Bữa Sáng (05:35 - 06:30)',
  trua: 'Bữa Trưa (10:00 - 12:00)',
  toi: 'Bữa Tối (17:00 - 18:30)',
};

const SHIFT_SHORT: Record<ShiftType, string> = {
  sang: 'Sáng',
  trua: 'Trưa',
  toi: 'Tối',
};

function formatCurrency(val: number): string {
  return val.toLocaleString('vi-VN') + ' đ';
}

function getTodayDMY(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function dmyToIso(dmy: string): string {
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function isoToDmy(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export default function StatisticsWorkspaceTab({
  nccList,
  menus,
  unitPrice,
  columnLabels,
  mealCounts,
  onUpdateMealCount,
  onNavigateToReport,
}: StatisticsWorkspaceTabProps) {
  const [period, setPeriod] = useState<StatViewPeriod>('workspace');
  const [selectedDateDMY, setSelectedDateDMY] = useState<string>(getTodayDMY);
  const [selectedShift, setSelectedShift] = useState<ShiftType>('trua');
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11');
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  // Dynamic unit prices per session/shift: key is `${dateDMY}|${shift}`
  const [sessionPrices, setSessionPrices] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PRICES);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PRICES, JSON.stringify(sessionPrices));
    } catch {
      // ignore
    }
  }, [sessionPrices]);

  // Locked sessions map: key is `${dateDMY}|${shift}`
  const [lockedSessions, setLockedSessions] = useState<Record<string, LockedSessionInfo>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_LOCKED);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {
      '09/11/2026|sang': { lockedAt: '09/11/2026 06:45', lockedBy: 'Quản lý vận hành', totalMeals: 280 },
      '09/11/2026|trua': { lockedAt: '09/11/2026 12:15', lockedBy: 'Quản lý vận hành', totalMeals: 720 },
      '09/11/2026|toi': { lockedAt: '09/11/2026 18:40', lockedBy: 'Quản lý vận hành', totalMeals: 430 },
      '10/11/2026|trua': { lockedAt: '10/11/2026 12:20', lockedBy: 'Quản lý vận hành', totalMeals: 710 },
      '11/11/2026|trua': { lockedAt: '11/11/2026 12:10', lockedBy: 'Quản lý vận hành', totalMeals: 735 },
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_LOCKED, JSON.stringify(lockedSessions));
    } catch {
      // ignore
    }
  }, [lockedSessions]);

  // Seed sample meal counts if completely empty so variance and charts show beautifully
  useEffect(() => {
    if (Object.keys(mealCounts).length === 0) {
      const sampleSeed: Record<string, MealCountEntry> = {
        '09/11/2026|sang|TP': { 'TĐ 8': 60, 'TĐ 11.1': 50, 'TĐ 11.3': 40, 'ME': 20 },
        '09/11/2026|sang|LD': { 'TĐ 8': 40, 'TĐ 11.1': 30, 'TĐ 11.3': 20, 'ME': 20 },
        '09/11/2026|trua|TP': { 'TĐ 8': 130, 'TĐ 11.1': 110, 'TĐ 11.3': 90, 'ME': 40 },
        '09/11/2026|trua|LD': { 'TĐ 8': 100, 'TĐ 11.1': 90, 'TĐ 11.3': 80, 'ME': 30 },
        '09/11/2026|trua|VS': { 'TĐ 8': 20, 'TĐ 11.1': 15, 'TĐ 11.3': 10, 'ME': 5 },
        '09/11/2026|toi|TP': { 'TĐ 8': 80, 'TĐ 11.1': 70, 'TĐ 11.3': 50, 'ME': 30 },
        '09/11/2026|toi|LD': { 'TĐ 8': 70, 'TĐ 11.1': 60, 'TĐ 11.3': 40, 'ME': 30 },

        '10/11/2026|sang|TP': { 'TĐ 8': 65, 'TĐ 11.1': 55, 'TĐ 11.3': 40, 'ME': 25 },
        '10/11/2026|sang|LD': { 'TĐ 8': 45, 'TĐ 11.1': 35, 'TĐ 11.3': 20, 'ME': 15 },
        '10/11/2026|trua|TP': { 'TĐ 8': 125, 'TĐ 11.1': 115, 'TĐ 11.3': 95, 'ME': 35 },
        '10/11/2026|trua|LD': { 'TĐ 8': 105, 'TĐ 11.1': 95, 'TĐ 11.3': 85, 'ME': 30 },
        '10/11/2026|toi|TP': { 'TĐ 8': 85, 'TĐ 11.1': 75, 'TĐ 11.3': 50, 'ME': 30 },
        '10/11/2026|toi|LD': { 'TĐ 8': 70, 'TĐ 11.1': 60, 'TĐ 11.3': 45, 'ME': 25 },

        '11/11/2026|sang|TP': { 'TĐ 8': 70, 'TĐ 11.1': 60, 'TĐ 11.3': 45, 'ME': 25 },
        '11/11/2026|sang|LD': { 'TĐ 8': 40, 'TĐ 11.1': 30, 'TĐ 11.3': 25, 'ME': 20 },
        '11/11/2026|trua|TP': { 'TĐ 8': 135, 'TĐ 11.1': 120, 'TĐ 11.3': 90, 'ME': 40 },
        '11/11/2026|trua|LD': { 'TĐ 8': 110, 'TĐ 11.1': 100, 'TĐ 11.3': 80, 'ME': 30 },
        '11/11/2026|toi|TP': { 'TĐ 8': 90, 'TĐ 11.1': 80, 'TĐ 11.3': 55, 'ME': 35 },
        '11/11/2026|toi|LD': { 'TĐ 8': 75, 'TĐ 11.1': 65, 'TĐ 11.3': 40, 'ME': 25 },
      };
      Object.entries(sampleSeed).forEach(([k, v]) => {
        onUpdateMealCount(k, v);
      });
    }
  }, [mealCounts, onUpdateMealCount]);

  // Unit price helper for any session (dynamic, not hardcoded)
  const getSessionPrice = (dateDMY: string, shift: ShiftType): number => {
    const key = `${dateDMY}|${shift}`;
    if (sessionPrices[key] && sessionPrices[key] > 0) return sessionPrices[key];
    return DEFAULT_SHIFT_PRICES[shift] || unitPrice || 40000;
  };

  const handleUpdateCurrentSessionPrice = (newPrice: number) => {
    const key = `${selectedDateDMY}|${selectedShift}`;
    setSessionPrices(prev => ({ ...prev, [key]: Math.max(0, newPrice) }));
  };

  // Current session lock state
  const currentSessionKey = `${selectedDateDMY}|${selectedShift}`;
  const currentLockInfo = lockedSessions[currentSessionKey] || null;
  const currentSessionPrice = getSessionPrice(selectedDateDMY, selectedShift);

  const handleToggleLockCurrentSession = () => {
    const isLocked = Boolean(currentLockInfo);
    if (isLocked) {
      setLockedSessions(prev => {
        const next = { ...prev };
        delete next[currentSessionKey];
        return next;
      });
    } else {
      const nowStr = new Date().toLocaleString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const total = calculateSessionTotal(selectedDateDMY, selectedShift);
      setLockedSessions(prev => ({
        ...prev,
        [currentSessionKey]: {
          lockedAt: nowStr,
          lockedBy: 'Quản lý vận hành',
          totalMeals: total,
        }
      }));
    }
  };

  // Helper to read meal count for a specific NCC & Col
  const getColVal = (entry: MealCountEntry, col: string): number => {
    return typeof entry[col] === 'number' ? entry[col] : 0;
  };

  const getEntry = (dateDMY: string, shift: ShiftType, nccCode: string): MealCountEntry => {
    return mealCounts[`${dateDMY}|${shift}|${nccCode}`] || {};
  };

  const getNccSessionTotal = (dateDMY: string, shift: ShiftType, nccCode: string): number => {
    const entry = getEntry(dateDMY, shift, nccCode);
    return columnLabels.reduce((sum, col) => sum + getColVal(entry, col), 0);
  };

  const calculateSessionTotal = (dateDMY: string, shift: ShiftType): number => {
    return nccList.reduce((sum, ncc) => sum + getNccSessionTotal(dateDMY, shift, ncc.code), 0);
  };

  const calculateDayTotal = (dateDMY: string): number => {
    const shifts: ShiftType[] = ['sang', 'trua', 'toi'];
    return shifts.reduce((sum, sh) => sum + calculateSessionTotal(dateDMY, sh), 0);
  };

  const calculateDayCost = (dateDMY: string): number => {
    const shifts: ShiftType[] = ['sang', 'trua', 'toi'];
    return shifts.reduce((sum, sh) => {
      const count = calculateSessionTotal(dateDMY, sh);
      return sum + count * getSessionPrice(dateDMY, sh);
    }, 0);
  };

  // Stepper update for workspace
  const handleUpdateVal = (nccCode: string, col: string, delta: number) => {
    const key = `${selectedDateDMY}|${selectedShift}|${nccCode}`;
    const curr = { ...(mealCounts[key] || {}) };
    const oldVal = getColVal(curr, col);
    curr[col] = Math.max(0, oldVal + delta);
    onUpdateMealCount(key, curr);
  };

  const handleDirectChange = (nccCode: string, col: string, valStr: string) => {
    const key = `${selectedDateDMY}|${selectedShift}|${nccCode}`;
    const curr = { ...(mealCounts[key] || {}) };
    const num = Math.max(0, parseInt(valStr, 10) || 0);
    curr[col] = num;
    onUpdateMealCount(key, curr);
  };

  const handleQuickFill = (val: number) => {
    nccList.forEach(ncc => {
      const key = `${selectedDateDMY}|${selectedShift}|${ncc.code}`;
      const next: MealCountEntry = { ...(mealCounts[key] || {}) };
      columnLabels.forEach(col => {
        next[col] = val;
      });
      onUpdateMealCount(key, next);
    });
  };

  // Copy Zalo summary of current session
  const handleCopySessionZalo = () => {
    const sessionTotal = calculateSessionTotal(selectedDateDMY, selectedShift);
    const sessionCost = sessionTotal * currentSessionPrice;
    const lines: string[] = [
      `🍱 BÁO CÁO SUẤT ĂN - LÁN TRẠI HÓC MÔN (VINCONS)`,
      `• Ngày: ${selectedDateDMY} • ${SHIFT_LABELS[selectedShift]}`,
      `• Tổng số suất ăn: ${sessionTotal} suất`,
      `• Đơn giá buổi: ${currentSessionPrice.toLocaleString('vi-VN')} đ/suất`,
      `• Tổng thành tiền: ${formatCurrency(sessionCost)}`,
      `• Trạng thái: ${currentLockInfo ? `ĐÃ CHỐT SỐ LIỆU (${currentLockInfo.lockedAt})` : 'Chờ xác nhận'}`,
      ``,
      `Chi tiết theo Nhà cung cấp:`
    ];

    nccList.forEach(ncc => {
      const total = getNccSessionTotal(selectedDateDMY, selectedShift, ncc.code);
      if (total > 0) {
        const entry = getEntry(selectedDateDMY, selectedShift, ncc.code);
        const colDetails = columnLabels.map(col => `${col}: ${getColVal(entry, col)}`).join(' | ');
        lines.push(`  + NCC ${ncc.code} (${ncc.name}): ${total} suất [${colDetails}]`);
      }
    });

    lines.push(``);
    lines.push(`Trân trọng gửi Ban chỉ huy & Quản lý vận hành.`);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedToast('Đã sao chép báo cáo suất ăn vào bộ nhớ tạm!');
    setTimeout(() => setCopiedToast(null), 3000);
  };

  // Extract all distinct dates in mealCounts, sorted chronologically ascending
  const allRecordedDatesAsc = useMemo(() => {
    const set = new Set<string>();
    Object.keys(mealCounts).forEach(k => {
      const parts = k.split('|');
      if (parts[0]) set.add(parts[0]);
    });
    set.add('09/11/2026');
    set.add('10/11/2026');
    set.add('11/11/2026');
    set.add(selectedDateDMY);

    return Array.from(set).sort((a, b) => {
      const [d1, m1, y1] = a.split('/').map(Number);
      const [d2, m2, y2] = b.split('/').map(Number);
      return new Date(y1, m1 - 1, d1).getTime() - new Date(y2, m2 - 1, d2).getTime();
    });
  }, [mealCounts, selectedDateDMY]);

  // Overall KPI across entire dataset
  const overallMetrics = useMemo(() => {
    let totalMeals = 0;
    let totalCost = 0;
    const nccTotalMap: Record<string, number> = {};

    allRecordedDatesAsc.forEach(d => {
      (['sang', 'trua', 'toi'] as ShiftType[]).forEach(sh => {
        const count = calculateSessionTotal(d, sh);
        totalMeals += count;
        totalCost += count * getSessionPrice(d, sh);

        nccList.forEach(ncc => {
          nccTotalMap[ncc.code] = (nccTotalMap[ncc.code] || 0) + getNccSessionTotal(d, sh, ncc.code);
        });
      });
    });

    const lockedCount = Object.keys(lockedSessions).length;
    const avgPerDay = allRecordedDatesAsc.length > 0 ? Math.round(totalMeals / allRecordedDatesAsc.length) : 0;

    return { totalMeals, totalCost, lockedCount, avgPerDay, nccTotalMap };
  }, [allRecordedDatesAsc, mealCounts, lockedSessions, nccList, sessionPrices]);

  // Day-over-day Variance (Chênh lệch so với ngày hôm trước)
  const dailyVarianceList = useMemo(() => {
    return allRecordedDatesAsc.map((dStr, idx) => {
      const total = calculateDayTotal(dStr);
      const cost = calculateDayCost(dStr);
      const s = calculateSessionTotal(dStr, 'sang');
      const t = calculateSessionTotal(dStr, 'trua');
      const to = calculateSessionTotal(dStr, 'toi');

      let delta = 0;
      let pct = 0;
      if (idx > 0) {
        const prevTotal = calculateDayTotal(allRecordedDatesAsc[idx - 1]);
        delta = total - prevTotal;
        pct = prevTotal > 0 ? Math.round((delta / prevTotal) * 100) : 0;
      }

      const isLocked = Boolean(
        lockedSessions[`${dStr}|sang`] ||
        lockedSessions[`${dStr}|trua`] ||
        lockedSessions[`${dStr}|toi`]
      );

      return {
        dateStr: dStr,
        total,
        cost,
        sang: s,
        trua: t,
        toi: to,
        delta,
        pct,
        isLocked,
      };
    });
  }, [allRecordedDatesAsc, mealCounts, lockedSessions, sessionPrices]);

  // Recent day variance summary for top card
  const todayVariance = useMemo(() => {
    const idx = allRecordedDatesAsc.indexOf(selectedDateDMY);
    if (idx > 0) {
      const curr = calculateDayTotal(selectedDateDMY);
      const prev = calculateDayTotal(allRecordedDatesAsc[idx - 1]);
      const diff = curr - prev;
      const pct = prev > 0 ? Math.round((diff / prev) * 100) : 0;
      return { diff, pct, prevDate: allRecordedDatesAsc[idx - 1] };
    }
    return { diff: 0, pct: 0, prevDate: '' };
  }, [allRecordedDatesAsc, selectedDateDMY, mealCounts]);

  // Weekly Days
  const weeklyDays = useMemo(() => {
    return [
      { code: 'T2', date: '09/11/2026', label: 'Thứ 2 (09/11)' },
      { code: 'T3', date: '10/11/2026', label: 'Thứ 3 (10/11)' },
      { code: 'T4', date: '11/11/2026', label: 'Thứ 4 (11/11)' },
      { code: 'T5', date: '12/11/2026', label: 'Thứ 5 (12/11)' },
      { code: 'T6', date: '13/11/2026', label: 'Thứ 6 (13/11)' },
      { code: 'T7', date: '14/11/2026', label: 'Thứ 7 (14/11)' },
      { code: 'CN', date: '15/11/2026', label: 'Chủ nhật (15/11)' },
    ].map(item => {
      const sang = calculateSessionTotal(item.date, 'sang');
      const trua = calculateSessionTotal(item.date, 'trua');
      const toi = calculateSessionTotal(item.date, 'toi');
      const total = sang + trua + toi;
      const cost = calculateDayCost(item.date);
      const isLocked = Boolean(
        lockedSessions[`${item.date}|sang`] ||
        lockedSessions[`${item.date}|trua`] ||
        lockedSessions[`${item.date}|toi`]
      );
      return { ...item, sang, trua, toi, total, cost, isLocked };
    });
  }, [mealCounts, lockedSessions, sessionPrices]);

  const maxWeeklyDayMeals = useMemo(() => {
    return Math.max(...weeklyDays.map(d => d.total), 100);
  }, [weeklyDays]);

  // Monthly Supplier Summary (NO rigid KTX zone)
  const monthlySupplierStats = useMemo(() => {
    const totalMonthMeals = Object.values(overallMetrics.nccTotalMap).reduce((a, b) => a + b, 0) || 1;
    return nccList.map(ncc => {
      const count = overallMetrics.nccTotalMap[ncc.code] || 0;
      const cost = count * unitPrice; // reference cost
      const pct = Math.round((count / totalMonthMeals) * 100);
      return {
        ...ncc,
        count,
        cost,
        pct,
      };
    }).sort((a, b) => b.count - a.count);
  }, [nccList, overallMetrics, unitPrice]);

  return (
    <div className="space-y-6">
      {/* Top Header & Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#141e42] text-orange-400 flex items-center justify-center shadow-sm">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Không gian làm việc & Thống kê số liệu suất ăn
              </h2>
              <p className="text-xs text-slate-500">
                Ghi nhận số tổng • Theo dõi sự thay đổi & chênh lệch qua từng buổi, ngày, tuần, tháng
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopySessionZalo}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#141e42] hover:bg-blue-900 text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
            >
              <Copy className="w-3.5 h-3.5 text-orange-400" />
              <span>Sao chép Zalo buổi này</span>
            </button>

            {onNavigateToReport && (
              <button
                type="button"
                onClick={onNavigateToReport}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs"
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>Mở tab Báo cáo Zalo</span>
              </button>
            )}
          </div>
        </div>

        {/* View Mode Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
          {[
            { id: 'workspace' as const, label: 'Nhập & Cập nhật số suất', icon: Utensils },
            { id: 'by_shift' as const, label: 'Theo Buổi (Ca ăn)', icon: Clock },
            { id: 'by_day' as const, label: 'Theo Ngày & Chênh lệch', icon: Calendar },
            { id: 'by_week' as const, label: 'Theo Tuần', icon: TrendingUp },
            { id: 'by_variance' as const, label: 'Biến động & Chênh lệch NCC', icon: Scale },
            { id: 'by_month' as const, label: 'Tổng hợp Tháng theo NCC', icon: DollarSign },
          ].map(tab => {
            const Icon = tab.icon;
            const active = period === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition ${
                  active
                    ? 'bg-[#141e42] text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-orange-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {copiedToast && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{copiedToast}</span>
          </div>
        )}
      </div>

      {/* Top 4 KPI Metric Cards: Focusing on Totals & Variances */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Meals */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Tổng số suất đã ghi nhận</span>
            <Utensils className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-extrabold text-[#141e42]">
            {overallMetrics.totalMeals.toLocaleString('vi-VN')}
            <span className="text-xs font-normal text-slate-400 ml-1">suất</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Tổng {allRecordedDatesAsc.length} ngày phục vụ
          </div>
        </div>

        {/* Card 2: Day-over-Day Variance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Biến động ngày ({selectedDateDMY})</span>
            {todayVariance.diff >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-600" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-600" />
            )}
          </div>
          <div className={`text-2xl font-extrabold flex items-center gap-1 ${
            todayVariance.diff > 0 ? 'text-emerald-600' : todayVariance.diff < 0 ? 'text-rose-600' : 'text-slate-700'
          }`}>
            <span>{todayVariance.diff > 0 ? `+${todayVariance.diff}` : todayVariance.diff}</span>
            <span className="text-xs font-bold ml-1">
              ({todayVariance.diff > 0 ? `+${todayVariance.pct}%` : `${todayVariance.pct}%`})
            </span>
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {todayVariance.prevDate ? `So với ngày ${todayVariance.prevDate}` : 'Ngày bắt đầu theo dõi'}
          </div>
        </div>

        {/* Card 3: Shift Variance (Trưa vs Tối) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Chênh lệch Trưa vs Tối</span>
            <Scale className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-blue-900">
            {calculateSessionTotal(selectedDateDMY, 'trua') - calculateSessionTotal(selectedDateDMY, 'toi') > 0 ? '+' : ''}
            {calculateSessionTotal(selectedDateDMY, 'trua') - calculateSessionTotal(selectedDateDMY, 'toi')}
            <span className="text-xs font-normal text-slate-400 ml-1">suất</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Trưa: <strong>{calculateSessionTotal(selectedDateDMY, 'trua')}</strong> • Tối: <strong>{calculateSessionTotal(selectedDateDMY, 'toi')}</strong>
          </div>
        </div>

        {/* Card 4: Locked Sessions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Buổi đã chốt đối soát</span>
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-amber-600">
            {overallMetrics.lockedCount}
            <span className="text-xs font-normal text-slate-400 ml-1">buổi</span>
          </div>
          <div className="text-[11px] text-slate-500">
            Số liệu đã xác nhận không đổi
          </div>
        </div>
      </div>

      {/* VIEW 1: DAILY WORKSPACE (FAST ENTRY, FLEXIBLE UNIT PRICE & LOCK) */}
      {period === 'workspace' && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
          {/* Header toolbar */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Ngày phục vụ
                </label>
                <input
                  type="date"
                  value={dmyToIso(selectedDateDMY)}
                  onChange={e => e.target.value && setSelectedDateDMY(isoToDmy(e.target.value))}
                  className="min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                />
              </div>

              {/* Shift Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Buổi / Ca ăn
                </label>
                <div className="flex items-center bg-white border border-slate-300 rounded-xl p-0.5">
                  {(['sang', 'trua', 'toi'] as ShiftType[]).map(sh => (
                    <button
                      key={sh}
                      type="button"
                      onClick={() => setSelectedShift(sh)}
                      className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition ${
                        selectedShift === sh
                          ? 'bg-[#141e42] text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {SHIFT_SHORT[sh]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Unit Price for This Session */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Đơn giá buổi này (đ/suất)
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    step={1000}
                    min={0}
                    value={currentSessionPrice}
                    onChange={e => handleUpdateCurrentSessionPrice(Number(e.target.value) || 0)}
                    className="w-28 min-h-[38px] px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-emerald-700 text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-500">đ</span>
                </div>
              </div>

              {/* Quick Fill Buttons */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  Điền nhanh ô
                </label>
                <div className="flex items-center gap-1">
                  {[50, 100, 150, 200].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleQuickFill(n)}
                      className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700"
                    >
                      ={n}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => handleQuickFill(0)}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-xs font-bold text-rose-700"
                  >
                    Đặt 0
                  </button>
                </div>
              </div>
            </div>

            {/* Lock / Confirm Session Toggle */}
            <div className="flex items-center gap-2">
              {currentLockInfo ? (
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-300">
                      <Lock className="w-3.5 h-3.5" />
                      ĐÃ CHỐT SỐ LIỆU
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {currentLockInfo.lockedAt} • {currentLockInfo.totalMeals} suất
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleLockCurrentSession}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
                    title="Mở khoá để chỉnh sửa số liệu"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Mở khoá</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleToggleLockCurrentSession}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Chốt số liệu buổi này</span>
                </button>
              )}
            </div>
          </div>

          {/* Matrix Input Table (NO rigid KTX zone) */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#141e42] text-white">
                <tr>
                  <th className="p-3 font-semibold">Nhà cung cấp</th>
                  {columnLabels.map(col => (
                    <th key={col} className="p-3 text-center font-semibold">
                      {col}
                    </th>
                  ))}
                  <th className="p-3 text-center font-bold">Tổng suất</th>
                  <th className="p-3 text-right font-bold">Thành tiền ({formatCurrency(currentSessionPrice)})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {nccList.map(ncc => {
                  const entry = getEntry(selectedDateDMY, selectedShift, ncc.code);
                  const nccTotal = getNccSessionTotal(selectedDateDMY, selectedShift, ncc.code);
                  const nccCost = nccTotal * currentSessionPrice;

                  return (
                    <tr key={ncc.code} className="hover:bg-slate-50/70 transition">
                      <td className="p-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-mono font-bold text-xs">
                            {ncc.code}
                          </span>
                          <span className="font-bold">{ncc.name}</span>
                        </div>
                      </td>

                      {columnLabels.map(col => {
                        const val = getColVal(entry, col);
                        return (
                          <td key={col} className="p-2 text-center">
                            <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white shadow-2xs overflow-hidden">
                              <button
                                type="button"
                                disabled={Boolean(currentLockInfo)}
                                onClick={() => handleUpdateVal(ncc.code, col, -5)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-500 disabled:opacity-40"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <input
                                type="number"
                                min={0}
                                disabled={Boolean(currentLockInfo)}
                                value={val}
                                onChange={e => handleDirectChange(ncc.code, col, e.target.value)}
                                className="w-14 text-center font-bold text-slate-900 text-xs py-1.5 focus:outline-none disabled:bg-slate-50"
                              />
                              <button
                                type="button"
                                disabled={Boolean(currentLockInfo)}
                                onClick={() => handleUpdateVal(ncc.code, col, 5)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-slate-100 text-slate-500 disabled:opacity-40"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        );
                      })}

                      <td className="p-3 text-center font-extrabold text-base text-[#141e42]">
                        {nccTotal}
                      </td>

                      <td className="p-3 text-right font-bold text-slate-800">
                        {formatCurrency(nccCost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                <tr>
                  <td className="p-3 uppercase">Tổng cộng ({SHIFT_SHORT[selectedShift]})</td>
                  {columnLabels.map(col => {
                    const colTotal = nccList.reduce((sum, ncc) => {
                      const entry = getEntry(selectedDateDMY, selectedShift, ncc.code);
                      return sum + getColVal(entry, col);
                    }, 0);
                    return (
                      <td key={col} className="p-3 text-center text-sm font-extrabold text-[#141e42]">
                        {colTotal}
                      </td>
                    );
                  })}
                  <td className="p-3 text-center text-lg font-extrabold text-orange-600">
                    {calculateSessionTotal(selectedDateDMY, selectedShift)}
                  </td>
                  <td className="p-3 text-right text-sm font-extrabold text-emerald-700">
                    {formatCurrency(calculateSessionTotal(selectedDateDMY, selectedShift) * currentSessionPrice)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* VIEW 2: BY SHIFT BREAKDOWN */}
      {period === 'by_shift' && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <span>Thống kê phân bổ theo Buổi / Ca ăn ({selectedDateDMY})</span>
              </h3>
              <p className="text-xs text-slate-500">
                Ghi nhận số tổng từng ca, đơn giá theo buổi và tỷ trọng đóng góp
              </p>
            </div>
            <div>
              <input
                type="date"
                value={dmyToIso(selectedDateDMY)}
                onChange={e => e.target.value && setSelectedDateDMY(isoToDmy(e.target.value))}
                className="min-h-[38px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          {/* 3 Shifts Comparative Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['sang', 'trua', 'toi'] as ShiftType[]).map(sh => {
              const total = calculateSessionTotal(selectedDateDMY, sh);
              const price = getSessionPrice(selectedDateDMY, sh);
              const cost = total * price;
              const dayTotal = calculateDayTotal(selectedDateDMY) || 1;
              const pct = Math.round((total / dayTotal) * 100);
              const isLocked = Boolean(lockedSessions[`${selectedDateDMY}|${sh}`]);

              return (
                <div
                  key={sh}
                  className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/50 hover:border-orange-400 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#141e42]">
                      {SHIFT_SHORT[sh]}
                    </span>
                    {isLocked ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Đã chốt
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold">
                        Chưa chốt
                      </span>
                    )}
                  </div>

                  <div className="text-3xl font-extrabold text-slate-900">
                    {total} <span className="text-xs font-normal text-slate-500">suất</span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                      <span>Tỷ trọng ca</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-slate-600 pt-1 border-t border-slate-200 flex justify-between">
                    <span>Đơn giá: {formatCurrency(price)}</span>
                    <span className="text-emerald-700 font-bold">{formatCurrency(cost)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Supplier Breakdown Table for the Selected Day */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-100 font-bold text-xs text-slate-800">
              Chi tiết các NCC phục vụ trong ngày {selectedDateDMY}
            </div>
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="p-3">Nhà cung cấp</th>
                  <th className="p-3 text-center">Bữa Sáng</th>
                  <th className="p-3 text-center">Bữa Trưa</th>
                  <th className="p-3 text-center">Bữa Tối</th>
                  <th className="p-3 text-center font-bold">Tổng suất ngày</th>
                  <th className="p-3 text-right font-bold">Thành tiền ước tính</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nccList.map(ncc => {
                  const s = getNccSessionTotal(selectedDateDMY, 'sang', ncc.code);
                  const t = getNccSessionTotal(selectedDateDMY, 'trua', ncc.code);
                  const to = getNccSessionTotal(selectedDateDMY, 'toi', ncc.code);
                  const total = s + t + to;
                  if (total === 0) return null;

                  const cost =
                    s * getSessionPrice(selectedDateDMY, 'sang') +
                    t * getSessionPrice(selectedDateDMY, 'trua') +
                    to * getSessionPrice(selectedDateDMY, 'toi');

                  return (
                    <tr key={ncc.code} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900">
                        {ncc.code} - {ncc.name}
                      </td>
                      <td className="p-3 text-center">{s}</td>
                      <td className="p-3 text-center font-semibold">{t}</td>
                      <td className="p-3 text-center">{to}</td>
                      <td className="p-3 text-center font-extrabold text-[#141e42]">{total}</td>
                      <td className="p-3 text-right font-bold text-emerald-700">
                        {formatCurrency(cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VIEW 3: BY DAY & VARIANCE (THEO DÕI SỰ THAY ĐỔI & CHÊNH LỆCH) */}
      {period === 'by_day' && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                <span>Theo dõi số tổng & Chênh lệch từng Ngày (Day-over-Day)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Ghi nhận số tổng suất và phân tích mức tăng/giảm so với ngày trước đó
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#141e42] text-white">
                <tr>
                  <th className="p-3 font-semibold">Ngày phục vụ</th>
                  <th className="p-3 text-center">Bữa Sáng</th>
                  <th className="p-3 text-center">Bữa Trưa</th>
                  <th className="p-3 text-center">Bữa Tối</th>
                  <th className="p-3 text-center font-bold">Tổng ngày</th>
                  <th className="p-3 text-center font-extrabold">Chênh lệch vs ngày trước (Δ)</th>
                  <th className="p-3 text-right font-bold">Thành tiền (VNĐ)</th>
                  <th className="p-3 text-center">Trạng thái chốt</th>
                  <th className="p-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyVarianceList.map(item => (
                  <tr key={item.dateStr} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-orange-500" />
                      <span>{item.dateStr}</span>
                    </td>
                    <td className="p-3 text-center">{item.sang}</td>
                    <td className="p-3 text-center font-semibold">{item.trua}</td>
                    <td className="p-3 text-center">{item.toi}</td>
                    <td className="p-3 text-center font-extrabold text-sm text-[#141e42]">
                      {item.total}
                    </td>

                    {/* Variance Column */}
                    <td className="p-3 text-center">
                      {item.delta === 0 ? (
                        <span className="text-slate-400 font-semibold">-</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] ${
                          item.delta > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.delta > 0 ? (
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5" />
                          )}
                          <span>{item.delta > 0 ? `+${item.delta}` : item.delta} ({item.pct > 0 ? `+${item.pct}%` : `${item.pct}%`})</span>
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-right font-bold text-emerald-700">
                      {formatCurrency(item.cost)}
                    </td>

                    <td className="p-3 text-center">
                      {item.isLocked ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Đã chốt
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          Chưa chốt
                        </span>
                      )}
                    </td>

                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDateDMY(item.dateStr);
                          setPeriod('workspace');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#141e42] hover:text-white font-bold text-slate-700 transition"
                      >
                        Mở sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VIEW 4: WEEKLY TRENDS & MATRIX */}
      {period === 'by_week' && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-orange-500" />
                <span>Báo cáo & Xu hướng suất ăn theo Tuần (09/11/2026 - 15/11/2026)</span>
              </h3>
              <p className="text-xs text-slate-500">Biểu đồ khối lượng 7 ngày và so sánh chênh lệch</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500">Tổng suất tuần: </span>
              <strong className="text-base text-orange-600 font-extrabold">
                {weeklyDays.reduce((a, b) => a + b.total, 0)} suất
              </strong>
            </div>
          </div>

          {/* Bar Chart 7 Days */}
          <div className="space-y-3">
            <div className="text-xs font-bold text-slate-700">Biểu đồ khối lượng suất ăn 7 ngày trong tuần:</div>
            <div className="grid grid-cols-7 gap-2 items-end h-44 bg-slate-50 rounded-2xl p-4 border border-slate-200">
              {weeklyDays.map(item => {
                const heightPct = Math.max(10, Math.round((item.total / maxWeeklyDayMeals) * 100));
                return (
                  <div key={item.code} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                    <span className="text-[11px] font-extrabold text-[#141e42] group-hover:scale-110 transition">
                      {item.total > 0 ? item.total : '-'}
                    </span>
                    <div
                      className="w-full max-w-[42px] bg-gradient-to-t from-[#141e42] to-orange-500 rounded-t-lg transition-all duration-300"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[11px] font-bold text-slate-600 mt-1">{item.code}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Weekly Detail Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#141e42] text-white">
                <tr>
                  <th className="p-3">Thứ / Ngày</th>
                  <th className="p-3 text-center">Sáng</th>
                  <th className="p-3 text-center">Trưa</th>
                  <th className="p-3 text-center">Tối</th>
                  <th className="p-3 text-center font-bold">Tổng ngày</th>
                  <th className="p-3 text-right font-bold">Chi phí ước tính</th>
                  <th className="p-3 text-center">Trạng thái chốt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weeklyDays.map(item => (
                  <tr key={item.code} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900">{item.label}</td>
                    <td className="p-3 text-center">{item.sang}</td>
                    <td className="p-3 text-center font-semibold">{item.trua}</td>
                    <td className="p-3 text-center">{item.toi}</td>
                    <td className="p-3 text-center font-extrabold text-[#141e42] text-sm">{item.total}</td>
                    <td className="p-3 text-right font-bold text-emerald-700">{formatCurrency(item.cost)}</td>
                    <td className="p-3 text-center">
                      {item.isLocked ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Đã chốt
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px]">
                          Chờ chốt
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VIEW 5: NCC VARIANCE & FLUCTUATIONS (THEO DÕI SỰ THAY ĐỔI & CHÊNH LỆCH THEO NCC) */}
      {period === 'by_variance' && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Scale className="w-5 h-5 text-orange-500" />
                <span>Theo dõi Biến động & Chênh lệch theo Nhà cung cấp</span>
              </h3>
              <p className="text-xs text-slate-500">
                So sánh số suất và tỷ lệ thay đổi của từng NCC qua 2 ngày gần nhất ({selectedDateDMY} vs ngày trước)
              </p>
            </div>
          </div>

          {/* Variance Matrix by NCC */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#141e42] text-white">
                <tr>
                  <th className="p-3">Nhà cung cấp</th>
                  <th className="p-3 text-center">Số suất hôm trước</th>
                  <th className="p-3 text-center font-bold">Số suất hôm nay ({selectedDateDMY})</th>
                  <th className="p-3 text-center font-extrabold">Chênh lệch (Δ Suất)</th>
                  <th className="p-3 text-center font-extrabold">Tỷ lệ thay đổi (%)</th>
                  <th className="p-3 text-center">Đánh giá biến động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {nccList.map(ncc => {
                  const todayCount = (['sang', 'trua', 'toi'] as ShiftType[]).reduce(
                    (sum, sh) => sum + getNccSessionTotal(selectedDateDMY, sh, ncc.code),
                    0
                  );

                  // Find previous date
                  const currIdx = allRecordedDatesAsc.indexOf(selectedDateDMY);
                  const prevDate = currIdx > 0 ? allRecordedDatesAsc[currIdx - 1] : '';
                  const prevCount = prevDate
                    ? (['sang', 'trua', 'toi'] as ShiftType[]).reduce(
                        (sum, sh) => sum + getNccSessionTotal(prevDate, sh, ncc.code),
                        0
                      )
                    : todayCount;

                  const diff = todayCount - prevCount;
                  const pct = prevCount > 0 ? Math.round((diff / prevCount) * 100) : 0;

                  return (
                    <tr key={ncc.code} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-bold">
                          {ncc.code}
                        </span>
                        <span>{ncc.name}</span>
                      </td>

                      <td className="p-3 text-center text-slate-600 font-semibold">{prevCount}</td>
                      <td className="p-3 text-center font-extrabold text-[#141e42] text-sm">{todayCount}</td>

                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full text-[11px] ${
                          diff > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : diff < 0
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {diff > 0 ? `+${diff}` : diff}
                        </span>
                      </td>

                      <td className="p-3 text-center font-bold">
                        <span className={pct > 0 ? 'text-emerald-700' : pct < 0 ? 'text-rose-700' : 'text-slate-500'}>
                          {pct > 0 ? `+${pct}%` : `${pct}%`}
                        </span>
                      </td>

                      <td className="p-3 text-center">
                        {Math.abs(pct) >= 15 ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            Biến động mạnh ({pct > 0 ? 'Tăng cao' : 'Giảm mạnh'})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            Ổn định
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* VIEW 6: MONTHLY SETTLEMENT & NCC SUMMARY (NO RIGID KTX ZONE) */}
      {period === 'by_month' && (
        <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                <span>Bảng tổng hợp & Đối soát tháng theo Nhà cung cấp</span>
              </h3>
              <p className="text-xs text-slate-500">
                Ghi nhận số tổng suất ăn của từng NCC trong toàn bộ kỳ theo dõi
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="min-h-[38px] px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          {/* Supplier Settlement Table (NO rigid KTX zone) */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#141e42] text-white">
                <tr>
                  <th className="p-3">Mã & Nhà cung cấp</th>
                  <th className="p-3 text-center font-bold">Tổng suất ăn</th>
                  <th className="p-3 text-center">Tỷ trọng (%)</th>
                  <th className="p-3 text-right font-extrabold">Chi phí ước tính</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {monthlySupplierStats.map(s => (
                  <tr key={s.code} className="hover:bg-slate-50">
                    <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-orange-100 text-orange-800 flex items-center justify-center font-bold">
                        {s.code}
                      </span>
                      <span>{s.name}</span>
                    </td>
                    <td className="p-3 text-center font-extrabold text-sm text-[#141e42]">
                      {s.count.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold text-[11px]">
                        {s.pct}%
                      </span>
                    </td>
                    <td className="p-3 text-right font-extrabold text-emerald-700 text-sm">
                      {formatCurrency(s.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold text-slate-900 text-xs">
                <tr>
                  <td className="p-3 uppercase">Tổng cộng toàn lán trại</td>
                  <td className="p-3 text-center text-base font-extrabold text-orange-600">
                    {monthlySupplierStats.reduce((sum, s) => sum + s.count, 0).toLocaleString('vi-VN')}
                  </td>
                  <td className="p-3 text-center font-bold">100%</td>
                  <td className="p-3 text-right text-base font-extrabold text-emerald-800">
                    {formatCurrency(monthlySupplierStats.reduce((sum, s) => sum + s.cost, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
