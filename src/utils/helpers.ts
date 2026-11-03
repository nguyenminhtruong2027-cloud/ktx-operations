import { TaskItem, User } from '../types';

export const STORAGE_KEYS = {
  TASKS: 'vincons_tasks_v2',
  TEMPLATES: 'vincons_templates_v2',
  USERS: 'vincons_users_v2',
  HANDOVERS: 'vincons_handovers_v2',
  MEALS: 'vincons_meals_v2',
  LOGS: 'vincons_logs_v2',
  NOTIFICATIONS: 'vincons_notifications_v2',
  MANAGER_NOTES: 'vincons_mgr_notes_v2',
  WEEKLY_ROUTINES: 'vincons_weekly_routines_v2',
  MANAGER_MEMOS: 'vincons_mgr_memos_v2'
};

export const saveToStorage = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`Lỗi lưu vào localStorage với key ${key}:`, err);
  }
};

export const loadFromStorage = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Lỗi đọc từ localStorage với key ${key}:`, err);
    return fallback;
  }
};

export const isTaskOverdue = (task: TaskItem): boolean => {
  if (task.status === 'Hoàn thành') return false;
  
  const now = new Date();
  const [year, month, day] = task.date.split('-').map(Number);
  const [endHour, endMin] = task.endTime.split(':').map(Number);
  
  const taskEndDate = new Date(year, month - 1, day, endHour, endMin);
  return now > taskEndDate;
};

export const isTaskUpcoming = (task: TaskItem): boolean => {
  if (task.status === 'Hoàn thành' || task.status === 'Đang làm') return false;

  const now = new Date();
  const [year, month, day] = task.date.split('-').map(Number);
  const [startHour, startMin] = task.startTime.split(':').map(Number);

  const taskStartDate = new Date(year, month - 1, day, startHour, startMin);
  const diffMinutes = (taskStartDate.getTime() - now.getTime()) / (1000 * 60);

  // If within 15 minutes before start, or up to 10 minutes past start
  return diffMinutes <= 15 && diffMinutes >= -10;
};

export const formatDateVN = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

/**
 * Chia đều các công việc chưa giao theo thuật toán xoay vòng (Round-Robin) cho nhân viên đang hoạt động
 */
export const distributeTasksRoundRobin = (
  tasks: TaskItem[],
  activeStaff: User[]
): { updatedTasks: TaskItem[]; distributedCount: number } => {
  if (activeStaff.length === 0) return { updatedTasks: tasks, distributedCount: 0 };

  let distributedCount = 0;
  let staffIndex = 0;

  const updatedTasks = tasks.map(task => {
    // Nếu công việc chưa có người nhận hoặc đang để unassigned
    if (!task.assigneeId || task.assigneeId === 'unassigned' || task.assigneeId === '') {
      const assignedStaff = activeStaff[staffIndex % activeStaff.length];
      staffIndex++;
      distributedCount++;
      return {
        ...task,
        assigneeId: assignedStaff.id,
        history: [
          ...task.history,
          {
            id: `hist-${Date.now()}-${Math.random()}`,
            timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
            actorName: 'Hệ thống tự động',
            action: 'Chia đều việc xoay vòng',
            details: `Tự động phân công cho ${assignedStaff.name} (${assignedStaff.code})`
          }
        ]
      };
    }
    return task;
  });

  return { updatedTasks, distributedCount };
};

/**
 * Tính toán hiệu suất KPI của Chuyên viên Vận hành
 */
export const calculateStaffKPI = (
  userId: string,
  allTasks: TaskItem[]
): { total: number; completed: number; onTime: number; onTimeRate: number; reworkCount: number; rating: 'A' | 'B' | 'C' } => {
  const staffTasks = allTasks.filter(t => t.assigneeId === userId);
  const total = staffTasks.length;
  const completed = staffTasks.filter(t => t.status === 'Hoàn thành').length;
  
  // Đúng hạn = Hoàn thành và không bị quá hạn theo giờ kết thúc
  const onTime = staffTasks.filter(t => t.status === 'Hoàn thành' && !isTaskOverdue(t)).length;
  const onTimeRate = total > 0 ? Math.round((onTime / total) * 100) : 100;
  
  // Đếm số lần bị yêu cầu làm lại qua lịch sử
  const reworkCount = staffTasks.reduce((sum, t) => {
    const reworks = t.history.filter(h => h.action.includes('làm lại') || h.action === 'Yêu cầu làm lại').length;
    return sum + reworks;
  }, 0);

  let rating: 'A' | 'B' | 'C' = 'A';
  if (onTimeRate < 80 || reworkCount >= 3) {
    rating = 'C';
  } else if (onTimeRate < 90 || reworkCount >= 1) {
    rating = 'B';
  }

  return { total, completed, onTime, onTimeRate, reworkCount, rating };
};

/**
 * Nén ảnh trước khi lưu vào localStorage để tránh tràn bộ nhớ
 */
export const compressImage = (file: File, maxWidth = 800, quality = 0.7): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const elem = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        elem.width = width;
        elem.height = height;
        const ctx = elem.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = elem.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const exportToCSV = (tasks: TaskItem[], title: string) => {
  const headers = ['Mã việc', 'Nhóm', 'Tên công việc', 'Thời gian', 'Người phụ trách', 'Trạng thái', 'Kết quả', 'Số liệu', 'Bàn giao'];
  const rows = tasks.map(t => [
    t.id,
    t.group,
    `"${t.title.replace(/"/g, '""')}"`,
    `${t.startTime} - ${t.endTime}`,
    t.assigneeId,
    t.status,
    `"${(t.resultText || '').replace(/"/g, '""')}"`,
    `"${(t.metricValue || '').replace(/"/g, '""')}"`,
    `"${(t.handoverNotes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `bao_cao_van_hanh_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
