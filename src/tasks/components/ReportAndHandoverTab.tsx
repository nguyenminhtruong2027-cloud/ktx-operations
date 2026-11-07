import React, { useState } from 'react';
import {
  FileBarChart,
  Printer,
  Mail,
  Send,
  CheckCheck,
  AlertTriangle,
  Image as ImageIcon,
  ArrowRightLeft,
} from 'lucide-react';
import { TaskTemplate, TaskInstance } from '../types';
import { computeTaskStatus } from '../seedTemplates';
import { User, ShiftHandoverItem } from '../../types';

interface ReportAndHandoverTabProps {
  dateStr: string;
  currentUser: User;
  templates: TaskTemplate[];
  instances: TaskInstance[];
  nowMinutes: number;
  handoverList: ShiftHandoverItem[];
  onCreateHandover: (handover: ShiftHandoverItem) => void;
  onAcknowledgeHandover: (handoverId: string) => void;
  onPreviewImage: (url: string, title?: string) => void;
}

export default function ReportAndHandoverTab({
  dateStr,
  currentUser,
  templates,
  instances,
  nowMinutes,
  handoverList,
  onCreateHandover,
  onAcknowledgeHandover,
  onPreviewImage,
}: ReportAndHandoverTabProps) {
  const [shiftName, setShiftName] = useState(
    currentUser.currentShift || 'Ca sáng (05:00 - 13:30)'
  );
  const [handoverNote, setHandoverNote] = useState('');
  const [workerFeedback, setWorkerFeedback] = useState('');

  const tplMap = new Map(templates.map((t) => [t.id, t]));
  const todayInstances = instances.filter((i) => i.date === dateStr);

  const enriched = todayInstances
    .map((inst) => {
      const tpl = tplMap.get(inst.templateId);
      if (!tpl) return null;
      return { inst, tpl, status: computeTaskStatus(inst, tpl, nowMinutes) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const total = enriched.length;
  const doneList = enriched.filter((x) => x.status === 'done');
  const overdueList = enriched.filter((x) => x.status === 'overdue');
  const pendingList = enriched.filter((x) => x.status !== 'done');
  const pct = total > 0 ? Math.round((doneList.length / total) * 100) : 0;

  const allPhotos = enriched.flatMap((x) =>
    x.inst.photoUrls.map((url) => ({ url, title: x.tpl.title }))
  );

  const handleExportPDF = () => {
    window.print();
  };

  const handleSendWeeklyEmail = () => {
    const subject = encodeURIComponent(
      `[VINCONS - KTX Hóc Môn] Báo cáo vận hành ngày ${dateStr.split('-').reverse().join('/')}`
    );
    const body = encodeURIComponent(
      `Kính gửi Trưởng khu,\n\n` +
        `Báo cáo tổng hợp vận hành ngày ${dateStr.split('-').reverse().join('/')}:\n` +
        `- Tỷ lệ hoàn thành: ${doneList.length}/${total} (${pct}%)\n` +
        `- Số việc quá hạn: ${overdueList.length}\n` +
        `- Số ảnh minh chứng đã lưu: ${allPhotos.length}\n` +
        (overdueList.length > 0
          ? `\nCác việc quá hạn:\n${overdueList.map((o) => `  + ${o.tpl.title} (${o.tpl.startTime}-${o.tpl.endTime})`).join('\n')}\n`
          : '') +
        (workerFeedback.trim() ? `\nÝ kiến công nhân:\n${workerFeedback.trim()}\n` : '') +
        `\nTrân trọng,\n${currentUser.name}`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleSubmitHandover = (e: React.FormEvent) => {
    e.preventDefault();
    const newHandover: ShiftHandoverItem = {
      id: `ho-${Date.now()}`,
      date: dateStr,
      shift: shiftName,
      authorId: currentUser.id,
      authorName: currentUser.name,
      notes:
        handoverNote.trim() ||
        `Bàn giao cuối ${shiftName}: còn ${pendingList.length} việc chưa hoàn thành.`,
      pendingTasksCount: pendingList.length,
      pendingTaskTitles: pendingList.slice(0, 8).map((p) => p.tpl.title),
      status: 'pending',
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
    onCreateHandover(newHandover);
    setHandoverNote('');
  };

  return (
    <div className="space-y-4">
      {/* Daily & End-of-Shift Auto Report */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-orange-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Báo cáo ngày & Hết ca ({dateStr.split('-').reverse().join('/')})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tự động tổng hợp từ checklist vận hành
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleExportPDF}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#141e42] hover:bg-blue-900 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4 text-orange-400" />
              <span>Xuất PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSendWeeklyEmail}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
            >
              <Mail className="w-4 h-4" />
              <span>Gửi email Trưởng khu</span>
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-center">
            <div className="text-xl font-extrabold text-slate-900 dark:text-white">{pct}%</div>
            <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              Hoàn thành ({doneList.length}/{total})
            </div>
          </div>
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-center">
            <div className="text-xl font-extrabold text-red-700 dark:text-red-300">
              {overdueList.length}
            </div>
            <div className="text-[11px] font-semibold text-red-700 dark:text-red-400">
              Việc quá hạn
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center">
            <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
              {allPhotos.length}
            </div>
            <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              Ảnh minh chứng
            </div>
          </div>
        </div>

        {/* Overdue list */}
        {overdueList.length > 0 && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-200">
              <AlertTriangle className="w-4 h-4" />
              <span>Danh sách việc quá hạn ({overdueList.length})</span>
            </div>
            <ul className="list-disc list-inside text-xs text-red-700 dark:text-red-300 space-y-1">
              {overdueList.map((o) => (
                <li key={o.inst.id}>
                  <strong>{o.tpl.startTime}–{o.tpl.endTime}:</strong> {o.tpl.title}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Proof photos */}
        {allPhotos.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-emerald-600" />
              <span>Ảnh minh chứng trong ngày ({allPhotos.length})</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {allPhotos.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onPreviewImage(p.url, p.title)}
                  className="aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-orange-500 transition"
                >
                  <img src={p.url} alt={p.title} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Worker feedback for weekly report */}
        <div className="print:hidden">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            Tổng hợp ý kiến công nhân (đính kèm khi gửi email báo cáo)
          </label>
          <textarea
            rows={2}
            value={workerFeedback}
            onChange={(e) => setWorkerFeedback(e.target.value)}
            placeholder="Nhập ý kiến phản hồi của công nhân về suất ăn, phòng ở, điện nước..."
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
          />
        </div>
      </section>

      {/* Shift Handover */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4 shadow-sm print:hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <ArrowRightLeft className="w-5 h-5 text-orange-500" />
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Bàn giao ca (Tự gom {pendingList.length} việc chưa xong)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chuyển tiếp việc tồn đọng và ghi chú cuối ca cho ca sau
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmitHandover} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ca bàn giao
              </label>
              <select
                value={shiftName}
                onChange={(e) => setShiftName(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
              >
                <option value="Ca sáng (05:00 - 13:30)">Ca sáng (05:00 - 13:30)</option>
                <option value="Ca chiều (13:30 - 22:00)">Ca chiều (13:30 - 22:00)</option>
                <option value="Ca đêm (22:00 - 05:00)">Ca đêm (22:00 - 05:00)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Ghi chú bàn giao cuối ca
            </label>
            <textarea
              rows={2}
              value={handoverNote}
              onChange={(e) => setHandoverNote(e.target.value)}
              placeholder="Ghi chú tình hình ca trực, sự cố cần ca sau theo dõi..."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#141e42] hover:bg-blue-900 text-white text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <Send className="w-4 h-4 text-orange-400" />
            <span>Tạo biên bản bàn giao ca</span>
          </button>
        </form>

        {/* Handover history */}
        <div className="space-y-2.5 pt-2">
          {handoverList.slice(0, 5).map((ho) => (
            <div
              key={ho.id}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  {ho.shift} • <span className="text-slate-500">{ho.date}</span>
                </div>
                {ho.acknowledgedBy ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                    <CheckCheck className="w-3.5 h-3.5" />
                    Đã nhận: {ho.acknowledgedBy} ({ho.acknowledgedAt})
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAcknowledgeHandover(ho.id)}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold"
                  >
                    Xác nhận nhận ca
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300">{ho.notes}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
