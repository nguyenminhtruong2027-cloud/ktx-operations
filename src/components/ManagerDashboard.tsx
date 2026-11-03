import { useState } from 'react';
import { TaskItem, ChecklistTemplate, User, ChecklistGroup, TaskStatus, MealRecord, AuditLogItem, ManagerNoteItem, WeeklyRoutineItem, NoteStatus } from '../types';
import { isTaskOverdue, formatDateVN, exportToCSV, calculateStaffKPI } from '../utils/helpers';
import ManagerWorkspaceTab from './ManagerWorkspaceTab';
import {
  CheckCircle2, Clock, AlertTriangle, Users, FileSpreadsheet, Printer,
  Plus, Search, Filter, Calendar, Edit3, Trash2, Check, RotateCcw, Shield,
  Layers, CheckSquare, XCircle, Send, ChevronRight, UserCheck, Lock, Unlock,
  Utensils, Shuffle, Award, Activity, CheckCheck, Eye, Phone, MapPin, Sparkles,
  Bookmark, Briefcase, Pin
} from 'lucide-react';

interface ManagerDashboardProps {
  tasks: TaskItem[];
  templates: ChecklistTemplate[];
  users: User[];
  currentDate: string;
  onDateChange: (date: string) => void;
  onUpdateTask: (task: TaskItem) => void;
  onCreateTask: (task: Partial<TaskItem>) => void;
  onDeleteTask: (taskId: string) => void;
  onSaveTemplate: (template: ChecklistTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  onSaveUser: (user: User) => void;
  onGenerateTasks: () => void;
  onRoundRobinDistribute: () => void;
  onBulkAssign: (taskIds: string[], assigneeId: string) => void;
  onBulkDelete: (taskIds: string[]) => void;
  mealRecords: MealRecord[];
  onOpenMealTracker: () => void;
  auditLogs: AuditLogItem[];
  onPreviewImage: (url: string, title?: string) => void;
  managerNotes: ManagerNoteItem[];
  weeklyRoutines: WeeklyRoutineItem[];
  onSaveNote: (note: ManagerNoteItem) => void;
  onDeleteNote: (noteId: string) => void;
  onToggleNoteStatus: (noteId: string, currentStatus: NoteStatus) => void;
  onSaveWeeklyRoutine: (routine: WeeklyRoutineItem) => void;
  onDeleteWeeklyRoutine: (routineId: string) => void;
  onToggleWeeklyRoutine: (routineId: string) => void;
  onResetWeeklyChecklist: () => void;
  executiveMemos: string;
  onSaveExecutiveMemos: (memos: string) => void;
}

export default function ManagerDashboard({
  tasks,
  templates,
  users,
  currentDate,
  onDateChange,
  onUpdateTask,
  onCreateTask,
  onDeleteTask,
  onSaveTemplate,
  onDeleteTemplate,
  onSaveUser,
  onGenerateTasks,
  onRoundRobinDistribute,
  onBulkAssign,
  onBulkDelete,
  mealRecords,
  onOpenMealTracker,
  auditLogs,
  onPreviewImage,
  managerNotes,
  weeklyRoutines,
  onSaveNote,
  onDeleteNote,
  onToggleNoteStatus,
  onSaveWeeklyRoutine,
  onDeleteWeeklyRoutine,
  onToggleWeeklyRoutine,
  onResetWeeklyChecklist,
  executiveMemos,
  onSaveExecutiveMemos
}: ManagerDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'workspace' | 'tasks' | 'templates' | 'staff' | 'kpi' | 'audit' | 'reports'>('workspace');
  
  // Filter states for tasks
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [bulkAssignStaffId, setBulkAssignStaffId] = useState<string>('');

  // Modals
  const [reviewModalTask, setReviewModalTask] = useState<TaskItem | null>(null);
  const [managerNote, setManagerNote] = useState<string>('');
  
  const [editTaskModalOpen, setEditTaskModalOpen] = useState(false);
  const [currentEditingTask, setCurrentEditingTask] = useState<Partial<TaskItem> | null>(null);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [currentEditingTemplate, setCurrentEditingTemplate] = useState<Partial<ChecklistTemplate> | null>(null);

  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [currentEditingStaff, setCurrentEditingStaff] = useState<Partial<User> | null>(null);

  const staffUsers = users.filter(u => u.role === 'staff');

  // Filter tasks for selected date
  const dateTasks = tasks.filter(t => t.date === currentDate);
  
  // Stats
  const totalTasks = dateTasks.length;
  const completedTasks = dateTasks.filter(t => t.status === 'Hoàn thành').length;
  const pendingReviewTasks = dateTasks.filter(t => t.status === 'Chờ duyệt').length;
  const inProgressTasks = dateTasks.filter(t => t.status === 'Đang làm').length;
  const overdueTasks = dateTasks.filter(t => isTaskOverdue(t)).length;
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Attention list (overdue, important pending, pending review)
  const attentionTasks = dateTasks.filter(t => 
    isTaskOverdue(t) || (t.isImportant && t.status !== 'Hoàn thành') || t.status === 'Chờ duyệt'
  );

  // Filtered task list for table
  const filteredTasks = dateTasks.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (groupFilter !== 'all' && t.group !== groupFilter) return false;
    if (assigneeFilter !== 'all' && t.assigneeId !== assigneeFilter) return false;
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const handleApprove = (task: TaskItem) => {
    const updated: TaskItem = {
      ...task,
      status: 'Hoàn thành',
      managerNotes: managerNote || 'Đã duyệt kết quả công việc đạt tiêu chuẩn VINCONS.',
      history: [
        ...task.history,
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
          actorName: 'Quản lý',
          action: 'Duyệt hoàn thành công việc',
          details: managerNote || 'Đạt tiêu chuẩn'
        }
      ]
    };
    onUpdateTask(updated);
    setReviewModalTask(null);
    setManagerNote('');
  };

