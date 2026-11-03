import { useState, useRef } from 'react';
import { TaskItem, User, ShiftHandoverItem } from '../types';
import { isTaskOverdue, isTaskUpcoming, formatDateVN, compressImage } from '../utils/helpers';
import {
  CheckCircle2, Clock, AlertTriangle, Play, Check, Camera, Upload,
  FileText, Plus, Shield, ArrowRight, UserCheck, CheckSquare, MessageSquare,
  AlertCircle, Sparkles, Inbox, RefreshCw, CheckCheck
} from 'lucide-react';

interface StaffDashboardProps {
  tasks: TaskItem[];
  currentUser: User;
  currentDate: string;
  onUpdateTask: (task: TaskItem) => void;
  handoverList: ShiftHandoverItem[];
  onCreateHandover: (handover: ShiftHandoverItem) => void;
  onAcknowledgeHandover: (handoverId: string) => void;
  onPreviewImage: (url: string, title?: string) => void;
}

export default function StaffDashboard({
  tasks,
  currentUser,
  currentDate,
  onUpdateTask,
  handoverList,
  onCreateHandover,
  onAcknowledgeHandover,
  onPreviewImage
}: StaffDashboardProps) {
  const [activeTab, setActiveTab] = useState<'myTasks' | 'openTasks' | 'handover'>('myTasks');
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Form states for working on task
  const [resultText, setResultText] = useState('');
  const [metricValue, setMetricValue] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [proofImages, setProofImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Shift handover form state
  const [newShiftName, setNewShiftName] = useState(currentUser.currentShift || 'Ca sáng (05:00 - 13:30)');
  const [newShiftNotes, setNewShiftNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Filter tasks assigned to current user for today
  const myTasks = tasks.filter(t => t.date === currentDate && t.assigneeId === currentUser.id);

  // Open / unassigned tasks for today
  const openTasks = tasks.filter(t => t.date === currentDate && (!t.assigneeId || t.assigneeId === 'unassigned' || t.assigneeId === ''));

  // Upcoming tasks within 15 minutes
  const upcomingTasks = myTasks.filter(t => isTaskUpcoming(t));

  const handleStartTask = (task: TaskItem) => {
    const updated: TaskItem = {
      ...task,
      status: 'Đang làm',
      startTimeRecorded: `${currentDate} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
      history: [
        ...task.history,
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
          actorName: currentUser.name,
          action: 'Bắt đầu thực hiện công việc'
        }
      ]
    };
    onUpdateTask(updated);
    setSelectedTask(updated);
  };

  const handleClaimTask = (task: TaskItem) => {
    const updated: TaskItem = {
      ...task,
      assigneeId: currentUser.id,
      history: [
        ...task.history,
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
          actorName: currentUser.name,
          action: 'Chủ động nhận công việc chưa giao',
          details: `Chuyên viên ${currentUser.name} nhận trách nhiệm phụ trách`
        }
      ]
    };
    onUpdateTask(updated);
    alert(`Bạn đã nhận việc "${task.title}" thành công!`);
  };

  const handleCompleteTask = (task: TaskItem) => {
    if (task.proofRequired && proofImages.length === 0 && task.proofImages.length === 0) {
      alert('⚠️ Công việc này yêu cầu ảnh minh chứng! Vui lòng chụp hoặc tải ảnh hiện trường trước khi bấm Hoàn thành.');
      return;
    }

    const updated: TaskItem = {
      ...task,
      status: 'Chờ duyệt',
      resultText: resultText || task.resultText || 'Đã thực hiện xong theo đúng quy trình.',
      metricValue: metricValue || task.metricValue,
      handoverNotes: handoverNotes || task.handoverNotes,
      proofImages: proofImages.length > 0 ? proofImages : task.proofImages,
      endTimeRecorded: `${currentDate} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`,
      history: [
        ...task.history,
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
          actorName: currentUser.name,
          action: 'Hoàn thành công việc, gửi chờ quản lý duyệt',
          details: resultText
        }
      ]
    };
    onUpdateTask(updated);
    setSelectedTask(null);
    setResultText('');
    setMetricValue('');
    setHandoverNotes('');
    setProofImages([]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const newImages: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressedBase64 = await compressImage(files[i]);
        newImages.push(compressedBase64);
      }
      setProofImages(prev => [...prev, ...newImages]);
    } catch (err) {
      console.error('Lỗi nén ảnh:', err);
      alert('Không thể tải ảnh. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSimulatePhotoUpload = () => {
    const samplePhotos = [
      'https://images.unsplash.com/photo-1541888946425-d0fbb18f86e3?w=600',
      'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600',
      'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600',
      'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=600'
    ];
    const randomPhoto = samplePhotos[Math.floor(Math.random() * samplePhotos.length)];
    setProofImages([...proofImages, randomPhoto]);
  };

  // Pending tasks for handover summary
  const pendingTasks = myTasks.filter(t => t.status !== 'Hoàn thành');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Staff Operational Header Card */}
      <div className="bg-gradient-to-r from-(--vc-brand-2) to-blue-900 text-white p-6 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <img src={currentUser.avatar} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-amber-400 shadow" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase tracking-wider text-amber-300 font-semibold">Chuyên viên Vận hành VINCONS</span>
              <span className="px-1.5 py-0.2 bg-blue-800 text-slate-200 text-[10px] rounded font-mono">
                {currentUser.code}
              </span>
            </div>
            <h2 className="text-xl font-bold">{currentUser.name}</h2>
            <p className="text-xs text-blue-200 mt-0.5">
              Khu vực: {currentUser.khuVuc} • {currentUser.currentShift || 'Ca sáng'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 bg-blue-950/60 px-4 py-2.5 rounded-xl border border-blue-800 text-xs">
          <div className="text-center px-3 border-r border-blue-800">
            <div className="text-amber-300 font-bold text-base">{myTasks.length}</div>
            <div className="text-slate-300">Việc hôm nay</div>
          </div>
          <div className="text-center px-3 border-r border-blue-800">
            <div className="text-emerald-400 font-bold text-base">{myTasks.filter(t => t.status === 'Hoàn thành').length}</div>
            <div className="text-slate-300">Hoàn thành</div>
          </div>
          <div className="text-center px-3">
            <div className="text-red-400 font-bold text-base">{myTasks.filter(t => isTaskOverdue(t)).length}</div>
            <div className="text-slate-300">Quá hạn</div>
          </div>
        </div>
      </div>

      {/* Proactive Upcoming Tasks Reminder Banner */}
      {upcomingTasks.length > 0 && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-start space-x-3 animate-pulse">
          <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="flex-1 text-xs">
            <span className="font-bold text-amber-900">🔔 SẮP ĐẾN GIỜ THỰC HIỆN CÔNG VIỆC:</span>
            <div className="mt-1 space-y-1">
              {upcomingTasks.map(t => (
                <div key={t.id} className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    • {t.title} ({t.startTime} - {t.endTime})
                  </span>
                  <button
                    onClick={() => {
                      setSelectedTask(t);
                      setResultText(t.resultText || '');
                      setMetricValue(t.metricValue || '');
                      setHandoverNotes(t.handoverNotes || '');
                      setProofImages(t.proofImages || []);
                    }}
                    className="px-2 py-0.5 bg-(--vc-brand-2) text-white rounded font-bold hover:bg-blue-900 transition"
                  >
                    Mở việc ngay
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl shadow-sm overflow-x-auto">
        <button
          onClick={() => setActiveTab('myTasks')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-sm transition whitespace-nowrap ${
            activeTab === 'myTasks' ? 'border-(--vc-brand-2) text-(--vc-brand-2)' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>Việc của tôi hôm nay ({myTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('openTasks')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-sm transition whitespace-nowrap ${
            activeTab === 'openTasks' ? 'border-(--vc-brand-2) text-(--vc-brand-2)' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Việc chưa ai nhận ({openTasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('handover')}
          className={`flex items-center space-x-2 py-3 px-5 border-b-2 font-bold text-sm transition whitespace-nowrap ${
            activeTab === 'handover' ? 'border-(--vc-brand-2) text-(--vc-brand-2)' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Bàn giao ca ({handoverList.length})</span>
        </button>
      </div>

      {/* TAB 1: MY TASKS TIMELINE */}
      {activeTab === 'myTasks' && (
        <div className="space-y-4">
          {myTasks.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-slate-200 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-slate-800 text-base">Không có công việc nào được giao cho bạn hôm nay</h3>
              <p className="text-xs text-slate-500">
                Bạn có thể bấm qua tab <strong>"Việc chưa ai nhận"</strong> để chủ động nhận việc hỗ trợ đồng đội.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myTasks.map(task => {
                const overdue = isTaskOverdue(task);
                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      setResultText(task.resultText || '');
                      setMetricValue(task.metricValue || '');
                      setHandoverNotes(task.handoverNotes || '');
                      setProofImages(task.proofImages || []);
                    }}
                    className={`bg-white p-5 rounded-2xl shadow-sm border transition cursor-pointer hover:shadow-md relative overflow-hidden flex flex-col justify-between ${
                      overdue ? 'border-red-300 bg-red-50/30' :
                      task.status === 'Hoàn thành' ? 'border-emerald-200 bg-emerald-50/20' :
                      task.status === 'Cần làm lại' ? 'border-purple-300 bg-purple-50/30' :
                      'border-slate-200'
                    }`}
                  >
                    {task.isImportant && (
                      <div className="absolute top-0 right-0 bg-amber-500 text-slate-900 text-[10px] font-bold px-3 py-1 rounded-bl-lg shadow-sm">
                        VIỆC QUAN TRỌNG
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-(--vc-brand-2) bg-blue-50 px-2.5 py-1 rounded-md">
                          {task.startTime} - {task.endTime}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          overdue ? 'bg-red-100 text-red-700' :
                          task.status === 'Hoàn thành' ? 'bg-emerald-100 text-emerald-800' :
                          task.status === 'Chờ duyệt' ? 'bg-blue-100 text-blue-800' :
                          task.status === 'Đang làm' ? 'bg-amber-100 text-amber-800' :
                          task.status === 'Cần làm lại' ? 'bg-purple-100 text-purple-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {overdue ? 'Quá hạn' : task.status}
                        </span>
                      </div>

                      <h4 className="font-bold text-slate-900 text-base">{task.title}</h4>

                      <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <p className="font-semibold text-slate-700">Yêu cầu thực hiện:</p>
                        <ul className="list-disc list-inside space-y-0.5 text-slate-600">
                          {task.requirements.map((req, i) => (
                            <li key={i}>{req}</li>
                          ))}
                        </ul>
                      </div>

                      {task.managerNotes && (
                        <div className="bg-purple-100 text-purple-900 p-2.5 rounded-lg text-xs font-medium">
                          💬 Ghi chú quản lý: {task.managerNotes}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[11px] text-slate-400">
                        {task.proofRequired ? '📷 Bắt buộc ảnh minh chứng' : 'Không bắt buộc ảnh'}
                      </div>
                      <button className="px-3 py-1.5 bg-(--vc-brand-2) text-white text-xs font-semibold rounded-lg hover:bg-blue-900 flex items-center space-x-1">
                        <span>Xử lý việc</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OPEN / UNASSIGNED TASKS */}
      {activeTab === 'openTasks' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
            <span>Danh sách công việc chưa được phân công phụ trách. Bạn có thể tự nguyện nhận việc để thực hiện.</span>
          </div>

          {openTasks.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-xl shadow-sm border border-slate-200 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-bold text-slate-800 text-sm">Hiện không có công việc nào chưa giao!</p>
              <p className="text-xs text-slate-500">Mọi công việc đã được phân bổ đầy đủ cho các nhân sự.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {openTasks.map(task => (
                <div key={task.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-(--vc-brand-2) bg-blue-50 px-2.5 py-1 rounded-md">
                        {task.startTime} - {task.endTime}
                      </span>
                      {task.isImportant && (
                        <span className="px-2 py-0.5 bg-amber-500 text-slate-900 font-bold text-[10px] rounded">
                          Quan trọng
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm mt-2">{task.title}</h4>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.requirements.join(', ')}</p>
                  </div>

                  <button
                    onClick={() => handleClaimTask(task)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center space-x-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Nhận việc này ngay</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SHIFT HANDOVER */}
      {activeTab === 'handover' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
            <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
              <FileText className="w-5 h-5 text-(--vc-brand-2)" />
              <span>Lập Biên bản Bàn giao ca trực</span>
            </h3>

            {/* Auto linked pending tasks warning */}
            {pendingTasks.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <span className="font-bold flex items-center space-x-1">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Hệ thống tự động phát hiện {pendingTasks.length} việc tồn đọng chưa hoàn thành:</span>
                </span>
                <ul className="list-disc list-inside text-amber-800 space-y-0.5 pl-2">
                  {pendingTasks.map(t => (
                    <li key={t.id}>{t.title} ({t.startTime} - {t.endTime})</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ca trực bàn giao:</label>
                <select
                  value={newShiftName}
                  onChange={(e) => setNewShiftName(e.target.value)}
                  className="w-full p-2.5 border rounded-lg bg-white font-medium"
                >
                  <option value="Ca sáng (05:00 - 13:30)">Ca sáng (05:00 - 13:30)</option>
                  <option value="Ca chiều (13:30 - 22:00)">Ca chiều (13:30 - 22:00)</option>
                  <option value="Ca đêm (22:00 - 05:00)">Ca đêm (22:00 - 05:00)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Ngày bàn giao:</label>
                <input
                  type="date"
                  value={currentDate}
                  disabled
                  className="w-full p-2.5 border rounded-lg bg-slate-100 text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Nội dung bàn giao / Vấn đề tồn đọng / Ghi chú cho ca sau:</label>
              <textarea
                value={newShiftNotes}
                onChange={(e) => setNewShiftNotes(e.target.value)}
                placeholder="Ví dụ: Suất ăn trưa đủ 250 suất, nhà ăn KTX A đã dọn dẹp xong, còn phòng 302 chưa kiểm tra điện..."
                className="w-full p-3 border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-(--vc-brand-2)"
                rows={4}
              ></textarea>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (!newShiftNotes.trim()) {
                    alert('Vui lòng nhập nội dung bàn giao ca.');
                    return;
                  }
                  onCreateHandover({
                    id: `ho-${Date.now()}`,
                    date: currentDate,
                    shift: newShiftName,
                    authorId: currentUser.id,
                    authorName: currentUser.name,
                    notes: newShiftNotes,
                    pendingTasksCount: pendingTasks.length,
                    pendingTaskTitles: pendingTasks.map(t => t.title),
                    status: 'pending',
                    timestamp: `${currentDate} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
                  });
                  setNewShiftNotes('');
                  alert('Đã gửi biên bản bàn giao ca thành công! Ca sau có thể xác nhận tiếp nhận.');
                }}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-xs rounded-xl shadow transition"
              >
                Gửi biên bản bàn giao ca
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-base text-slate-900">Lịch sử Bàn giao các ca trực</h3>
            {handoverList.map(item => (
              <div key={item.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-(--vc-brand-2) px-2.5 py-1 bg-blue-50 rounded-lg">{item.shift}</span>
                    <span className="text-slate-400">• Ngày {formatDateVN(item.date)}</span>
                  </div>
                  <span className="text-slate-500 font-medium">Bởi: {item.authorName} lúc {item.timestamp}</span>
                </div>

                <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg leading-relaxed">{item.notes}</p>

                {item.pendingTaskTitles && item.pendingTaskTitles.length > 0 && (
                  <div className="text-[11px] text-amber-800 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
                    <span className="font-bold">⚠️ Việc tồn đọng ({item.pendingTasksCount}):</span> {item.pendingTaskTitles.join(', ')}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <div>
                    {item.status === 'acknowledged' ? (
                      <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                        <CheckCheck className="w-4 h-4 text-emerald-600" />
                        <span>Đã tiếp nhận bởi: {item.acknowledgedByName} ({item.acknowledgedAt})</span>
                      </span>
                    ) : (
                      <span className="text-amber-700 font-medium">⏳ Đang chờ ca sau xác nhận tiếp nhận</span>
                    )}
                  </div>

                  {item.status === 'pending' && item.authorId !== currentUser.id && (
                    <button
                      onClick={() => onAcknowledgeHandover(item.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition"
                    >
                      Xác nhận tiếp nhận ca này
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TASK ACTION MODAL */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <span className="text-xs font-bold text-(--vc-brand-2) bg-blue-50 px-2 py-0.5 rounded">
                  {selectedTask.startTime} - {selectedTask.endTime}
                </span>
                <h3 className="font-bold text-lg text-slate-900 mt-1">{selectedTask.title}</h3>
              </div>
              <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border space-y-1">
                <p className="font-bold text-slate-700">Yêu cầu chi tiết:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  {selectedTask.requirements.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
              </div>

              {selectedTask.status === 'Chưa làm' && (
                <button
                  onClick={() => handleStartTask(selectedTask)}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl shadow transition flex items-center justify-center space-x-2 text-sm"
                >
                  <Play className="w-4 h-4" />
                  <span>Bắt đầu thực hiện công việc</span>
                </button>
              )}

              {selectedTask.status !== 'Chưa làm' && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Kết quả thực hiện / Báo cáo:</label>
                    <textarea
                      value={resultText}
                      onChange={(e) => setResultText(e.target.value)}
                      placeholder="Nhập kết quả thực tế (vd: Đã kiểm tra đủ 250 suất ăn, chất lượng tốt)..."
                      className="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-(--vc-brand-2)"
                      rows={3}
                    ></textarea>
                  </div>

                  {selectedTask.title.includes('suất ăn') && (
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Số liệu suất ăn (vd: 250 suất):</label>
                      <input
                        type="text"
                        value={metricValue}
                        onChange={(e) => setMetricValue(e.target.value)}
                        placeholder="Nhập số liệu thực tế..."
                        className="w-full p-2.5 border rounded-xl text-xs"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bàn giao / Vấn đề tồn đọng (nếu có):</label>
                    <input
                      type="text"
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      placeholder="Ghi chú cho ca sau..."
                      className="w-full p-2.5 border rounded-xl text-xs"
                    />
                  </div>

                  {/* Photo Proof Upload & Real Camera Capture */}
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Ảnh minh chứng {selectedTask.proofRequired && <span className="text-red-500">* (Bắt buộc)</span>}:
                    </label>

                    <div className="flex flex-wrap gap-2 mb-2">
                      {proofImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={img}
                            alt=""
                            onClick={() => onPreviewImage(img, selectedTask.title)}
                            className="w-20 h-20 rounded-xl object-cover border cursor-pointer group-hover:scale-105 transition"
                          />
                          <button
                            onClick={() => setProofImages(proofImages.filter((_, i) => i !== idx))}
                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Hidden inputs for camera & gallery */}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={cameraInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-3 py-2 bg-(--vc-brand-2) text-white font-semibold rounded-xl flex items-center space-x-1.5 transition text-xs shadow-sm hover:bg-blue-900"
                      >
                        <Camera className="w-4 h-4 text-amber-300" />
                        <span>Chụp ảnh camera</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl border flex items-center space-x-1.5 transition text-xs"
                      >
                        <Upload className="w-4 h-4 text-slate-500" />
                        <span>Tải ảnh thư viện</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSimulatePhotoUpload}
                        className="px-3 py-2 bg-amber-50 text-amber-900 hover:bg-amber-100 font-medium rounded-xl border border-amber-200 flex items-center space-x-1.5 transition text-xs"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Ảnh mẫu nhanh</span>
                      </button>
                    </div>

                    {isUploading && (
                      <p className="text-[11px] text-blue-600 font-medium mt-1 animate-pulse">
                        Đang tối ưu & nén ảnh hiện trường...
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                onClick={() => setSelectedTask(null)}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-xl text-xs"
              >
                Đóng
              </button>
              {selectedTask.status !== 'Chưa làm' && selectedTask.status !== 'Hoàn thành' && (
                <button
                  onClick={() => handleCompleteTask(selectedTask)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition flex items-center space-x-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Hoàn thành & Gửi duyệt</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
