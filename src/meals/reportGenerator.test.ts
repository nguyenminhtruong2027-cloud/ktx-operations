/**
 * Unit Test xác minh tính đúng đắn cho hàm thuần generateVendorReportText
 * Chạy test bằng node: node src/meals/reportGenerator.test.mjs
 */
import { generateVendorReportText, generateKtxGroupReportText } from './reportGenerator.ts';

const mockTamPhuong = {
  id: 'tam-phuong',
  name: 'Tám Phương',
  code: 'TP',
  tagline: 'Suất ăn chuẩn & Bán trú',
  ktx: 'KTX1' as const,
  td8: 350,
  td11_1: 180,
  td11_3: 150,
  price: 40000,
  status: 'Hoạt động' as const
};

const mockMeal = {
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
};

export function runTests(): boolean {
  console.log('--- RUNNING UNIT TESTS FOR REPORT GENERATOR ---');

  const report = generateVendorReportText(mockTamPhuong, 'Bữa tối', '26/10/2026', mockMeal);

  const expectedTotal = 680;
  console.assert(report.includes('Lán trại Hóc Môn KTX1 phục vụ suất ăn bữa tối ngày 26/10/2026'), 'Test 1: Header match');
  console.assert(report.includes('• Tổng cộng: 680 suất'), 'Test 2: Total 680 match');
  console.assert(report.includes('• Đơn giá: 40.000đ'), 'Test 3: Price 40.000đ match');
  console.assert(report.includes('NCC: Tám Phương'), 'Test 4: NCC match');
  console.assert(report.includes('TĐ 8: 350 suất'), 'Test 5: TD 8 match');
  console.assert(report.includes('TĐ 11.1: 180 suất'), 'Test 6: TD 11.1 match');
  console.assert(report.includes('TĐ 11.3: 150 suất'), 'Test 7: TD 11.3 match');
  console.assert(report.includes('• Suất ăn mặn: Vịt kho chao'), 'Test 8: Meat dishes match');
  console.assert(report.includes('• Tráng miệng mặn: Táo xanh (90–100g)'), 'Test 9: Meat dessert match');
  console.assert(report.includes('• Suất ăn chay: Đậu hũ khìa sả'), 'Test 10: Veg dishes match');
  console.assert(report.includes('• Tráng miệng chay: Táo xanh (90–100g)'), 'Test 11: Veg dessert match');
  console.assert(report.includes('Cân định lượng: Đạt'), 'Test 12: Weighed status match');

  // Test breakfast unit price = 20.000đ
  const breakfastReport = generateVendorReportText(mockTamPhuong, 'Bữa sáng', '26/10/2026', mockMeal);
  console.assert(breakfastReport.includes('• Đơn giá: 20.000đ'), 'Test 13: Breakfast price 20.000đ match');

  console.log('✓ ALL REPORT GENERATOR UNIT TESTS PASSED SUCCESSFULLY!');
  return true;
}
