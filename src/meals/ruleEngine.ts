import { PortionRule, EvaluationWarning, DayWeeklyMenu, UploadedMenuFile, WeeklyMenuArchive, DishDuplicateItem } from './types';
import { PROHIBITED_SUMMER_DISHES } from './vinhomesMenuData';

// Helper to normalize dish name for duplicate comparison (removes weights like "(Thịt 45-50g)")
export function normalizeDishName(raw: string): string {
  return raw
    .replace(/\(.*?\)/g, '') // remove parenthetical grammage
    .replace(/[–—\-\.\,\:\;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// 1. Evaluate single weekly menu against portion thresholds & 23 prohibited summer dishes
export function evaluateMenuWeekly(
  weeklyMenu: DayWeeklyMenu[],
  rules: PortionRule[]
): { score: number; warnings: EvaluationWarning[]; totalEvaluatedShifts: number } {
  const warnings: EvaluationWarning[] = [];
  let evaluatedCount = 0;

  const mainRule = rules.find(r => r.id === 'main')?.minVal ?? 75;
  const sideRule = rules.find(r => r.id === 'side')?.minVal ?? 30;
  const vegRule = rules.find(r => r.id === 'veg')?.minVal ?? 70;
  const soupRule = rules.find(r => r.id === 'soup')?.minVal ?? 250;
  const riceRule = rules.find(r => r.id === 'rice')?.minVal ?? 280;

  weeklyMenu.forEach(day => {
    const shifts = [
      { name: 'Bữa sáng', detail: day.breakfast },
      { name: 'Bữa trưa', detail: day.lunch },
      { name: 'Bữa tối', detail: day.dinner }
    ];

    shifts.forEach(s => {
      evaluatedCount++;
      const allDishes = [...s.detail.meatDishes, ...s.detail.vegDishes];
      const shiftTag = `${day.dayOfWeek} — ${s.name}`;

      // 1. Kiểm tra Danh mục 23 món cấm mùa hè (Nguy cơ ôi thiu)
      allDishes.forEach(dish => {
        const lower = dish.toLowerCase();
        const cleanName = dish.split('(')[0].trim();

        // #1. Gà/Vịt/Thịt luộc (trừ rau luộc)
        if (
          (lower.includes('gà luộc') || lower.includes('vịt luộc') || lower.includes('thịt luộc') || lower.includes('thịt heo luộc')) &&
          !lower.includes('rau luộc') && !lower.includes('củ quả luộc')
        ) {
          warnings.push({
            id: `${shiftTag}-prohibit-1-${cleanName}`,
            ruleTag: 'Quy tắc cấm #1',
            ruleName: 'Món luộc mùa hè (thịt luộc, gà/vịt luộc)',
            ruleRequirement: 'Cấm đưa thịt, gà, vịt luộc vào thực đơn mùa nóng vì thời gian ôi thiu rất nhanh (< 2 giờ). Khuyến khích: Chỉ dùng món kho, hầm, om.',
            dishName: cleanName,
            dayShift: shiftTag,
            dayOfWeek: day.dayOfWeek,
            shiftName: s.name,
            message: `Vi phạm danh mục 23 món cấm: Món "${cleanName}" có nguy cơ ôi thiu/ngộ độc cao khi chia khay lán trại.`,
            severity: 'error'
          });
        }

        // #2. Món cá hấp / thịt hấp
        if (lower.includes('cá hấp') || lower.includes('thịt hấp')) {
          warnings.push({
            id: `${shiftTag}-prohibit-2-${cleanName}`,
            ruleTag: 'Quy tắc cấm #2',
            ruleName: 'Món hấp mùa hè (cá hấp, thịt hấp)',
            ruleRequirement: 'Món hấp chứa hàm lượng nước tự do cao, dễ bị chua và ươn khi giữ ấm trong tủ bảo ôn.',
            dishName: cleanName,
            dayShift: shiftTag,
            dayOfWeek: day.dayOfWeek,
            shiftName: s.name,
            message: `Vi phạm món hấp: Món "${cleanName}" dễ biến chất trong môi trường nhiệt độ cao.`,
            severity: 'error'
          });
        }

        // #3. Nội tạng động vật
        if (lower.includes('nội tạng') || lower.includes('lòng lợn') || lower.includes('lòng heo') || lower.includes('gan')) {
          warnings.push({
            id: `${shiftTag}-prohibit-3-${cleanName}`,
            ruleTag: 'Quy tắc cấm #3',
            ruleName: 'Nội tạng động vật',
            ruleRequirement: 'Tuyệt đối không dùng nội tạng động vật cho bữa ăn công nhân theo quy chuẩn ATTP Vincons.',
            dishName: cleanName,
            dayShift: shiftTag,
            dayOfWeek: day.dayOfWeek,
            shiftName: s.name,
            message: `Vi phạm an toàn vệ sinh: "${cleanName}" chế biến từ nội tạng động vật.`,
            severity: 'error'
          });
        }

        // #5 & #6. Xào với hành tây / cần tây
        if (lower.includes('hành tây') || lower.includes('củ hành')) {
          warnings.push({
            id: `${shiftTag}-prohibit-5-${cleanName}`,
            ruleTag: 'Quy tắc cấm #5',
            ruleName: 'Món xào với hành tây',
            ruleRequirement: 'Hành tây trong món xào khi đậy kín trong thùng giữ nhiệt sẽ sinh hơi acid và lên men chua nhanh.',
            dishName: cleanName,
            dayShift: shiftTag,
            dayOfWeek: day.dayOfWeek,
            shiftName: s.name,
            message: `Món xào có hành tây ("${cleanName}") dễ bốc mùi chua nồng khi đến tay công nhân.`,
            severity: 'warning'
          });
        }

        // #7. Xào với nấm
        if (lower.includes('xào nấm') || lower.includes('nấm xào')) {
          warnings.push({
            id: `${shiftTag}-prohibit-7-${cleanName}`,
            ruleTag: 'Quy tắc cấm #7',
            ruleName: 'Món xào với nấm mùa hè',
            ruleRequirement: 'Nấm tươi xào dễ tiết nước nhớt và phát triển vi sinh khi vận chuyển xa.',
            dishName: cleanName,
            dayShift: shiftTag,
            dayOfWeek: day.dayOfWeek,
            shiftName: s.name,
            message: `Cảnh báo: Món "${cleanName}" xào nấm dễ sinh độc tố vi khuẩn khi ủ nhiệt.`,
            severity: 'warning'
          });
        }

        // #14. Canh bí đỏ
        if (lower.includes('bí đỏ')) {
          warnings.push({
            id: `${shiftTag}-prohibit-14-${cleanName}`,
            ruleTag: 'Quy tắc cấm #14',
            ruleName: 'Canh bí đỏ mùa hè',
            ruleRequirement: 'Bí đỏ có lượng đường tự nhiên cao, nước canh bí đỏ sẽ bị thiu và chua chỉ sau 1.5 giờ nấu.',
            dishName: cleanName,
            dayShift: shiftTag,
            dayOfWeek: day.dayOfWeek,
            shiftName: s.name,
            message: `Vi phạm: Canh bí đỏ ("${cleanName}") nhanh chua, không được dùng cho bếp ăn lán trại.`,
            severity: 'error'
          });
        }

        // #17 & #18. Canh cà chua / món có cà chua
        if (lower.includes('canh cà chua') || lower.includes('trứng xào cà chua')) {
          warnings.push({
            id: `${shiftTag}-prohibit-17-${cleanName}`,
            ruleTag: 'Quy tắc cấm #17',
            ruleName: 'Canh cà chua / chế biến cà chua',
            ruleRequirement: 'Cà chua có tính acid mạnh, dễ phân hủy đạm và tạo bọt chua mùa nắng nóng.',
            dishName: cleanName,
            dayShift: shiftTag,
            dayOfWeek: day.dayOfWeek,
            shiftName: s.name,
            message: `Vi phạm: "${cleanName}" nấu cà chua dễ ôi thiu trong 2 giờ giao hàng.`,
            severity: 'error'
          });
        }

        // #21. Xúc xích / Lạp xưởng làm bữa chính
        if ((lower.includes('xúc xích') || lower.includes('lạp xưởng')) && (s.name === 'Bữa trưa' || s.name === 'Bữa tối')) {
          warnings.push({
            id: `${shiftTag}-prohibit-21-${cleanName}`,
            ruleTag: 'Quy tắc cấm #21',
            ruleName: 'Xúc xích / Lạp xưởng làm món chính',
            ruleRequirement: 'Xúc xích, lạp xưởng không được dùng làm món đạm chính trong bữa trưa/tối vì thiếu dinh dưỡng.',
            dishName: cleanName,
            dayShift: shiftTag,
            dayOfWeek: day.dayOfWeek,
            shiftName: s.name,
            message: `Quy chuẩn Vincons: Không dùng xúc xích/lạp xưởng thay thế thịt tươi bữa chính.`,
            severity: 'warning'
          });
        }
      });

      // 2. Kiểm tra Quy chuẩn Định lượng gram / ml
      if (s.detail.meatDishes.length > 0) {
        // Dòng 1: Món chính (>= 75g)
        const dish1 = s.detail.meatDishes[0];
        const gramMatch = dish1.match(/(\d+)[–-](\d+)\s*g|(\d+)\s*g/i);
        const estimatedGram = gramMatch ? Number(gramMatch[2] || gramMatch[1] || gramMatch[3]) : 50;
        if (estimatedGram < mainRule) {
          warnings.push({
            id: `${shiftTag}-gram-main`,
            ruleTag: 'Quy tắc Định lượng',
            ruleName: 'Định lượng món chính (Dòng 1-2)',
            ruleRequirement: `Món chính phải đạt tối thiểu từ ${mainRule}g trở lên (nếu 2 thành phần thì cộng lại phải đạt từ ${mainRule}g).`,
            dishName: dish1.split('(')[0].trim(),
            dayShift: shiftTag,
            dayOfWeek: day.dayOfWeek,
            shiftName: s.name,
            message: `Món chính "${dish1}" định lượng ước tính (${estimatedGram}g) thấp hơn mức quy chuẩn yêu cầu (${mainRule}g).`,
            severity: 'error'
          });
        }

        // Dòng 3: Món phụ (>= 30g)
        if (s.detail.meatDishes.length >= 3) {
          const dish3 = s.detail.meatDishes[2];
          const gramMatch3 = dish3.match(/(\d+)[–-](\d+)\s*g|(\d+)\s*g/i);
          const estimatedGram3 = gramMatch3 ? Number(gramMatch3[2] || gramMatch3[1] || gramMatch3[3]) : 20;
          if (estimatedGram3 < sideRule) {
            warnings.push({
              id: `${shiftTag}-gram-side`,
              ruleTag: 'Quy tắc Định lượng',
              ruleName: 'Món phụ (Dòng 3)',
              ruleRequirement: `Món phụ bổ sung phải đạt tối thiểu từ ${sideRule}g trở lên.`,
              dishName: dish3.split('(')[0].trim(),
              dayShift: shiftTag,
              dayOfWeek: day.dayOfWeek,
              shiftName: s.name,
              message: `Món phụ "${dish3}" định lượng ước tính (${estimatedGram3}g) thấp hơn mức quy chuẩn (${sideRule}g).`,
              severity: 'warning'
            });
          }
        }

        // Dòng 4: Món rau (>= 70g)
        if (s.detail.meatDishes.length >= 4) {
          const dish4 = s.detail.meatDishes[3];
          const gramMatch4 = dish4.match(/(\d+)[–-](\d+)\s*g|(\d+)\s*g/i);
          const estimatedGram4 = gramMatch4 ? Number(gramMatch4[2] || gramMatch4[1] || gramMatch4[3]) : 60;
          if (estimatedGram4 < vegRule) {
            warnings.push({
              id: `${shiftTag}-gram-veg`,
              ruleTag: 'Quy tắc Định lượng',
              ruleName: 'Món rau xanh (Dòng 4)',
              ruleRequirement: `Món rau luộc/xào cung cấp chất xơ phải đạt tối thiểu từ ${vegRule}g trở lên.`,
              dishName: dish4.split('(')[0].trim(),
              dayShift: shiftTag,
              dayOfWeek: day.dayOfWeek,
              shiftName: s.name,
              message: `Món rau "${dish4}" định lượng ước tính (${estimatedGram4}g) thấp hơn mức quy chuẩn (${vegRule}g).`,
              severity: 'warning'
            });
          }
        }
      }
    });
  });

  const penalty = warnings.reduce((sum, w) => sum + (w.severity === 'error' ? 5 : 2), 0);
  const score = Math.max(0, 100 - penalty);

  return {
    score,
    warnings,
    totalEvaluatedShifts: evaluatedCount
  };
}

// 2. Kiểm tra trùng món so với các thực đơn tải lên khác trong hệ thống (Không so sánh với chính file hiện tại)
export function detectDuplicateDishes(
  currentMenu: DayWeeklyMenu[],
  uploadedFiles: UploadedMenuFile[],
  currentFileId?: string
): DishDuplicateItem[] {
  const duplicatesMap = new Map<string, DishDuplicateItem>();

  // Loại trừ chính file hiện tại ra khỏi danh sách đối chiếu so sánh
  const otherFiles = currentFileId
    ? uploadedFiles.filter(f => f.id !== currentFileId)
    : uploadedFiles;

  if (otherFiles.length === 0) {
    return [];
  }

  // Danh sách các món cơ bản hàng ngày không tính là trùng món gây nhàm chán
  const COMMON_STAPLES = new Set([
    'cơm trắng',
    'cơm',
    'cơm nếp',
    'đậu phộng rang muối',
    'đậu phụng rang muối',
    'nước mắm',
    'nước tương',
    'dưa leo',
    'muối tiêu',
    'muối ớt'
  ]);

  currentMenu.forEach(day => {
    const shifts = [
      { name: 'Bữa sáng', detail: day.breakfast },
      { name: 'Bữa trưa', detail: day.lunch },
      { name: 'Bữa tối', detail: day.dinner }
    ];

    shifts.forEach(s => {
      const allCurrentDishes = [...s.detail.meatDishes, ...s.detail.vegDishes];
      allCurrentDishes.forEach(dishStr => {
        const norm = normalizeDishName(dishStr);
        if (!norm || norm.length < 3) return;
        if (COMMON_STAPLES.has(norm)) return;

        // Tìm kiếm trong các file thực đơn đã tải lên khác
        otherFiles.forEach(file => {
          file.menu.forEach(histDay => {
            const histShifts = [
              { name: 'Bữa sáng', detail: histDay.breakfast },
              { name: 'Bữa trưa', detail: histDay.lunch },
              { name: 'Bữa tối', detail: histDay.dinner }
            ];

            histShifts.forEach(hShift => {
              const histDishes = [...hShift.detail.meatDishes, ...hShift.detail.vegDishes];
              const isMatch = histDishes.some(hd => {
                const hNorm = normalizeDishName(hd);
                if (COMMON_STAPLES.has(hNorm)) return false;
                return hNorm === norm || (norm.length >= 6 && hNorm.includes(norm)) || (hNorm.length >= 6 && norm.includes(hNorm));
              });

              if (isMatch) {
                const displayName = dishStr.split('(')[0].trim();
                const key = `${norm}__${day.dayOfWeek}__${s.name}`;
                if (!duplicatesMap.has(key)) {
                  duplicatesMap.set(key, {
                    dishName: displayName,
                    currentDay: day.dayOfWeek,
                    currentShift: s.name,
                    currentDateStr: day.dateStr,
                    occurrences: [],
                    totalCount: 0
                  });
                }
                const entry = duplicatesMap.get(key)!;
                // Tránh ghi nhận lặp lại cho cùng 1 file, ngày và ca
                const alreadyRecorded = entry.occurrences.some(
                  o => o.fileId === file.id && o.dayOfWeek === histDay.dayOfWeek && o.shift === hShift.name
                );
                if (!alreadyRecorded) {
                  entry.occurrences.push({
                    fileId: file.id,
                    fileName: file.fileName,
                    dateRange: file.dateRange,
                    dayOfWeek: histDay.dayOfWeek,
                    shift: hShift.name,
                    dateStr: histDay.dateStr
                  });
                  entry.totalCount = entry.occurrences.length;
                }
              }
            });
          });
        });
      });
    });
  });

  return Array.from(duplicatesMap.values());
}
