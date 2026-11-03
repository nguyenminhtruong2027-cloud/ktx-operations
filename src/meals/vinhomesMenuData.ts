import { MealVendor, PortionRule, ProhibitedDishRule, DayWeeklyMenu, MealMenuRecord, WeeklyMenuArchive, UploadedMenuFile } from './types';

// DANH SÁCH 7 NHÀ CUNG CẤP SUẤT ĂN CHUẨN TẠI KTX HÓC MÔN
export const INITIAL_MEAL_VENDORS: MealVendor[] = [
  { id: 'tam-phuong', name: 'Tám Phương', code: 'TP', tagline: 'Suất ăn chuẩn & Bán trú', ktx: 'KTX1', td8: 350, td11_1: 180, td11_3: 150, price: 40000, status: 'Hoạt động' },
  { id: 'lim-duong', name: 'Lim Dương', code: 'LD', tagline: 'Có định lượng chi tiết', ktx: 'KTX1', td8: 483, td11_1: 297, td11_3: 177, price: 40000, status: 'Hoạt động' },
  { id: 'minh-long', name: 'Minh Long Food', code: 'ML', tagline: 'Đa dạng món Nam Bộ', ktx: 'KTX1', td8: 632, td11_1: 186, td11_3: 382, price: 40000, status: 'Hoạt động' },
  { id: 'nguyen-sai-gon', name: 'Nguyễn Sài Gòn', code: 'NS', tagline: 'Thực đơn ca đêm & tăng ca', ktx: 'KTX2', td8: 356, td11_1: 416, td11_3: 202, price: 40000, status: 'Hoạt động' },
  { id: 'huong-ngoc-phat', name: 'Hương Ngọc Phát', code: 'HN', tagline: 'Đậm đà hương vị truyền thống', ktx: 'KTX2', td8: 647, td11_1: 362, td11_3: 354, price: 40000, status: 'Hoạt động' },
  { id: 'thien-hong-phuc', name: 'Thiên Hồng Phúc', code: 'TH', tagline: 'Thực đơn xôi & món nóng', ktx: 'KTX2', td8: 272, td11_1: 318, td11_3: 178, price: 40000, status: 'Hoạt động' },
  { id: 'vina-story', name: 'Vina Story', code: 'VS', tagline: 'Cháo dinh dưỡng & cơm kho', ktx: 'KTX1', td8: 559, td11_1: 404, td11_3: 41, price: 40000, status: 'Hoạt động' }
];

// Phân khu KTX mặc định (chỉ là dữ liệu khởi tạo — người dùng tự tích chọn lại trong tab Báo cáo)
export const DEFAULT_KTX_ZONES: Record<'KTX1' | 'KTX2', string[]> = {
  KTX1: ['tam-phuong', 'lim-duong', 'minh-long', 'vina-story'],
  KTX2: ['nguyen-sai-gon', 'huong-ngoc-phat', 'thien-hong-phuc']
};

// 6 BẢNG QUY TẮC ĐỊNH LƯỢNG YÊU CẦU (Khớp 100% Ảnh 1 & 7)
export const INITIAL_PORTION_RULES: PortionRule[] = [
  {
    id: 'main',
    title: 'Định lượng món chính (Dòng 1-2)',
    minVal: 75,
    unit: 'g',
    positionDesc: 'Nếu trong món có 2 thành phần thì cộng lại phải từ 75g trở lên (vd: Thịt gà kho măng thì gà 70-80 gr, măng vàng 25-35gr)',
    badge: '2 dòng đầu trong thực đơn'
  },
  {
    id: 'side',
    title: 'Món phụ (Dòng 3)',
    minVal: 30,
    unit: 'g',
    positionDesc: '30-40g trở lên',
    badge: 'Dòng 3 trong thực đơn'
  },
  {
    id: 'veg',
    title: 'Món rau (Dòng 4)',
    minVal: 70,
    unit: 'g',
    positionDesc: '70-80g trở lên',
    badge: 'Dòng 4 trong thực đơn'
  },
  {
    id: 'soup',
    title: 'Canh (Dòng 5)',
    minVal: 250,
    unit: 'ml',
    positionDesc: '250 ml trở lên',
    badge: 'Dòng 5 trong thực đơn'
  },
  {
    id: 'rice',
    title: 'Cơm trắng (Dòng 6)',
    minVal: 280,
    unit: 'g',
    positionDesc: '280g trở lên',
    badge: 'Dòng 6 trong thực đơn'
  },
  {
    id: 'dessert',
    title: 'Tráng miệng (Dòng 7)',
    minVal: 0,
    unit: 'g',
    positionDesc: 'Trái cây theo mùa',
    badge: 'Dòng 7 trong thực đơn (Trái cây)'
  }
];

