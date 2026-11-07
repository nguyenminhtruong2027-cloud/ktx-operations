import React, { useState, useRef } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertTriangle,
  Sparkles,
  Utensils,
  User as UserIcon,
  Image as ImageIcon,
  Loader2,
} from 'lucide-react';
import { TaskTemplate, TaskInstance, ShiftType, ComputedTaskStatus } from '../types';
import { SHIFT_META, computeTaskStatus } from '../seedTemplates';
import { User } from '../../types';
import { compressImage } from '../../utils/helpers';
import { uploadTaskProofImage } from '../../utils/firebase';

interface DailyChecklistTabProps {
  dateStr: string;
  templates: TaskTemplate[];
  instances: TaskInstance[];
  currentUser: User;
  users: User[];
  nowMinutes: number;
  onToggleDone: (instance: TaskInstance, template: TaskTemplate) => void;
  onAddPhoto: (instance: TaskInstance, photoUrl: string) => void;
  onPreviewImage: (url: string, title?: string) => void;
  onOpenMeals?: () => void;
}

const SHIFTS: ShiftType[] = ['sang', 'trua', 'chieu', 'toi'];

const STATUS_BADGE: Record<
  ComputedTaskStatus,
  { label: string; className: string }
> = {
  upcoming: {
    label: 'Chưa đến giờ',
    className: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  doing: {
    label: 'Đang làm',
    className: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/50 dark:text-blue-200 dark:border-blue-700',
  },
  done: {
    label: 'Hoàn thành',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700',
  },
  overdue: {
    label: 'Quá hạn',
    className: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/60 dark:text-red-200 dark:border-red-700',
  },
};

export default function DailyChecklistTab({
  dateStr,
  templates,
  instances,
  currentUser,
  users,
  nowMinutes,
  onToggleDone,
  onAddPhoto,
  onPreviewImage,
  onOpenMeals,
}: DailyChecklistTabProps) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [photoWarningId, setPhotoWarningId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadInstanceRef = useRef<TaskInstance | null>(null);

  const isAdmin = currentUser.role === 'manager';

  // Filter instances for today: pure daily checklist
  const todayInstances = instances.filter((inst) => inst.date === dateStr);

  const templateMap = new Map<string, TaskTemplate>();
  templates.forEach((t) => templateMap.set(t.id, t));

  const enriched = todayInstances
    .map((inst) => {
      const tpl = templateMap.get(inst.templateId);
      if (!tpl) return null;
      const computedStatus = computeTaskStatus(inst, tpl, nowMinutes);
      return { inst, tpl, computedStatus };
    })
    .filter((x): x is { inst: TaskInstance; tpl: TaskTemplate; computedStatus: ComputedTaskStatus } => x !== null);

  const totalCount = enriched.length;
  const doneCount = enriched.filter((x) => x.computedStatus === 'done').length;
  const overdueCount = enriched.filter((x) => x.computedStatus === 'overdue').length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const triggerPhotoUpload = (inst: TaskInstance) => {
    pendingUploadInstanceRef.current = inst;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetInst = pendingUploadInstanceRef.current;
    e.target.value = '';
    if (!file || !targetInst) return;

    setUploadingId(targetInst.id);
    setPhotoWarningId(null);
    try {
      const compressed = await compressImage(file, 1024, 0.75);
      const storagePath = `task-proofs/${dateStr}/${targetInst.id}_${Date.now()}.jpg`;
      const url = await uploadTaskProofImage(compressed, storagePath);
      onAddPhoto(targetInst, url);
    } finally {
      setUploadingId(null);
      pendingUploadInstanceRef.current = null;
    }
  };

  const handleTick = (inst: TaskInstance, tpl: TaskTemplate) => {
    if (inst.status !== 'done' && tpl.requirePhoto && inst.photoUrls.length === 0) {
      setPhotoWarningId(inst.id);
      setExpandedIds((prev) => ({ ...prev, [inst.id]: true }));
      return;
    }
    setPhotoWarningId(null);
    onToggleDone(inst, tpl);
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Daily Progress & 3 Counters */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Checklist công tác ngày {dateStr.split('-').reverse().join('/')}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Checklist chuẩn 4 ca trực vận hành lán trại • Bấm tick để hoàn thành
            </p>
          </div>
          <span className="text-lg font-extrabold text-[#141e42] dark:text-orange-400">
            {progressPct}%
          </span>
        </div>

        <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#141e42] to-orange-500 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-2.5 text-center border border-slate-200 dark:border-slate-700">
            <div className="text-xl font-extrabold text-slate-900 dark:text-white">{totalCount}</div>
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Việc hôm nay</div>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded-xl p-2.5 text-center border border-emerald-200 dark:border-emerald-800">
            <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">{doneCount}</div>
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Hoàn thành</div>
          </div>
          <div className="bg-red-50 dark:bg-red-950/40 rounded-xl p-2.5 text-center border border-red-200 dark:border-red-800">
            <div className="text-xl font-extrabold text-red-700 dark:text-red-300">{overdueCount}</div>
            <div className="text-[11px] font-semibold text-red-700 dark:text-red-400">Quá hạn</div>
          </div>
        </div>
      </div>

      {/* 4 Shifts */}
      {SHIFTS.map((shiftKey) => {
        const shiftItems = enriched.filter((x) => x.tpl.shift === shiftKey);
        if (shiftItems.length === 0) return null;
        const shiftDone = shiftItems.filter((x) => x.computedStatus === 'done').length;
        const meta = SHIFT_META[shiftKey];

        return (
          <section
            key={shiftKey}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
          >
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${meta.badgeClass}`}>
                  {meta.label}
                </span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {meta.timeRange}
                </span>
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                {shiftDone}/{shiftItems.length}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {shiftItems.map(({ inst, tpl, computedStatus }) => {
                const isExpanded = Boolean(expandedIds[inst.id]);
                const isDone = computedStatus === 'done';
                const isOverdue = computedStatus === 'overdue';
                const statusInfo = STATUS_BADGE[computedStatus];
                const assignee = users.find((u) => u.id === inst.assigneeId);

                const rowBg = isOverdue
                  ? 'bg-red-50/70 dark:bg-red-950/30'
                  : tpl.important
                  ? 'bg-amber-50/80 dark:bg-amber-950/25'
                  : 'bg-white dark:bg-slate-900';

                return (
                  <div key={inst.id} className={`p-3.5 sm:p-4 transition-colors ${rowBg}`}>
                    <div className="flex items-start gap-3">
                      {/* Tick button (min 44x44px) */}
                      <button
                        type="button"
                        onClick={() => handleTick(inst, tpl)}
                        aria-label={`Đánh dấu hoàn thành ${tpl.title}`}
                        className={`min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center border-2 transition shrink-0 ${
                          isDone
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                            : isOverdue
                            ? 'bg-white dark:bg-slate-900 border-red-400 text-red-600 hover:bg-red-50'
                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-400 hover:border-[#141e42]'
                        }`}
                      >
                        <Check className="w-5 h-5 stroke-[2.5]" />
                      </button>

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-[#141e42] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                            <Clock className="w-3.5 h-3.5 text-orange-500" />
                            {tpl.startTime}–{tpl.endTime}
                          </span>

                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${statusInfo.className}`}>
                            {statusInfo.label}
                          </span>

                          {tpl.important && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 border border-amber-400">
                              <Sparkles className="w-3 h-3" />
                              Quan trọng
                            </span>
                          )}

                          {tpl.requirePhoto && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              <Camera className="w-3 h-3" />
                              {inst.photoUrls.length > 0 ? `Đã đính ${inst.photoUrls.length} ảnh` : 'Cần ảnh'}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleExpand(inst.id)}
                          className="w-full text-left flex items-start justify-between gap-2 group"
                        >
                          <span
                            className={`text-sm sm:text-base font-bold leading-snug ${
                              isDone
                                ? 'line-through text-slate-500 dark:text-slate-500'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {tpl.title}
                          </span>
                          <span className="p-1 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </span>
                        </button>

                        {/* Warning if photo required */}
                        {photoWarningId === inst.id && (
                          <div className="mt-2 p-2.5 rounded-xl bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 text-red-800 dark:text-red-200 text-xs font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Việc này bắt buộc chụp ảnh minh chứng trước khi tick hoàn thành.</span>
                          </div>
                        )}

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-300 space-y-2">
                            <p className="leading-relaxed">{tpl.detail}</p>
                            {inst.doneAt && (
                              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                                Hoàn thành lúc: {inst.doneAt}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Action bar: Photo upload + Meal link */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => triggerPhotoUpload(inst)}
                            disabled={uploadingId === inst.id}
                            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-600 transition"
                          >
                            {uploadingId === inst.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Camera className="w-4 h-4 text-orange-500" />
                            )}
                            <span>{uploadingId === inst.id ? 'Đang tải ảnh...' : 'Chụp / Đính ảnh'}</span>
                          </button>

                          {tpl.mealLink && onOpenMeals && (
                            <button
                              type="button"
                              onClick={onOpenMeals}
                              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition"
                            >
                              <Utensils className="w-4 h-4" />
                              <span>Mở phiếu Suất ăn</span>
                            </button>
                          )}

                          {inst.photoUrls.map((url, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => onPreviewImage(url, tpl.title)}
                              className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-orange-400"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Ảnh {idx + 1}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
