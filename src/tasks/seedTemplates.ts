import { TaskTemplate, TaskInstance, ComputedTaskStatus, ShiftType } from './types';

export const SHIFT_META: Record<ShiftType, { label: string; timeRange: string; badgeClass: string }> = {
  sang: {
    label: 'Ca Sáng',
    timeRange: '05:25 – 10:30',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-200 dark:border-amber-700',
  },
  trua: {
    label: 'Ca Trưa',
    timeRange: '10:00 – 14:00',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-700',
  },
  chieu: {
    label: 'Ca Chiều',
    timeRange: '14:00 – 19:00',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-200 dark:border-sky-700',
  },
  toi: {
    label: 'Ca Tối',
    timeRange: '19:30 – 22:00',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/40 dark:text-indigo-200 dark:border-indigo-700',
  },
};

export const DAILY_TASK_TEMPLATES: TaskTemplate[] = [
  // SÁNG
  {
    id: 'tpl-sang-1',
    title: 'Phát loa báo thức 5h30–5h35, chấm công Check in',
    detail: 'Bật hệ thống loa phát thanh KTX đúng 05:30–05:35 để báo thức công nhân; thực hiện chấm công Check in ca sáng.',
    shift: 'sang',
    startTime: '05:25',
    endTime: '05:35',
    frequency: 'daily',
    requirePhoto: false,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },
  {
    id: 'tpl-sang-2',
    title: 'Kiểm soát suất ăn sáng',
    detail: 'Liên hệ lái xe NCC; xe muộn thì đôn đốc NCC, báo tiểu đội trưởng, báo nhóm Vận hành; kiểm đếm so với số đặt (có dự phòng); kiểm tra cảm quan, mùi vị; lưu mẫu; ký giao nhận; phát cho tiểu đội trưởng ký sổ.',
    shift: 'sang',
    startTime: '05:35',
    endTime: '06:30',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
    mealLink: true,
  },
  {
    id: 'tpl-sang-3',
    title: 'Tuần tra nhà ăn, khu rửa và đổ thực phẩm thừa',
    detail: 'Kiểm tra trật tự khu vực nhà ăn, khu rửa khay, phân loại và đổ thực phẩm thừa đúng nơi quy định.',
    shift: 'sang',
    startTime: '06:30',
    endTime: '07:00',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },
  {
    id: 'tpl-sang-4',
    title: 'Đôn đốc công nhân vệ sinh nhà ăn, nhà tắm, khu giặt, NVS',
    detail: 'Kiểm tra, nhắc nhở đội vệ sinh làm sạch sàn nhà ăn, nhà tắm, khu giặt phơi và nhà vệ sinh chung.',
    shift: 'sang',
    startTime: '07:00',
    endTime: '07:40',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },
  {
    id: 'tpl-sang-5',
    title: 'Họp giao ca đầu giờ, giao việc cho CBNV',
    detail: 'Họp nhanh đầu giờ với tổ vận hành, phân công nhiệm vụ cụ thể cho từng CBNV trong ca.',
    shift: 'sang',
    startTime: '07:40',
    endTime: '08:00',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'all',
    group: 'van_hanh',
  },
  {
    id: 'tpl-sang-6',
    title: 'Tổng hợp suất ăn; Tiếp đón tổ đội; Kiểm soát suất ăn mẫu; Kiểm tra vệ sinh phòng ở & nhà ăn',
    detail: 'Tổng hợp số lượng suất ăn; Tiếp đón tổ đội, cấp phòng, vật tư cá nhân; Kiểm soát suất ăn mẫu (đủ hình, định lượng, đúng thực đơn, chưa đạt thì yêu cầu NCC bổ sung); Kiểm tra vệ sinh phòng ở theo tiêu chuẩn KTX mới; Kiểm tra vệ sinh và thiết bị nhà ăn.',
    shift: 'sang',
    startTime: '08:00',
    endTime: '10:30',
    frequency: 'daily',
    requirePhoto: true,
    important: true,
    role: 'staff',
    group: 'van_hanh',
    mealLink: true,
  },

  // TRƯA
  {
    id: 'tpl-trua-1',
    title: 'Kiểm soát suất ăn trưa & phát loa chế độ chính sách (11h15–11h30)',
    detail: 'Liên hệ lái xe NCC, kiểm đếm số lượng, kiểm tra cảm quan, lưu mẫu, ký giao nhận với tiểu đội trưởng; phát loa chế độ chính sách lúc 11:15–11:30.',
    shift: 'trua',
    startTime: '10:00',
    endTime: '12:00',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
    mealLink: true,
  },
  {
    id: 'tpl-trua-2',
    title: 'Tuần tra nhà ăn trưa',
    detail: 'Tuần tra khu vực nhà ăn, khu rửa khay và xử lý thực phẩm thừa sau bữa trưa.',
    shift: 'trua',
    startTime: '12:30',
    endTime: '12:55',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },
  {
    id: 'tpl-trua-3',
    title: 'Phát loa báo thức trưa',
    detail: 'Phát loa báo thức công nhân chuẩn bị vào ca làm việc buổi chiều.',
    shift: 'trua',
    startTime: '13:00',
    endTime: '13:05',
    frequency: 'daily',
    requirePhoto: false,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },
  {
    id: 'tpl-trua-4',
    title: 'Kiểm tra vệ sinh nhà ăn sau giờ trưa',
    detail: 'Kiểm tra bàn ghế, sàn nhà ăn, khu vực bếp chia suất đã được vệ sinh sạch sẽ.',
    shift: 'trua',
    startTime: '13:05',
    endTime: '13:30',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },
  {
    id: 'tpl-trua-5',
    title: 'Họp giao ban đầu giờ chiều, chấm công Check out ca 1 / Check in ca 2',
    detail: 'Bàn giao nhanh tình hình ca sáng sang ca chiều, thực hiện chấm công Check out ca 1 và Check in ca 2.',
    shift: 'trua',
    startTime: '13:30',
    endTime: '14:00',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'all',
    group: 'van_hanh',
  },

  // CHIỀU
  {
    id: 'tpl-chieu-1',
    title: 'Tổng hợp suất ăn, tiếp đón tổ đội, kiểm soát suất ăn mẫu, vệ sinh phòng & khai báo tạm trú',
    detail: 'Tổng hợp suất ăn; tiếp đón tổ đội; kiểm soát suất ăn mẫu (đủ hình, định lượng, đúng thực đơn); kiểm tra vệ sinh phòng ở và nhà ăn; khai báo tạm trú/lưu trú cho công nhân mới.',
    shift: 'chieu',
    startTime: '14:00',
    endTime: '16:30',
    frequency: 'daily',
    requirePhoto: true,
    important: true,
    role: 'staff',
    group: 'van_hanh',
    mealLink: true,
  },
  {
    id: 'tpl-chieu-2',
    title: 'Liên hệ lái xe NCC suất ăn tối',
    detail: 'Gọi điện xác nhận giờ xe giao cơm tối của các NCC, kịp thời báo nếu có sự cố chậm trễ.',
    shift: 'chieu',
    startTime: '16:30',
    endTime: '17:00',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },
  {
    id: 'tpl-chieu-3',
    title: 'Kiểm soát suất ăn tối, giám sát nhà ăn, giải đáp thắc mắc',
    detail: 'Kiểm đếm, lưu mẫu, ký giao nhận suất ăn tối; giám sát nhà ăn, giải đáp thắc mắc công nhân (nếu có tiệc gắn kết thì kiểm soát định lượng và bàn giao).',
    shift: 'chieu',
    startTime: '17:00',
    endTime: '18:30',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
    mealLink: true,
  },
  {
    id: 'tpl-chieu-4',
    title: 'Kiểm tra vệ sinh nhà ăn, yêu cầu bếp dọn dẹp; phát loa Thanh âm công trường (18h00–18h30)',
    detail: 'Phát loa chương trình Thanh âm công trường 18:00–18:30; kiểm tra và yêu cầu bếp dọn dẹp sạch sẽ khu vực nhà ăn sau bữa tối.',
    shift: 'chieu',
    startTime: '18:30',
    endTime: '19:00',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },

  // TỐI
  {
    id: 'tpl-toi-1',
    title: 'Kiểm tra vệ sinh nhà tắm, khu giặt, NVS, khu đổ rác, hành lang, phòng ở & điểm danh công nhân',
    detail: 'Kiểm tra vệ sinh toàn bộ khu vực chung (nhà tắm, khu giặt, NVS, khu đổ rác, hành lang), kiểm tra vệ sinh phòng ở và điểm danh số lượng công nhân theo kế hoạch.',
    shift: 'toi',
    startTime: '19:30',
    endTime: '21:30',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },
  {
    id: 'tpl-toi-2',
    title: 'Tổng hợp số liệu, báo cáo hết ca',
    detail: 'Tổng hợp toàn bộ số liệu suất ăn, quân số, sự cố phát sinh trong ngày và gửi báo cáo hết ca.',
    shift: 'toi',
    startTime: '21:30',
    endTime: '22:00',
    frequency: 'daily',
    requirePhoto: true,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },
  {
    id: 'tpl-toi-3',
    title: 'Chấm công Check out ca 2',
    detail: 'Thực hiện chấm công Check out kết thúc ca 2 lúc 22:00.',
    shift: 'toi',
    startTime: '22:00',
    endTime: '22:15',
    frequency: 'daily',
    requirePhoto: false,
    important: false,
    role: 'staff',
    group: 'van_hanh',
  },
];

