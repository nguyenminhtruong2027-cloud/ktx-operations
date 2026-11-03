// src/meals/components/SupplierFileArchive.tsx
// Quản lý & tải file thực đơn THEO NỘ CỦA NCC:
// • Upload Zone đa định dạng kèm menu chọn [NCC] + [Tuần áp dụng]
// • Bảng Lưu trữ File theo NCC: NCC | Tên file | Tuần | Ngày giờ tải | Trạng thái
// • Thao tác nhanh: [Kích hoạt kiểm định - không reset] [Xem trước] [Tải về JSON] [Xóa]

import React from 'react';
import { Upload, Trash2, Eye, Download, Filter, FileSpreadsheet } from 'lucide-react';
import type { MealVendor, UploadedMenuFile } from '../types';

export interface SupplierFileArchiveProps {
  vendors: MealVendor[];
  archives: UploadedMenuFile[];
  uploadVendor: string;
  onUploadVendor: (id: string) => void;
  uploadWeek: string;
  onUploadWeek: (week: string) => void;
  weekOptions: string[];
  onProcessUpload: (file: File) => void;
  onActivate: (id: string, jumpToInspection: boolean) => void;
  onPreview: (f: UploadedMenuFile) => void;
  onDownload: (f: UploadedMenuFile) => void;
  onDelete: (f: UploadedMenuFile) => void;
  filter: string;
  onFilter: (v: string) => void;
  jumpToInspection?: boolean;
}

const FILE_TYPE_BADGE: Record<string, string> = {
  excel: 'bg-emerald-100 text-emerald-800',
  csv: 'bg-blue-100 text-blue-800',
  image: 'bg-purple-100 text-purple-800',
  manual: 'bg-amber-100 text-amber-800'
};

