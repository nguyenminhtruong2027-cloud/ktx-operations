import { useState, useEffect } from 'react';
import { User, ChecklistTemplate, TaskItem, NotificationItem, ShiftHandoverItem, MealRecord, AuditLogItem, ManagerNoteItem, WeeklyRoutineItem, NoteStatus } from './types';
import {
  INITIAL_USERS,
  INITIAL_TEMPLATES,
  createInitialTasks,
  INITIAL_HANDOVERS,
  INITIAL_MEAL_RECORDS,
  INITIAL_AUDIT_LOGS,
  INITIAL_MANAGER_NOTES,
  INITIAL_WEEKLY_ROUTINES,
  getTodayFormatted
} from './data/mockData';
import {
  STORAGE_KEYS,
  saveToStorage,
  loadFromStorage,
  distributeTasksRoundRobin
} from './utils/helpers';
import Navbar from './components/Navbar';
import ManagerDashboard from './components/ManagerDashboard';
import StaffDashboard from './components/StaffDashboard';
import FirebaseModal from './components/FirebaseModal';
import MealTrackerModal from './components/MealTrackerModal';
import ImageLightboxModal from './components/ImageLightboxModal';
import MealsApp from './meals/MealsApp';
import { applyThemeOnLoad } from './utils/theme';

const DEFAULT_MEMOS = `[ĐƯỜNG DÂY NÓNG QUAN TRỌNG - BQL LÁN TRẠI & KTX VINCONS]
- Công an phường sở tại: Đ/c Hùng - 0912.345.678 (Xác nhận tạm trú/lưu trú)
- Nhà xe điều phối NCC Suất ăn Hưng Phát: Anh Tuấn - 0988.112.233
- Kỹ thuật điện nước công trường: Anh Long - 0977.889.900
- Đội trưởng bảo vệ cổng chính: 024.3999.xxxx

[CHỈ ĐẠO TUẦN NÀY TỪ BAN TỔNG GIÁM ĐỐC]
1. Đảm bảo an toàn vệ sinh thực phẩm 100%, tuyệt đối không để xảy ra ngộ độc.
2. Kiểm tra chặt chẽ khai báo tạm trú cho các đội thầu phụ mới vào công trường.
3. Duy trì nề nếp vệ sinh KTX theo tiêu chuẩn mới.`;

