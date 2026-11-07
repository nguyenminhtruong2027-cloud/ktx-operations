import React, { useState, useRef } from 'react';
import {
  Upload, FileSpreadsheet, AlertTriangle, Trash2, Eye, Edit3, Check, X, Sliders
} from 'lucide-react';
import { DayMenu, NccInfo, WeeklyMenu } from '../types';
import {
  ManualColumnMap,
  parseExcelOrCsvFile,
  parseSheetWithMap,
  SheetPreview
} from '../excelParser';
import { extractMenuFromFile } from '../extractMenu';

interface MenuUploadTabProps {
  nccList: NccInfo[];
  menus: WeeklyMenu[];
  onSaveMenu: (menu: WeeklyMenu) => void;
  onDeleteMenu: (id: string) => void;
}

export default function MenuUploadTab({
  nccList,
  menus,
  onSaveMenu,
  onDeleteMenu
}: MenuUploadTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [pendingMenus, setPendingMenus] = useState<WeeklyMenu[]>([]);
  const [activePendingIdx, setActivePendingIdx] = useState(0);

  const [manualSheets, setManualSheets] = useState<SheetPreview[]>([]);
  const [manualFileName, setManualFileName] = useState<string>('');
  const [manualMap, setManualMap] = useState<ManualColumnMap>({
    dayCol: 0,
    sangMonCol: 1,
    sangTlCol: 2,
    truaMonCol: 3,
    truaTlCol: 4,
    toiMonCol: 5,
    toiTlCol: 6
  });

  const activePending = pendingMenus[activePendingIdx] || null;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setErrorMsg(null);
    const newPending: WeeklyMenu[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (['xlsx', 'xls', 'ods', 'csv'].includes(ext)) {
        setLoadingMsg(`Đang đọc file Excel/CSV: ${file.name}...`);
        try {
          const res = await parseExcelOrCsvFile(file, nccList);
          if (res.menus.length > 0) {
            newPending.push(...res.menus);
          } else if (res.needsManualMapping && res.rawSheets.length > 0) {
            setManualSheets(res.rawSheets);
            setManualFileName(file.name);
            setErrorMsg(res.error || 'Cấu trúc file lạ, vui lòng ghép cột thủ công bên dưới.');
          } else {
            setErrorMsg(res.error || `Không thể đọc file ${file.name}`);
          }
        } catch (err: any) {
          setErrorMsg(`Lỗi đọc file ${file.name}: ${err?.message || 'Không xác định'}`);
        }
      } else if (['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(ext)) {
        setLoadingMsg(`Đang gửi ${file.name} tới AI để trích xuất thực đơn...`);
        try {
          const menu = await extractMenuFromFile(file);
          newPending.push(menu);
        } catch (err: any) {
          setErrorMsg(`Lỗi trích xuất ${file.name}: ${err?.message || 'Không xác định'}`);
        }
      } else {
        setErrorMsg(`Định dạng file không hỗ trợ: ${file.name}`);
      }
    }

    setLoadingMsg(null);
    if (newPending.length > 0) {
      setPendingMenus(prev => [...prev, ...newPending]);
      setActivePendingIdx(0);
    }
  };

  const handleApplyManualMap = () => {
    if (manualSheets.length === 0) return;
    const sheet = manualSheets[0];
    const res = parseSheetWithMap(
      sheet.rows,
      manualMap,
      '',
      '',
      '',
      'man',
      manualFileName
    );
    if (res.menu) {
      setPendingMenus(prev => [...prev, res.menu!]);
      setManualSheets([]);
      setErrorMsg(null);
    } else {
      setErrorMsg(res.error || 'Ghép cột thủ công chưa khớp đủ 7 ngày.');
    }
  };

  const updatePendingField = (patch: Partial<WeeklyMenu>) => {
    setPendingMenus(prev =>
      prev.map((m, idx) => (idx === activePendingIdx ? { ...m, ...patch } : m))
    );
  };

  const updatePendingDay = (dayIdx: number, updater: (d: DayMenu) => DayMenu) => {
    setPendingMenus(prev =>
      prev.map((m, idx) => {
        if (idx !== activePendingIdx) return m;
        const nextNgay = m.ngay.map((d, dIdx) => (dIdx === dayIdx ? updater(d) : d));
        return { ...m, ngay: nextNgay };
      })
    );
  };

  const handleConfirmPending = () => {
    if (!activePending || !activePending.ncc) return;
    onSaveMenu(activePending);
    setPendingMenus(prev => prev.filter((_, idx) => idx !== activePendingIdx));
    setActivePendingIdx(0);
  };

  const handleConfirmAllPending = () => {
    const valid = pendingMenus.filter(m => Boolean(m.ncc));
    if (valid.length === 0) return;
    valid.forEach(m => onSaveMenu(m));
    setPendingMenus(prev => prev.filter(m => !m.ncc));
    setActivePendingIdx(0);
  };

  const handleDiscardPending = () => {
    setPendingMenus(prev => prev.filter((_, idx) => idx !== activePendingIdx));
    setActivePendingIdx(0);
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => {
          e.preventDefault();
          setIsDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-orange-500 bg-orange-50'
            : 'border-slate-300 bg-white hover:border-blue-900 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx,.xls,.ods,.csv,.png,.jpg,.jpeg,.webp,.pdf"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <div className="flex justify-center mb-3">
          <div className="w-12 h-12 rounded-full bg-blue-900/10 text-blue-900 flex items-center justify-center">
            <Upload className="w-6 h-6" />
          </div>
        </div>
        <h3 className="text-base font-semibold text-slate-800">
          Kéo thả hoặc bấm để tải lên thực đơn tuần của NCC
        </h3>
        <p className="text-sm text-slate-500 mt-1">
          Hỗ trợ nhiều file cùng lúc: Excel (.xlsx, .xls, .ods), CSV, Ảnh (PNG, JPG) hoặc PDF
        </p>
      </div>

      {loadingMsg && (
        <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-sm font-medium">
          {loadingMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Manual Column Mapping Fallback */}
      {manualSheets.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-300 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-orange-500" />
              Ghép cột thủ công cho file: {manualFileName}
            </h4>
            <button
              onClick={() => setManualSheets([])}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Đóng
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {[
              { label: 'Cột Ngày (Thứ 2..CN)', key: 'dayCol' as const },
              { label: 'Cột Món Sáng', key: 'sangMonCol' as const },
              { label: 'Cột TL Sáng', key: 'sangTlCol' as const },
              { label: 'Cột Món Trưa', key: 'truaMonCol' as const },
              { label: 'Cột TL Trưa', key: 'truaTlCol' as const },
              { label: 'Cột Món Tối', key: 'toiMonCol' as const },
              { label: 'Cột TL Tối', key: 'toiTlCol' as const },
            ].map(item => (
              <div key={item.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {item.label}
                </label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={manualMap[item.key]}
                  onChange={e =>
                    setManualMap(prev => ({ ...prev, [item.key]: Number(e.target.value) }))
                  }
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleApplyManualMap}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg"
          >
            Áp dụng ghép cột
          </button>
        </div>
      )}

      {/* Mandatory Verification Table: "Kiểm tra dữ liệu đã đọc" */}
      {activePending && (
        <div className="bg-white rounded-xl border-2 border-blue-900/20 shadow-md overflow-hidden">
          <div className="bg-[#141e42] text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Eye className="w-5 h-5 text-amber-400" />
                Kiểm tra dữ liệu đã đọc ({activePending.fileName || 'Thực đơn mới'})
              </h3>
              <p className="text-xs text-slate-300">
                Kiểm tra NCC, loại (mặn/chay) và sửa tay nếu cần. Bấm "Xác nhận & Lưu" để đưa vào kiểm định.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDiscardPending}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium flex items-center gap-1"
              >
                <X className="w-4 h-4" /> Huỷ
              </button>
              {pendingMenus.length > 1 && (
                <button
                  onClick={handleConfirmAllPending}
                  disabled={pendingMenus.some(m => !m.ncc)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Check className="w-4 h-4" /> Lưu tất cả ({pendingMenus.length})
                </button>
              )}
              <button
                onClick={handleConfirmPending}
                disabled={!activePending.ncc}
                className="px-4 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-1.5 shadow"
              >
                <Check className="w-4 h-4" /> Xác nhận & Lưu
              </button>
            </div>
          </div>

          {/* Multi-sheet / multi-file switcher */}
          {pendingMenus.length > 1 && (
            <div className="px-4 py-2 bg-slate-100 border-b border-slate-200 flex flex-wrap gap-2">
              {pendingMenus.map((pm, idx) => (
                <button
                  key={pm.id}
                  onClick={() => setActivePendingIdx(idx)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border ${
                    idx === activePendingIdx
                      ? 'bg-blue-900 text-white border-blue-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  #{idx + 1}: {pm.ncc || 'Chưa chọn NCC'} ({pm.loai === 'chay' ? 'Chay' : 'Mặn'})
                </button>
              ))}
            </div>
          )}

          {/* Uncertain NCC alert */}
          {!activePending.ncc && (
            <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              Chưa nhận diện được Nhà cung cấp từ file. Vui lòng chọn Nhà cung cấp bên dưới trước khi lưu!
            </div>
          )}

          {/* Metadata editor */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Nhà cung cấp <span className="text-rose-600">*</span>
              </label>
              <select
                value={activePending.ncc}
                onChange={e => updatePendingField({ ncc: e.target.value })}
                className={`w-full px-3 py-1.5 bg-white border rounded-lg text-sm font-medium ${
                  !activePending.ncc ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-300'
                }`}
              >
                <option value="">-- Chọn nhà cung cấp --</option>
                {nccList.map(n => (
                  <option key={n.code} value={n.code}>
                    {n.code} - {n.name} ({n.ktx})
                  </option>
                ))}
              </select>
              {(() => {
                const existing = menus.find(
                  m =>
                    m.ncc === activePending.ncc &&
                    m.loai === activePending.loai &&
                    (!activePending.tuanTu || m.tuanTu === activePending.tuanTu)
                );
                if (!existing) return null;
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingMenus(prev =>
                        prev.map((pm, idx) => (idx === activePendingIdx ? existing : pm))
                      );
                    }}
                    className="mt-1.5 text-[11px] text-blue-900 hover:underline font-semibold"
                  >
                    ↻ Nạp thực đơn đã lưu của {existing.ncc} ({existing.tuanTu})
                  </button>
                );
              })()}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Từ ngày (dd/mm/yyyy)</label>
              <input
                type="text"
                value={activePending.tuanTu}
                onChange={e => updatePendingField({ tuanTu: e.target.value })}
                placeholder="09/11/2026"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Đến ngày (dd/mm/yyyy)</label>
              <input
                type="text"
                value={activePending.tuanDen}
                onChange={e => updatePendingField({ tuanDen: e.target.value })}
                placeholder="15/11/2026"
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Loại thực đơn</label>
              <select
                value={activePending.loai}
                onChange={e => updatePendingField({ loai: e.target.value as 'man' | 'chay' })}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-sm font-medium"
              >
                <option value="man">Thực đơn Mặn</option>
                <option value="chay">Thực đơn Chay</option>
              </select>
            </div>
          </div>

          {/* Anomalies list */}
          {activePending.batThuongFile.length > 0 && (
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-900 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Phát hiện bất thường trong file:
              </div>
              <ul className="list-disc list-inside pl-1">
                {activePending.batThuongFile.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 7 days x 3 shifts x 7 rows editable table */}
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-xs border-collapse">
              <thead className="bg-slate-100 sticky top-0 z-10 text-slate-700">
                <tr>
                  <th className="p-2 border border-slate-200 w-24">Ngày</th>
                  <th className="p-2 border border-slate-200 w-16">Dòng</th>
                  <th className="p-2 border border-slate-200">Bữa Sáng (Món / Thành phần)</th>
                  <th className="p-2 border border-slate-200">Bữa Trưa (Món)</th>
                  <th className="p-2 border border-slate-200 w-28">TL Trưa</th>
                  <th className="p-2 border border-slate-200">Bữa Tối (Món)</th>
                  <th className="p-2 border border-slate-200 w-28">TL Tối</th>
                </tr>
              </thead>
              <tbody>
                {activePending.ngay.map((day, dIdx) =>
                  [0, 1, 2, 3, 4, 5, 6].map(rIdx => (
                    <tr key={`${day.ma}-${rIdx}`} className="hover:bg-slate-50">
                      {rIdx === 0 && (
                        <td
                          rowSpan={7}
                          className="p-2 border border-slate-200 font-semibold text-center bg-slate-50/70 align-top"
                        >
                          <div className="text-blue-900">{day.ma}</div>
                          <div className="text-[11px] text-slate-500 font-normal">{day.ngayThang}</div>
                        </td>
                      )}
                      <td className="p-1.5 border border-slate-200 text-center text-slate-500 font-mono">
                        r{rIdx + 1}
                      </td>
                      {rIdx === 0 ? (
                        <td rowSpan={7} className="p-2 border border-slate-200 align-top space-y-1.5">
                          <input
                            type="text"
                            value={day.sang.mon}
                            onChange={e =>
                              updatePendingDay(dIdx, d => ({
                                ...d,
                                sang: { ...d.sang, mon: e.target.value }
                              }))
                            }
                            placeholder="Tên món sáng"
                            className="w-full px-2 py-1 border border-slate-200 rounded font-medium"
                          />
                          <textarea
                            rows={4}
                            value={day.sang.thanhPhan}
                            onChange={e =>
                              updatePendingDay(dIdx, d => ({
                                ...d,
                                sang: { ...d.sang, thanhPhan: e.target.value }
                              }))
                            }
                            placeholder="Thành phần & định lượng..."
                            className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] text-slate-600"
                          />
                        </td>
                      ) : null}
                      <td className="p-1 border border-slate-200">
                        <input
                          type="text"
                          value={day.trua[rIdx]?.ten || ''}
                          onChange={e =>
                            updatePendingDay(dIdx, d => {
                              const next = [...d.trua];
                              next[rIdx] = { ...next[rIdx], ten: e.target.value };
                              return { ...d, trua: next };
                            })
                          }
                          className="w-full px-1.5 py-1 rounded hover:bg-white focus:bg-white focus:outline-blue-500"
                        />
                      </td>
                      <td className="p-1 border border-slate-200">
                        <input
                          type="text"
                          value={day.trua[rIdx]?.tl || ''}
                          onChange={e =>
                            updatePendingDay(dIdx, d => {
                              const next = [...d.trua];
                              next[rIdx] = { ...next[rIdx], tl: e.target.value };
                              return { ...d, trua: next };
                            })
                          }
                          className="w-full px-1.5 py-1 rounded text-slate-600"
                        />
                      </td>
                      <td className="p-1 border border-slate-200">
                        <input
                          type="text"
                          value={day.toi[rIdx]?.ten || ''}
                          onChange={e =>
                            updatePendingDay(dIdx, d => {
                              const next = [...d.toi];
                              next[rIdx] = { ...next[rIdx], ten: e.target.value };
                              return { ...d, toi: next };
                            })
                          }
                          className="w-full px-1.5 py-1 rounded hover:bg-white focus:bg-white focus:outline-blue-500"
                        />
                      </td>
                      <td className="p-1 border border-slate-200">
                        <input
                          type="text"
                          value={day.toi[rIdx]?.tl || ''}
                          onChange={e =>
                            updatePendingDay(dIdx, d => {
                              const next = [...d.toi];
                              next[rIdx] = { ...next[rIdx], tl: e.target.value };
                              return { ...d, toi: next };
                            })
                          }
                          className="w-full px-1.5 py-1 rounded text-slate-600"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Saved Menus List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-900" />
            Danh sách thực đơn đã lưu ({menus.length})
          </h3>
        </div>
        {menus.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Chưa có thực đơn nào được lưu. Hãy tải file thực đơn tuần ở trên.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {menus.map(m => {
              const nccInfo = nccList.find(n => n.code === m.ncc);
              return (
                <div
                  key={m.id}
                  className="p-4 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-blue-900 text-white text-xs font-bold">
                        {m.ncc}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {nccInfo?.name || m.ncc}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          m.loai === 'chay'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {m.loai === 'chay' ? 'Thực đơn Chay' : 'Thực đơn Mặn'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Tuần: <strong className="text-slate-700">{m.tuanTu} – {m.tuanDen}</strong>
                      {m.fileName && <span className="ml-2">• File: {m.fileName}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPendingMenus([m]);
                        setActivePendingIdx(0);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-medium text-slate-700 flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Xem / Sửa
                    </button>
                    <button
                      onClick={() => onDeleteMenu(m.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-xs font-medium text-rose-600 flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Xoá
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
