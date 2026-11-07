import { useState, useEffect, useRef } from 'react';
import {
  CheckSquare,
  FileText,
  Calendar,
  Moon,
  Sun,
  RefreshCw,
} from 'lucide-react';
import { TaskTemplate, TaskInstance } from './types';
import {
  DAILY_TASK_TEMPLATES,
  generateDailyInstancesForDate,
  getCurrentMinutes,
  computeTaskStatus,
} from './seedTemplates';
import DailyChecklistTab from './components/DailyChecklistTab';
import WeeklyNotebookTab from './components/WeeklyNotebookTab';
import WorkNotesWorkspaceTab from './components/WorkNotesWorkspaceTab';
import { User, ShiftHandoverItem } from '../types';
import { pushToFirestore, subscribeFirestoreDoc } from '../utils/firebase';

const STORAGE_KEYS = {
  TEMPLATES: 'vincons_task_templates_v2',
  INSTANCES: 'vincons_task_instances_v2',
  DARK_MODE: 'vincons_dark_mode_v1',
};

interface TasksModuleProps {
  currentUser: User;
  users: User[];
  currentDate: string;
  handoverList: ShiftHandoverItem[];
  onCreateHandover: (handover: ShiftHandoverItem) => void;
  onAcknowledgeHandover: (handoverId: string) => void;
  onPreviewImage: (url: string, title?: string) => void;
  onOpenMeals: () => void;
  onNotifyAdmin: (title: string, message: string, linkTaskId?: string) => void;
  onNotifyUser: (userId: string, title: string, message: string) => void;
}

export default function TasksModule({
  currentUser,
  users,
  currentDate,
  handoverList,
  onCreateHandover,
  onAcknowledgeHandover,
  onPreviewImage,
  onOpenMeals,
  onNotifyAdmin,
  onNotifyUser,
}: TasksModuleProps) {
  const isAdmin = currentUser.role === 'manager';
  const [subTab, setSubTab] = useState<'notes' | 'daily' | 'weekly'>('notes');
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'true';
  });
  const [nowMinutes, setNowMinutes] = useState<number>(() => getCurrentMinutes());

  const [templates, setTemplates] = useState<TaskTemplate[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DAILY_TASK_TEMPLATES;
  });

  const [instances, setInstances] = useState<TaskInstance[]>(() => {
    let base: TaskInstance[] = [];
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INSTANCES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) base = parsed;
      }
    } catch {
      // ignore
    }
    return generateDailyInstancesForDate(currentDate, DAILY_TASK_TEMPLATES, base, currentUser.id);
  });

  const notifiedOverdueRef = useRef<Set<string>>(new Set());

  // Sync dark mode class on <html>
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, String(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Update current time every 60s & check overdue tasks
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMinutes(getCurrentMinutes());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Ensure today's instances exist
  useEffect(() => {
    setInstances((prev) => {
      const next = generateDailyInstancesForDate(currentDate, templates, prev, currentUser.id);
      if (next.length !== prev.length) {
        void pushToFirestore('vincons_operations', 'taskInstances', next);
      }
      return next;
    });
  }, [currentDate, templates, currentUser.id]);

  // Subscribe to Firestore dual-sync
  useEffect(() => {
    const unsubTpl = subscribeFirestoreDoc<TaskTemplate[]>(
      'vincons_operations',
      'taskTemplates',
      (remote) => {
        if (Array.isArray(remote) && remote.length > 0) setTemplates(remote);
      }
    );
    const unsubInst = subscribeFirestoreDoc<TaskInstance[]>(
      'vincons_operations',
      'taskInstances',
      (remote) => {
        if (Array.isArray(remote)) setInstances(remote);
      }
    );
    return () => {
      unsubTpl();
      unsubInst();
    };
  }, []);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
    } catch {
      // ignore
    }
  }, [templates]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.INSTANCES, JSON.stringify(instances));
    } catch {
      // ignore
    }
  }, [instances]);

  // Notify Admin when any today task becomes overdue
  useEffect(() => {
    const tplMap = new Map(templates.map((t) => [t.id, t]));
    for (const inst of instances) {
      if (inst.date !== currentDate) continue;
      const tpl = tplMap.get(inst.templateId);
      if (!tpl) continue;
      const st = computeTaskStatus(inst, tpl, nowMinutes);
      if (st === 'overdue' && !notifiedOverdueRef.current.has(inst.id)) {
        notifiedOverdueRef.current.add(inst.id);
        onNotifyAdmin(
          'Cảnh báo quá hạn',
          `Việc "${tpl.title}" (${tpl.startTime}–${tpl.endTime}) đã quá hạn chưa hoàn thành.`,
          inst.id
        );
      }
    }
  }, [instances, templates, currentDate, nowMinutes, onNotifyAdmin]);

  const handleToggleDone = (inst: TaskInstance) => {
    const nextStatus: TaskInstance['status'] = inst.status === 'done' ? 'pending' : 'done';
    const doneAt =
      nextStatus === 'done'
        ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        : undefined;

    setInstances((prev) => {
      const next = prev.map((item) =>
        item.id === inst.id ? { ...item, status: nextStatus, doneAt } : item
      );
      void pushToFirestore('vincons_operations', 'taskInstances', next);
      return next;
    });
  };

  const handleAddPhoto = (inst: TaskInstance, photoUrl: string) => {
    setInstances((prev) => {
      const next = prev.map((item) =>
        item.id === inst.id ? { ...item, photoUrls: [...item.photoUrls, photoUrl] } : item
      );
      void pushToFirestore('vincons_operations', 'taskInstances', next);
      return next;
    });
  };

  const handleRegenerateToday = () => {
    setInstances((prev) => {
      const next = generateDailyInstancesForDate(currentDate, templates, prev, currentUser.id);
      void pushToFirestore('vincons_operations', 'taskInstances', next);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Sub-navigation bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('notes')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition ${
              subTab === 'notes'
                ? 'bg-[#141e42] text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-amber-400" />
            <span>Ghi chú & Việc cần làm</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('daily')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition ${
              subTab === 'daily'
                ? 'bg-[#141e42] text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <CheckSquare className="w-4 h-4 text-emerald-400" />
            <span>Checklist Hằng ngày</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('weekly')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition ${
              subTab === 'weekly'
                ? 'bg-[#141e42] text-white shadow-sm'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Calendar className="w-4 h-4 text-blue-400" />
            <span>Checklist Hằng tuần</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRegenerateToday}
            title="Đồng bộ / Sinh việc hôm nay"
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Làm mới</span>
          </button>

          <button
            type="button"
            onClick={() => setDarkMode((d) => !d)}
            title={darkMode ? 'Chế độ sáng' : 'Chế độ tối'}
            className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-amber-300 hover:bg-slate-200 dark:hover:bg-slate-700 inline-flex items-center justify-center"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {subTab === 'notes' && (
        <WorkNotesWorkspaceTab
          currentDate={currentDate}
          currentUserName={currentUser.name}
        />
      )}

      {subTab === 'daily' && (
        <DailyChecklistTab
          dateStr={currentDate}
          templates={templates}
          instances={instances}
          currentUser={currentUser}
          users={users}
          nowMinutes={nowMinutes}
          onToggleDone={handleToggleDone}
          onAddPhoto={handleAddPhoto}
          onPreviewImage={onPreviewImage}
          onOpenMeals={onOpenMeals}
        />
      )}

      {subTab === 'weekly' && <WeeklyNotebookTab />}
    </div>
  );
}
