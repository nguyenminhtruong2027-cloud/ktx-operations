export type KtxZone = 'KTX1' | 'KTX2';

export interface NccInfo {
  code: string;
  name: string;
  ktx: KtxZone;
  aliases?: string[];
}

export type DayCode = 'T2' | 'T3' | 'T4' | 'T5' | 'T6' | 'T7' | 'CN';

export interface ShiftBreakfast {
  mon: string;
  thanhPhan: string;
}

export interface DishRow {
  ten: string;
  tl: string;
}

export interface DayMenu {
  ma: DayCode;
  ngayThang: string; // "dd/mm/yyyy"
  sang: ShiftBreakfast;
  trua: DishRow[];
  toi: DishRow[];
}

export interface WeeklyMenu {
  id: string;
  ncc: string; // NCC code, e.g. 'TP', or '' if uncertain
  tuanTu: string; // "dd/mm/yyyy"
  tuanDen: string; // "dd/mm/yyyy"
  loai: 'man' | 'chay';
  ngay: DayMenu[];
  batThuongFile: string[];
  fileName?: string;
  uploadedAt?: string;
}

export type Severity = 'HIGH' | 'REVIEW';

export type RuleGroup =
  | 'mon_cam'
  | 'dinh_luong'
  | 'ga_vit_ca'
  | 'che_bien'
  | 'trung_mon';

export interface AuditWarning {
  id: string;
  ruleCode: string;
  group: RuleGroup;
  severity: Severity;
  day: string;
  shift: string;
  rowLabel: string;
  dishName: string;
  weightRaw: string;
  calculation: string;
  clause: string;
  suggestion: string;
  groupedCount?: number;
  groupedDetails?: string[];
}

export interface GroupScore {
  group: RuleGroup;
  label: string;
  highCount: number;
  reviewCount: number;
  deduction: number;
  maxDeduction: number;
  score: number;
}

export interface AuditResult {
  menuId: string;
  ncc: string;
  loai: 'man' | 'chay';
  tuanTu: string;
  tuanDen: string;
  totalScore: number;
  highCount: number;
  reviewCount: number;
  warnings: AuditWarning[];
  passedItems: string[];
  groupScores: GroupScore[];
  stats: {
    chickenMeals: number;
    chickenWithBreakfast: number;
    duckMeals: number;
    breadBreakfasts: number;
    fishDaysSummary: string;
    underweightMainCount: number;
  };
}

export type ShiftType = 'sang' | 'trua' | 'toi';

export type MealCountEntry = Record<string, number>;

export interface DishOverrideEntry {
  manDishes?: string;
  manDessert?: string;
  chayDishes?: string;
  chayDessert?: string;
}

export interface QuantitativeThresholds {
  monChinhMin: number;
  monPhuMin: number;
  rauMin: number;
  canhMin: number;
  comMin: number;
}

export interface CustomProhibitedRule {
  id: string;
  name: string;
  keywords: string[];
  severity: Severity;
  enabled: boolean;
}

export interface AppSettings {
  nccList: NccInfo[];
  unitPrice: number;
  ruleSeverityOverrides: Record<string, Severity>;
  columnLabels?: string[];
  quantitativeThresholds?: QuantitativeThresholds;
  customRules?: CustomProhibitedRule[];
}
