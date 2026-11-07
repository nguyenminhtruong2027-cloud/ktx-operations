import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  Search,
  Filter,
  FileText,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Tag,
  Check,
  History,
  AlertTriangle
} from 'lucide-react';
import { WorkNoteItem, WorkNotePriority, WorkNoteStatus } from '../types';
import { pushToFirestore, subscribeFirestoreDoc } from '../../utils/firebase';

interface WorkNotesWorkspaceTabProps {
  currentDate: string; // "YYYY-MM-DD"
  currentUserName: string;
}

const STORAGE_KEY_WORK_NOTES = 'vincons_work_notes_v1';

const INITIAL_WORK_NOTES: WorkNoteItem[] = [
  {
    id: 'note-1',
    title: 'Kiểm tra máy bơm tăng áp khu tắm B3',
    note: 'Áp lực nước yếu vào giờ cao điểm 17h30, cần phối hợp tổ ME kiểm tra van hồi.',
    date: '2026-11-06',
    createdAt: '08:15 06/11/2026',
    status: 'doing',
    priority: 'urgent',
    authorName: 'Nguyễn Văn Quản Lý',
    category: 'Sửa chữa ME',
  },
  {
    id: 'note-2',
    title: 'Đôn đốc NCC Lim Dương bù 15 suất cơm trưa',
    note: 'Số lượng thực tế thiếu so với số báo của tổ đội 8, yêu cầu giao bổ sung trước 11h45.',
    date: '2026-11-06',
    createdAt: '10:30 06/11/2026',
    completedAt: '11:40 06/11/2026',
    status: 'done',
    priority: 'important',
    authorName: 'Nguyễn Văn Quản Lý',
    category: 'Suất ăn',
  },
  {
    id: 'note-3',
    title: 'Thay bóng đèn chiếu sáng hành lang phòng P204',
    note: 'Bóng LED tuýp 1m2 bị nhấp nháy, đã lấy bóng mới từ kho vật tư.',
    date: '2026-11-06',
    createdAt: '09:00 06/11/2026',
    status: 'todo',
    priority: 'normal',
    authorName: 'Trần Văn Vận Hành',
    category: 'Cơ sở vật chất',
  },
  {
    id: 'note-4',
    title: 'Khai báo tạm trú cho 12 công nhân mới tổ ME',
    note: 'Thu thập CCCD và gửi danh sách lên hệ thống trước 17h00.',
    date: '2026-11-06',
    createdAt: '13:45 06/11/2026',
    status: 'todo',
    priority: 'important',
    authorName: 'Nguyễn Văn Quản Lý',
    category: 'An ninh & Nội quy',
  },
  {
    id: 'note-5',
    title: 'Nhắc nhở đội vệ sinh gom rác khu vực bồn rửa khay',
    note: 'Thực phẩm thừa sau bữa trưa cần được gom đổ vào thùng đậy nắp kín tránh mùi.',
    date: '2026-11-06',
    createdAt: '12:45 06/11/2026',
    completedAt: '13:15 06/11/2026',
    status: 'done',
    priority: 'normal',
    authorName: 'Nguyễn Văn Quản Lý',
    category: 'Vệ sinh',
  },
];

const CATEGORIES = [
  'Tất cả',
  'Sửa chữa ME',
  'Cơ sở vật chất',
  'Vệ sinh',
  'Suất ăn',
  'An ninh & Nội quy',
  'Khác',
];

