import React, { useMemo } from 'react';
import { MealVendor, ShiftMealDetail, KtxZones, KtxZoneKey } from '../types';
import { generateVendorReportText, generateKtxGroupReportText } from '../reportGenerator';
import { Copy, Check, Edit3, Users, X, FileText } from 'lucide-react';

interface ReportBuilderProps {
  vendors: MealVendor[];
  shiftName: 'Bữa sáng' | 'Bữa trưa' | 'Bữa tối';
  dateFormattedStr: string;
  mealsByVendorId: Record<string, ShiftMealDetail>;
  ktxZones: KtxZones;
  onChangeKtxZones: (next: KtxZones) => void;
  onEditVendorMenu: (vendorId: string) => void;
  onToast: (msg: string) => void;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  vendors,
  shiftName,
  dateFormattedStr,
  mealsByVendorId,
  ktxZones,
  onChangeKtxZones,
  onEditVendorMenu,
  onToast
}) => {
  const [activeKtx, setActiveKtx] = React.useState<KtxZoneKey>('KTX1');

  // Chọn động: NCC của khu đang mở = dữ liệu ktxZones (tích chọn được, KHÔNG gán cứng)
  const activeZoneVendorIds = ktxZones[activeKtx] || [];
  const activeSelectedVendors = useMemo(
    () => vendors.filter(v => activeZoneVendorIds.includes(v.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vendors, activeZoneVendorIds]
  );

  const toggleVendorInZone = (vendorId: string) => {
    const has = activeZoneVendorIds.includes(vendorId);
    const nextIds = has
      ? activeZoneVendorIds.filter(id => id !== vendorId)
      : [...activeZoneVendorIds, vendorId];
    // A vendor có thể thuộc cả 2 khu — mỗi khu có danh sách độc lập
    onChangeKtxZones({ ...ktxZones, [activeKtx]: nextIds });
    onToast(has
      ? `Đã bỏ ${vendors.find(v => v.id === vendorId)?.name} khỏi báo cáo ${activeKtx}`
      : `Đã thêm ${vendors.find(v => v.id === vendorId)?.name} vào báo cáo ${activeKtx}`);
  };

  const handleSelectAll = () => {
    onChangeKtxZones({ ...ktxZones, [activeKtx]: vendors.map(v => v.id) });
    onToast(`Đã chọn tất cả ${vendors.length} NCC đưa vào báo cáo ${activeKtx}!`);
  };

  const handleClearZone = () => {
    onChangeKtxZones({ ...ktxZones, [activeKtx]: [] });
    onToast(`Đã bỏ chọn toàn bộ NCC trong ${activeKtx}`);
  };

  const handleCopyKtxReport = () => {
    const text = generateKtxGroupReportText(
      activeKtx,
      activeSelectedVendors,
      shiftName,
      dateFormattedStr,
      mealsByVendorId
    );
    if (!text) {
      onToast(`Không có NCC nào được tích chọn trong ${activeKtx}`);
      return;
    }
    navigator.clipboard.writeText(text);
    onToast(`Đã sao chép văn bản báo cáo ${activeKtx} vào bộ nhớ tạm!`);
  };

  const handleCopySingleVendor = (vendor: MealVendor) => {
    const text = generateVendorReportText(
      vendor,
      shiftName,
      dateFormattedStr,
      mealsByVendorId[vendor.id]
    );
    navigator.clipboard.writeText(text);
    onToast(`Đã sao chép báo cáo riêng của ${vendor.name}!`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-(--vc-accent-1) to-(--vc-accent-2) shrink-0">
            <FileText className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
              Văn Bản Báo Cáo Chuẩn Hóa · Lán Trại Hóc Môn
            </h3>
            <p className="text-[11px] text-slate-400">
              Chọn khu, tự do tích chọn NCC bất kỳ — định dạng chuẩn copy gửi Zalo Báo Cơm & Ban Lãnh đạo
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:border-(--vc-brand-2) hover:text-(--vc-brand-2) text-slate-700 font-bold text-xs rounded-xl transition shadow-sm flex items-center space-x-1.5"
          >
            <Users className="w-3.5 h-3.5 text-amber-500" />
            <span>Chọn tất cả ({vendors.length} NCC)</span>
          </button>
          <button
            type="button"
            onClick={handleCopyKtxReport}
            className="px-4 py-2 bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) hover:brightness-110 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-2"
          >
            <Copy className="w-3.5 h-3.5 text-amber-300" />
            <span>Sao chép báo cáo {activeKtx}</span>
          </button>
        </div>
      </div>

      {/* Tabs Khu KTX 1 / Khu KTX 2 — segmented pill */}
      <div className="flex items-center bg-slate-100 p-1 rounded-2xl w-full sm:w-auto sm:max-w-sm">
        {(['KTX1', 'KTX2'] as const).map(ktx => {
          const isActive = activeKtx === ktx;
          const count = (ktxZones[ktx] || []).length;
          return (
            <button
              key={ktx}
              type="button"
              onClick={() => setActiveKtx(ktx)}
              className={`flex-1 py-2 px-4 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center space-x-2 ${
                isActive
                  ? 'bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-white shadow-md'
                  : 'text-slate-500 hover:text-(--vc-brand-2)'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-amber-300' : 'bg-slate-300'}`} />
              <span>{ktx === 'KTX1' ? 'Khu KTX 1' : 'Khu KTX 2'}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${isActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Lưới chọn động: TẤT CẢ NCC hiện có (tích/bỏ tự do cho khu đang mở) */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs text-slate-500 font-bold uppercase tracking-wide">
          NCC khu {activeKtx} ({activeZoneVendorIds.length}/{vendors.length})
        </span>
        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-white text-[11px] font-black shadow-md">
          <Users className="w-3.5 h-3.5 text-amber-300" />
          <span>Tổng khu {activeKtx}: {activeSelectedVendors.reduce((acc, v) => acc + v.td8 + v.td11_1 + v.td11_3, 0).toLocaleString('vi-VN')} suất</span>
        </span>
        {vendors.map(v => {
          const isSelected = activeZoneVendorIds.includes(v.id);
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => toggleVendorInZone(v.id)}
              className={`group px-3 py-1.5 rounded-full text-xs font-bold transition-all border flex items-center space-x-1.5 active:scale-95 ${
                isSelected
                  ? 'bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 border-transparent shadow-md hover:brightness-105'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-amber-400 hover:text-orange-700 hover:bg-amber-50'
              }`}
            >
              <span className={`min-w-[18px] h-[18px] rounded-md flex items-center justify-center font-black text-[9px] ${isSelected ? 'bg-slate-950/85 text-amber-300' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                {v.code}
              </span>
              <span>{v.name}</span>
              {isSelected
                ? <Check className="w-3 h-3 text-slate-950" />
                : <span className="w-3 h-3 rounded-full border border-slate-300" />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={handleClearZone}
          disabled={activeZoneVendorIds.length === 0}
          className="mx-1 inline-flex items-center space-x-1 px-2.5 py-1.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed"
          title="Bỏ chọn toàn bộ NCC trong khu này (về 0)"
        >
          <X className="w-3 h-3" />
          <span>Bỏ hết</span>
        </button>
      </div>

      {/* Danh sách thẻ NCC */}
      <div className="space-y-4 pt-2">
        {activeSelectedVendors.length === 0 ? (
          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs">
            Chưa có nhà cung cấp nào được tích chọn trong {activeKtx}. Bấm vào danh sách bên trên để bật — mọi NCC hiện có đều có thể chọn.
          </div>
        ) : (
          activeSelectedVendors.map((vendor, idx) => {
            // Tên KTX theo tab ĐANG mở (tự đồng bộ KTX1/KTX2), không dùng vendor.ktx cứng
            const reportText = generateVendorReportText(
              vendor,
              shiftName,
              dateFormattedStr,
              mealsByVendorId[vendor.id],
              undefined,
              activeKtx
            );

            return (
              <div
                key={vendor.id}
                className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 hover:border-blue-300 hover:shadow-md transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="w-7 h-7 rounded-xl bg-gradient-to-br from-(--vc-brand-2) to-(--vc-brand-3) text-amber-300 font-black text-xs flex items-center justify-center shadow-sm">
                      {idx + 1}
                    </span>
                    <div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        {vendor.name} ({vendor.code})
                      </h4>
                      <p className="text-[10px] text-slate-500">{vendor.tagline}</p>
                    </div>
                    <span className="ml-1 hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-950 text-amber-300 text-[10px] font-black">
                      {mealsByVendorId[vendor.id]?.meatDishes?.length ?? 0} món
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => onEditVendorMenu(vendor.id)}
                      className="px-3 py-1.5 bg-white hover:border-(--vc-brand-2) hover:text-(--vc-brand-2) text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition shadow-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-orange-500" />
                      <span>Sửa món</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopySingleVendor(vendor)}
                      className="px-3 py-1.5 bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) hover:brightness-105 text-slate-950 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md transition active:scale-95"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép riêng</span>
                    </button>
                  </div>
                </div>

                {/* Khung xem trước văn bản chính xác 100% */}
                <pre className="p-3 bg-white rounded-xl border border-slate-200 text-slate-800 font-mono text-[11px] leading-relaxed whitespace-pre-wrap select-all hover:border-slate-300 transition">
                  {reportText}
                </pre>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
