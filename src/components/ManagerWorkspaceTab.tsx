import { useState, useMemo } from 'react';
import { ManagerNoteItem, WeeklyRoutineItem, User, NotePriority, NoteStatus, NoteCategory, WeekRecurrenceType } from '../types';
import { formatDateVN } from '../utils/helpers';
import RealtimeClock from './RealtimeClock';
import WeeklyTracker, { OPS_CHECKLIST_ITEMS, type WeeklyChecklist } from './WeeklyTracker';
import { getWeekDaysInfo, getMondayOfDate, formatISODate } from '../meals/dateUtils';
import {
  CheckSquare, Clock, AlertTriangle, Plus, Edit3, Trash2, CheckCircle2,
  Calendar, RotateCcw, Tag, Phone, ShieldAlert, Sparkles, Filter, Search,
  Flame, Check, X, FileText, ChevronRight, Bookmark, ArrowRight, RefreshCw,
  Layers, Pin, MessageSquare, AlertCircle
} from 'lucide-react';

interface ManagerWorkspaceTabProps {
  notes: ManagerNoteItem[];
  weeklyRoutines: WeeklyRoutineItem[];
  users: User[];
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

export default function ManagerWorkspaceTab({
  notes,
  weeklyRoutines,
  users,
  onSaveNote,
  onDeleteNote,
  onToggleNoteStatus,
  onSaveWeeklyRoutine,
  onDeleteWeeklyRoutine,
  onToggleWeeklyRoutine,
  onResetWeeklyChecklist,
  executiveMemos,
  onSaveExecutiveMemos
}: ManagerWorkspaceTabProps) {
  // Sub-view toggle
  const [subView, setSubView] = useState<'all' | 'notes' | 'weekly' | 'memos'>('all');

  // Filters for notes
  const [noteStatusFilter, setNoteStatusFilter] = useState<string>('all');
  const [notePriorityFilter, setNotePriorityFilter] = useState<string>('all');
  const [noteCategoryFilter, setNoteCategoryFilter] = useState<string>('all');
  const [noteSearchQuery, setNoteSearchQuery] = useState<string>('');

  // Filter for weekly routines
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');

  // Modal states
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Partial<ManagerNoteItem> | null>(null);

  const [routineModalOpen, setRoutineModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Partial<WeeklyRoutineItem> | null>(null);

  const staffUsers = users.filter(u => u.role === 'staff');

  // ===================== TRACKER TUẦN ( Đồng bộ ngày hệ thống & tuần đang chọn của hệ thống ) =====================
  const CHECKLIST_KEY = 'meals_weekly_checklist_v12';
  const [checklist, setChecklist] = useState<{ week: string; days: WeeklyChecklist }>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(CHECKLIST_KEY) || 'null');
      if (raw && raw.week) return raw;
    } catch { /* ignore */ }
    return { week: '', days: {} as WeeklyChecklist };
  });

  // Tuần theo hệ thống: lấy từ tuần đang chọn ở hệ thống (CSDL meals), mặc định Thứ 2 tuần hiện tại
  const trackerWeekStart = useMemo(() => {
    return localStorage.getItem('meals_week_start_cache_v11') || formatISODate(getMondayOfDate(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const trackerDays = useMemo(() => getWeekDaysInfo(trackerWeekStart), [trackerWeekStart]);
  const todayISO = formatISODate(new Date());
  const [selectedDateISO, setSelectedDateISO] = useState<string>(todayISO);

  const activeChecklist: WeeklyChecklist = checklist.week === trackerWeekStart ? checklist.days : {};

  const writeChecklist = (next: { week: string; days: WeeklyChecklist }) => {
    setChecklist(next);
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const toggleChecklistItem = (dayIdx: number, item: string) => {
    writeChecklist({
      week: trackerWeekStart,
      days: { ...activeChecklist, [dayIdx]: { ...(activeChecklist[dayIdx] || {}), [item]: !(activeChecklist[dayIdx] || {})[item] } }
    });
  };

  const setDayChecklistDone = (dayIdx: number, done: boolean) => {
    const marks: Record<string, boolean> = {};
    if (done) OPS_CHECKLIST_ITEMS.forEach(item => { marks[item] = true; });
    writeChecklist({ week: trackerWeekStart, days: { ...activeChecklist, [dayIdx]: marks } });
  };

  // Stats calculation
  const totalNotes = notes.length;
  const todoNotes = notes.filter(n => n.status === 'todo').length;
  const inProgressNotes = notes.filter(n => n.status === 'in_progress').length;
  const doneNotes = notes.filter(n => n.status === 'done').length;
  const urgentNotes = notes.filter(n => n.priority === 'high' && n.status !== 'done').length;

  const totalWeekly = weeklyRoutines.length;
  const completedWeekly = weeklyRoutines.filter(r => r.isCompleted).length;
  const weeklyPct = totalWeekly > 0 ? Math.round((completedWeekly / totalWeekly) * 100) : 0;

  // Filtered notes
  const filteredNotes = notes.filter(note => {
    if (noteStatusFilter !== 'all' && note.status !== noteStatusFilter) return false;
    if (notePriorityFilter !== 'all' && note.priority !== notePriorityFilter) return false;
    if (noteCategoryFilter !== 'all' && note.category !== noteCategoryFilter) return false;
    if (noteSearchQuery) {
      const q = noteSearchQuery.toLowerCase();
      const matchTitle = note.title.toLowerCase().includes(q);
      const matchContent = note.content.toLowerCase().includes(q);
      if (!matchTitle && !matchContent) return false;
    }
    return true;
  });

  // Filtered weekly routines
  const filteredRoutines = weeklyRoutines.filter(routine => {
    if (selectedDayFilter !== 'all' && routine.dayOfWeek !== selectedDayFilter) return false;
    return true;
  });

  const getDayName = (day: number): string => {
    switch (day) {
      case 1: return 'Thứ Hai';
      case 2: return 'Thứ Ba';
      case 3: return 'Thứ Tư';
      case 4: return 'Thứ Năm';
      case 5: return 'Thứ Sáu';
      case 6: return 'Thứ Bảy';
      case 0: return 'Chủ Nhật';
      default: return '';
    }
  };

  const getPriorityBadge = (priority: NotePriority) => {
    switch (priority) {
      case 'high':
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 font-bold text-[10px] rounded-full flex items-center space-x-1"><Flame className="w-3 h-3 text-red-500" /><span>Ưu tiên cao / Khẩn</span></span>;
      case 'medium':
        return <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-semibold text-[10px] rounded-full">Trung bình</span>;
      case 'low':
        return <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-medium text-[10px] rounded-full">Thấp</span>;
    }
  };

  const getCategoryLabel = (category: NoteCategory): string => {
    switch (category) {
      case 'incident': return 'Sự cố / Hiện trường';
      case 'personnel': return 'Nhân sự / Công nhân';
      case 'ncc': return 'Nhà cung cấp (NCC)';
      case 'safety': return 'An toàn / PCCC';
      default: return 'Vận hành chung';
    }
  };

  const getRecurrenceBadge = (recurrence: WeekRecurrenceType) => {
    switch (recurrence) {
      case 'week_1_3':
        return <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded">Tuần 1 & 3</span>;
      case 'week_2_4':
        return <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[10px] font-bold rounded">Tuần 2 & 4</span>;
      case 'month_end':
        return <span className="px-1.5 py-0.5 bg-rose-50 text-rose-700 text-[10px] font-bold rounded">Cuối tháng</span>;
      default:
        return <span className="px-1.5 py-0.5 bg-blue-50 text-(--vc-brand-2) text-[10px] font-semibold rounded">Hằng tuần</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Command Workspace Banner */}
      <div className="bg-gradient-to-r from-(--vc-brand-1) via-(--vc-brand-2) to-(--vc-brand-3) text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-bold text-xs rounded-full uppercase tracking-wider">
                Executive Workspace
              </span>
              <span className="text-xs text-blue-200">Khu vực riêng cho Trưởng nhóm Vận hành VINCONS</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Không gian Quản lý · Điều hành & Tracker Lán trại
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
              Tracker tiến độ tuần, checklist ca trực, danh mục việc cần làm và sổ tay chỉ đạo điều hành nhanh — một trục vận hành liền mạch.
            </p>
          </div>

          {/* Đồng hồ & ca ăn thời gian thực — góc trên bên phải banner */}
          <div className="flex flex-col items-start lg:items-end gap-3">
            <RealtimeClock compact />
            <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setEditingNote({
                  title: '',
                  content: '',
                  status: 'todo',
                  priority: 'high',
                  category: 'general',
                  dueDate: new Date().toISOString().slice(0, 10),
                  createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
                });
                setNoteModalOpen(true);
              }}
              className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm ghi chú / việc cần làm</span>
            </button>

            <button
              onClick={() => {
                setEditingRoutine({
                  title: '',
                  dayOfWeek: 1,
                  timeSlot: '08:00 - 11:30',
                  recurrence: 'all',
                  requirements: ['Yêu cầu thực hiện tuần'],
                  isImportant: true,
                  isCompleted: false,
                  proofRequired: true
                });
                setRoutineModalOpen(true);
              }}
              className="px-3.5 py-2.5 bg-blue-700 hover:bg-blue-600 text-white font-semibold text-xs rounded-xl shadow transition flex items-center space-x-1.5 border border-blue-500"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm đầu việc tuần mới</span>
            </button>

            <button
              onClick={onResetWeeklyChecklist}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl shadow transition flex items-center space-x-1.5 border border-slate-600"
              title="Lưu lại kết quả tuần này và làm mới trạng thái checklist cho tuần tiếp theo"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Lặp lại vào tuần sau</span>
            </button>
            </div>
          </div>
        </div>

        {/* KPI Strip at Bottom of Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
            <span className="text-slate-300">Việc tuần hoàn thành</span>
            <div className="text-xl font-bold text-emerald-400 mt-0.5">{completedWeekly}/{totalWeekly} ({weeklyPct}%)</div>
            <div className="w-full bg-white/20 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${weeklyPct}%` }}></div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
            <span className="text-slate-300">Hạng mục cần làm</span>
            <div className="text-xl font-bold text-amber-300 mt-0.5">{todoNotes} việc</div>
            <span className="text-[10px] text-slate-300 mt-1 block">Chờ xử lý / Chưa xong</span>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
            <span className="text-slate-300">Đang xử lý trong ca</span>
            <div className="text-xl font-bold text-blue-300 mt-0.5">{inProgressNotes} việc</div>
            <span className="text-[10px] text-slate-300 mt-1 block">Đang chỉ đạo đôn đốc</span>
          </div>

          <div className="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10">
            <span className="text-slate-300">Việc khẩn cấp / Ưu tiên cao</span>
            <div className="text-xl font-bold text-red-400 mt-0.5">{urgentNotes} việc</div>
            <span className="text-[10px] text-red-200 mt-1 block">Cần xử lý ngay</span>
          </div>
        </div>
      </div>

      {/* TRACKER TIẾN ĐỘ TUẦN — nhập chung vào Không gian Quản lý (một trục liền mạch) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 space-y-4">
        <WeeklyTracker
          weekDays={trackerDays}
          checklist={activeChecklist}
          onToggleItem={toggleChecklistItem}
          onSetDayDone={setDayChecklistDone}
          selectedDateISO={selectedDateISO}
          onSelectDate={setSelectedDateISO}
        />
      </div>

      {/* Sub-view navigation buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          <button
            onClick={() => setSubView('all')}
            className={`px-3 py-1.5 rounded-md transition ${subView === 'all' ? 'bg-(--vc-brand-2) text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Toàn bộ không gian
          </button>
          <button
            onClick={() => setSubView('notes')}
            className={`px-3 py-1.5 rounded-md transition ${subView === 'notes' ? 'bg-(--vc-brand-2) text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Ghi chú & Việc cần làm ({notes.length})
          </button>
          <button
            onClick={() => setSubView('weekly')}
            className={`px-3 py-1.5 rounded-md transition ${subView === 'weekly' ? 'bg-(--vc-brand-2) text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Checklist Hằng tuần ({completedWeekly}/{totalWeekly})
          </button>
          <button
            onClick={() => setSubView('memos')}
            className={`px-3 py-1.5 rounded-md transition ${subView === 'memos' ? 'bg-(--vc-brand-2) text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Sổ tay Chỉ đạo nhanh
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center space-x-1.5">
          <Bookmark className="w-4 h-4 text-amber-500" />
          <span>Tự động đồng bộ & lưu trữ dữ liệu thời gian thực</span>
        </div>
      </div>

      {/* SECTION 1: MANAGER ACTION NOTES (Cần làm / Chưa làm / Đang làm / Xong) */}
      {(subView === 'all' || subView === 'notes') && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <FileText className="w-5 h-5 text-(--vc-brand-2)" />
                <span>Ghi chú các Hạng mục Cần làm & Chưa làm</span>
              </h3>
              <p className="text-xs text-slate-500">
                Sổ tay ghi nhớ của Quản lý: theo dõi sự cố phát sinh, nhắc nhở NCC, chỉ đạo nhân sự và việc tồn đọng
              </p>
            </div>

            <button
              onClick={() => {
                setEditingNote({
                  title: '',
                  content: '',
                  status: 'todo',
                  priority: 'high',
                  category: 'general',
                  dueDate: new Date().toISOString().slice(0, 10),
                  createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
                });
                setNoteModalOpen(true);
              }}
              className="px-3 py-1.5 bg-(--vc-brand-2) hover:bg-blue-900 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1 self-start md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Ghi chú việc mới</span>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Tìm ghi chú..."
                value={noteSearchQuery}
                onChange={(e) => setNoteSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-(--vc-brand-2) w-40 sm:w-56"
              />
            </div>

            <select
              value={noteStatusFilter}
              onChange={(e) => setNoteStatusFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="all">Tất cả trạng thái ({notes.length})</option>
              <option value="todo">Cần làm / Chưa xong ({todoNotes})</option>
              <option value="in_progress">Đang xử lý ({inProgressNotes})</option>
              <option value="done">Đã hoàn thành ({doneNotes})</option>
            </select>

            <select
              value={notePriorityFilter}
              onChange={(e) => setNotePriorityFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="all">Tất cả mức ưu tiên</option>
              <option value="high">Ưu tiên cao / Khẩn ({notes.filter(n => n.priority === 'high').length})</option>
              <option value="medium">Trung bình ({notes.filter(n => n.priority === 'medium').length})</option>
              <option value="low">Thấp ({notes.filter(n => n.priority === 'low').length})</option>
            </select>

            <select
              value={noteCategoryFilter}
              onChange={(e) => setNoteCategoryFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs border border-slate-200 rounded-lg bg-white text-slate-700"
            >
              <option value="all">Tất cả danh mục</option>
              <option value="general">Vận hành chung</option>
              <option value="incident">Sự cố / Hiện trường</option>
              <option value="personnel">Nhân sự / Công nhân</option>
              <option value="ncc">Nhà cung cấp (NCC)</option>
              <option value="safety">An toàn / PCCC</option>
            </select>
          </div>

          {/* Notes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNotes.length === 0 ? (
              <div className="col-span-full py-10 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs">Không có ghi chú nào phù hợp bộ lọc.</p>
              </div>
            ) : (
              filteredNotes.map(note => {
                const isDone = note.status === 'done';
                const assignedStaff = users.find(u => u.id === note.assignedStaffId);

                return (
                  <div
                    key={note.id}
                    className={`p-4 rounded-xl border transition flex flex-col justify-between space-y-3 relative group ${
                      isDone
                        ? 'bg-slate-50/70 border-slate-200 opacity-75'
                        : note.priority === 'high'
                        ? 'bg-white border-red-200 shadow-sm hover:shadow-md'
                        : 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                          {getCategoryLabel(note.category)}
                        </span>
                        {getPriorityBadge(note.priority)}
                      </div>

                      <div className="flex items-start space-x-2">
                        <button
                          onClick={() => onToggleNoteStatus(note.id, note.status)}
                          className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition shrink-0 ${
                            isDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 hover:border-(--vc-brand-2)'
                          }`}
                          title={isDone ? 'Bấm để chuyển về Chưa xong' : 'Bấm để đánh dấu Hoàn thành'}
                        >
                          {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                        <h4 className={`font-bold text-sm text-slate-900 leading-snug ${isDone ? 'line-through text-slate-400' : ''}`}>
                          {note.title}
                        </h4>
                      </div>

                      {note.content && (
                        <p className={`text-xs leading-relaxed ${isDone ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                          {note.content}
                        </p>
                      )}

                      {assignedStaff && (
                        <div className="text-[11px] text-blue-700 bg-blue-50 px-2 py-1 rounded flex items-center space-x-1 w-fit font-medium">
                          <span>Ủy quyền theo dõi: {assignedStaff.name} ({assignedStaff.code})</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Hạn: {note.dueDate ? formatDateVN(note.dueDate) : 'Không có'}</span>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => {
                            setEditingNote(note);
                            setNoteModalOpen(true);
                          }}
                          className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition"
                          title="Sửa ghi chú"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Xóa ghi chú này?')) onDeleteNote(note.id);
                          }}
                          className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition"
                          title="Xóa ghi chú"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: WEEKLY ROUTINES & CYCLE CHECKLIST (Đầu việc Hằng tuần & Lặp lại tuần sau) */}
      {(subView === 'all' || subView === 'weekly') && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                  <CheckSquare className="w-5 h-5 text-amber-500" />
                  <span>Danh mục Đầu việc Hằng tuần & Chu kỳ Tuần</span>
                </h3>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-full">
                  Tiến độ tuần: {weeklyPct}%
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Các đầu việc định kỳ từ Thứ 2 đến Chủ nhật. Xong việc nào thì tick vào, cuối tuần bấm <strong>"Lặp lại vào tuần sau"</strong> để tái khởi động chu kỳ mới.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={onResetWeeklyChecklist}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1.5 transition"
                title="Bấm để reset các tick hoàn thành và khởi động chu kỳ làm việc tuần mới"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Lặp lại vào tuần sau</span>
              </button>

              <button
                onClick={() => {
                  setEditingRoutine({
                    title: '',
                    dayOfWeek: 1,
                    timeSlot: '08:00 - 11:30',
                    recurrence: 'all',
                    requirements: ['Yêu cầu thực hiện tuần'],
                    isImportant: true,
                    isCompleted: false,
                    proofRequired: true
                  });
                  setRoutineModalOpen(true);
                }}
                className="px-3 py-1.5 bg-(--vc-brand-2) hover:bg-blue-900 text-white text-xs font-bold rounded-lg shadow-sm flex items-center space-x-1"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm đầu việc tuần</span>
              </button>
            </div>
          </div>

          {/* Day of Week Filter Tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 pt-1 border-t border-slate-100">
            {[
              { id: 'all', label: 'Tất cả các ngày' },
              { id: 1, label: 'Thứ Hai' },
              { id: 2, label: 'Thứ Ba' },
              { id: 3, label: 'Thứ Tư' },
              { id: 4, label: 'Thứ Năm' },
              { id: 5, label: 'Thứ Sáu' },
              { id: 6, label: 'Thứ Bảy' },
              { id: 0, label: 'Chủ Nhật' },
            ].map(tab => {
              const isSelected = selectedDayFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedDayFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    isSelected
                      ? 'bg-(--vc-brand-2) text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Weekly Routines List */}
          <div className="space-y-3">
            {filteredRoutines.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                Không có đầu việc nào trong ngày này.
              </div>
            ) : (
              filteredRoutines.map(routine => {
                return (
                  <div
                    key={routine.id}
                    className={`p-4 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                      routine.isCompleted
                        ? 'bg-emerald-50/40 border-emerald-200'
                        : 'bg-white border-slate-200 hover:border-(--vc-brand-2)'
                    }`}
                  >
                    <div className="flex items-start space-x-3.5">
                      <button
                        onClick={() => onToggleWeeklyRoutine(routine.id)}
                        className={`mt-1 w-6 h-6 rounded-lg flex items-center justify-center border-2 transition shrink-0 ${
                          routine.isCompleted
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 hover:border-emerald-600 bg-white'
                        }`}
                        title={routine.isCompleted ? 'Bấm để hủy hoàn thành' : 'Bấm để đánh dấu đã hoàn thành'}
                      >
                        {routine.isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-(--vc-brand-2) font-bold text-xs rounded">
                            {getDayName(routine.dayOfWeek)}
                          </span>
                          <span className="font-semibold text-slate-600 text-xs flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{routine.timeSlot}</span>
                          </span>
                          {getRecurrenceBadge(routine.recurrence)}
                          {routine.isImportant && (
                            <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 font-bold text-[9px] rounded">
                              Quan trọng
                            </span>
                          )}
                          {routine.isCompleted && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[10px] rounded-full flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Đã xong tuần này {routine.completedAt ? `(${routine.completedAt})` : ''}</span>
                            </span>
                          )}
                        </div>

                        <h4 className={`font-bold text-sm text-slate-900 ${routine.isCompleted ? 'text-slate-500 line-through' : ''}`}>
                          {routine.title}
                        </h4>

                        {routine.requirements && routine.requirements.length > 0 && (
                          <ul className="text-xs text-slate-500 list-disc list-inside space-y-0.5 pl-1">
                            {routine.requirements.map((req, i) => (
                              <li key={i}>{req}</li>
                            ))}
                          </ul>
                        )}

                        {routine.completedNotes && (
                          <div className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 mt-1 font-medium">
                            ✓ Ghi chú thực tế: {routine.completedNotes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                      <button
                        onClick={() => {
                          setEditingRoutine(routine);
                          setRoutineModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-800 transition"
                        title="Chỉnh sửa đầu việc tuần"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Xóa đầu việc tuần này?')) onDeleteWeeklyRoutine(routine.id);
                        }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-600 transition"
                        title="Xóa đầu việc tuần"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: EXECUTIVE QUICK MEMOS & SCRATCHPAD (Sổ tay chỉ đạo nhanh) */}
      {(subView === 'all' || subView === 'memos') && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                <Pin className="w-5 h-5 text-amber-500" />
                <span>Sổ tay Chỉ đạo Nhanh & Đường dây nóng Vận hành</span>
              </h3>
              <p className="text-xs text-slate-500">
                Ghi chép tự do mọi số điện thoại khẩn cấp, lưu ý từ Ban Lãnh đạo hoặc chỉ đạo phát sinh trong ca
              </p>
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              ● Tự động lưu
            </span>
          </div>

          <textarea
            value={executiveMemos}
            onChange={(e) => onSaveExecutiveMemos(e.target.value)}
            rows={6}
            placeholder={`Ghi chép nhanh tại đây...\nVí dụ:\n- Công an khu vực: Đ/c Hùng 0912.xxx.xxx\n- Trưởng xe NCC Hưng Phát: Anh Tuấn 0988.xxx.xxx\n- Nhắc nhở ca tối: Tăng cường tuần tra lối thoát hiểm KTX A do đang tập kết vật tư xây dựng...`}
            className="w-full p-3.5 border border-slate-200 rounded-xl text-xs font-mono leading-relaxed bg-amber-50/20 focus:bg-white focus:outline-none focus:ring-2 focus:ring-(--vc-brand-2) transition"
          ></textarea>
        </div>
      )}

      {/* CREATE / EDIT NOTE MODAL */}
      {noteModalOpen && editingNote && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base text-(--vc-brand-2)">
                {editingNote.id ? 'Sửa ghi chú công việc' : 'Thêm ghi chú / việc cần làm'}
              </h3>
              <button onClick={() => setNoteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tiêu đề ghi chú / hạng mục:</label>
                <input
                  type="text"
                  value={editingNote.title || ''}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  placeholder="Ví dụ: Kiểm tra lại van áp lực nước KTX B..."
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-(--vc-brand-2)"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chi tiết / Hướng dẫn xử lý:</label>
                <textarea
                  value={editingNote.content || ''}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  placeholder="Nội dung chỉ đạo, lưu ý, thông tin liên hệ..."
                  rows={3}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-(--vc-brand-2)"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Trạng thái:</label>
                  <select
                    value={editingNote.status || 'todo'}
                    onChange={(e) => setEditingNote({ ...editingNote, status: e.target.value as NoteStatus })}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    <option value="todo">Cần làm / Chưa xong</option>
                    <option value="in_progress">Đang xử lý</option>
                    <option value="done">Đã hoàn thành</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mức độ ưu tiên:</label>
                  <select
                    value={editingNote.priority || 'medium'}
                    onChange={(e) => setEditingNote({ ...editingNote, priority: e.target.value as NotePriority })}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    <option value="high">Ưu tiên cao / Khẩn cấp</option>
                    <option value="medium">Trung bình</option>
                    <option value="low">Thấp</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Danh mục:</label>
                  <select
                    value={editingNote.category || 'general'}
                    onChange={(e) => setEditingNote({ ...editingNote, category: e.target.value as NoteCategory })}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    <option value="general">Vận hành chung</option>
                    <option value="incident">Sự cố / Hiện trường</option>
                    <option value="personnel">Nhân sự / Công nhân</option>
                    <option value="ncc">Nhà cung cấp (NCC)</option>
                    <option value="safety">An toàn / PCCC</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Hạn xử lý (Deadline):</label>
                  <input
                    type="date"
                    value={editingNote.dueDate || ''}
                    onChange={(e) => setEditingNote({ ...editingNote, dueDate: e.target.value })}
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ủy quyền cho nhân sự theo dõi (tùy chọn):</label>
                <select
                  value={editingNote.assignedStaffId || ''}
                  onChange={(e) => setEditingNote({ ...editingNote, assignedStaffId: e.target.value || undefined })}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="">-- Không phân công (Quản lý tự xử lý) --</option>
                  {staffUsers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code}) - {s.khuVuc}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                onClick={() => setNoteModalOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (!editingNote.title?.trim()) {
                    alert('Vui lòng nhập tiêu đề ghi chú.');
                    return;
                  }
                  const noteToSave: ManagerNoteItem = {
                    id: editingNote.id || `note-${Date.now()}`,
                    title: editingNote.title.trim(),
                    content: editingNote.content || '',
                    status: editingNote.status || 'todo',
                    priority: editingNote.priority || 'medium',
                    category: editingNote.category || 'general',
                    dueDate: editingNote.dueDate,
                    assignedStaffId: editingNote.assignedStaffId,
                    createdAt: editingNote.createdAt || new Date().toISOString().slice(0, 16).replace('T', ' '),
                    completedAt: editingNote.status === 'done' ? new Date().toISOString().slice(0, 16).replace('T', ' ') : undefined
                  };
                  onSaveNote(noteToSave);
                  setNoteModalOpen(false);
                }}
                className="px-4 py-2 bg-(--vc-brand-2) hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow"
              >
                Lưu ghi chú
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT WEEKLY ROUTINE MODAL */}
      {routineModalOpen && editingRoutine && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-base text-(--vc-brand-2)">
                {editingRoutine.id ? 'Sửa đầu việc tuần' : 'Thêm đầu việc tuần mới'}
              </h3>
              <button onClick={() => setRoutineModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tên đầu việc hàng tuần:</label>
                <input
                  type="text"
                  value={editingRoutine.title || ''}
                  onChange={(e) => setEditingRoutine({ ...editingRoutine, title: e.target.value })}
                  placeholder="Ví dụ: Đối chiếu bảng kê thanh toán suất ăn tuần..."
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-(--vc-brand-2)"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thực hiện vào:</label>
                  <select
                    value={editingRoutine.dayOfWeek ?? 1}
                    onChange={(e) => setEditingRoutine({ ...editingRoutine, dayOfWeek: Number(e.target.value) })}
                    className="w-full p-2 border rounded-lg bg-white"
                  >
                    <option value={1}>Thứ Hai</option>
                    <option value={2}>Thứ Ba</option>
                    <option value={3}>Thứ Tư</option>
                    <option value={4}>Thứ Năm</option>
                    <option value={5}>Thứ Sáu</option>
                    <option value={6}>Thứ Bảy</option>
                    <option value={0}>Chủ Nhật</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Khung giờ thực hiện:</label>
                  <input
                    type="text"
                    value={editingRoutine.timeSlot || '08:00 - 11:30'}
                    onChange={(e) => setEditingRoutine({ ...editingRoutine, timeSlot: e.target.value })}
                    placeholder="08:00 - 11:30"
                    className="w-full p-2 border rounded-lg bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Chu kỳ lặp lại:</label>
                <select
                  value={editingRoutine.recurrence || 'all'}
                  onChange={(e) => setEditingRoutine({ ...editingRoutine, recurrence: e.target.value as WeekRecurrenceType })}
                  className="w-full p-2 border rounded-lg bg-white"
                >
                  <option value="all">Hằng tuần (Tuần nào cũng thực hiện)</option>
                  <option value="week_1_3">Tuần 1 & Tuần 3 trong tháng</option>
                  <option value="week_2_4">Tuần 2 & Tuần 4 trong tháng</option>
                  <option value="month_end">Cuối tháng</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Yêu cầu thực hiện (mỗi dòng 1 yêu cầu):</label>
                <textarea
                  value={editingRoutine.requirements?.join('\n') || ''}
                  onChange={(e) => setEditingRoutine({ ...editingRoutine, requirements: e.target.value.split('\n') })}
                  rows={3}
                  placeholder={`Yêu cầu 1\nYêu cầu 2`}
                  className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-(--vc-brand-2)"
                ></textarea>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="weeklyImportant"
                  checked={editingRoutine.isImportant || false}
                  onChange={(e) => setEditingRoutine({ ...editingRoutine, isImportant: e.target.checked })}
                  className="w-4 h-4 text-(--vc-brand-2) rounded"
                />
                <label htmlFor="weeklyImportant" className="font-semibold text-slate-700">Đánh dấu là Đầu việc quan trọng</label>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t">
              <button
                onClick={() => setRoutineModalOpen(false)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  if (!editingRoutine.title?.trim()) {
                    alert('Vui lòng nhập tên đầu việc tuần.');
                    return;
                  }
                  const routineToSave: WeeklyRoutineItem = {
                    id: editingRoutine.id || `w-rt-${Date.now()}`,
                    title: editingRoutine.title.trim(),
                    dayOfWeek: editingRoutine.dayOfWeek ?? 1,
                    timeSlot: editingRoutine.timeSlot || '08:00 - 11:30',
                    recurrence: editingRoutine.recurrence || 'all',
                    requirements: editingRoutine.requirements?.filter(r => r.trim()) || [],
                    isImportant: editingRoutine.isImportant || false,
                    isCompleted: editingRoutine.isCompleted || false,
                    completedAt: editingRoutine.completedAt,
                    completedNotes: editingRoutine.completedNotes,
                    proofRequired: editingRoutine.proofRequired ?? true
                  };
                  onSaveWeeklyRoutine(routineToSave);
                  setRoutineModalOpen(false);
                }}
                className="px-4 py-2 bg-(--vc-brand-2) hover:bg-blue-900 text-white rounded-lg text-xs font-bold shadow"
              >
                Lưu đầu việc
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
