import React, { useState, useEffect } from 'react';
import { Utensils, ShieldCheck, FileText, Settings, BarChart3 } from 'lucide-react';
import {
  AppSettings,
  DishOverrideEntry,
  MealCountEntry,
  WeeklyMenu
} from './types';
import { DEFAULT_NCC_LIST, QUANTITATIVE_THRESHOLDS } from './ruleConfig';
import MenuUploadTab from './components/MenuUploadTab';
import AuditTab from './components/AuditTab';
import ReportTab from './components/ReportTab';
import StatisticsWorkspaceTab from './components/StatisticsWorkspaceTab';
import SettingsModal from './components/SettingsModal';

const STORAGE_KEYS = {
  MENUS: 'meals_v2_menus',
  COUNTS: 'meals_v2_counts',
  OVERRIDES: 'meals_v2_overrides',
  SETTINGS: 'meals_v2_settings'
};

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function MealsModule() {
  const [activeTab, setActiveTab] = useState<'menu' | 'audit' | 'report' | 'stats'>('menu');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [menus, setMenus] = useState<WeeklyMenu[]>(() =>
    loadJSON<WeeklyMenu[]>(STORAGE_KEYS.MENUS, [])
  );

  const [mealCounts, setMealCounts] = useState<Record<string, MealCountEntry>>(() =>
    loadJSON<Record<string, MealCountEntry>>(STORAGE_KEYS.COUNTS, {})
  );

  const [dishOverrides, setDishOverrides] = useState<Record<string, DishOverrideEntry>>(() =>
    loadJSON<Record<string, DishOverrideEntry>>(STORAGE_KEYS.OVERRIDES, {})
  );

  const [settings, setSettings] = useState<AppSettings>(() =>
    loadJSON<AppSettings>(STORAGE_KEYS.SETTINGS, {
      nccList: DEFAULT_NCC_LIST,
      unitPrice: 40000,
      ruleSeverityOverrides: {},
      columnLabels: ['TĐ 8', 'TĐ 11.1', 'TĐ 11.3', 'ME']
    })
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MENUS, JSON.stringify(menus));
  }, [menus]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.COUNTS, JSON.stringify(mealCounts));
  }, [mealCounts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.OVERRIDES, JSON.stringify(dishOverrides));
  }, [dishOverrides]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  const handleSaveMenu = (menu: WeeklyMenu) => {
    setMenus(prev => {
      const filtered = prev.filter(
        m =>
          m.id !== menu.id &&
          !(m.ncc === menu.ncc && m.tuanTu === menu.tuanTu && m.loai === menu.loai)
      );
      return [menu, ...filtered];
    });
  };

  const handleDeleteMenu = (id: string) => {
    setMenus(prev => prev.filter(m => m.id !== id));
  };

  const handleUpdateMealCount = (key: string, entry: MealCountEntry) => {
    setMealCounts(prev => ({ ...prev, [key]: entry }));
  };

  const handleUpdateDishOverride = (key: string, entry: DishOverrideEntry | null) => {
    setDishOverrides(prev => {
      const next = { ...prev };
      if (entry === null) {
        delete next[key];
      } else {
        next[key] = entry;
      }
      return next;
    });
  };

  const handleExportBackup = () => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      menus,
      mealCounts,
      dishOverrides,
      settings
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meals-v2-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data.menus)) setMenus(data.menus);
      if (data.mealCounts) setMealCounts(data.mealCounts);
      if (data.dishOverrides) setDishOverrides(data.dishOverrides);
      if (data.settings) setSettings(data.settings);
      setSettingsOpen(false);
    } catch {
      alert('File sao lưu JSON không hợp lệ.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Sub-Navigation & Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-sm flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap gap-1.5">
          {[
            { id: 'menu' as const, label: 'Thực đơn', icon: Utensils },
            { id: 'audit' as const, label: 'Kiểm định', icon: ShieldCheck },
            { id: 'report' as const, label: 'Báo cáo', icon: FileText },
            { id: 'stats' as const, label: 'Thống kê số liệu', icon: BarChart3 }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors ${
                  active
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <button
          onClick={() => setSettingsOpen(true)}
          className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors"
          title="Cài đặt & Tự kiểm"
        >
          <Settings className="w-4 h-4 text-blue-900" />
          Cài đặt
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'menu' && (
        <MenuUploadTab
          nccList={settings.nccList}
          menus={menus}
          onSaveMenu={handleSaveMenu}
          onDeleteMenu={handleDeleteMenu}
        />
      )}

      {activeTab === 'audit' && (
        <AuditTab
          nccList={settings.nccList}
          menus={menus}
          severityOverrides={settings.ruleSeverityOverrides}
          onToggleRuleSeverity={(code, current) => {
            const next = current === 'HIGH' ? 'REVIEW' : 'HIGH';
            setSettings(prev => ({
              ...prev,
              ruleSeverityOverrides: {
                ...prev.ruleSeverityOverrides,
                [code]: next
              }
            }));
          }}
          quantitativeThresholds={settings.quantitativeThresholds || QUANTITATIVE_THRESHOLDS}
          onUpdateThresholds={next =>
            setSettings(prev => ({ ...prev, quantitativeThresholds: next }))
          }
          customRules={settings.customRules || []}
          onUpdateCustomRules={next =>
            setSettings(prev => ({ ...prev, customRules: next }))
          }
        />
      )}

      {activeTab === 'report' && (
        <ReportTab
          nccList={settings.nccList}
          onUpdateNccList={next =>
            setSettings(prev => ({ ...prev, nccList: next }))
          }
          menus={menus}
          unitPrice={settings.unitPrice}
          severityOverrides={settings.ruleSeverityOverrides}
          columnLabels={settings.columnLabels || ['TĐ 8', 'TĐ 11.1', 'TĐ 11.3', 'ME']}
          onUpdateColumnLabels={next =>
            setSettings(prev => ({ ...prev, columnLabels: next }))
          }
          mealCounts={mealCounts}
          onUpdateMealCount={handleUpdateMealCount}
          dishOverrides={dishOverrides}
          onUpdateDishOverride={handleUpdateDishOverride}
        />
      )}

      {activeTab === 'stats' && (
        <StatisticsWorkspaceTab
          nccList={settings.nccList}
          menus={menus}
          unitPrice={settings.unitPrice}
          columnLabels={settings.columnLabels || ['TĐ 8', 'TĐ 11.1', 'TĐ 11.3', 'ME']}
          mealCounts={mealCounts}
          onUpdateMealCount={handleUpdateMealCount}
          onNavigateToReport={() => setActiveTab('report')}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
      />
    </div>
  );
}