// DANH MỤC 23 MÓN ĂN KHÔNG ÁP DỤNG MÙA HÈ (NGUY CƠ ÔI/THIU) - Khớp 100% Ảnh 8
export const PROHIBITED_SUMMER_DISHES: ProhibitedDishRule[] = [
  { id: 1, name: 'Món luộc (thịt luộc, thịt gà/vịt luộc)', note: 'Trừ món rau luộc, củ quả luộc', recommendation: 'Sử dụng các món kho, hầm, om' },
  { id: 2, name: 'Món hấp (cá hấp, thịt hấp)', note: '', recommendation: 'Sử dụng các món kho, hầm, om' },
  { id: 3, name: 'Món chế biến từ Nội tạng động vật', note: '', recommendation: 'Sử dụng thịt nạc thăn, sườn' },
  { id: 4, name: 'Món Chiên/Rán (gà rán/cá rán)', note: 'Trừ món cá nục rán', recommendation: 'Ưu tiên kho mặn ngọt' },
  { id: 5, name: 'Món xào với Hành tây', note: '', recommendation: 'Dễ lên men chua khi thời tiết nóng' },
  { id: 6, name: 'Món xào với Cần tây', note: '', recommendation: 'Dễ biến mùi trong thùng bảo ôn' },
  { id: 7, name: 'Món xào với Nấm', note: '', recommendation: 'Dễ nhiễm khuẩn khi ủ ấm' },
  { id: 8, name: 'Món Dưa muối / Cà muối', note: '', recommendation: 'Không dùng trong môi trường lán trại' },
  { id: 9, name: 'Khoai tây xào thì là', note: '', recommendation: 'Dễ nát và chua' },
  { id: 10, name: 'Thịt xào súp lơ', note: '', recommendation: 'Súp lơ dễ sinh mùi nồng' },
  { id: 11, name: 'Thịt nhồi đậu', note: '', recommendation: 'Nguy cơ ôi thiu lõi nhân' },
  { id: 12, name: 'Thịt nhồi mướp đắng / khổ qua', note: '', recommendation: 'Nguy cơ vi sinh' },
  { id: 13, name: 'Trứng xào cà chua', note: '', recommendation: 'Dễ ôi thiu trong 2h' },
  { id: 14, name: 'Canh bí đỏ', note: '', recommendation: 'Bí đỏ nhanh chua khi để ấm' },
  { id: 15, name: 'Canh giá đỗ chua', note: '', recommendation: 'Dễ lên men' },
  { id: 16, name: 'Canh ngao nấu chua', note: '', recommendation: 'Hải sản dễ ngộ độc mùa hè' },
  { id: 17, name: 'Canh cà chua', note: 'Bổ sung', recommendation: 'Có tính acid dễ chua' },
  { id: 18, name: 'Tất cả các món chế biến có cà chua', note: 'Bổ sung', recommendation: 'Dễ ôi thiu nhanh' },
  { id: 19, name: 'Quả Mận', note: 'Bổ sung', recommendation: 'Dễ gây rối loạn tiêu hóa' },
  { id: 20, name: 'Các món chế biến từ Ếch', note: 'Bổ sung', recommendation: 'Nguy cơ giun sán mùa nóng' },
  { id: 21, name: 'Xúc xích', note: 'Không làm bữa chính', recommendation: 'Chỉ làm bữa phụ nếu kiểm soát nhiệt' },
  { id: 22, name: 'Lạp xưởng', note: 'Không làm bữa chính', recommendation: 'Nhiều mỡ, dễ chảy dầu' },
  { id: 23, name: 'Trứng cút xíu mại', note: '', recommendation: 'Nguy cơ ôi thiu nhân thịt' }
];