export function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function getCurrentMinutes(): number {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

export function computeTaskStatus(
  instance: TaskInstance,
  template: TaskTemplate,
  nowMinutes: number = getCurrentMinutes()
): ComputedTaskStatus {
  if (instance.status === 'done') return 'done';
  const start = parseTimeToMinutes(template.startTime);
  const end = parseTimeToMinutes(template.endTime);
  if (nowMinutes > end) return 'overdue';
  if (nowMinutes >= start && nowMinutes <= end) return 'doing';
  return 'upcoming';
}

export function generateDailyInstancesForDate(
  dateStr: string,
  templates: TaskTemplate[],
  existingInstances: TaskInstance[],
  defaultAssigneeId: string
): TaskInstance[] {
  const existingByTpl = new Set(
    existingInstances.filter((i) => i.date === dateStr).map((i) => i.templateId)
  );
  const created: TaskInstance[] = [];
  for (const tpl of templates) {
    if (tpl.frequency !== 'daily') continue;
    if (existingByTpl.has(tpl.id)) continue;
    created.push({
      id: `inst-${dateStr}-${tpl.id}`,
      templateId: tpl.id,
      date: dateStr,
      assigneeId: defaultAssigneeId,
      status: 'pending',
      photoUrls: [],
      createdBy: 'system',
    });
  }
  return [...existingInstances, ...created];
}
