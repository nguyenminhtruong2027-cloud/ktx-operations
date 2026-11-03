import { User, ChecklistTemplate, TaskItem, ShiftHandoverItem, MealRecord, AuditLogItem, ManagerNoteItem, WeeklyRoutineItem } from '../types';

export const INITIAL_USERS: User[] = [
  {
    id: 'u-mgr-1',
    code: 'VC-MGR-01',
    name: 'Nguyễn Văn Quản Lý',
    email: 'truongnhom@vincons.vn',
    phone: '0912.345.678',
    role: 'manager',
    khuVuc: 'Toàn bộ Lán trại & KTX VINCONS',
    currentShift: 'Toàn ca',
    isActive: true,
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
    canAccessTasks: true,
    canAccessMeals: true,
    completedOnTimeRate: 98,
    reworkCount: 0,
    kpiRating: 'A'
  },
  {
    id: 'u-staff-1',
    code: 'VC-STF-01',
    name: 'Trần Văn An',
    email: 'nhanvien1@vincons.vn',
    phone: '0988.112.233',
    role: 'staff',
    khuVuc: 'Khu KTX A & Nhà ăn trung tâm',
    currentShift: 'Ca sáng (05:00 - 13:30)',
    isActive: true,
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
    canAccessTasks: true,
    canAccessMeals: true,
    completedOnTimeRate: 95,
    reworkCount: 1,
    kpiRating: 'A'
  },
  {
    id: 'u-staff-2',
    code: 'VC-STF-02',
    name: 'Lê Thị Bình',
    email: 'nhanvien2@vincons.vn',
    phone: '0977.223.344',
    role: 'staff',
    khuVuc: 'Khu Lán Trại B & Khu giặt phơi',
    currentShift: 'Ca chiều (13:30 - 22:00)',
    isActive: true,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    canAccessTasks: true,
    canAccessMeals: false,
    completedOnTimeRate: 88,
    reworkCount: 2,
    kpiRating: 'B'
  },
  {
    id: 'u-staff-3',
    code: 'VC-STF-03',
    name: 'Phạm Minh Cường',
    email: 'nhanvien3@vincons.vn',
    phone: '0966.334.455',
    role: 'staff',
    khuVuc: 'Khu KTX C & Trạm xử lý nước',
    currentShift: 'Ca đêm (22:00 - 05:00)',
    isActive: true,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    canAccessTasks: false,
    canAccessMeals: true,
    completedOnTimeRate: 92,
    reworkCount: 1,
    kpiRating: 'A'
  }
];

