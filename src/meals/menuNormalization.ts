// src/meals/menuNormalization.ts
// Các hàm thuần (pure functions) chuẩn hóa thực đơn, tách định lượng, so khớp mờ và xác thực ngày tháng

import { formatDMY, formatISODate, getDateOfDayInWeek, parseDateSafe } from './dateUtils';

export interface DishPortion {
  item: string;
  min: number | null;
  max: number | null;
  unit: 'g' | 'ml' | 'qua' | 'cai';
}

export interface ExtractedDishItem {
  raw: string;
  name: string;
  portions: DishPortion[];
  confidence: number;
  isVegetarian?: boolean;
}

export interface DateMatchValidation {
  isValid: boolean;
  expectedDateStr: string;
  actualDateStr?: string;
  warning?: string;
}

// Từ điển món ăn chuẩn (chuẩn hóa tên tiếng Việt có dấu)
export const STANDARD_DISH_DICTIONARY: string[] = [
  'Thịt heo kho củ cải',
  'Thịt kho tàu trứng cút',
  'Thịt heo xào chua ngọt',
  'Thịt ba chỉ luộc',
  'Gà kho sả ớt',
  'Gà chiên nước mắm',
  'Gà hấp lá chanh',
  'Cá nục kho cà chua',
  'Cá lóc kho tộ',
  'Cá basa sốt cà',
  'Cá điêu hồng chiên xù',
  'Trứng cuộn thịt băm',
  'Trứng chiên hành hoa',
  'Trứng ốp la lòng đào',
  'Đậu hũ dồn thịt sốt cà',
  'Đậu hũ chiên sả ớt',
  'Đậu hũ sốt nấm',
  'Bò xào cần tỏi',
  'Bò kho tiêu',
  'Canh chua cá lóc',
  'Canh rau ngót nấu thịt băm',
  'Canh rau ngót',
  'Canh bí đỏ nấu tôm',
  'Canh bí đỏ',
  'Canh rau má nấu thịt băm',
  'Canh rau má',
  'Canh bắp cải cuộn thịt',
  'Canh cải ngọt nấu tôm',
  'Canh khổ qua nhồi thịt',
  'Canh rong biển đậu hũ',
  'Rau muống xào tỏi',
  'Bắp cải xào tỏi',
  'Cải thìa sốt dầu hào',
  'Đậu que xào thịt',
  'Su su xào cà rốt',
  'Trái cây theo mùa',
  'Dưa hấu tráng miệng',
  'Chuối tiêu tráng miệng',
  'Thanh long tráng miệng',
  'Xôi gà xé',
  'Bún chả giò thịt nướng',
  'Phở bò tái nạm',
  'Bánh mì xíu mại',
  'Cháo dinh dưỡng thịt bằm',
  'Cơm tấm sườn bì chả'
];

/**
 * 1. Chuẩn hóa tiếng Việt: Unicode NFC, sửa lỗi OCR phổ biến, loại bỏ ký tự rác, gộp khoảng trắng
 */
