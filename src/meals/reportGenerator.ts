import { MealVendor, ShiftMealDetail, KtxZones, SupplierMenuDB } from './types';
import { formatDMY, getDateOfDayInWeek } from './dateUtils';
import { getShiftDetail, supplierMenuStats } from './supplierMenuStore';

export interface ReportConfig {
  breakfastPrice?: number;
  mainMealPrice?: number;
}

/**
 * Hàm sinh nội dung văn bản báo cáo chuẩn hóa cho 1 Nhà Cung Cấp
 * Format chuẩn yêu cầu:
 * Báo cáo Anh/Chị: Lán trại Hóc Môn KTX1 phục vụ suất ăn [ca] ngày [dd/MM/yyyy]
 * • Tổng cộng: 680 suất
 * • Đơn giá: 40.000đ
 * NCC: Tám Phương
 * • Tổng suất ăn: 680 suất
 * TĐ 8: 350 suất
 * TĐ 11.1: 180 suất
 * TĐ 11.3: 150 suất
 * • Suất ăn mặn: [món 1, món 2, ...]
 * • Tráng miệng mặn: [...]
 * • Suất ăn chay: [...]
 * • Tráng miệng chay: [...]
 * Cân định lượng: Đạt
 */
export function generateVendorReportText(
  vendor: MealVendor,
  shiftName: 'Bữa sáng' | 'Bữa trưa' | 'Bữa tối',
  dateFormattedStr: string,
  mealDetail?: ShiftMealDetail,
  config?: ReportConfig,
  ktxLabel?: 'KTX1' | 'KTX2'
): string {
  const total = vendor.td8 + vendor.td11_1 + vendor.td11_3;
  const isBreakfast = shiftName === 'Bữa sáng';
  const defaultPrice = isBreakfast
    ? (config?.breakfastPrice ?? 20000)
    : (config?.mainMealPrice ?? 40000);
  const priceFormatted = `${defaultPrice.toLocaleString('vi-VN')}đ`;

  const meatDishesStr = mealDetail && mealDetail.meatDishes && mealDetail.meatDishes.length > 0
    ? mealDetail.meatDishes.join(', ')
    : 'Cơm trắng, Thịt kho củ cải, Cá rô phi chiên rim mắm, Trứng gà luộc, Bầu luộc, Canh rau ngót';

  const meatDessertStr = mealDetail?.meatDessert || 'Chuối';

  const vegDishesStr = mealDetail && mealDetail.vegDishes && mealDetail.vegDishes.length > 0
    ? mealDetail.vegDishes.join(', ')
    : 'Cơm trắng, Sườn non chiên, Bắp cải xào, Chả lụa chay rim mặn, Bầu luộc, Canh rau ngót';

  const vegDessertStr = mealDetail?.vegDessert || 'Chuối';

  const lines = [
    `Báo cáo Anh/Chị: Lán trại Hóc Môn ${ktxLabel || vendor.ktx} phục vụ suất ăn ${shiftName.toLowerCase()} ngày ${dateFormattedStr}`,
    `• Tổng cộng: ${total.toLocaleString('vi-VN')} suất`,
    `• Đơn giá: ${priceFormatted}`,
    `NCC: ${vendor.name}`,
    `• Tổng suất ăn: ${total.toLocaleString('vi-VN')} suất`,
    `TĐ 8: ${vendor.td8.toLocaleString('vi-VN')} suất`,
    `TĐ 11.1: ${vendor.td11_1.toLocaleString('vi-VN')} suất`,
    `TĐ 11.3: ${vendor.td11_3.toLocaleString('vi-VN')} suất`,
    `• Suất ăn mặn: ${meatDishesStr}`,
    `• Tráng miệng mặn: ${meatDessertStr}`,
    `• Suất ăn chay: ${vegDishesStr}`,
    `• Tráng miệng chay: ${vegDessertStr}`,
    `Cân định lượng: Đạt`
  ];

  return lines.join('\n');
}

/**
 * Hàm sinh văn bản báo cáo gộp cho toàn bộ nhóm NCC trong 1 KTX
 */
