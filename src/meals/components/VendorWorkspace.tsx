// src/meals/components/VendorWorkspace.tsx
// KHÔNG GIAN NHÀ CUNG CẤP: quản lý thực đơn riêng theo từng NCC —
// nhập/tải lên thực đơn, lịch sử file, và công cụ kiểm tra-đối chiếu định lượng (gram/ml)

import React, { useMemo, useState } from 'react';
import {
  Upload, FileSpreadsheet, Trash2, Eye, ShieldCheck, AlertTriangle,
  RefreshCw, Building2, CalendarDays, Loader2, ArrowRight, XCircle
} from 'lucide-react';
import { SupplierChips } from './SupplierChips';
import {
  getVendorWeekAsDayWeeklyMenu,
  supplierMenuStats,
  type VendorPortionCheckResult
} from '../supplierMenuStore';
import type {
  DayWeeklyMenu,
  MealVendor,
  PortionRule,
  SupplierMenuDB,
  UploadedMenuFile
} from '../types';

interface VendorWorkspaceProps {
  vendor: MealVendor;
  vendors: MealVendor[];
  onSelectVendor: (vendorId: string) => void;
  weekStart: string;
  supplierMenus: SupplierMenuDB;
  vendorArchives: UploadedMenuFile[];
  allArchivesCount: number;
  onOpenUploadWizard: (vendorId: string) => void;
  onSelectFile: (fileId: string) => void;
  onPreviewFile: (file: UploadedMenuFile) => void;
  onDeleteFile: (file: UploadedMenuFile) => void;
  onGoToReport: (vendorId: string) => void;
  onRunPortionCheck: (vendorId: string, source: 'week' | string) => VendorPortionCheckResult | null;
  onToast: (msg: string) => void;
}

const FILE_TYPE_BADGE: Record<string, string> = {
  excel: 'bg-emerald-100 text-emerald-800',
  csv: 'bg-blue-100 text-blue-800',
  image: 'bg-purple-100 text-purple-800',
  manual: 'bg-amber-100 text-amber-800'
};

const SHIFT_COLS = [
  { key: 'breakfast' as const, label: 'Sáng' },
  { key: 'lunch' as const, label: 'Trưa' },
  { key: 'dinner' as const, label: 'Tối' }
];

