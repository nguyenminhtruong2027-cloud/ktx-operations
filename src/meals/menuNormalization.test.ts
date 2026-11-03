// src/meals/menuNormalization.test.ts
// Unit tests cho các hàm chuẩn hóa thực đơn

import {
  normalizeVietnameseText,
  extractDishPortions,
  isVegetarianDish,
  fuzzyMatchDishName,
  normalizeShiftName,
  validateAndAlignDate,
  detectSupplierFromText
} from './menuNormalization';

export function runNormalizationTests() {
  console.log('--- RUNNING MENU NORMALIZATION TESTS ---');

  // Test 1: Chuẩn hóa tiếng Việt & sửa lỗi OCR
  const rawOcr = '  thit heo kho cu cai  |~`^  dao hu sot nam ';
  const normalized = normalizeVietnameseText(rawOcr);
  if (!normalized.includes('Thịt heo kho cu cai') || !normalized.includes('đậu hũ')) {
    throw new Error(`Test 1 Failed: normalizeVietnameseText produced "${normalized}"`);
  }
  console.log('✓ Test 1: normalizeVietnameseText passed.');

  // Test 2: Tách định lượng với nhiều định dạng
  // Dạng 1: Trong ngoặc kép có g
  const sample1 = 'Vịt kho chao (Vịt 55–65g · Khoai môn 25–30g)';
  const res1 = extractDishPortions(sample1);
  if (res1.cleanName !== 'Vịt kho chao' || res1.portions.length !== 2) {
    throw new Error(`Test 2.1 Failed: extractDishPortions produced name="${res1.cleanName}", portions=${res1.portions.length}`);
  }
  if (res1.portions[0].min !== 55 || res1.portions[0].max !== 65 || res1.portions[0].unit !== 'g') {
    throw new Error(`Test 2.1 Failed on portions[0]: ${JSON.stringify(res1.portions[0])}`);
  }

  // Dạng 2: ml, quả, cái
  const sample2 = 'Canh bí đỏ 250ml kèm Chuối tráng miệng 1 quả';
  const res2 = extractDishPortions(sample2);
  if (res2.portions.length < 2) {
    throw new Error(`Test 2.2 Failed: extractDishPortions portions count < 2`);
  }
  const mlPortion = res2.portions.find(p => p.unit === 'ml');
  const quaPortion = res2.portions.find(p => p.unit === 'qua');
  if (!mlPortion || mlPortion.min !== 250 || !quaPortion || quaPortion.min !== 1) {
    throw new Error(`Test 2.2 Failed portions units or values`);
  }
  console.log('✓ Test 2: extractDishPortions passed.');

  // Test 3: Nhận diện mặn vs chay
  if (!isVegetarianDish('Đậu hũ sốt nấm')) {
    throw new Error('Test 3.1 Failed: Đậu hũ sốt nấm must be vegetarian');
  }
  if (isVegetarianDish('Đậu hũ dồn thịt sốt cà')) {
    throw new Error('Test 3.2 Failed: Đậu hũ dồn thịt should NOT be vegetarian');
  }
  if (!isVegetarianDish('Món nấm xào thập cẩm', 'MÓN CHAY')) {
    throw new Error('Test 3.3 Failed: Context MÓN CHAY must be vegetarian');
  }
  console.log('✓ Test 3: isVegetarianDish passed.');

  // Test 4: So khớp mờ Fuzzy match
  const fuzzy1 = fuzzyMatchDishName('Canh rau ma');
  if (!fuzzy1 || fuzzy1.matchedName !== 'Canh rau má' || fuzzy1.score < 0.8) {
    throw new Error(`Test 4.1 Failed: Fuzzy match "Canh rau ma" -> ${JSON.stringify(fuzzy1)}`);
  }
  console.log('✓ Test 4: fuzzyMatchDishName passed.');

  // Test 5: Ánh xạ ca
  if (normalizeShiftName('Ăn nhẹ buổi sáng') !== 'sang') throw new Error('Test 5.1 Failed');
  if (normalizeShiftName('Bữa chính trưa') !== 'trua') throw new Error('Test 5.2 Failed');
  if (normalizeShiftName('Ca tăng ca đêm') !== 'toi') throw new Error('Test 5.3 Failed');
  console.log('✓ Test 5: normalizeShiftName passed.');

  // Test 6: Kiểm tra ngày và Thứ
  // Tuần bắt đầu 2026-10-26 (Thứ 2)
  // Thứ 4 (dayIndex=2) phải là 2026-10-28 (28/10/2026)
  const dateCheckCorrect = validateAndAlignDate(2, '2026-10-26', '28/10/2026');
  if (!dateCheckCorrect.isValid || dateCheckCorrect.expectedDateStr !== '28/10/2026') {
    throw new Error(`Test 6.1 Failed: Correct date marked invalid`);
  }

  // File ghi nhầm ngày 14/10/2026 cho Thứ 4
  const dateCheckWrong = validateAndAlignDate(2, '2026-10-26', '14/10/2026');
  if (dateCheckWrong.isValid || !dateCheckWrong.warning) {
    throw new Error(`Test 6.2 Failed: Wrong date not caught with warning`);
  }
  console.log('✓ Test 6: validateAndAlignDate passed.');

  // Test 7: Nhận diện Nhà Cung Cấp
  const sup1 = detectSupplierFromText('Thực đơn tuần 44 - NCC Tam Phuong Ban Tru');
  if (!sup1 || sup1.supplierId !== 'tam-phuong') {
    throw new Error(`Test 7.1 Failed: ${JSON.stringify(sup1)}`);
  }
  console.log('✓ Test 7: detectSupplierFromText passed.');

  console.log('✓ ALL MENU NORMALIZATION UNIT TESTS PASSED SUCCESSFULLY!');
}
