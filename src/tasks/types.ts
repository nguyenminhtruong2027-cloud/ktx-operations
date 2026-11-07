export type ShiftType = 'sang' | 'trua' | 'chieu' | 'toi';

export type TaskFrequency = 'daily' | 'weekly' | 'monthly';

export type TaskGroupType = 'van_hanh' | 'quan_ly';

export interface TaskTemplate {
  id: string;
  title: string;
  detail: string;
  shift: ShiftType;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  frequency: TaskFrequency;
  weekday?: number; // 0 = CN, 1 = T2 ... 6 = T7
  weekOfMonth?: number[]; // [1, 3] or [2, 4]
  requirePhoto: boolean;
  important: boolean;
  role: 'staff' | 'manager' | 'all';
  group: TaskGroupType;
  mealLink?: boolean;
}

export type TaskInstanceStatus = 'pending' | 'doing' | 'done' | 'overdue';

export interface TaskInstance {
  id: string;
  templateId: string;
  date: string; // "YYYY-MM-DD"
  assigneeId: string; // "" = chưa ai nhận
  status: TaskInstanceStatus;
  doneAt?: string;
  photoUrls: string[];
  note?: string;
  createdBy: string;
}

export type ComputedTaskStatus = 'upcoming' | 'doing' | 'done' | 'overdue';

export interface WeeklyNoteItem {
  id: string;
  weekKey: string; // e.g. "2026-W45"
  dayIndex: number; // 1..7 (T2..CN), 0 = Ghi nhớ chung cả tuần
  text: string;
  userId: string;
  updatedAt: number;
}

export type WorkNoteStatus = 'todo' | 'doing' | 'done';
export type WorkNotePriority = 'urgent' | 'important' | 'normal';

export interface WorkNoteItem {
  id: string;
  title: string;
  note: string;
  date: string; // "YYYY-MM-DD"
  createdAt: string; // "HH:mm DD/MM/YYYY"
  completedAt?: string; // "HH:mm DD/MM/YYYY"
  status: WorkNoteStatus;
  priority: WorkNotePriority;
  authorName: string;
  category?: string;
}

