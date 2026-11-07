import React, { useState, useMemo } from 'react';
import {
  Copy, Check, RotateCcw, Edit3, Minus, Plus, Eye, EyeOff
} from 'lucide-react';
import { DEFAULT_NCC_LIST } from '../ruleConfig';
import {
  DayMenu,
  DishOverrideEntry,
  KtxZone,
  MealCountEntry,
  NccInfo,
  Severity,
  ShiftType,
  WeeklyMenu
} from '../types';
import { auditWeeklyMenu } from '../auditEngine';

interface ReportTabProps {
  nccList: NccInfo[];
  onUpdateNccList: (next: NccInfo[]) => void;
  menus: WeeklyMenu[];
  unitPrice: number;
  severityOverrides: Record<string, Severity>;
  columnLabels: string[];
  onUpdateColumnLabels: (next: string[]) => void;
  mealCounts: Record<string, MealCountEntry>; // key: `${dateDMY}|${shift}|${nccCode}`
  onUpdateMealCount: (key: string, entry: MealCountEntry) => void;
  dishOverrides: Record<string, DishOverrideEntry>; // key: `${dateDMY}|${shift}|${nccCode}`
  onUpdateDishOverride: (key: string, entry: DishOverrideEntry | null) => void;
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

function getDefaultShiftByTime(): ShiftType {
  const h = new Date().getHours();
  if (h < 10) return 'sang';
  if (h < 15) return 'trua';
  return 'toi';
}

function formatPriceVND(price: number): string {
  return price.toLocaleString('vi-VN') + 'đ';
}

export default function ReportTab({
  nccList,
  onUpdateNccList,
  menus,
  unitPrice,
  severityOverrides,
  columnLabels,
  onUpdateColumnLabels,
  mealCounts,
  onUpdateMealCount,
  dishOverrides,
  onUpdateDishOverride
}: ReportTabProps) {
  const [serveDateDMY, setServeDateDMY] = useState<string>(getTodayDMY);
  const [shift, setShift] = useState<ShiftType>(getDefaultShiftByTime);
  const [ktxZone, setKtxZone] = useState<KtxZone>('KTX1');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingOverrideKey, setEditingOverrideKey] = useState<string | null>(null);
  const [editingColumns, setEditingColumns] = useState<boolean>(false);
  const [editingRows, setEditingRows] = useState<boolean>(false);
  const [hiddenCells, setHiddenCells] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('meals_v2_hidden_cells');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const isCellHidden = (nccCode: string, label: string): boolean =>
    Boolean(hiddenCells[`${nccCode}|${label}`]);

