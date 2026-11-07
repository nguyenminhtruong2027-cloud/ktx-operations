import { useState, useEffect } from 'react';
import {
  BookOpen,
  Check,
  Calendar,
  ArrowRight,
  StickyNote,
  Sparkles,
} from 'lucide-react';
import { pushToFirestore, subscribeFirestoreDoc } from '../../utils/firebase';

interface FixedWeeklyTask {
  id: string;
  dayIndex: number; // 1 = T2 .. 7 = CN
  title: string;
  weekOfMonth?: number[]; // e.g. [1, 3] or [2, 4]
}

const FIXED_WEEKLY_TASKS: FixedWeeklyTask[] = [
  { id: 'wk-t2-1', dayIndex: 1, title: 'Đối soát bàn giao suất ăn tuần trước' },
  { id: 'wk-t3-1', dayIndex: 2, title: 'Thu thập ý kiến công nhân' },
  { id: 'wk-t4-1', dayIndex: 3, title: 'Yêu cầu NCC gửi thực đơn tuần' },
  { id: 'wk-t5-1', dayIndex: 4, title: 'Kiểm tra và gửi lại thực đơn thống nhất với NCC' },
  {
    id: 'wk-t6-1',
    dayIndex: 5,
    title: 'Chốt thực đơn, trình ký, gửi nhóm báo cơm (tổ trưởng) và nhóm suất ăn (NCC)',
  },
  {
    id: 'wk-t6-2',
    dayIndex: 5,
    title: 'Kiểm tra định kỳ cơ sở chế biến NCC',
    weekOfMonth: [2, 4],
  },
  {
    id: 'wk-t6-3',
    dayIndex: 5,
    title: 'Kiểm tra đột xuất cơ sở chế biến NCC',
    weekOfMonth: [1, 3],
  },
  { id: 'wk-t7-1', dayIndex: 6, title: 'Báo cáo tuần qua email' },
  {
    id: 'wk-t7-2',
    dayIndex: 6,
    title: 'Gửi danh sách tạm trú cho công an (lấy bản cứng có dấu)',
  },
  {
    id: 'wk-cn-1',
    dayIndex: 7,
    title: 'Rà soát tồn đọng tuần & chuẩn bị kế hoạch tuần mới',
  },
];

const DAY_LABELS: Record<number, string> = {
  1: 'Thứ 2',
  2: 'Thứ 3',
  3: 'Thứ 4',
  4: 'Thứ 5',
  5: 'Thứ 6',
  6: 'Thứ 7',
  7: 'Chủ nhật',
};

function getWeekInfo(date: Date): { weekKey: string; weekOfMonth: number; todayIndex: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // 1..7 (Mon..Sun)
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const weekKey = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  const weekOfMonth = Math.min(4, Math.ceil(date.getDate() / 7));
  const todayIndex = date.getDay() === 0 ? 7 : date.getDay();
  return { weekKey, weekOfMonth, todayIndex };
}

interface WeeklyNotebookState {
  checked: Record<string, boolean>;
  notes: Record<number, string>; // 1..7 for days, 0 for "Ghi nhớ chung cả tuần"
  generalDone?: boolean;
}

const STORAGE_KEY_NOTEBOOK = 'vincons_weekly_notebook_v1';

