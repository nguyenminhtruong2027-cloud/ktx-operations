import React, { useState } from 'react';
import { Edit3, Trash2, Plus, Check } from 'lucide-react';

interface MenuColumnProps {
  type: 'man' | 'chay';
  vendorName: string;
  dishes: string[];
  dessert?: string;
  onUpdateDishes: (dishes: string[]) => void;
  onUpdateDessert: (dessert: string) => void;
}

const COMMON_DESSERTS = ['Chuối', 'Dưa hấu', 'Thanh long', 'Táo xanh', 'Cam sành', 'Ổi', 'Bưởi da xanh'];

export const MenuColumn: React.FC<MenuColumnProps> = ({
  type,
  vendorName,
  dishes,
  dessert = 'Trái cây theo mùa',
  onUpdateDishes,
  onUpdateDessert
}) => {
  const isMan = type === 'man';
  const theme = isMan
    ? {
        border: 'border-emerald-200',
        bg: 'bg-emerald-50/40',
        badgeBg: 'bg-emerald-100 text-emerald-800',
        title: `Suất ăn mặn: ${vendorName}`,
        headerBg: 'bg-emerald-700 text-white',
        btnBg: 'bg-emerald-700 hover:bg-emerald-800 text-white'
      }
    : {
        border: 'border-amber-200',
        bg: 'bg-amber-50/40',
        badgeBg: 'bg-amber-100 text-amber-800',
        title: `Suất ăn chay: ${vendorName}`,
        headerBg: 'bg-amber-600 text-white',
        btnBg: 'bg-amber-600 hover:bg-amber-700 text-white'
      };

  const [inputVal, setInputVal] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');

  // Hỗ trợ thêm nhiều món: tách theo dấu xuống dòng, dấu phẩy hoặc dấu +
  const handleAddDishes = () => {
    if (!inputVal.trim()) return;
    const splitDishes = inputVal
      .split(/[\n,\+]/)
      .map(s => s.trim())
      .filter(Boolean);

    if (splitDishes.length > 0) {
      onUpdateDishes([...dishes, ...splitDishes]);
      setInputVal('');
    }
  };

  const handleDeleteDish = (index: number) => {
    onUpdateDishes(dishes.filter((_, i) => i !== index));
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingText(dishes[index]);
  };

  const handleSaveEdit = (index: number) => {
    if (editingText.trim()) {
      const updated = [...dishes];
      updated[index] = editingText.trim();
      onUpdateDishes(updated);
    }
    setEditingIndex(null);
  };

  return (
    <div className={`rounded-2xl border ${theme.border} ${theme.bg} p-4 space-y-3 flex flex-col justify-between`}>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/60 pb-2.5">
          <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">
            {theme.title}
          </h4>
          <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${theme.badgeBg}`}>
            {dishes.length} món
          </span>
        </div>

        {/* Dish List */}
        <div className="space-y-1.5 min-h-[140px]">
          {dishes.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs italic">
              Chưa có món ăn. Nhập vào ô bên dưới để thêm.
            </div>
          ) : (
            dishes.map((dish, idx) => {
              const isEditing = editingIndex === idx;
              return (
                <div
                  key={idx}
                  className="p-2 bg-white rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-between gap-2 text-xs hover:border-slate-300 transition"
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px] flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingText}
                        onChange={(e) => setEditingText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(idx)}
                        className="w-full p-1 border rounded text-xs bg-slate-50 focus:bg-white"
                        autoFocus
                      />
                    ) : (
                      <span className="font-semibold text-slate-800 leading-snug break-words">
                        {dish}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-1 shrink-0">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(idx)}
                        className="p-1 hover:bg-emerald-100 text-emerald-700 rounded"
                        title="Lưu"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEdit(idx)}
                        className="p-1 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded"
                        title="Sửa tên hoặc định lượng"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteDish(idx)}
                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded"
                      title="Xóa món"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Tráng miệng */}
        <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700">
              Tráng miệng {isMan ? 'mặn' : 'chay'}:
            </span>
            <span className="text-[11px] text-slate-500 font-medium">Gõ hoặc chọn nhanh</span>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={dessert}
              onChange={(e) => onUpdateDessert(e.target.value)}
              placeholder="VD: Chuối, Táo xanh, Dưa hấu..."
              className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="flex flex-wrap gap-1 pt-0.5">
            {COMMON_DESSERTS.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => onUpdateDessert(item)}
                className={`px-2 py-0.5 text-[10px] rounded-lg border transition ${
                  dessert.includes(item)
                    ? 'bg-teal-700 text-white border-teal-700 font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input box thêm món mới (Hỗ trợ dán nhiều món) */}
      <div className="pt-3 border-t border-slate-200/60 space-y-1.5">
        <textarea
          rows={2}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          placeholder="Nhập món mới (có thể dán nhiều món, cách nhau bằng dấu phẩy, dấu cộng hoặc xuống dòng)..."
          className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
        ></textarea>
        <button
          type="button"
          onClick={handleAddDishes}
          className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer ${theme.btnBg}`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ Thêm món ăn</span>
        </button>
      </div>
    </div>
  );
};