export const VendorWorkspace: React.FC<VendorWorkspaceProps> = ({
  vendor,
  vendors,
  onSelectVendor,
  weekStart,
  supplierMenus,
  vendorArchives,
  allArchivesCount,
  onOpenUploadWizard,
  onSelectFile,
  onPreviewFile,
  onDeleteFile,
  onGoToReport,
  onRunPortionCheck,
  onToast
}) => {
  const [checkSource, setCheckSource] = useState<'week' | string>('week');
  const [checkResult, setCheckResult] = useState<VendorPortionCheckResult | null>(null);
  const [checking, setChecking] = useState(false);

  const stats = useMemo(
    () => supplierMenuStats(supplierMenus, vendor.id, weekStart),
    [supplierMenus, vendor.id, weekStart]
  );

  const vendorWeekMenu: DayWeeklyMenu[] = useMemo(
    () => getVendorWeekAsDayWeeklyMenu(supplierMenus, vendor.id, weekStart),
    [supplierMenus, vendor.id, weekStart]
  );

  const lastCheck = stats.lastCheck;

  const runCheck = () => {
    setChecking(true);
    try {
      const result = onRunPortionCheck(vendor.id, checkSource);
      if (result) {
        setCheckResult(result);
        onToast(result.summary.ok
          ? `Kiểm tra định lượng ${vendor.name}: đạt — ${result.warnings.length} cảnh báo nhẹ.`
          : `Kiểm tra định lượng ${vendor.name}: CÓ LỖI — ${result.warnings.length} cảnh báo, ${result.duplicates.length} món trùng.`);
      } else {
        onToast('Không kiểm được nguồn này.');
      }
    } finally {
      setChecking(false);
    }
  };

  const renderWeekTable = (menu: DayWeeklyMenu[]) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left text-[10px] font-black text-slate-500 uppercase p-1.5">Ngày</th>
            {SHIFT_COLS.map(c => (
              <th key={c.key} className="text-[10px] font-black text-slate-500 uppercase p-1.5">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {menu.map((day, dayIdx) => (
            <tr key={dayIdx} className={dayIdx % 2 === 0 ? 'bg-slate-50/60' : ''}>
              <td className="p-1.5">
                <div className="text-[11px] font-bold text-slate-800">{day.dayOfWeek}</div>
                <div className="text-[9px] text-slate-400">{day.dateStr}</div>
              </td>
              {SHIFT_COLS.map(c => {
                const detail = day[c.key];
                const hasData = detail.meatDishes.length > 0 || detail.vegDishes.length > 0;
                return (
                  <td key={c.key} className="p-1 align-top w-1/3">
                    <div className={`rounded-lg p-1.5 text-[9px] border ${hasData ? 'border-slate-200 bg-white' : 'border-red-200 bg-red-50'}`}>
                      {hasData ? (
                        <>
                          {detail.meatDishes.slice(0, 3).map((d, i) => (
                            <div key={`m${i}`} className="text-slate-700 leading-tight truncate" title={d}>• {d}</div>
                          ))}
                          {detail.meatDishes.length > 3 && <div className="text-slate-400">+{detail.meatDishes.length - 3} món mặn nữa</div>}
                          {detail.vegDishes.slice(0, 2).map((d, i) => (
                            <div key={`v${i}`} className="text-emerald-700 leading-tight truncate" title={d}>• {d}</div>
                          ))}
                          {detail.vegDishes.length > 2 && <div className="text-emerald-400">+{detail.vegDishes.length - 2} món chay nữa</div>}
                        </>
                      ) : (
                        <span className="text-red-400 italic">Trống — chưa có thực đơn</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header: chọn NCC + trạng thái */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-50 rounded-xl"><Building2 className="w-5 h-5 text-blue-700" /></div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                Không gian Nhà Cung Cấp · {vendor.name} ({vendor.code})
              </h3>
              <p className="text-[11px] text-slate-400">
                NCC/Quản lý chủ động nhập thực đơn, lưu lịch sử, kiểm tra định lượng trước khi vào báo cáo tổng hợp
              </p>
            </div>
          </div>
          {lastCheck && (
            <span className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border ${
              lastCheck.ok ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              Kiểm định gần nhất: {lastCheck.ok ? 'Đạt' : 'Cần sửa'} ({new Date(lastCheck.checkedAt).toLocaleString('vi-VN')})
            </span>
          )}
        </div>

        <SupplierChips
          vendors={vendors}
          selectedVendorId={vendor.id}
          onSelectVendor={onSelectVendor}
          showPortionCount={true}
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Ca đã lưu (tuần này)</div>
            <div className="text-lg font-black text-slate-900">{stats.entryCount}/21</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">File thực đơn</div>
            <div className="text-lg font-black text-slate-900">{vendorArchives.length}</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Tuần có dữ liệu</div>
            <div className="text-lg font-black text-slate-900">{stats.weeks}</div>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-[10px] text-slate-400 font-bold uppercase">Nguồn dữ liệu</div>
            <div className="text-[11px] font-black text-teal-800 mt-1">{stats.sources.join(', ') || 'Chưa có'}</div>
          </div>
        </div>
      </div>

      {/* Nhập / tải lên thực đơn */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Upload className="w-4 h-4 text-amber-600" />
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Nhập / Tải lên thực đơn cho {vendor.name}</h4>
              <p className="text-[10px] text-slate-400">Ảnh (JPG/PNG/WEBP), PDF, Excel (.xlsx/.xls), CSV, .txt — kết quả đồng bộ thẳng vào CSDL chung</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenUploadWizard(vendor.id)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
          >
            <Upload className="w-4 h-4" />
            <span>Tải lên thực đơn</span>
          </button>
        </div>
      </div>

      {/* Lịch sử file thực đơn */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h4 className="font-extrabold text-sm text-slate-900">Lịch sử file thực đơn · {vendor.name}</h4>
            <p className="text-[10px] text-slate-400">{vendorArchives.length} file của NCC này (trong tổng {allArchivesCount} file hệ thống) — dùng đối chiếu đa tuần</p>
          </div>
        </div>

        {vendorArchives.length === 0 ? (
          <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs space-y-1">
            <FileSpreadsheet className="w-6 h-6 mx-auto text-slate-300" />
            Chưa có file thực đơn nào của {vendor.name}.
          </div>
        ) : (
          <div className="space-y-2">
            {vendorArchives.map(f => (
              <div key={f.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${FILE_TYPE_BADGE[f.fileType] || 'bg-slate-100 text-slate-700'}`}>
                    {f.fileType}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-900 truncate" title={f.fileName}>{f.fileName}</div>
                    <div className="text-[10px] text-slate-400">{f.dateRange} • {f.uploadedAt}</div>
                  </div>
                </div>
                {f.isActive && <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-[9px] font-black rounded self-start sm:self-auto">ĐANG ÁP DỤNG</span>}
                <div className="flex items-center space-x-1.5 shrink-0">
                  <button onClick={() => onPreviewFile(f)} className="p-1.5 text-slate-400 hover:text-slate-700" title="Xem trước">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onSelectFile(f.id)}
                    className="px-2 py-1 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-[10px] font-bold transition"
                  >
                    Nạp vào tuần
                  </button>
                  <button onClick={() => onDeleteFile(f)} className="p-1.5 text-slate-300 hover:text-rose-600" title="Xóa file">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Công cụ kiểm tra & đối chiếu định lượng */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Kiểm tra & Đối chiếu định lượng (gram/ml)</h4>
              <p className="text-[10px] text-slate-400">So dish-level với ngưỡng chuẩn: món chính ≥75g · phụ ≥30g · rau ≥70g · canh ≥250ml · cơm ≥280g + quét 23 món cấm mùa hè + món trùng</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <select
              value={checkSource}
              onChange={e => { setCheckSource(e.target.value); setCheckResult(null); }}
              className="px-2.5 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700"
            >
              <option value="week">Tuần hiện tại ({new Date(weekStart).toLocaleDateString('vi-VN')})</option>
              {vendorArchives.map(f => (
                <option key={f.id} value={f.id}>{f.fileName}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={runCheck}
              disabled={checking}
              className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 disabled:opacity-60"
            >
              {checking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Kiểm tra định lượng</span>
            </button>
          </div>
        </div>

        {checkResult ? (
          <div className="space-y-3">
            {/* Tổng quan */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div className={`p-3 rounded-xl border text-center ${checkResult.score >= 80 ? 'bg-emerald-50 border-emerald-200' : checkResult.score >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="text-[10px] font-bold text-slate-500 uppercase">Điểm tuần</div>
                <div className="text-2xl font-black text-slate-900">{checkResult.score}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Cảnh báo</div>
                <div className="text-2xl font-black text-amber-700">{checkResult.warnings.length}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Món trùng</div>
                <div className="text-2xl font-black text-rose-600">{checkResult.duplicates.length}</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase">Kết luận</div>
                <div className={`text-sm font-black mt-1 ${checkResult.summary.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {checkResult.summary.ok ? 'ĐẠT — đưa vào báo cáo được' : 'CHƯA ĐẠT — cần chỉnh'}
                </div>
                <div className="text-[9px] text-slate-400">Nguồn: {checkResult.sourceLabel}</div>
              </div>
            </div>

            {/* Cảnh báo chi tiết */}
            {checkResult.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 max-h-56 overflow-y-auto space-y-1.5">
                <div className="flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-[10px] font-black text-amber-800 uppercase">Chi tiết vi phạm ({checkResult.warnings.length})</span>
                </div>
                {checkResult.warnings.map((w, i) => (
                  <div key={i} className="text-[10px] leading-snug text-amber-900 border-b border-amber-100/70 pb-1 last:border-0">
                    <span className={`font-black ${w.severity === 'error' ? 'text-rose-600' : 'text-amber-600'}`}>
                      {w.severity === 'error' ? '● LỖI ' : '● '}{w.ruleTag}:
                    </span>{' '}
                    <b>{w.dishName}</b> — {w.dayShift} — {w.message}
                  </div>
                ))}
              </div>
            )}

            {/* Món trùng */}
            {checkResult.duplicates.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 max-h-44 overflow-y-auto space-y-1.5">
                <div className="flex items-center space-x-1.5">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-[10px] font-black text-rose-800 uppercase">Món trùng với các file khác ({checkResult.duplicates.length})</span>
                </div>
                {checkResult.duplicates.map((d, i) => (
                  <div key={i} className="text-[10px] text-rose-900 leading-snug">
                    <b>{d.dishName}</b> — xuất hiện {d.totalCount} lần tại {d.occurrences.map(o => `${o.dayOfWeek} (${o.shift})`).slice(0, 4).join(', ')}
                    {d.totalCount > 4 ? '...' : ''}
                  </div>
                ))}
              </div>
            )}

            {/* Bảng tuần của nguồn kiểm */}
            <div className="rounded-xl border border-slate-200 p-3">
              <div className="text-[10px] font-black text-slate-500 uppercase mb-2">Thực đơn nguồn kiểm ({checkResult.sourceLabel})</div>
              {renderWeekTable(checkResult.weekMenu)}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => { onGoToReport(vendor.id); onToast(`Đã chuyển tới Báo cáo để chỉnh món của ${vendor.name}`); }}
                className="px-3.5 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
              >
                <span>Vào Báo cáo chỉnh món / đưa vào tổng hợp</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs space-y-1">
            <ShieldCheck className="w-6 h-6 mx-auto text-slate-300" />
            Chọn nguồn kiểm (tuần hiện tại hoặc 1 file trong lịch sử) rồi bấm <b>Kiểm tra định lượng</b>.<br />
            Kết quả được lưu vào CSDL để báo cáo tổng hợp hiển thị trạng thái "Cân định lượng".
          </div>
        )}
      </div>

      {/* Bảng tuần hiện tại của NCC */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h4 className="font-extrabold text-sm text-slate-900">Thực đơn {vendor.name} · tuần hiện tại</h4>
            <p className="text-[10px] text-slate-400">Nguồn CSDL supplier_menus — 1 nguồn duy nhất dùng chung với báo cáo</p>
          </div>
          <CalendarDays className="w-4 h-4 text-slate-400" />
        </div>
        {renderWeekTable(vendorWeekMenu)}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => onGoToReport(vendor.id)}
            className="px-3 py-1.5 border border-teal-200 text-teal-700 hover:bg-teal-50 rounded-xl text-xs font-bold transition"
          >
            Chỉnh món trong tab Báo cáo
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorWorkspace;
