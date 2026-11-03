export type UserRole = 'manager' | 'staff';

export interface User {
  id: string;
  code: string; // Mã nhân viên vd VC-M01, VC-S01
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  khuVuc: string;
  currentShift?: string; // Ca trực hiện tại: Ca 1, Ca 2, Ca 3
  isActive: boolean;
  avatar: string;
  canAccessTasks?: boolean;
  canAccessMeals?: boolean;
  // KPI calculated
  completedOnTimeRate?: number;
  reworkCount?: number;
  kpiRating?: 'A' | 'B' | 'C';
}

export type ChecklistGroup = 'Hằng ngày' | 'Hằng tuần' | 'Hằng tháng';
export type FrequencyType = 'daily' | 'weekly' | 'monthly';
export type ProofType = 'image' | 'signature' | 'both' | 'none';

export interface ChecklistTemplate {
  id: string;
  title: string;
  group: ChecklistGroup;
  startTime: string; // e.g. "05:25"
  endTime: string;   // e.g. "05:35"
  frequency: FrequencyType;
  daysOfWeek?: number[]; // 0 = Chủ nhật, 1 = Thứ 2, ... 6 = Thứ 7
  weekOfMonth?: number[]; // e.g. [1, 3] for tuần 1 & 3
  dayOfMonth?: number; // e.g. 31 or last day
  requirements: string[];
  proofRequired: boolean;
  proofType: ProofType;
  notes?: string;
  isImportant: boolean;
  defaultAssigneeId?: string;
  isActive: boolean;
}

export type TaskStatus = 'Chưa làm' | 'Đang làm' | 'Hoàn thành' | 'Chờ duyệt' | 'Cần làm lại';

export interface TaskHistoryItem {
  id: string;
  timestamp: string;
  actorName: string;
  action: string;
  details?: string;
}

export interface TaskItem {
  id: string;
  templateId: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  title: string;
  group: ChecklistGroup;
  requirements: string[];
  assigneeId: string;
  assignerId: string;
  status: TaskStatus;
  startTimeRecorded?: string;
  endTimeRecorded?: string;
  resultText?: string;
  metricValue?: string; // vd số suất ăn
  handoverNotes?: string;
  proofImages: string[];
  proofRequired: boolean;
  isImportant: boolean;
  managerNotes?: string;
  history: TaskHistoryItem[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  linkTaskId?: string;
}

export interface ShiftHandoverItem {
  id: string;
  date: string;
  shift: string; // e.g. "Ca sáng (05:00 - 13:30)" | "Ca chiều (13:30 - 22:00)" | "Ca đêm (22:00 - 05:00)"
  authorId: string;
  authorName: string;
  notes: string;
  pendingTasksCount: number;
  pendingTaskTitles?: string[];
  acknowledgedBy?: string;
  acknowledgedByName?: string;
  acknowledgedAt?: string;
  status: 'pending' | 'acknowledged';
  timestamp: string;
}

export interface MealRecord {
  id: string;
  date: string;
  mealType: 'Sáng' | 'Trưa' | 'Tối';
  orderedCount: number;      // Số suất báo đặt
  receivedCount: number;     // Số suất thực nhận từ NCC
  distributedCount: number;  // Số suất phát cho các đội
  diffCount: number;         // Chênh lệch
  sampleStored: boolean;     // Đã lưu mẫu thực phẩm 24h
  qualityStatus: 'Đạt chuẩn' | 'Cần lưu ý' | 'Không đạt';
  supplierName: string;      // Tên nhà cung cấp
  inspectedBy: string;       // Người kiểm tra
  notes?: string;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  target: string;
  details: string;
}

export type NotePriority = 'high' | 'medium' | 'low';
export type NoteStatus = 'todo' | 'in_progress' | 'done';
export type NoteCategory = 'general' | 'incident' | 'personnel' | 'ncc' | 'safety';

export interface ManagerNoteItem {
  id: string;
  title: string;
  content: string;
  status: NoteStatus;
  priority: NotePriority;
  category: NoteCategory;
  dueDate?: string;
  assignedStaffId?: string;
  createdAt: string;
  completedAt?: string;
}

export type WeekRecurrenceType = 'all' | 'week_1_3' | 'week_2_4' | 'month_end';

export interface WeeklyRoutineItem {
  id: string;
  title: string;
  dayOfWeek: number; // 1 = T2, 2 = T3, 3 = T4, 4 = T5, 5 = T6, 6 = T7, 0 = CN
  timeSlot: string; // e.g. "09:00 - 11:30"
  recurrence: WeekRecurrenceType;
  requirements: string[];
  isImportant: boolean;
  isCompleted: boolean;
  completedAt?: string;
  completedNotes?: string;
  proofRequired?: boolean;
}