// MA TRẬN THỰC ĐƠN TUẦN CHUẨN CỦA TÁM PHƯƠNG (Khớp chính xác Ảnh 5 & 6)
export const TAM_PHUONG_WEEKLY_MENU: DayWeeklyMenu[] = [
  {
    dayOfWeek: 'Thứ 2',
    dateStr: '26/10/2026',
    breakfast: {
      title: 'Bún thịt xào',
      priceNote: 'SÁNG (ĂN NHẸ - 20K)',
      meatDishes: ['Bún thịt xào (Thịt heo 40–45g · Cà rốt, cải 25–30g · Bún 210–230g)'],
      meatDessert: '—',
      vegDishes: ['Bún bì chay (Đậu hũ + bì chay 50–60g · Cà rốt, cải 25–30g · Bún 210–230g · Sữa đậu nành)'],
      vegDessert: '—'
    },
    lunch: {
      title: 'Thịt heo kho củ cải & Cá rô phi rim',
      priceNote: 'TRƯA (CHÍNH - 40K)',
      meatDishes: [
        'Thịt heo kho củ cải (Thịt 45–50g · củ cải 40g)',
        'Cá rô phi chiên rim mắm (70–75g)',
        'Trứng gà luộc (1 quả)',
        'Bầu luộc (70–80g)',
        'Canh rau ngót (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Chuối (90–100g)',
      vegDishes: [
        'Sườn non chiên (100g)',
        'Bắp cải xào củ cải đỏ (100g)',
        'Chả lụa chay rim mặn (30–40g)',
        'Bầu luộc (60–75g)',
        'Canh rau ngót (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Chuối (90–100g)'
    },
    dinner: {
      title: 'Vịt kho chao & Thịt heo xào đậu que',
      priceNote: 'TỐI (TĂNG CA - 40K)',
      meatDishes: [
        'Vịt kho chao (Vịt 55–65g · Khoai môn 25–30g)',
        'Thịt heo xào đậu que (Thịt heo 40–50g · Đậu que 40g)',
        'Đậu phộng rang muối (20–30g)',
        'Bắp cải xào (70–80g)',
        'Canh rau má (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Táo xanh (90–100g)',
      vegDishes: [
        'Đậu hũ khìa sả (100g)',
        'Cà nướng mỡ hành (100g)',
        'Đậu phộng rang muối (20–30g)',
        'Bắp cải xào (60–75g)',
        'Canh rau má (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Táo xanh (90–100g)'
    }
  },
  {
    dayOfWeek: 'Thứ 3',
    dateStr: '27/10/2026',
    breakfast: {
      title: 'Nui xào thịt bằm',
      priceNote: 'SÁNG (ĂN NHẸ - 20K)',
      meatDishes: ['Nui xào thịt bằm (Thịt 40–45g · Cà rốt, cải 25–30g · Nui 210–230g)'],
      meatDessert: '—',
      vegDishes: ['Nui xào chay (Đậu hũ 40–50g · Cà rốt, cải 25–30g · Nui 210–230g · Sữa đậu nành)'],
      vegDessert: '—'
    },
    lunch: {
      title: 'Gà chiên sốt chua ngọt & Cá ngừ kho hành ớt',
      priceNote: 'TRƯA (CHÍNH - 40K)',
      meatDishes: [
        'Gà chiên sốt chua ngọt (Gà 80–90g)',
        'Cá ngừ kho hành ớt (70–75g)',
        'Xúc xích rim mắm tỏi (30–40g)',
        'Khổ qua xào (70–80g)',
        'Canh cải thìa (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Dưa hấu (90–100g)',
      vegDishes: [
        'Lòng heo ram tỏi (100g)',
        'Rau củ luộc + kho quẹt (100g)',
        'Đậu hũ trắng kho sả (30–40g)',
        'Khổ qua xào chay (70–80g)',
        'Canh cải thìa chay (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Dưa hấu (90–100g)'
    },
    dinner: {
      title: 'Thịt heo kho mắm ruốc & Tôm rim rau củ',
      priceNote: 'TỐI (TĂNG CA - 40K)',
      meatDishes: [
        'Thịt heo kho mắm ruốc (70–80g)',
        'Tôm rim rau củ (Tôm 45–55g · Rau củ 30–40g)',
        'Chả lụa kho tiêu (30–40g)',
        'Cà tím xào (70–80g)',
        'Canh rau muống (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Cam sành (1 quả)',
      vegDishes: [
        'Đùi gà kho tiêu (100g)',
        'Bông bí xào tỏi (100g)',
        'Sườn non chiên (30–40g)',
        'Cà tím xào chay (70–80g)',
        'Canh rau muống chay (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Cam sành (1 quả)'
    }
  },
  {
    dayOfWeek: 'Thứ 4',
    dateStr: '28/10/2026',
    breakfast: {
      title: 'Hủ tiếu Nam Vang',
      priceNote: 'SÁNG (ĂN NHẸ - 20K)',
      meatDishes: ['Hủ tiếu thịt bằm trứng cút (Thịt heo 45g · Hủ tiếu 220g)'],
      meatDessert: '—',
      vegDishes: ['Hủ tiếu chay nấm rơm đậu hũ (Đậu 50g · Nấm 30g · Hủ tiếu 220g)'],
      vegDessert: '—'
    },
    lunch: {
      title: 'Ba rọi kho trứng vịt & Cá ba sa chiên giòn',
      priceNote: 'TRƯA (CHÍNH - 40K)',
      meatDishes: [
        'Thịt ba rọi kho trứng (Thịt 60g · Trứng vịt 1 quả)',
        'Cá ba sa chiên giòn sốt mắm (80g)',
        'Đậu que xào cà rốt (70g)',
        'Dưa cải chua xào giá (40g)',
        'Canh súp củ quả thịt bằm (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Thanh long (1 quả)',
      vegDishes: [
        'Nấm rơm kho tiêu xanh (90g)',
        'Đậu hũ non chiên sả (80g)',
        'Đậu que xào nấm (70g)',
        'Dưa cải chua chay (40g)',
        'Canh súp rau củ hạt sen (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Thanh long (1 quả)'
    },
    dinner: {
      title: 'Bò xào củ hành & Chả cá rim cay',
      priceNote: 'TỐI (TĂNG CA - 40K)',
      meatDishes: [
        'Bò xào ớt chuông cần tỏi (Bò 55g · Cần ớt 40g)',
        'Chả cá thu rim cay (60g)',
        'Đậu phộng rang tỏi ớt (30g)',
        'Rau lang luộc chấm mắm kho quẹt (80g)',
        'Canh bí xanh nấu tôm khô (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Mận An Phước (2 quả)',
      vegDishes: [
        'Bò lát chay xào ớt chuông (80g)',
        'Chả cá chay sốt me (60g)',
        'Đậu phộng rang tỏi ớt (30g)',
        'Rau lang luộc chấm chao (80g)',
        'Canh bí xanh chay gừng tươi (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Mận An Phước (2 quả)'
    }
  },
  {
    dayOfWeek: 'Thứ 5',
    dateStr: '29/10/2026',
    breakfast: {
      title: 'Bánh mì ốp la & Xíu mại',
      priceNote: 'SÁNG (ĂN NHẸ - 20K)',
      meatDishes: ['Bánh mì 2 trứng ốp la + patê sốt thịt (Trứng 2 quả · Bánh mì 1 ổ)'],
      meatDessert: '—',
      vegDishes: ['Bánh mì xíu mại chay đậu hũ nấm (Xíu mại 80g · Bánh mì 1 ổ)'],
      vegDessert: '—'
    },
    lunch: {
      title: 'Sườn cốt lết ram & Trứng chiên thịt bằm',
      priceNote: 'TRƯA (CHÍNH - 40K)',
      meatDishes: [
        'Sườn cốt lết ram mật ong (Sườn 90–100g)',
        'Trứng chiên thịt bằm (50g)',
        'Cải thìa xào tỏi (80g)',
        'Tép rim mặn ngọt (30g)',
        'Canh mồng tơi cua đồng (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Ổi hồng xí muội (1 quả)',
      vegDishes: [
        'Sườn non chay ram me (100g)',
        'Trứng chay chiên nấm (50g)',
        'Cải thìa xào dầu hào chay (80g)',
        'Đậu phộng rang mặn (30g)',
        'Canh mồng tơi mướp hương chay (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Ổi hồng xí muội (1 quả)'
    },
    dinner: {
      title: 'Gà kho gừng & Cá lóc kho tộ',
      priceNote: 'TỐI (TĂNG CA - 40K)',
      meatDishes: [
        'Gà ta kho gừng tươi (Gà 80–90g)',
        'Cá lóc đồng kho tiêu tộ (70g)',
        'Mướp hương xào nấm rơm (70g)',
        'Kim chi cải thảo (40g)',
        'Canh cải xanh cá thác lác (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Quýt đường miền Tây (1 quả)',
      vegDishes: [
        'Gà nấm chay kho gừng (90g)',
        'Cá kèo chay kho tiêu (70g)',
        'Mướp hương xào giá đỗ (70g)',
        'Kim chi chay muối chua (40g)',
        'Canh cải xanh đậu hũ non (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Quýt đường miền Tây (1 quả)'
    }
  },
  {
    dayOfWeek: 'Thứ 6',
    dateStr: '30/10/2026',
    breakfast: {
      title: 'Mì xào giòn thịt bò',
      priceNote: 'SÁNG (ĂN NHẸ - 20K)',
      meatDishes: ['Mì xào thịt heo cải ngọt (Thịt 45g · Mì 200g)'],
      meatDessert: '—',
      vegDishes: ['Mì xào rau củ đậu hũ chiên (Đậu 50g · Mì 200g · Sữa bắp)'],
      vegDessert: '—'
    },
    lunch: {
      title: 'Vịt nấu chao khoai môn & Tôm sốt cà chua',
      priceNote: 'TRƯA (CHÍNH - 40K)',
      meatDishes: [
        'Vịt om khoai môn (Vịt 70g · Khoai môn 35g)',
        'Chả giò tôm thịt chiên giòn (3 cuốn 60g)',
        'Su su xào trứng (70g)',
        'Đậu phộng rang muối ớt (30g)',
        'Canh khổ qua nhồi thịt (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Chuối sứ Bến Tre (2 quả)',
      vegDishes: [
        'Đậu hũ om khoai môn (100g)',
        'Chả giò chay chiên giòn (3 cuốn 60g)',
        'Su su xào cà rốt (70g)',
        'Đậu phộng rang muối ớt (30g)',
        'Canh khổ qua chay hầm nấm (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Chuối sứ Bến Tre (2 quả)'
    },
    dinner: {
      title: 'Thịt kho trứng cút & Cá trê nướng mắm gừng',
      priceNote: 'TỐI (TĂNG CA - 40K)',
      meatDishes: [
        'Thịt đùi heo kho trứng cút (Thịt 60g · Trứng cút 4 quả)',
        'Cá trê chiên sốt mắm gừng (80g)',
        'Rau muống xào tỏi (80g)',
        'Củ kiệu tôm khô (30g)',
        'Canh chua cá lóc (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Dưa hấu đỏ (100g)',
      vegDishes: [
        'Sườn dừa kho nấm đông cô (90g)',
        'Cá thu chay chiên sốt gừng (80g)',
        'Rau muống xào tỏi (80g)',
        'Củ kiệu muối chay (30g)',
        'Canh chua chay bạc hà giá đỗ (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Dưa hấu đỏ (100g)'
    }
  },
  {
    dayOfWeek: 'Thứ 7',
    dateStr: '31/10/2026',
    breakfast: {
      title: 'Bánh cuốn chả lụa',
      priceNote: 'SÁNG (ĂN NHẸ - 20K)',
      meatDishes: ['Bánh cuốn nhân thịt bằm mộc nhĩ + Chả lụa (Chả 50g · Bánh cuốn 200g)'],
      meatDessert: '—',
      vegDishes: ['Bánh cuốn chay nhân củ sắn nấm mèo + Chả lụa chay (Chả 50g · Bánh 200g)'],
      vegDessert: '—'
    },
    lunch: {
      title: 'Bò hầm tiêu xanh & Gà luộc lá chanh',
      priceNote: 'TRƯA (CHÍNH - 40K)',
      meatDishes: [
        'Bò hầm tiêu xanh khoai tây (Bò 70g · Khoai 30g)',
        'Gà luộc lá chanh (Gà 80g)',
        'Bắp cải luộc chấm kho quẹt (80g)',
        'Cá cơm rim chua ngọt (30g)',
        'Canh gà lá giang (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Táo xanh Ninh Thuận (1 quả)',
      vegDishes: [
        'Bò chay hầm nấm tiêu xanh (90g)',
        'Gà chay hấp lá chanh (80g)',
        'Bắp cải luộc chấm chao (80g)',
        'Sườn chay rim mặn (30g)',
        'Canh chua lá giang nấm rơm (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Táo xanh Ninh Thuận (1 quả)'
    },
    dinner: {
      title: 'Thịt heo nướng sả mè & Mực rim cay',
      priceNote: 'TỐI (TĂNG CA - 40K)',
      meatDishes: [
        'Thịt nạc heo nướng sả mè (80g)',
        'Mực lá xào chua ngọt (70g)',
        'Đậu ve xào thịt bằm (70g)',
        'Đậu phộng rang muối (25g)',
        'Canh bí đỏ thịt bằm (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Cam sành (1 quả)',
      vegDishes: [
        'Sườn cây chay nướng sả mè (90g)',
        'Mực chay xào chua ngọt (70g)',
        'Đậu ve xào nấm (70g)',
        'Đậu phộng rang muối (25g)',
        'Canh bí đỏ chay nấm (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Cam sành (1 quả)'
    }
  },
  {
    dayOfWeek: 'Chủ nhật',
    dateStr: '01/11/2026',
    breakfast: {
      title: 'Cháo sườn bách thảo',
      priceNote: 'SÁNG (ĂN NHẸ - 20K)',
      meatDishes: ['Cháo sườn heo nóng hổi trứng bách thảo (Sườn 50g · Trứng nửa quả · Cháo 300ml)'],
      meatDessert: '—',
      vegDishes: ['Cháo nấm rơm hạt sen kỷ tử (Nấm 60g · Hạt sen 30g · Cháo 300ml)'],
      vegDessert: '—'
    },
    lunch: {
      title: 'Lẩu cá kèo miền Tây (Bữa cơm Chủ Nhật)',
      priceNote: 'TRƯA (CHÍNH - 40K)',
      meatDishes: [
        'Cá kèo kho rau răm (80g)',
        'Thịt heo luộc chấm mắm tôm chua (70g)',
        'Rau muống chẻ luộc (80g)',
        'Cà pháo mắm tôm (30g)',
        'Canh cua mồng tơi mướp (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Chè hạt sen long nhãn',
      vegDishes: [
        'Cá kèo chay kho rau răm (90g)',
        'Thịt luộc chay chấm tương bần (70g)',
        'Rau muống chẻ luộc (80g)',
        'Cà pháo muối chua chay (30g)',
        'Canh cua chay mồng tơi (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Chè hạt sen long nhãn'
    },
    dinner: {
      title: 'Bữa tối nhẹ nhàng tăng ca',
      priceNote: 'TỐI (TĂNG CA - 40K)',
      meatDishes: [
        'Trứng ốp la sốt cà chua (2 quả)',
        'Chả lụa rim nước mắm tỏi ớt (60g)',
        'Rau cải luộc chấm kho quẹt (80g)',
        'Đậu phộng rang muối (25g)',
        'Canh cải thảo tôm bằm (250ml)',
        'Cơm trắng (280–300g)'
      ],
      meatDessert: 'Bưởi da xanh (2 múi)',
      vegDishes: [
        'Đậu hũ sốt cà chua nấm (100g)',
        'Chả lụa chay rim nước tương (60g)',
        'Rau cải luộc chấm chao (80g)',
        'Đậu phộng rang muối (25g)',
        'Canh cải thảo chay (250ml)',
        'Cơm trắng (280–300g)'
      ],
      vegDessert: 'Bưởi da xanh (2 múi)'
    }
  }
];

export const INITIAL_MENU_RECORDS: MealMenuRecord[] = TAM_PHUONG_WEEKLY_MENU.flatMap(day => [
  {
    vendorId: 'tam-phuong',
    dayOfWeek: day.dayOfWeek,
    dateStr: day.dateStr,
    shift: 'Bữa sáng',
    meatDishes: day.breakfast.meatDishes,
    meatDessert: day.breakfast.meatDessert || '—',
    vegDishes: day.breakfast.vegDishes,
    vegDessert: day.breakfast.vegDessert || '—',
    isWeighedOk: true
  },
  {
    vendorId: 'tam-phuong',
    dayOfWeek: day.dayOfWeek,
    dateStr: day.dateStr,
    shift: 'Bữa trưa',
    meatDishes: day.lunch.meatDishes,
    meatDessert: day.lunch.meatDessert || 'Trái cây',
    vegDishes: day.lunch.vegDishes,
    vegDessert: day.lunch.vegDessert || 'Trái cây',
    isWeighedOk: true
  },
  {
    vendorId: 'tam-phuong',
    dayOfWeek: day.dayOfWeek,
    dateStr: day.dateStr,
    shift: 'Bữa tối',
    meatDishes: day.dinner.meatDishes,
    meatDessert: day.dinner.meatDessert || 'Táo xanh',
    vegDishes: day.dinner.vegDishes,
    vegDessert: day.dinner.vegDessert || 'Táo xanh',
    isWeighedOk: true
  }
]);

// Danh sách các file thực đơn đã tải lên (Lưu trữ và quản lý theo ngày tháng năm)
export const INITIAL_WEEKLY_ARCHIVES: UploadedMenuFile[] = [
  {
    id: 'file-2026-10-26',
    fileName: 'Thuc_don_26_10_den_01_11_2026_TamPhuong.xlsx',
    fileType: 'excel',
    fileSize: '42.5 KB',
    dateRange: '26/10/2026 - 01/11/2026',
    startDate: '26/10/2026',
    endDate: '01/11/2026',
    vendorId: 'tam-phuong',
    vendorName: 'Tám Phương',
    uploadedAt: '26/10/2026 08:15',
    isActive: true,
    menu: TAM_PHUONG_WEEKLY_MENU
  },
  {
    id: 'file-2026-10-19',
    fileName: 'Thuc_don_19_10_den_25_10_2026_TamPhuong.xlsx',
    fileType: 'excel',
    fileSize: '38.2 KB',
    dateRange: '19/10/2026 - 25/10/2026',
    startDate: '19/10/2026',
    endDate: '25/10/2026',
    vendorId: 'tam-phuong',
    vendorName: 'Tám Phương',
    uploadedAt: '19/10/2026 08:30',
    isActive: false,
    menu: [
      {
        dayOfWeek: 'Thứ 2',
        dateStr: '19/10/2026',
        breakfast: {
          title: 'Bún thịt nướng',
          meatDishes: ['Bún thịt xào (Thịt heo 45g · Bún 220g)'],
          vegDishes: ['Bún bì chay']
        },
        lunch: {
          title: 'Thịt heo kho củ cải & Cá nục chiên',
          meatDishes: ['Thịt heo kho củ cải (Thịt 45–50g · củ cải 40g)', 'Cá rô phi chiên rim mắm (70g)', 'Bầu luộc (70g)', 'Canh rau ngót (250ml)'],
          vegDishes: ['Sườn non chiên (100g)', 'Bầu luộc chay']
        },
        dinner: {
          title: 'Vịt kho chao',
          meatDishes: ['Vịt kho chao (Vịt 55–65g · Khoai môn 25–30g)', 'Canh rau má (250ml)'],
          vegDishes: ['Đậu hũ khìa sả (100g)']
        }
      },
      {
        dayOfWeek: 'Thứ 3',
        dateStr: '20/10/2026',
        breakfast: {
          title: 'Nui xào bò',
          meatDishes: ['Nui xào thịt bằm (Thịt 45g)'],
          vegDishes: ['Nui xào chay']
        },
        lunch: {
          title: 'Gà chiên sốt me',
          meatDishes: ['Gà chiên sốt chua ngọt (Gà 80g)', 'Cá ngừ kho hành ớt (70g)', 'Canh cải thìa (250ml)'],
          vegDishes: ['Lòng heo ram tỏi (100g)']
        },
        dinner: {
          title: 'Thịt kho mắm ruốc',
          meatDishes: ['Thịt heo kho mắm ruốc (70g)', 'Tôm rim rau củ (45g)'],
          vegDishes: ['Đùi gà kho tiêu chay']
        }
      }
    ]
  },
  {
    id: 'file-2026-10-12',
    fileName: 'Thuc_don_12_10_den_18_10_2026_TamPhuong.csv',
    fileType: 'csv',
    fileSize: '16.4 KB',
    dateRange: '12/10/2026 - 18/10/2026',
    startDate: '12/10/2026',
    endDate: '18/10/2026',
    vendorId: 'tam-phuong',
    vendorName: 'Tám Phương',
    uploadedAt: '12/10/2026 09:15',
    isActive: false,
    menu: [
      {
        dayOfWeek: 'Thứ 4',
        dateStr: '28/10/2026',
        breakfast: {
          title: 'Hủ tiếu Nam Vang',
          meatDishes: ['Hủ tiếu thịt bằm trứng cút (45g)'],
          vegDishes: ['Hủ tiếu chay']
        },
        lunch: {
          title: 'Thịt ba rọi kho trứng',
          meatDishes: ['Thịt ba rọi kho trứng (Thịt 60g)', 'Cá ba sa chiên giòn (80g)', 'Canh súp củ quả (250ml)'],
          vegDishes: ['Nấm rơm kho tiêu (90g)']
        },
        dinner: {
          title: 'Bò xào củ hành',
          meatDishes: ['Bò xào ớt chuông cần tỏi (55g)', 'Chả cá thu rim (60g)'],
          vegDishes: ['Bò lát chay xào (80g)']
        }
      }
    ]
  },
  {
    id: 'file-2026-10-05',
    fileName: 'Thuc_don_26_10_den_01_11_2026_TamPhuong_Mau.xlsx',
    fileType: 'excel',
    fileSize: '36.8 KB',
    dateRange: '26/10/2026 - 01/11/2026',
    startDate: '26/10/2026',
    endDate: '01/11/2026',
    vendorId: 'tam-phuong',
    vendorName: 'Tám Phương',
    uploadedAt: '26/10/2026 08:00',
    isActive: false,
    menu: [
      {
        dayOfWeek: 'Thứ 2',
        dateStr: '26/10/2026',
        breakfast: {
          title: 'Bún thịt xào',
          meatDishes: ['Bún thịt xào (Thịt heo 45g)'],
          vegDishes: ['Bún bì chay']
        },
        lunch: {
          title: 'Thịt heo kho củ cải',
          meatDishes: ['Thịt heo kho củ cải (Thịt 50g)', 'Trứng gà luộc (1 quả)', 'Canh rau ngót (250ml)'],
          vegDishes: ['Sườn non chiên (100g)']
        },
        dinner: {
          title: 'Vịt kho chao',
          meatDishes: ['Vịt kho chao (Vịt 60g)', 'Canh rau má (250ml)'],
          vegDishes: ['Đậu hũ khìa sả (100g)']
        }
      }
    ]
  }
];

export const INITIAL_UPLOADED_FILES = INITIAL_WEEKLY_ARCHIVES;
