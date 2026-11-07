import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import TasksModule from './tasks/TasksModule';
import FirebaseModal from './components/FirebaseModal';
import ImageLightboxModal from './components/ImageLightboxModal';
import MealsModule from './meals';
import {
  INITIAL_USERS,
  INITIAL_HANDOVERS,
  getTodayFormatted,
  createInitialTasks
} from './data/mockData';
import { TaskItem, User, ShiftHandoverItem, NotificationItem } from './types';
import { pushToFirestore, subscribeFirestoreDoc } from './utils/firebase';

const STORAGE_KEYS = {
  TASKS: 'vincons_tasks_v1',
  HANDOVERS: 'vincons_handovers_v1',
  NOTIFICATIONS: 'vincons_notifications_v1',
  CURRENT_USER: 'vincons_current_user_v1',
  ACTIVE_MODULE: 'vincons_active_module_v1'
};

export default function App() {
  const currentDate = getTodayFormatted();
  const [users] = useState<User[]>(INITIAL_USERS);

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER) || INITIAL_USERS[0].id;
  });

  const [activeModule, setActiveModule] = useState<'tasks' | 'meals'>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVE_MODULE);
    return saved === 'meals' ? 'meals' : 'tasks';
  });

  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return createInitialTasks(currentDate);
  });

  const [handoverList, setHandoverList] = useState<ShiftHandoverItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.HANDOVERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_HANDOVERS;
  });

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title?: string } | null>(null);

  const currentUser = users.find(u => u.id === currentUserId) || users[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MODULE, activeModule);
  }, [activeModule]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch {
      // ignore quota errors
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.HANDOVERS, JSON.stringify(handoverList));
    } catch {
      // ignore
    }
  }, [handoverList]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch {
      // ignore
    }
  }, [notifications]);

  useEffect(() => {
    const unsubTasks = subscribeFirestoreDoc<TaskItem[]>('vincons_operations', 'tasks', (remoteTasks) => {
      if (Array.isArray(remoteTasks) && remoteTasks.length > 0) {
        setTasks(remoteTasks);
      }
    });
    const unsubHandovers = subscribeFirestoreDoc<ShiftHandoverItem[]>(
      'vincons_operations',
      'handovers',
      (remoteHandovers) => {
        if (Array.isArray(remoteHandovers)) {
          setHandoverList(remoteHandovers);
        }
      }
    );
    return () => {
      unsubTasks();
      unsubHandovers();
    };
  }, []);

  const handleUpdateTask = (updated: TaskItem) => {
    setTasks(prev => {
      const next = prev.map(t => (t.id === updated.id ? updated : t));
      void pushToFirestore('vincons_operations', 'tasks', next);
      return next;
    });
  };

  const handleCreateHandover = (handover: ShiftHandoverItem) => {
    setHandoverList(prev => {
      const next = [handover, ...prev];
      void pushToFirestore('vincons_operations', 'handovers', next);
      return next;
    });
  };

  const handleAcknowledgeHandover = (handoverId: string) => {
    setHandoverList(prev => {
      const next = prev.map(h =>
        h.id === handoverId
          ? {
              ...h,
              acknowledgedBy: currentUser.name,
              acknowledgedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            }
          : h
      );
      void pushToFirestore('vincons_operations', 'handovers', next);
      return next;
    });
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const handleGenerateTodayTasks = () => {
    const fresh = createInitialTasks(currentDate);
    setTasks(fresh);
    setActiveModule('tasks');
  };

  const handleResetToDefault = () => {
    localStorage.removeItem(STORAGE_KEYS.TASKS);
    localStorage.removeItem(STORAGE_KEYS.HANDOVERS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    setTasks(createInitialTasks(currentDate));
    setHandoverList(INITIAL_HANDOVERS);
    setNotifications([]);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col">
      <Navbar
        currentUser={currentUser}
        users={users}
        onSwitchUser={setCurrentUserId}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onOpenHandover={() => setActiveModule('tasks')}
        onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
        onGenerateTodayTasks={handleGenerateTodayTasks}
        onResetToDefault={handleResetToDefault}
        activeModule={activeModule}
        onModuleChange={setActiveModule}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeModule === 'tasks' ? (
          <TasksModule
            currentUser={currentUser}
            users={users}
            currentDate={currentDate}
            handoverList={handoverList}
            onCreateHandover={handleCreateHandover}
            onAcknowledgeHandover={handleAcknowledgeHandover}
            onPreviewImage={(url, title) => setPreviewImage({ url, title })}
            onOpenMeals={() => setActiveModule('meals')}
            onNotifyAdmin={(title, message, linkTaskId) => {
              const admins = users.filter((u) => u.role === 'manager');
              const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              setNotifications((prev) => [
                ...admins.map((adm) => ({
                  id: `notif-${Date.now()}-${adm.id}-${Math.random().toString(36).slice(2, 6)}`,
                  userId: adm.id,
                  title,
                  message,
                  timestamp: nowStr,
                  read: false,
                  linkTaskId,
                })),
                ...prev,
              ]);
            }}
            onNotifyUser={(userId, title, message) => {
              const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              setNotifications((prev) => [
                {
                  id: `notif-${Date.now()}-${userId}-${Math.random().toString(36).slice(2, 6)}`,
                  userId,
                  title,
                  message,
                  timestamp: nowStr,
                  read: false,
                },
                ...prev,
              ]);
            }}
          />
        ) : (
          <MealsModule />
        )}
      </main>

      <FirebaseModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
      />

      <ImageLightboxModal
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}