export default function WorkNotesWorkspaceTab({
  currentDate,
  currentUserName,
}: WorkNotesWorkspaceTabProps) {
  const [notes, setNotes] = useState<WorkNoteItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_WORK_NOTES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_WORK_NOTES;
  });

  const [filterDate, setFilterDate] = useState<string>(currentDate);
  const [filterCategory, setFilterCategory] = useState<string>('Tất cả');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewTab, setViewTab] = useState<'board' | 'history'>('board');

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newDate, setNewDate] = useState(currentDate);
  const [newPriority, setNewPriority] = useState<WorkNotePriority>('important');
  const [newCategory, setNewCategory] = useState('Sửa chữa ME');

  // Sync to Firestore and LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_WORK_NOTES, JSON.stringify(notes));
    } catch {
      // ignore
    }
  }, [notes]);

  useEffect(() => {
    const unsub = subscribeFirestoreDoc<WorkNoteItem[]>(
      'vincons_operations',
      'workNotes',
      (remote) => {
        if (Array.isArray(remote) && remote.length > 0) {
          setNotes(remote);
        }
      }
    );
    return () => unsub();
  }, []);

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const now = new Date();
    const createdAt = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;

    const item: WorkNoteItem = {
      id: `wn-${Date.now()}`,
      title: newTitle.trim(),
      note: newNote.trim(),
      date: newDate,
      createdAt,
      status: 'todo',
      priority: newPriority,
      authorName: currentUserName || 'Cán bộ vận hành',
      category: newCategory,
    };

    setNotes(prev => {
      const next = [item, ...prev];
      void pushToFirestore('vincons_operations', 'workNotes', next);
      return next;
    });

    setNewTitle('');
    setNewNote('');
    setShowAddForm(false);
  };

  const handleChangeStatus = (id: string, nextStatus: WorkNoteStatus) => {
    const now = new Date();
    const completedAt = nextStatus === 'done'
      ? `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} ${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
      : undefined;

    setNotes(prev => {
      const next = prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            status: nextStatus,
            completedAt: nextStatus === 'done' ? completedAt : undefined,
          };
        }
        return item;
      });
      void pushToFirestore('vincons_operations', 'workNotes', next);
      return next;
    });
  };

  const handleDeleteNote = (id: string) => {
    if (!confirm('Xóa ghi chú công việc này?')) return;
    setNotes(prev => {
      const next = prev.filter(item => item.id !== id);
      void pushToFirestore('vincons_operations', 'workNotes', next);
      return next;
    });
  };

  // Filtered notes
  const filteredNotes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return notes.filter(item => {
      if (filterDate && filterDate !== 'ALL' && item.date !== filterDate) return false;
      if (filterCategory !== 'Tất cả' && item.category !== filterCategory) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.note.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q)
      );
    });
  }, [notes, filterDate, filterCategory, searchTerm]);

  // Grouped by 3 statuses: todo, doing, done
  const todoList = filteredNotes.filter(n => n.status === 'todo');
  const doingList = filteredNotes.filter(n => n.status === 'doing');
  const doneList = filteredNotes.filter(n => n.status === 'done');

  return (
    <div className="space-y-5">
      {/* Top Header & Fast Action Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#141e42] text-orange-400 flex items-center justify-center shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Không gian Ghi chú & Quản lý việc cần làm
              </h2>
              <p className="text-xs text-slate-500">
                Note lại việc cần làm, đang xử lý, đã hoàn thành và tra cứu lịch sử theo ngày tháng
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm transition"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Thêm việc / Note mới</span>
            </button>

            {/* View Switcher: Board vs History */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewTab('board')}
                className={`min-h-[34px] px-3 rounded-lg transition ${
                  viewTab === 'board'
                    ? 'bg-[#141e42] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bảng 3 trạng thái
              </button>
              <button
                type="button"
                onClick={() => setViewTab('history')}
                className={`min-h-[34px] px-3 rounded-lg transition ${
                  viewTab === 'history'
                    ? 'bg-[#141e42] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lịch sử & Nhật ký
              </button>
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={filterDate === 'ALL' ? '' : filterDate}
              onChange={e => setFilterDate(e.target.value || 'ALL')}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
            />
            {filterDate !== 'ALL' && (
              <button
                type="button"
                onClick={() => setFilterDate('ALL')}
                className="px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800"
              >
                (Xem tất cả ngày)
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <Tag className="w-4 h-4 text-slate-400" />
            <select
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tiêu đề hoặc nội dung ghi chú..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>
      </div>

      {/* Quick Add Form Modal / Dropdown */}
      {showAddForm && (
        <form
          onSubmit={handleAddNote}
          className="bg-white rounded-2xl border-2 border-orange-400 p-4 sm:p-5 shadow-lg space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              <span>Ghi chú công việc mới</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕ Đóng
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 mb-1">
                Tiêu đề công việc *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="VD: Kiểm tra áp lực nước khu B2, nhắc nhà ăn dọn khay..."
                className="w-full min-h-[40px] px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Ngày thực hiện
              </label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="w-full min-h-[40px] px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-semibold"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-bold text-slate-700 mb-1">
                Ghi chú chi tiết / Yêu cầu
              </label>
              <textarea
                rows={2}
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Mô tả cụ thể vị trí, tình trạng, phương án xử lý..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Mức độ ưu tiên
              </label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as WorkNotePriority)}
                className="w-full min-h-[40px] px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                <option value="urgent">🚨 Khẩn cấp</option>
                <option value="important">⭐ Quan trọng</option>
                <option value="normal">📋 Bình thường</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Danh mục công việc
              </label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="w-full min-h-[40px] px-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold"
              >
                {CATEGORIES.filter(c => c !== 'Tất cả').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full min-h-[40px] px-4 rounded-xl bg-[#141e42] hover:bg-blue-900 text-white font-bold text-xs inline-flex items-center justify-center gap-1.5 transition shadow-sm"
              >
                <Check className="w-4 h-4 text-orange-400" />
                <span>Lưu việc ngay</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* VIEW MODE 1: 3-COLUMN STATUS BOARD */}
      {viewTab === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Column 1: TODO / CẦN LÀM */}
          <div className="bg-slate-50/90 rounded-2xl border border-slate-200 p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>VIỆC CẦN LÀM / CHƯA LÀM</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-extrabold">
                {todoList.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {todoList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Không có việc nào đang chờ
                </div>
              ) : (
                todoList.map(item => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2.5 shadow-2xs hover:border-amber-400 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-700'
                          : item.priority === 'important'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.priority === 'urgent' ? '🚨 Khẩn cấp' : item.priority === 'important' ? '⭐ Quan trọng' : 'Thường'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {item.category}
                      </span>
                    </div>

                    <div className="font-bold text-xs text-slate-900 leading-snug">
                      {item.title}
                    </div>

                    {item.note && (
                      <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50 p-2 rounded-lg">
                        {item.note}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                      <span>{item.date}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(item.id, 'doing')}
                          className="px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition"
                        >
                          Bắt đầu làm ➔
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(item.id, 'done')}
                          className="px-2 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold transition"
                        >
                          Xong ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(item.id)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 2: DOING / ĐANG XỬ LÝ */}
          <div className="bg-blue-50/40 rounded-2xl border border-blue-200 p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200">
              <div className="flex items-center gap-2 font-bold text-xs text-blue-900">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
                <span>ĐANG XỬ LÝ</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-extrabold">
                {doingList.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {doingList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Không có việc nào đang xử lý
                </div>
              ) : (
                doingList.map(item => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-blue-200 p-3.5 space-y-2.5 shadow-2xs hover:border-blue-500 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-700'
                          : item.priority === 'important'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.priority === 'urgent' ? '🚨 Khẩn cấp' : item.priority === 'important' ? '⭐ Quan trọng' : 'Thường'}
                      </span>
                      <span className="text-[10px] text-blue-600 font-semibold">
                        {item.category}
                      </span>
                    </div>

                    <div className="font-bold text-xs text-slate-900 leading-snug">
                      {item.title}
                    </div>

                    {item.note && (
                      <p className="text-[11px] text-slate-600 leading-relaxed bg-blue-50/50 p-2 rounded-lg">
                        {item.note}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                      <span>{item.date}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(item.id, 'todo')}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition"
                          title="Trả về Chưa làm"
                        >
                          ↩ Lùi lại
                        </button>
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(item.id, 'done')}
                          className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition"
                        >
                          Hoàn thành ✓
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Column 3: DONE / ĐÃ HOÀN THÀNH */}
          <div className="bg-emerald-50/40 rounded-2xl border border-emerald-200 p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
              <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>ĐÃ HOÀN THÀNH</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-extrabold">
                {doneList.length}
              </span>
            </div>

            <div className="space-y-2.5">
              {doneList.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400">
                  Chưa có việc nào hoàn thành
                </div>
              ) : (
                doneList.map(item => (
                  <div
                    key={item.id}
                    className="bg-white rounded-xl border border-emerald-200 p-3.5 space-y-2 shadow-2xs opacity-85 hover:opacity-100 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="line-through font-bold text-xs text-slate-500">
                        {item.title}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">
                        ✓ Xong
                      </span>
                    </div>

                    {item.note && (
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {item.note}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px] text-slate-400">
                      <span>{item.completedAt || item.date}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleChangeStatus(item.id, 'todo')}
                          className="px-2 py-0.5 rounded text-slate-500 hover:text-slate-800 text-[10px] font-semibold"
                          title="Khôi phục lại việc này"
                        >
                          Khôi phục
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(item.id)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: HISTORY & WORK LOG TABLE */}
      {viewTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 bg-[#141e42] text-white flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-orange-400" />
              <span>Nhật ký & Lịch sử thực hiện công việc ({filteredNotes.length} mục)</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">Ngày & Giờ tạo</th>
                  <th className="p-3">Nội dung công việc</th>
                  <th className="p-3">Danh mục</th>
                  <th className="p-3 text-center">Ưu tiên</th>
                  <th className="p-3 text-center">Trạng thái</th>
                  <th className="p-3">Thời gian hoàn thành</th>
                  <th className="p-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredNotes.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-3 font-mono text-slate-600">{item.createdAt || item.date}</td>
                    <td className="p-3">
                      <div className={`font-bold ${item.status === 'done' ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                        {item.title}
                      </div>
                      {item.note && (
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.note}</div>
                      )}
                    </td>
                    <td className="p-3 font-semibold text-slate-700">{item.category}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.priority === 'urgent'
                          ? 'bg-rose-100 text-rose-700'
                          : item.priority === 'important'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {item.priority === 'urgent' ? 'Khẩn cấp' : item.priority === 'important' ? 'Quan trọng' : 'Thường'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        item.status === 'done'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'doing'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.status === 'done' ? '✓ Đã xong' : item.status === 'doing' ? 'Đang xử lý' : 'Chưa làm'}
                      </span>
                    </td>
                    <td className="p-3 text-emerald-700 font-semibold font-mono">
                      {item.completedAt || '-'}
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(item.id)}
                        className="text-slate-400 hover:text-rose-600 font-bold"
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
