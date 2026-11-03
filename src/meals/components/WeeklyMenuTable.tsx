import React, { useState } from 'react';
import { DayWeeklyMenu, ShiftMealDetail, MealVendor } from '../types';
import { Edit3, Trash2, ArrowRight, Search, Filter } from 'lucide-react';

interface WeeklyMenuTableProps {
  vendors: MealVendor[];
  selectedVendorId: string;
  onSelectVendor: (vendorId: string) => void;
  weeklyMenu: DayWeeklyMenu[];
  onUpdateShiftMenu: (dayIdx: number, shiftKey: 'breakfast' | 'lunch' | 'dinner', updatedDetail: ShiftMealDetail) => void;
  onClearShiftMenu: (dayIdx: number, shiftKey: 'breakfast' | 'lunch' | 'dinner') => void;
  onLoadIntoReport: (dayOfWeek: string, dateStr: string, shiftKey: 'breakfast' | 'lunch' | 'dinner', mealDetail: ShiftMealDetail) => void;
  onToast: (msg: string) => void;
}

export const WeeklyMenuTable: React.FC<WeeklyMenuTableProps> = ({
  vendors,
  selectedVendorId,
  onSelectVendor,
  weeklyMenu,
  onUpdateShiftMenu,
  onClearShiftMenu,
  onLoadIntoReport,
  onToast
}) => {
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterShift, setFilterShift] = useState<string>('all');
  const [searchDishTerm, setSearchDishTerm] = useState<string>('');

  // Inline editing state for a single shift cell
  const [editingCell, setEditingCell] = useState<{
    dayIdx: number;
    shiftKey: 'breakfast' | 'lunch' | 'dinner';
    meatText: string;
    vegText: string;
    dessertText: string;
  } | null>(null);

  const selectedVendor = vendors.find(v => v.id === selectedVendorId) || vendors[0];

  const handleStartInlineEdit = (dayIdx: number, shiftKey: 'breakfast' | 'lunch' | 'dinner', detail: ShiftMealDetail) => {
    setEditingCell({
      dayIdx,
      shiftKey,
      meatText: detail.meatDishes.join('\n'),
      vegText: detail.vegDishes.join('\n'),
      dessertText: detail.meatDessert || 'Trái cây'
    });
  };

  const handleSaveInlineEdit = () => {
    if (!editingCell) return;
    const { dayIdx, shiftKey, meatText, vegText, dessertText } = editingCell;
    const meatDishes = meatText.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    const vegDishes = vegText.split(/[\n,]/).map(s => s.trim()).filter(Boolean);

    onUpdateShiftMenu(dayIdx, shiftKey, {
      meatDishes,
      vegDishes,
      meatDessert: dessertText.trim() || 'Trái cây',
      vegDessert: dessertText.trim() || 'Trái cây'
    });
    setEditingCell(null);
    onToast('Đã cập nhật món ăn thành công!');
  };

  const filteredDays = weeklyMenu.filter((d) => {
    if (filterDay !== 'all' && d.dayOfWeek !== filterDay) return false;
    if (searchDishTerm.trim()) {
      const q = searchDishTerm.toLowerCase();
      const allDishes = [
        ...d.breakfast.meatDishes, ...d.breakfast.vegDishes,
        ...d.lunch.meatDishes, ...d.lunch.vegDishes,
        ...d.dinner.meatDishes, ...d.dinner.vegDishes
      ].join(' ').toLowerCase();
      if (!allDishes.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
      {/* 7 NCC Selection Cards */}
      <div className="space-y-2 border-b border-slate-100 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">
            Chọn Nhà Cung Cấp Để Xem & Chỉnh Sửa Thực Đơn Tuần (7 NCC):
          </span>
          <span className="text-xs font-extrabold text-teal-800">
            Đang chọn: {selectedVendor.name} ({selectedVendor.code})
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {vendors.map(v => {
            const isSelected = selectedVendorId === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelectVendor(v.id)}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between space-y-2 cursor-pointer ${
                  isSelected
                    ? 'bg-teal-700 text-white border-teal-700 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded font-extrabold text-[11px] ${
                    isSelected ? 'bg-white text-teal-900' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {v.code}
                  </span>
                  {isSelected && <span className="text-teal-200 font-bold text-xs">✓</span>}
                </div>
                <div>
                  <div className="font-extrabold text-xs leading-tight truncate">{v.name}</div>
                  <div className={`text-[10px] leading-snug mt-0.5 truncate ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                    {v.tagline}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Day filter */}
          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="p-1.5 border rounded-lg bg-white font-semibold text-slate-700 text-xs"
          >
            <option value="all">Tất cả các ngày (Thứ 2 – CN)</option>
            {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'].map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          {/* Shift filter */}
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className="p-1.5 border rounded-lg bg-white font-semibold text-slate-700 text-xs"
          >
            <option value="all">Tất cả ca ăn</option>
            <option value="breakfast">Bữa sáng (20K)</option>
            <option value="lunch">Bữa trưa (40K)</option>
            <option value="dinner">Bữa tối (40K)</option>
          </select>

          {/* Dish search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchDishTerm}
              onChange={(e) => setSearchDishTerm(e.target.value)}
              placeholder="Tìm món: đậu hũ, cá nục, gà..."
              className="pl-8 pr-3 py-1.5 border rounded-lg bg-white text-xs w-48 sm:w-60 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Nhấp đúp hoặc bấm icon bút để <strong>sửa trực tiếp (inline)</strong> trong ô
        </div>
      </div>

      {/* 21-Shift Weekly Matrix */}
      <div className="overflow-x-auto border border-slate-200 rounded-2xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-(--vc-brand-1) text-white">
              <th className="p-3 w-28 text-center border-r border-slate-700">THỨ / NGÀY</th>
              {(filterShift === 'all' || filterShift === 'breakfast') && (
                <th className="p-3 border-r border-slate-700">☕ SÁNG (ĂN NHẸ – 20K)</th>
              )}
              {(filterShift === 'all' || filterShift === 'lunch') && (
                <th className="p-3 border-r border-slate-700">☀️ TRƯA (CHÍNH – 40K)</th>
              )}
              {(filterShift === 'all' || filterShift === 'dinner') && (
                <th className="p-3">🌙 TỐI (TĂNG CA – 40K)</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredDays.map((day, dIdx) => (
              <tr key={day.dayOfWeek} className="hover:bg-slate-50/60 transition">
                <td className="p-3 text-center border-r border-slate-200 bg-slate-50/80 align-top">
                  <div className="font-black text-sm text-slate-900">{day.dayOfWeek}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{day.dateStr}</div>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-extrabold text-[10px]">
                    {selectedVendor.code}
                  </span>
                </td>

                {/* SÁNG */}
                {(filterShift === 'all' || filterShift === 'breakfast') && (
                  <ShiftCell
                    dayIdx={dIdx}
                    dayOfWeek={day.dayOfWeek}
                    dateStr={day.dateStr}
                    shiftKey="breakfast"
                    shiftTitle="Sáng"
                    detail={day.breakfast}
                    isEditing={editingCell?.dayIdx === dIdx && editingCell?.shiftKey === 'breakfast'}
                    editingCell={editingCell}
                    onStartEdit={() => handleStartInlineEdit(dIdx, 'breakfast', day.breakfast)}
                    onSaveEdit={handleSaveInlineEdit}
                    onCancelEdit={() => setEditingCell(null)}
                    onChangeEditingCell={(field, val) => editingCell && setEditingCell({ ...editingCell, [field]: val })}
                    onClear={() => onClearShiftMenu(dIdx, 'breakfast')}
                    onLoadIntoReport={() => onLoadIntoReport(day.dayOfWeek, day.dateStr, 'breakfast', day.breakfast)}
                  />
                )}

                {/* TRƯA */}
                {(filterShift === 'all' || filterShift === 'lunch') && (
                  <ShiftCell
                    dayIdx={dIdx}
                    dayOfWeek={day.dayOfWeek}
                    dateStr={day.dateStr}
                    shiftKey="lunch"
                    shiftTitle="Trưa"
                    detail={day.lunch}
                    isEditing={editingCell?.dayIdx === dIdx && editingCell?.shiftKey === 'lunch'}
                    editingCell={editingCell}
                    onStartEdit={() => handleStartInlineEdit(dIdx, 'lunch', day.lunch)}
                    onSaveEdit={handleSaveInlineEdit}
                    onCancelEdit={() => setEditingCell(null)}
                    onChangeEditingCell={(field, val) => editingCell && setEditingCell({ ...editingCell, [field]: val })}
                    onClear={() => onClearShiftMenu(dIdx, 'lunch')}
                    onLoadIntoReport={() => onLoadIntoReport(day.dayOfWeek, day.dateStr, 'lunch', day.lunch)}
                  />
                )}

                {/* TỐI */}
                {(filterShift === 'all' || filterShift === 'dinner') && (
                  <ShiftCell
                    dayIdx={dIdx}
                    dayOfWeek={day.dayOfWeek}
                    dateStr={day.dateStr}
                    shiftKey="dinner"
                    shiftTitle="Tối"
                    detail={day.dinner}
                    isEditing={editingCell?.dayIdx === dIdx && editingCell?.shiftKey === 'dinner'}
                    editingCell={editingCell}
                    onStartEdit={() => handleStartInlineEdit(dIdx, 'dinner', day.dinner)}
                    onSaveEdit={handleSaveInlineEdit}
                    onCancelEdit={() => setEditingCell(null)}
                    onChangeEditingCell={(field, val) => editingCell && setEditingCell({ ...editingCell, [field]: val })}
                    onClear={() => onClearShiftMenu(dIdx, 'dinner')}
                    onLoadIntoReport={() => onLoadIntoReport(day.dayOfWeek, day.dateStr, 'dinner', day.dinner)}
                  />
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface ShiftCellProps {
  dayIdx: number;
  dayOfWeek: string;
  dateStr: string;
  shiftKey: 'breakfast' | 'lunch' | 'dinner';
  shiftTitle: string;
  detail: ShiftMealDetail;
  isEditing: boolean;
  editingCell: any;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onChangeEditingCell: (field: string, val: string) => void;
  onClear: () => void;
  onLoadIntoReport: () => void;
}

const ShiftCell: React.FC<ShiftCellProps> = ({
  detail,
  isEditing,
  editingCell,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onChangeEditingCell,
  onClear,
  onLoadIntoReport
}) => {
  if (isEditing) {
    return (
      <td className="p-3 border-r border-slate-200 align-top space-y-2 bg-amber-50/50">
        <div className="font-bold text-xs text-amber-900 border-b pb-1">Đang sửa trực tiếp trong ô:</div>
        <div>
          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Món mặn (mỗi món 1 dòng):</label>
          <textarea
            rows={3}
            value={editingCell?.meatText || ''}
            onChange={(e) => onChangeEditingCell('meatText', e.target.value)}
            className="w-full p-1.5 border rounded text-xs bg-white resize-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Món chay (mỗi món 1 dòng):</label>
          <textarea
            rows={3}
            value={editingCell?.vegText || ''}
            onChange={(e) => onChangeEditingCell('vegText', e.target.value)}
            className="w-full p-1.5 border rounded text-xs bg-white resize-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">Tráng miệng:</label>
          <input
            type="text"
            value={editingCell?.dessertText || ''}
            onChange={(e) => onChangeEditingCell('dessertText', e.target.value)}
            className="w-full p-1.5 border rounded text-xs bg-white"
          />
        </div>
        <div className="flex items-center space-x-1.5 pt-1">
          <button
            type="button"
            onClick={onSaveEdit}
            className="px-2.5 py-1 bg-emerald-700 text-white font-bold rounded text-xs"
          >
            Lưu
          </button>
          <button
            type="button"
            onClick={onCancelEdit}
            className="px-2.5 py-1 bg-slate-200 text-slate-700 font-bold rounded text-xs"
          >
            Hủy
          </button>
        </div>
      </td>
    );
  }

  return (
    <td
      onDoubleClick={onStartEdit}
      className="p-3 border-r border-slate-200 align-top space-y-2.5 group hover:bg-slate-50/80 transition"
    >
      {/* MÓN MẶN */}
      <div>
        <span className="font-bold text-slate-900 text-[11px] block mb-1">MÓN MẶN:</span>
        <div className="space-y-1">
          {detail.meatDishes.length === 0 ? (
            <span className="text-slate-400 text-[11px] italic">Chưa có món</span>
          ) : (
            detail.meatDishes.map((m, idx) => (
              <div key={idx} className="font-medium text-slate-800 leading-snug flex items-start space-x-1">
                <span className="text-teal-700 font-bold">•</span>
                <span>{m}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MÓN CHAY */}
      <div className="pt-1.5 border-t border-slate-100">
        <span className="font-bold text-amber-700 text-[11px] block mb-1">MÓN CHAY:</span>
        <div className="space-y-1">
          {detail.vegDishes.length === 0 ? (
            <span className="text-slate-400 text-[11px] italic">Chưa có món</span>
          ) : (
            detail.vegDishes.map((m, idx) => (
              <div key={idx} className="font-medium text-amber-900 bg-amber-50/70 p-1 rounded leading-snug">
                {m}
              </div>
            ))
          )}
        </div>
      </div>

      {/* TRÁNG MIỆNG */}
      <div className="text-[11px] text-teal-800 font-semibold pt-1 border-t border-slate-100 flex items-center space-x-1">
        <span>🍉 Tráng miệng:</span>
        <span className="text-slate-700">{detail.meatDessert || 'Trái cây theo mùa'}</span>
      </div>

      {/* HÀNG HÀNH ĐỘNG: NẠP VÀO BÁO CÁO -> + SỬA + XÓA */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <button
          type="button"
          onClick={onLoadIntoReport}
          className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-[10px] rounded-lg transition flex items-center space-x-1 border border-teal-200"
          title="Nạp vào báo cáo và tự chuyển tab"
        >
          <span>Nạp vào báo cáo</span>
          <ArrowRight className="w-3 h-3 text-teal-600" />
        </button>

        <div className="flex items-center space-x-1 opacity-80 group-hover:opacity-100 transition">
          <button
            type="button"
            onClick={onStartEdit}
            className="p-1 hover:bg-slate-200 rounded text-slate-600"
            title="Sửa trực tiếp (inline)"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onClear}
            className="p-1 hover:bg-rose-100 rounded text-rose-600"
            title="Xóa món ca này"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </td>
  );
};
