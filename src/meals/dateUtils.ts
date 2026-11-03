/**
 * Tiện ích xử lý ngày tháng chuẩn cho module Suất ăn
 * Nguyên tắc: Chỉ lưu ngày bắt đầu tuần (Thứ 2 - YYYY-MM-DD),
 * mọi ngày trong tuần được tính ra tự động, không lưu chuỗi ngày rời rạc.
 */

export const DAY_NAMES = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'] as const;

/**
 * Format ngày Date thành chuỗi YYYY-MM-DD (ISO date)
 */
export function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format ngày Date thành chuỗi DD/MM/YYYY
 */
export function formatDMY(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const y = d.getFullYear();
  return `${day}/${m}/${y}`;
}

/**
 * Parse chuỗi ngày (YYYY-MM-DD hoặc DD/MM/YYYY) thành Date
 */
export function parseDateSafe(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
  }
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(dateStr);
}

/**
 * Tìm ngày Thứ 2 đầu tuần của 1 ngày bất kỳ
 */
export function getMondayOfDate(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday, ...
  const diff = day === 0 ? -6 : 1 - day; // khoảng cách tới thứ 2
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Tính ngày cụ thể của một thứ trong tuần từ ngày Thứ 2 đầu tuần
 * dayIndex: 0 = Thứ 2, 1 = Thứ 3, ..., 6 = Chủ nhật
 */
export function getDateOfDayInWeek(mondayDate: Date | string, dayIndex: number): Date {
  const base = typeof mondayDate === 'string' ? parseDateSafe(mondayDate) : new Date(mondayDate);
  const target = new Date(base);
  target.setDate(base.getDate() + dayIndex);
  return target;
}

/**
 * Lấy danh sách 7 ngày trong tuần với nhãn Thứ và ngày định dạng DD/MM/YYYY
 */
export function getWeekDaysInfo(mondayDate: Date | string): Array<{
  dayIndex: number;
  dayOfWeek: string;
  dateStr: string;   // DD/MM/YYYY
  isoDate: string;   // YYYY-MM-DD
}> {
  const monday = typeof mondayDate === 'string' ? parseDateSafe(mondayDate) : new Date(mondayDate);
  return DAY_NAMES.map((name, idx) => {
    const d = getDateOfDayInWeek(monday, idx);
    return {
      dayIndex: idx,
      dayOfWeek: name,
      dateStr: formatDMY(d),
      isoDate: formatISODate(d)
    };
  });
}

/**
 * Lấy chuỗi khoảng ngày của tuần (VD: '26/10/2026 - 01/11/2026')
 */
export function getWeekRangeStr(mondayDate: Date | string): string {
  const monday = typeof mondayDate === 'string' ? parseDateSafe(mondayDate) : new Date(mondayDate);
  const sunday = getDateOfDayInWeek(monday, 6);
  return `${formatDMY(monday)} - ${formatDMY(sunday)}`;
}