export default function WeeklyNotebookTab() {
  const { weekKey, weekOfMonth, todayIndex } = getWeekInfo(new Date());

  const [stateByWeek, setStateByWeek] = useState<Record<string, WeeklyNotebookState>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_NOTEBOOK);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {};
  });

  const [carriedOverMsg, setCarriedOverMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeFirestoreDoc<Record<string, WeeklyNotebookState>>(
      'vincons_operations',
      'weeklyNotes',
      (remote) => {
        if (remote && typeof remote === 'object') setStateByWeek(remote);
      }
    );
    return () => unsub();
  }, []);

  const currentWeekState: WeeklyNotebookState = stateByWeek[weekKey] || {
    checked: {},
    notes: {},
    generalDone: false,
  };

  const updateCurrentWeek = (updater: (prev: WeeklyNotebookState) => WeeklyNotebookState) => {
    setStateByWeek((prev) => {
      const curr = prev[weekKey] || { checked: {}, notes: {}, generalDone: false };
      const next = { ...prev, [weekKey]: updater(curr) };
      try {
        localStorage.setItem(STORAGE_KEY_NOTEBOOK, JSON.stringify(next));
      } catch {
        // ignore
      }
      void pushToFirestore('vincons_operations', 'weeklyNotes', next);
      return next;
    });
  };

  const toggleTask = (taskId: string) => {
    updateCurrentWeek((curr) => ({
      ...curr,
      checked: { ...curr.checked, [taskId]: !curr.checked[taskId] },
    }));
  };

  const updateNote = (dayIndex: number, text: string) => {
    updateCurrentWeek((curr) => ({
      ...curr,
      notes: { ...curr.notes, [dayIndex]: text },
    }));
  };

  const handleCarryOverToNextWeek = () => {
    const generalText = (currentWeekState.notes[0] || '').trim();
    if (!generalText) return;
    const [y, w] = weekKey.split('-W').map(Number);
    const nextWeekKey = `${y}-W${String((w || 1) + 1).padStart(2, '0')}`;
    setStateByWeek((prev) => {
      const nextWeek = prev[nextWeekKey] || { checked: {}, notes: {}, generalDone: false };
      const existing = (nextWeek.notes[0] || '').trim();
      const combined = existing ? `${existing}\n[Từ ${weekKey}]: ${generalText}` : `[Từ ${weekKey}]: ${generalText}`;
      const next = {
        ...prev,
        [nextWeekKey]: {
          ...nextWeek,
          notes: { ...nextWeek.notes, 0: combined },
        },
      };
      try {
        localStorage.setItem(STORAGE_KEY_NOTEBOOK, JSON.stringify(next));
      } catch {
        // ignore
      }
      void pushToFirestore('vincons_operations', 'weeklyNotes', next);
      return next;
    });
    setCarriedOverMsg(`Đã chuyển ghi nhớ sang tuần ${nextWeekKey}`);
    setTimeout(() => setCarriedOverMsg(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 rounded-xl bg-[#141e42] text-orange-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Sổ tay tuần ({weekKey})
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Tuần thứ <strong>{weekOfMonth}</strong> trong tháng • Tự động lưu ghi chú
            </p>
          </div>
        </div>
      </div>

      {/* Ghi nhớ chung cả tuần */}
      <div className="bg-amber-50/90 dark:bg-amber-950/30 rounded-2xl border border-amber-300 dark:border-amber-800 p-4 space-y-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-950 dark:text-amber-200">
            <StickyNote className="w-4 h-4 text-orange-500" />
            <span>Ghi nhớ chung cả tuần</span>
          </div>
          <button
            type="button"
            onClick={handleCarryOverToNextWeek}
            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 inline-flex items-center gap-1.5 transition"
          >
            <span>Chuyển sang tuần sau</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <textarea
          rows={3}
          value={currentWeekState.notes[0] || ''}
          onChange={(e) => updateNote(0, e.target.value)}
          placeholder="Ghi chú các việc quan trọng cần nhớ trong tuần (tự động lưu)..."
          className="w-full p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-400"
        />

        {carriedOverMsg && (
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
            {carriedOverMsg}
          </p>
        )}
      </div>

      {/* 7 Day Cards (Thứ 2 -> Chủ nhật) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {[1, 2, 3, 4, 5, 6, 7].map((dayIdx) => {
          const isToday = dayIdx === todayIndex;
          const dayTasks = FIXED_WEEKLY_TASKS.filter((t) => t.dayIndex === dayIdx);

          return (
            <div
              key={dayIdx}
              className={`bg-white dark:bg-slate-900 rounded-2xl p-4 space-y-3 shadow-sm transition ${
                isToday
                  ? 'border-2 border-orange-500 ring-2 ring-orange-200 dark:ring-orange-900/50'
                  : 'border border-slate-200 dark:border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Calendar className={`w-4 h-4 ${isToday ? 'text-orange-500' : 'text-slate-400'}`} />
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {DAY_LABELS[dayIdx]}
                  </span>
                </div>
                {isToday && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-orange-500 text-white">
                    <Sparkles className="w-3 h-3" />
                    Hôm nay
                  </span>
                )}
              </div>

              {/* Fixed tasks for this day */}
              <div className="space-y-2">
                {dayTasks.map((task) => {
                  const isCurrentWeekTask =
                    !task.weekOfMonth || task.weekOfMonth.includes(weekOfMonth);
                  const isChecked = Boolean(currentWeekState.checked[task.id]);

                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-2.5 p-2 rounded-xl border border-slate-100 dark:border-slate-800 ${
                        !isCurrentWeekTask ? 'opacity-45 bg-slate-50 dark:bg-slate-800/40' : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center border-2 transition shrink-0 ${
                          isChecked
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400'
                        }`}
                      >
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-xs sm:text-sm font-semibold leading-snug ${
                            isChecked
                              ? 'line-through text-slate-500'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {task.title}
                        </div>
                        {task.weekOfMonth && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Áp dụng tuần {task.weekOfMonth.join(' & ')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Auto-saving day note */}
              <div>
                <textarea
                  rows={2}
                  value={currentWeekState.notes[dayIdx] || ''}
                  onChange={(e) => updateNote(dayIdx, e.target.value)}
                  placeholder={`Ghi chú ${DAY_LABELS[dayIdx]}...`}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
