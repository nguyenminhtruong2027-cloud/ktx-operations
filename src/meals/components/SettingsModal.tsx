import React, { useState, useRef } from 'react';
import {
  X, Download, Upload, Play, CheckCircle2, XCircle, Plus, Trash2, Settings
} from 'lucide-react';
import { AppSettings, KtxZone, NccInfo, Severity } from '../types';
import { PROHIBITED_SUMMER_RULES } from '../ruleConfig';
import { runSelfTests, SelfTestCase } from '../auditEngine';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (next: AppSettings) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
}

export default function SettingsModal({
  open,
  onClose,
  settings,
  onUpdateSettings,
  onExportBackup,
  onImportBackup
}: SettingsModalProps) {
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [testResults, setTestResults] = useState<SelfTestCase[] | null>(null);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newKtx, setNewKtx] = useState<KtxZone>('KTX1');

  if (!open) return null;

  const handleAddNcc = () => {
    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    if (!code || !name) return;
    if (settings.nccList.some(n => n.code === code)) return;
    onUpdateSettings({
      ...settings,
      nccList: [...settings.nccList, { code, name, ktx: newKtx }]
    });
    setNewCode('');
    setNewName('');
  };

  const handleRemoveNcc = (code: string) => {
    onUpdateSettings({
      ...settings,
      nccList: settings.nccList.filter(n => n.code !== code)
    });
  };

  const toggleRuleSeverity = (code: string, current: Severity) => {
    const next: Severity = current === 'HIGH' ? 'REVIEW' : 'HIGH';
    onUpdateSettings({
      ...settings,
      ruleSeverityOverrides: {
        ...settings.ruleSeverityOverrides,
        [code]: next
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        <div className="px-6 py-4 bg-[#141e42] text-white flex items-center justify-between">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-400" />
            Cài đặt hệ thống & Tự kiểm
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Backup & Restore + Self Test */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onExportBackup}
                className="px-3.5 py-2 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Xuất sao lưu JSON
              </button>
              <button
                onClick={() => backupInputRef.current?.click()}
                className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
              >
                <Upload className="w-4 h-4" /> Nhập sao lưu
              </button>
              <input
                ref={backupInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onImportBackup(f);
                }}
              />
            </div>

            <button
              onClick={() => setTestResults(runSelfTests())}
              className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Play className="w-4 h-4" /> Chạy tự kiểm
            </button>
          </div>

          {/* Self-test results */}
          {testResults && (
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
                Kết quả tự kiểm ({testResults.filter(t => t.passed).length}/{testResults.length} PASS)
              </div>
              <div className="divide-y divide-slate-100">
                {testResults.map((t, idx) => (
                  <div key={idx} className="py-2 flex items-start gap-2.5">
                    {t.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-medium text-slate-800 text-xs">{t.name}</div>
                      <div className="text-[11px] text-slate-500">{t.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unit Price */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Đơn giá suất ăn (VNĐ)
            </label>
            <input
              type="number"
              value={settings.unitPrice}
              onChange={e =>
                onUpdateSettings({ ...settings, unitPrice: Number(e.target.value) || 0 })
              }
              className="w-48 px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-semibold"
            />
          </div>

          {/* NCC Management */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-slate-700 uppercase">
              Danh sách Nhà cung cấp ({settings.nccList.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {settings.nccList.map(n => (
                <div
                  key={n.code}
                  className="p-2.5 rounded-lg border border-slate-200 flex items-center justify-between bg-slate-50"
                >
                  <div>
                    <span className="font-bold text-blue-900 mr-1.5">{n.code}</span>
                    <span className="font-medium text-slate-800">{n.name}</span>
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                      {n.ktx}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveNcc(n.code)}
                    className="text-rose-500 hover:text-rose-700 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Mã (vd: AB)"
                value={newCode}
                onChange={e => setNewCode(e.target.value)}
                className="w-24 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
              <input
                type="text"
                placeholder="Tên nhà cung cấp"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="flex-1 min-w-[160px] px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              />
              <select
                value={newKtx}
                onChange={e => setNewKtx(e.target.value as KtxZone)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
              >
                <option value="KTX1">KTX1</option>
                <option value="KTX2">KTX2</option>
              </select>
              <button
                onClick={handleAddNcc}
                className="px-3 py-1.5 rounded-lg bg-blue-900 text-white text-xs font-semibold flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm NCC
              </button>
            </div>
          </div>

          {/* 23 Prohibited Summer Dishes Severity Config */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700 uppercase">
              Cấu hình mức cảnh báo Danh mục 23 món cấm mùa hè
            </div>
            <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {PROHIBITED_SUMMER_RULES.map(r => {
                const sev = settings.ruleSeverityOverrides[r.code] || r.defaultSeverity;
                return (
                  <div
                    key={r.code}
                    className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-slate-700 mr-2">{r.code}</span>
                      <span className="text-slate-800">{r.name}</span>
                    </div>
                    <button
                      onClick={() => toggleRuleSeverity(r.code, sev)}
                      className={`px-2.5 py-0.5 rounded font-bold shrink-0 ${
                        sev === 'HIGH'
                          ? 'bg-rose-600 text-white'
                          : 'bg-amber-400 text-slate-900'
                      }`}
                    >
                      {sev}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
