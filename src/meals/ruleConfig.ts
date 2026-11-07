import { NccInfo, Severity } from './types';

export const DEFAULT_NCC_LIST: NccInfo[] = [
  { code: 'TP', name: 'Tám Phương', ktx: 'KTX1', aliases: ['tam phuong', 'tám phương', 'tp'] },
  { code: 'LD', name: 'Lim Dương', ktx: 'KTX1', aliases: ['lim duong', 'lim dương', 'ld'] },
  { code: 'ML', name: 'Minh Long Food', ktx: 'KTX1', aliases: ['minh long', 'ml'] },
  { code: 'VS', name: 'Vina Story', ktx: 'KTX1', aliases: ['vina story', 'vinastory', 'cơm việt story', 'com viet story', 'vs'] },
  { code: 'NS', name: 'Nguyên Sài Gòn', ktx: 'KTX2', aliases: ['nguyen sai gon', 'nguyên sài gòn', 'nsg', 'ns'] },
  { code: 'HN', name: 'Hương Ngọc Phát', ktx: 'KTX2', aliases: ['huong ngoc phat', 'hương ngọc phát', 'hnp', 'hn'] },
  { code: 'TH', name: 'Thiên Hồng Phúc', ktx: 'KTX2', aliases: ['thien hong phuc', 'thiên hồng phúc', 'thp', 'th'] },
];

export const QUANTITATIVE_THRESHOLDS = {
  monChinhMin: 75,
  monPhuMin: 30,
  rauMin: 70,
  canhMin: 250,
  comMin: 280,
};

export const COUNTING_UNITS = [
  'quả', 'cục', 'viên', 'cuộn', 'con', 'cái', 'cây', 'ổ', 'hủ', 'hũ', 'hộp', 'bịch', 'gói', 'miếng', 'khoanh', 'lát', 'trái'
];

export const WEIGHT_UNITS = ['g', 'gr', 'gram', 'ml'];

export interface ProhibitedRuleItem {
  id: string;
  code: string;
  name: string;
  defaultSeverity: Severity;
  description: string;
}