export const SupplierFileArchive: React.FC<SupplierFileArchiveProps> = ({
  vendors,
  archives,
  uploadVendor,
  onUploadVendor,
  uploadWeek,
  onUploadWeek,
  weekOptions,
  onProcessUpload,
  onActivate,
  onPreview,
  onDownload,
  onDelete,
  filter,
  onFilter,
  jumpToInspection = false
}) => {
  // sắp xếp: file mới nhất lên đầu
  const visible = archives
    .filter(f => filter === 'all' || f.vendorId === filter)
    .slice()
    .reverse();

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-4">
      <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
        <div className="p-2 bg-blue-50 rounded-xl"><FileSpreadsheet className="w-4 h-4 text-blue-700" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-slate-900">
            Quản lý & Tải file thực đơn theo NCC {jumpToInspection && <span className="text-blue-700">(Tab Báo cáo Suất ăn)</span>}
          </h3>
          <p className="text-[11px] text-slate-400">
            Chọn đích danh NCC + tuần áp dụng, tải file (Excel/ODS/CSV/TXT/Ảnh/PDF) — file mới thành trạng thái active hiện tại, không reset dữ liệu cũ
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        <label className="text-[10px] font-black text-slate-500 uppercase">
          Nhà cung cấp *
          <select
            value={uploadVendor}
            onChange={(e) => onUploadVendor(e.target.value)}
            className="mt-1 w-full px-2.5 py-2 border-2 border-slate-200 rounded-xl text-xs font-bold bg-white focus:border-(--vc-brand-2) focus:outline-none"
          >
            {vendors.map(v => <option key={v.id} value={v.id}>{v.name} ({v.code})</option>)}
          </select>
        </label>
        <label className="text-[10px] font-black text-slate-500 uppercase">
          Tuần áp dụng * (bắt đầu Thứ 2)
          <select
            value={uploadWeek}
            onChange={(e) => onUploadWeek(e.target.value)}
            className="mt-1 w-full px-2.5 py-2 border-2 border-slate-200 rounded-xl text-xs font-bold bg-white focus:border-(--vc-brand-2) focus:outline-none"
          >
            {weekOptions.map((w, i) => (
              <option key={w} value={w}>{i === 0 ? '(tuần trước) ' : i === 1 ? '(hiện tại) ' : ''}Tuần: {w}</option>
            ))}
          </select>
        </label>
        <label className="text-[10px] font-black text-slate-500 uppercase">
          File thực đơn *
          <input
            type="file"
            accept=".xlsx,.xls,.ods,.csv,.txt,.pdf,.png,.jpg,.jpeg"
            onChange={(e) => {
              const files = e.target.files;
              if (files && files.length > 0) onProcessUpload(files[0]);
              e.target.value = '';
            }}
            className="mt-1 w-full text-xs text-slate-700 border-2 border-dashed border-slate-300 rounded-xl px-2.5 py-1.5 cursor-pointer file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-(--vc-brand-2) file:text-white file:text-xs file:font-bold"
          />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {['.xlsx', '.xls', '.ods', '.csv', '.txt', '.pdf', '.png', '.jpg'].map(ext => (
          <span key={ext} className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-black text-slate-600">{ext}</span>
        ))}
        <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-[10px] font-black text-blue-800">TXT: mỗi dòng 1 món, mặn/chay tự phân loại</span>
      </div>

      {/* Bảng Lưu trữ File theo NCC */}
      <div className="rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
          <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide">
            Danh sách lưu trữ file ({visible.length}/{archives.length})
          </span>
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filter}
              onChange={(e) => onFilter(e.target.value)}
              className="px-2 py-1.5 border border-slate-200 rounded-lg text-[11px] font-bold bg-white text-slate-700"
            >
              <option value="all">Tất cả NCC ({archives.length})</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({archives.filter(f => f.vendorId === v.id).length})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-blue-50 uppercase text-[10px] font-bold">
                <th className="p-2.5 text-left">Nhà cung cấp</th>
                <th className="p-2.5 text-left">Tên file</th>
                <th className="p-2.5 text-left">Tuần áp dụng</th>
                <th className="p-2.5 text-left">Ngày giờ tải</th>
                <th className="p-2.5 text-center">Trạng thái</th>
                <th className="p-2.5 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400 italic">Chưa có file nào — tải lên bằng khung phía trên.</td></tr>
              ) : visible.map(f => {
                const vendor = vendors.find(v => v.id === f.vendorId);
                return (
                  <tr key={f.id} className="hover:bg-blue-50/40 transition">
                    <td className="p-2.5">
                      <div className="flex items-center space-x-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-blue-950 text-amber-300 font-black text-[9px]">{vendor?.code || '?'}</span>
                        <span className="font-bold text-slate-800">{f.vendorName || vendor?.name || '?'}</span>
                      </div>
                    </td>
                    <td className="p-2.5 max-w-[230px]">
                      <div className="font-semibold text-slate-700 truncate" title={f.fileName}>{f.fileName}</div>
                      <div className="flex items-center space-x-1">
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${FILE_TYPE_BADGE[f.fileType] || 'bg-slate-100 text-slate-600'}`}>{f.fileType}</span>
                        <span className="text-[9px] text-slate-400">{f.menu.length * 3} ca</span>
                      </div>
                    </td>
                    <td className="p-2.5 text-slate-600 font-semibold whitespace-nowrap">{f.startDate || '—'}</td>
                    <td className="p-2.5 text-slate-500 whitespace-nowrap">{f.uploadedAt}</td>
                    <td className="p-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${f.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {f.isActive ? 'ĐANG KIỂM ĐỊNH' : 'Đã lưu'}
                      </span>
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {!f.isActive && (
                          <button
                            onClick={() => onActivate(f.id, jumpToInspection)}
                            className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black transition"
                            title={jumpToInspection ? 'Load thẳng file lên bảng Kiểm định' : 'Đưa file lên bảng kiểm định (không reset)'}
                          >
                            Kích hoạt
                          </button>
                        )}
                        {f.isActive && (
                          <button
                            onClick={() => onActivate(f.id, true)}
                            className="px-2 py-1 rounded-lg bg-blue-950 text-amber-300 text-[10px] font-black hover:brightness-125 transition"
                            title="File đang active — mở lên màn Kiểm định"
                          >
                            Kiểm định
                          </button>
                        )}
                        <button onClick={() => onPreview(f)} className="p-1 text-slate-400 hover:text-blue-700" title="Xem trước">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDownload(f)} className="p-1 text-slate-400 hover:text-blue-700" title="Tải về (JSON)">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => onDelete(f)} className="p-1 text-slate-300 hover:text-rose-600" title="Xóa">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SupplierFileArchive;
