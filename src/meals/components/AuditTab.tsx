import React, { useState, useMemo } from 'react';
import {
  ShieldCheck, AlertTriangle, CheckCircle2, Filter, ChevronDown, ChevronUp
} from 'lucide-react';
import {
  AuditResult,
  CustomProhibitedRule,
  NccInfo,
  QuantitativeThresholds,
  RuleGroup,
  Severity,
  WeeklyMenu
} from '../types';
import { PROHIBITED_SUMMER_RULES } from '../ruleConfig';
import { auditWeeklyMenu } from '../auditEngine';
import AuditWarningManager from './AuditWarningManager';

interface AuditTabProps {
  nccList: NccInfo[];
  menus: WeeklyMenu[];
  severityOverrides: Record<string, Severity>;
  onToggleRuleSeverity: (code: string, current: Severity) => void;
  quantitativeThresholds: QuantitativeThresholds;
  onUpdateThresholds: (next: QuantitativeThresholds) => void;
  customRules: CustomProhibitedRule[];
  onUpdateCustomRules: (next: CustomProhibitedRule[]) => void;
}

export default function AuditTab({
  nccList,
  menus,
  severityOverrides,
  onToggleRuleSeverity,
  quantitativeThresholds,
  onUpdateThresholds,
  customRules,
  onUpdateCustomRules
}: AuditTabProps) {
  const weeks = useMemo(() => {
    const set = new Set<string>();
    menus.forEach(m => {
      if (m.tuanTu && m.tuanDen) set.add(`${m.tuanTu} - ${m.tuanDen}`);
    });
    return Array.from(set);
  }, [menus]);

  const [selectedWeek, setSelectedWeek] = useState<string>(() => weeks[0] || 'ALL');
  const [selectedNcc, setSelectedNcc] = useState<string>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | Severity>('ALL');
  const [groupFilter, setGroupFilter] = useState<'ALL' | RuleGroup>('ALL');
  const [expandedGroupIds, setExpandedGroupIds] = useState<Record<string, boolean>>({});

  const filteredMenus = useMemo(() => {
    return menus.filter(m => {
      const wStr = `${m.tuanTu} - ${m.tuanDen}`;
      if (selectedWeek !== 'ALL' && weeks.includes(selectedWeek) && wStr !== selectedWeek) {
        return false;
      }
      if (selectedNcc !== 'ALL' && m.ncc !== selectedNcc) {
        return false;
      }
      return true;
    });
  }, [menus, selectedWeek, selectedNcc, weeks]);

  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleKeywords, setNewRuleKeywords] = useState('');
  const [newRuleSeverity, setNewRuleSeverity] = useState<Severity>('HIGH');

  const handleAddCustomRule = () => {
    const name = newRuleName.trim();
    const keywords = newRuleKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);
    if (!name || keywords.length === 0) return;
    onUpdateCustomRules([
      ...customRules,
      {
        id: `bs-${Date.now()}`,
        name,
        keywords,
        severity: newRuleSeverity,
        enabled: true
      }
    ]);
    setNewRuleName('');
    setNewRuleKeywords('');
  };

  const auditResults: AuditResult[] = useMemo(() => {
    return filteredMenus.map(m =>
      auditWeeklyMenu(m, severityOverrides, menus, quantitativeThresholds, customRules)
    );
  }, [filteredMenus, severityOverrides, menus, quantitativeThresholds, customRules]);

  const activeResult = auditResults[0] || null;

  const displayedWarnings = useMemo(() => {
    const all = auditResults.flatMap(r =>
      r.warnings.map(w => ({ ...w, nccCode: r.ncc, loai: r.loai }))
    );
    return all.filter(w => {
      if (severityFilter !== 'ALL' && w.severity !== severityFilter) return false;
      if (groupFilter !== 'ALL' && w.group !== groupFilter) return false;
      return true;
    });
  }, [auditResults, severityFilter, groupFilter]);

  if (menus.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
        <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-700">Chưa có thực đơn để kiểm định</h3>
        <p className="text-sm text-slate-500 mt-1">
          Vui lòng tải lên và xác nhận thực đơn ở tab <strong>Thực đơn</strong> trước.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Tuần kiểm định</label>
          <select
            value={selectedWeek}
            onChange={e => setSelectedWeek(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium"
          >
            <option value="ALL">Tất cả các tuần</option>
            {weeks.map(w => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Nhà cung cấp</label>
          <select
            value={selectedNcc}
            onChange={e => setSelectedNcc(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium"
          >
            <option value="ALL">Tất cả NCC ({auditResults.length})</option>
            {nccList.map(n => (
              <option key={n.code} value={n.code}>
                {n.code} - {n.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        {/* Severity Filter */}
        <div className="flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-slate-400 mr-1" />
          {(['ALL', 'HIGH', 'REVIEW'] as const).map(sev => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                severityFilter === sev
                  ? sev === 'HIGH'
                    ? 'bg-rose-600 text-white'
                    : sev === 'REVIEW'
                    ? 'bg-amber-500 text-white'
                    : 'bg-blue-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {sev === 'ALL' ? 'Tất cả mức' : sev}
            </button>
          ))}
        </div>
      </div>

      {/* Group Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'ALL', label: 'Tất cả nhóm' },
          { id: 'mon_cam', label: 'Món cấm mùa hè' },
          { id: 'dinh_luong', label: 'Định lượng' },
          { id: 'ga_vit_ca', label: 'Gà / Vịt / Cá' },
          { id: 'che_bien', label: 'Chế biến & Đa dạng' },
          { id: 'trung_mon', label: 'Trùng món' }
        ].map(g => (
          <button
            key={g.id}
            onClick={() => setGroupFilter(g.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
              groupFilter === g.id
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* 2-Column Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Editable Quantitative Thresholds & 23 Prohibited Dishes */}
        <div className="lg:col-span-4 space-y-5">
          {/* Editable Quantitative Thresholds */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-[#141e42] text-white font-semibold text-sm">
              Bảng định lượng tối thiểu
            </div>
            <div className="divide-y divide-slate-100 text-xs">
              {[
                { key: 'monChinhMin' as const, label: 'Món chính (r1, r2)', unit: 'g' },
                { key: 'monPhuMin' as const, label: 'Món phụ (r3)', unit: 'g' },
                { key: 'rauMin' as const, label: 'Rau (r4)', unit: 'g' },
                { key: 'canhMin' as const, label: 'Canh (r5)', unit: 'ml' },
                { key: 'comMin' as const, label: 'Cơm (r6)', unit: 'g' }
              ].map(row => (
                <div
                  key={row.key}
                  className="px-4 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">≥</span>
                    <input
                      type="number"
                      min={0}
                      value={quantitativeThresholds[row.key]}
                      onChange={e =>
                        onUpdateThresholds({
                          ...quantitativeThresholds,
                          [row.key]: Number(e.target.value) || 0
                        })
                      }
                      className="w-16 px-2 py-1 text-right font-bold text-blue-900 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:border-blue-900 focus:outline-none"
                    />
                    <span className="text-slate-500 w-5">{row.unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 23 Prohibited Summer Dishes Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-[#141e42] text-white font-semibold text-sm">
              Quy tắc 23 món cấm mùa hè
            </div>
            <div className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto text-xs">
              {PROHIBITED_SUMMER_RULES.map(r => {
                const sev = severityOverrides[r.code] || r.defaultSeverity;
                return (
                  <div
                    key={r.code}
                    className="px-3.5 py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50"
                  >
                    <div className="leading-snug">
                      <span className="font-mono font-bold text-slate-700 mr-1.5">{r.code}</span>
                      <span className="text-slate-700">{r.name}</span>
                    </div>
                    <button
                      onClick={() => onToggleRuleSeverity(r.code, sev)}
                      className={`px-2 py-0.5 rounded font-bold shrink-0 text-[11px] ${
                        sev === 'HIGH'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-400 text-slate-900'
                      }`}
                      title="Bấm để đổi mức HIGH / REVIEW"
                    >
                      {sev}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Separate Custom Additional Rules Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-[#141e42] text-white font-semibold text-sm">
              Quy tắc bổ sung (Tuỳ chỉnh)
            </div>
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2 text-xs">
              <input
                type="text"
                placeholder="Tên quy tắc (vd: Cấm mắm tôm)"
                value={newRuleName}
                onChange={e => setNewRuleName(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
              />
              <input
                type="text"
                placeholder="Từ khoá, cách nhau dấu phẩy (vd: mắm tôm, bún đậu)"
                value={newRuleKeywords}
                onChange={e => setNewRuleKeywords(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
              />
              <div className="flex items-center justify-between gap-2">
                <select
                  value={newRuleSeverity}
                  onChange={e => setNewRuleSeverity(e.target.value as Severity)}
                  className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="HIGH">HIGH</option>
                  <option value="REVIEW">REVIEW</option>
                </select>
                <button
                  onClick={handleAddCustomRule}
                  className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  + Thêm quy tắc
                </button>
              </div>
            </div>

            {customRules.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Chưa có quy tắc bổ sung nào.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {customRules.map(cr => (
                  <div
                    key={cr.id}
                    className="px-3.5 py-2.5 flex items-start justify-between gap-2 hover:bg-slate-50"
                  >
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cr.enabled}
                        onChange={() =>
                          onUpdateCustomRules(
                            customRules.map(item =>
                              item.id === cr.id ? { ...item, enabled: !item.enabled } : item
                            )
                          )
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">{cr.name}</div>
                        <div className="text-[11px] text-slate-500">
                          Từ khoá: {cr.keywords.join(', ')}
                        </div>
                      </div>
                    </label>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() =>
                          onUpdateCustomRules(
                            customRules.map(item =>
                              item.id === cr.id
                                ? {
                                    ...item,
                                    severity: item.severity === 'HIGH' ? 'REVIEW' : 'HIGH'
                                  }
                                : item
                            )
                          )
                        }
                        className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                          cr.severity === 'HIGH'
                            ? 'bg-rose-600 text-white'
                            : 'bg-amber-400 text-slate-900'
                        }`}
                      >
                        {cr.severity}
                      </button>
                      <button
                        onClick={() =>
                          onUpdateCustomRules(customRules.filter(item => item.id !== cr.id))
                        }
                        className="p-1 text-rose-500 hover:text-rose-700 font-bold"
                        title="Xoá quy tắc"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Comparison Table & Warnings List */}
        <div className="lg:col-span-8 space-y-6">
          {/* Comparison Table across NCCs */}
          {auditResults.length > 1 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-[#141e42] text-white font-semibold text-sm">
            Bảng so sánh các NCC
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-3">NCC</th>
                  <th className="p-3">Loại</th>
                  <th className="p-3 text-center">Điểm</th>
                  <th className="p-3 text-center">HIGH</th>
                  <th className="p-3 text-center">REVIEW</th>
                  <th className="p-3 text-center">Gà (Trưa/Tối)</th>
                  <th className="p-3 text-center">Vịt</th>
                  <th className="p-3 text-center">Bánh mì sáng</th>
                  <th className="p-3 text-center">Chính &lt;75g</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditResults.map(r => {
                  const nccInfo = nccList.find(n => n.code === r.ncc);
                  return (
                    <tr
                      key={r.menuId}
                      onClick={() => setSelectedNcc(r.ncc)}
                      className="hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="p-3 font-semibold text-blue-900">
                        {r.ncc} - {nccInfo?.name || r.ncc}
                      </td>
                      <td className="p-3">{r.loai === 'chay' ? 'Chay' : 'Mặn'}</td>
                      <td className="p-3 text-center font-bold text-base">
                        <span
                          className={
                            r.totalScore >= 80
                              ? 'text-emerald-600'
                              : r.totalScore >= 60
                              ? 'text-amber-600'
                              : 'text-rose-600'
                          }
                        >
                          {r.totalScore}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold">
                          {r.highCount}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">
                          {r.reviewCount}
                        </span>
                      </td>
                      <td className="p-3 text-center">{r.stats.chickenMeals}/3</td>
                      <td className="p-3 text-center">{r.stats.duckMeals}/3</td>
                      <td className="p-3 text-center">{r.stats.breadBreakfasts}/2</td>
                      <td className="p-3 text-center">{r.stats.underweightMainCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Single NCC Score & Passed Summary */}
      {activeResult && auditResults.length === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-500">Điểm kiểm định</div>
              <div className="text-3xl font-bold text-blue-900 mt-1">
                {activeResult.totalScore} <span className="text-base font-normal text-slate-400">/ 100</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 text-xs font-bold">
                  {activeResult.highCount} HIGH
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-bold">
                  {activeResult.reviewCount} REVIEW
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Các tiêu chí Đạt ({activeResult.passedItems.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {activeResult.passedItems.map((item, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Advanced Interactive Warning Manager */}
      <AuditWarningManager
        warnings={displayedWarnings as any}
        nccList={nccList}
        expandedGroupIds={expandedGroupIds}
        setExpandedGroupIds={setExpandedGroupIds}
      />
        </div>
      </div>
    </div>
  );
}
