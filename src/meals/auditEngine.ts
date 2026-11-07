import {
  AuditResult,
  AuditWarning,
  CustomProhibitedRule,
  DayMenu,
  DishRow,
  GroupScore,
  QuantitativeThresholds,
  RuleGroup,
  Severity,
  WeeklyMenu
} from './types';
import {
  COUNTING_UNITS,
  DESSERT_FORBIDDEN_KEYWORDS,
  FRUIT_KEYWORDS,
  ORGAN_MEAT_KEYWORDS,
  PREPROCESSED_KEYWORDS,
  PROHIBITED_SUMMER_RULES,
  QUANTITATIVE_THRESHOLDS
} from './ruleConfig';
import { normNFC } from './excelParser';

export type DishRole = 'chinh' | 'phu' | 'rau' | 'canh' | 'com' | 'trang_mieng';

export type ProteinType =
  | 'ga'
  | 'vit'
  | 'bo'
  | 'heo'
  | 'tom'
  | 'muc'
  | 'ca'
  | 'luon'
  | 'oc'
  | 'trung'
  | 'dauhu';

export type CookingMethod =
  | 'chiên'
  | 'kho'
  | 'xào'
  | 'rim'
  | 'nấu'
  | 'luộc'
  | 'hấp'
  | 'nướng'
  | 'khác';

export interface DishAnalysis {
  role: DishRole;
  proteins: ProteinType[];
  fishName: string | null;
  cookingMethod: CookingMethod;
  preprocessed: {
    found: string[];
    isMainIngredient: boolean;
  };
  weight: {
    min: number;
    max: number;
    hasWeight: boolean;
    onlyCountingUnit: boolean;
    calculation: string;
  };
}

function hasWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escaped}(?:$|[^\\p{L}\\p{N}])`, 'iu');
  return re.test(text);
}

function hasAnyWord(text: string, words: string[]): string | null {
  for (const w of words) {
    if (hasWord(text, w)) return w;
  }
  return null;
}

export function determineDishRole(dishName: string, rowIndex: number): DishRole {
  const s = normNFC(dishName).toLowerCase();
  if (/^cơm\b/.test(s)) return 'com';
  if (/^canh\b/.test(s)) return 'canh';
  if (
    hasAnyWord(s, DESSERT_FORBIDDEN_KEYWORDS) ||
    hasAnyWord(s, FRUIT_KEYWORDS)
  ) {
    return 'trang_mieng';
  }
  if (rowIndex === 0 || rowIndex === 1) return 'chinh';
  if (rowIndex === 2) return 'phu';
  if (rowIndex === 3) return 'rau';
  if (rowIndex === 4) return 'canh';
  if (rowIndex === 5) return 'com';
  return 'trang_mieng';
}

export function parseWeightString(tlRaw: string): DishAnalysis['weight'] {
  const s = normNFC(tlRaw).toLowerCase();
  if (!s) {
    return { min: 0, max: 0, hasWeight: false, onlyCountingUnit: false, calculation: 'Không có định lượng' };
  }

  // Remove counting unit numbers first, e.g., "1 quả", "2 viên", "3 cuộn"
  const countingPattern = new RegExp(
    `\\d+(?:[.,]\\d+)?(?:\\s*[-~–]\\s*\\d+(?:[.,]\\d+)?)?\\s*(?:${COUNTING_UNITS.join('|')})(?:$|[^\\p{L}])`,
    'giu'
  );
  const hadCounting = countingPattern.test(s);
  const cleaned = s.replace(countingPattern, ' ');

  // Match number ranges or single numbers: "45 -50 gr", "70-80", "75~80", "40 gr", "250ml"
  const numRegex = /(\d+(?:[.,]\d+)?)(?:\s*[-~–]\s*(\d+(?:[.,]\d+)?))?\s*(gr|gram|g|ml)?/gi;
  let totalMin = 0;
  let totalMax = 0;
  let count = 0;
  const parts: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = numRegex.exec(cleaned)) !== null) {
    const n1 = parseFloat(match[1].replace(',', '.'));
    const n2 = match[2] ? parseFloat(match[2].replace(',', '.')) : n1;
    if (!isNaN(n1) && !isNaN(n2) && n1 > 0) {
      totalMin += Math.min(n1, n2);
      totalMax += Math.max(n1, n2);
      count++;
      parts.push(n1 === n2 ? `${n1}` : `${n1}–${n2}`);
    }
  }

  if (count === 0) {
    return {
      min: 0,
      max: 0,
      hasWeight: false,
      onlyCountingUnit: hadCounting,
      calculation: hadCounting ? 'Chỉ có đơn vị đếm (không có gram)' : 'Không đọc được số gram/ml'
    };
  }

  const unit = s.includes('ml') ? 'ml' : 'g';
  const sumStr = totalMin === totalMax ? `${totalMin}${unit}` : `${totalMin}–${totalMax}${unit}`;
  const calc = parts.length > 1 ? `${parts.join(' + ')} = ${sumStr}` : sumStr;

  return {
    min: totalMin,
    max: totalMax,
    hasWeight: true,
    onlyCountingUnit: false,
    calculation: calc
  };
}

export function extractProteins(dishName: string): { proteins: ProteinType[]; fishName: string | null } {
  let s = normNFC(dishName).toLowerCase();
  const proteins = new Set<ProteinType>();
  let fishName: string | null = null;

  // 1. Handle traps first!
  // "trứng gà", "trứng vịt", "trứng cút" -> trứng, NOT gà/vịt
  if (/trứng\s*(gà|vịt|cút)?/i.test(s)) {
    proteins.add('trung');
    s = s.replace(/trứng\s*(gà|vịt|cút)?/gi, ' ');
  }

  // "bơ" (sốt bơ tỏi) -> NOT bò
  s = s.replace(/\bbơ\b/gi, ' ');

  // "mắm ruốc", "sốc mắm" -> NOT ốc
  s = s.replace(/mắm\s*ruốc|sốc\s*mắm/gi, ' ');

  // "cốt lết", "cotlet", "cốt lếch" -> heo, NOT ếch
  if (/cốt\s*lết|cotlet|cốt\s*lếch/i.test(s)) {
    proteins.add('heo');
    s = s.replace(/cốt\s*lết|cotlet|cốt\s*lếch/gi, ' ');
  }

  // Remove pre-processed fish/meat names before checking raw fish/meat
  // e.g. "chả cá", "cá viên" do NOT count as "cá" for R5
  const sWithoutPreprocessed = s.replace(/chả\s*cá|cá\s*viên|bò\s*viên|chả\s*lụa|giò\s*lụa/gi, ' ');

  // 2. Check proteins with word boundaries
  if (hasAnyWord(sWithoutPreprocessed, ['gà', 'đùi gà', 'cánh gà', 'ức gà', 'má đùi'])) {
    proteins.add('ga');
  }
  if (hasAnyWord(sWithoutPreprocessed, ['vịt', 'đùi vịt', 'cánh vịt'])) {
    proteins.add('vit');
  }
  if (hasAnyWord(sWithoutPreprocessed, ['bò', 'thịt bò', 'bắp bò', 'nạm bò', 'gân bò'])) {
    proteins.add('bo');
  }
  if (
    hasAnyWord(sWithoutPreprocessed, [
      'heo', 'thịt heo', 'thịt', 'sườn', 'ba rọi', 'bắp giò', 'giò heo',
      'xá xíu', 'mộc', 'chạo', 'thịt bằm', 'thịt xay', 'nạc dăm', 'cốt lết'
    ])
  ) {
    proteins.add('heo');
  }
  if (hasAnyWord(sWithoutPreprocessed, ['tôm', 'tép'])) {
    proteins.add('tom');
  }
  if (hasAnyWord(sWithoutPreprocessed, ['mực', 'bạch tuộc'])) {
    proteins.add('muc');
  }
  if (hasAnyWord(sWithoutPreprocessed, ['lươn'])) {
    proteins.add('luon');
  }
  if (hasAnyWord(sWithoutPreprocessed, ['ốc', 'nghêu', 'ngao', 'sò', 'hến'])) {
    proteins.add('oc');
  }
  if (hasAnyWord(sWithoutPreprocessed, ['đậu hũ', 'đậu hủ', 'đậu phụ', 'tàu hũ', 'tàu hủ'])) {
    proteins.add('dauhu');
  }

  // Fish detection
  const fishMatch = sWithoutPreprocessed.match(
    /(?:khô\s+)?cá\s+[\p{L}]+(?:\s+[\p{L}]+)?|\bbạc\s*má\b|\bkhô\s+lưỡi\s+mèo\b/iu
  );
  if (fishMatch || hasWord(sWithoutPreprocessed, 'cá')) {
    proteins.add('ca');
    fishName = fishMatch ? fishMatch[0].trim() : 'cá';
  }

  return { proteins: Array.from(proteins), fishName };
}

export function extractCookingMethod(dishName: string): CookingMethod {
  const s = normNFC(dishName).toLowerCase();
  // Priority: chiên > kho > xào > rim > nấu > luộc > hấp > nướng
  if (hasAnyWord(s, ['chiên', 'rán', 'áp chảo', 'rôti', 'rô ti'])) return 'chiên';
  if (hasAnyWord(s, ['kho'])) return 'kho';
  if (hasAnyWord(s, ['xào'])) return 'xào';
  if (hasAnyWord(s, ['rim', 'ram', 'rang'])) return 'rim';
  if (hasAnyWord(s, ['hầm', 'lagu', 'om', 'cari', 'cà ri', 'nấu'])) return 'nấu';
  if (hasAnyWord(s, ['luộc'])) return 'luộc';
  if (hasAnyWord(s, ['hấp', 'chưng'])) return 'hấp';
  if (hasAnyWord(s, ['nướng'])) return 'nướng';
  return 'khác';
}

export function analyzePreprocessed(dishName: string, proteins: ProteinType[]): DishAnalysis['preprocessed'] {
  const s = normNFC(dishName).toLowerCase();
  const found: string[] = [];
  for (const kw of PREPROCESSED_KEYWORDS) {
    if (hasWord(s, kw)) {
      found.push(kw);
    }
  }
  if (found.length === 0) {
    return { found: [], isMainIngredient: false };
  }

  // If dish starts with preprocessed keyword (e.g. "Chả cá rim trứng cút", "Giò lụa heo rim mặn")
  // or has no other primary meat/fish/shrimp protein, it's the main ingredient
  const startsWithPre = found.some(kw => s.startsWith(kw));
  const hasOtherPrimaryProtein = proteins.some(p =>
    ['ga', 'vit', 'bo', 'heo', 'tom', 'muc', 'ca', 'luon'].includes(p)
  );

  const isMainIngredient = startsWithPre || !hasOtherPrimaryProtein;
  return { found, isMainIngredient };
}

export function analyzeDish(row: DishRow, rowIndex: number): DishAnalysis {
  const role = determineDishRole(row.ten, rowIndex);
  const { proteins, fishName } = extractProteins(row.ten);
  const cookingMethod = extractCookingMethod(row.ten);
  const preprocessed = analyzePreprocessed(row.ten, proteins);
  const weight = parseWeightString(row.tl);
  return { role, proteins, fishName, cookingMethod, preprocessed, weight };
}

export function normalizeDishNameForDup(name: string): string {
  return normNFC(name)
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\bram\b/g, 'rim')
    .replace(/\s+/g, ' ')
    .trim();
}

export function dishSimilarity(a: string, b: string): number {
  const na = normalizeDishNameForDup(a);
  const nb = normalizeDishNameForDup(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Check if one is contained in the other (e.g. "cotlet rim" in "cotlet heo rim")
  if (na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na))) {
    return 0.9;
  }
  // Token Jaccard + Dice similarity
  const tokensA = new Set(na.split(' '));
  const tokensB = new Set(nb.split(' '));
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  return (2 * intersection) / (tokensA.size + tokensB.size);
}

export function auditWeeklyMenu(
  menu: WeeklyMenu,
  severityOverrides: Record<string, Severity> = {},
  historyMenus: WeeklyMenu[] = [],
  customThresholds?: QuantitativeThresholds,
  customRules: CustomProhibitedRule[] = []
): AuditResult {
  const thresholds = customThresholds || QUANTITATIVE_THRESHOLDS;
  const warnings: AuditWarning[] = [];
  const passedItems: string[] = [];
  const isChay = menu.loai === 'chay';

  const getRuleSev = (code: string, def: Severity): Severity => {
    if (isChay) return 'REVIEW';
    return severityOverrides[code] || def;
  };

  const addWarning = (w: Omit<AuditWarning, 'id'>) => {
    warnings.push({
      ...w,
      id: `w-${warnings.length + 1}-${Math.random().toString(36).slice(2, 6)}`
    });
  };

  // Check if canh & rau are swapped across the file
  let swappedCanhRauCount = 0;
  for (const day of menu.ngay) {
    for (const shiftRows of [day.trua, day.toi]) {
      if (shiftRows[3] && shiftRows[4]) {
        const r4 = determineDishRole(shiftRows[3].ten, 3);
        const r5 = determineDishRole(shiftRows[4].ten, 4);
        if (r4 === 'canh' && r5 === 'rau') {
          swappedCanhRauCount++;
        }
      }
    }
  }
  if (swappedCanhRauCount > 0) {
    addWarning({
      ruleCode: 'DL-00',
      group: 'dinh_luong',
      severity: 'REVIEW',
      day: 'Cả tuần',
      shift: 'Trưa / Tối',
      rowLabel: 'r4 & r5',
      dishName: 'Thứ tự dòng Canh và Rau',
      weightRaw: '',
      calculation: `Phát hiện ${swappedCanhRauCount} bữa xếp Canh ở dòng 4, Rau ở dòng 5`,
      clause: 'Quy ước dòng: r4 = rau, r5 = canh',
      suggestion: 'Đổi vị trí dòng 4 (Rau) và dòng 5 (Canh) cho đúng chuẩn.'
    });
  }

  // Trackers for weekly rules
  let chickenMeals = 0;
  let chickenWithBreakfast = 0;
  let duckMeals = 0;
  let breadBreakfasts = 0;
  let prevBreadDayIdx = -2;
  let prevFishName: string | null = null;
  let underweightMainCount = 0;
  const proteinMealCounts: Record<string, number> = {};
  const motifCounts: Record<string, number> = {};

  // Trackers for duplicate dishes
  const allMainDishes: { dayIdx: number; dayLabel: string; shift: string; name: string }[] = [];
  const allSideDishes: { dayIdx: number; dayLabel: string; shift: string; role: DishRole; name: string }[] = [];

  menu.ngay.forEach((day: DayMenu, dayIdx: number) => {
    const dayLabel = `${day.ma} (${day.ngayThang.slice(0, 5)})`;

    // --- 1. BREAKFAST CHECKS ---
    const sangMon = normNFC(day.sang.mon);
    const sangFull = normNFC(`${day.sang.mon} ${day.sang.thanhPhan}`);
    if (sangMon) {
      const sangLower = sangFull.toLowerCase();
      if (/\bbánh\s*mì\b/.test(sangLower)) {
        breadBreakfasts++;
        if (/ướt|đóng\s*túi/.test(sangLower)) {
          addWarning({
            ruleCode: 'R10',
            group: 'che_bien',
            severity: isChay ? 'REVIEW' : 'HIGH',
            day: dayLabel,
            shift: 'Sáng',
            rowLabel: 'Bữa sáng',
            dishName: sangMon,
            weightRaw: day.sang.thanhPhan,
            calculation: 'Bánh mì ướt / đóng túi',
            clause: 'R10: Không dùng bánh mì ướt đóng túi',
            suggestion: 'Đổi sang bánh mì tươi hoặc món nước (bún, phở, hủ tiếu).'
          });
        }
        if (dayIdx - prevBreadDayIdx === 1) {
          addWarning({
            ruleCode: 'R10',
            group: 'che_bien',
            severity: isChay ? 'REVIEW' : 'HIGH',
            day: dayLabel,
            shift: 'Sáng',
            rowLabel: 'Bữa sáng',
            dishName: sangMon,
            weightRaw: day.sang.thanhPhan,
            calculation: '2 ngày liền nhau ăn bánh mì',
            clause: 'R10: Bánh mì bữa sáng không ở 2 ngày liền nhau',
            suggestion: 'Xen kẽ món nước vào giữa 2 ngày.'
          });
        }
        prevBreadDayIdx = dayIdx;
      }

      const sangProteins = extractProteins(sangFull).proteins;
      if (sangProteins.includes('ga')) chickenWithBreakfast++;

      const sangPre = analyzePreprocessed(sangFull, sangProteins);
      if (sangPre.found.length > 0 && !isChay) {
        addWarning({
          ruleCode: 'R6',
          group: 'che_bien',
          severity: 'REVIEW',
          day: dayLabel,
          shift: 'Sáng',
          rowLabel: 'Bữa sáng',
          dishName: sangMon,
          weightRaw: day.sang.thanhPhan,
          calculation: `Có ${sangPre.found.join(', ')}`,
          clause: 'R6: Chế biến sẵn ở bữa sáng (REVIEW)',
          suggestion: 'Hạn chế đồ chế biến sẵn vào bữa sáng.'
        });
      }

      allMainDishes.push({ dayIdx, dayLabel, shift: 'Sáng', name: sangMon });
    }

    // --- 2. LUNCH & DINNER CHECKS ---
    let dayFishMeals = 0;
    const dayDishNames: string[] = [];

    (['trua', 'toi'] as const).forEach(shiftKey => {
      const shiftLabel = shiftKey === 'trua' ? 'Trưa' : 'Tối';
      const rows = day[shiftKey];
      const analyses = rows.map((r, idx) => analyzeDish(r, idx));

      const mainAnalyses = analyses.filter(a => a.role === 'chinh');
      const mainRows = rows.filter((_, idx) => analyses[idx].role === 'chinh');

      // Check R2 (Gà), R3 (Vịt), R5 (Cá)
      let hasChickenInShift = false;
      let hasDuckInShift = false;
      let hasFishInShift = false;

      mainAnalyses.forEach((a, mIdx) => {
        const mRow = mainRows[mIdx];
        if (a.proteins.includes('ga')) hasChickenInShift = true;
        if (a.proteins.includes('vit')) hasDuckInShift = true;
        if (a.proteins.includes('ca')) {
          hasFishInShift = true;
          if (prevFishName && a.fishName && prevFishName === a.fishName) {
            addWarning({
              ruleCode: 'R5',
              group: 'ga_vit_ca',
              severity: 'REVIEW',
              day: dayLabel,
              shift: shiftLabel,
              rowLabel: `Món chính ${mIdx + 1}`,
              dishName: mRow.ten,
              weightRaw: mRow.tl,
              calculation: `Trùng loại cá "${a.fishName}" với bữa cá trước`,
              clause: 'R5: Cá hôm trước phải khác cá hôm sau',
              suggestion: 'Đổi sang loại cá khác.'
            });
          }
          if (a.fishName) prevFishName = a.fishName;
        }

        // Track protein diversity (R4)
        a.proteins.forEach(p => {
          proteinMealCounts[p] = (proteinMealCounts[p] || 0) + 1;
        });

        // Track motif "X kho..."
        const normName = normalizeDishNameForDup(mRow.ten);
        if (normName.includes(' kho')) {
          const prefix = normName.split(' kho')[0] + ' kho';
          motifCounts[prefix] = (motifCounts[prefix] || 0) + 1;
        }

        allMainDishes.push({ dayIdx, dayLabel, shift: shiftLabel, name: mRow.ten });
      });

      if (hasChickenInShift) {
        chickenMeals++;
        chickenWithBreakfast++;
      }
      if (hasDuckInShift) duckMeals++;
      if (hasFishInShift) dayFishMeals++;

      // R7: 2 món chính không trùng nguyên liệu đạm
      if (!isChay && mainAnalyses.length >= 2) {
        const p1 = mainAnalyses[0].proteins;
        const p2 = mainAnalyses[1].proteins;
        const overlap = p1.filter(p => p2.includes(p));
        if (overlap.length > 0) {
          addWarning({
            ruleCode: 'R7',
            group: 'che_bien',
            severity: 'HIGH',
            day: dayLabel,
            shift: shiftLabel,
            rowLabel: 'r1 & r2',
            dishName: `${mainRows[0].ten} + ${mainRows[1].ten}`,
            weightRaw: '',
            calculation: `Cùng đạm: ${overlap.join(', ')}`,
            clause: 'R7: 2 món chính cùng bữa không trùng nguyên liệu đạm',
            suggestion: 'Đổi 1 món chính sang loại đạm khác.'
          });
        }
      }

      // R8: 2 món chính cùng bữa không cùng cách chế biến chính
      if (!isChay && mainAnalyses.length >= 2) {
        const c1 = mainAnalyses[0].cookingMethod;
        const c2 = mainAnalyses[1].cookingMethod;
        if (c1 !== 'khác' && c1 === c2) {
          addWarning({
            ruleCode: 'R8',
            group: 'che_bien',
            severity: 'HIGH',
            day: dayLabel,
            shift: shiftLabel,
            rowLabel: 'r1 & r2',
            dishName: `${mainRows[0].ten} + ${mainRows[1].ten}`,
            weightRaw: '',
            calculation: `Cùng cách chế biến: ${c1} + ${c2}`,
            clause: 'R8: Hai món chính cùng bữa không cùng cách chế biến chính',
            suggestion: 'Kết hợp 2 cách chế biến khác nhau (vd: kho + xào/rim).'
          });
        } else if ((c1 === 'kho' && c2 === 'rim') || (c1 === 'rim' && c2 === 'kho')) {
          addWarning({
            ruleCode: 'R8',
            group: 'che_bien',
            severity: 'REVIEW',
            day: dayLabel,
            shift: shiftLabel,
            rowLabel: 'r1 & r2',
            dishName: `${mainRows[0].ten} + ${mainRows[1].ten}`,
            weightRaw: '',
            calculation: `Cặp ${c1} + ${c2} gần giống`,
            clause: 'R8: Cặp kho + rim gần giống nhau (REVIEW)',
            suggestion: 'Cân nhắc đổi 1 món sang xào/nấu.'
          });
        }
      }

      // Row-by-row checks: Quantitative, Prohibited Summer Dishes, R6
      rows.forEach((row, rIdx) => {
        if (!row.ten) return;
        const a = analyses[rIdx];
        const rowLabel = `r${rIdx + 1} (${
          a.role === 'chinh' ? 'Món chính' :
          a.role === 'phu' ? 'Món phụ' :
          a.role === 'rau' ? 'Rau' :
          a.role === 'canh' ? 'Canh' :
          a.role === 'com' ? 'Cơm' : 'Tráng miệng'
        })`;

        dayDishNames.push(row.ten);
        if (a.role === 'phu' || a.role === 'rau' || a.role === 'canh') {
          allSideDishes.push({ dayIdx, dayLabel, shift: shiftLabel, role: a.role, name: row.ten });
        }

        // R6: Chế biến sẵn ở món chính
        if (!isChay && a.role === 'chinh' && a.preprocessed.isMainIngredient) {
          addWarning({
            ruleCode: 'R6',
            group: 'che_bien',
            severity: 'HIGH',
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: `Chế biến sẵn làm nguyên liệu chính: ${a.preprocessed.found.join(', ')}`,
            clause: 'R6: Chế biến sẵn KHÔNG làm món chính',
            suggestion: 'Thay bằng thịt/cá tươi, chỉ dùng đồ chế biến sẵn làm món phụ hoặc đi kèm.'
          });
        }

        // Quantitative check
        if (a.role === 'trang_mieng') {
          const lower = row.ten.toLowerCase();
          const forbiddenDes = hasAnyWord(lower, DESSERT_FORBIDDEN_KEYWORDS);
          if (forbiddenDes) {
            addWarning({
              ruleCode: 'DL-06',
              group: 'dinh_luong',
              severity: isChay ? 'REVIEW' : 'HIGH',
              day: dayLabel,
              shift: shiftLabel,
              rowLabel,
              dishName: row.ten,
              weightRaw: row.tl,
              calculation: `Tráng miệng là "${forbiddenDes}"`,
              clause: 'Định lượng: Tráng miệng phải là trái cây (không dùng thạch/rau câu/sữa/bánh)',
              suggestion: 'Đổi sang trái cây tươi (chuối, ổi, táo, dưa hấu...).'
            });
          }
        } else if (a.weight.hasWeight) {
          const minReq =
            a.role === 'chinh' ? thresholds.monChinhMin :
            a.role === 'phu' ? thresholds.monPhuMin :
            a.role === 'rau' ? thresholds.rauMin :
            a.role === 'canh' ? thresholds.canhMin :
            thresholds.comMin;

          const unit = a.role === 'canh' ? 'ml' : 'g';

          if (a.weight.max < minReq) {
            if (a.role === 'chinh') underweightMainCount++;
            addWarning({
              ruleCode: 'DL-01',
              group: 'dinh_luong',
              severity: isChay ? 'REVIEW' : 'HIGH',
              day: dayLabel,
              shift: shiftLabel,
              rowLabel,
              dishName: row.ten,
              weightRaw: row.tl,
              calculation: `${a.weight.calculation} < ${minReq}${unit}`,
              clause: `Định lượng tối thiểu ${a.role}: ≥ ${minReq}${unit}`,
              suggestion: `Tăng định lượng lên tối thiểu ${minReq}${unit}.`
            });
          } else if (a.weight.min < minReq && a.weight.max >= minReq) {
            addWarning({
              ruleCode: 'DL-02',
              group: 'dinh_luong',
              severity: 'REVIEW',
              day: dayLabel,
              shift: shiftLabel,
              rowLabel,
              dishName: row.ten,
              weightRaw: row.tl,
              calculation: `${a.weight.calculation} (cận dưới < ${minReq}${unit})`,
              clause: `Định lượng tối thiểu ${a.role}: ≥ ${minReq}${unit}`,
              suggestion: `Nâng mức cận dưới lên ≥ ${minReq}${unit}.`
            });
          }
        }

        // 23 Prohibited Summer Dishes
        const s = normNFC(row.ten).toLowerCase();
        // Exempt: rau/củ/quả luộc
        if (a.cookingMethod === 'luộc' && a.role !== 'rau' && !/rau|củ|quả|bầu|bí|khổ qua|mướp|đậu bắp|cải/.test(s)) {
          if (a.proteins.includes('trung')) {
            addWarning({
              ruleCode: 'MC-01b',
              group: 'mon_cam',
              severity: getRuleSev('MC-01b', 'REVIEW'),
              day: dayLabel,
              shift: shiftLabel,
              rowLabel,
              dishName: row.ten,
              weightRaw: row.tl,
              calculation: 'Trứng luộc',
              clause: 'Mục 1 (REVIEW): Trứng luộc',
              suggestion: 'Cân nhắc đổi sang trứng kho hoặc chiên.'
            });
          } else {
            addWarning({
              ruleCode: 'MC-01',
              group: 'mon_cam',
              severity: getRuleSev('MC-01', 'HIGH'),
              day: dayLabel,
              shift: shiftLabel,
              rowLabel,
              dishName: row.ten,
              weightRaw: row.tl,
              calculation: 'Món thịt/gà/vịt luộc',
              clause: 'Mục 1: Cấm món luộc (thịt/gà/vịt luộc)',
              suggestion: 'Đổi sang kho, hầm hoặc om.'
            });
          }
        }

        if (a.cookingMethod === 'hấp') {
          addWarning({
            ruleCode: 'MC-02',
            group: 'mon_cam',
            severity: getRuleSev('MC-02', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Món hấp / chưng',
            clause: 'Mục 2: Cấm món hấp / chưng',
            suggestion: 'Đổi sang kho hoặc om.'
          });
        }

        const organ = hasAnyWord(s, ORGAN_MEAT_KEYWORDS);
        if (organ) {
          addWarning({
            ruleCode: 'MC-03',
            group: 'mon_cam',
            severity: getRuleSev('MC-03', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: `Chứa nội tạng: ${organ}`,
            clause: 'Mục 3: Cấm món chế biến từ nội tạng động vật',
            suggestion: 'Loại bỏ nội tạng, thay bằng thịt nạc/cá.'
          });
        }

        if (a.cookingMethod === 'chiên') {
          const isCaNucChien = /cá\s*nục/i.test(s);
          if (!isCaNucChien) {
            const isReviewChien =
              a.proteins.includes('dauhu') ||
              a.proteins.includes('trung') ||
              /chả\s*giò|cá\s*viên|rôti|rô\s*ti/i.test(s);
            if (isReviewChien) {
              addWarning({
                ruleCode: 'MC-04b',
                group: 'mon_cam',
                severity: getRuleSev('MC-04b', 'REVIEW'),
                day: dayLabel,
                shift: shiftLabel,
                rowLabel,
                dishName: row.ten,
                weightRaw: row.tl,
                calculation: 'Món chiên nhóm REVIEW (đậu hũ/trứng/chả giò/gà rôti)',
                clause: 'Mục 4 (REVIEW): Đậu hũ/chả giò/trứng chiên, gà rôti',
                suggestion: 'Ưu tiên món kho, hầm, om.'
              });
            } else if (a.proteins.some(p => ['heo', 'ga', 'vit', 'ca', 'tom', 'bo'].includes(p))) {
              addWarning({
                ruleCode: 'MC-04',
                group: 'mon_cam',
                severity: getRuleSev('MC-04', 'HIGH'),
                day: dayLabel,
                shift: shiftLabel,
                rowLabel,
                dishName: row.ten,
                weightRaw: row.tl,
                calculation: 'Món chiên/rán thịt, gà, vịt, cá, tôm (trừ cá nục chiên)',
                clause: 'Mục 4: Cấm món chiên/rán',
                suggestion: 'Đổi sang kho, rim hoặc om.'
              });
            }
          }
        }

        if (a.cookingMethod === 'xào' && /hành\s*tây/i.test(s)) {
          addWarning({
            ruleCode: 'MC-05',
            group: 'mon_cam',
            severity: getRuleSev('MC-05', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Xào với hành tây',
            clause: 'Mục 5: Cấm món xào với hành tây',
            suggestion: 'Bỏ hành tây hoặc đổi rau khác.'
          });
        }

        if (a.cookingMethod === 'xào' && /cần\s*tây|cần\s*tàu/i.test(s)) {
          addWarning({
            ruleCode: 'MC-06',
            group: 'mon_cam',
            severity: getRuleSev('MC-06', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Xào với cần tây / cần tàu',
            clause: 'Mục 6: Cấm món xào với cần tây (kể cả cần tàu)',
            suggestion: 'Thay cần tây/cần tàu bằng rau khác.'
          });
        }

        if (a.cookingMethod === 'xào' && /\bnấm\b/i.test(s)) {
          addWarning({
            ruleCode: 'MC-07',
            group: 'mon_cam',
            severity: getRuleSev('MC-07', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Xào với nấm',
            clause: 'Mục 7: Cấm món xào với nấm',
            suggestion: 'Bỏ nấm khỏi món xào.'
          });
        }

        if (/dưa\s*muối|cà\s*muối|dưa\s*chua|dưa\s*cải|cải\s*mặn|cải\s*chua/i.test(s)) {
          addWarning({
            ruleCode: 'MC-08',
            group: 'mon_cam',
            severity: getRuleSev('MC-08', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Chứa dưa muối / cải mặn / dưa chua',
            clause: 'Mục 8: Cấm dưa muối/cà muối (kể cả cải mặn, dưa cải, dưa chua)',
            suggestion: 'Thay bằng củ cải, su hào hoặc rau tươi.'
          });
        } else if (/dưa\s*mắm/i.test(s)) {
          addWarning({
            ruleCode: 'MC-08b',
            group: 'mon_cam',
            severity: getRuleSev('MC-08b', 'REVIEW'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Dưa mắm',
            clause: 'Mục 8 (REVIEW): Dưa mắm',
            suggestion: 'Hạn chế dưa mắm.'
          });
        }

        if (/khoai\s*tây.*thì\s*là|thì\s*là.*khoai\s*tây/i.test(s)) {
          addWarning({
            ruleCode: 'MC-09',
            group: 'mon_cam',
            severity: getRuleSev('MC-09', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Khoai tây xào thì là',
            clause: 'Mục 9: Cấm khoai tây xào thì là',
            suggestion: 'Đổi sang khoai tây om xương.'
          });
        }

        if (/thịt.*súp\s*lơ|súp\s*lơ.*thịt/i.test(s)) {
          addWarning({
            ruleCode: 'MC-10',
            group: 'mon_cam',
            severity: getRuleSev('MC-10', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Thịt xào súp lơ',
            clause: 'Mục 10: Cấm thịt xào súp lơ',
            suggestion: 'Đổi sang súp lơ luộc.'
          });
        }

        if (/thịt\s*nhồi\s*đậu|đậu\s*nhồi\s*thịt/i.test(s)) {
          addWarning({
            ruleCode: 'MC-11',
            group: 'mon_cam',
            severity: getRuleSev('MC-11', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Thịt nhồi đậu',
            clause: 'Mục 11: Cấm thịt nhồi đậu',
            suggestion: 'Đổi sang đậu hũ kho thịt.'
          });
        }

        if (/nhồi\s*(mướp\s*đắng|khổ\s*qua)/i.test(s)) {
          addWarning({
            ruleCode: 'MC-12',
            group: 'mon_cam',
            severity: getRuleSev('MC-12', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Thịt nhồi mướp đắng / khổ qua',
            clause: 'Mục 12: Cấm thịt nhồi mướp đắng/khổ qua',
            suggestion: 'Đổi sang canh khổ qua nấu thịt bằm.'
          });
        }

        if (/trứng\s*xào\s*cà\s*chua/i.test(s)) {
          addWarning({
            ruleCode: 'MC-13',
            group: 'mon_cam',
            severity: getRuleSev('MC-13', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Trứng xào cà chua',
            clause: 'Mục 13: Cấm trứng xào cà chua',
            suggestion: 'Đổi sang trứng kho thịt.'
          });
        }

        if (/canh\s*bí\s*đỏ/i.test(s)) {
          addWarning({
            ruleCode: 'MC-14',
            group: 'mon_cam',
            severity: getRuleSev('MC-14', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Canh bí đỏ',
            clause: 'Mục 14: Cấm canh bí đỏ',
            suggestion: 'Đổi sang canh bí xanh / bầu / rau ngót.'
          });
        }

        if (/canh\s*giá\s*đỗ\s*chua/i.test(s)) {
          addWarning({
            ruleCode: 'MC-15',
            group: 'mon_cam',
            severity: getRuleSev('MC-15', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Canh giá đỗ chua',
            clause: 'Mục 15: Cấm canh giá đỗ chua',
            suggestion: 'Đổi sang canh rau tập tàng.'
          });
        }

        if (/canh\s*ngao\s*nấu\s*chua/i.test(s)) {
          addWarning({
            ruleCode: 'MC-16',
            group: 'mon_cam',
            severity: getRuleSev('MC-16', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Canh ngao nấu chua',
            clause: 'Mục 16: Cấm canh ngao nấu chua',
            suggestion: 'Đổi sang canh ngao nấu bầu/mồng tơi.'
          });
        }

        if (/canh\s*cà\s*chua/i.test(s)) {
          addWarning({
            ruleCode: 'MC-17',
            group: 'mon_cam',
            severity: getRuleSev('MC-17', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Canh cà chua',
            clause: 'Mục 17: Cấm canh cà chua',
            suggestion: 'Đổi sang canh rau xanh.'
          });
        } else if (/canh\s*chua/i.test(s)) {
          addWarning({
            ruleCode: 'MC-17b',
            group: 'mon_cam',
            severity: getRuleSev('MC-17b', 'REVIEW'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Canh chua (có thể chứa cà chua)',
            clause: 'Mục 17 (REVIEW): Canh chua có thể chứa cà chua',
            suggestion: 'Đảm bảo không dùng cà chua trong canh chua.'
          });
        } else if (/cà\s*chua/i.test(s)) {
          addWarning({
            ruleCode: 'MC-18',
            group: 'mon_cam',
            severity: getRuleSev('MC-18', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Chứa cà chua',
            clause: 'Mục 18: Cấm tất cả món chế biến có cà chua',
            suggestion: 'Loại bỏ cà chua khỏi món ăn.'
          });
        }

        if (hasWord(s, 'quả mận') || (a.role === 'trang_mieng' && hasWord(s, 'mận'))) {
          addWarning({
            ruleCode: 'MC-19',
            group: 'mon_cam',
            severity: getRuleSev('MC-19', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Quả mận',
            clause: 'Mục 19: Cấm quả mận',
            suggestion: 'Đổi sang trái cây khác (chuối, ổi, táo...).'
          });
        }

        if (hasWord(s, 'ếch') && !/cốt\s*lếch/i.test(s)) {
          addWarning({
            ruleCode: 'MC-20',
            group: 'mon_cam',
            severity: getRuleSev('MC-20', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Chế biến từ ếch',
            clause: 'Mục 20: Cấm các món chế biến từ ếch',
            suggestion: 'Thay bằng thịt heo/gà/cá.'
          });
        }

        if (a.role === 'chinh' && hasWord(s, 'xúc xích')) {
          addWarning({
            ruleCode: 'MC-21',
            group: 'mon_cam',
            severity: getRuleSev('MC-21', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Xúc xích ở món chính',
            clause: 'Mục 21: Xúc xích không làm bữa chính',
            suggestion: 'Chuyển xuống món phụ (r3) hoặc thay bằng thịt tươi.'
          });
        }

        if (a.role === 'chinh' && hasWord(s, 'lạp xưởng')) {
          addWarning({
            ruleCode: 'MC-22',
            group: 'mon_cam',
            severity: getRuleSev('MC-22', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Lạp xưởng ở món chính',
            clause: 'Mục 22: Lạp xưởng không làm bữa chính',
            suggestion: 'Chuyển xuống món phụ (r3) hoặc thay bằng thịt tươi.'
          });
        }

        if (/trứng\s*cút\s*xíu\s*mại/i.test(s)) {
          addWarning({
            ruleCode: 'MC-23',
            group: 'mon_cam',
            severity: getRuleSev('MC-23', 'HIGH'),
            day: dayLabel,
            shift: shiftLabel,
            rowLabel,
            dishName: row.ten,
            weightRaw: row.tl,
            calculation: 'Trứng cút xíu mại',
            clause: 'Mục 23: Cấm trứng cút xíu mại',
            suggestion: 'Đổi sang thịt kho trứng.'
          });
        }

        // Custom additional rules
        for (const cr of customRules) {
          if (!cr.enabled || cr.keywords.length === 0) continue;
          const matchedKw = hasAnyWord(s, cr.keywords.map(k => k.toLowerCase()));
          if (matchedKw) {
            addWarning({
              ruleCode: 'BS',
              group: 'mon_cam',
              severity: cr.severity,
              day: dayLabel,
              shift: shiftLabel,
              rowLabel,
              dishName: row.ten,
              weightRaw: row.tl,
              calculation: `Khớp từ khoá bổ sung: "${matchedKw}"`,
              clause: `Quy tắc bổ sung: ${cr.name}`,
              suggestion: `Điều chỉnh món để tránh vi phạm quy tắc "${cr.name}".`
            });
          }
        }
      });
    });

    // R5: Mỗi ngày chỉ đúng 1 bữa có cá trong 2 món chính
    if (!isChay) {
      if (dayFishMeals >= 2) {
        addWarning({
          ruleCode: 'R5',
          group: 'ga_vit_ca',
          severity: 'HIGH',
          day: dayLabel,
          shift: 'Trưa & Tối',
          rowLabel: 'Món chính',
          dishName: '2 bữa cá trong cùng 1 ngày',
          weightRaw: '',
          calculation: `${dayFishMeals} bữa có cá/ngày (chuẩn: 1 bữa/ngày)`,
          clause: 'R5: Mỗi ngày chỉ đúng 1 bữa có cá trong 2 món chính',
          suggestion: 'Đổi 1 bữa cá sang thịt heo/gà/vịt.'
        });
      } else if (dayFishMeals === 0) {
        addWarning({
          ruleCode: 'R5',
          group: 'ga_vit_ca',
          severity: 'REVIEW',
          day: dayLabel,
          shift: 'Cả ngày',
          rowLabel: 'Món chính',
          dishName: 'Không có bữa cá nào trong ngày',
          weightRaw: '',
          calculation: '0 bữa cá/ngày (chuẩn: 1 bữa/ngày)',
          clause: 'R5: Mỗi ngày nên có 1 bữa cá trong 2 món chính',
          suggestion: 'Bổ sung 1 món cá vào bữa trưa hoặc tối.'
        });
      }
    }
  });

  // --- 3. WEEKLY RULES (R2, R3, R4, R10) ---
  if (!isChay) {
    if (chickenMeals > 3) {
      addWarning({
        ruleCode: 'R2',
        group: 'ga_vit_ca',
        severity: 'HIGH',
        day: 'Cả tuần',
        shift: 'Trưa / Tối',
        rowLabel: 'Món chính',
        dishName: `Gà xuất hiện ${chickenMeals} bữa trưa/tối`,
        weightRaw: '',
        calculation: `${chickenMeals} bữa trưa/tối (tính cả sáng: ${chickenWithBreakfast} bữa) > 3 bữa/tuần`,
        clause: 'R2: Gà ≤ 3 bữa/tuần (đếm bữa trưa/tối có gà ở r1 hoặc r2)',
        suggestion: 'Giảm số bữa gà xuống ≤ 3 bữa/tuần.'
      });
    } else {
      passedItems.push(`R2 Gà: ${chickenMeals}/3 bữa trưa/tối (tính cả sáng: ${chickenWithBreakfast})`);
    }

    if (duckMeals > 3) {
      addWarning({
        ruleCode: 'R3',
        group: 'ga_vit_ca',
        severity: 'HIGH',
        day: 'Cả tuần',
        shift: 'Trưa / Tối',
        rowLabel: 'Món chính',
        dishName: `Vịt xuất hiện ${duckMeals} bữa trưa/tối`,
        weightRaw: '',
        calculation: `${duckMeals} bữa > 3 bữa/tuần`,
        clause: 'R3: Vịt ≤ 3 bữa/tuần',
        suggestion: 'Giảm số bữa vịt xuống ≤ 3 bữa/tuần.'
      });
    } else {
      passedItems.push(`R3 Vịt: ${duckMeals}/3 bữa trưa/tối`);
    }

    if (breadBreakfasts > 2) {
      addWarning({
        ruleCode: 'R10',
        group: 'che_bien',
        severity: 'HIGH',
        day: 'Cả tuần',
        shift: 'Sáng',
        rowLabel: 'Bữa sáng',
        dishName: `Bánh mì bữa sáng ${breadBreakfasts} bữa/tuần`,
        weightRaw: '',
        calculation: `${breadBreakfasts} bữa > 2 bữa/tuần`,
        clause: 'R10: Bánh mì bữa sáng ≤ 2 bữa/tuần',
        suggestion: 'Giảm bánh mì bữa sáng xuống ≤ 2 bữa/tuần.'
      });
    } else {
      passedItems.push(`R10 Bánh mì sáng: ${breadBreakfasts}/2 bữa/tuần`);
    }

    // R4: Đa dạng (mềm) > 50% số bữa (7/14 bữa)
    for (const [prot, cnt] of Object.entries(proteinMealCounts)) {
      if (cnt > 7) {
        addWarning({
          ruleCode: 'R4',
          group: 'ga_vit_ca',
          severity: 'REVIEW',
          day: 'Cả tuần',
          shift: 'Trưa / Tối',
          rowLabel: 'Món chính',
          dishName: `Đạm "${prot}" chiếm ${cnt}/14 bữa`,
          weightRaw: '',
          calculation: `${cnt}/14 bữa (${Math.round((cnt / 14) * 100)}% > 50%)`,
          clause: 'R4: Đa dạng thực đơn (một loại đạm không chiếm > 50% số bữa)',
          suggestion: 'Tăng cường đa dạng các loại đạm khác.'
        });
      }
    }
    for (const [motif, cnt] of Object.entries(motifCounts)) {
      if (cnt > 7) {
        addWarning({
          ruleCode: 'R4',
          group: 'che_bien',
          severity: 'REVIEW',
          day: 'Cả tuần',
          shift: 'Trưa / Tối',
          rowLabel: 'Món chính',
          dishName: `Kiểu món "${motif}…" chiếm ${cnt}/14 bữa`,
          weightRaw: '',
          calculation: `${cnt}/14 bữa (${Math.round((cnt / 14) * 100)}% > 50%)`,
          clause: 'R4: Đa dạng kiểu món (một kiểu món không chiếm > 50% số bữa)',
          suggestion: 'Đổi bớt sang kiểu chế biến khác.'
        });
      }
    }
  }

  // --- 4. DUPLICATE DISHES (3 TIERS + HISTORY) ---
  for (let i = 0; i < allMainDishes.length; i++) {
    for (let j = i + 1; j < allMainDishes.length; j++) {
      const a = allMainDishes[i];
      const b = allMainDishes[j];
      const na = normalizeDishNameForDup(a.name);
      const nb = normalizeDishNameForDup(b.name);
      // Never flag standalone "thịt heo"
      if (na === 'thịt heo' || nb === 'thịt heo') continue;

      const sim = dishSimilarity(a.name, b.name);
      if (sim >= 0.85) {
        const diffDays = b.dayIdx - a.dayIdx;
        if (diffDays === 0) {
          addWarning({
            ruleCode: 'R7',
            group: 'trung_mon',
            severity: isChay ? 'REVIEW' : 'HIGH',
            day: a.dayLabel,
            shift: `${a.shift} & ${b.shift}`,
            rowLabel: 'Món chính / Sáng',
            dishName: `${a.name} ≈ ${b.name}`,
            weightRaw: '',
            calculation: 'Trùng món trong cùng 1 ngày',
            clause: 'R7: Trong một ngày không trùng món',
            suggestion: 'Đổi 1 trong 2 món sang món khác.'
          });
        } else if (diffDays === 1) {
          addWarning({
            ruleCode: 'R9',
            group: 'trung_mon',
            severity: isChay ? 'REVIEW' : 'HIGH',
            day: `${a.dayLabel} → ${b.dayLabel}`,
            shift: `${a.shift} → ${b.shift}`,
            rowLabel: 'Món chính',
            dishName: `${a.name} ≈ ${b.name}`,
            weightRaw: '',
            calculation: 'Trùng món ở 2 ngày liền kề (cách 1 ngày)',
            clause: 'R9: Món chính ngày trước không trùng ngày sau',
            suggestion: 'Giãn cách ít nhất 3 ngày.'
          });
        } else if (diffDays === 2) {
          addWarning({
            ruleCode: 'TM-01',
            group: 'trung_mon',
            severity: 'REVIEW',
            day: `${a.dayLabel} → ${b.dayLabel}`,
            shift: `${a.shift} → ${b.shift}`,
            rowLabel: 'Món chính',
            dishName: `${a.name} ≈ ${b.name}`,
            weightRaw: '',
            calculation: `Lặp trong tuần (cách ${diffDays} ngày, chuẩn ≥ 3 ngày)`,
            clause: 'Trùng món: Lặp cách < 3 ngày trong tuần',
            suggestion: 'Giãn cách ≥ 3 ngày.'
          });
        }
      }
    }
  }

  // History check (last 4 weeks of same NCC)
  const sameNccHistory = historyMenus
    .filter(h => h.ncc === menu.ncc && h.loai === menu.loai && h.id !== menu.id)
    .slice(0, 4);

  for (const hist of sameNccHistory) {
    for (const day of menu.ngay) {
      for (const shiftKey of ['trua', 'toi'] as const) {
        for (const row of day[shiftKey]) {
          if (!row.ten) continue;
          const role = determineDishRole(row.ten, 0);
          if (role !== 'chinh') continue;
          for (const hDay of hist.ngay) {
            for (const hShift of ['trua', 'toi'] as const) {
              for (const hRow of hDay[hShift]) {
                if (dishSimilarity(row.ten, hRow.ten) >= 0.9) {
                  addWarning({
                    ruleCode: 'TM-LS',
                    group: 'trung_mon',
                    severity: 'REVIEW',
                    day: `${day.ma} (${day.ngayThang.slice(0, 5)})`,
                    shift: shiftKey === 'trua' ? 'Trưa' : 'Tối',
                    rowLabel: 'Món chính',
                    dishName: row.ten,
                    weightRaw: '',
                    calculation: `Trùng với tuần ${hist.tuanTu}–${hist.tuanDen} (${hist.fileName || hist.ncc})`,
                    clause: 'Đối chiếu lịch sử: Trùng món với tuần trước',
                    suggestion: 'Cân nhắc đổi món để tăng độ mới mẻ.'
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  // --- 5. GROUP REPEATED WARNINGS (>= 4 meals) ---
  const groupedMap = new Map<string, AuditWarning[]>();
  const finalWarnings: AuditWarning[] = [];

  for (const w of warnings) {
    const key = `${w.ruleCode}|${w.severity}|${w.clause}|${w.calculation}`;
    const list = groupedMap.get(key) || [];
    list.push(w);
    groupedMap.set(key, list);
  }

  for (const [, list] of groupedMap.entries()) {
    if (list.length >= 4) {
      const first = list[0];
      const details = list.map(item => `${item.day} ${item.shift} (${item.dishName})`);
      finalWarnings.push({
        ...first,
        day: `Nhiều ngày (${list.length} bữa)`,
        shift: 'Nhiều ca',
        groupedCount: list.length,
        groupedDetails: details
      });
    } else {
      finalWarnings.push(...list);
    }
  }

  // --- 6. SCORING (0-100, capped per group) ---
  const groups: { group: RuleGroup; label: string }[] = [
    { group: 'mon_cam', label: 'Món cấm mùa hè' },
    { group: 'dinh_luong', label: 'Định lượng' },
    { group: 'ga_vit_ca', label: 'Gà / Vịt / Cá' },
    { group: 'che_bien', label: 'Chế biến & Đa dạng' },
    { group: 'trung_mon', label: 'Trùng món' }
  ];

  let totalDeduction = 0;
  const groupScores: GroupScore[] = groups.map(g => {
    const gw = finalWarnings.filter(w => w.group === g.group);
    const highCount = gw.filter(w => w.severity === 'HIGH').length;
    const reviewCount = gw.filter(w => w.severity === 'REVIEW').length;
    const rawDed = highCount * 3 + reviewCount * 0.5;
    const deduction = Math.min(20, rawDed);
    totalDeduction += deduction;
    return {
      group: g.group,
      label: g.label,
      highCount,
      reviewCount,
      deduction,
      maxDeduction: 20,
      score: Math.max(0, 20 - deduction)
    };
  });

  const totalScore = Math.max(0, Math.round((100 - totalDeduction) * 10) / 10);
  const highCount = finalWarnings.filter(w => w.severity === 'HIGH').length;
  const reviewCount = finalWarnings.filter(w => w.severity === 'REVIEW').length;

  return {
    menuId: menu.id,
    ncc: menu.ncc,
    loai: menu.loai,
    tuanTu: menu.tuanTu,
    tuanDen: menu.tuanDen,
    totalScore,
    highCount,
    reviewCount,
    warnings: finalWarnings,
    passedItems,
    groupScores,
    stats: {
      chickenMeals,
      chickenWithBreakfast,
      duckMeals,
      breadBreakfasts,
      fishDaysSummary: `${menu.ngay.length} ngày`,
      underweightMainCount
    }
  };
}

export interface SelfTestCase {
  name: string;
  passed: boolean;
  detail: string;
}

export function runSelfTests(): SelfTestCase[] {
  const results: SelfTestCase[] = [];

  // 1. Thịt heo kho củ cải | Thịt: 45 -50 gr, củ cải 40 gr -> 85-90g, PASS
  const a1 = analyzeDish({ ten: 'Thịt heo kho củ cải', tl: 'Thịt: 45 -50 gr, củ cải 40 gr' }, 0);
  results.push({
    name: '1. Cộng thành phần: "Thịt: 45 -50 gr, củ cải 40 gr" → 85–90g (Đạt ≥ 75g)',
    passed: a1.role === 'chinh' && a1.weight.min === 85 && a1.weight.max === 90,
    detail: `Vai trò: ${a1.role}, Trọng lượng: ${a1.weight.min}–${a1.weight.max}g (${a1.weight.calculation})`
  });

  // 2. Cá rô phi chiên rim mắm ở r2 -> món chính, đạm = ca, chế biến = chiên
  const a2 = analyzeDish({ ten: 'Cá rô phi chiên rim mắm', tl: '80g' }, 1);
  results.push({
    name: '2. "Cá rô phi chiên rim mắm" ở r2 → món chính, đạm = cá, chế biến = chiên',
    passed: a2.role === 'chinh' && a2.proteins.includes('ca') && a2.cookingMethod === 'chiên',
    detail: `Vai trò: ${a2.role}, Đạm: ${a2.proteins.join(',')}, Chế biến: ${a2.cookingMethod}`
  });

  // 3. Cá nục chiên rim mắm tỏi -> miễn mục chiên
  const a3 = analyzeDish({ ten: 'Cá nục chiên rim mắm tỏi', tl: '80g' }, 0);
  const isCaNucExempt = /cá\s*nục/i.test('Cá nục chiên rim mắm tỏi') && a3.cookingMethod === 'chiên';
  results.push({
    name: '3. "Cá nục chiên rim mắm tỏi" → được miễn mục chiên',
    passed: isCaNucExempt,
    detail: isCaNucExempt ? 'Đã nhận diện cá nục chiên và miễn' : 'Không miễn'
  });

  // 4. Traps: Trứng gà, Tôm sốt bơ tỏi, Thịt kho mắm ruốc, Cốt lết ram
  const pTrứng = extractProteins('Trứng gà luộc').proteins;
  const pBơ = extractProteins('Tôm sốt bơ tỏi').proteins;
  const pRuốc = extractProteins('Thịt kho mắm ruốc dưa leo').proteins;
  const pCốtLết = extractProteins('Cốt lết ram').proteins;
  const trapsOk =
    !pTrứng.includes('ga') && pTrứng.includes('trung') &&
    !pBơ.includes('bo') && pBơ.includes('tom') &&
    !pRuốc.includes('oc') && pRuốc.includes('heo') &&
    pCốtLết.includes('heo');
  results.push({
    name: '4. Tránh bẫy từ khoá: Trứng gà≠gà, Bơ≠bò, Mắm ruốc≠ốc, Cốt lết=heo',
    passed: trapsOk,
    detail: `Trứng gà:[${pTrứng}], Bơ:[${pBơ}], Ruốc:[${pRuốc}], Cốt lết:[${pCốtLết}]`
  });

  // 5. Trứng hấp thịt bằm -> trứng + heo, chế biến = hấp
  const a5 = analyzeDish({ ten: 'Trứng hấp thịt bằm', tl: '80g' }, 0);
  results.push({
    name: '5. "Trứng hấp thịt bằm" → trứng + heo, chế biến = hấp',
    passed: a5.proteins.includes('trung') && a5.proteins.includes('heo') && a5.cookingMethod === 'hấp',
    detail: `Đạm: ${a5.proteins.join(',')}, Chế biến: ${a5.cookingMethod}`
  });

  // 6. Chế biến sẵn: đi kèm vs nguyên liệu chính
  const pre1 = analyzePreprocessed('Thịt heo rim chả lụa', extractProteins('Thịt heo rim chả lụa').proteins);
  const pre2 = analyzePreprocessed('Chả cá rim trứng cút', extractProteins('Chả cá rim trứng cút').proteins);
  results.push({
    name: '6. Chế biến sẵn: "Thịt heo rim chả lụa" (đi kèm) vs "Chả cá rim trứng cút" (chính)',
    passed: !pre1.isMainIngredient && pre2.isMainIngredient,
    detail: `Thịt rim chả lụa chính=${pre1.isMainIngredient}, Chả cá rim trứng cút chính=${pre2.isMainIngredient}`
  });

  // 7. Ô tráng miệng "Ôỉ" -> trái cây
  const roleOi = determineDishRole('Ôỉ', 6);
  results.push({
    name: '7. Ô tráng miệng "Ôỉ" → nhận diện là trái cây (trang_mieng)',
    passed: roleOi === 'trang_mieng',
    detail: `Vai trò: ${roleOi}`
  });

  return results;
}
