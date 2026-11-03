import React from 'react';

export type ShiftName = 'Bữa sáng' | 'Bữa trưa' | 'Bữa tối';

interface ShiftOption {
  name: ShiftName;
  time: string;
}

const SHIFT_OPTIONS: ShiftOption[] = [
  { name: 'Bữa sáng', time: '06:00 - 08:30' },
  { name: 'Bữa trưa', time: '11:00 - 13:30' },
  { name: 'Bữa tối', time: '17:00 - 19:30' }
];

interface ShiftSelectorProps {
  selectedShift: ShiftName;
  onSelectShift: (shift: ShiftName) => void;
}

export const ShiftSelector: React.FC<ShiftSelectorProps> = ({
  selectedShift,
  onSelectShift
}) => {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {SHIFT_OPTIONS.map(s => {
        const isActive = selectedShift === s.name;
        return (
          <button
            key={s.name}
            type="button"
            onClick={() => onSelectShift(s.name)}
            className={`py-2.5 px-1 rounded-xl text-center transition flex flex-col items-center justify-center cursor-pointer border ${
              isActive
                ? 'bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 font-bold shadow-md border-transparent'
                : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            <span className="text-xs font-bold leading-tight">{s.name}</span>
            <span className={`text-[9px] mt-0.5 ${isActive ? 'text-slate-900 font-semibold' : 'text-blue-200/70'}`}>
              {s.time}
            </span>
          </button>
        );
      })}
    </div>
  );
};