export default function App() {
  const [currentDate, setCurrentDate] = useState<string>(getTodayFormatted());

  // Load state from localStorage with fallback to initial mock data
  const [users, setUsers] = useState<User[]>(() =>
    loadFromStorage<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS)
  );

  const [currentUser, setCurrentUser] = useState<User>(() => {
    const loadedUsers = loadFromStorage<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    return loadedUsers[0] || INITIAL_USERS[0];
  });

  const [templates, setTemplates] = useState<ChecklistTemplate[]>(() =>
    loadFromStorage<ChecklistTemplate[]>(STORAGE_KEYS.TEMPLATES, INITIAL_TEMPLATES)
  );

  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    loadFromStorage<TaskItem[]>(STORAGE_KEYS.TASKS, createInitialTasks(getTodayFormatted()))
  );

  const [handoverList, setHandoverList] = useState<ShiftHandoverItem[]>(() =>
    loadFromStorage<ShiftHandoverItem[]>(STORAGE_KEYS.HANDOVERS, INITIAL_HANDOVERS)
  );

  const [mealRecords, setMealRecords] = useState<MealRecord[]>(() =>
    loadFromStorage<MealRecord[]>(STORAGE_KEYS.MEALS, INITIAL_MEAL_RECORDS)
  );

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() =>
    loadFromStorage<AuditLogItem[]>(STORAGE_KEYS.LOGS, INITIAL_AUDIT_LOGS)
  );

  const [managerNotes, setManagerNotes] = useState<ManagerNoteItem[]>(() =>
    loadFromStorage<ManagerNoteItem[]>(STORAGE_KEYS.MANAGER_NOTES, INITIAL_MANAGER_NOTES)
  );

  const [weeklyRoutines, setWeeklyRoutines] = useState<WeeklyRoutineItem[]>(() =>
    loadFromStorage<WeeklyRoutineItem[]>(STORAGE_KEYS.WEEKLY_ROUTINES, INITIAL_WEEKLY_ROUTINES)
  );

  const [executiveMemos, setExecutiveMemos] = useState<string>(() =>
    loadFromStorage<string>(STORAGE_KEYS.MANAGER_MEMOS, DEFAULT_MEMOS)
  );

  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    loadFromStorage<NotificationItem[]>(STORAGE_KEYS.NOTIFICATIONS, [
      {
        id: 'notif-1',
        userId: 'u-staff-1',
        title: 'Nhiệm vụ mới trong ca',
        message: 'Bạn được giao kiểm soát suất ăn sáng hôm nay lúc 05:35.',
        timestamp: '05:30',
        read: false
      }
    ])
  );

  // Modals state
  const [firebaseModalOpen, setFirebaseModalOpen] = useState(false);
  const [mealTrackerModalOpen, setMealTrackerModalOpen] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);
  const [lightboxTitle, setLightboxTitle] = useState<string | undefined>(undefined);

  // Auto-sync state changes to LocalStorage
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.USERS, users);
  }, [users]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TEMPLATES, templates);
  }, [templates]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.TASKS, tasks);
  }, [tasks]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.HANDOVERS, handoverList);
  }, [handoverList]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MEALS, mealRecords);
  }, [mealRecords]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.LOGS, auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.NOTIFICATIONS, notifications);
  }, [notifications]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MANAGER_NOTES, managerNotes);
  }, [managerNotes]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.WEEKLY_ROUTINES, weeklyRoutines);
  }, [weeklyRoutines]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.MANAGER_MEMOS, executiveMemos);
  }, [executiveMemos]);

  // Helper to log operational actions to audit trail
  const appendAuditLog = (action: string, target: string, details: string) => {
    const newLog: AuditLogItem = {
      id: `log-${Date.now()}-${Math.random()}`,
      timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
      actorId: currentUser.id,
      actorName: currentUser.name,
      action,
      target,
      details
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const [activeModule, setActiveModule] = useState<'tasks' | 'meals'>(() => {
    const loadedUsers = loadFromStorage<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS);
    const first = loadedUsers[0] || INITIAL_USERS[0];
    return first.canAccessTasks !== false ? 'tasks' : 'meals';
  });

  // Áp dụng theme đã lưu (giữ nguyên qua F5)
  useEffect(() => {
    applyThemeOnLoad();
  }, []);

  // Switch user handler
  const handleSwitchUser = (userId: string) => {
    const found = users.find(u => u.id === userId);
    if (found) {
      setCurrentUser(found);
      // Check permission for active module
      if (activeModule === 'tasks' && found.canAccessTasks === false) {
        if (found.canAccessMeals !== false) {
          setActiveModule('meals');
        }
      } else if (activeModule === 'meals' && found.canAccessMeals === false) {
        if (found.canAccessTasks !== false) {
          setActiveModule('tasks');
        }
      }
    }
  };

  // Generate today tasks handler
  const handleGenerateTodayTasks = () => {
    const existingIds = new Set(tasks.filter(t => t.date === currentDate).map(t => t.templateId));
    const newGenerated = createInitialTasks(currentDate).filter(t => !existingIds.has(t.templateId));
    
    if (newGenerated.length === 0) {
      alert(`Tất cả phiếu việc cho ngày ${currentDate} đã được sinh đầy đủ từ trước.`);
      return;
    }

    setTasks(prev => [...prev, ...newGenerated]);
    appendAuditLog(
      'SINH_PHIEU_VIEC',
      `Ngày ${currentDate}`,
      `Đã sinh tự động ${newGenerated.length} phiếu việc theo mẫu checklist`
    );
    alert(`Đã sinh thành công ${newGenerated.length} phiếu việc mới cho ngày ${currentDate}!`);
  };

  // Round-Robin task distribution (Chia đều việc chưa giao)
  const handleRoundRobinDistribute = () => {
    const activeStaff = users.filter(u => u.role === 'staff' && u.isActive);
    if (activeStaff.length === 0) {
      alert('Không có nhân sự vận hành nào đang ở trạng thái Hoạt động!');
      return;
    }

    const { updatedTasks, distributedCount } = distributeTasksRoundRobin(tasks, activeStaff);
    if (distributedCount === 0) {
      alert('Không có công việc nào chưa giao (unassigned) trong hệ thống.');
      return;
    }

    setTasks(updatedTasks);
    appendAuditLog(
      'CHIA_DEU_VIEC_XOAY_VONG',
      `Toàn ca ngày ${currentDate}`,
      `Đã phân bổ tròn đều ${distributedCount} công việc cho ${activeStaff.length} nhân sự hoạt động`
    );
    alert(`Đã chia đều thành công ${distributedCount} việc cho ${activeStaff.length} nhân viên vận hành!`);
  };

  const handleUpdateTask = (updatedTask: TaskItem) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));

    // Audit log
    appendAuditLog(
      `CAP_NHAT_TASK_${updatedTask.status.toUpperCase().replace(/\s+/g, '_')}`,
      updatedTask.title,
      `Trạng thái: ${updatedTask.status}${updatedTask.resultText ? ` | Kết quả: ${updatedTask.resultText}` : ''}`
    );

    // If task status became 'Chờ duyệt', notify manager
    if (updatedTask.status === 'Chờ duyệt') {
      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}`,
        userId: 'u-mgr-1',
        title: 'Có việc chờ duyệt kết quả',
        message: `${currentUser.name} đã hoàn thành công việc "${updatedTask.title}" và chờ duyệt.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        read: false,
        linkTaskId: updatedTask.id
      };
      setNotifications(prev => [newNotif, ...prev]);
    }
  };

  const handleCreateTask = (newTaskData: Partial<TaskItem>) => {
    const newTask: TaskItem = {
      id: `task-custom-${Date.now()}`,
      templateId: 'tpl-custom',
      date: currentDate,
      startTime: newTaskData.startTime || '08:00',
      endTime: newTaskData.endTime || '09:00',
      title: newTaskData.title || 'Công việc phát sinh',
      group: newTaskData.group || 'Hằng ngày',
      requirements: newTaskData.requirements || ['Thực hiện theo chỉ đạo của quản lý'],
      assigneeId: newTaskData.assigneeId || users[1]?.id || '',
      assignerId: currentUser.id,
      status: 'Chưa làm',
      proofRequired: true,
      isImportant: newTaskData.isImportant || false,
      proofImages: [],
      history: [
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
          actorName: currentUser.name,
          action: 'Tạo công việc phát sinh đột xuất'
        }
      ]
    };
    setTasks(prev => [newTask, ...prev]);

    appendAuditLog(
      'TAO_VIEC_PHAT_SINH',
      newTask.title,
      `Giờ thực hiện: ${newTask.startTime}-${newTask.endTime}, giao cho nhân sự ID: ${newTask.assigneeId}`
    );

    // Notify assignee
    if (newTask.assigneeId) {
      const assigneeNotif: NotificationItem = {
        id: `notif-${Date.now()}`,
        userId: newTask.assigneeId,
        title: 'Bạn nhận được công việc mới',
        message: `Quản lý vừa giao việc: "${newTask.title}" vào lúc ${newTask.startTime}`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        read: false,
        linkTaskId: newTask.id
      };
      setNotifications(prev => [assigneeNotif, ...prev]);
    }
  };

  const handleDeleteTask = (taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    if (taskToDelete) {
      appendAuditLog('XOA_CONG_VIEC', taskToDelete.title, `Đã xóa phiếu việc ${taskId}`);
    }
  };

  const handleBulkAssign = (taskIds: string[], assigneeId: string) => {
    const assignee = users.find(u => u.id === assigneeId);
    setTasks(prev => prev.map(t => {
      if (taskIds.includes(t.id)) {
        return {
          ...t,
          assigneeId,
          history: [
            ...t.history,
            {
              id: `hist-${Date.now()}-${Math.random()}`,
              timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
              actorName: currentUser.name,
              action: 'Giao lại hàng loạt',
              details: `Giao cho ${assignee?.name || assigneeId}`
            }
          ]
        };
      }
      return t;
    }));

    appendAuditLog(
      'GIAO_LAI_HANG_LOAT',
      `${taskIds.length} công việc`,
      `Đã chuyển giao cho ${assignee?.name || assigneeId}`
    );
    alert(`Đã giao lại thành công ${taskIds.length} việc cho ${assignee?.name}!`);
  };

  const handleBulkDelete = (taskIds: string[]) => {
    setTasks(prev => prev.filter(t => !taskIds.includes(t.id)));
    appendAuditLog('XOA_HANG_LOAT', `${taskIds.length} công việc`, 'Quản lý đã xóa hàng loạt');
  };

  const handleSaveTemplate = (template: ChecklistTemplate) => {
    setTemplates(prev => {
      const exists = prev.some(t => t.id === template.id);
      if (exists) {
        return prev.map(t => t.id === template.id ? template : t);
      }
      return [template, ...prev];
    });
    appendAuditLog('CAP_NHAT_MAU_CHECKLIST', template.title, 'Đã lưu mẫu checklist');
  };

  const handleDeleteTemplate = (templateId: string) => {
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    appendAuditLog('XOA_MAU_CHECKLIST', templateId, 'Đã xóa mẫu checklist khỏi danh mục');
  };

  const handleSaveUser = (user: User) => {
    setUsers(prev => {
      const exists = prev.some(u => u.id === user.id);
      if (exists) {
        return prev.map(u => u.id === user.id ? user : u);
      }
      return [...prev, user];
    });
    appendAuditLog('CAP_NHAT_NHAN_SU', user.name, `Vai trò: ${user.role}, khu vực: ${user.khuVuc}`);
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const handleCreateHandover = (handover: ShiftHandoverItem) => {
    setHandoverList(prev => [handover, ...prev]);
    appendAuditLog(
      'LAP_BIEN_BAN_BAN_GIAO_CA',
      handover.shift,
      `Bàn giao bởi ${handover.authorName}, việc tồn đọng: ${handover.pendingTasksCount}`
    );
  };

  const handleAcknowledgeHandover = (handoverId: string) => {
    setHandoverList(prev => prev.map(h => {
      if (h.id === handoverId) {
        return {
          ...h,
          status: 'acknowledged',
          acknowledgedBy: currentUser.id,
          acknowledgedByName: currentUser.name,
          acknowledgedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        };
      }
      return h;
    }));

    appendAuditLog(
      'TIEP_NHAN_BAN_GIAO_CA',
      handoverId,
      `Chuyên viên ${currentUser.name} (${currentUser.code}) đã xác nhận tiếp nhận ca trực`
    );
    alert('Đã xác nhận tiếp nhận bàn giao ca trực thành công!');
  };

  const handleSaveMealRecord = (record: MealRecord) => {
    setMealRecords(prev => {
      const exists = prev.some(m => m.id === record.id);
      if (exists) {
        return prev.map(m => m.id === record.id ? record : m);
      }
      return [record, ...prev];
    });
    appendAuditLog(
      'CAP_NHAT_SUAT_AN',
      `Bữa ${record.mealType}`,
      `Đặt: ${record.orderedCount}, Nhận: ${record.receivedCount}, Đã phát: ${record.distributedCount}, Lưu mẫu: ${record.sampleStored ? 'Có' : 'Không'}`
    );
  };

  // Manager Workspace Handlers
  const handleSaveNote = (note: ManagerNoteItem) => {
    setManagerNotes(prev => {
      const exists = prev.some(n => n.id === note.id);
      if (exists) {
        return prev.map(n => n.id === note.id ? note : n);
      }
      return [note, ...prev];
    });
    appendAuditLog('LƯU_GHI_CHU_QUAN_LY', note.title, `Trạng thái: ${note.status}, Mức ưu tiên: ${note.priority}`);
  };

  const handleDeleteNote = (noteId: string) => {
    const found = managerNotes.find(n => n.id === noteId);
    setManagerNotes(prev => prev.filter(n => n.id !== noteId));
    if (found) {
      appendAuditLog('XOA_GHI_CHU_QUAN_LY', found.title, `Đã xóa ghi chú ${noteId}`);
    }
  };

  const handleToggleNoteStatus = (noteId: string, currentStatus: NoteStatus) => {
    const nextStatus: NoteStatus = currentStatus === 'done' ? 'todo' : 'done';
    setManagerNotes(prev => prev.map(n => {
      if (n.id === noteId) {
        return {
          ...n,
          status: nextStatus,
          completedAt: nextStatus === 'done' ? new Date().toISOString().slice(0, 16).replace('T', ' ') : undefined
        };
      }
      return n;
    }));
  };

  const handleSaveWeeklyRoutine = (routine: WeeklyRoutineItem) => {
    setWeeklyRoutines(prev => {
      const exists = prev.some(r => r.id === routine.id);
      if (exists) {
        return prev.map(r => r.id === routine.id ? routine : r);
      }
      return [routine, ...prev];
    });
    appendAuditLog('LƯU_DAU_VIEC_TUAN', routine.title, `Thứ ${routine.dayOfWeek}, khung giờ: ${routine.timeSlot}`);
  };

  const handleDeleteWeeklyRoutine = (routineId: string) => {
    const found = weeklyRoutines.find(r => r.id === routineId);
    setWeeklyRoutines(prev => prev.filter(r => r.id !== routineId));
    if (found) {
      appendAuditLog('XOA_DAU_VIEC_TUAN', found.title, `Đã xóa đầu việc tuần ${routineId}`);
    }
  };

  const handleToggleWeeklyRoutine = (routineId: string) => {
    setWeeklyRoutines(prev => prev.map(r => {
      if (r.id === routineId) {
        const nextDone = !r.isCompleted;
        return {
          ...r,
          isCompleted: nextDone,
          completedAt: nextDone ? new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : undefined
        };
      }
      return r;
    }));
  };

  const handleResetWeeklyChecklist = () => {
    const completedCount = weeklyRoutines.filter(r => r.isCompleted).length;
    if (confirm(`Bạn có chắc muốn lưu kết quả tuần này (${completedCount}/${weeklyRoutines.length} việc hoàn thành) và làm mới checklist cho tuần tiếp theo?`)) {
      setWeeklyRoutines(prev => prev.map(r => ({
        ...r,
        isCompleted: false,
        completedAt: undefined,
        completedNotes: undefined
      })));
      appendAuditLog(
        'LAP_LAI_CHECKLIST_TUAN_MOI',
        'Checklist tuần VINCONS',
        `Đã lưu kết quả tuần cũ (${completedCount} việc) và làm mới toàn bộ ${weeklyRoutines.length} đầu việc cho tuần mới`
      );
      alert('Đã khởi động tuần làm việc mới thành công! Toàn bộ đầu việc tuần đã sẵn sàng để tiếp tục kiểm tra.');
    }
  };

  const handleSaveExecutiveMemos = (memos: string) => {
    setExecutiveMemos(memos);
  };

  // Reset to factory mock data
  const handleResetToDefault = () => {
    localStorage.clear();
    setUsers(INITIAL_USERS);
    setCurrentUser(INITIAL_USERS[0]);
    setTemplates(INITIAL_TEMPLATES);
    setTasks(createInitialTasks(getTodayFormatted()));
    setHandoverList(INITIAL_HANDOVERS);
    setMealRecords(INITIAL_MEAL_RECORDS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setManagerNotes(INITIAL_MANAGER_NOTES);
    setWeeklyRoutines(INITIAL_WEEKLY_ROUTINES);
    setExecutiveMemos(DEFAULT_MEMOS);
    setNotifications([
      {
        id: 'notif-1',
        userId: 'u-staff-1',
        title: 'Nhiệm vụ mới trong ca',
        message: 'Bạn được giao kiểm soát suất ăn sáng hôm nay lúc 05:35.',
        timestamp: '05:30',
        read: false
      }
    ]);
    alert('Đã khôi phục toàn bộ dữ liệu mẫu ban đầu của hệ thống VINCONS!');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-['Be_Vietnam_Pro'] text-slate-800">
      <Navbar
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onOpenHandover={() => {}}
        onOpenFirebaseModal={() => setFirebaseModalOpen(true)}
        onGenerateTodayTasks={handleGenerateTodayTasks}
        onResetToDefault={handleResetToDefault}
        activeModule={activeModule}
        onModuleChange={(mod) => {
          if (mod === 'tasks' && currentUser.canAccessTasks === false) {
            alert('Bạn không có quyền truy cập module Công việc.');
            return;
          }
          if (mod === 'meals' && currentUser.canAccessMeals === false) {
            alert('Bạn không có quyền truy cập module Suất ăn.');
            return;
          }
          setActiveModule(mod);
        }}
      />

      <main className="flex-1 pb-12">
        {activeModule === 'meals' ? (
          <MealsApp />
        ) : currentUser.role === 'manager' ? (
          <ManagerDashboard
            tasks={tasks}
            templates={templates}
            users={users}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            onUpdateTask={handleUpdateTask}
            onCreateTask={handleCreateTask}
            onDeleteTask={handleDeleteTask}
            onSaveTemplate={handleSaveTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            onSaveUser={handleSaveUser}
            onGenerateTasks={handleGenerateTodayTasks}
            onRoundRobinDistribute={handleRoundRobinDistribute}
            onBulkAssign={handleBulkAssign}
            onBulkDelete={handleBulkDelete}
            mealRecords={mealRecords}
            onOpenMealTracker={() => setMealTrackerModalOpen(true)}
            auditLogs={auditLogs}
            onPreviewImage={(url, title) => {
              setLightboxImageUrl(url);
              setLightboxTitle(title);
            }}
            managerNotes={managerNotes}
            weeklyRoutines={weeklyRoutines}
            onSaveNote={handleSaveNote}
            onDeleteNote={handleDeleteNote}
            onToggleNoteStatus={handleToggleNoteStatus}
            onSaveWeeklyRoutine={handleSaveWeeklyRoutine}
            onDeleteWeeklyRoutine={handleDeleteWeeklyRoutine}
            onToggleWeeklyRoutine={handleToggleWeeklyRoutine}
            onResetWeeklyChecklist={handleResetWeeklyChecklist}
            executiveMemos={executiveMemos}
            onSaveExecutiveMemos={handleSaveExecutiveMemos}
          />
        ) : (
          <StaffDashboard
            tasks={tasks}
            currentUser={currentUser}
            currentDate={currentDate}
            onUpdateTask={handleUpdateTask}
            handoverList={handoverList}
            onCreateHandover={handleCreateHandover}
            onAcknowledgeHandover={handleAcknowledgeHandover}
            onPreviewImage={(url, title) => {
              setLightboxImageUrl(url);
              setLightboxTitle(title);
            }}
          />
        )}
      </main>

      <FirebaseModal
        isOpen={firebaseModalOpen}
        onClose={() => setFirebaseModalOpen(false)}
      />

      <MealTrackerModal
        isOpen={mealTrackerModalOpen}
        onClose={() => setMealTrackerModalOpen(false)}
        currentDate={currentDate}
        mealRecords={mealRecords}
        onSaveMealRecord={handleSaveMealRecord}
        onSyncWithTasks={() => {}}
      />

      <ImageLightboxModal
        imageUrl={lightboxImageUrl}
        title={lightboxTitle}
        onClose={() => setLightboxImageUrl(null)}
      />

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-6 text-center text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 space-y-1">
          <p className="font-semibold text-slate-300">Công ty CP Phát triển và Đầu tư Xây dựng VINCONS</p>
          <p>Hệ thống Điều hành công việc vận hành lán trại & ký túc xá công nhân • Múi giờ Asia/Ho_Chi_Minh</p>
        </div>
      </footer>
    </div>
  );
}