export const INITIAL_TEMPLATES: ChecklistTemplate[] = [
  // --- NHÓM I – HẰNG NGÀY ---
  {
    id: 'tpl-1',
    title: 'Phát loa báo thức buổi sáng & Chấm công IloveVingroup Check in',
    group: 'Hằng ngày',
    startTime: '05:25',
    endTime: '05:35',
    frequency: 'daily',
    requirements: [
      'Chấm công đầy đủ theo quy định hiện hành',
      'Giờ phát loa thay đổi theo giờ làm việc tại dự án (5h30–5h35)'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },
  {
    id: 'tpl-2',
    title: 'Kiểm soát suất ăn sáng',
    group: 'Hằng ngày',
    startTime: '05:35',
    endTime: '06:30',
    frequency: 'daily',
    requirements: [
      'Liên hệ lái xe NCC nắm tình hình, xử lý xe giao muộn (đôn đốc NCC, thông báo Tiểu đội trưởng, báo cáo nhóm Vận hành)',
      'Kiểm đếm nhanh số suất đủ so với đặt hàng (có dự phòng)',
      'Kiểm tra chất lượng cảm quan, mùi vị, suất bất kỳ; lưu mẫu thực phẩm',
      'Nhận bàn giao số lượng từ NCC, ký giao nhận',
      'Phát suất ăn sáng cho Tiểu đội trưởng, ký sổ'
    ],
    proofRequired: true,
    proofType: 'image',
    notes: 'Minh chứng: Ảnh báo cáo nhóm Chất lượng cơm và nhóm Vận hành; Sổ bàn giao suất ăn HC-NCC; Sổ giao nhận hằng ngày',
    isImportant: true,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },
  {
    id: 'tpl-3',
    title: 'Tuần tra vận hành lán trại',
    group: 'Hằng ngày',
    startTime: '06:30',
    endTime: '07:00',
    frequency: 'daily',
    requirements: [
      'Kiểm tra nhà ăn, khu rửa/đổ thực phẩm thừa',
      'Nếu NCC không đạt yêu cầu thì báo Trưởng khu Lán trại xử lý'
    ],
    proofRequired: true,
    proofType: 'image',
    notes: 'Ảnh báo cáo nhóm Vận hành',
    isImportant: false,
    defaultAssigneeId: 'u-staff-2',
    isActive: true
  },
  {
    id: 'tpl-4',
    title: 'Đôn đốc công nhân vệ sinh nhà ăn, nhà tắm, khu giặt, NVS',
    group: 'Hằng ngày',
    startTime: '07:00',
    endTime: '07:40',
    frequency: 'daily',
    requirements: [
      'Yêu cầu công nhân dọn dẹp sạch sẽ các khu vực công cộng'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-2',
    isActive: true
  },
  {
    id: 'tpl-5',
    title: 'Họp giao ca đầu giờ, giao việc cho CBNV',
    group: 'Hằng ngày',
    startTime: '07:40',
    endTime: '08:00',
    frequency: 'daily',
    requirements: [
      'Triển khai công việc đầu giờ, triển khai việc tồn đọng và đề xuất phương hướng',
      'Triển khai phiếu giao việc cho các bộ phận'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-mgr-1',
    isActive: true
  },
  {
    id: 'tpl-6',
    title: 'Tổng hợp suất ăn & Thông báo NCC',
    group: 'Hằng ngày',
    startTime: '08:00',
    endTime: '10:30',
    frequency: 'daily',
    requirements: [
      'Tổng hợp suất ăn thay đổi, thông báo NCC số lượng đặt',
      'Gửi số lượng cho nhóm Báo cơm (Tổ trưởng, Hậu cần) và số điều chỉnh cho NCC'
    ],
    proofRequired: false,
    proofType: 'none',
    isImportant: false,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },
  {
    id: 'tpl-7',
    title: 'Tiếp đón tổ đội, cấp phòng, cấp vật tư cá nhân',
    group: 'Hằng ngày',
    startTime: '08:00',
    endTime: '10:30',
    frequency: 'daily',
    requirements: [
      'Thực hiện nhanh chóng, kịp thời, đúng quy trình cấp phát'
    ],
    proofRequired: false,
    proofType: 'none',
    isImportant: false,
    defaultAssigneeId: 'u-staff-3',
    isActive: true
  },
  {
    id: 'tpl-8',
    title: 'Kiểm soát suất ăn mẫu',
    group: 'Hằng ngày',
    startTime: '08:00',
    endTime: '10:30',
    frequency: 'daily',
    requirements: [
      'Đảm bảo hình thức, định lượng, đúng thực đơn cam kết',
      'Nếu chưa đạt yêu cầu yêu cầu NCC bổ sung thực phẩm ngay lập tức'
    ],
    proofRequired: true,
    proofType: 'image',
    notes: 'VIỆC QUAN TRỌNG - Chú trọng an toàn vệ sinh thực phẩm',
    isImportant: true,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },
  {
    id: 'tpl-9',
    title: 'Kiểm tra vệ sinh phòng ở theo tiêu chuẩn KTX mới',
    group: 'Hằng ngày',
    startTime: '08:00',
    endTime: '10:30',
    frequency: 'daily',
    requirements: [
      'Kiểm tra tình trạng dọn dẹp các phòng ở, thiết bị điện trong phòng',
      'Kiểm tra xem có hộp cơm hoặc suất ăn thừa để lại không'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-2',
    isActive: true
  },
  {
    id: 'tpl-10',
    title: 'Kiểm tra vệ sinh/thiết bị nhà ăn',
    group: 'Hằng ngày',
    startTime: '08:00',
    endTime: '10:30',
    frequency: 'daily',
    requirements: [
      'Kiểm tra tạp vụ đã dọn dẹp sạch sẽ khu rửa/đổ thực phẩm thừa',
      'Thiết bị nhà ăn sẵn sàng phục vụ ca tiếp theo'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-2',
    isActive: true
  },
  {
    id: 'tpl-11',
    title: 'Kiểm soát suất ăn trưa',
    group: 'Hằng ngày',
    startTime: '10:00',
    endTime: '12:00',
    frequency: 'daily',
    requirements: [
      'Liên hệ NCC, xử lý giao muộn, kiểm đếm, kiểm tra chất lượng, ký nhận, lưu mẫu',
      'Báo cáo nhóm Chất lượng cơm và nhóm Vận hành'
    ],
    proofRequired: true,
    proofType: 'image',
    notes: 'Sổ bàn giao, sổ giao nhận suất ăn trưa',
    isImportant: true,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },
  {
    id: 'tpl-12',
    title: 'Phát loa truyền thông chế độ chính sách',
    group: 'Hằng ngày',
    startTime: '11:15',
    endTime: '11:30',
    frequency: 'daily',
    requirements: [
      'Phát nội dung truyền thông theo Phòng đào tạo/Dự án gửi'
    ],
    proofRequired: false,
    proofType: 'none',
    isImportant: false,
    defaultAssigneeId: 'u-staff-3',
    isActive: true
  },
  {
    id: 'tpl-13',
    title: 'Tuần tra vận hành lán trại buổi trưa',
    group: 'Hằng ngày',
    startTime: '12:30',
    endTime: '13:00',
    frequency: 'daily',
    requirements: [
      'Kiểm tra nhà ăn, khu đổ thực phẩm thừa sau giờ ăn trưa'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-2',
    isActive: true
  },
  {
    id: 'tpl-14',
    title: 'Phát loa báo thức buổi trưa',
    group: 'Hằng ngày',
    startTime: '13:00',
    endTime: '13:05',
    frequency: 'daily',
    requirements: [
      'Phát loa nhắc nhở nghỉ trưa (13h00–13h05)'
    ],
    proofRequired: false,
    proofType: 'none',
    isImportant: false,
    defaultAssigneeId: 'u-staff-3',
    isActive: true
  },
  {
    id: 'tpl-15',
    title: 'Kiểm tra vệ sinh nhà ăn đầu giờ chiều',
    group: 'Hằng ngày',
    startTime: '13:05',
    endTime: '13:30',
    frequency: 'daily',
    requirements: [
      'Kiểm tra khu rửa/đổ thực phẩm thừa, yêu cầu tạp vụ dọn dẹp sạch sẽ'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-2',
    isActive: true
  },
  {
    id: 'tpl-16',
    title: 'Họp giao ban đầu giờ chiều & Chấm công Check out ca 1 / Check in',
    group: 'Hằng ngày',
    startTime: '13:30',
    endTime: '14:00',
    frequency: 'daily',
    requirements: [
      'Họp triển khai công việc ca chiều, bàn giao việc tồn đọng',
      'Thực hiện chấm công Check out ca 1 và Check in'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-mgr-1',
    isActive: true
  },
  {
    id: 'tpl-17',
    title: 'Khai báo tạm trú/lưu trú công nhân',
    group: 'Hằng ngày',
    startTime: '14:00',
    endTime: '16:30',
    frequency: 'daily',
    requirements: [
      'Cập nhật khai báo online (nếu có tài khoản) hoặc tổng hợp danh sách gửi công an nếu làm offline theo thống nhất'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: true,
    defaultAssigneeId: 'u-staff-3',
    isActive: true
  },
  {
    id: 'tpl-18',
    title: 'Liên hệ NCC và xử lý xe giao muộn (bữa tối)',
    group: 'Hằng ngày',
    startTime: '16:30',
    endTime: '17:00',
    frequency: 'daily',
    requirements: [
      'Liên hệ lái xe NCC, đôn đốc thời gian giao bữa tối, thông báo Tổ trưởng, báo cáo nhóm Vận hành'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },
  {
    id: 'tpl-19',
    title: 'Kiểm soát suất ăn tối',
    group: 'Hằng ngày',
    startTime: '17:00',
    endTime: '18:30',
    frequency: 'daily',
    requirements: [
      'Kiểm đếm, kiểm tra chất lượng, nhận bàn giao, lưu mẫu',
      'Giám sát nhà ăn, giải đáp thắc mắc, xử lý phát sinh',
      'Nếu có tiệc gắn kết thì tham gia kiểm soát định lượng và bàn giao'
    ],
    proofRequired: true,
    proofType: 'image',
    notes: 'Sổ bàn giao, sổ giao nhận, báo cáo nhóm Vận hành & Chất lượng cơm',
    isImportant: true,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },
  {
    id: 'tpl-20',
    title: 'Phát loa truyền thông Thanh âm công trường',
    group: 'Hằng ngày',
    startTime: '18:00',
    endTime: '18:30',
    frequency: 'daily',
    requirements: [
      'Phát nội dung phát thanh theo Phòng đào tạo/Dự án gửi'
    ],
    proofRequired: false,
    proofType: 'none',
    isImportant: false,
    defaultAssigneeId: 'u-staff-3',
    isActive: true
  },
  {
    id: 'tpl-21',
    title: 'Kiểm tra vệ sinh nhà ăn sau bữa tối',
    group: 'Hằng ngày',
    startTime: '18:30',
    endTime: '19:00',
    frequency: 'daily',
    requirements: [
      'Kiểm tra nhà ăn, khu rửa/đổ thực phẩm, yêu cầu nhân viên bếp dọn dẹp'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-2',
    isActive: true
  },
  {
    id: 'tpl-22',
    title: 'Kiểm tra vệ sinh, nhà ở, cảnh quan môi trường buổi tối',
    group: 'Hằng ngày',
    startTime: '19:30',
    endTime: '21:30',
    frequency: 'daily',
    requirements: [
      'Kiểm tra nhà tắm, khu giặt, NVS, khu đổ rác, hành lang phòng ở',
      'Yêu cầu công nhân dọn dẹp đảm bảo cảnh quan sạch sẽ'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-2',
    isActive: true
  },
  {
    id: 'tpl-23',
    title: 'Kiểm tra vệ sinh phòng ở theo tiêu chuẩn KTX mới (Tối)',
    group: 'Hằng ngày',
    startTime: '19:30',
    endTime: '21:30',
    frequency: 'daily',
    requirements: [
      'Đảm bảo phòng ở ngăn nắp, an toàn điện, không tàng trữ vật dụng trái phép'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-2',
    isActive: true
  },
  {
    id: 'tpl-24',
    title: 'Điểm danh số lượng công nhân theo kế hoạch',
    group: 'Hằng ngày',
    startTime: '19:30',
    endTime: '21:30',
    frequency: 'daily',
    requirements: [
      'Thực hiện điểm danh số lượng công nhân có mặt tại ký túc xá ban đêm'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: true,
    defaultAssigneeId: 'u-staff-3',
    isActive: true
  },
  {
    id: 'tpl-25',
    title: 'Tổng hợp số liệu, báo cáo hết ca',
    group: 'Hằng ngày',
    startTime: '21:30',
    endTime: '22:00',
    frequency: 'daily',
    requirements: [
      'Tổng hợp số liệu suất ăn, tình hình an ninh trật tự, vệ sinh báo cáo quản lý'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },
  {
    id: 'tpl-26',
    title: 'Chấm công IloveVingroup Check out ca 2',
    group: 'Hằng ngày',
    startTime: '22:00',
    endTime: '22:05',
    frequency: 'daily',
    requirements: [
      'Chấm công đầy đủ theo quy định kết thúc ca làm việc'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },

  // --- NHÓM II – HẰNG TUẦN ---
  {
    id: 'tpl-w-1',
    title: 'Báo cáo tuần: tổng hợp ý kiến phản ánh của công nhân',
    group: 'Hằng tuần',
    startTime: '09:00',
    endTime: '17:00',
    frequency: 'weekly',
    daysOfWeek: [6], // Thứ 7
    requirements: [
      'Thu thập, tổng hợp ý kiến phản ánh của công nhân',
      'Gửi email báo cáo tuần cho Ban Quản lý'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: true,
    defaultAssigneeId: 'u-mgr-1',
    isActive: true
  },
  {
    id: 'tpl-w-2',
    title: 'Yêu cầu NCC gửi thực đơn tuần & Thống nhất thực đơn',
    group: 'Hằng tuần',
    startTime: '08:00',
    endTime: '16:00',
    frequency: 'weekly',
    daysOfWeek: [4, 5], // Thứ 5 và Thứ 6
    requirements: [
      'Yêu cầu NCC gửi thực đơn tuần; gửi lại thực đơn thống nhất với NCC',
      'Gửi thực đơn lên nhóm báo cơm (Tổ trưởng) và nhóm suất ăn (NCC)'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: true,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },
  {
    id: 'tpl-w-3',
    title: 'Kiểm tra định kỳ tại cơ sở chế biến của NCC (Tuần 1 & 3)',
    group: 'Hằng tuần',
    startTime: '09:00',
    endTime: '11:30',
    frequency: 'weekly',
    weekOfMonth: [1, 3],
    daysOfWeek: [3], // Thứ 4
    requirements: [
      'Đến cơ sở chế biến của NCC kiểm tra điều kiện an toàn vệ sinh thực phẩm',
      'Gửi email báo cáo kết quả kiểm tra định kỳ'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: true,
    defaultAssigneeId: 'u-mgr-1',
    isActive: true
  },
  {
    id: 'tpl-w-4',
    title: 'Kiểm tra đột xuất tại cơ sở chế biến của NCC (Tuần 2 & 4)',
    group: 'Hằng tuần',
    startTime: '14:00',
    endTime: '16:30',
    frequency: 'weekly',
    weekOfMonth: [2, 4],
    daysOfWeek: [2], // Thứ 3
    requirements: [
      'Kiểm tra đột xuất cơ sở chế biến của NCC, ghi nhận thực tế',
      'Gửi email báo cáo kết quả'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: true,
    defaultAssigneeId: 'u-mgr-1',
    isActive: true
  },
  {
    id: 'tpl-w-5',
    title: 'Kiểm tra số lượng bàn giao suất ăn tuần',
    group: 'Hằng tuần',
    startTime: '15:00',
    endTime: '17:00',
    frequency: 'weekly',
    daysOfWeek: [5], // Thứ 6
    requirements: [
      'Đối chiếu số báo với số ghi nhận thực tế của NCC',
      'Minh chứng: Sổ bàn giao suất ăn và Bảng kê thanh toán'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  },

  // --- NHÓM III – HẰNG THÁNG ---
  {
    id: 'tpl-m-1',
    title: 'Checklist PCCC (Cuối tháng)',
    group: 'Hằng tháng',
    startTime: '08:00',
    endTime: '11:30',
    frequency: 'monthly',
    dayOfMonth: 28, // Gần cuối tháng
    requirements: [
      'Kiểm tra toàn bộ hệ thống PCCC, bình cứu hỏa, lối thoát hiểm tại các khu KTX và lán trại'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: true,
    defaultAssigneeId: 'u-mgr-1',
    isActive: true
  },
  {
    id: 'tpl-m-2',
    title: 'Tham gia đào tạo đầy đủ trên E-learning',
    group: 'Hằng tháng',
    startTime: '13:30',
    endTime: '17:00',
    frequency: 'monthly',
    dayOfMonth: 25,
    requirements: [
      'Hoàn thành các khóa học bắt buộc trên hệ thống E-learning của tập đoàn'
    ],
    proofRequired: true,
    proofType: 'image',
    isImportant: false,
    defaultAssigneeId: 'u-staff-1',
    isActive: true
  }
];

export const getTodayFormatted = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const createInitialTasks = (dateStr: string): TaskItem[] => {
  // Generate task instances for the given date based on templates
  // For daily templates, always generate. For weekly/monthly, check conditions.
  const d = new Date(dateStr);
  const dayOfWeek = d.getDay(); // 0-6
  const dateNum = d.getDate();
  const weekOfMonth = Math.ceil(dateNum / 7);

  const tasks: TaskItem[] = [];
  let counter = 1;

  INITIAL_TEMPLATES.forEach((tpl) => {
    let shouldInclude = false;
    if (tpl.frequency === 'daily') {
      shouldInclude = true;
    } else if (tpl.frequency === 'weekly') {
      const matchDay = tpl.daysOfWeek ? tpl.daysOfWeek.includes(dayOfWeek) : true;
      const matchWeek = tpl.weekOfMonth ? tpl.weekOfMonth.includes(weekOfMonth) : true;
      if (matchDay && matchWeek) shouldInclude = true;
    } else if (tpl.frequency === 'monthly') {
      if (tpl.dayOfMonth && Math.abs(dateNum - tpl.dayOfMonth) <= 1) {
        shouldInclude = true;
      }
    }

    if (shouldInclude) {
      // Create random initial statuses or realistic ones for today
      let status: TaskItem['status'] = 'Chưa làm';
      let resultText = undefined;
      let metricValue = undefined;
      let proofImages: string[] = [];

      // Let's make some morning tasks completed or in progress for realism
      if (tpl.startTime < '08:00') {
        status = 'Hoàn thành';
        resultText = 'Đã hoàn thành đúng quy định, kiểm tra an toàn tốt.';
        if (tpl.title.includes('suất ăn')) {
          metricValue = '250 suất';
        }
        proofImages = ['https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400'];
      } else if (tpl.startTime >= '08:00' && tpl.startTime < '12:00') {
        status = 'Đang làm';
      }

      tasks.push({
        id: `task-${dateStr}-${counter++}`,
        templateId: tpl.id,
        date: dateStr,
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        title: tpl.title,
        group: tpl.group,
        requirements: tpl.requirements,
        assigneeId: tpl.defaultAssigneeId || 'u-staff-1',
        assignerId: 'u-mgr-1',
        status,
        startTimeRecorded: status !== 'Chưa làm' ? `${dateStr} 06:00` : undefined,
        endTimeRecorded: status === 'Hoàn thành' ? `${dateStr} 07:30` : undefined,
        resultText,
        metricValue,
        proofImages,
        proofRequired: tpl.proofRequired,
        isImportant: tpl.isImportant,
        history: [
          {
            id: `hist-${Math.random()}`,
            timestamp: `${dateStr} 05:00`,
            actorName: 'Hệ thống tự động',
            action: 'Sinh phiếu việc tự động từ mẫu checklist',
            details: `Phân công cho nhân viên phụ trách mặc định`
          }
        ]
      });
    }
  });

  return tasks;
};

export const INITIAL_HANDOVERS: ShiftHandoverItem[] = [
  {
    id: 'ho-1',
    date: getTodayFormatted(),
    shift: 'Ca sáng (05:00 - 13:30)',
    authorId: 'u-staff-1',
    authorName: 'Trần Văn An',
    notes: 'Suất ăn sáng và trưa hôm nay giao đúng giờ, đủ 250 suất, chất lượng đảm bảo. Khu KTX A đã dọn dẹp sạch sẽ. Còn 1 phòng chưa kiểm tra do công nhân đi làm ca 3.',
    pendingTasksCount: 2,
    pendingTaskTitles: ['Kiểm tra vệ sinh phòng ở theo tiêu chuẩn KTX mới', 'Khai báo tạm trú/lưu trú công nhân'],
    status: 'acknowledged',
    acknowledgedBy: 'u-staff-2',
    acknowledgedByName: 'Lê Thị Bình (Ca chiều)',
    acknowledgedAt: '13:40',
    timestamp: `${getTodayFormatted()} 13:30`
  }
];

export const INITIAL_MEAL_RECORDS: MealRecord[] = [
  {
    id: 'meal-1',
    date: getTodayFormatted(),
    mealType: 'Sáng',
    orderedCount: 250,
    receivedCount: 250,
    distributedCount: 248,
    diffCount: 0,
    sampleStored: true,
    qualityStatus: 'Đạt chuẩn',
    supplierName: 'Công ty Suất ăn Công nghiệp Hưng Phát',
    inspectedBy: 'Trần Văn An',
    notes: 'Suất ăn giao lúc 05:40, cảm quan cơm và thức ăn nóng sốt, đạt vệ sinh an toàn thực phẩm.'
  },
  {
    id: 'meal-2',
    date: getTodayFormatted(),
    mealType: 'Trưa',
    orderedCount: 310,
    receivedCount: 310,
    distributedCount: 308,
    diffCount: 0,
    sampleStored: true,
    qualityStatus: 'Đạt chuẩn',
    supplierName: 'Công ty Suất ăn Công nghiệp Hưng Phát',
    inspectedBy: 'Trần Văn An',
    notes: 'Thực đơn: Thịt kho trứng, đậu hũ sốt cà chua, canh rau cải thịt băm. Đã lưu mẫu 24h vào tủ lạnh chuyên dụng.'
  },
  {
    id: 'meal-3',
    date: getTodayFormatted(),
    mealType: 'Tối',
    orderedCount: 290,
    receivedCount: 290,
    distributedCount: 290,
    diffCount: 0,
    sampleStored: true,
    qualityStatus: 'Đạt chuẩn',
    supplierName: 'Công ty Suất ăn Công nghiệp Hưng Phát',
    inspectedBy: 'Trần Văn An',
    notes: 'Đang chuẩn bị kiểm đếm và phát cho các tổ đội lúc 17:30.'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLogItem[] = [
  {
    id: 'log-1',
    timestamp: `${getTodayFormatted()} 05:00:12`,
    actorId: 'u-mgr-1',
    actorName: 'Hệ thống tự động',
    action: 'SINH_PHIEU_VIEC',
    target: 'Tất cả mẫu',
    details: 'Đã sinh 28 phiếu việc hằng ngày cho ca trực'
  },
  {
    id: 'log-2',
    timestamp: `${getTodayFormatted()} 06:35:40`,
    actorId: 'u-staff-1',
    actorName: 'Trần Văn An',
    action: 'HOAN_THANH_CONG_VIEC',
    target: 'Kiểm soát suất ăn sáng',
    details: 'Đã kiểm đếm 250 suất, lưu mẫu và chụp ảnh minh chứng'
  },
  {
    id: 'log-3',
    timestamp: `${getTodayFormatted()} 07:45:00`,
    actorId: 'u-mgr-1',
    actorName: 'Nguyễn Văn Quản Lý',
    action: 'DUYET_KET_QUA',
    target: 'Kiểm soát suất ăn sáng',
    details: 'Phê duyệt hoàn thành công việc đạt tiêu chuẩn VINCONS'
  }
];

export const INITIAL_MANAGER_NOTES: ManagerNoteItem[] = [
  {
    id: 'note-1',
    title: 'Họp chấn chỉnh lái xe NCC Hưng Phát về giờ giao cơm',
    content: 'Hôm qua xe giao trưa muộn 10 phút tại lán trại B. Yêu cầu NCC cam kết có mặt trước 10:45 để bộ phận vận hành kiểm đếm và chia suất.',
    status: 'in_progress',
    priority: 'high',
    category: 'ncc',
    dueDate: getTodayFormatted(),
    createdAt: `${getTodayFormatted()} 07:15`
  },
  {
    id: 'note-2',
    title: 'Làm việc với Công an phường lấy dấu xác nhận tạm trú',
    content: 'Đã tổng hợp danh sách 35 công nhân mới đội thi công ép cọc. Cần cử đồng chí Cường mang bản cứng sang công an phường trước 16h30.',
    status: 'todo',
    priority: 'high',
    category: 'personnel',
    dueDate: getTodayFormatted(),
    assignedStaffId: 'u-staff-3',
    createdAt: `${getTodayFormatted()} 08:30`
  },
  {
    id: 'note-3',
    title: 'Kiểm tra áp lực nước sinh hoạt tại bồn chứa tầng mái KTX A',
    content: 'Một số công nhân phản ánh nước tầng 3 giờ cao điểm 18h bị yếu. Đã giao anh An kiểm tra van xả và máy bơm tăng áp số 2.',
    status: 'todo',
    priority: 'medium',
    category: 'incident',
    dueDate: getTodayFormatted(),
    assignedStaffId: 'u-staff-1',
    createdAt: `${getTodayFormatted()} 09:10`
  },
  {
    id: 'note-4',
    title: 'Rà soát bình chữa cháy & tiêu lệnh PCCC tại nhà ăn trung tâm',
    content: 'Kiểm tra hạn kiểm định đồng hồ áp suất, niêm phong kẹp chì bình bột MFZ4 và bình khí CO2.',
    status: 'done',
    priority: 'medium',
    category: 'safety',
    dueDate: getTodayFormatted(),
    createdAt: `${getTodayFormatted()} 06:45`,
    completedAt: `${getTodayFormatted()} 08:15`
  },
  {
    id: 'note-5',
    title: 'Lên danh sách khen thưởng phòng ở kiểu mẫu tháng này',
    content: 'Chọn ra 2 phòng xuất sắc tại KTX A và KTX C thực hiện tốt nếp sống văn minh và tiết kiệm điện.',
    status: 'todo',
    priority: 'low',
    category: 'general',
    createdAt: `${getTodayFormatted()} 10:00`
  }
];

export const INITIAL_WEEKLY_ROUTINES: WeeklyRoutineItem[] = [
  {
    id: 'w-rt-1',
    title: 'Gửi danh sách tạm trú/lưu trú công nhân cho Công an',
    dayOfWeek: 1, // Thứ 2
    timeSlot: '08:30 - 11:30',
    recurrence: 'all',
    requirements: [
      'Tổng hợp danh sách công nhân mới vào lán trại trong tuần',
      'Làm việc trực tiếp với công an sở tại lấy bản cứng có ký đóng dấu xác nhận'
    ],
    isImportant: true,
    isCompleted: true,
    completedAt: 'Thứ 2 10:15',
    completedNotes: 'Đã hoàn tất xác nhận 42 hồ sơ công nhân',
    proofRequired: true
  },
  {
    id: 'w-rt-2',
    title: 'Kiểm tra đột xuất tại cơ sở chế biến của NCC',
    dayOfWeek: 2, // Thứ 3
    timeSlot: '14:00 - 16:30',
    recurrence: 'week_2_4',
    requirements: [
      'Kiểm tra đột xuất kho bảo quản, nguồn gốc thực phẩm đầu vào và quy trình chế biến của NCC',
      'Lập biên bản kiểm tra đột xuất và gửi email báo cáo Ban Lãnh đạo'
    ],
    isImportant: true,
    isCompleted: false,
    proofRequired: true
  },
  {
    id: 'w-rt-3',
    title: 'Kiểm tra định kỳ tại cơ sở chế biến của NCC',
    dayOfWeek: 3, // Thứ 4
    timeSlot: '09:00 - 11:30',
    recurrence: 'week_1_3',
    requirements: [
      'Kiểm tra định kỳ điều kiện vệ sinh nhà xưởng, giấy khám sức khỏe nhân viên bếp của NCC',
      'Gửi email biên bản kiểm tra định kỳ'
    ],
    isImportant: true,
    isCompleted: false,
    proofRequired: true
  },
  {
    id: 'w-rt-4',
    title: 'Yêu cầu NCC gửi thực đơn tuần tới & Thống nhất định lượng',
    dayOfWeek: 4, // Thứ 5
    timeSlot: '08:00 - 16:00',
    recurrence: 'all',
    requirements: [
      'Đôn đốc NCC gửi dự thảo thực đơn 7 ngày tuần kế tiếp',
      'Góp ý điều chỉnh món ăn phù hợp với thời tiết và ý kiến phản ánh của công nhân'
    ],
    isImportant: true,
    isCompleted: true,
    completedAt: 'Thứ 5 14:30',
    completedNotes: 'Đã chốt thực đơn tuần mới, tăng cường món kho và canh chua',
    proofRequired: false
  },
  {
    id: 'w-rt-5',
    title: 'Gửi thực đơn thống nhất lên nhóm Báo cơm & Suất ăn',
    dayOfWeek: 5, // Thứ 6
    timeSlot: '08:30 - 11:00',
    recurrence: 'all',
    requirements: [
      'Gửi thực đơn chính thức lên nhóm Zalo Tổ trưởng và nhóm Hậu cần NCC',
      'Đăng công khai bảng thực đơn tại bảng tin nhà ăn lán trại'
    ],
    isImportant: false,
    isCompleted: true,
    completedAt: 'Thứ 6 10:00',
    proofRequired: false
  },
  {
    id: 'w-rt-6',
    title: 'Kiểm tra số lượng bàn giao suất ăn tuần & Đối chiếu bảng kê',
    dayOfWeek: 5, // Thứ 6
    timeSlot: '15:00 - 17:00',
    recurrence: 'all',
    requirements: [
      'Đối chiếu tổng số suất báo ăn với số lượng thực tế NCC giao trong tuần',
      'Ký xác nhận vào Sổ bàn giao suất ăn và Bảng kê thanh toán tuần'
    ],
    isImportant: true,
    isCompleted: false,
    proofRequired: true
  },
  {
    id: 'w-rt-7',
    title: 'Báo cáo tuần: Tổng hợp ý kiến phản ánh của công nhân',
    dayOfWeek: 6, // Thứ 7
    timeSlot: '09:00 - 17:00',
    recurrence: 'all',
    requirements: [
      'Thu thập phiếu phản ánh và ý kiến các Tiểu đội trưởng',
      'Tổng hợp số liệu vệ sinh, an ninh trật tự, bữa ăn và gửi email báo cáo tuần cho Ban Quản lý'
    ],
    isImportant: true,
    isCompleted: false,
    proofRequired: true
  },
  {
    id: 'w-rt-8',
    title: 'Họp giao ban tuần & Phân công lịch trực ca tuần mới',
    dayOfWeek: 0, // Chủ nhật
    timeSlot: '16:00 - 17:30',
    recurrence: 'all',
    requirements: [
      'Đánh giá hiệu suất tuần của các Chuyên viên vận hành',
      'Phân bổ lịch trực ca 1, ca 2, ca đêm cho tuần tiếp theo'
    ],
    isImportant: false,
    isCompleted: false,
    proofRequired: false
  }
];


