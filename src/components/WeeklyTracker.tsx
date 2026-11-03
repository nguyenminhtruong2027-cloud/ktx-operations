// src/components/WeeklyTracker.tsx
// TRACKER TIẾN ĐỘ TUẦN (tinh gọn cho "Không gian Quản lý"):
// • 7 thẻ ngày với Donut % hoàn thành checklist ca
// • Biểu đồ thanh tổng kết cả tuần
// • Checklist ca trực tích nhanh, % nhảy thời gian thực

import { useState } from 'react';
import { TrendingUp, ListChecks, CheckCircle2, Circle } from 'lucide-react';

export const OPS_CHECKLIST_ITEMS = [
  'Khai báo & chốt số suất',
  'Duyệt thực đơn NCC',
  'Cân định lượng & lưu mẫu 24h',
  'Báo cáo Zalo Ban Lãnh đạo'
] as const;

// Checklist: dayIndex -> { item -> done }
export type WeeklyChecklist = Record<number, Record<string, boolean>>;

export interface TrackerDay {
  dayOfWeek: string;
  dateStr: string;
  isoDate: string;
}

function Donut({ pct, size = 66, stroke = 8 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, pct));
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={filled >= 100 ? '#16a34a' : 'url(#wkDonutGrad)'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${(c * filled) / 100} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      <defs>
        <linearGradient id="wkDonutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
      </defs>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="fill-slate-900 font-black" fontSize={size / 4.2}>
        {Math.round(filled)}%
      </text>
    </svg>
  );
}

interface WeeklyTrackerProps {
  weekDays: TrackerDay[];
  checklist: WeeklyChecklist;
  onToggleItem: (dayIdx: number, item: string) => void;
  onSetDayDone: (dayIdx: number, done: boolean) => void;
  selectedDateISO: string;
  onSelectDate: (iso: string) => void;
}

export default function WeeklyTracker({
  weekDays,
  checklist,
  onToggleItem,
  onSetDayDone,
  selectedDateISO,
  onSelectDate
}: WeeklyTrackerProps) {
  const [focusDay, setFocusDay] = useState<number>(() => {
    const idx = weekDays.findIndex(d => d.isoDate === selectedDateISO);
    return idx >= 0 ? idx : 0;
  });

  const dayPcts = weekDays.map((_, idx) => {
    const marks = checklist[idx] || {};
    const done = OPS_CHECKLIST_ITEMS.filter(item => marks[item]).length;
    return Math.round((done / OPS_CHECKLIST_ITEMS.length) * 100);
  });

  const weekAvg = Math.round(dayPcts.reduce((a, b) => a + b, 0) / 7);
  const focusPct = dayPcts[focusDay] ?? 0;
  const focusMarks = checklist[focusDay] || {};

  const dayIsSelected = (idx: number) => weekDays[idx]?.isoDate === selectedDateISO;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-(--vc-brand-2) to-(--vc-brand-3)">
            <TrendingUp className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">Tracker tiến độ tuần · Checklist ca & báo cáo suất ăn</h3>
            <p className="text-[11px] text-slate-400">Bấm thẻ ngày để tích checklist — vòng tròn nhảy % thời gian thực, đồng bộ ngày hệ thống</p>
          </div>
        </div>
        <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-blue-950 text-amber-300 text-xs font-black shadow-sm">
          Trung bình tuần: {weekAvg}%
        </span>
      </div>

      {/* 7 thẻ ngày */}
      <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
        {weekDays.map((d, idx) => {
          const pct = dayPcts[idx];
          const isFocus = focusDay === idx;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => { setFocusDay(idx); onSelectDate(d.isoDate); }}
              className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center space-y-2 ${isFocus
                ? 'border-(--vc-brand-2) bg-blue-50/70 shadow-md'
                : dayIsSelected(idx)
                  ? 'border-amber-300 bg-amber-50/60 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
              }`}
            >
              <span className={`text-[10px] font-black uppercase ${dayIsSelected(idx) ? 'text-orange-600' : 'text-slate-500'}`}>{d.dayOfWeek}</span>
              <span className="text-[10px] text-slate-400 -mt-1">{d.dateStr.slice(0, 5)}</span>
              <Donut pct={pct} size={56} stroke={7} />
            </button>
          );
        })}
      </div>

      {/* Biểu đồ thanh tổng kết tuần */}
      <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Biểu đồ thanh tiến độ cả tuần</span>
          <span className="text-[10px] text-slate-400 font-semibold">0% → 100% checklist/ngày</span>
        </div>
        <div className="flex items-end justify-between gap-2 h-28">
          {weekDays.map((d, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center justify-end space-y-1 h-full" title={`${d.dayOfWeek}: ${dayPcts[idx]}%`}>
              <span className="text-[10px] font-black text-(--vc-brand-2)">{dayPcts[idx]}%</span>
              <div className="w-full max-w-[28px] rounded-t-lg bg-gradient-to-t from-(--vc-brand-2) to-(--vc-brand-3) transition-all duration-500 relative"
                style={{ height: `${Math.max(dayPcts[idx], 2)}%` }}>
                {dayPcts[idx] === 100 && (
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px]">⭐</span>
                )}
              </div>
              <span className="text-[9px] font-bold text-slate-500">{d.dayOfWeek.replace('Thứ ', 'T').replace('Chủ nhật', 'CN')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist tracker ngày đang focus */}
      <div className="rounded-2xl border border-(--vc-brand-2)/30 bg-gradient-to-br from-blue-50/60 to-orange-50/40 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <ListChecks className="w-4 h-4 text-(--vc-brand-2)" />
            <span className="text-xs font-black text-slate-900">
              Checklist {weekDays[focusDay]?.dayOfWeek} ({weekDays[focusDay]?.dateStr})
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => onSetDayDone(focusDay, true)}
              className="px-2.5 py-1.5 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg transition"
            >
              Chọn hoàn tất
            </button>
            <button
              type="button"
              onClick={() => onSetDayDone(focusDay, false)}
              className="px-2.5 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg transition"
            >
              Xóa chọn
            </button>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black shadow-sm ${focusPct >= 100 ? 'bg-emerald-500 text-white' : 'bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950'}`}>
              {focusPct}% hoàn thành
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OPS_CHECKLIST_ITEMS.map(item => {
            const done = Boolean(focusMarks[item]);
            return (
              <button
                key={item}
                type="button"
                onClick={() => onToggleItem(focusDay, item)}
                className={`flex items-center space-x-2.5 px-3 py-2.5 rounded-xl border text-left transition active:scale-[0.98] ${done
                  ? 'bg-white border-emerald-300 shadow-sm'
                  : 'bg-white/70 border-slate-200 hover:border-amber-400 hover:shadow-sm'
                }`}
              >
                {done
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  : <Circle className="w-5 h-5 text-slate-300 shrink-0" />}
                <span className={`text-xs font-bold ${done ? 'text-slate-900' : 'text-slate-500'}`}>{item}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