export function generateKtxGroupReportText(
  ktxName: 'KTX1' | 'KTX2',
  vendorsInKtx: MealVendor[],
  shiftName: 'Bữa sáng' | 'Bữa trưa' | 'Bữa tối',
  dateFormattedStr: string,
  mealsByVendorId?: Record<string, ShiftMealDetail>,
  config?: ReportConfig
): string {
  if (vendorsInKtx.length === 0) return '';

  const totalKtx = vendorsInKtx.reduce((acc, v) => acc + v.td8 + v.td11_1 + v.td11_3, 0);
  const isBreakfast = shiftName === 'Bữa sáng';
  const defaultPrice = isBreakfast
    ? (config?.breakfastPrice ?? 20000)
    : (config?.mainMealPrice ?? 40000);
  const priceFormatted = `${defaultPrice.toLocaleString('vi-VN')}đ`;

  const headerLines = [
    `Báo cáo Anh/Chị: Lán trại Hóc Môn ${ktxName} phục vụ suất ăn ${shiftName.toLowerCase()} ngày ${dateFormattedStr}`,
    `• Tổng cộng: ${totalKtx.toLocaleString('vi-VN')} suất`,
    `• Đơn giá: ${priceFormatted}`,
    ''
  ];

  const vendorSections = vendorsInKtx.map((vendor, idx) => {
    const totalV = vendor.td8 + vendor.td11_1 + vendor.td11_3;
    const detail = mealsByVendorId ? mealsByVendorId[vendor.id] : undefined;

    const meatDishesStr = detail && detail.meatDishes && detail.meatDishes.length > 0
      ? detail.meatDishes.join(', ')
      : 'Cơm trắng, Thịt kho củ cải, Cá rô phi chiên rim mắm, Trứng gà luộc, Bầu luộc, Canh rau ngót';
    const meatDessertStr = detail?.meatDessert || 'Chuối';

    const vegDishesStr = detail && detail.vegDishes && detail.vegDishes.length > 0
      ? detail.vegDishes.join(', ')
      : 'Cơm trắng, Sườn non chiên, Bắp cải xào, Chả lụa chay rim mặn, Bầu luộc, Canh rau ngót';
    const vegDessertStr = detail?.vegDessert || 'Chuối';

    return [
      `${idx + 1}. NCC: ${vendor.name}`,
      `• Tổng suất ăn: ${totalV.toLocaleString('vi-VN')} suất`,
      `TĐ 8: ${vendor.td8.toLocaleString('vi-VN')} suất`,
      `TĐ 11.1: ${vendor.td11_1.toLocaleString('vi-VN')} suất`,
      `TĐ 11.3: ${vendor.td11_3.toLocaleString('vi-VN')} suất`,
      `• Suất ăn mặn: ${meatDishesStr}`,
      `• Tráng miệng mặn: ${meatDessertStr}`,
      `• Suất ăn chay: ${vegDishesStr}`,
      `• Tráng miệng chay: ${vegDessertStr}`,
      `Cân định lượng: Đạt`
    ].join('\n');
  });

  return headerLines.join('\n') + vendorSections.join('\n\n') + `\nTỔNG CỘNG SUẤT ĂN TOÀN KHU ${ktxName}: ${totalKtx.toLocaleString('vi-VN')} suất (${vendorsInKtx.length} NCC)`;
}

/**
 * Văn bản Zalo nhóm theo PHÂN KHU ĐỘNG + món/số suất thời gian thực từ CSDL.
 * Dùng chung cho cả TAB "Suất ăn" và "Công việc" (bước 4 sơ đồ luồng).
 */
export function generateZaloReportText(opts: {
  ktxZones: KtxZones;
  vendors: MealVendor[];
  db: SupplierMenuDB;
  portionArchive: Record<string, Record<string, { td8: number; td11_1: number; td11_3: number }>>;
  weekStart: string;
  dayIdx: number;
  shiftKey: 'sang' | 'trua' | 'toi';
}): string {
  const SHIFT_NAMES = { sang: 'Bữa sáng', trua: 'Bữa trưa', toi: 'Bữa tối' } as const;
  const dateFormattedStr = formatDMY(getDateOfDayInWeek(opts.weekStart, opts.dayIdx));
  let text = '';

  (['KTX2', 'KTX1'] as const).forEach(zoneKey => {
    const zoneIds = opts.ktxZones[zoneKey] || [];
    const groupVendors = opts.vendors.filter(v => zoneIds.includes(v.id));
    if (groupVendors.length === 0) return;

    const totalKtx = groupVendors.reduce((acc, v) => acc + (v.td8 + v.td11_1 + v.td11_3), 0);
    text += `Báo cáo Anh/Chị: Lán trại Hóc Môn ${zoneKey} phục vụ suất ăn ${SHIFT_NAMES[opts.shiftKey].toLowerCase()} ngày ${dateFormattedStr}\n`;
    text += `• Tổng cộng: ${totalKtx.toLocaleString('vi-VN')} suất\n`;
    text += `• Đơn giá: 40.000đ\n\n`;

    groupVendors.forEach((v, idx) => {
      const totalV = v.td8 + v.td11_1 + v.td11_3;
      const detail = getShiftDetail(opts.db, v.id, opts.weekStart, opts.dayIdx, opts.shiftKey);
      const meatText = detail && detail.meatDishes.length ? detail.meatDishes.join(', ') : 'Chưa cập nhật thực đơn';
      const vegText = detail && detail.vegDishes.length ? detail.vegDishes.join(', ') : 'Chưa cập nhật thực đơn';
      const check = supplierMenuStats(opts.db, v.id, opts.weekStart).lastCheck;

      text += `${idx + 1}. NCC: ${v.name}\n`;
      text += `• Tổng suất ăn: ${totalV.toLocaleString('vi-VN')} suất\n`;
      text += `- TĐ 8: ${v.td8} suất\n`;
      text += `- TĐ 11.1: ${v.td11_1} suất\n`;
      text += `- TĐ 11.3: ${v.td11_3} suất\n`;
      text += `• Suất ăn mặn: ${meatText}\n`;
      text += `• Suất ăn chay: ${vegText}\n`;
      text += `Cân định lượng: ${check ? (check.ok ? 'Đạt' : 'Cần kiểm tra lại') : 'Chưa kiểm định'}\n\n`;
    });

    text += `TỔNG CỘNG SUẤT ĂN TOÀN KHU ${zoneKey}: ${totalKtx.toLocaleString('vi-VN')} suất (${groupVendors.length} NCC)\n\n`;
  });

  return text.trim();
}
