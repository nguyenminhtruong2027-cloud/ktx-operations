// src/meals/components/RealtimeClock.tsx
// Widget thời gian thực: đồng hồ digital 24h nhảy giây + lịch VI + badge ca ăn hiện tại.
// Khung ca: Sáng 06:00–08:30 | Trưa 11:00–13:00 | Tối 17:00–19:00

import { useEffect, useState } from 'react';
import { Clock, Sunrise, Sun, MoonStar } from 'lucide-react';

export type CurrentShift = { key: 'sang' | 'trua' | 'toi' | 'off'; label: string; window: string; endsAt?: string };

const SHIFT_WINDOWS: Array<{ key: 'sang' | 'trua' | 'toi'; label: string; start: number; end: number; window: string }> = [
  { key: 'sang', label: 'Ca ăn SÁNG', start: 6 * 60, end: 8 * 60 + 30, window: '06:00 – 08:30' },
  { key: 'trua', label: 'Ca ăn TRƯA', start: 11 * 60, end: 13 * 60, window: '11:00 – 13:00' },
  { key: 'toi', label: 'Ca ăn TỐI', start: 17 * 60, end: 19 * 60, window: '17:00 – 19:00' }
];

export function getCurrentShift(minutes: number): CurrentShift {
  for (const w of SHIFT_WINDOWS) {
    if (minutes >= w.start && minutes < w.end) {
      return { key: w.key, label: w.label, window: w.window };
    }
  }
  // Ngoài khung: hiển thị ca gần nhất sắp tới / vừa qua
  const next = SHIFT_WINDOWS.find(w => w.start > minutes);
  if (next) return { key: 'off', label: `Sắp tới: ${next.key === 'sang' ? 'SÁNG' : next.key === 'trua' ? 'TRƯA' : 'TỐI'}`, window: next.window };
  return { key: 'off', label: 'Ngoài khung phục vụ', window: 'Sáng rpt 06:00' };
}

const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const pad = (n: number) => String(n).padStart(2, '0');

const SHIFT_ICON: Record<CurrentShift['key'], typeof Sun> = {
  sang: Sunrise,
  trua: Sun,
  toi: MoonStar,
  off: Clock
};

export default function RealtimeClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const minutes = now.getHours() * 60 + now.getMinutes();
  const shift = getCurrentShift(minutes);
  const ShiftIcon = SHIFT_ICON[shift.key];
  const isOnShift = shift.key !== 'off';

  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr = `${WEEKDAYS[now.getDay()]}, ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;

  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'flex-col sm:flex-row sm:gap-4'}`}>
      {/* Đồng hồ digital */}
      <div className="flex items-center space-x-2.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-(--vc-brand-1) via-(--vc-brand-2) to-(--vc-brand-3) text-white shadow-md">
        <div className="p-1.5 rounded-lg bg-amber-400/20">
          <Clock className="w-4 h-4 text-amber-300" />
        </div>
        <div className="leading-none">
          <div className="font-mono text-xl sm:text-2xl font-black tracking-widest tabular-nums">
            {timeStr.split(':').map((seg, i) => (
              <span key={i}>
                {seg}
                {i < 2 && <span className="text-amber-400 animate-pulse">:</span>}
              </span>
            ))}
          </div>
          <div className="text-[10px] text-blue-200 font-semibold mt-1">{dateStr}</div>
        </div>
      </div>

      {/* Badge ca hiện tại */}
      <div
        className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-2xl border shadow-sm transition ${
          isOnShift
            ? 'bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 border-transparent'
            : 'bg-slate-100 text-slate-500 border-slate-200'
        }`}
        title={`Khung ca ăn: Sáng 06:00–08:30 · Trưa 11:00–13:00 · Tối 17:00–19:00`}
      >
        <ShiftIcon className={`w-[18px] h-[18px] ${isOnShift ? 'text-slate-950' : 'text-slate-400'}`} />
        <div className="leading-tight">
          <div className={`text-xs font-black ${isOnShift ? 'text-slate-950' : 'text-slate-700'}`}>{shift.label}</div>
          <div className={`text-[10px] font-semibold ${isOnShift ? 'text-slate-950/80' : 'text-slate-400'}`}>{shift.window}</div>
        </div>
        <span className={`ml-1 w-2 h-2 rounded-full ${isOnShift ? 'bg-slate-950 animate-pulse' : 'bg-slate-300'}`} />
      </div>
    </div>
  );
}
