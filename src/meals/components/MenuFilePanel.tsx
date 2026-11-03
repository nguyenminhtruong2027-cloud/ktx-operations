// src/meals/components/MenuFilePanel.tsx
// PANEL QUẢN LÝ TỆP THỰC ĐƠN DÙNG CHUNG (mở được từ MỌI tab):
// • Danh sách file đã tải lên, phân loại theo TUẦN và NHÀ CUNG CẤP
// • Chọn tệp (đa định dạng) + đích danh NCC + tuần áp dụng
// • Xem thông tin: Tên file · Ngày tải · NCC áp dụng · Trạng thái
// • Nút "Áp dụng file này" — nạp thẳng dữ liệu vào slot của NCC tương ứng

import React, { useEffect, useMemo, useState } from 'react';
import {
  X, FileSpreadsheet, Eye, Trash2, CheckCircle2, FolderOpen, Filter
} from 'lucide-react';
import type { MealVendor, UploadedMenuFile } from '../types';

export interface MenuFilePanelProps {
  open: boolean;
  onClose: () => void;
  archives: UploadedMenuFile[];
  vendors: MealVendor[];
  weekOptions: string[];
  defaultWeek: string;
  onUploadFile: (file: File, vendorId: string, weekStart: string) => void;
  onApplyFile: (fileId: string) => void;
  onPreviewFile: (file: UploadedMenuFile) => void;
  onDeleteFile: (file: UploadedMenuFile) => void;
}

const FILE_TYPE_BADGE: Record<string, string> = {
  excel: 'bg-emerald-100 text-emerald-800',
  csv: 'bg-blue-100 text-blue-800',
  image: 'bg-purple-100 text-purple-800',
  manual: 'bg-amber-100 text-amber-800'
};

const weekLabel = (file: UploadedMenuFile) => {
  const start = file.startDate || '';
  return start ? `Tuần từ ${start}` : (file.dateRange || 'Chưa rõ tuần');
};