  const toggleHideCell = (nccCode: string, label: string) => {
    const key = `${nccCode}|${label}`;
    setHiddenCells(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (!next[key]) delete next[key];
      try {
        localStorage.setItem('meals_v2_hidden_cells', JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [selectedByKtx, setSelectedByKtx] = useState<Record<KtxZone, string[]>>(() => {
    try {
      const raw = localStorage.getItem('meals_v2_ktx_nccs');
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return {
      KTX1: nccList.filter(n => n.ktx === 'KTX1').map(n => n.code),
      KTX2: nccList.filter(n => n.ktx === 'KTX2').map(n => n.code)
    };
  });

  const selectedNccCodes = selectedByKtx[ktxZone] || [];

  const updateSelectedForKtx = (nextCodes: string[]) => {
    setSelectedByKtx(prev => {
      const updated = { ...prev, [ktxZone]: nextCodes };
      try {
        localStorage.setItem('meals_v2_ktx_nccs', JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  const handleZoneChange = (z: KtxZone) => {
    setKtxZone(z);
  };

  const toggleNcc = (code: string) => {
    const next = selectedNccCodes.includes(code)
      ? selectedNccCodes.filter(c => c !== code)
      : [...selectedNccCodes, code];
    updateSelectedForKtx(next);
  };

  const LEGACY_KEYS = ['td8', 'td11_1', 'td11_3', 'me'];

  const getColVal = (entry: MealCountEntry | undefined, idx: number, label: string): number => {
    if (!entry) return 0;
    if (typeof entry[label] === 'number') return entry[label];
    const leg = LEGACY_KEYS[idx];
    if (leg && typeof entry[leg] === 'number') return entry[leg];
    return 0;
  };

  const getCount = (code: string): MealCountEntry => {
    const key = `${serveDateDMY}|${shift}|${code}`;
    return mealCounts[key] || {};
  };

  const setColCount = (code: string, idx: number, label: string, val: number) => {
    const key = `${serveDateDMY}|${shift}|${code}`;
    const current = { ...(mealCounts[key] || {}) };
    current[label] = Math.max(0, val);
    const leg = LEGACY_KEYS[idx];
    if (leg) current[leg] = Math.max(0, val);
    onUpdateMealCount(key, current);
  };

  const applyQuickFill = (val: number) => {
    nccList.forEach(n => {
      if (selectedNccCodes.includes(n.code)) {
        const key = `${serveDateDMY}|${shift}|${n.code}`;
        const next: MealCountEntry = { ...(mealCounts[key] || {}) };
        columnLabels.forEach((lbl, idx) => {
          if (!isCellHidden(n.code, lbl)) {
            next[lbl] = val;
            const leg = LEGACY_KEYS[idx];
            if (leg) next[leg] = val;
          }
        });
        onUpdateMealCount(key, next);
      }
    });
  };

  const getNccTotal = (code: string): number => {
    const c = getCount(code);
    return columnLabels.reduce(
      (sum, lbl, idx) => (isCellHidden(code, lbl) ? sum : sum + getColVal(c, idx, lbl)),
      0
    );
  };

  const totalZoneMeals = useMemo(() => {
    return nccList.reduce((sum, n) => {
      if (!selectedNccCodes.includes(n.code)) return sum;
      return sum + getNccTotal(n.code);
    }, 0);
  }, [nccList, selectedNccCodes, mealCounts, serveDateDMY, shift, columnLabels]);

  // Helper to find day menu for (ncc, loai, serveDateDMY)
  const findDayMenu = (nccCode: string, loai: 'man' | 'chay'): { menu: WeeklyMenu; day: DayMenu } | null => {
    for (const m of menus) {
      if (m.ncc !== nccCode || m.loai !== loai) continue;
      const foundDay = m.ngay.find(d => d.ngayThang === serveDateDMY);
      if (foundDay) return { menu: m, day: foundDay };
    }
    return null;
  };

  const extractShiftDishes = (day: DayMenu | null): { dishes: string; dessert: string; isComplete: boolean } => {
    if (!day) {
      return {
        dishes: 'Chưa có thực đơn cho ngày này, hãy tải file thực đơn tuần ở tab Thực đơn',
        dessert: '',
        isComplete: false
      };
    }
    if (shift === 'sang') {
      const mon = day.sang.mon?.trim() || '';
      return {
        dishes: mon || 'Chưa có thực đơn cho ngày này, hãy tải file thực đơn tuần ở tab Thực đơn',
        dessert: '',
        isComplete: Boolean(mon)
      };
    }
    const rows = day[shift];
    const mainAndSides = rows.slice(0, 6).map(r => r.ten.trim()).filter(Boolean);
    const dessert = rows[6]?.ten.trim() || '';
    const isComplete = mainAndSides.length >= 5;
    return {
      dishes: mainAndSides.length > 0
        ? mainAndSides.join(', ')
        : 'Chưa có thực đơn cho ngày này, hãy tải file thực đơn tuần ở tab Thực đơn',
      dessert,
      isComplete
    };
  };

  const getQuantitativeStatus = (nccCode: string, manInfo: { menu: WeeklyMenu; day: DayMenu } | null): string => {
    if (!manInfo) return 'Chưa kiểm';
    const extracted = extractShiftDishes(manInfo.day);
    if (!extracted.isComplete) return 'Chưa kiểm';

    const audit = auditWeeklyMenu(manInfo.menu, severityOverrides);
    const dayPrefix = `${manInfo.day.ma} (${serveDateDMY.slice(0, 5)})`;
    const shiftLabel = shift === 'sang' ? 'Sáng' : shift === 'trua' ? 'Trưa' : 'Tối';

    const quantHighs = audit.warnings.filter(
      w =>
        w.group === 'dinh_luong' &&
        w.severity === 'HIGH' &&
        (w.day === dayPrefix || w.day.startsWith('Nhiều ngày')) &&
        (w.shift === shiftLabel || w.shift === 'Nhiều ca')
    );

    if (quantHighs.length === 0) return 'Đạt';
    return `Có ${quantHighs.length} cảnh báo (xem tab Kiểm định)`;
  };

  const buildNccBlock = (ncc: NccInfo): string => {
    const c = getCount(ncc.code);
    const totalNcc = getNccTotal(ncc.code);
    const key = `${serveDateDMY}|${shift}|${ncc.code}`;
    const ov = dishOverrides[key];

    const manFound = findDayMenu(ncc.code, 'man');
    const chayFound = findDayMenu(ncc.code, 'chay');

    const manAuto = extractShiftDishes(manFound?.day || null);
    const chayAuto = extractShiftDishes(chayFound?.day || null);

    const manDishes = ov?.manDishes !== undefined ? ov.manDishes : manAuto.dishes;
    const manDessert = ov?.manDessert !== undefined ? ov.manDessert : manAuto.dessert;
    const chayDishes = ov?.chayDishes !== undefined ? ov.chayDishes : chayAuto.dishes;
    const chayDessert = ov?.chayDessert !== undefined ? ov.chayDessert : chayAuto.dessert;

    const quantStatus = getQuantitativeStatus(ncc.code, manFound);

    const colLines = columnLabels
      .map((lbl, idx) => ({ lbl, idx }))
      .filter(({ lbl }) => !isCellHidden(ncc.code, lbl))
      .map(({ lbl, idx }) => `${lbl || `Cột ${idx + 1}`}: ${getColVal(c, idx, lbl)} suất`);

    return [
      `NCC: ${ncc.name}`,
      `• Tổng suất ăn: ${totalNcc} suất`,
      ...colLines,
      `• Suất ăn mặn: ${manDishes}`,
      `• Tráng miệng mặn: ${manDessert}`,
      `• Suất ăn chay: ${chayDishes}`,
      `• Tráng miệng chay: ${chayDessert}`,
      `Cân định lượng: ${quantStatus}`
    ].join('\n');
  };

  const shiftText =
    shift === 'sang' ? 'bữa sáng' : shift === 'trua' ? 'bữa trưa' : 'bữa tối';

  const buildHeader = (totalSuat: number): string => {
    return [
      `Báo cáo Anh/Chị: Lán trại Hóc Môn ${ktxZone} phục vụ suất ăn ${shiftText} ngày ${serveDateDMY}`,
      `• Tổng cộng: ${totalSuat} suất`,
      `• Đơn giá: ${formatPriceVND(unitPrice)}`
    ].join('\n');
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllZalo = () => {
    const activeNccs = nccList.filter(n => selectedNccCodes.includes(n.code));
    if (activeNccs.length === 0) return;
    const header = buildHeader(totalZoneMeals);
    const blocks = activeNccs.map(n => buildNccBlock(n)).join('\n');
    copyText(`${header}\n${blocks}`, 'ALL_ZALO');
  };

  return (
    <div className="space-y-6">
      {/* Top Controls: Date, Shift, Zone */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ngày phục vụ</label>
            <input
              type="date"
              value={dmyToIso(serveDateDMY)}
              onChange={e => {
                const dmy = isoToDmy(e.target.value);
                if (dmy) setServeDateDMY(dmy);
              }}
              className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Ca phục vụ</label>
            <div className="flex rounded-lg overflow-hidden border border-slate-300">
              {[
                { id: 'sang' as const, label: 'Bữa sáng (06:00–08:30)' },
                { id: 'trua' as const, label: 'Bữa trưa (11:00–13:30)' },
                { id: 'toi' as const, label: 'Bữa tối (17:00–19:30)' }
              ].map(s => (
                <button
                  key={s.id}
                  onClick={() => setShift(s.id)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    shift === s.id
                      ? 'bg-blue-900 text-white'
                      : 'bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Zone Tabs */}
        <div className="flex items-center gap-2">
          {(['KTX1', 'KTX2'] as const).map(z => (
            <button
              key={z}
              onClick={() => handleZoneChange(z)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
                ktxZone === z
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {z}
            </button>
          ))}
          <div className="ml-2 px-3 py-1.5 rounded-lg bg-blue-900/10 text-blue-900 text-sm font-bold">
            Tổng khu: {totalZoneMeals} suất
          </div>
        </div>
      </div>

      {/* NCC Chips & Quick Fill */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 mr-1">Chọn NCC ({ktxZone}):</span>
            {nccList.map(n => {
              const active = selectedNccCodes.includes(n.code);
              return (
                <button
                  key={n.code}
                  onClick={() => toggleNcc(n.code)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {n.code} - {n.name}
                </button>
              );
            })}
            <button
              onClick={() => updateSelectedForKtx(nccList.map(n => n.code))}
              className="px-2.5 py-1 rounded-lg text-xs text-blue-900 hover:bg-blue-50 font-medium"
            >
              Chọn tất cả
            </button>
            <button
              onClick={() => updateSelectedForKtx([])}
              className="px-2.5 py-1 rounded-lg text-xs text-rose-600 hover:bg-rose-50 font-medium"
            >
              Bỏ hết
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-500 mr-1">Điền nhanh:</span>
            {[50, 100, 150, 200, 500].map(val => (
              <button
                key={val}
                onClick={() => applyQuickFill(val)}
                className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700"
              >
                ={val}
              </button>
            ))}
            <button
              onClick={() => applyQuickFill(0)}
              className="px-2.5 py-1 rounded bg-rose-50 hover:bg-rose-100 text-xs font-medium text-rose-700"
            >
              Đặt 0
            </button>
            <button
              onClick={() => setEditingColumns(prev => !prev)}
              className={`ml-2 px-3 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-colors ${
                editingColumns
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              {editingColumns ? 'Xong chỉnh sửa cột' : 'Chỉnh sửa cột'}
            </button>
            {editingColumns && (
              <button
                onClick={() =>
                  onUpdateColumnLabels([...columnLabels, `Cột ${columnLabels.length + 1}`])
                }
                className="px-2.5 py-1 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm cột
              </button>
            )}
            <button
              onClick={() => setEditingRows(prev => !prev)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition-colors ${
                editingRows
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              {editingRows ? 'Xong chỉnh sửa dòng' : 'Chỉnh sửa dòng'}
            </button>
            {editingRows && (
              <>
                <button
                  onClick={() => {
                    const newCode = `NCC${nccList.length + 1}`;
                    const newNcc: NccInfo = {
                      code: newCode,
                      name: `Nhà cung cấp ${nccList.length + 1}`,
                      ktx: ktxZone
                    };
                    onUpdateNccList([...nccList, newNcc]);
                    updateSelectedForKtx([...selectedNccCodes, newCode]);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm dòng
                </button>
                <button
                  onClick={() => {
                    onUpdateNccList(DEFAULT_NCC_LIST);
                    updateSelectedForKtx(
                      DEFAULT_NCC_LIST.filter(n => n.ktx === ktxZone).map(n => n.code)
                    );
                  }}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium flex items-center gap-1"
                  title="Khôi phục danh sách 7 NCC mặc định"
                >
                  <RotateCcw className="w-3 h-3" /> Khôi phục mặc định
                </button>
              </>
            )}
          </div>
        </div>

        {/* Meal Count Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-y border-slate-200">
                <th className="p-2.5 text-left">Nhà cung cấp</th>
                {columnLabels.map((lbl, idx) => (
                  <th key={idx} className="p-2 text-center">
                    {editingColumns ? (
                      <div className="inline-flex items-center gap-1">
                        <input
                          type="text"
                          value={lbl}
                          onChange={e => {
                            const next = [...columnLabels];
                            next[idx] = e.target.value;
                            onUpdateColumnLabels(next);
                          }}
                          className="w-24 text-center font-semibold text-slate-700 bg-white border border-slate-300 focus:border-blue-900 focus:outline-none rounded px-1.5 py-1 text-xs"
                        />
                        <button
                          onClick={() => {
                            const next = [...columnLabels];
                            next.splice(idx + 1, 0, `Cột ${columnLabels.length + 1}`);
                            onUpdateColumnLabels(next);
                          }}
                          className="p-1 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded font-bold"
                          title="Thêm cột mới bên cạnh"
                        >
                          +
                        </button>
                        {columnLabels.length > 1 && (
                          <button
                            onClick={() =>
                              onUpdateColumnLabels(columnLabels.filter((_, i) => i !== idx))
                            }
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded font-bold"
                            title="Xoá cột này"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="font-semibold text-slate-700">{lbl}</span>
                    )}
                  </th>
                ))}
                <th className="p-2.5 text-center">Tổng suất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {nccList
                .filter(n => selectedNccCodes.includes(n.code))
                .map(n => {
                  const c = getCount(n.code);
                  const total = getNccTotal(n.code);
                  return (
                    <tr key={n.code} className="hover:bg-slate-50">
                      <td className="p-2.5 font-semibold text-slate-800">
                        {editingRows ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="text"
                              value={n.code}
                              onChange={e => {
                                const val = e.target.value.toUpperCase();
                                onUpdateNccList(
                                  nccList.map(item =>
                                    item.code === n.code ? { ...item, code: val } : item
                                  )
                                );
                              }}
                              className="w-16 px-1.5 py-1 border border-slate-300 rounded text-xs font-bold text-blue-900 bg-white"
                              title="Mã NCC"
                            />
                            <input
                              type="text"
                              value={n.name}
                              onChange={e => {
                                const val = e.target.value;
                                onUpdateNccList(
                                  nccList.map(item =>
                                    item.code === n.code ? { ...item, name: val } : item
                                  )
                                );
                              }}
                              className="w-36 px-2 py-1 border border-slate-300 rounded text-xs font-semibold text-slate-800 bg-white"
                              title="Tên NCC"
                            />
                            <button
                              onClick={() => {
                                const newCode = `NCC${nccList.length + 1}`;
                                const newNcc: NccInfo = {
                                  code: newCode,
                                  name: `Nhà cung cấp ${nccList.length + 1}`,
                                  ktx: ktxZone
                                };
                                const idx = nccList.findIndex(item => item.code === n.code);
                                const nextList = [...nccList];
                                nextList.splice(idx + 1, 0, newNcc);
                                onUpdateNccList(nextList);
                                updateSelectedForKtx([...selectedNccCodes, newCode]);
                              }}
                              className="p-1 text-blue-700 hover:text-blue-900 hover:bg-blue-50 rounded font-bold"
                              title="Thêm dòng mới bên dưới"
                            >
                              +
                            </button>
                            {nccList.length > 1 && (
                              <button
                                onClick={() => {
                                  onUpdateNccList(nccList.filter(item => item.code !== n.code));
                                  updateSelectedForKtx(
                                    selectedNccCodes.filter(c => c !== n.code)
                                  );
                                }}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded font-bold"
                                title="Xoá dòng này"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ) : (
                          <span>
                            {n.code} - {n.name}
                          </span>
                        )}
                      </td>
                      {columnLabels.map((lbl, idx) => {
                        const val = getColVal(c, idx, lbl);
                        const hidden = isCellHidden(n.code, lbl);
                        return (
                          <td key={idx} className="p-2 text-center">
                            {hidden ? (
                              <button
                                onClick={() => toggleHideCell(n.code, lbl)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs"
                                title="Bấm để hiện lại ô này trong báo cáo"
                              >
                                <Eye className="w-3.5 h-3.5" /> Đã ẩn
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1">
                                <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white overflow-hidden">
                                  <button
                                    onClick={() => setColCount(n.code, idx, lbl, val - 1)}
                                    className="px-2 py-1 hover:bg-slate-100 text-slate-600"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <input
                                    type="number"
                                    min={0}
                                    value={val}
                                    onChange={e =>
                                      setColCount(n.code, idx, lbl, Number(e.target.value) || 0)
                                    }
                                    className="w-14 text-center py-1 font-semibold text-slate-800 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => setColCount(n.code, idx, lbl, val + 1)}
                                    className="px-2 py-1 hover:bg-slate-100 text-slate-600"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <button
                                  onClick={() => toggleHideCell(n.code, lbl)}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                                  title="Ẩn ô này khỏi báo cáo"
                                >
                                  <EyeOff className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="p-2.5 text-center font-bold text-blue-900 text-sm">
                        {total}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Cards per NCC */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {nccList
          .filter(n => selectedNccCodes.includes(n.code))
          .map(n => {
            const totalNcc = getNccTotal(n.code);
            const fullSingleText = `${buildHeader(totalNcc)}\n${buildNccBlock(n)}`;
            const key = `${serveDateDMY}|${shift}|${n.code}`;
            const isEditing = editingOverrideKey === key;
            const ov = dishOverrides[key] || {};

            const manFound = findDayMenu(n.code, 'man');
            const chayFound = findDayMenu(n.code, 'chay');
            const manAuto = extractShiftDishes(manFound?.day || null);
            const chayAuto = extractShiftDishes(chayFound?.day || null);

            const currentManDishes =
              ov.manDishes !== undefined
                ? ov.manDishes
                : manFound?.day
                ? manAuto.dishes
                : '';
            const currentManDessert =
              ov.manDessert !== undefined ? ov.manDessert : manAuto.dessert;
            const currentChayDishes =
              ov.chayDishes !== undefined
                ? ov.chayDishes
                : chayFound?.day
                ? chayAuto.dishes
                : '';
            const currentChayDessert =
              ov.chayDessert !== undefined ? ov.chayDessert : chayAuto.dessert;

            return (
              <div
                key={n.code}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
              >
                <div className="px-4 py-3 bg-[#141e42] text-white flex items-center justify-between">
                  <span className="font-semibold text-sm">
                    {n.code} - {n.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingOverrideKey(isEditing ? null : key)}
                      className={`px-2.5 py-1 rounded text-xs flex items-center gap-1 ${
                        isEditing
                          ? 'bg-amber-500 text-white font-semibold'
                          : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" /> {isEditing ? 'Xong' : 'Sửa món'}
                    </button>
                    {dishOverrides[key] && (
                      <button
                        onClick={() => onUpdateDishOverride(key, null)}
                        className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-xs flex items-center gap-1"
                        title="Nạp lại từ thực đơn"
                      >
                        <RotateCcw className="w-3 h-3" /> Nạp lại
                      </button>
                    )}
                    <button
                      onClick={() => copyText(fullSingleText, n.code)}
                      className="px-3 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1"
                    >
                      {copiedId === n.code ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Đã chép
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Sao chép riêng
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="p-3 bg-amber-50 border-b border-amber-200 space-y-2 text-xs">
                    <div>
                      <label className="block font-medium text-slate-700">Suất ăn mặn:</label>
                      <input
                        type="text"
                        value={currentManDishes}
                        onChange={e =>
                          onUpdateDishOverride(key, { ...ov, manDishes: e.target.value })
                        }
                        placeholder="Nhập danh sách món mặn..."
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded mt-0.5"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-medium text-slate-700">Tráng miệng mặn:</label>
                        <input
                          type="text"
                          value={currentManDessert}
                          onChange={e =>
                            onUpdateDishOverride(key, { ...ov, manDessert: e.target.value })
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded mt-0.5"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700">Tráng miệng chay:</label>
                        <input
                          type="text"
                          value={currentChayDessert}
                          onChange={e =>
                            onUpdateDishOverride(key, { ...ov, chayDessert: e.target.value })
                          }
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded mt-0.5"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700">Suất ăn chay:</label>
                      <input
                        type="text"
                        value={currentChayDishes}
                        onChange={e =>
                          onUpdateDishOverride(key, { ...ov, chayDishes: e.target.value })
                        }
                        placeholder="Nhập danh sách món chay..."
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded mt-0.5"
                      />
                    </div>
                  </div>
                )}

                <pre className="p-4 text-xs font-sans whitespace-pre-wrap text-slate-800 leading-relaxed flex-1 bg-slate-50/40">
                  {fullSingleText}
                </pre>
              </div>
            );
          })}
      </div>

      {/* Copy All Zalo Button */}
      <div className="flex justify-end">
        <button
          onClick={handleCopyAllZalo}
          disabled={selectedNccCodes.length === 0}
          className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold text-sm shadow-md flex items-center gap-2"
        >
          {copiedId === 'ALL_ZALO' ? (
            <>
              <Check className="w-5 h-5" /> Đã sao chép báo cáo Zalo toàn khu {ktxZone}!
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" /> Sao chép gửi Zalo toàn bộ ({ktxZone})
            </>
          )}
        </button>
      </div>
    </div>
  );
}