  const handleRejectRework = (task: TaskItem) => {
    if (!managerNote.trim()) {
      alert('Vui lòng nhập ghi chú yêu cầu làm lại cho nhân viên.');
      return;
    }
    const updated: TaskItem = {
      ...task,
      status: 'Cần làm lại',
      managerNotes: managerNote,
      history: [
        ...task.history,
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
          actorName: 'Quản lý',
          action: 'Yêu cầu làm lại',
          details: managerNote
        }
      ]
    };
    onUpdateTask(updated);
    setReviewModalTask(null);
    setManagerNote('');
  };

  const toggleSelectAll = () => {
    if (selectedTaskIds.length === filteredTasks.length) {
      setSelectedTaskIds([]);
    } else {
      setSelectedTaskIds(filteredTasks.map(t => t.id));
    }
  };

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleExecuteBulkAssign = () => {
    if (!bulkAssignStaffId) {
      alert('Vui lòng chọn nhân sự muốn giao việc.');
      return;
    }
    if (selectedTaskIds.length === 0) {
      alert('Vui lòng chọn ít nhất 1 công việc để giao lại.');
      return;
    }
    onBulkAssign(selectedTaskIds, bulkAssignStaffId);
    setSelectedTaskIds([]);
  };

  const handleExecuteBulkDelete = () => {
    if (selectedTaskIds.length === 0) return;
    if (confirm(`Bạn có chắc chắn muốn xóa ${selectedTaskIds.length} công việc đã chọn?`)) {
      onBulkDelete(selectedTaskIds);
      setSelectedTaskIds([]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Date Selector & Operational Command Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-(--vc-brand-2)/10 text-(--vc-brand-2) rounded-lg">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-bold text-slate-900">Bảng Điều hành & Quản lý Nhân sự VINCONS</h2>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full">
                Trực tuyến 24/7
              </span>
            </div>
            <p className="text-xs text-slate-500">Giám sát lán trại & KTX công nhân • Ngày {formatDateVN(currentDate)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date Picker */}
          <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-600">Chọn ngày:</span>
            <input
              type="date"
              value={currentDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="text-xs font-bold text-(--vc-brand-2) bg-transparent focus:outline-none cursor-pointer"
            />
          </div>

          {/* Meal Control Trigger */}
          <button
            onClick={onOpenMealTracker}
            className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs rounded-lg transition shadow-sm flex items-center space-x-1.5"
            title="Mở Sổ đối chiếu & Kiểm soát Suất ăn VINCONS"
          >
            <Utensils className="w-4 h-4" />
            <span>Đối chiếu suất ăn ({mealRecords.filter(m => m.date === currentDate).length})</span>
          </button>

          {/* Round Robin Balancing Button */}
          <button
            onClick={onRoundRobinDistribute}
            className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white font-medium text-xs rounded-lg transition shadow-sm flex items-center space-x-1.5"
            title="Chia đều công việc chưa giao theo vòng tròn cho nhân viên đang hoạt động"
          >
            <Shuffle className="w-4 h-4 text-amber-300" />
            <span>Chia đều việc chưa giao</span>
          </button>

          {/* Generate Tasks */}
          <button
            onClick={onGenerateTasks}
            className="px-3 py-2 bg-(--vc-brand-2) hover:bg-blue-900 text-white font-bold text-xs rounded-lg transition shadow-sm flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>Sinh phiếu việc</span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl shadow-sm overflow-x-auto">
        {[
          { id: 'workspace', label: `Điều hành & Tracker Lán trại (${managerNotes.filter(n => n.status !== 'done').length})`, icon: Briefcase, isSpecial: true },
          { id: 'overview', label: 'Tổng quan ngày', icon: Layers },
          { id: 'tasks', label: `Quản lý công việc (${dateTasks.length})`, icon: CheckSquare },
          { id: 'kpi', label: 'Đánh giá KPI & Hiệu suất', icon: Award },
          { id: 'templates', label: `Mẫu Checklist (${templates.length})`, icon: FileSpreadsheet },
          { id: 'staff', label: `Nhân sự (${users.length})`, icon: Users },
          { id: 'audit', label: `Nhật ký hệ thống (${auditLogs.length})`, icon: Activity },
          { id: 'reports', label: 'Báo cáo & Xuất file', icon: Printer },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-3 px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition ${
                isActive
                  ? 'border-(--vc-brand-2) text-(--vc-brand-2) font-bold bg-blue-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className={`w-4 h-4 ${tab.isSpecial ? 'text-amber-500' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB: KHÔNG GIAN QUẢN LÝ — ĐIỀU HÀNH & TRACKER LÁN TRẠI (tracker + đồng hồ đã nhập chung) */}
      {activeTab === 'workspace' && (
        <ManagerWorkspaceTab
          notes={managerNotes}
          weeklyRoutines={weeklyRoutines}
          users={users}
          onSaveNote={onSaveNote}
          onDeleteNote={onDeleteNote}
          onToggleNoteStatus={onToggleNoteStatus}
          onSaveWeeklyRoutine={onSaveWeeklyRoutine}
          onDeleteWeeklyRoutine={onDeleteWeeklyRoutine}
          onToggleWeeklyRoutine={onToggleWeeklyRoutine}
          onResetWeeklyChecklist={onResetWeeklyChecklist}
          executiveMemos={executiveMemos}
          onSaveExecutiveMemos={onSaveExecutiveMemos}
        />
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Tổng số việc</span>
                <CheckSquare className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-slate-900 mt-2">{totalTasks}</div>
              <div className="text-[11px] text-slate-500 mt-1">Đã lên lịch hôm nay</div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Hoàn thành</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-emerald-600 mt-2">{completedTasks}</div>
              <div className="text-[11px] text-slate-500 mt-1">{progressPercent}% tiến độ chung</div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Chờ duyệt</span>
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-600 mt-2">{pendingReviewTasks}</div>
              <div className="text-[11px] text-slate-500 mt-1">Cần quản lý kiểm tra</div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Đang thực hiện</span>
                <RotateCcw className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold text-amber-600 mt-2">{inProgressTasks}</div>
              <div className="text-[11px] text-slate-500 mt-1">Nhân viên đang xử lý</div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Quá hạn</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div className="text-2xl font-bold text-red-600 mt-2">{overdueTasks}</div>
              <div className="text-[11px] text-slate-500 mt-1">Chưa xong & quá giờ</div>
            </div>
          </div>

          {/* Progress Bar overall */}
          <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-sm text-slate-800">Tỷ lệ hoàn thành công việc toàn ca/ngày</span>
              <span className="font-bold text-sm text-(--vc-brand-2)">{progressPercent}%</span>
            </div>
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
              <div
                className="bg-(--vc-brand-2) h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Attention List ("Cần chú ý") */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-sm text-slate-900">Danh sách Cần chú ý ngay</h3>
                </div>
                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                  {attentionTasks.length} việc
                </span>
              </div>

              <div className="space-y-3 max-h-80 overflow-y-auto">
                {attentionTasks.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-8">Tuyệt vời! Không có việc nào quá hạn hoặc cần chú ý đặc biệt.</p>
                ) : (
                  attentionTasks.map(task => {
                    const assignee = users.find(u => u.id === task.assigneeId);
                    const overdue = isTaskOverdue(task);
                    return (
                      <div
                        key={task.id}
                        className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
                          overdue ? 'bg-red-50 border-red-200' : 'bg-amber-50/50 border-amber-200'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-(--vc-brand-2)">{task.startTime} - {task.endTime}</span>
                            {task.isImportant && (
                              <span className="px-1.5 py-0.5 bg-amber-500 text-slate-900 text-[10px] font-bold rounded">
                                Quan trọng
                              </span>
                            )}
                            {overdue && (
                              <span className="px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded">
                                Quá hạn
                              </span>
                            )}
                            {task.status === 'Chờ duyệt' && (
                              <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">
                                Chờ duyệt
                              </span>
                            )}
                          </div>
                          <div className="font-semibold text-slate-800">{task.title}</div>
                          <div className="text-slate-500">Phụ trách: <span className="font-medium text-slate-700">{assignee?.name || 'Chưa gán'}</span></div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {task.status === 'Chờ duyệt' && (
                            <button
                              onClick={() => {
                                setReviewModalTask(task);
                                setActiveTab('tasks');
                              }}
                              className="px-2.5 py-1 bg-(--vc-brand-2) text-white text-xs font-medium rounded hover:bg-blue-800 transition shadow-sm"
                            >
                              Duyệt ngay
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Staff Progress Breakdown */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 text-(--vc-brand-2)" />
                  <h3 className="font-bold text-sm text-slate-900">Tiến độ theo Nhân sự vận hành</h3>
                </div>
                <button
                  onClick={() => setActiveTab('kpi')}
                  className="text-xs text-(--vc-brand-2) hover:underline font-semibold"
                >
                  Xem chi tiết KPI →
                </button>
              </div>

              <div className="space-y-4">
                {staffUsers.map(staff => {
                  const staffTasks = dateTasks.filter(t => t.assigneeId === staff.id);
                  const staffCompleted = staffTasks.filter(t => t.status === 'Hoàn thành').length;
                  const staffPct = staffTasks.length > 0 ? Math.round((staffCompleted / staffTasks.length) * 100) : 0;

                  return (
                    <div key={staff.id} className="space-y-1.5 p-2 rounded-lg hover:bg-slate-50 transition">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <img src={staff.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                          <span className="font-bold text-slate-800">{staff.name}</span>
                          <span className="text-slate-400">({staff.code})</span>
                        </div>
                        <span className="font-bold text-(--vc-brand-2)">{staffCompleted}/{staffTasks.length} việc ({staffPct}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            staffPct === 100 ? 'bg-emerald-500' : 'bg-(--vc-brand-2)'
                          }`}
                          style={{ width: `${staffPct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TASKS MANAGEMENT */}
      {activeTab === 'tasks' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Tìm tên công việc..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-(--vc-brand-2) w-48 sm:w-64"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none text-slate-700 bg-white"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="Chưa làm">Chưa làm</option>
                <option value="Đang làm">Đang làm</option>
                <option value="Hoàn thành">Hoàn thành</option>
                <option value="Chờ duyệt">Chờ duyệt</option>
                <option value="Cần làm lại">Cần làm lại</option>
              </select>

              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none text-slate-700 bg-white"
              >
                <option value="all">Tất cả nhóm</option>
                <option value="Hằng ngày">Hằng ngày</option>
                <option value="Hằng tuần">Hằng tuần</option>
                <option value="Hằng tháng">Hằng tháng</option>
              </select>

              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="py-2 px-3 text-xs border border-slate-200 rounded-lg focus:outline-none text-slate-700 bg-white"
              >
                <option value="all">Tất cả nhân sự</option>
                {staffUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setCurrentEditingTask({
                    date: currentDate,
                    startTime: '08:00',
                    endTime: '09:00',
                    title: '',
                    group: 'Hằng ngày',
                    requirements: ['Thực hiện theo chỉ đạo quản lý'],
                    assigneeId: staffUsers[0]?.id || '',
                    assignerId: 'u-mgr-1',
                    status: 'Chưa làm',
                    proofRequired: true,
                    isImportant: false,
                    proofImages: [],
                    history: []
                  });
                  setEditTaskModalOpen(true);
                }}
                className="px-3 py-2 bg-(--vc-brand-2) hover:bg-blue-900 text-white font-medium text-xs rounded-lg transition shadow-sm flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm việc phát sinh</span>
              </button>
            </div>
          </div>

          {/* Bulk Action Bar */}
          {selectedTaskIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg text-xs gap-2">
              <span className="font-bold text-(--vc-brand-2)">
                Đã chọn {selectedTaskIds.length} công việc
              </span>
              <div className="flex items-center space-x-2">
                <select
                  value={bulkAssignStaffId}
                  onChange={(e) => setBulkAssignStaffId(e.target.value)}
                  className="py-1 px-2 border border-slate-300 rounded bg-white text-xs"
                >
                  <option value="">-- Chọn người nhận việc --</option>
                  {staffUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                  ))}
                </select>
                <button
                  onClick={handleExecuteBulkAssign}
                  className="px-3 py-1 bg-(--vc-brand-2) text-white rounded font-semibold text-xs hover:bg-blue-900"
                >
                  Giao lại hàng loạt
                </button>
                <button
                  onClick={handleExecuteBulkDelete}
                  className="px-3 py-1 bg-red-600 text-white rounded font-semibold text-xs hover:bg-red-700"
                >
                  Xóa các việc đã chọn
                </button>
              </div>
            </div>
          )}

          {/* Task Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="p-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedTaskIds.length === filteredTasks.length && filteredTasks.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-(--vc-brand-2) rounded"
                    />
                  </th>
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">Công việc</th>
                  <th className="p-3">Nhóm</th>
                  <th className="p-3">Phụ trách</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Minh chứng</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      Không tìm thấy công việc nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map(task => {
                    const assignee = users.find(u => u.id === task.assigneeId);
                    const overdue = isTaskOverdue(task);
                    const isSelected = selectedTaskIds.includes(task.id);

                    return (
                      <tr key={task.id} className={`hover:bg-slate-50/80 transition ${isSelected ? 'bg-blue-50/40' : ''}`}>
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectTask(task.id)}
                            className="w-4 h-4 text-(--vc-brand-2) rounded"
                          />
                        </td>
                        <td className="p-3 font-semibold text-(--vc-brand-2) whitespace-nowrap">
                          {task.startTime} - {task.endTime}
                        </td>
                        <td className="p-3 max-w-xs">
                          <div className="font-semibold text-slate-900 flex items-center space-x-1.5">
                            <span>{task.title}</span>
                            {task.isImportant && (
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                                Quan trọng
                              </span>
                            )}
                          </div>
                          {task.resultText && (
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">KQ: {task.resultText}</div>
                          )}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-(--vc-brand-2) rounded font-medium text-[10px]">
                            {task.group}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700 whitespace-nowrap">
                          {assignee ? `${assignee.name} (${assignee.code})` : <span className="text-amber-600 font-bold">Chưa gán</span>}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          {overdue ? (
                            <span className="px-2.5 py-1 bg-red-100 text-red-700 font-bold rounded-full text-[10px]">
                              Quá hạn
                            </span>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full font-medium text-[10px] ${
                              task.status === 'Hoàn thành' ? 'bg-emerald-100 text-emerald-800' :
                              task.status === 'Chờ duyệt' ? 'bg-blue-100 text-blue-800' :
                              task.status === 'Đang làm' ? 'bg-amber-100 text-amber-800' :
                              task.status === 'Cần làm lại' ? 'bg-purple-100 text-purple-800' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {task.status}
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {task.proofImages.length > 0 ? (
                            <div className="flex items-center space-x-1">
                              {task.proofImages.map((img, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => onPreviewImage(img, task.title)}
                                  className="relative group cursor-pointer"
                                  title="Bấm để xem ảnh phóng to"
                                >
                                  <img src={img} alt="proof" className="w-8 h-8 rounded object-cover border border-slate-300 group-hover:scale-110 transition" />
                                </button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Chưa có</span>
                          )}
                        </td>
                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                          {task.status === 'Chờ duyệt' && (
                            <button
                              onClick={() => setReviewModalTask(task)}
                              className="px-2 py-1 bg-blue-600 hover:brightness-110 text-white rounded font-medium text-[11px]"
                            >
                              Duyệt
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setCurrentEditingTask(task);
                              setEditTaskModalOpen(true);
                            }}
                            className="p-1 hover:bg-slate-200 rounded text-slate-600"
                            title="Sửa công việc"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
                                onDeleteTask(task.id);
                              }
                            }}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                            title="Xóa công việc"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: KPI & WORKFORCE PERFORMANCE */}
      {activeTab === 'kpi' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  <span>Bảng Đánh giá KPI & Hiệu suất Nhân sự Vận hành</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Dữ liệu tự động tính toán từ tỷ lệ hoàn thành đúng hạn, số lần yêu cầu làm lại và kiểm soát minh chứng
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded font-semibold">Loại A: Xuất sắc</span>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded font-semibold">Loại B: Đạt yêu cầu</span>
                <span className="px-2.5 py-1 bg-red-100 text-red-800 rounded font-semibold">Loại C: Cần cải thiện</span>
              </div>
            </div>

            {/* Staff KPI Table */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 uppercase tracking-wider text-[10px]">
                    <th className="p-3">Mã & Nhân sự</th>
                    <th className="p-3">Khu vực & Ca</th>
                    <th className="p-3">Tổng việc được giao</th>
                    <th className="p-3">Hoàn thành đúng hạn</th>
                    <th className="p-3">Bị yêu cầu làm lại</th>
                    <th className="p-3">Tỷ lệ đúng hạn</th>
                    <th className="p-3 text-center">Xếp loại KPI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffUsers.map(staff => {
                    const kpi = calculateStaffKPI(staff.id, tasks);
                    return (
                      <tr key={staff.id} className="hover:bg-slate-50 transition">
                        <td className="p-3">
                          <div className="flex items-center space-x-3">
                            <img src={staff.avatar} alt="" className="w-8 h-8 rounded-full object-cover border" />
                            <div>
                              <div className="font-bold text-slate-900">{staff.name}</div>
                              <div className="text-[11px] text-slate-400">{staff.code} • {staff.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="text-slate-800 font-medium">{staff.khuVuc}</div>
                          <div className="text-[11px] text-(--vc-brand-2)">{staff.currentShift || 'Ca sáng'}</div>
                        </td>
                        <td className="p-3 font-semibold text-slate-900">{kpi.total} việc</td>
                        <td className="p-3 text-emerald-600 font-semibold">{kpi.onTime} việc</td>
                        <td className="p-3 text-red-600 font-semibold">{kpi.reworkCount} lần</td>
                        <td className="p-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-(--vc-brand-2) h-full rounded-full"
                                style={{ width: `${kpi.onTimeRate}%` }}
                              ></div>
                            </div>
                            <span className="font-bold text-slate-800">{kpi.onTimeRate}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-3 py-1 rounded-full font-bold text-xs ${
                            kpi.rating === 'A' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            kpi.rating === 'B' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                            'bg-red-100 text-red-800 border border-red-300'
                          }`}>
                            Hạng {kpi.rating}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Operational Comparison Trends (7 & 30 Days) */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
              <h4 className="font-bold text-sm text-slate-900">Xu hướng Tỷ lệ hoàn thành công việc theo chu kỳ</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border text-center">
                  <div className="text-xs text-slate-500 font-medium">Hôm nay ({formatDateVN(currentDate)})</div>
                  <div className="text-2xl font-bold text-(--vc-brand-2) mt-1">{progressPercent}%</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Tiến độ thực tế</div>
                </div>
                <div className="bg-white p-4 rounded-lg border text-center">
                  <div className="text-xs text-slate-500 font-medium">Trung bình 7 ngày qua</div>
                  <div className="text-2xl font-bold text-emerald-600 mt-1">94.8%</div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">↑ Tăng 2.1% so với tuần trước</div>
                </div>
                <div className="bg-white p-4 rounded-lg border text-center">
                  <div className="text-xs text-slate-500 font-medium">Trung bình 30 ngày qua</div>
                  <div className="text-2xl font-bold text-blue-700 mt-1">92.4%</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Mục tiêu chuẩn VINCONS: ≥ 90%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TEMPLATES MANAGEMENT */}
      {activeTab === 'templates' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Danh mục Mẫu Checklist Vận hành</h3>
              <p className="text-xs text-slate-500">Quản lý các công việc định kỳ hàng ngày, hàng tuần, hàng tháng</p>
            </div>
            <button
              onClick={() => {
                setCurrentEditingTemplate({
                  id: `tpl-${Date.now()}`,
                  title: '',
                  group: 'Hằng ngày',
                  startTime: '08:00',
                  endTime: '09:00',
                  frequency: 'daily',
                  requirements: ['Yêu cầu thực hiện công việc'],
                  proofRequired: true,
                  proofType: 'image',
                  isImportant: false,
                  isActive: true
                });
                setTemplateModalOpen(true);
              }}
              className="px-3 py-2 bg-(--vc-brand-2) text-white font-medium text-xs rounded-lg hover:bg-blue-900 flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm mẫu mới</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase tracking-wider text-[10px]">
                  <th className="p-3">Giờ</th>
                  <th className="p-3">Tên công việc</th>
                  <th className="p-3">Nhóm</th>
                  <th className="p-3">Tần suất</th>
                  <th className="p-3">Minh chứng</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map(tpl => (
                  <tr key={tpl.id} className="hover:bg-slate-50 transition">
                    <td className="p-3 font-semibold text-(--vc-brand-2) whitespace-nowrap">{tpl.startTime} - {tpl.endTime}</td>
                    <td className="p-3 font-semibold text-slate-900">
                      {tpl.title}
                      {tpl.isImportant && (
                        <span className="ml-2 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold rounded">
                          Quan trọng
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-(--vc-brand-2) rounded font-medium text-[10px]">
                        {tpl.group}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{tpl.frequency}</td>
                    <td className="p-3">{tpl.proofRequired ? 'Có (Ảnh)' : 'Không'}</td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => {
                          setCurrentEditingTemplate(tpl);
                          setTemplateModalOpen(true);
                        }}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Xóa mẫu checklist này?')) onDeleteTemplate(tpl.id);
                        }}
                        className="p-1 hover:bg-red-100 rounded text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: STAFF MANAGEMENT */}
      {activeTab === 'staff' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Hồ sơ & Quản lý Nhân sự Vận hành</h3>
              <p className="text-xs text-slate-500">Danh sách Chuyên viên vận hành tại các lán trại & ký túc xá VINCONS</p>
            </div>
            <button
              onClick={() => {
                setCurrentEditingStaff({
                  id: `u-staff-${Date.now()}`,
                  code: `VC-STF-0${users.length}`,
                  name: '',
                  email: '',
                  phone: '0900.000.000',
                  role: 'staff',
                  khuVuc: 'Khu KTX mới',
                  currentShift: 'Ca sáng (05:00 - 13:30)',
                  isActive: true,
                  avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
                });
                setStaffModalOpen(true);
              }}
              className="px-3 py-2 bg-(--vc-brand-2) text-white font-medium text-xs rounded-lg hover:bg-blue-900 flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm nhân sự</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map(u => (
              <div key={u.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-col justify-between space-y-3">
                <div className="flex items-start space-x-4">
                  <img src={u.avatar} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-(--vc-brand-2)" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <div className="font-bold text-slate-900 text-sm truncate">{u.name}</div>
                      <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded font-mono font-semibold">
                        {u.code}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">{u.email}</div>
                    <div className="text-xs text-slate-600 flex items-center space-x-1 mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{u.phone}</span>
                    </div>
                    <div className="text-[11px] text-amber-800 font-semibold mt-1 flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-amber-600" />
                      <span className="truncate">{u.khuVuc}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'manager' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {u.role === 'manager' ? 'Quản lý' : 'Nhân viên'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {u.isActive ? 'Hoạt động' : 'Đã khóa'}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setCurrentEditingStaff(u);
                      setStaffModalOpen(true);
                    }}
                    className="p-1.5 hover:bg-white rounded-lg text-slate-600 shadow-sm border border-slate-200"
                    title="Chỉnh sửa hồ sơ"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Activity className="w-5 h-5 text-(--vc-brand-2)" />
                <span>Nhật ký Hoạt động Hệ thống (Audit Trail)</span>
              </h3>
              <p className="text-xs text-slate-500">Truy vết mọi thao tác vận hành, sinh việc, duyệt kết quả và bàn giao ca</p>
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto divide-y divide-slate-100">
            {auditLogs.length === 0 ? (
              <p className="text-center py-8 text-xs text-slate-400">Chưa có nhật ký hoạt động nào.</p>
            ) : (
              auditLogs.map(log => (
                <div key={log.id} className="pt-3 first:pt-0 flex items-start space-x-3 text-xs">
                  <div className="p-2 bg-blue-50 text-(--vc-brand-2) rounded-lg mt-0.5">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900">{log.actorName}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-[11px] font-mono text-slate-500">{log.timestamp}</span>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono text-[9px] rounded uppercase">
                        {log.action}
                      </span>
                    </div>
                    <div className="font-semibold text-(--vc-brand-2) mt-0.5">Mục tiêu: {log.target}</div>
                    <div className="text-slate-600 mt-0.5">{log.details}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 7: REPORTS & EXPORT */}
      {activeTab === 'reports' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base text-slate-900">Báo cáo Vận hành & Xuất dữ liệu</h3>
              <p className="text-xs text-slate-500">Xuất báo cáo ca, ngày, tuần ra Excel (CSV) hoặc Bản in PDF chính thức VINCONS</p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => exportToCSV(dateTasks, currentDate)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow transition flex items-center space-x-1.5"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Xuất file Excel (CSV)</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-(--vc-brand-2) hover:bg-blue-900 text-white font-medium text-xs rounded-lg shadow transition flex items-center space-x-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>In Báo cáo (PDF)</span>
              </button>
            </div>
          </div>

          {/* Printable Report Preview */}
          <div className="border border-slate-300 p-8 rounded-xl bg-white space-y-6 text-slate-800 shadow-inner">
            <div className="text-center space-y-1 border-b pb-4">
              <div className="text-xs uppercase font-bold tracking-widest text-(--vc-brand-2)">CÔNG TY CP PHÁT TRIỂN VÀ ĐẦU TƯ XÂY DỰNG VINCONS</div>
              <h2 className="text-lg font-bold">BÁO CÁO NHẬT KÝ VẬN HÀNH LÁN TRẠI & KÝ TÚC XÁ</h2>
              <p className="text-xs text-slate-500">Ngày báo cáo: {formatDateVN(currentDate)}</p>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs font-medium bg-slate-50 p-4 rounded-lg">
              <div>Tổng số đầu việc: <span className="font-bold">{totalTasks}</span></div>
              <div>Đã hoàn thành: <span className="font-bold text-emerald-600">{completedTasks}</span></div>
              <div>Tỷ lệ hoàn thành: <span className="font-bold text-(--vc-brand-2)">{progressPercent}%</span></div>
            </div>

            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                  <th className="p-2 border">Giờ</th>
                  <th className="p-2 border">Công việc</th>
                  <th className="p-2 border">Phụ trách</th>
                  <th className="p-2 border">Trạng thái</th>
                  <th className="p-2 border">Kết quả / Số liệu / Bàn giao</th>
                </tr>
              </thead>
              <tbody>
                {dateTasks.map(t => {
                  const assignee = users.find(u => u.id === t.assigneeId);
                  return (
                    <tr key={t.id} className="border-b">
                      <td className="p-2 border font-medium">{t.startTime}-{t.endTime}</td>
                      <td className="p-2 border font-semibold">{t.title}</td>
                      <td className="p-2 border">{assignee ? `${assignee.name} (${assignee.code})` : 'Chưa gán'}</td>
                      <td className="p-2 border">{t.status}</td>
                      <td className="p-2 border text-slate-600">
                        {t.resultText || '-'} {t.metricValue ? `(${t.metricValue})` : ''} {t.handoverNotes ? `| BG: ${t.handoverNotes}` : ''}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="grid grid-cols-2 pt-8 text-center text-xs">
              <div>
                <p className="font-bold">NGƯỜI LẬP BÁO CÁO</p>
                <p className="text-slate-400 italic mt-1">(Ký, ghi rõ họ tên)</p>
                <div className="h-16"></div>
              </div>
              <div>
                <p className="font-bold">PHÊ DUYỆT TRƯỞNG NHÓM VẬN HÀNH</p>
                <p className="text-slate-400 italic mt-1">(Ký, đóng dấu)</p>
                <div className="h-16"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW TASK MODAL */}
      {reviewModalTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base text-(--vc-brand-2)">Duyệt kết quả công việc</h3>
              <button onClick={() => setReviewModalTask(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="font-bold text-slate-500">Công việc:</span>
                <div className="font-bold text-slate-900 text-sm mt-0.5">{reviewModalTask.title}</div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border space-y-1">
                <div><span className="font-semibold text-slate-600">Kết quả thực hiện:</span> {reviewModalTask.resultText || 'Chưa nhập'}</div>
                {reviewModalTask.metricValue && <div><span className="font-semibold text-slate-600">Số liệu:</span> {reviewModalTask.metricValue}</div>}
                {reviewModalTask.handoverNotes && <div><span className="font-semibold text-slate-600">Bàn giao/Vấn đề:</span> {reviewModalTask.handoverNotes}</div>}
              </div>

              {reviewModalTask.proofImages.length > 0 && (
                <div>
                  <span className="font-semibold text-slate-600">Ảnh minh chứng hiện trường (bấm để xem to):</span>
                  <div className="flex gap-2 mt-1">
                    {reviewModalTask.proofImages.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => onPreviewImage(img, reviewModalTask.title)}
                        className="cursor-pointer"
                      >
                        <img src={img} alt="proof" className="w-20 h-20 rounded-lg object-cover border hover:scale-105 transition" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ghi chú của Quản lý (bắt buộc khi yêu cầu làm lại):</label>
                <textarea
                  value={managerNote}
                  onChange={(e) => setManagerNote(e.target.value)}
                  placeholder="Nhập nhận xét hoặc lý do yêu cầu làm lại..."
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-(--vc-brand-2)"
                  rows={3}
                ></textarea>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => handleRejectRework(reviewModalTask)}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-xs transition"
              >
                Yêu cầu làm lại
              </button>
              <button
                onClick={() => handleApprove(reviewModalTask)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-xs transition"
              >
                Đồng ý hoàn thành
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT / CREATE TASK MODAL */}
      {editTaskModalOpen && currentEditingTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base text-(--vc-brand-2)">
                {currentEditingTask.id ? 'Sửa thông tin công việc' : 'Thêm công việc phát sinh'}
              </h3>
              <button onClick={() => setEditTaskModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên công việc:</label>
                <input
                  type="text"
                  value={currentEditingTask.title || ''}
                  onChange={(e) => setCurrentEditingTask({ ...currentEditingTask, title: e.target.value })}
                  className="w-full p-2.5 border rounded-lg"
                  placeholder="Nhập tên công việc..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giờ bắt đầu:</label>
                  <input
                    type="time"
                    value={currentEditingTask.startTime || '08:00'}
                    onChange={(e) => setCurrentEditingTask({ ...currentEditingTask, startTime: e.target.value })}
                    className="w-full p-2.5 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giờ kết thúc:</label>
                  <input
                    type="time"
                    value={currentEditingTask.endTime || '09:00'}
                    onChange={(e) => setCurrentEditingTask({ ...currentEditingTask, endTime: e.target.value })}
                    className="w-full p-2.5 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nhóm công việc:</label>
                  <select
                    value={currentEditingTask.group || 'Hằng ngày'}
                    onChange={(e) => setCurrentEditingTask({ ...currentEditingTask, group: e.target.value as ChecklistGroup })}
                    className="w-full p-2.5 border rounded-lg bg-white"
                  >
                    <option value="Hằng ngày">Hằng ngày</option>
                    <option value="Hằng tuần">Hằng tuần</option>
                    <option value="Hằng tháng">Hằng tháng</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nhân sự phụ trách:</label>
                  <select
                    value={currentEditingTask.assigneeId || ''}
                    onChange={(e) => setCurrentEditingTask({ ...currentEditingTask, assigneeId: e.target.value })}
                    className="w-full p-2.5 border rounded-lg bg-white"
                  >
                    {staffUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="isImportant"
                  checked={currentEditingTask.isImportant || false}
                  onChange={(e) => setCurrentEditingTask({ ...currentEditingTask, isImportant: e.target.checked })}
                  className="w-4 h-4 text-(--vc-brand-2) rounded"
                />
                <label htmlFor="isImportant" className="font-semibold text-slate-700">Đánh dấu là Việc quan trọng (Nhãn màu cam)</label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => setEditTaskModalOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (!currentEditingTask.title) {
                    alert('Vui lòng nhập tên công việc.');
                    return;
                  }
                  if (currentEditingTask.id && tasks.some(t => t.id === currentEditingTask.id)) {
                    onUpdateTask(currentEditingTask as TaskItem);
                  } else {
                    onCreateTask(currentEditingTask);
                  }
                  setEditTaskModalOpen(false);
                }}
                className="px-4 py-2 bg-(--vc-brand-2) text-white rounded-lg text-xs font-semibold"
              >
                Lưu công việc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE MODAL */}
      {templateModalOpen && currentEditingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base text-(--vc-brand-2)">Chỉnh sửa Mẫu Checklist</h3>
              <button onClick={() => setTemplateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên mẫu công việc:</label>
                <input
                  type="text"
                  value={currentEditingTemplate.title || ''}
                  onChange={(e) => setCurrentEditingTemplate({ ...currentEditingTemplate, title: e.target.value })}
                  className="w-full p-2.5 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giờ bắt đầu:</label>
                  <input
                    type="time"
                    value={currentEditingTemplate.startTime || '08:00'}
                    onChange={(e) => setCurrentEditingTemplate({ ...currentEditingTemplate, startTime: e.target.value })}
                    className="w-full p-2.5 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giờ kết thúc:</label>
                  <input
                    type="time"
                    value={currentEditingTemplate.endTime || '09:00'}
                    onChange={(e) => setCurrentEditingTemplate({ ...currentEditingTemplate, endTime: e.target.value })}
                    className="w-full p-2.5 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nhóm:</label>
                  <select
                    value={currentEditingTemplate.group || 'Hằng ngày'}
                    onChange={(e) => setCurrentEditingTemplate({ ...currentEditingTemplate, group: e.target.value as ChecklistGroup })}
                    className="w-full p-2.5 border rounded-lg bg-white"
                  >
                    <option value="Hằng ngày">Hằng ngày</option>
                    <option value="Hằng tuần">Hằng tuần</option>
                    <option value="Hằng tháng">Hằng tháng</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tần suất:</label>
                  <select
                    value={currentEditingTemplate.frequency || 'daily'}
                    onChange={(e) => setCurrentEditingTemplate({ ...currentEditingTemplate, frequency: e.target.value as any })}
                    className="w-full p-2.5 border rounded-lg bg-white"
                  >
                    <option value="daily">Hằng ngày</option>
                    <option value="weekly">Hằng tuần</option>
                    <option value="monthly">Hằng tháng</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="tplImportant"
                  checked={currentEditingTemplate.isImportant || false}
                  onChange={(e) => setCurrentEditingTemplate({ ...currentEditingTemplate, isImportant: e.target.checked })}
                  className="w-4 h-4 text-(--vc-brand-2) rounded"
                />
                <label htmlFor="tplImportant" className="font-semibold text-slate-700">Việc quan trọng</label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => setTemplateModalOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (!currentEditingTemplate.title) return;
                  onSaveTemplate(currentEditingTemplate as ChecklistTemplate);
                  setTemplateModalOpen(false);
                }}
                className="px-4 py-2 bg-(--vc-brand-2) text-white rounded-lg text-xs font-semibold"
              >
                Lưu mẫu
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STAFF MODAL */}
      {staffModalOpen && currentEditingStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base text-(--vc-brand-2)">Hồ sơ Chuyên viên Vận hành</h3>
              <button onClick={() => setStaffModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mã nhân viên:</label>
                  <input
                    type="text"
                    value={currentEditingStaff.code || ''}
                    onChange={(e) => setCurrentEditingStaff({ ...currentEditingStaff, code: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                    placeholder="VC-STF-01"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại:</label>
                  <input
                    type="text"
                    value={currentEditingStaff.phone || ''}
                    onChange={(e) => setCurrentEditingStaff({ ...currentEditingStaff, phone: e.target.value })}
                    className="w-full p-2 border rounded-lg"
                    placeholder="0912..."
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Họ và tên:</label>
                <input
                  type="text"
                  value={currentEditingStaff.name || ''}
                  onChange={(e) => setCurrentEditingStaff({ ...currentEditingStaff, name: e.target.value })}
                  className="w-full p-2.5 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email đăng nhập:</label>
                <input
                  type="email"
                  value={currentEditingStaff.email || ''}
                  onChange={(e) => setCurrentEditingStaff({ ...currentEditingStaff, email: e.target.value })}
                  className="w-full p-2.5 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Khu vực phụ trách:</label>
                <input
                  type="text"
                  value={currentEditingStaff.khuVuc || ''}
                  onChange={(e) => setCurrentEditingStaff({ ...currentEditingStaff, khuVuc: e.target.value })}
                  className="w-full p-2.5 border rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ca làm việc chính:</label>
                <select
                  value={currentEditingStaff.currentShift || 'Ca sáng (05:00 - 13:30)'}
                  onChange={(e) => setCurrentEditingStaff({ ...currentEditingStaff, currentShift: e.target.value })}
                  className="w-full p-2.5 border rounded-lg bg-white"
                >
                  <option value="Ca sáng (05:00 - 13:30)">Ca sáng (05:00 - 13:30)</option>
                  <option value="Ca chiều (13:30 - 22:00)">Ca chiều (13:30 - 22:00)</option>
                  <option value="Ca đêm (22:00 - 05:00)">Ca đêm (22:00 - 05:00)</option>
                  <option value="Toàn ca">Toàn ca</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phân quyền Module truy cập:</label>
                <div className="space-y-2 bg-slate-50 p-3 rounded-xl border text-xs">
                  <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={currentEditingStaff.canAccessTasks !== false}
                      onChange={(e) => setCurrentEditingStaff({ ...currentEditingStaff, canAccessTasks: e.target.checked })}
                      className="w-4 h-4 text-(--vc-brand-2) rounded"
                    />
                    <span>Quyền module Công việc (Checklist, Bàn giao, Quản lý)</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={currentEditingStaff.canAccessMeals !== false}
                      onChange={(e) => setCurrentEditingStaff({ ...currentEditingStaff, canAccessMeals: e.target.checked })}
                      className="w-4 h-4 text-amber-600 rounded"
                    />
                    <span>Quyền module Suất ăn (Hóc Môn, Thực đơn, Kiểm định)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => setStaffModalOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (!currentEditingStaff.name || !currentEditingStaff.email) return;
                  onSaveUser(currentEditingStaff as User);
                  setStaffModalOpen(false);
                }}
                className="px-4 py-2 bg-(--vc-brand-2) text-white rounded-lg text-xs font-semibold"
              >
                Lưu nhân sự
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
