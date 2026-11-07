import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  Search,
  Filter,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Copy,
  Check,
  Building2,
  Calendar,
  Layers,
  List,
  Eye,
  EyeOff,
  Sparkles,
  ArrowUpDown,
  Tag
} from 'lucide-react';
import { AuditWarning, NccInfo, Severity } from '../types';
import { PROHIBITED_SUMMER_RULES } from '../ruleConfig';

export type ViewGroupingMode = 'by_rule' | 'by_ncc' | 'by_day' | 'flat';

interface EnrichedAuditWarning extends AuditWarning {
  nccCode: string;
  loai: 'man' | 'chay';
}

interface AuditWarningManagerProps {
  warnings: EnrichedAuditWarning[];
  nccList: NccInfo[];
  expandedGroupIds: Record<string, boolean>;
  setExpandedGroupIds: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

const STORAGE_KEY_RESOLVED = 'meals_resolved_warnings_v1';

export default function AuditWarningManager({
  warnings,
  nccList,
  expandedGroupIds,
  setExpandedGroupIds,
}: AuditWarningManagerProps) {
  const [viewMode, setViewMode] = useState<ViewGroupingMode>('by_rule');
  const [compactFlat, setCompactFlat] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | Severity>('ALL');
  const [hideResolved, setHideResolved] = useState<boolean>(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  // Resolved warnings tracker (persisted in localStorage)
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RESOLVED);
      if (saved) return new Set(JSON.parse(saved));
    } catch {
      // ignore
    }
    return new Set<string>();
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_RESOLVED, JSON.stringify(Array.from(resolvedIds)));
    } catch {
      // ignore
    }
  }, [resolvedIds]);

  const toggleResolved = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setResolvedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const nccMap = useMemo(() => {
    const map = new Map<string, string>();
    nccList.forEach(n => map.set(n.code, n.name));
    return map;
  }, [nccList]);

  const ruleNameMap = useMemo(() => {
    const map = new Map<string, string>();
    PROHIBITED_SUMMER_RULES.forEach(r => map.set(r.code, r.name));
    map.set('DL-01', 'Thiếu định lượng món chính (cận dưới < 75g)');
    map.set('DL-02', 'Thiếu định lượng món chính (tối thiểu 75g)');
    map.set('DL-06', 'Thiếu định lượng món phụ / canh / rau');
    map.set('DL-00', 'Thiếu thông số định lượng trong ô thực đơn');
    map.set('MC-01', 'Món luộc (thịt/gà/vịt luộc cấm mùa hè)');
    map.set('MC-01b', 'Trứng luộc (REVIEW)');
    map.set('MC-02', 'Món hấp / chưng');
    map.set('MC-03', 'Món chế biến từ nội tạng động vật');
    map.set('MC-04', 'Món chiên/rán thịt, gà, vịt, cá, tôm');
    map.set('MC-04b', 'Đậu hủ/chả giò/chả cá viên/trứng chiên, gà rôti');
    map.set('MC-05', 'Món xào với hành tây');
    map.set('MC-06', 'Món xào với cần tây / cần tàu');
    map.set('MC-07', 'Món xào với nấm');
    map.set('MC-08', 'Dưa muối / cà muối / dưa chua / cải mặn');
    map.set('MC-08b', 'Dưa mắm');
    map.set('MC-17b', 'Canh chua (có thể chứa cà chua)');
    map.set('MC-18', 'Món chế biến có cà chua');
    map.set('MC-21', 'Xúc xích ở món chính');
    map.set('TM-01', 'Trùng lặp món chính trong tuần');
    map.set('TM-LS', 'Trùng món liên tiếp giữa các ngày');
    map.set('R2', 'Số lượng bữa thịt vịt vượt trần (tối đa 3 bữa)');
    map.set('R3', 'Bánh mì ăn sáng vượt quy định (tối đa 2 lần/tuần)');
    map.set('R4', 'Số ngày ăn cá < 2 ngày/tuần');
    map.set('R5', 'Đa dạng chế biến món chính trong tuần');
    map.set('R6', 'Trùng món chính trong cùng 1 bữa');
    map.set('R7', 'Tần suất thịt gà (Trưa/Tối tối đa 3 bữa)');
    map.set('R8', 'Trùng phương pháp chế biến 2 món chính');
    map.set('R9', 'Canh trùng phương pháp xào/kho');
    map.set('R10', 'Cơm rang/chiên ở các bữa trưa hoặc tối');
    map.set('BS', 'Vi phạm quy tắc bổ sung tuỳ chỉnh');
    return map;
  }, []);

  // Filtered warnings by search & severity & resolved
  const filteredWarnings = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return warnings.filter(w => {
      if (severityFilter !== 'ALL' && w.severity !== severityFilter) return false;
      if (hideResolved && resolvedIds.has(w.id)) return false;
      if (!q) return true;

      const ruleName = ruleNameMap.get(w.ruleCode)?.toLowerCase() || '';
      const nccName = nccMap.get(w.nccCode)?.toLowerCase() || '';
      const dish = w.dishName.toLowerCase();
      const code = w.ruleCode.toLowerCase();
      const ncc = w.nccCode.toLowerCase();
      const day = w.day.toLowerCase();
      const shift = w.shift.toLowerCase();
      const detail = (w.calculation + ' ' + w.clause + ' ' + w.suggestion).toLowerCase();

      return (
        dish.includes(q) ||
        code.includes(q) ||
        ruleName.includes(q) ||
        ncc.includes(q) ||
        nccName.includes(q) ||
        day.includes(q) ||
        shift.includes(q) ||
        detail.includes(q)
      );
    });
  }, [warnings, searchTerm, severityFilter, hideResolved, resolvedIds, ruleNameMap, nccMap]);

  // Overall statistics
  const totalCount = warnings.length;
  const highCount = warnings.filter(w => w.severity === 'HIGH').length;
  const reviewCount = warnings.filter(w => w.severity === 'REVIEW').length;
  const resolvedCount = warnings.filter(w => resolvedIds.has(w.id)).length;

  // Grouped by Rule
  const groupedByRule = useMemo(() => {
    const groups = new Map<string, { ruleCode: string; ruleName: string; severity: Severity; items: EnrichedAuditWarning[] }>();
    filteredWarnings.forEach(w => {
      const code = w.ruleCode;
      if (!groups.has(code)) {
        groups.set(code, {
          ruleCode: code,
          ruleName: ruleNameMap.get(code) || w.clause || 'Quy tắc kiểm định',
          severity: w.severity,
          items: []
        });
      }
      groups.get(code)!.items.push(w);
    });
    // Sort HIGH rules first, then by count descending
    return Array.from(groups.values()).sort((a, b) => {
      if (a.severity === 'HIGH' && b.severity !== 'HIGH') return -1;
      if (a.severity !== 'HIGH' && b.severity === 'HIGH') return 1;
      return b.items.length - a.items.length;
    });
  }, [filteredWarnings, ruleNameMap]);

  // Grouped by NCC
  const groupedByNcc = useMemo(() => {
    const groups = new Map<string, { nccCode: string; nccName: string; highCount: number; reviewCount: number; items: EnrichedAuditWarning[] }>();
    filteredWarnings.forEach(w => {
      const code = w.nccCode;
      if (!groups.has(code)) {
        groups.set(code, {
          nccCode: code,
          nccName: nccMap.get(code) || code,
          highCount: 0,
          reviewCount: 0,
          items: []
        });
      }
      const g = groups.get(code)!;
      g.items.push(w);
      if (w.severity === 'HIGH') g.highCount++;
      else g.reviewCount++;
    });
    return Array.from(groups.values()).sort((a, b) => b.highCount - a.highCount || b.items.length - a.items.length);
  }, [filteredWarnings, nccMap]);

  // Grouped by Day
  const groupedByDay = useMemo(() => {
    const groups = new Map<string, { day: string; highCount: number; reviewCount: number; items: EnrichedAuditWarning[] }>();
    filteredWarnings.forEach(w => {
      const dayKey = w.day || 'Khác';
      if (!groups.has(dayKey)) {
        groups.set(dayKey, {
          day: dayKey,
          highCount: 0,
          reviewCount: 0,
          items: []
        });
      }
      const g = groups.get(dayKey)!;
      g.items.push(w);
      if (w.severity === 'HIGH') g.highCount++;
      else g.reviewCount++;
    });
    return Array.from(groups.values());
  }, [filteredWarnings]);

  // Expand / Collapse all accordion sections
  const handleToggleAllSections = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    if (expand) {
      if (viewMode === 'by_rule') groupedByRule.forEach(g => { next[g.ruleCode] = true; });
      if (viewMode === 'by_ncc') groupedByNcc.forEach(g => { next[g.nccCode] = true; });
      if (viewMode === 'by_day') groupedByDay.forEach(g => { next[g.day] = true; });
    }
    setOpenSections(next);
  };

  // Copy formatted Zalo summary
  const handleCopyZaloSummary = () => {
    if (filteredWarnings.length === 0) return;
    const lines: string[] = [
      `📢 BÁO CÁO CẢNH BÁO KIỂM ĐỊNH THỰC ĐƠN VINCONS`,
      `• Tổng số cảnh báo: ${filteredWarnings.length} (🚨 ${filteredWarnings.filter(w => w.severity === 'HIGH').length} HIGH, ⚠️ ${filteredWarnings.filter(w => w.severity === 'REVIEW').length} REVIEW)`,
      `• Đã xử lý/kiểm tra: ${filteredWarnings.filter(w => resolvedIds.has(w.id)).length}/${filteredWarnings.length}`,
      ``
    ];

    if (viewMode === 'by_ncc') {
      groupedByNcc.forEach(g => {
        lines.push(`🏢 NCC ${g.nccCode} - ${g.nccName}: ${g.items.length} cảnh báo (${g.highCount} HIGH, ${g.reviewCount} REVIEW)`);
        g.items.slice(0, 10).forEach(w => {
          lines.push(`  - [${w.severity} | ${w.ruleCode}] ${w.day} (${w.shift}): ${w.dishName}${w.weightRaw ? ` (${w.weightRaw})` : ''} -> ${w.suggestion}`);
        });
        if (g.items.length > 10) lines.push(`  ... và ${g.items.length - 10} mục khác`);
        lines.push(``);
      });
    } else {
      groupedByRule.forEach(g => {
        lines.push(`📌 [${g.ruleCode}] ${g.ruleName}: ${g.items.length} mục (${g.severity})`);
        g.items.slice(0, 8).forEach(w => {
          lines.push(`  - NCC ${w.nccCode} • ${w.day} (${w.shift}): ${w.dishName}${w.weightRaw ? ` (${w.weightRaw})` : ''}`);
        });
        if (g.items.length > 8) lines.push(`  ... và ${g.items.length - 8} mục khác`);
        lines.push(``);
      });
    }

    lines.push(`Ghi chú: Đề nghị NCC điều chỉnh và nộp lại trước hạn quy định.`);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedToast('Đã sao chép báo cáo Zalo vào bộ nhớ tạm!');
    setTimeout(() => setCopiedToast(null), 3000);
  };

  // Mark all filtered as resolved / unresolved
  const handleBatchToggleResolved = () => {
    const allFilteredIds = filteredWarnings.map(w => w.id);
    const allAreResolved = allFilteredIds.every(id => resolvedIds.has(id));
    setResolvedIds(prev => {
      const next = new Set(prev);
      if (allAreResolved) {
        allFilteredIds.forEach(id => next.delete(id));
      } else {
        allFilteredIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const isSectionOpen = (key: string) => {
    // Default open for the first 3 sections if not explicitly set
    return openSections[key] !== undefined ? openSections[key] : true;
  };

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({
      ...prev,
      [key]: !isSectionOpen(key)
    }));
  };

  // Render a single warning item card / row
  const renderWarningItem = (w: EnrichedAuditWarning, isCompact: boolean) => {
    const isResolved = resolvedIds.has(w.id);
    const isExpanded = Boolean(expandedGroupIds[w.id]);
    const nccName = nccMap.get(w.nccCode) || w.nccCode;

    if (isCompact) {
      return (
        <div
          key={w.id}
          className={`px-3 py-2.5 transition-colors flex items-start gap-2.5 text-xs hover:bg-slate-50 ${
            isResolved ? 'bg-slate-50/70 opacity-60' : w.severity === 'HIGH' ? 'bg-rose-50/30' : 'bg-white'
          }`}
        >
          {/* Resolve Checkbox */}
          <button
            type="button"
            onClick={(e) => toggleResolved(w.id, e)}
            title={isResolved ? 'Đã kiểm tra (Bấm để huỷ)' : 'Đánh dấu đã kiểm tra'}
            className={`mt-0.5 min-w-[20px] min-h-[20px] rounded flex items-center justify-center border transition shrink-0 ${
              isResolved
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'border-slate-300 hover:border-slate-500 bg-white'
            }`}
          >
            {isResolved && <Check className="w-3.5 h-3.5 stroke-[3]" />}
          </button>

          {/* Severity & Rule Code */}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
              w.severity === 'HIGH' ? 'bg-rose-600 text-white' : 'bg-amber-400 text-slate-900'
            }`}
          >
            {w.severity}
          </span>

          <span className="font-mono text-[11px] font-semibold text-slate-600 shrink-0">
            {w.ruleCode}
          </span>

          {/* NCC Chip */}
          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px] shrink-0">
            {w.nccCode}
          </span>

          {/* Main info line */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className={`font-semibold ${isResolved ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                {w.dishName}
              </span>
              {w.weightRaw && (
                <span className="text-slate-500 font-mono text-[11px]">
                  ({w.weightRaw})
                </span>
              )}
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 text-[11px]">
                {w.day} ({w.shift}) • {w.rowLabel}
              </span>
            </div>

            <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              <span><strong>Lỗi:</strong> {w.calculation}</span>
              <span className="text-emerald-700"><strong>Gợi ý:</strong> {w.suggestion}</span>
            </div>

            {w.groupedDetails && w.groupedDetails.length > 0 && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setExpandedGroupIds(prev => ({ ...prev, [w.id]: !prev[w.id] }))}
                  className="text-[11px] text-blue-900 font-medium inline-flex items-center gap-1 hover:underline"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" /> Ẩn {w.groupedCount} bữa gộp
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" /> Xem chi tiết {w.groupedCount} bữa gộp
                    </>
                  )}
                </button>
                {isExpanded && (
                  <ul className="mt-1 pl-4 list-disc text-[11px] text-slate-600 space-y-0.5 bg-slate-50 p-2 rounded-lg">
                    {w.groupedDetails.map((d: string, i: number) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    // Comfortable Full Card
    return (
      <div
        key={w.id}
        className={`p-4 transition-colors space-y-2 hover:bg-slate-50/80 ${
          isResolved ? 'bg-slate-50/80 opacity-60' : w.severity === 'HIGH' ? 'bg-rose-50/30' : 'bg-white'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => toggleResolved(w.id, e)}
              title={isResolved ? 'Đã kiểm tra (Bấm để huỷ)' : 'Đánh dấu đã kiểm tra'}
              className={`min-w-[20px] min-h-[20px] rounded flex items-center justify-center border transition ${
                isResolved
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'border-slate-300 hover:border-slate-500 bg-white'
              }`}
            >
              {isResolved && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </button>

            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                w.severity === 'HIGH' ? 'bg-rose-600 text-white' : 'bg-amber-400 text-slate-900'
              }`}
            >
              {w.severity}
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-xs font-semibold">
              {w.ruleCode}
            </span>
            <span className="px-2 py-0.5 rounded bg-blue-900/10 text-blue-900 text-xs font-bold">
              {w.nccCode} - {nccName}
            </span>
            <span className="text-xs font-medium text-slate-600">
              {w.day} • {w.shift} • {w.rowLabel}
            </span>
          </div>

          {isResolved && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" />
              Đã kiểm tra
            </span>
          )}
        </div>

        <div className="text-sm font-semibold text-slate-900">
          <span className={isResolved ? 'line-through text-slate-500' : ''}>
            Món: {w.dishName}
          </span>
          {w.weightRaw && (
            <span className="ml-2 font-normal text-xs text-slate-500">
              (Định lượng gốc: {w.weightRaw})
            </span>
          )}
        </div>

        <div className="text-xs text-slate-700 space-y-0.5">
          <div>
            <strong>Cách tính / Chi tiết:</strong> {w.calculation}
          </div>
          <div>
            <strong>Điều khoản:</strong> {w.clause}
          </div>
          <div className="text-emerald-700 font-medium">
            <strong>Gợi ý sửa:</strong> {w.suggestion}
          </div>
        </div>

        {w.groupedDetails && w.groupedDetails.length > 0 && (
          <div className="pt-1">
            <button
              onClick={() =>
                setExpandedGroupIds(prev => ({ ...prev, [w.id]: !prev[w.id] }))
              }
              className="text-xs text-blue-900 font-medium flex items-center gap-1 hover:underline"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Ẩn danh sách {w.groupedCount} bữa
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Xem chi tiết {w.groupedCount} bữa
                </>
              )}
            </button>
            {isExpanded && (
              <ul className="mt-1.5 pl-4 list-disc text-xs text-slate-600 space-y-0.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                {w.groupedDetails.map((d: string, i: number) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-0">
      {/* Top Header with KPI Counters and Quick Tools */}
      <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-100 text-orange-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                Danh sách cảnh báo kiểm định
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-[#141e42] text-white">
                  {filteredWarnings.length} / {totalCount}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Gom nhóm thông minh • Lọc nhanh theo quy tắc & NCC • Đánh dấu đã kiểm tra
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCopyZaloSummary}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#141e42] hover:bg-blue-900 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition shadow-sm"
              title="Sao chép báo cáo vi phạm để gửi Zalo cho NCC"
            >
              <Copy className="w-3.5 h-3.5 text-orange-400" />
              <span>Sao chép Zalo</span>
            </button>

            {viewMode !== 'flat' && (
              <div className="flex items-center rounded-lg border border-slate-300 bg-white overflow-hidden text-xs font-medium">
                <button
                  type="button"
                  onClick={() => handleToggleAllSections(true)}
                  className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-700 border-r border-slate-200"
                >
                  Mở hết
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleAllSections(false)}
                  className="px-2.5 py-1.5 hover:bg-slate-100 text-slate-700"
                >
                  Thu gọn
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Severity Summary Chips & Resolution Counter */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSeverityFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                severityFilter === 'ALL'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Tất cả ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('HIGH')}
              className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1 transition ${
                severityFilter === 'HIGH'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              HIGH ({highCount})
            </button>
            <button
              type="button"
              onClick={() => setSeverityFilter('REVIEW')}
              className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1 transition ${
                severityFilter === 'REVIEW'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              REVIEW ({reviewCount})
            </button>

            <button
              type="button"
              onClick={() => setHideResolved(!hideResolved)}
              className={`px-2.5 py-1 rounded-lg font-semibold inline-flex items-center gap-1 border transition ${
                hideResolved
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {hideResolved ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{hideResolved ? 'Đang ẩn đã duyệt' : `Đã duyệt (${resolvedCount})`}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBatchToggleResolved}
              className="text-[11px] text-blue-900 hover:underline font-semibold"
            >
              {filteredWarnings.every(w => resolvedIds.has(w.id))
                ? 'Bỏ chọn tất cả'
                : 'Đánh dấu đã kiểm tra tất cả'}
            </button>
          </div>
        </div>

        {/* Search & View Mode Switcher Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Live Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tên món, mã quy tắc (DL-02, MC-04), ngày, NCC..."
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* View Mode Tabs */}
          <div className="flex items-center rounded-lg border border-slate-300 bg-white p-0.5 text-xs font-semibold shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('by_rule')}
              className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition ${
                viewMode === 'by_rule'
                  ? 'bg-[#141e42] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Theo Quy tắc</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('by_ncc')}
              className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition ${
                viewMode === 'by_ncc'
                  ? 'bg-[#141e42] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Theo NCC</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('by_day')}
              className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition ${
                viewMode === 'by_day'
                  ? 'bg-[#141e42] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Theo Ngày</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('flat')}
              className={`px-2.5 py-1 rounded-md inline-flex items-center gap-1.5 transition ${
                viewMode === 'flat'
                  ? 'bg-[#141e42] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Chi tiết</span>
            </button>
          </div>

          {/* Density toggle for flat view */}
          {viewMode === 'flat' && (
            <button
              type="button"
              onClick={() => setCompactFlat(!compactFlat)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 shrink-0"
              title="Đổi giữa dạng thẻ rộng và bảng nén dòng"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
              <span>{compactFlat ? 'Dạng nén' : 'Dạng thẻ'}</span>
            </button>
          )}
        </div>

        {copiedToast && (
          <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{copiedToast}</span>
          </div>
        )}
      </div>

      {/* Main List Content */}
      {filteredWarnings.length === 0 ? (
        <div className="p-10 text-center text-slate-500 text-sm">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <p className="font-semibold text-slate-700">Không có cảnh báo nào khớp với bộ lọc!</p>
          <p className="text-xs text-slate-400 mt-1">
            Hãy thử tìm kiếm từ khoá khác hoặc bỏ bớt các tiêu chí lọc.
          </p>
        </div>
      ) : viewMode === 'by_rule' ? (
        /* MODE 1: GROUP BY RULE ACCORDION */
        <div className="divide-y divide-slate-200">
          {groupedByRule.map(group => {
            const open = isSectionOpen(group.ruleCode);
            const highInGroup = group.items.filter(w => w.severity === 'HIGH').length;
            const distinctNccs = Array.from(new Set(group.items.map(w => w.nccCode)));
            const resolvedInGroup = group.items.filter(w => resolvedIds.has(w.id)).length;

            return (
              <div key={group.ruleCode} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleSection(group.ruleCode)}
                  className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100/80 transition-colors flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-extrabold shrink-0 ${
                        group.severity === 'HIGH'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-400 text-slate-900'
                      }`}
                    >
                      {group.severity}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700 shrink-0">
                      {group.ruleCode}
                    </span>
                    <span className="font-bold text-sm text-slate-900 truncate">
                      {group.ruleName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      {distinctNccs.map(ncc => (
                        <span key={ncc} className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-bold text-[10px]">
                          {ncc}
                        </span>
                      ))}
                    </div>

                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-800 text-xs font-extrabold">
                      {resolvedInGroup > 0 ? `${resolvedInGroup}/` : ''}{group.items.length} món
                    </span>

                    {open ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {open && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {group.items.map(w => renderWarningItem(w, true))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === 'by_ncc' ? (
        /* MODE 2: GROUP BY NCC ACCORDION */
        <div className="divide-y divide-slate-200">
          {groupedByNcc.map(group => {
            const open = isSectionOpen(group.nccCode);
            const resolvedInGroup = group.items.filter(w => resolvedIds.has(w.id)).length;

            return (
              <div key={group.nccCode} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleSection(group.nccCode)}
                  className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100/80 transition-colors flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className="w-8 h-8 rounded-lg bg-[#141e42] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {group.nccCode}
                    </span>
                    <div>
                      <div className="font-bold text-sm text-slate-900">
                        NCC {group.nccCode} – {group.nccName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {group.highCount > 0 && (
                          <span className="text-rose-600 font-bold mr-2">
                            🚨 {group.highCount} lỗi HIGH
                          </span>
                        )}
                        <span className="text-amber-700 font-semibold">
                          ⚠️ {group.reviewCount} lỗi REVIEW
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-extrabold">
                      {resolvedInGroup > 0 ? `${resolvedInGroup}/` : ''}{group.items.length} cảnh báo
                    </span>
                    {open ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {open && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {group.items.map(w => renderWarningItem(w, true))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : viewMode === 'by_day' ? (
        /* MODE 3: GROUP BY DAY ACCORDION */
        <div className="divide-y divide-slate-200">
          {groupedByDay.map(group => {
            const open = isSectionOpen(group.day);
            const resolvedInGroup = group.items.filter(w => resolvedIds.has(w.id)).length;

            return (
              <div key={group.day} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => toggleSection(group.day)}
                  className="w-full px-4 py-3 bg-slate-50/70 hover:bg-slate-100/80 transition-colors flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
                    <span className="font-bold text-sm text-slate-900">
                      {group.day}
                    </span>
                    {group.highCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                        {group.highCount} HIGH
                      </span>
                    )}
                    {group.reviewCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        {group.reviewCount} REVIEW
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2.5 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-extrabold">
                      {resolvedInGroup > 0 ? `${resolvedInGroup}/` : ''}{group.items.length} mục
                    </span>
                    {open ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>

                {open && (
                  <div className="divide-y divide-slate-100 bg-white">
                    {group.items.map(w => renderWarningItem(w, true))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* MODE 4: FLAT LIST (COMPACT ROW OR CARD) */
        <div className="divide-y divide-slate-100">
          {filteredWarnings.map(w => renderWarningItem(w, compactFlat))}
        </div>
      )}
    </div>
  );
}
