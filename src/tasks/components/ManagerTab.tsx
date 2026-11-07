import React, { useState, useEffect } from 'react';
import {
  Shield,
  Check,
  Bell,
  UserPlus,
  Users,
  AlertTriangle,
  Calendar,
  CalendarDays,
  CalendarRange,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react';
import { User } from '../../types';
import { TaskTemplate, TaskInstance, ShiftType } from '../types';
import { computeTaskStatus } from '../seedTemplates';
import { pushToFirestore, subscribeFirestoreDoc } from '../../utils/firebase';

interface ManagerChecklistItem {
  id: string;
  group: 'daily' | 'weekly' | 'monthly';
  title: string;
  detail: string;
}

const MANAGER_CHECKLIST_ITEMS: ManagerChecklistItem[] = [
  // Hằng ngày
  {
    id: 'mgr-d-1',
    group: 'daily',
    title: 'Đối soát suất ăn (số báo với số NCC)',
    detail: 'Kiểm tra chênh lệch giữa số suất đặt/báo cơm và số suất thực tế NCC giao trong ngày.',
  },
  {
    id: 'mgr-d-2',
    group: 'daily',
    title: 'Lập biên bản phạt NCC / tổ đội',
    detail: 'Lập biên bản vi phạm nếu NCC giao trễ, thiếu định lượng, sai thực đơn hoặc tổ đội vi phạm nội quy.',
  },
  {
    id: 'mgr-d-3',
    group: 'daily',
    title: 'Ghi sổ tuần tra',
    detail: 'Ghi nhận đầy đủ kết quả tuần tra an ninh trật tự, vệ sinh, PCCC trong ngày.',
  },
  {
    id: 'mgr-d-4',
    group: 'daily',
    title: 'Xử lý việc tồn đọng từ báo cáo hết ca',
    detail: 'Rà soát các vấn đề chưa xử lý xong từ ca trước và phân công xử lý dứt điểm.',
  },

  // Hằng tuần
  {
    id: 'mgr-w-1',
    group: 'weekly',
    title: 'Họp phối hợp các bên',
    detail: 'ATLĐ phụ trách KTX về suất ăn và ANTT; tổ đội XD/ME phụ trách sửa chữa bảo trì; An ninh; đội DVVS.',
  },
  {
    id: 'mgr-w-2',
    group: 'weekly',
    title: 'Checklist cơ sở vật chất xây dựng',
    detail: 'Kiểm tra tình trạng phòng ở, biển hiệu, rãnh thoát nước, hệ thống cửa.',
  },
  {
    id: 'mgr-w-3',
    group: 'weekly',
    title: 'Checklist ME (Cơ điện)',
    detail: 'Kiểm tra điện, nước, áp lực nước, tủ điện chính, hệ thống lọc RO, máy bơm, điều hòa, loa phát thanh.',
  },
  {
    id: 'mgr-w-4',
    group: 'weekly',
    title: 'Chốt lịch trực vệ sinh và gom rác',
    detail: 'Phân công và chốt lịch trực vệ sinh khu vực chung, lịch thu gom rác tuần tới.',
  },
  {
    id: 'mgr-w-5',
    group: 'weekly',
    title: 'Tổng hợp báo cáo tuần (suất ăn, hạng mục XD và ME)',
    detail: 'Tổng hợp số liệu suất ăn, tiến độ sửa chữa XD và ME gửi Trưởng khu.',
  },
  {
    id: 'mgr-w-6',
    group: 'weekly',
    title: 'Kiểm tra số lượng bàn giao suất ăn',
    detail: 'Đối chiếu sổ ký nhận suất ăn của các tiểu đội trưởng với số liệu tổng hợp tuần.',
  },

  // Hằng tháng
  {
    id: 'mgr-m-1',
    group: 'monthly',
    title: 'Kiểm tra NCC cũ 2 lần/tháng',
    detail: 'Kiểm tra hồ sơ pháp lý, cơ sở vật chất chế biến và hồ sơ thanh toán của các NCC đang hợp tác.',
  },
  {
    id: 'mgr-m-2',
    group: 'monthly',
    title: 'Thẩm định NCC mới',
    detail: 'Đánh giá hồ sơ pháp lý, VSATTP và khảo sát thực tế cơ sở vật chất NCC mới.',
  },
  {
    id: 'mgr-m-3',
    group: 'monthly',
    title: 'Checklist PCCC định kỳ tháng',
    detail: 'Kiểm tra bình chữa cháy, họng nước vách tường, đèn exit, lối thoát nạn toàn khu KTX.',
  },
  {
    id: 'mgr-m-4',
    group: 'monthly',
    title: 'Đào tạo E-learning & các lớp do Trưởng phòng/Trưởng khu tổ chức',
    detail: 'Theo dõi tỷ lệ hoàn thành khóa học E-learning và điểm danh các lớp đào tạo tập trung.',
  },
];

interface ManagerTabProps {
  dateStr: string;
  users: User[];
  templates: TaskTemplate[];
  instances: TaskInstance[];
  nowMinutes: number;
  onAssignNewTask: (params: {
    title: string;
    detail: string;
    shift: ShiftType;
    startTime: string;
    endTime: string;
    assigneeId: string;
    requirePhoto: boolean;
    important: boolean;
  }) => void;
  onRemindUser: (user: User, message: string) => void;
}

const STORAGE_KEY_MGR = 'vincons_manager_checklist_v1';

export default function ManagerTab({
  dateStr,
  users,
  templates,
  instances,
  nowMinutes,
  onAssignNewTask,
  onRemindUser,
}: ManagerTabProps) {
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_MGR);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  const [assignModalUser, setAssignModalUser] = useState<User | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDetail, setNewDetail] = useState('');
  const [newShift, setNewShift] = useState<ShiftType>('sang');
  const [newStart, setNewStart] = useState('08:00');
  const [newEnd, setNewEnd] = useState('09:00');
  const [newRequirePhoto, setNewRequirePhoto] = useState(true);
  const [newImportant, setNewImportant] = useState(false);
  const [remindedUserId, setRemindedUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeFirestoreDoc<Record<string, boolean>>(
      'vincons_operations',
      'managerChecklist',
      (remote) => {
        if (remote && typeof remote === 'object') setCheckedMap(remote);
      }
    );
    return () => unsub();
  }, []);

  const toggleManagerItem = (id: string) => {
    setCheckedMap((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem(STORAGE_KEY_MGR, JSON.stringify(next));
      } catch {
        // ignore
      }
      void pushToFirestore('vincons_operations', 'managerChecklist', next);
      return next;
    });
  };

  // Staff stats for today
  const tplMap = new Map(templates.map((t) => [t.id, t]));
  const todayInstances = instances.filter((i) => i.date === dateStr);
  const unassignedCount = todayInstances.filter((i) => !i.assigneeId).length;

  const staffUsers = users.filter((u) => u.role === 'staff');

  const handleOpenAssign = (user: User) => {
    setAssignModalUser(user);
    setNewTitle('');
    setNewDetail('');
    setNewShift('sang');
    setNewStart('08:00');
    setNewEnd('09:00');
    setNewRequirePhoto(true);
    setNewImportant(false);
  };

  const handleSubmitAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalUser || !newTitle.trim()) return;
    onAssignNewTask({
      title: newTitle.trim(),
      detail: newDetail.trim() || 'Thực hiện theo yêu cầu của Quản lý.',
      shift: newShift,
      startTime: newStart,
      endTime: newEnd,
      assigneeId: assignModalUser.id,
      requirePhoto: newRequirePhoto,
      important: newImportant,
    });
    setAssignModalUser(null);
  };

  const handleRemind = (user: User, overdueCount: number) => {
    const msg =
      overdueCount > 0
        ? `Bạn có ${overdueCount} việc quá hạn hôm nay. Vui lòng kiểm tra và hoàn thành ngay.`
        : `Quản lý nhắc bạn kiểm tra tiến độ các đầu việc trong ca trực hôm nay.`;
    onRemindUser(user, msg);
    setRemindedUserId(user.id);
    setTimeout(() => setRemindedUserId(null), 2500);
  };

  const renderGroup = (
    groupKey: 'daily' | 'weekly' | 'monthly',
    title: string,
    icon: React.ReactNode
  ) => {
    const items = MANAGER_CHECKLIST_ITEMS.filter((i) => i.group === groupKey);
    const doneCount = items.filter((i) => checkedMap[i.id]).length;

    return (
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
            {icon}
            <span>{title}</span>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
            {doneCount}/{items.length}
          </span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item) => {
            const isChecked = Boolean(checkedMap[item.id]);
            return (
              <div
                key={item.id}
                className="p-3.5 sm:p-4 flex items-start gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition"
              >
                <button
                  type="button"
                  onClick={() => toggleManagerItem(item.id)}
                  className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center border-2 transition shrink-0 ${
                    isChecked
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400 hover:border-[#141e42]'
                  }`}
                >
                  <Check className="w-5 h-5 stroke-[2.5]" />
                </button>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-bold ${
                      isChecked
                        ? 'line-through text-slate-500 dark:text-slate-500'
                        : 'text-slate-900 dark:text-white'
                    }`}
                  >
                    {item.title}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                    {item.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="space-y-4">
      {/* Staff Tracking Table */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-[#141e42] text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Users className="w-4 h-4 text-orange-400" />
            <span>Theo dõi nhân viên vận hành ({dateStr.split('-').reverse().join('/')})</span>
          </div>
          {unassignedCount > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-orange-500 text-white">
              {unassignedCount} việc chưa ai nhận
            </span>
          )}
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {staffUsers.map((u) => {
            const userInsts = todayInstances.filter((i) => i.assigneeId === u.id);
            const total = userInsts.length;
            const done = userInsts.filter((i) => i.status === 'done').length;
            const overdue = userInsts.filter((i) => {
              const tpl = tplMap.get(i.templateId);
              return tpl ? computeTaskStatus(i, tpl, nowMinutes) === 'overdue' : false;
            }).length;
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;

            return (
              <div
                key={u.id}
                className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{u.name}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {u.code}
                    </span>
                    {overdue > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200">
                        <AlertTriangle className="w-3 h-3" />
                        {overdue} quá hạn
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                    <span>
                      Hoàn thành: <strong className="text-slate-900 dark:text-white">{done}/{total} ({pct}%)</strong>
                    </span>
                    <div className="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAssign(u)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#141e42] hover:bg-blue-900 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
                  >
                    <UserPlus className="w-4 h-4 text-orange-400" />
                    <span>Giao việc</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRemind(u, overdue)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 border border-amber-300 dark:border-amber-700 transition"
                  >
                    {remindedUserId === u.id ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Đã nhắc</span>
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4" />
                        <span>Nhắc việc</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3 Manager Checklist Groups */}
      {renderGroup('daily', 'Nhóm Hằng ngày (Quản lý)', <Calendar className="w-4 h-4 text-orange-500" />)}
      {renderGroup('weekly', 'Nhóm Hằng tuần (Quản lý)', <CalendarDays className="w-4 h-4 text-sky-500" />)}
      {renderGroup('monthly', 'Nhóm Hằng tháng (Quản lý)', <CalendarRange className="w-4 h-4 text-indigo-500" />)}

      {/* Assign Task Modal */}
      {assignModalUser && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitAssign}
            className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-700"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                  Giao việc cho {assignModalUser.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAssignModalUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Tên công việc *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="VD: Kiểm tra bổ sung máy bơm khu B"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Yêu cầu chi tiết
                </label>
                <textarea
                  rows={2}
                  value={newDetail}
                  onChange={(e) => setNewDetail(e.target.value)}
                  placeholder="Mô tả yêu cầu thực hiện..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ca</label>
                  <select
                    value={newShift}
                    onChange={(e) => setNewShift(e.target.value as ShiftType)}
                    className="w-full min-h-[44px] px-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="sang">Sáng</option>
                    <option value="trua">Trưa</option>
                    <option value="chieu">Chiều</option>
                    <option value="toi">Tối</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bắt đầu</label>
                  <input
                    type="time"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="w-full min-h-[44px] px-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Kết thúc</label>
                  <input
                    type="time"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="w-full min-h-[44px] px-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1">
                <label className="inline-flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={newRequirePhoto}
                    onChange={(e) => setNewRequirePhoto(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Bắt buộc ảnh
                </label>
                <label className="inline-flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                  <input
                    type="checkbox"
                    checked={newImportant}
                    onChange={(e) => setNewImportant(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Quan trọng
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setAssignModalUser(null)}
                className="min-h-[44px] px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Giao việc ngay</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
