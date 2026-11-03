export interface MealVendor {
  id: string;
  name: string;
  code: string;
  tagline?: string;
  ktx: 'KTX1' | 'KTX2';
  td8: number;      // Suất ca 8h
  td11_1: number;   // Suất ca 11h1
  td11_3: number;   // Suất ca 11h3
  expectedTotal?: number; // Tổng số suất khai báo từ NCC (để kiểm tra khớp TĐ8 + TĐ11.1 + TĐ11.3)
  price: number;    // Đơn giá suất ăn (40000)
  status: 'Hoạt động' | 'Tạm ngưng';
}

export interface DishItemWithGram {
  name: string;
  gramDesc?: string;
  grams?: number;
}

export interface ShiftMealDetail {
  title?: string;
  priceNote?: string;
  meatDishes: string[];
  meatDessert?: string;
  vegDishes: string[];
  vegDessert?: string;
}

export interface DayWeeklyMenu {
  dayOfWeek: string;   // 'Thứ 2', 'Thứ 3', ...
  dateStr: string;     // '26/10/2026'
  breakfast: ShiftMealDetail; // Sáng (20K)
  lunch: ShiftMealDetail;     // Trưa (40K)
  dinner: ShiftMealDetail;    // Tối (40K)
}

export interface UploadedMenuFile {
  id: string;
  fileName: string;
  fileType: 'excel' | 'csv' | 'image' | 'manual';
  fileSize?: string;
  dateRange: string; // Ví dụ: '26/10/2026 - 01/11/2026'
  startDate?: string;
  endDate?: string;
  vendorId: string;
  vendorName: string;
  uploadedAt: string; // '26/10/2026 09:30'
  menu: DayWeeklyMenu[];
  isActive?: boolean;
}

// Giữ lại alias để tương thích ngược nếu cần
export type WeeklyMenuArchive = UploadedMenuFile;

export interface DishDuplicateOccurrence {
  fileId: string;
  fileName: string;
  dateRange: string;
  dayOfWeek: string;
  shift: string;
  dateStr: string;
}

export interface DishDuplicateItem {
  dishName: string;
  currentDay: string;
  currentShift: string;
  currentDateStr?: string;
  occurrences: DishDuplicateOccurrence[];
  totalCount: number;
}

export interface InspectionDetails {
  weighedStatus: 'Đạt' | 'Chưa đạt';
  sampleSaved: boolean; // Đã lưu mẫu thực phẩm 24h
  tempOk: boolean;       // Nhiệt độ thức ăn lúc giao (>60°C)
  onTime: boolean;       // Đúng giờ phục vụ
  notes?: string;
}

export interface MealMenuRecord {
  id?: string;
  vendorId: string;
  dayOfWeek: string;
  dateStr: string;
  shift: 'Bữa sáng' | 'Bữa trưa' | 'Bữa tối';
  meatDishes: string[];
  meatDessert: string;
  vegDishes: string[];
  vegDessert: string;
  isWeighedOk: boolean;
  inspection?: InspectionDetails;
  evidencePhotos?: string[];
}

export interface PortionRule {
  id: string;
  title: string;
  minVal: number;
  unit: 'g' | 'ml';
  positionDesc: string;
  badge: string;
}

export interface ProhibitedDishRule {
  id: number;
  name: string;
  note?: string;
  recommendation?: string;
}

export interface EvaluationWarning {
  id: string;
  ruleTag: string; // 'Quy tắc #1' | 'Định lượng' | 'Trùng món' | 'Tần suất'
  ruleName: string; // Tên quy tắc rõ ràng (ví dụ: 'Quy tắc cấm mùa hè: Món luộc thịt/gà/vịt')
  ruleRequirement: string; // Nội dung quy chuẩn (ví dụ: 'Cấm thịt/gà/vịt luộc vì nguy cơ ôi thiu trong 2h')
  dishName: string; // Món cụ thể vi phạm
  dayShift: string; // 'Thứ 2 — Bữa trưa'
  dayOfWeek: string;
  shiftName: string;
  message: string;
  severity: 'error' | 'warning';
}

// ===================== supplier_menus: CSDL tập trung thực đơn theo NCC =====================

export type SupplierShiftKey = 'sang' | 'trua' | 'toi'; // Sáng / Trưa / Tối

export interface PortionCheckSummary {
  checkedAt: number;   // epoch ms
  ok: boolean;         // true nếu 0 lỗi (error-severity)
  warningsCount: number;
  duplicatesCount: number;
}

export interface SupplierMenuEntry {
  id: string;                    // `${vendorId}__${weekStart}__${dayIndex}__${shiftKey}`
  vendorId: string;
  weekStart: string;             // YYYY-MM-DD (Thứ 2)
  dayIndex: number;              // 0..6 (Thứ 2..CN)
  shiftKey: SupplierShiftKey;
  detail: ShiftMealDetail;       // món + định lượng (gram/ml) — Nguồn sự thật cho mọi báo cáo
  source: 'ai' | 'excel' | 'text' | 'manual' | 'archive';
  sourceFileId?: string;         // UploadedMenuFile.id
  updatedAt: number;
  portionCheck?: PortionCheckSummary;
}

// CSDL: Map phẳng theo entryId
export type SupplierMenuDB = Record<string, SupplierMenuEntry>;

// Phân khu KTX động (không còn gán cứng NCC→KTX trong logic; đây chỉ là dữ liệu chọn được)
export type KtxZoneKey = 'KTX1' | 'KTX2';
export type KtxZones = Record<KtxZoneKey, string[]>; // danh sách vendorId mỗi khu

// Bộ phân bổ suất theo thời gian thực cho 1 NCC trong 1 buổi (Sáng/Trưa/Tối)
export interface VendorPortionTrio {
  td8: number;
  td11_1: number;
  td11_3: number;
}