export const MenuFilePanel: React.FC<MenuFilePanelProps> = ({
  open,
  onClose,
  archives,
  vendors,
  weekOptions,
  defaultWeek,
  onUploadFile,
  onApplyFile,
  onPreviewFile,
  onDeleteFile
}) => {
  const [uploadVendorId, setUploadVendorId] = useState<string>(vendors[0]?.id || 'tam-phuong');
  const [uploadWeek, setUploadWeek] = useState<string>(defaultWeek);
  const [filterVendor, setFilterVendor] = useState<string>('all');
  const [filterWeek, setFilterWeek] = useState<string>('all');

  // Đóng panel bằng phím Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Phân loại: Tuần (giảm dần) → NCC → file (mới nhất trước)
  const groups = useMemo(() => {
    const filtered = archives.filter(f =>
      (filterVendor === 'all' || f.vendorId === filterVendor) &&
      (filterWeek === 'all' || (f.startDate || '') === filterWeek)
    );
    const weekMap = new Map<string, UploadedMenuFile[]>();
    filtered.forEach(f => {
      const key = weekLabel(f);
      const list = weekMap.get(key) || [];
      list.push(f);
      weekMap.set(key, list);
    });
    return Array.from(weekMap.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([week, files]) => {
        const vendorMap = new Map<string, UploadedMenuFile[]>();
        files
          .slice()
          .sort((a, b) => (a.id > b.id ? -1 : 1))
          .forEach(f => {
            const key = f.vendorName || f.vendorId || '?';
            const list = vendorMap.get(key) || [];
            list.push(f);
            vendorMap.set(key, list);
          });
        return { week, vendors: Array.from(vendorMap.entries()) };
      });
  }, [archives, filterVendor, filterWeek]);

  const totalShown = groups.reduce((acc, g) => acc + g.vendors.reduce((a, [, files]) => a + files.length, 0), 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex justify-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-(--vc-brand-1) via-(--vc-brand-2) to-(--vc-brand-3) text-white">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-white/15">
              <FolderOpen className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold tracking-tight">QUẢN LÝ TỆP THỰC ĐƠN</h2>
              <p className="text-[10px] text-blue-100">
                {archives.length} file trong kho • mở từ mọi tab • áp dụng trực tiếp vào slot NCC
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/15 transition" title="Đóng (Esc)">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Khu chọn & tải tệp */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/70 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="text-[10px] font-black text-slate-500 uppercase">
              Nhà cung cấp áp dụng
              <select
                value={uploadVendorId}
                onChange={(e) => setUploadVendorId(e.target.value)}
                className="mt-1 w-full px-2.5 py-2 border-2 border-slate-200 rounded-xl text-xs font-bold bg-white focus:border-(--vc-brand-2) focus:outline-none"
              >
                {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.code})</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black text-slate-500 uppercase">
              Tuần áp dụng
              <select
                value={uploadWeek}
                onChange={(e) => setUploadWeek(e.target.value)}
                className="mt-1 w-full px-2.5 py-2 border-2 border-slate-200 rounded-xl text-xs font-bold bg-white focus:border-(--vc-brand-2) focus:outline-none"
              >
                {weekOptions.map(w => <option key={w} value={w}>{w === defaultWeek ? '(hiện tại) ' : ''}Tuần: {w}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-black text-slate-500 uppercase">
              Chọn tệp thực đơn
              <input
                type="file"
                accept=".xlsx,.xls,.ods,.csv,.txt,.pdf,.png,.jpg,.jpeg"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) onUploadFile(files[0], uploadVendorId, uploadWeek);
                  e.target.value = '';
                }}
                className="mt-1 w-full text-xs text-slate-700 border-2 border-dashed border-slate-300 rounded-xl px-2.5 py-1.5 cursor-pointer file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-(--vc-brand-2) file:text-white file:text-xs file:font-bold"
              />
            </label>
          </div>

          {/* Bộ lọc */}
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filterVendor}
              onChange={(e) => setFilterVendor(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] font-bold bg-white text-slate-700"
            >
              <option value="all">Tất cả NCC</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <select
              value={filterWeek}
              onChange={(e) => setFilterWeek(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] font-bold bg-white text-slate-700"
            >
              <option value="all">Tất cả tuần</option>
              {weekOptions.map(w => <option key={w} value={w}>Tuần: {w}</option>)}
            </select>
            <span className="text-[10px] text-slate-400 font-semibold">Đang hiển thị {totalShown} file</span>
          </div>
        </div>

        {/* Danh sách phân loại: Tuần → NCC */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {groups.length === 0 && (
            <div className="p-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs space-y-1">
              <FileSpreadsheet className="w-8 h-8 mx-auto text-slate-300" />
              <div className="font-bold text-slate-600">Chưa có tệp thực đơn nào</div>
              <div>Dùng khung "Chọn tệp thực đơn" phía trên để tải lên — file được gắn riêng cho NCC đã chọn.</div>
            </div>
          )}

          {groups.map(group => (
            <div key={group.week} className="space-y-3">
              {/* Nhóm tuần */}
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-lg bg-(--vc-brand-2) text-white text-[10px] font-black uppercase tracking-wide">
                  {group.week}
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {group.vendors.map(([vendorName, files]) => (
                <div key={vendorName} className="space-y-1.5">
                  {/* Nhóm NCC */}
                  <div className="flex items-center space-x-1.5 pl-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-(--vc-accent-2)" />
                    <span className="text-[11px] font-black text-slate-700">{vendorName}</span>
                    <span className="text-[9px] text-slate-400">({files.length} file)</span>
                  </div>

                  {files.map(f => (
                    <div key={f.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-white hover:shadow-sm transition">
                      <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                        <div className="p-1.5 rounded-lg bg-slate-100">
                          <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate max-w-[220px]" title={f.fileName}>{f.fileName}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${FILE_TYPE_BADGE[f.fileType] || 'bg-slate-100 text-slate-600'}`}>
                              {f.fileType}
                            </span>
                          </div>
                          <div className="text-[9px] text-slate-400">
                            Tải: {f.uploadedAt} • {f.dateRange} • {f.menu.length * 3} ca
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        {f.isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[9px] font-black flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>ĐANG ÁP DỤNG</span>
                          </span>
                        )}
                        <button
                          onClick={() => onApplyFile(f.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-white text-[10px] font-black hover:brightness-110 transition active:scale-95"
                          title="Nạp thẳng dữ liệu file này vào slot của NCC tương ứng"
                        >
                          Áp dụng file này
                        </button>
                        <button onClick={() => onPreviewFile(f)} className="p-1.5 text-slate-400 hover:text-blue-700" title="Xem thông tin / xem trước">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => onDeleteFile(f)} className="p-1.5 text-slate-300 hover:text-rose-600" title="Xóa file (có xác nhận)">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="text-[10px] text-slate-400">
            Dữ liệu lưu trong CSDL supplier_menus — áp dụng file chỉ thay slot của NCC đó, không ảnh hưởng NCC khác.
          </div>
          <button
            onClick={onClose}
            className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuFilePanel;