export const PROHIBITED_SUMMER_RULES: ProhibitedRuleItem[] = [
  { id: 'MC-01', code: 'MC-01', name: 'Món luộc (thịt/gà/vịt luộc; trừ rau/củ/quả luộc)', defaultSeverity: 'HIGH', description: 'Mục 1: Món luộc (thịt luộc, gà/vịt luộc; trừ rau luộc, củ quả luộc)' },
  { id: 'MC-01b', code: 'MC-01b', name: 'Trứng luộc (REVIEW)', defaultSeverity: 'REVIEW', description: 'Mục 1 (mở rộng): Trứng luộc' },
  { id: 'MC-02', code: 'MC-02', name: 'Món hấp / chưng (vd cá hấp, trứng hấp)', defaultSeverity: 'HIGH', description: 'Mục 2: Món hấp / chưng' },
  { id: 'MC-03', code: 'MC-03', name: 'Món chế biến từ nội tạng động vật', defaultSeverity: 'HIGH', description: 'Mục 3: Món chế biến từ nội tạng động vật (gan, lòng, mề, tim, cật, phổi, dạ dày...)' },
  { id: 'MC-04', code: 'MC-04', name: 'Món chiên/rán thịt, gà, vịt, cá, tôm (trừ cá nục chiên)', defaultSeverity: 'HIGH', description: 'Mục 4: Món chiên/rán (gà rán, cá rán; trừ cá nục rán)' },
  { id: 'MC-04b', code: 'MC-04b', name: 'Đậu hủ/chả giò/chả cá viên/trứng chiên, gà rôti', defaultSeverity: 'REVIEW', description: 'Mục 4 (REVIEW): Đậu hủ chiên, chả giò chiên, chả cá viên chiên, trứng chiên, gà rôti' },
  { id: 'MC-05', code: 'MC-05', name: 'Món xào với hành tây', defaultSeverity: 'HIGH', description: 'Mục 5: Món xào với hành tây' },
  { id: 'MC-06', code: 'MC-06', name: 'Món xào với cần tây (kể cả cần tàu)', defaultSeverity: 'HIGH', description: 'Mục 6: Món xào với cần tây / cần tàu' },
  { id: 'MC-07', code: 'MC-07', name: 'Món xào với nấm', defaultSeverity: 'HIGH', description: 'Mục 7: Món xào với nấm' },
  { id: 'MC-08', code: 'MC-08', name: 'Dưa muối / cà muối / dưa chua / cải mặn', defaultSeverity: 'HIGH', description: 'Mục 8: Dưa muối/cà muối (kể cả dưa chua, dưa cải, cải mặn, canh dưa chua)' },
  { id: 'MC-08b', code: 'MC-08b', name: 'Dưa mắm', defaultSeverity: 'REVIEW', description: 'Mục 8 (REVIEW): Dưa mắm' },
  { id: 'MC-09', code: 'MC-09', name: 'Khoai tây xào thì là', defaultSeverity: 'HIGH', description: 'Mục 9: Khoai tây xào thì là' },
  { id: 'MC-10', code: 'MC-10', name: 'Thịt xào súp lơ', defaultSeverity: 'HIGH', description: 'Mục 10: Thịt xào súp lơ' },
  { id: 'MC-11', code: 'MC-11', name: 'Thịt nhồi đậu', defaultSeverity: 'HIGH', description: 'Mục 11: Thịt nhồi đậu' },
  { id: 'MC-12', code: 'MC-12', name: 'Thịt nhồi mướp đắng / khổ qua', defaultSeverity: 'HIGH', description: 'Mục 12: Thịt nhồi mướp đắng/khổ qua' },
  { id: 'MC-13', code: 'MC-13', name: 'Trứng xào cà chua', defaultSeverity: 'HIGH', description: 'Mục 13: Trứng xào cà chua' },
  { id: 'MC-14', code: 'MC-14', name: 'Canh bí đỏ', defaultSeverity: 'HIGH', description: 'Mục 14: Canh bí đỏ' },
  { id: 'MC-15', code: 'MC-15', name: 'Canh giá đỗ chua', defaultSeverity: 'HIGH', description: 'Mục 15: Canh giá đỗ chua' },
  { id: 'MC-16', code: 'MC-16', name: 'Canh ngao nấu chua', defaultSeverity: 'HIGH', description: 'Mục 16: Canh ngao nấu chua' },
  { id: 'MC-17', code: 'MC-17', name: 'Canh cà chua', defaultSeverity: 'HIGH', description: 'Mục 17: Canh cà chua' },
  { id: 'MC-17b', code: 'MC-17b', name: 'Canh chua (có thể chứa cà chua)', defaultSeverity: 'REVIEW', description: 'Mục 17 (REVIEW): Canh chua có thể chứa cà chua' },
  { id: 'MC-18', code: 'MC-18', name: 'Tất cả món chế biến có cà chua', defaultSeverity: 'HIGH', description: 'Mục 18: Tất cả món chế biến có cà chua' },
  { id: 'MC-19', code: 'MC-19', name: 'Quả mận', defaultSeverity: 'HIGH', description: 'Mục 19: Quả mận' },
  { id: 'MC-20', code: 'MC-20', name: 'Các món chế biến từ ếch', defaultSeverity: 'HIGH', description: 'Mục 20: Các món chế biến từ ếch' },
  { id: 'MC-21', code: 'MC-21', name: 'Xúc xích ở món chính (r1, r2)', defaultSeverity: 'HIGH', description: 'Mục 21: Xúc xích (không làm bữa chính)' },
  { id: 'MC-22', code: 'MC-22', name: 'Lạp xưởng ở món chính (r1, r2)', defaultSeverity: 'HIGH', description: 'Mục 22: Lạp xưởng (không làm bữa chính)' },
  { id: 'MC-23', code: 'MC-23', name: 'Trứng cút xíu mại', defaultSeverity: 'HIGH', description: 'Mục 23: Trứng cút xíu mại' },
];

export const PREPROCESSED_KEYWORDS = [
  'chả lụa', 'giò lụa', 'chả cá', 'cá viên', 'bò viên',
  'chả giò', 'nem', 'chả ngon', 'chả quế', 'xúc xích', 'lạp xưởng'
];

export const ORGAN_MEAT_KEYWORDS = [
  'gan', 'lòng', 'mề', 'tim', 'cật', 'phổi', 'dạ dày', 'bao tử', 'phèo', 'nội tạng', 'huyết'
];

export const DESSERT_FORBIDDEN_KEYWORDS = [
  'thạch', 'rau câu', 'sữa', 'yaourt', 'sữa chua', 'bánh', 'chè', 'kem', 'pudding', 'flan'
];

export const FRUIT_KEYWORDS = [
  'chuối', 'táo', 'ổi', 'ôỉ', 'cam', 'quýt', 'bưởi', 'dưa hấu', 'dưa lưới', 'dưa gang',
  'thanh long', 'xoài', 'đu đủ', 'mít', 'nhãn', 'vải', 'chôm chôm', 'măng cụt', 'sầu riêng',
  'lê', 'nho', 'dâu', 'thơm', 'dứa', 'khóm', 'sa bô chê', 'hồng xiêm', 'vú sữa', 'trái cây'
];