export function normalizeVietnameseText(text: string): string {
  if (!text) return '';

  let normalized = text.normalize('NFC').trim();

  // Sửa lỗi OCR thường gặp ở chữ đ/d không dấu trong ngữ cảnh món ăn
  const ocrReplacements: Array<[RegExp, string]> = [
    [/\bdao\s+hu\b/gi, 'đậu hũ'],
    [/\bdau\s+hu\b/gi, 'đậu hũ'],
    [/\btau\s+hu\b/gi, 'tàu hũ'],
    [/\bdau\s+que\b/gi, 'đậu que'],
    [/\bdu\s+du\b/gi, 'đu đủ'],
    [/\bdua\s+hau\b/gi, 'dưa hấu'],
    [/\bthit\s+bo\b/gi, 'thịt bò'],
    [/\bthit\s+heo\b/gi, 'thịt heo'],
    [/\bthit\s+ga\b/gi, 'thịt gà'],
    [/\bca\s+nuc\b/gi, 'cá nục'],
    [/\bca\s+loc\b/gi, 'cá lóc'],
    [/\btrung\s+chien\b/gi, 'trứng chiên'],
    [/\btrung\s+cut\b/gi, 'trứng cút'],
    [/\bcanh\s+chua\b/gi, 'canh chua'],
    [/\brau\s+muong\b/gi, 'rau muống'],
    [/\brau\s+ngot\b/gi, 'rau ngót']
  ];

  for (const [pattern, replacement] of ocrReplacements) {
    normalized = normalized.replace(pattern, replacement);
  }

  // Loại bỏ các ký tự rác OCR như |_~`^
  normalized = normalized.replace(/[|~`^]/g, '');

  // Gộp các khoảng trắng liên tiếp
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Viết hoa chữ cái đầu câu / món ăn
  if (normalized.length > 0) {
    normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  }

  return normalized;
}

/**
 * 2. Tách định lượng:
 * Nhận diện chuỗi định lượng trong ngoặc hoặc kèm theo, ví dụ:
 * "Vịt kho chao (Vịt 55–65g · Khoai môn 25–30g)"
 * "Thịt heo 40–50g · Đậu que 40g"
 * "250ml", "1 quả", "3 cái", "70-80gr"
 */
export function extractDishPortions(input: string): { cleanName: string; portions: DishPortion[] } {
  if (!input) return { cleanName: '', portions: [] };

  const portions: DishPortion[] = [];
  const normalized = normalizeVietnameseText(input);

  // Kiểm tra nếu có ngoặc đơn chứa định lượng, ví dụ: "(Vịt 55–65g · Khoai môn 25–30g)"
  const bracketMatch = normalized.match(/\(([^)]+)\)/);
  const targetText = bracketMatch ? bracketMatch[1] : normalized;

  // Tách targetText thành các cụm nhỏ theo dấu phân tách: · , + ; hoặc xuống dòng hoặc từ "kèm"
  const segments = targetText.split(/[·,+;\n]|\bkèm\b/i);

  // Lưu ý: Không dùng \b sau các từ có dấu tiếng Việt như quả, cái vì \b là ASCII word boundary
  const valueUnitRegex = /(\d+)(?:\s*(?:–|-|—|\.{2,})\s*(\d+))?\s*(g|gr|gram|ml|quả|qua|cái|cai)(?![a-zA-ZÀ-ỹ0-9])/i;

  for (const seg of segments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;

    const m = trimmed.match(valueUnitRegex);
    if (m) {
      const min = parseInt(m[1], 10);
      const max = m[2] ? parseInt(m[2], 10) : min;
      const rawUnit = m[3].toLowerCase();

      let unit: 'g' | 'ml' | 'qua' | 'cai' = 'g';
      if (rawUnit === 'ml') unit = 'ml';
      else if (rawUnit === 'quả' || rawUnit === 'qua') unit = 'qua';
      else if (rawUnit === 'cái' || rawUnit === 'cai') unit = 'cai';
      else unit = 'g';

      // Tên nguyên liệu là phần trước cụm số lượng
      let item = trimmed.slice(0, m.index).trim();
      item = item.replace(/^[·\-\s:,]+|[·\-\s:,]+$/g, '').trim();

      portions.push({
        item: item || 'Thành phần',
        min: isNaN(min) ? null : min,
        max: isNaN(max) ? null : max,
        unit
      });
    }
  }

  // Tên món sạch: nếu có ngoặc, lấy phần ngoài ngoặc; nếu không, loại bỏ các định lượng
  let cleanName = normalized;
  if (bracketMatch) {
    cleanName = cleanName.replace(/\([^)]+\)/g, '').trim();
  } else if (portions.length > 0) {
    cleanName = cleanName.replace(new RegExp(valueUnitRegex.source, 'gi'), '').trim();
  }

  // Dọn dẹp ký tự phân cách còn sót ở tên món
  cleanName = cleanName.replace(/[·\-:,;]+$/, '').replace(/^[·\-:,;]+/, '').trim();
  cleanName = cleanName.replace(/\s+/g, ' ');

  if (!cleanName && portions.length > 0) {
    cleanName = normalized;
  }

  return { cleanName: normalizeVietnameseText(cleanName), portions };
}

/**
 * 3. Tự phát hiện món mặn vs món chay
 */
export function isVegetarianDish(dishName: string, categoryContext?: string): boolean {
  if (!dishName) return false;

  const lowerName = dishName.toLowerCase();
  const lowerCat = (categoryContext || '').toLowerCase();

  // Kiểm tra ngữ cảnh danh mục trước
  if (lowerCat.includes('chay') || lowerCat.includes('món chay') || lowerCat.includes('đồ chay')) {
    return true;
  }

  // Các từ khóa rõ ràng là món chay
  const vegKeywords = [
    'chay',
    'đậu hũ',
    'đậu phụ',
    'tàu hũ',
    'nấm kho',
    'nấm xào',
    'mì căn',
    'sườn non chay',
    'chả lụa chay',
    'bò lát chay',
    'canh rong biển hạt sen',
    'rau củ kho chay'
  ];

  for (const kw of vegKeywords) {
    if (lowerName.startsWith(kw) || lowerName.includes(` ${kw}`)) {
      // Ngoại trừ trường hợp "Đậu hũ dồn thịt" / "Đậu hũ sốt thịt băm"
      if (lowerName.includes('thịt') || lowerName.includes('tôm') || lowerName.includes('cá') || lowerName.includes('trứng cút')) {
        return false;
      }
      return true;
    }
  }

  return false;
}

/**
 * 4. So khớp mờ (Fuzzy matching) tên món ăn với từ điển món chuẩn
 * Sử dụng Levenshtein similarity
 */
export function fuzzyMatchDishName(
  input: string,
  dictionary: string[] = STANDARD_DISH_DICTIONARY,
  threshold: number = 0.65
): { matchedName: string; score: number } | null {
  if (!input) return null;

  const normalizedInput = input.trim().toLowerCase();

  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const item of dictionary) {
    const normalizedItem = item.trim().toLowerCase();

    if (normalizedInput === normalizedItem) {
      return { matchedName: item, score: 1.0 };
    }

    const score = calculateSimilarity(normalizedInput, normalizedItem);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  if (bestScore >= threshold && bestMatch) {
    return { matchedName: bestMatch, score: parseFloat(bestScore.toFixed(2)) };
  }

  return null;
}

// Hàm tính similarity score giữa 2 chuỗi (dựa trên Levenshtein distance)
function calculateSimilarity(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  if (len1 === 0) return len2 === 0 ? 1 : 0;
  if (len2 === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return 1 - distance / maxLen;
}

/**
 * 5. Ánh xạ ca ăn
 */
export type NormalizedShiftKey = 'sang' | 'trua' | 'toi';

export function normalizeShiftName(rawShift: string): NormalizedShiftKey {
  if (!rawShift) return 'trua';

  const lower = rawShift.toLowerCase().trim();

  if (lower.includes('sáng') || lower.includes('sang') || lower.includes('nhẹ') || lower.includes('nhe') || lower.includes('breakfast')) {
    return 'sang';
  }
  if (lower.includes('trưa') || lower.includes('trua') || lower.includes('chính') || lower.includes('chinh') || lower.includes('lunch')) {
    return 'trua';
  }
  if (lower.includes('tối') || lower.includes('toi') || lower.includes('tăng ca') || lower.includes('tang ca') || lower.includes('đêm') || lower.includes('dem') || lower.includes('dinner')) {
    return 'toi';
  }

  return 'trua';
}

/**
 * 6. Xác thực ngày và Thứ trong tuần
 * Nếu file chỉ có Thứ 2..CN thì ngày = weekStartDate + offset.
 * Nếu file có ngày cụ thể thì kiểm tra xem có khớp Thứ hay không;
 * Nếu lệch thì cảnh báo và đề xuất sửa, TUYỆT ĐỐI không lưu ngày sai.
 */
export function validateAndAlignDate(
  dayIndex: number, // 0=Thứ 2, 1=Thứ 3, ... 6=Chủ Nhật
  weekStartDate: string, // YYYY-MM-DD (Thứ 2)
  rawDateStr?: string
): DateMatchValidation {
  const expectedDate = getDateOfDayInWeek(weekStartDate, dayIndex);
  const expectedDateStr = formatDMY(expectedDate);

  if (!rawDateStr || !rawDateStr.trim()) {
    return {
      isValid: true,
      expectedDateStr
    };
  }

  // Parse rawDateStr (hỗ trợ DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
  const parsedActual = parseDateSafe(rawDateStr.trim());
  const actualDateStr = formatDMY(parsedActual);

  if (expectedDateStr === actualDateStr) {
    return {
      isValid: true,
      expectedDateStr,
      actualDateStr
    };
  }

  // Phát hiện lệch ngày
  return {
    isValid: false,
    expectedDateStr,
    actualDateStr,
    warning: `Lệch ngày: File ghi ngày ${actualDateStr} cho Thứ ${dayIndex === 6 ? 'Chủ Nhật' : dayIndex + 2}, nhưng theo ngày đầu tuần ${formatDMY(parseDateSafe(weekStartDate))} ngày chuẩn phải là ${expectedDateStr}.`
  };
}

/**
 * 7. Nhận diện Nhà Cung Cấp từ tên file hoặc nội dung
 */
export function detectSupplierFromText(text: string): { supplierId: string; supplierName: string; confidence: number } | null {
  if (!text) return null;

  const lower = text.toLowerCase();

  const suppliers = [
    { id: 'tam-phuong', name: 'Tám Phương', keywords: ['tam phuong', 'tám phương', 'tp', 'bán trú'] },
    { id: 'lim-duong', name: 'Lim Dương', keywords: ['lim duong', 'lim dương', 'ld'] },
    { id: 'minh-long', name: 'Minh Long Food', keywords: ['minh long', 'ml', 'nam bộ'] },
    { id: 'nguyen-sai-gon', name: 'Nguyễn Sài Gòn', keywords: ['nguyen sai gon', 'nguyễn sài gòn', 'nguyên sài gòn', 'ns'] },
    { id: 'huong-ngoc-phat', name: 'Hương Ngọc Phát', keywords: ['huong ngoc phat', 'hương ngọc phát', 'hn'] },
    { id: 'thien-hong-phuc', name: 'Thiên Hồng Phúc', keywords: ['thien hong phuc', 'thiên hồng phúc', 'th'] },
    { id: 'vina-story', name: 'Vina Story', keywords: ['vina story', 'vinastory', 'vs', 'cháo dinh dưỡng'] }
  ];

  for (const s of suppliers) {
    for (const kw of s.keywords) {
      if (lower.includes(kw)) {
        return {
          supplierId: s.id,
          supplierName: s.name,
          confidence: kw.length > 2 ? 0.95 : 0.8
        };
      }
    }
  }

  return null;
}
