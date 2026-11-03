import React from 'react';
import { MealVendor } from '../types';

interface SupplierChipsProps {
  vendors: MealVendor[];
  selectedVendorId: string;
  onSelectVendor: (vendorId: string) => void;
  showPortionCount?: boolean;
}

export const SupplierChips: React.FC<SupplierChipsProps> = ({
  vendors,
  selectedVendorId,
  onSelectVendor,
  showPortionCount = true
}) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {vendors.map(v => {
        const isSelected = selectedVendorId === v.id;
        const total = v.td8 + v.td11_1 + v.td11_3;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => onSelectVendor(v.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border flex items-center space-x-1.5 cursor-pointer active:scale-95 ${
              isSelected
                ? 'bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-white shadow-md border-transparent'
                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50 hover:text-(--vc-brand-2)'
            }`}
          >
            <span className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] ${
              isSelected ? 'bg-amber-400 text-slate-950 shadow-sm' : 'bg-slate-100 text-slate-700'
            }`}>
              {v.code}
            </span>
            <span>{v.name}</span>
            {showPortionCount && (
              <span className={`text-[11px] font-bold ${isSelected ? 'text-amber-200' : 'text-slate-500'}`}>
                ({total.toLocaleString('vi-VN')}s)
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
