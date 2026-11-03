import React, { useState, useEffect, useMemo } from 'react';
import {
  MealVendor,
  PortionRule,
  DayWeeklyMenu,
  EvaluationWarning,
  ShiftMealDetail,
  WeeklyMenuArchive,
  UploadedMenuFile,
  DishDuplicateItem,
  KtxZones,
  KtxZoneKey,
  SupplierMenuDB,
  VendorPortionTrio
} from './types';
import {
  INITIAL_MEAL_VENDORS,
  INITIAL_PORTION_RULES,
  PROHIBITED_SUMMER_DISHES,
  TAM_PHUONG_WEEKLY_MENU,
  INITIAL_WEEKLY_ARCHIVES,
  DEFAULT_KTX_ZONES
} from './vinhomesMenuData';
import {
  bootstrapSupplierMenuDB,
  dayIndexFromDate,
  getShiftDetail,
  getVendorWeekAsDayWeeklyMenu,
  hasPersistedStore,
  importWeeklyMenu,
  loadStore,
  saveStore,
  portionCheckVendorWeek,
  shiftKeyFromDayKey,
  shiftKeyFromShiftName,
  upsertShift
} from './supplierMenuStore';
import RealtimeClock from '../components/RealtimeClock';
import { evaluateMenuWeekly, detectDuplicateDishes } from './ruleEngine';
import {
  formatISODate,
  formatDMY,
  parseDateSafe,
  getMondayOfDate,
  getDateOfDayInWeek,
  getWeekDaysInfo,
  getWeekRangeStr,
  DAY_NAMES
} from './dateUtils';
import {
  Utensils, LayoutDashboard, FileText, CalendarDays, ShieldCheck, BarChart3,
  Plus, Minus, Search, Filter, Download, Upload, Copy, Check, AlertTriangle, RefreshCw,
  Edit3, Trash2, CheckCircle2, ChevronRight, ChevronLeft, Calendar, Sparkles, Settings,
  Share2, ArrowRight, X, SlidersHorizontal, Camera, FileCheck, Layers, Info, History,
  AlertCircle, FileSpreadsheet, Eye, ChevronDown, ChevronUp, LayoutGrid, List, Store,
  FolderOpen
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { ShiftSelector, ShiftName } from './components/ShiftSelector';
import { SupplierChips } from './components/SupplierChips';
import { MenuColumn } from './components/MenuColumn';
import { ReportBuilder } from './components/ReportBuilder';
import { WeeklyMenuTable } from './components/WeeklyMenuTable';
import { generateVendorReportText, generateKtxGroupReportText, generateZaloReportText } from './reportGenerator';
import MenuUploadWizard from './components/MenuUploadWizard';
import type { WizardApplyPayload } from './components/MenuUploadWizard';
import VendorWorkspace from './components/VendorWorkspace';
import SupplierFileArchive from './components/SupplierFileArchive';
import MenuFilePanel from './components/MenuFilePanel';
import { broadcastMenuSync, subscribeMenuSync } from './menuSyncBus';
import {
  startCloudSync,
  getCloudStatus,
  mergeSupplierMenus,
  mergeArchives,
  type CloudSyncStatus
} from './cloudSync';
import type { VendorPortionCheckResult } from './supplierMenuStore';
import {
  APPLY_MODES,
  discardUndoSnapshot,
  peekUndoSnapshot,
  popUndoSnapshot,
  saveUndoSnapshot,
  parsedDaysToWeeklyMenu
} from './menuApplyService';
import {
  parseExcelOrCsvFile,
  parsePlainTextMenu,
  makeSheetSnapshot,
  parseWithManualMap,
  matchDishBucket,
  StructuredFileError,
  type ParseResult,
  type SheetSnapshot,
  type ManualColumnMap,
  type FileIssueCode
} from './menuFileParser';
import { extractDishPortions, isVegetarianDish } from './menuNormalization';
import { extractMenuWithGemini, GeminiExtractError } from './geminiMenuService';
import { Undo2 } from 'lucide-react';

const STORAGE_KEYS = {
  VENDORS: 'meals_vendors_cache_v11',
  WEEKLY_MENU: 'meals_weekly_menu_cache_v11',
  RULES: 'meals_portion_rules_v11',
  ARCHIVES: 'meals_weekly_archives_v11',
  WEEK_START: 'meals_week_start_cache_v11',
  MEALS_BY_VENDOR: 'meals_custom_by_vendor_v11'
};

export default function MealsApp() {
  const [activeTab, setActiveTab] = useState<'overview' | 'report' | 'menu' | 'vendor' | 'evaluation' | 'statistics'>('report');

  // Single source of truth for the active week start date (Thứ 2 - YYYY-MM-DD)
  // Mặc định = ngày hệ thống (Thứ 2 của tuần hiện tại)
  const [weekStartDate, setWeekStartDate] = useState<string>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.WEEK_START);
    if (raw) return raw;
    return formatISODate(getMondayOfDate(new Date()));
  });

  // Vendors state (Single source of truth for 7 vendors and their portions)
  const [vendors, setVendors] = useState<MealVendor[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.VENDORS);
    return raw ? JSON.parse(raw) : INITIAL_MEAL_VENDORS;
  });

  // Current Active Weekly Menu (21 shifts)
  // MA TRẬN KIỂM ĐỊNH (inspectionMatrix) — bảng tuần dùng chung cho tab Kiểm định,
  // KHÔNG phải thực đơn của NCC nào. Thực đơn riêng từng NCC nằm trong CSDL supplier_menus.
  const [inspectionMatrix, setInspectionMatrix] = useState<DayWeeklyMenu[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.WEEKLY_MENU);
    if (!raw) return TAM_PHUONG_WEEKLY_MENU;
    try {
      const parsed = JSON.parse(raw);
      // Migrate: Ensure dateStr of each day in inspectionMatrix matches calculated date from weekStartDate
      const daysInfo = getWeekDaysInfo(localStorage.getItem(STORAGE_KEYS.WEEK_START) || '2026-10-26');
      return parsed.map((item: DayWeeklyMenu, idx: number) => ({
        ...item,
        dayOfWeek: daysInfo[idx]?.dayOfWeek || item.dayOfWeek,
        dateStr: daysInfo[idx]?.dateStr || item.dateStr
      }));
    } catch {
      return TAM_PHUONG_WEEKLY_MENU;
    }
  });

  // Portion Rules state
  const [rules, setRules] = useState<PortionRule[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.RULES);
    return raw ? JSON.parse(raw) : INITIAL_PORTION_RULES;
  });

  // Danh sách các file thực đơn đã tải lên (Lưu trữ và quản lý theo ngày tháng)
  const [archives, setArchives] = useState<UploadedMenuFile[]>(() => {
    const raw = localStorage.getItem(STORAGE_KEYS.ARCHIVES);
    if (!raw) return INITIAL_WEEKLY_ARCHIVES;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].fileName) {
        return parsed;
      }
      return INITIAL_WEEKLY_ARCHIVES;
    } catch {
      return INITIAL_WEEKLY_ARCHIVES;
    }
  });

  // ID của file thực đơn đang được chọn để nạp và kiểm định
  const [selectedFileId, setSelectedFileId] = useState<string>(() => {
    const active = archives.find(f => f.isActive);
    return active ? active.id : (archives[0]?.id || 'file-2026-10-26');
  });

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WEEK_START, weekStartDate);
  }, [weekStartDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(vendors));
  }, [vendors]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WEEKLY_MENU, JSON.stringify(inspectionMatrix));
  }, [inspectionMatrix]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules));
  }, [rules]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ARCHIVES, JSON.stringify(archives));
  }, [archives]);

  // Report & Shift State (ONLY used in Tab 'report')
  const [reportShift, setReportShift] = useState<'Bữa sáng' | 'Bữa trưa' | 'Bữa tối'>('Bữa tối');
  // Mặc định ngày báo cáo = NGÀY HỆ THỐNG (nếu nằm trong tuần đang chọn)
  const [reportDate, setReportDate] = useState<string>(() => {
    const monday = parseDateSafe(
      localStorage.getItem(STORAGE_KEYS.WEEK_START) || formatISODate(getMondayOfDate(new Date()))
    );
    const now = new Date();
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diff = Math.round((today0 - monday.getTime()) / 86400000);
    return diff >= 0 && diff <= 6 ? formatISODate(now) : formatISODate(monday);
  });
  const [selectedVendorsForReport, setSelectedVendorsForReport] = useState<string[]>(() => INITIAL_MEAL_VENDORS.map(v => v.id));
  const [quickFillColumn, setQuickFillColumn] = useState<'td8' | 'td11_1' | 'td11_3'>('td8');

  // NCC đang được chọn để xem/sửa món ở Khối 2 Tab Báo cáo
  const [activeVendorForEdit, setActiveVendorForEdit] = useState<string>('tam-phuong');

  // Không gian NCC: NCC đang quản lý trong phân khu riêng
  const [activeWorkspaceVendorId, setActiveWorkspaceVendorId] = useState<string>('tam-phuong');

  // ===================== CSDL supplier_menus (NGUỒN SỰ THẬT DUY NHẤT) =====================
  const [supplierMenus, setSupplierMenus] = useState<SupplierMenuDB>(() => loadStore());

  useEffect(() => {
    saveStore(supplierMenus);
  }, [supplierMenus]);

  // ===== EVENT BUS: đồng bộ realtime giữa các tab/cửa sổ khi dữ liệu thực đơn thay đổi =====
  // Trong app: mọi tab cùng cây React tự cập nhật ngay (React state); liên cửa sổ/module khác:
  // lắng nghe tín hiệu bus + 'storage' rồi nạp lại từ localStorage (CHỈ ĐỌC — không ghi/xóa gì).
  useEffect(() => {
    return subscribeMenuSync((kind, fromSelf) => {
      if (fromSelf) return;
      if (kind === 'supplier_menus' || kind === 'menu-apply') {
        setSupplierMenus(loadStore());
      }
      if (kind === 'archives' || kind === 'menu-apply') {
        try {
          const raw = localStorage.getItem(STORAGE_KEYS.ARCHIVES);
          if (raw) setArchives(JSON.parse(raw));
        } catch { /* ignore */ }
      }
    });
  }, []);

  // Panel Quản lý Tệp thực đơn — mở được từ MỌI tab (nút ở header khu làm việc)
  const [menuFilePanelOpen, setMenuFilePanelOpen] = useState(false);

  // ===== B3: ĐỒNG BỘ ĐÁM MÂY (Firestore hybrid — fallback an toàn về localStorage) =====
  // Merge 1 chiều, không bao giờ làm mất dữ liệu cục bộ; khi Firebase chưa cấu hình/mất mạng
  // thì app vẫn chạy hoàn toàn trên localStorage như trước.
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>(() => getCloudStatus());
  useEffect(() => {
    const stop = startCloudSync({
      onSupplierMenus: (remote) => setSupplierMenus(prev => mergeSupplierMenus(prev, remote)),
      onArchives: (remote) => setArchives(prev => mergeArchives(prev, remote))
    });
    setCloudStatus(getCloudStatus());
    const timer = setInterval(() => setCloudStatus(getCloudStatus()), 30000);
    return () => {
      clearInterval(timer);
      stop();
    };
  }, []);

  // Phân khu KTX động (người dùng tự tích chọn — không còn gán cứng)
  const [ktxZones, setKtxZones] = useState<KtxZones>(() => {
    try {
      const raw = localStorage.getItem('meals_ktx_zones_v12');
      if (raw) return JSON.parse(raw);
    } catch { /* fallback */ }
    return JSON.parse(JSON.stringify(DEFAULT_KTX_ZONES));
  });

  useEffect(() => {
    try { localStorage.setItem('meals_ktx_zones_v12', JSON.stringify(ktxZones)); } catch { /* ignore */ }
  }, [ktxZones]);

  // Bootstrap 1 lần: dựng CSDL từ dữ liệu cũ (key v11) nếu chưa có
  useEffect(() => {
    if (hasPersistedStore()) return;
    let oldMealsByVendor: Record<string, ShiftMealDetail> = {};
    try {
      oldMealsByVendor = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEALS_BY_VENDOR) || 'null') || {};
    } catch { /* ignore */ }
    setSupplierMenus(bootstrapSupplierMenuDB({
      weekStart: weekStartDate,
      defaultShiftName: reportShift,
      weeklyMenu: inspectionMatrix,
      archives,
      mealsByVendorId: oldMealsByVendor,
      vendors
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ngày + ca đang chọn ở tab Báo cáo
  const reportDayIdx = useMemo(
    () => dayIndexFromDate(weekStartDate, reportDate || weekStartDate),
    [weekStartDate, reportDate]
  );
  const reportShiftKey = shiftKeyFromShiftName(reportShift);
  const reportDayShiftKey: 'breakfast' | 'lunch' | 'dinner' = reportShift === 'Bữa sáng' ? 'breakfast' : reportShift === 'Bữa trưa' ? 'lunch' : 'dinner';

  // ===================== Phân bổ suất THEO TỪNG BUỔI (real-time) =====================
  // vendors = ảnh sống của bộ số BỮA ĐANG CHỌN (bảng Khối 1); portionArchive lưu bộ số riêng cho Sáng/Trưa/Tối.
  // Đổi buổi → bảng tự nạp bộ số của buổi đó; sửa ở bảng → ghi thẳng cả 2 (bảng + store buổi hiện tại).
  const PORTIONS_BY_SHIFT_KEY = 'meals_portions_by_shift_v12';

  const [portionArchive, setPortionArchive] = useState<Record<string, Record<string, VendorPortionTrio>>>(() => {
    try {
      const raw = localStorage.getItem(PORTIONS_BY_SHIFT_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    // Seed: mỗi buổi khởi đầu bằng bộ số hiện có của từng NCC (không mất số cũ)
    const seed: Record<string, Record<string, VendorPortionTrio>> = {};
    (['sang', 'trua', 'toi'] as const).forEach(sk => {
      seed[sk] = {};
      vendors.forEach(v => { seed[sk][v.id] = { td8: v.td8, td11_1: v.td11_1, td11_3: v.td11_3 }; });
    });
    return seed;
  });

  useEffect(() => {
    try { localStorage.setItem(PORTIONS_BY_SHIFT_KEY, JSON.stringify(portionArchive)); } catch { /* ignore */ }
  }, [portionArchive]);

  // Đổi buổi: nạp bộ số thực của buổi mới vào bảng phân bổ (nếu buổi đó có dòng đã lưu)
  useEffect(() => {
    const shiftMap = portionArchive[reportShiftKey];
    if (!shiftMap) return;
    setVendors(prev => prev.map(v => {
      const saved = shiftMap[v.id];
      return saved ? { ...v, td8: saved.td8, td11_1: saved.td11_1, td11_3: saved.td11_3 } : v;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportShiftKey]);

  // Ghi số suất cho NCC vào bảng live + store của buổi đang chọn (một đường duy nhất)
  const updateVendorPortions = (vendorId: string, field: 'td8' | 'td11_1' | 'td11_3', value: number) => {
    const clamped = Math.max(0, Number.isFinite(value) ? Math.round(value) : 0);
    setVendors(prev => prev.map(v => (v.id === vendorId ? { ...v, [field]: clamped } : v)));
    setPortionArchive(prev => {
      const existing = prev[reportShiftKey]?.[vendorId];
      const trio: VendorPortionTrio = existing
        ? { ...existing, [field]: clamped }
        : (() => {
            const v = vendors.find(x => x.id === vendorId);
            return { td8: v?.td8 ?? 0, td11_1: v?.td11_1 ?? 0, td11_3: v?.td11_3 ?? 0, [field]: clamped } as VendorPortionTrio;
          })();
      return { ...prev, [reportShiftKey]: { ...(prev[reportShiftKey] || {}), [vendorId]: trio } };
    });
  };

  // Nguồn món báo cáo/Khối 2: DẪN XUẤT từ CSDL (hết state riêng mealsByVendorId)
  const reportMealsByVendorId = useMemo<Record<string, ShiftMealDetail>>(() => {
    const map: Record<string, ShiftMealDetail> = {};
    vendors.forEach(v => {
      map[v.id] = getShiftDetail(supplierMenus, v.id, weekStartDate, reportDayIdx, reportShiftKey)
        || { meatDishes: [], meatDessert: '—', vegDishes: [], vegDessert: '—' };
    });
    return map;
  }, [vendors, supplierMenus, weekStartDate, reportDayIdx, reportShiftKey]);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterShift, setFilterShift] = useState<string>('all');
  const [selectedVendorForMenu, setSelectedVendorForMenu] = useState<string>('tam-phuong');

  // Thực đơn RIÊNG của NCC đang chọn (tab "Thực đơn nhà cung cấp") — đọc từ CSDL
  // supplier_menus theo vendorId + tuần. KHÔNG fallback sang Tám Phương hay NCC khác:
  // NCC chưa có dữ liệu → tuần rỗng (trạng thái "Chưa có thực đơn cho NCC này").
  const selectedVendorWeekMenu = useMemo(
    () => getVendorWeekAsDayWeeklyMenu(supplierMenus, selectedVendorForMenu, weekStartDate),
    [supplierMenus, selectedVendorForMenu, weekStartDate]
  );
  const selectedVendorHasMenu = useMemo(
    () => selectedVendorWeekMenu.some(d =>
      (['breakfast', 'lunch', 'dinner'] as const).some(k => d[k].meatDishes.length > 0 || d[k].vegDishes.length > 0)
    ),
    [selectedVendorWeekMenu]
  );

  // Mô tả ngắn nội dung 1 ca — dùng cho hộp xác nhận ghi đè (B1.4)
  const describeMealDetail = (d?: ShiftMealDetail | null): string => {
    if (!d || (d.meatDishes.length === 0 && d.vegDishes.length === 0)) return '(trống)';
    const short = (list: string[]) => list.slice(0, 2).map(x => x.split(' (')[0]).join(', ') + (list.length > 2 ? ', …' : '');
    return `${d.meatDishes.length} món mặn (${short(d.meatDishes)}), ${d.vegDishes.length} món chay (${short(d.vegDishes)}), tráng miệng: ${d.meatDessert || '—'}`;
  };

  // Tab 4 (Kiểm định) Sub-sections & Controls
  const [evalRuleTab, setEvalRuleTab] = useState<'portions' | 'summer23'>('portions');
  const [summerSearch, setSummerSearch] = useState('');
  const [expandedWarningShift, setExpandedWarningShift] = useState<string | null>(null);

  // Modals state
  const [showRuleEditModal, setShowRuleEditModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PortionRule | null>(null);
  const [showEditMealModal, setShowEditMealModal] = useState<{ dayIdx: number; shiftKey: 'breakfast' | 'lunch' | 'dinner'; detail: ShiftMealDetail } | null>(null);
  // Wizard trích xuất: null = đóng; {} = mở tự do; {lockedVendorId} = mở từ Không gian NCC
  const [automationWizard, setAutomationWizard] = useState<{ lockedVendorId?: string; lockedVendorName?: string } | null>(null);

  // Hoàn tác áp dụng thực đơn (cửa sổ 30 phút, giao dịch lưu localStorage)
  const [undoInfo, setUndoInfo] = useState<{ id: string; expiresAt: number } | null>(() => {
    const snap = peekUndoSnapshot();
    return snap ? { id: snap.id, expiresAt: snap.expiresAt } : null;
  });

  useEffect(() => {
    if (!undoInfo) return;
    const timer = setInterval(() => {
      if (!peekUndoSnapshot()) setUndoInfo(null);
    }, 30000);
    return () => clearInterval(timer);
  }, [undoInfo]);

  // Đồng bộ 1 tuần menu của NCC vào CSDL supplier_menus
  const syncStoreMenu = (
    vendorId: string,
    weekStart: string,
    menu: DayWeeklyMenu[],
    source: 'ai' | 'excel' | 'text' | 'archive',
    fileId?: string
  ) => {
    setSupplierMenus(prev => importWeeklyMenu(prev, vendorId, weekStart, menu, source, fileId));
    broadcastMenuSync('supplier_menus');
  };

  // Ghi tay ca ăn của 1 NCC vào CSDL (Khối 2 báo cáo / nạp từ ma trận tuần / modal sửa món)
  const updateVendorShiftDetail = (
    vendorId: string,
    dayIdx: number,
    dayShiftKey: 'breakfast' | 'lunch' | 'dinner',
    detail: ShiftMealDetail,
    weekStart: string = weekStartDate
  ) => {
    setSupplierMenus(prev => upsertShift(prev, {
      vendorId,
      weekStart,
      dayIndex: dayIdx,
      shiftKey: shiftKeyFromDayKey(dayShiftKey),
      detail,
      source: 'manual'
    }));
    broadcastMenuSync('supplier_menus');
  };

  // Áp dụng kết quả wizard trích xuất: ghi theo giao dịch + lưu lịch sử archive
  const handleWizardApply = (payload: WizardApplyPayload) => {
    const snap = saveUndoSnapshot(inspectionMatrix);
    setUndoInfo({ id: snap.id, expiresAt: snap.expiresAt });

    setInspectionMatrix(payload.finalMenu);

    const modeLabel = APPLY_MODES.find(m => m.id === payload.mode)?.label || payload.mode;
    const newArchive: UploadedMenuFile = {
      id: `file-${Date.now()}`,
      fileName: payload.fileNames.length > 2
        ? `${payload.fileNames[0]} (+${payload.fileNames.length - 1} file)`
        : payload.fileNames.join(' + '),
      fileType: (payload.sourceTypes.includes('image') || payload.sourceTypes.includes('pdf')) ? 'image' : 'excel',
      dateRange: getWeekRangeStr(weekStartDate),
      startDate: weekStartDate,
      endDate: formatISODate(getDateOfDayInWeek(weekStartDate, 6)),
      vendorId: payload.supplierId,
      vendorName: payload.supplierName,
      uploadedAt: formatDMY(new Date()),
      isActive: true,
      menu: payload.finalMenu
    };
    setArchives(prev => [newArchive, ...prev.map(f => ({ ...f, isActive: false }))]);
    setSelectedFileId(newArchive.id);

    // Đồng bộ thẳng vào CSDL supplier_menus
    syncStoreMenu(
      payload.supplierId,
      weekStartDate,
      payload.finalMenu,
      payload.sourceTypes.includes('image') || payload.sourceTypes.includes('pdf') ? 'ai' : 'excel',
      newArchive.id
    );

    showToast(`Đã áp dụng "${modeLabel}": +${payload.diff.addedCount} món mới, −${payload.diff.removedCount} món bỏ. Có thể hoàn tác trong 30 phút.`);
    broadcastMenuSync('menu-apply');
  };

  const handleUndoApply = () => {
    const snap = popUndoSnapshot();
    if (snap) {
      setInspectionMatrix(snap.menu);
      showToast('Đã hoàn tác — thực đơn đã phục hồi về trạng thái trước khi áp dụng.');
    }
    discardUndoSnapshot();
    setUndoInfo(null);
  };

  // ===================== Không gian NCC =====================

  const goToReportForVendor = (vendorId: string) => {
    setActiveVendorForEdit(vendorId);
    setActiveTab('report');
  };

  // Chạy kiểm định định lượng (gram/ml) + món trùng cho 1 NCC theo nguồn ('week' hoặc archive id)
  const runVendorPortionCheck = (vendorId: string, source: 'week' | string): VendorPortionCheckResult | null => {
    let weekStartLocal = weekStartDate;
    let sourceLabel = 'Tuần hiện tại';
    let compareFileId: string | undefined = selectedFileId; // tuần: đối chiếu với mọi file khác
    let dbLocal = supplierMenus;

    if (source !== 'week') {
      const f = archives.find(a => a.id === source);
      if (!f) return null;
      weekStartLocal = f.startDate || weekStartDate;
      sourceLabel = f.fileName;
      compareFileId = f.id;
      // Đảm bảo menu của file đã vào CSDL trước khi kiểm
      dbLocal = importWeeklyMenu(dbLocal, f.vendorId || vendorId, weekStartLocal, f.menu, 'archive', f.id);
    }

    const { db, result } = portionCheckVendorWeek(dbLocal, {
      vendorId,
      weekStart: weekStartLocal,
      rules,
      archivesForVendor: archives.filter(a => a.vendorId === vendorId && a.id !== compareFileId),
      compareFileId,
      sourceLabel
    });
    setSupplierMenus(db);
    return result;
  };

  // Section 5 File Management & Storage states
  const [fileToDelete, setFileToDelete] = useState<UploadedMenuFile | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [previewArchiveFile, setPreviewArchiveFile] = useState<UploadedMenuFile | null>(null);
  const [archiveViewMode, setArchiveViewMode] = useState<'grid' | 'table'>('grid');
  const [archiveSearchTerm, setArchiveSearchTerm] = useState('');
  const [archiveTypeFilter, setArchiveTypeFilter] = useState<'all' | 'excel' | 'csv' | 'image'>('all');

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  // Date helpers computed from single source of truth
  const weekDays = useMemo(() => {
    return getWeekDaysInfo(weekStartDate);
  }, [weekStartDate]);

  const activeWeekRangeStr = useMemo(() => {
    return getWeekRangeStr(weekStartDate);
  }, [weekStartDate]);

  const dateObj = useMemo(() => {
    return parseDateSafe(reportDate);
  }, [reportDate]);

  const formattedDateStr = useMemo(() => {
    return formatDMY(dateObj);
  }, [dateObj]);

  const dayOfWeekStr = useMemo(() => {
    const days = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    return days[dateObj.getDay()];
  }, [dateObj]);

  // Sync menu dates whenever weekStartDate changes
  useEffect(() => {
    setInspectionMatrix(prev => {
      return prev.map((day, idx) => ({
        ...day,
        dayOfWeek: weekDays[idx]?.dayOfWeek || day.dayOfWeek,
        dateStr: weekDays[idx]?.dateStr || day.dateStr
      }));
    });
  }, [weekDays]);

  // Stepper handler for portion table (+ / -) in Tab Report — ghi real-time cho BỮA ĐANG CHỌN
  const handleAdjustPortion = (vendorId: string, field: 'td8' | 'td11_1' | 'td11_3', delta: number) => {
    const v = vendors.find(x => x.id === vendorId);
    if (!v) return;
    updateVendorPortions(vendorId, field, v[field] + delta);
  };

  // Quick fill preset value in Tab Report — ghi real-time cho BỮA ĐANG CHỌN
  const handleQuickFillValue = (val: number) => {
    if (selectedVendorsForReport.length === 0) {
      showToast('Hãy chọn ít nhất 1 nhà cung cấp trong bảng để áp dụng.');
      return;
    }
    const targetId = selectedVendorsForReport[0];
    updateVendorPortions(targetId, quickFillColumn, val);
    showToast(`Đã gán ${quickFillColumn.toUpperCase()} = ${val} cho ${vendors.find(v => v.id === targetId)?.name} (bữa ${reportShift.toLowerCase()})`);
  };

  // Total shift calculations & Portion verification (Single Source of Truth)
  // Tổng suất của 7 NCC theo ca đang chọn
  const totalShiftMeals = useMemo(() => {
    return vendors.reduce((acc, v) => acc + (v.td8 + v.td11_1 + v.td11_3), 0);
  }, [vendors]);

  // Suất đang chọn xuất bằng tổng NCC đang bật
  const selectedExportMeals = useMemo(() => {
    return vendors
      .filter(v => selectedVendorsForReport.includes(v.id))
      .reduce((acc, v) => acc + (v.td8 + v.td11_1 + v.td11_3), 0);
  }, [vendors, selectedVendorsForReport]);

  // ===== FOOTER BẢNG PHÂN BỔ: tổng theo cột của các NCC ĐANG CHỌN (real-time) =====
  const selectedPortionTotals = useMemo(() => {
    const sel = vendors.filter(v => selectedVendorsForReport.includes(v.id));
    const td8 = sel.reduce((acc, v) => acc + v.td8, 0);
    const td11_1 = sel.reduce((acc, v) => acc + v.td11_1, 0);
    const td11_3 = sel.reduce((acc, v) => acc + v.td11_3, 0);
    return { td8, td11_1, td11_3, grand: td8 + td11_1 + td11_3 };
  }, [vendors, selectedVendorsForReport]);

  // ===== XÓA NHANH: đặt toàn bộ TĐ 8/11.1/11.3 của BỮA HIỆN TẠI về 0 (đồng bộ tổng + Zalo) =====
  const handleClearAllPortions = () => {
    if (vendors.length === 0) return;
    const ok = confirm(
      `XÓA NHANH DỮ LIỆU PHÂN BỔ?\n\nToàn bộ ô nhập TĐ 8 / TĐ 11.1 / TĐ 11.3 của bữa "${reportShift}" sẽ về 0.\n` +
      `Đồng thời: cột TỔNG NCC, dòng TỔNG CỘNG và báo cáo Zalo cập nhật theo số 0.\n` +
      `Số suất của các bữa khác (Sáng/Trưa/Tối) KHÔNG bị ảnh hưởng.`
    );
    if (!ok) return;
    const zeroedIds = vendors.map(v => v.id);
    setVendors(prev => prev.map(v => (v.td8 === 0 && v.td11_1 === 0 && v.td11_3 === 0) ? v : { ...v, td8: 0, td11_1: 0, td11_3: 0 }));
    setPortionArchive(prev => {
      const map: Record<string, VendorPortionTrio> = {};
      zeroedIds.forEach(id => { map[id] = { td8: 0, td11_1: 0, td11_3: 0 }; });
      return { ...prev, [reportShiftKey]: { ...(prev[reportShiftKey] || {}), ...map } };
    });
    showToast(`Đã xóa nhanh toàn bộ số suất của bữa ${reportShift.toLowerCase()} — tổng cột & Zalo đã đồng bộ về 0.`);
  };

  // Kiểm tra cảnh báo lệch suất: Tổng suất NCC phải bằng TĐ8 + TĐ11.1 + TĐ11.3
  // Nếu có trường expectedTotal thì so khớp, nếu không thì cảnh báo nếu TĐ8 + TĐ11.1 + TĐ11.3 <= 0
  const vendorPortionDiscrepancies = useMemo(() => {
    const list: Array<{ vendorId: string; vendorName: string; calculated: number; expected: number; diff: number }> = [];
    vendors.forEach(v => {
      const calc = v.td8 + v.td11_1 + v.td11_3;
      if (v.expectedTotal !== undefined && v.expectedTotal !== calc) {
        list.push({
          vendorId: v.id,
          vendorName: v.name,
          calculated: calc,
          expected: v.expectedTotal,
          diff: calc - v.expectedTotal
        });
      }
    });
    return list;
  }, [vendors]);

  // Run Rule Engine for Tab 4 (Kiểm định)
  const evaluationResult = useMemo(() => {
    return evaluateMenuWeekly(inspectionMatrix, rules);
  }, [inspectionMatrix, rules]);

  // Detect duplicate dishes across other uploaded menu files (excluding currently selected file)
  const duplicateDishes = useMemo(() => {
    return detectDuplicateDishes(inspectionMatrix, archives, selectedFileId);
  }, [inspectionMatrix, archives, selectedFileId]);

  // Thông tin file thực đơn hiện đang được chọn kiểm định
  const activeUploadedFile = useMemo(() => {
    return archives.find(f => f.id === selectedFileId) || archives[0];
  }, [archives, selectedFileId]);

  // MA TRẬN TUẦN thuộc về NCC nào? = NCC của file đang active (isolated supplier state)
  const matrixOwnerVendorId = activeUploadedFile?.vendorId || 'tam-phuong';

  // Bộ lọc danh sách file thực đơn đã tải lên (Section 5)
  const filteredArchives = useMemo(() => {
    return archives.filter(file => {
      const q = archiveSearchTerm.toLowerCase().trim();
      const matchSearch = !q ||
        file.fileName.toLowerCase().includes(q) ||
        file.dateRange.toLowerCase().includes(q) ||
        (file.vendorName && file.vendorName.toLowerCase().includes(q));

      const matchType = archiveTypeFilter === 'all' || file.fileType === archiveTypeFilter;
      return matchSearch && matchType;
    });
  }, [archives, archiveSearchTerm, archiveTypeFilter]);

  // Kích hoạt nạp thực đơn từ file đã tải lên
  const handleSelectFile = (fileId: string) => {
    const target = archives.find(f => f.id === fileId);
    if (!target) return;
    setSelectedFileId(fileId);
    setInspectionMatrix(target.menu);
    setArchives(prev => prev.map(f => ({ ...f, isActive: f.id === fileId })));
    // Đồng bộ nội dung file vào CSDL supplier_menus theo NCC + tuần của file
    syncStoreMenu(
      target.vendorId || 'tam-phuong',
      target.startDate || weekStartDate,
      target.menu,
      'archive',
      target.id
    );
    showToast(`Đã nạp và áp dụng thực đơn: ${target.fileName} (${target.dateRange})`);
    broadcastMenuSync('menu-apply');
  };

  // Mở modal xác nhận xóa trực tiếp file (không dùng window.confirm)
  const handleRequestDeleteFile = (file: UploadedMenuFile) => {
    setFileToDelete(file);
  };

  // Thực thi xóa file vĩnh viễn
  const executeDeleteFile = () => {
    if (!fileToDelete) return;
    const fileId = fileToDelete.id;
    const fileName = fileToDelete.fileName;
    const remaining = archives.filter(f => f.id !== fileId);
    setArchives(remaining);

    if (selectedFileId === fileId) {
      if (remaining.length > 0) {
        setSelectedFileId(remaining[0].id);
        setInspectionMatrix(remaining[0].menu);
        setArchives(remaining.map((f, idx) => ({ ...f, isActive: idx === 0 })));
      }
    }
    setFileToDelete(null);
    showToast(`Đã xóa vĩnh viễn file "${fileName}" khỏi hệ thống!`);
    broadcastMenuSync('archives');
  };

  // Lưu thực đơn hiện tại thành file lưu trữ
  const handleSaveCurrentWeekToArchive = () => {
    const newFileId = `file-${Date.now()}`;
    const dateRangeStr = inspectionMatrix.length >= 7 
      ? `${inspectionMatrix[0].dateStr} - ${inspectionMatrix[6].dateStr}`
      : `${formattedDateStr}`;
    // MA TRẬN TUẦN thuộc về NCC đang sở hữu file active — KHÔNG cho phép sao chép chéo sang NCC khác
    const ownerVendorId = activeUploadedFile?.vendorId || selectedVendorForMenu || 'tam-phuong';
    const newArchive: UploadedMenuFile = {
      id: newFileId,
      fileName: `Thuc_don_${dateRangeStr.replace(/\s+/g, '').replace(/[\/\-]/g, '_')}_Vincons.xlsx`,
      fileType: 'excel',
      fileSize: '35.0 KB',
      dateRange: dateRangeStr,
      startDate: inspectionMatrix[0]?.dateStr || formattedDateStr,
      endDate: inspectionMatrix[inspectionMatrix.length - 1]?.dateStr || formattedDateStr,
      vendorId: ownerVendorId,
      vendorName: vendors.find(v => v.id === ownerVendorId)?.name || 'Tám Phương',
      uploadedAt: new Date().toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }),
      isActive: true,
      menu: JSON.parse(JSON.stringify(inspectionMatrix))
    };
    setSelectedFileId(newFileId);
    setArchives(prev => [newArchive, ...prev.map(f => ({ ...f, isActive: false }))]);
    syncStoreMenu(newArchive.vendorId, weekStartDate, inspectionMatrix, 'archive', newFileId);
    showToast('Đã lưu trữ thực đơn vào danh sách file thành công!');
    broadcastMenuSync('menu-apply');
  };

  // Yêu cầu dọn dẹp các file cũ hơn 90 ngày (~3 tháng)
  const handleRequestPurge = () => {
    if (archives.length <= 4) {
      showToast('Dữ liệu lưu trữ hiện tại đang gọn gàng (dưới 4 file), không có file nào quá 3 tháng.');
      return;
    }
    setShowPurgeModal(true);
  };

  // Thực thi dọn dẹp file > 3 tháng
  const executePurgeOldArchives = () => {
    const retained = archives.slice(0, 4);
    const removedCount = Math.max(0, archives.length - 4);
    setArchives(retained);
    setShowPurgeModal(false);
    showToast(`Đã dọn dẹp thành công ${removedCount} file thực đơn cũ (> 3 tháng)!`);
  };

  // ===================== BỘ ĐỌC FILE KIỂM ĐỊNH ĐA ĐỊNH DẠNG =====================
  // Bảng: .xlsx/.xls/.ods/.csv — Văn bản: .txt — Ảnh/PDF: OCR Gemini. Lỗi cấu trúc → hướng dẫn + map cột thủ công.
  const [fileIssue, setFileIssue] = useState<{ fileName: string; code: FileIssueCode | 'AI_ERROR' | 'UNKNOWN'; guidance: string[] } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sheetSnap, setSheetSnap] = useState<SheetSnapshot | null>(null);
  const [columnMap, setColumnMap] = useState<ManualColumnMap>({ colDay: null, colShift: null, colMan: null, colChay: null, colDessert: null });
  const [remapping, setRemapping] = useState(false);

  const totalDishesOfResult = (r: ParseResult) => r.days.reduce(
    (acc, d) => acc
      + d.shifts.breakfast.man.length + d.shifts.breakfast.chay.length
      + d.shifts.lunch.man.length + d.shifts.lunch.chay.length
      + d.shifts.dinner.man.length + d.shifts.dinner.chay.length,
    0
  );

  // Ghi kết quả upload vào CSDL supplier_menus CỦA ĐÚNG NCC được chọn (isolated):
  // • KHÔNG thay ma trận kiểm định (inspectionMatrix) bằng nội dung của NCC.
  // • KHÔNG đụng dữ liệu của NCC khác.
  const applyInspectionResult = (result: ParseResult, file: File, source: 'ai' | 'excel' | 'text', targetVendorId?: string) => {
    const menu = parsedDaysToWeeklyMenu(result.days, result.weekStartDate);
    const newFileId = `file-${Date.now()}`;
    const fileType: UploadedMenuFile['fileType'] =
      result.sourceType === 'csv' ? 'csv'
        : (result.sourceType === 'image' || result.sourceType === 'pdf') ? 'image'
          : result.sourceType === 'text' ? 'manual' : 'excel';

    // NCC đích do luồng upload chỉ định (ưu tiên tuyệt đối) — không nhận diện chéo
    const ownerVendorId = targetVendorId || result.supplierId || selectedVendorForMenu || 'tam-phuong';

    const newArchive: UploadedMenuFile = {
      id: newFileId,
      fileName: file.name,
      fileType,
      fileSize: `${(file.size / 1024).toFixed(1)} KB`,
      dateRange: getWeekRangeStr(result.weekStartDate),
      startDate: result.weekStartDate,
      endDate: formatISODate(getDateOfDayInWeek(result.weekStartDate, 6)),
      vendorId: ownerVendorId,
      vendorName: vendors.find(v => v.id === ownerVendorId)?.name || result.supplierName || 'Tám Phương',
      uploadedAt: formatDMY(new Date()),
      isActive: true,
      menu
    };

    setSelectedFileId(newFileId);
    setArchives(prev => [newArchive, ...prev.map(f => ({ ...f, isActive: false }))]);
    syncStoreMenu(ownerVendorId, result.weekStartDate, menu, source, newFileId);

    const dishCount = totalDishesOfResult(result);
    showToast(`Đã đọc ${file.name}: ${dishCount} món trên ${menu.length * 3} ca${result.warnings.length ? ` • ${result.warnings.length} cảnh báo cần rà` : ''}.`);
    broadcastMenuSync('menu-apply');
  };

  const processInspectionFile = async (file: File) => {
    const lower = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
    const isSheet = ['.xlsx', '.xls', '.ods', '.csv'].some(ext => lower.endsWith(ext));
    const isText = lower.endsWith('.txt') || file.type.startsWith('text/');

    setPendingFile(file);
    setFileIssue(null);
    setSheetSnap(null);
    setColumnMap({ colDay: null, colShift: null, colMan: null, colChay: null, colDessert: null });

    try {
      let result: ParseResult;
      if (isImage || isPdf) {
        showToast(`Đang trích xuất ${file.name} bằng AI (OCR Gemini)...`);
        result = await extractMenuWithGemini(file, { weekStartDate });
        applyInspectionResult(result, file, 'ai', selectedVendorForMenu);
      } else if (isSheet) {
        result = await parseExcelOrCsvFile(file, weekStartDate, selectedVendorForMenu);
        applyInspectionResult(result, file, 'excel', selectedVendorForMenu);
      } else if (isText) {
        result = await parsePlainTextMenu(await file.text(), weekStartDate, selectedVendorForMenu);
        applyInspectionResult(result, file, 'text', selectedVendorForMenu);
      } else {
        const extMatch = lower.match(/\.([a-z0-9]+)$/);
        throw new StructuredFileError(
          'UNSUPPORTED_MIME',
          `Định dạng ".${extMatch?.[1] || file.type || 'không rõ'}" chưa được hỗ trợ.`,
          [
            'Chuyển file về một trong: Excel (.xlsx/.xls/.ods), CSV, TXT, hoặc ảnh (PNG/JPG) / PDF để AI trích xuất.',
            'Với Microsoft Word/Google Docs: xuất hoặc chụp màn hình bảng thực đơn thành ảnh rồi tải lên.'
          ]
        );
      }
    } catch (err) {
      handleFileReadError(err, file, isSheet);
    }
  };

  // Xử lý lỗi đọc file chung (dùng cho cả luồng kiểm định & lưu trữ theo NCC)
  const handleFileReadError = (err: unknown, file: File, isSheet: boolean) => {
    if (err instanceof StructuredFileError) {
      setFileIssue({ fileName: file.name, code: err.code, guidance: err.guidance });
      if (err.code === 'UNKNOWN_STRUCTURE' && isSheet) {
        makeSheetSnapshot(file).then(setSheetSnap).catch(() => setSheetSnap(null));
      }
      if (err.code === 'EMPTY_FILE') {
        setManualEntryOpen(true);
      }
      showToast('Không đọc được file — làm theo hướng dẫn chi tiết trong thẻ tải lên.');
    } else if (err instanceof GeminiExtractError) {
      setFileIssue({
        fileName: file.name,
        code: 'AI_ERROR',
        guidance: [
          err.message,
          err.retryable
            ? 'Lỗi tạm thời (mạng/quota) — bấm "Thử lại AI" hoặc tải file lên lại.'
            : 'Kiểm tra GEMINI_API_KEY trên server (.env / Secrets) hoặc chuyển sang Excel/CSV.'
        ]
      });
      showToast('Trích xuất AI lỗi — xem hướng dẫn bên dưới.');
    } else {
      setFileIssue({
        fileName: file.name,
        code: 'UNKNOWN',
        guidance: ['Lỗi ngoài dự kiến khi đọc file:', err instanceof Error ? err.message : String(err)]
      });
    }
  };

  const reparseWithManualMap = async () => {
    if (!pendingFile) return;
    setRemapping(true);
    try {
      const result = await parseWithManualMap(pendingFile, columnMap, weekStartDate, selectedVendorForMenu);
      applyInspectionResult(result, pendingFile, 'excel', selectedVendorForMenu);
      setFileIssue(null);
      setSheetSnap(null);
    } catch (err) {
      if (err instanceof StructuredFileError) {
        setFileIssue({ fileName: pendingFile.name, code: err.code, guidance: err.guidance });
        showToast('Vẫn chưa đọc được — hãy điều chỉnh lại cột rồi thử thêm lần nữa.');
      }
    } finally {
      setRemapping(false);
    }
  };

  const handleMenuFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    void processInspectionFile(files[0]);
    e.target.value = '';
  };

  const colLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`);

  // ===================== QUẢN LÝ FILE THEO NCC (Supplier File Archive) =====================
  const [archiveUploadVendor, setArchiveUploadVendor] = useState('tam-phuong');
  const [archiveUploadWeek, setArchiveUploadWeek] = useState(weekStartDate);
  const [archiveFilter, setArchiveFilter] = useState<string>('all');
  const [showReportArchive, setShowReportArchive] = useState(false);

  // Danh sách tuần áp dụng: tuần hiện tại -1 → +3
  const archiveWeekOptions = useMemo(() => {
    const base = getMondayOfDate(parseDateSafe(weekStartDate));
    return [-1, 0, 1, 2, 3].map(off => {
      const d = new Date(base);
      d.setDate(d.getDate() + off * 7);
      return formatISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    });
  }, [weekStartDate]);

  // Upload đa định dạng vào Lưu trữ File theo NCC — NCC + Tuần do người dùng chỉ định
  // (override dùng cho MenuFilePanel — đích danh NCC/tuần từ panel, không phụ thuộc state cục bộ)
  const processArchiveUpload = async (file: File, override?: { vendorId?: string; weekStart?: string }) => {
    const targetVendor = override?.vendorId || archiveUploadVendor;
    const targetWeek = override?.weekStart || archiveUploadWeek;
    const lower = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf' || lower.endsWith('.pdf');
    const isSheet = ['.xlsx', '.xls', '.ods', '.csv'].some(ext => lower.endsWith(ext));
    const isText = lower.endsWith('.txt') || file.type.startsWith('text/');
    const vendorName = vendors.find(v => v.id === targetVendor)?.name || 'Tám Phương';

    setPendingFile(file);
    setFileIssue(null);
    setSheetSnap(null);
    setColumnMap({ colDay: null, colShift: null, colMan: null, colChay: null, colDessert: null });

    try {
      let result: ParseResult;
      if (isImage || isPdf) {
        showToast(`Đang trích xuất ${file.name} bằng AI cho ${vendorName}...`);
        result = await extractMenuWithGemini(file, {
          weekStartDate: targetWeek,
          supplierHint: vendorName,
          targetSupplierId: targetVendor
        });
      } else if (isSheet) {
        result = await parseExcelOrCsvFile(file, targetWeek, targetVendor);
      } else if (isText) {
        result = await parsePlainTextMenu(await file.text(), targetWeek, targetVendor);
      } else {
        const extMatch = lower.match(/\.([a-z0-9]+)$/);
        throw new StructuredFileError(
          'UNSUPPORTED_MIME',
          `Định dạng ".${extMatch?.[1] || file.type || 'không rõ'}" chưa được hỗ trợ.`,
          ['Chỉ hỗ trợ: .xlsx / .xls / .ods / .csv / .txt / .pdf / .png / .jpg']
        );
      }
      if (totalDishesOfResult(result) === 0) {
        throw new StructuredFileError(
          'UNKNOWN_STRUCTURE',
          `${file.name} đọc được nhưng không có món nào.`,
          ['Bảng cần có nhãn ca/ngày hoặc cột món; thử "Chọn cột thủ công" hoặc dùng ảnh/PDF với AI.']
        );
      }
      applyInspectionResult(result, file, isImage || isPdf ? 'ai' : isSheet ? 'excel' : 'text', targetVendor);
      if (parseDateSafe(weekStartDate).getTime() !== parseDateSafe(result.weekStartDate).getTime()) {
        setWeekStartDate(result.weekStartDate);
      }
    } catch (err) {
      handleFileReadError(err, file, isSheet);
    }
  };

  // Kích hoạt kiểm định trực tiếp từ lịch sử — KHÔNG reset, không nạp lại parser
  const activateArchive = (fileId: string) => {
    const target = archives.find(f => f.id === fileId);
    if (!target) return;
    const monday = formatISODate(getMondayOfDate(parseDateSafe(target.startDate || weekStartDate)));
    setSelectedFileId(target.id);
    setInspectionMatrix(target.menu);
    setWeekStartDate(prev => (parseDateSafe(prev).getTime() === parseDateSafe(monday).getTime() ? prev : monday));
    setArchives(prev => prev.map(f => ({ ...f, isActive: f.id === fileId })));
    syncStoreMenu(target.vendorId || 'tam-phuong', monday, target.menu, 'archive', target.id);
    showToast(`Đã kích hoạt kiểm định: ${target.fileName} — dữ liệu giữ nguyên, không bị reset.`);
    broadcastMenuSync('menu-apply');
  };

  // ===== Handlers cho MenuFilePanel — mở được từ MỌI tab =====
  const handlePanelUpload = (file: File, vendorId: string, weekStart: string) => {
    showToast(`Đang đọc ${file.name} cho NCC đã chọn trong panel...`);
    void processArchiveUpload(file, { vendorId, weekStart });
  };

  const handlePanelApplyFile = (fileId: string) => {
    activateArchive(fileId);
    setMenuFilePanelOpen(false);
  };

  // Tải về thực đơn của file (JSON)
  const downloadArchiveMenu = (f: UploadedMenuFile) => {
    const blob = new Blob([JSON.stringify(f.menu, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${f.fileName.replace(/\.[^.]+$/, '')}_thucdon.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Đã tải về thực đơn của file (dạng JSON).');
  };

  const visibleArchiveFiles = useMemo(() => (
    archives
      .filter(f => archiveFilter === 'all' || f.vendorId === archiveFilter)
      .slice()
      .reverse()
  ), [archives, archiveFilter]);

  // Bộ điều khiển chung cho SupplierFileArchive (dùng ở cả tab Báo cáo & Thống kê)
  const supplierArchiveCtrl = {
    vendors,
    archives,
    uploadVendor: archiveUploadVendor,
    onUploadVendor: setArchiveUploadVendor,
    uploadWeek: archiveUploadWeek,
    onUploadWeek: setArchiveUploadWeek,
    weekOptions: archiveWeekOptions,
    onProcessUpload: (f: File) => { void processArchiveUpload(f); },
    onActivate: (id: string, jumpToInspection: boolean) => {
      activateArchive(id);
      if (jumpToInspection) {
        setActiveTab('evaluation');
        showToast('File đã load lên bảng Kiểm định thực đơn tuần.');
      }
    },
    onPreview: setPreviewArchiveFile,
    onDownload: downloadArchiveMenu,
    onDelete: setFileToDelete,
    filter: archiveFilter,
    onFilter: setArchiveFilter
  };

  // ===================== FALLBACK: BẢNG NHẬP TAY NHANH =====================
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  interface ManualDayEntry { sang: string; trua: string; toi: string }
  const [manualEntry, setManualEntry] = useState<Record<number, ManualDayEntry>>({});
  const [manualReassignMode, setManualReassignMode] = useState(false);

  const setManualShift = (dayIdx: number, shift: 'sang' | 'trua' | 'toi', val: string) => {
    setManualEntry(prev => ({ ...prev, [dayIdx]: { ...(prev[dayIdx] || { sang: '', trua: '', toi: '' }), [shift]: val } }));
  };

  const buildManualMenu = (): DayWeeklyMenu[] => {
    const shiftFromText = (text?: string): ShiftMealDetail => {
      const man: string[] = [];
      const chay: string[] = [];
      let dessert = '';
      (text || '').split(/\r?\n|[;,]/).map(s => s.trim()).filter(Boolean).forEach(line => {
        const bucket = matchDishBucket(line);
        if (bucket === 'dessert') {
          dessert = dessert || line;
          return;
        }
        const clean = extractDishPortions(line).cleanName;
        if (clean.length < 2) return;
        if (bucket === 'chay' || (bucket === null && isVegetarianDish(clean))) chay.push(line);
        else man.push(line);
      });
      return {
        title: '',
        priceNote: '',
        meatDishes: man,
        meatDessert: dessert || 'Trái cây theo mùa',
        vegDishes: chay,
        vegDessert: dessert || 'Trái cây theo mùa'
      };
    };

    // 21 ca — mỗi dòng tự phân loại Mặn/Chay/Tráng miệng
    return getWeekDaysInfo(weekStartDate).map((dw, i) => {
      const e = manualEntry[i] || { sang: '', trua: '', toi: '' };
      return {
        dayOfWeek: dw.dayOfWeek,
        dateStr: dw.dateStr,
        breakfast: shiftFromText(e.sang),
        lunch: shiftFromText(e.trua),
        dinner: shiftFromText(e.toi)
      };
    });
  };

  const applyManualInspectionEntry = () => {
    const total = Object.values(manualEntry).reduce((acc, e) => acc + (e?.sang ? 1 : 0) + (e?.trua ? 1 : 0) + (e?.toi ? 1 : 0), 0);
    if (total === 0) {
      showToast('Chưa nhập nội dung món nào — mỗi ô gõ tên món, mỗi dòng một món.');
      return;
    }
    const menu = buildManualMenu();

    // Chế độ "Phân bổ lại ca": cập nhật thẳng file đang kiểm định, KHÔNG tạo file mới
    if (manualReassignMode) {
      const target = archives.find(f => f.id === selectedFileId) || archives.find(f => f.isActive);
      if (target) {
        setInspectionMatrix(menu);
        setArchives(prev => prev.map(f => (f.id === target.id ? { ...f, menu } : f)));
        syncStoreMenu(
          target.vendorId || 'tam-phuong',
          target.startDate ? formatISODate(getMondayOfDate(parseDateSafe(target.startDate))) : weekStartDate,
          menu,
          target.fileType === 'image' ? 'ai' : target.fileType === 'csv' ? 'excel' : 'text',
          target.id
        );
        showToast('Đã lưu phân bổ ca mới vào file đang kiểm định (đồng bộ CSDL + báo cáo).');
        setManualEntryOpen(false);
        setManualEntry({});
        setManualReassignMode(false);
        return;
      }
    }

    const newFileId = `file-manual-${Date.now()}`;
    const rangeStr = getWeekRangeStr(weekStartDate);
    const newArchive: UploadedMenuFile = {
      id: newFileId,
      fileName: `Nhap_tay_kiem_dinh_${rangeStr.replace(/\s+/g, '').replace(/[\/\-]/g, '_')}.xlsx`,
      fileType: 'manual',
      dateRange: rangeStr,
      startDate: weekStartDate,
      endDate: formatISODate(getDateOfDayInWeek(weekStartDate, 6)),
      vendorId: selectedVendorForMenu || 'tam-phuong',
      vendorName: vendors.find(v => v.id === selectedVendorForMenu)?.name || 'Tám Phương',
      uploadedAt: formatDMY(new Date()),
      isActive: true,
      menu
    };
    setSelectedFileId(newFileId);
    setInspectionMatrix(menu);
    setArchives(prev => [newArchive, ...prev.map(f => ({ ...f, isActive: false }))]);
    syncStoreMenu(newArchive.vendorId, weekStartDate, menu, 'text', newFileId);
    setManualEntryOpen(false);
    setManualEntry({});
    setManualReassignMode(false);
    showToast('Đã tạo thực đơn từ bảng nhập tay — sẵn sàng kiểm định!');
  };

  // Chuyển ShiftMealDetail về dòng text (món mặn nhẹ nhàng + 'Chay: ' + 'Tráng miệng: ')
  const serializeShiftDetail = (d: ShiftMealDetail): string => {
    const lines: string[] = [...(d.meatDishes || [])];
    (d.vegDishes || []).forEach(v => lines.push(`Chay: ${v}`));
    if (d.meatDessert && d.meatDessert !== '—' && d.meatDessert !== 'Trái cây theo mùa') lines.push(`Tráng miệng: ${d.meatDessert}`);
    return lines.join('\n');
  };

  // PHÂN BỔ LẠI CA: nạp thực đơn hiện tại vào bảng cắt dòng linh hoạt
  const openManualReassign = () => {
    const entry: Record<number, ManualDayEntry> = {};
    inspectionMatrix.forEach((day, i) => {
      entry[i] = {
        sang: serializeShiftDetail(day.breakfast),
        trua: serializeShiftDetail(day.lunch),
        toi: serializeShiftDetail(day.dinner)
      };
    });
    setManualEntry(entry);
    setManualReassignMode(true);
    setManualEntryOpen(true);
    showToast('Đã nạp thực đơn hiện tại — cắt/di chuyển dòng món vào đúng Sáng/Trưa/Tối rồi lưu.');
  };

  // Copy Zalo report format — hàm chung (reportGenerator), dữ liệu thời gian thực từ CSDL + bảng phân bổ buổi hiện tại
  const handleCopyZaloReport = () => {
    const text = generateZaloReportText({
      ktxZones,
      vendors,
      db: supplierMenus,
      portionArchive,
      weekStart: weekStartDate,
      dayIdx: reportDayIdx,
      shiftKey: reportShiftKey
    });
    if (!text.trim()) {
      showToast('Chưa có NCC nào thuộc khu KTX 1 / KTX 2. Hãy tích chọn NCC ở tab Báo cáo.');
      return;
    }
    navigator.clipboard.writeText(text);
    showToast('Đã sao chép báo cáo chuẩn gửi Zalo vào bộ nhớ tạm!');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row antialiased font-sans">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 border border-slate-700 animate-in fade-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMsg}</span>
        </div>
      )}

      {/* LEFT SIDEBAR (Navigation) */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-100 flex flex-col shrink-0 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center space-x-3 bg-gradient-to-r from-(--vc-brand-1) via-(--vc-brand-2) to-(--vc-brand-3) text-white rounded-br-3xl">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-(--vc-accent-1) to-(--vc-accent-2) flex items-center justify-center font-bold shadow-md">
            <Utensils className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="font-extrabold text-xs tracking-tight uppercase">KÝ TÚC XÁ HÓC MÔN</div>
            <div className="text-[10px] text-amber-300 font-semibold leading-tight">
              TRUNG TÂM DỮ LIỆU SUẤT ĂN VÀ BÁO CÁO THỐNG KÊ
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 flex-1">
          {[
            { id: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
            { id: 'report', label: 'Báo cáo suất ăn', icon: FileText },
            { id: 'menu', label: 'Thực đơn nhà cung cấp', icon: CalendarDays },
            { id: 'vendor', label: 'Không gian NCC', icon: Store },
            { id: 'evaluation', label: 'Kiểm định thực đơn tuần', icon: ShieldCheck },
            { id: 'statistics', label: 'Thống kê số liệu (Ngày/Tháng)', icon: BarChart3 }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition text-left border ${
                  isActive
                    ? 'bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-white font-bold shadow-md border-transparent'
                    : 'text-slate-600 hover:bg-blue-50/60 hover:text-(--vc-brand-2) border-transparent hover:border-blue-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-300" />}
              </button>
            );
          })}
        </nav>

        {/* Bottom Sidebar Feature Actions */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          <button
            onClick={() => setAutomationWizard({})}
            className="w-full text-left p-2.5 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 border border-amber-200 transition flex items-start space-x-2.5 shadow-xs hover:shadow-md"
          >
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-(--vc-accent-1) to-(--vc-accent-2) shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Tự động hóa báo cáo</div>
              <div className="text-[10px] text-orange-700 leading-snug">Tải ảnh thực đơn để điền báo cáo nhanh hơn.</div>
            </div>
          </button>

          <button
            onClick={() => showToast('Cài đặt hệ thống: Đã kích hoạt múi giờ Asia/Ho_Chi_Minh & kết nối mạng LAN KTX Hóc Môn.')}
            className="w-full flex items-center space-x-2 px-3 py-2 text-xs text-slate-500 hover:text-(--vc-brand-2) hover:bg-blue-50 rounded-xl transition"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Cài đặt hệ thống</span>
          </button>
        </div>
      </aside>

      {/* CENTER WORKSPACE & OPTIONAL RIGHT SIDEBAR (ONLY IN TAB REPORT) */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-x-hidden">
        {/* WORKSPACE AREA */}
        <div className="flex-1 p-4 sm:p-6 space-y-6 overflow-y-auto">
          {/* TOP APP HEADER — realtime ERP */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between pb-3 border-b border-slate-200 gap-3">
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-tight">KHU VỰC LÀM VIỆC & ĐIỀU HÀNH VINCONS</h1>
              <p className="text-xs text-(--vc-brand-2) font-bold">TRUNG TÂM DỮ LIỆU SUẤT ĂN VÀ BÁO CÁO THỐNG KÊ</p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <RealtimeClock compact />
              <div className="flex items-center space-x-2.5">
              <span
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border ${
                  cloudStatus.enabled
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
                title={cloudStatus.reason + (cloudStatus.lastError ? ` — lỗi gần nhất: ${cloudStatus.lastError}` : '')}
              >
                {cloudStatus.enabled ? '☁ Đang đồng bộ đám mây' : `☁ Lưu cục bộ — ${cloudStatus.reason}`}
              </span>
              <button
                onClick={() => setMenuFilePanelOpen(true)}
                className="px-3 py-1.5 bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-sm hover:brightness-105"
                title="Quản lý tệp thực đơn — mở từ mọi tab"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Tệp thực đơn ({archives.length})</span>
              </button>
              <button
                onClick={() => {
                  // LÀM MỚI giao diện từ dữ liệu MỚI NHẤT — tuyệt đối không rollback về dữ liệu cũ
                  const active = archives.find(f => f.isActive) || archives[0];
                  if (active) {
                    const activeMonday = formatISODate(getMondayOfDate(parseDateSafe(active.startDate || weekStartDate)));
                    setSelectedFileId(active.id);
                    setInspectionMatrix(active.menu);
                    setWeekStartDate(prev => (parseDateSafe(prev).getTime() === parseDateSafe(activeMonday).getTime() ? prev : activeMonday));
                    setArchives(prev => prev.map(f => ({ ...f, isActive: f.id === active.id })));
                  }
                  try {
                    const rawVendors = localStorage.getItem(STORAGE_KEYS.VENDORS);
                    if (rawVendors) setVendors(JSON.parse(rawVendors));
                  } catch { /* ignore */ }
                  showToast(archives.length
                    ? `Đã làm mới từ file gần nhất: ${archives.find(f => f.isActive)?.fileName || archives[0].fileName} (không rollback).`
                    : 'Đã làm mới giao diện.');
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center space-x-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-teal-600" />
                <span>Tải lại dữ liệu</span>
              </button>

              <span className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Hệ thống trực tuyến</span>
              </span>

              <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs">
                AT
              </div>
              </div>
            </div>
          </div>

          {/* TAB: KIỂM ĐỊNH THỰC ĐƠN TUẦN (UPGRADED: UPLOAD FILE, SỔ TAY QUY TẮC, CHI TIẾT VI PHẠM, TRÙNG MÓN 4 TUẦN & LƯU TRỮ 3 THÁNG) */}
          {activeTab === 'evaluation' && (
            <div className="space-y-6">
              {/* Header Box with Score Card */}
              <div className="bg-(--vc-brand-1) text-white p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2 max-w-2xl">
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs font-bold uppercase tracking-wider">
                    ⚖️ HỆ THỐNG KIỂM ĐỊNH ĐỊNH LƯỢNG & QUY TẮC AN TOÀN THỰC PHẨM
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                    KIỂM ĐỊNH ĐỊNH LƯỢNG SUẤT ĂN & 10 QUY TẮC TUẦN
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Hệ thống rà soát định lượng gram/ml, đối chiếu Danh mục 23 món cấm mùa hè và kiểm tra trùng lặp món ăn trong 4 tuần gần nhất. Toàn bộ quy chuẩn hiển thị bên dưới để người quản lý đọc và đối chiếu trong quá trình kiểm định.
                  </p>
                </div>

                {/* Score Card */}
                <div className="bg-slate-900/90 border border-slate-700 p-5 rounded-2xl text-center min-w-[210px] shadow-lg">
                  <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">ĐIỂM ĐÁNH GIÁ THỰC ĐƠN</div>
                  <div className={`text-4xl sm:text-5xl font-black mt-1 ${
                    evaluationResult.score >= 80 ? 'text-emerald-400' : 'text-rose-500'
                  }`}>
                    {evaluationResult.score}/100
                  </div>
                  <div className="text-xs font-bold text-amber-400 mt-2 flex items-center justify-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Phát hiện {evaluationResult.warnings.length} điểm cảnh báo</span>
                  </div>
                </div>
              </div>

              {/* 1. UPLOAD FILE THỰC ĐƠN TUẦN TẠI MỤC KIỂM ĐỊNH (EXCEL, CSV, ẢNH) */}
              <div className="bg-white rounded-2xl border border-teal-200 shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-teal-50 text-teal-700 rounded-xl">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">
                        1. Tải lên tệp thực đơn tuần cần kiểm định (Excel/ODS, CSV/TXT, Ảnh, PDF)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Bộ đọc thông minh: tự nhận diện ngày/ca/món từ mọi cấu trúc bảng của từng NCC; ảnh & PDF trích xuất bằng AI OCR.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setManualEntryOpen(v => !v)}
                      className={`px-3.5 py-1.5 font-bold text-xs rounded-xl border transition flex items-center space-x-1.5 ${manualEntryOpen ? 'bg-blue-50 text-(--vc-brand-2) border-(--vc-brand-2)/40' : 'bg-white text-slate-600 border-slate-200 hover:border-(--vc-brand-2) hover:text-(--vc-brand-2)'}`}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Nhập tay nhanh (dự phòng)</span>
                    </button>
                    <button
                      onClick={handleSaveCurrentWeekToArchive}
                      className="px-3.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs rounded-xl border border-teal-200 transition flex items-center space-x-1.5"
                    >
                      <History className="w-3.5 h-3.5 text-teal-600" />
                      <span>Lưu vào Lịch sử kiểm định</span>
                    </button>
                  </div>
                </div>

                {/* Upload drag & drop box */}
                <label className="border-2 border-dashed border-teal-300 bg-teal-50/20 hover:bg-teal-50/40 rounded-2xl p-6 text-center block cursor-pointer transition space-y-2">
                  <input
                    type="file"
                    accept=".xlsx,.xls,.ods,.csv,.txt,.pdf,.png,.jpg,.jpeg"
                    onChange={handleMenuFileUpload}
                    className="hidden"
                  />
                  <FileSpreadsheet className="w-10 h-10 text-teal-600 mx-auto" />
                  <div className="font-bold text-sm text-slate-900">
                    Bấm để chọn tệp: Excel (.xlsx / .xls / .ods), CSV, TXT, Ảnh (PNG/JPG) hoặc PDF
                  </div>
                  <div className="text-xs text-slate-500 max-w-lg mx-auto">
                    Tự nhận diện các hàng Thứ trong tuần (Thứ 2 → CN), ca ăn (Sáng/Trưa/Tối), món mặn, món chay và tráng miệng — kèm định lượng gram/ml. File trống hoặc cấu trúc lạ sẽ có hướng dẫn + map cột thủ công.
                  </div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {['.xlsx', '.xls', '.ods', '.csv', '.txt', '.pdf', '.png', '.jpg'].map(ext => (
                      <span key={ext} className="px-2 py-0.5 bg-white rounded-full border border-teal-200 text-[10px] font-black text-teal-800">{ext}</span>
                    ))}
                  </div>
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white rounded-full border border-teal-200 text-[11px] font-semibold text-teal-800 shadow-xs">
                    <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                    <span>Smart Parsing: khớp cấu trúc cột Thứ, Ca ăn, Món mặn, Món chay, Tráng miệng của mọi NCC</span>
                  </div>
                  <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white rounded-full border border-blue-200 text-[11px] font-semibold text-(--vc-brand-2) shadow-xs">
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Quét đa sheet: sheet trống sẽ tự bỏ qua, sheet nào có thực đơn dùng đó</span>
                  </div>
                </label>

                {/* FALLBACK: BẢNG NHẬP TAY NHANH (7 ngày × 3 bữa) */}
                {manualEntryOpen && (
                  <div className="rounded-2xl border-2 border-(--vc-brand-2)/40 bg-blue-50/40 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-(--vc-brand-2)/20 pb-2.5">
                      <div>
                        <div className="text-xs font-black text-slate-900">Bảng nhập tay nhanh — điền trực tiếp thực đơn tuần</div>
                        <div className="text-[10px] text-slate-500">
                          Mỗi ô một bữa, mỗi dòng một món (kèm định lượng nếu có). Dòng "Tráng miệng: ..." tự nhận; mặn/chay tự phân loại. Món chay ở sẵn ô riêng của nó. Tuần: <b>{getWeekRangeStr(weekStartDate)}</b>
                        </div>
                      </div>
                      <button
                        onClick={applyManualInspectionEntry}
                        className="px-3.5 py-2 bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-white rounded-xl text-xs font-bold shadow-md transition hover:brightness-110 shrink-0"
                      >
                        {manualReassignMode ? 'Lưu phân bổ lại vào file đang kiểm định' : 'Tạo thực đơn & đưa vào kiểm định'}
                      </button>
                    </div>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                      <table className="w-full text-[11px] border-collapse">
                        <thead>
                          <tr className="bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-blue-50 uppercase text-[10px] font-bold">
                            <th className="p-2 border border-blue-900/20 text-left w-24">Ngày</th>
                            <th className="p-2 border border-blue-900/20">Bữa sáng</th>
                            <th className="p-2 border border-blue-900/20">Bữa trưa</th>
                            <th className="p-2 border border-blue-900/20">Bữa tối</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getWeekDaysInfo(weekStartDate).map((dw, i) => (
                            <tr key={i} className={i % 2 ? 'bg-slate-50' : ''}>
                              <td className="p-2 border border-slate-100">
                                <div className="font-black text-slate-800">{dw.dayOfWeek}</div>
                                <div className="text-[9px] text-slate-400">{dw.dateStr}</div>
                              </td>
                              {(['sang', 'trua', 'toi'] as const).map(shift => (
                                <td key={shift} className="p-1.5 border border-slate-100 w-1/3">
                                  <textarea
                                    value={manualEntry[i]?.[shift] || ''}
                                    onChange={(e) => setManualShift(i, shift, e.target.value)}
                                    rows={3}
                                    placeholder={'Mỗi dòng 1 món, ví dụ:\nThịt kho củ cải (Thịt 45–50g)\nRau muống xào tỏi (70–80g)\nTráng miệng: Chuối (90–100g)'}
                                    className="w-full p-1.5 border border-slate-200 rounded-lg font-medium text-[10px] leading-snug focus:outline-none focus:border-(--vc-brand-2) focus:ring-1 focus:ring-blue-200 bg-white"
                                  />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* BANNER: file lỗi / sai cấu trúc — hướng dẫn chi tiết + map cột thủ công */}
                {fileIssue && (
                  <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
                    <div className="flex items-start space-x-2.5">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-(--vc-accent-1) to-(--vc-accent-2) shrink-0">
                        <AlertTriangle className="w-4 h-4 text-slate-950" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black text-slate-900">
                          Không đọc được <span className="font-mono">{fileIssue.fileName}</span>
                          {' '}({fileIssue.code === 'EMPTY_FILE' ? 'FILE TRỐNG' : fileIssue.code === 'UNKNOWN_STRUCTURE' ? 'SAI CẤU TRÚC BẢNG' : fileIssue.code === 'AI_ERROR' ? 'LỖI AI TRÍCH XUẤT' : fileIssue.code === 'UNSUPPORTED_MIME' ? 'ĐỊNH DẠNG CHƯA HỖ TRỢ' : 'LỖI DỮ LIỆU'})
                        </div>
                        <ul className="mt-1.5 space-y-1">
                          {fileIssue.guidance.map((g, i) => (
                            <li key={i} className="text-[11px] text-amber-900 leading-snug flex items-start space-x-1.5">
                              <span className="font-black text-orange-600">{i + 1}.</span>
                              <span>{g}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap items-center gap-2 mt-2.5">
                          {fileIssue.code === 'AI_ERROR' && pendingFile && (
                            <button
                              onClick={() => void processInspectionFile(pendingFile)}
                              className="px-3 py-1.5 bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 rounded-xl text-[11px] font-black hover:brightness-105 transition"
                            >
                              Thử lại AI
                            </button>
                          )}
                          <button onClick={() => setFileIssue(null)} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[11px] font-bold">
                            Đóng thông báo
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* MAP CỘT THỦ CÔNG */}
                    {sheetSnap && (
                      <div className="rounded-xl border border-teal-200 bg-white p-3.5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-slate-900">Chọn cột thủ công & phân tích lại</div>
                            <div className="text-[10px] text-slate-500">
                              {sheetSnap.fileName} • {sheetSnap.totalRows} dòng dữ liệu • xem preview bên dưới để xác định cột
                            </div>
                          </div>
                          <button
                            onClick={() => void reparseWithManualMap()}
                            disabled={remapping}
                            className="px-3.5 py-2 bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5 disabled:opacity-60"
                          >
                            {remapping ? 'Đang phân tích lại...' : 'Áp dụng & phân tích lại'}
                          </button>
                        </div>

                        {/* Bộ chọn cột */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                          {([
                            ['colMan', 'Cột Món mặn'],
                            ['colChay', 'Cột Món chay'],
                            ['colDessert', 'Cột Tráng miệng'],
                            ['colDay', 'Cột Thứ/Ngày'],
                            ['colShift', 'Cột Ca ăn (Sáng/Trưa/Tối)']
                          ] as Array<[keyof ManualColumnMap, string]>).map(([key, label]) => (
                            <label key={key} className="text-[10px] font-black text-slate-500 uppercase">
                              {label} *
                              <select
                                value={columnMap[key] === null ? '' : columnMap[key]}
                                onChange={(e) => setColumnMap(prev => ({ ...prev, [key]: e.target.value === '' ? null : Number(e.target.value) }))}
                                className="mt-1 w-full px-2 py-1.5 border-2 border-slate-200 rounded-lg text-xs font-bold bg-white focus:border-teal-500 focus:outline-none"
                              >
                                <option value="">— Không chọn —</option>
                                {sheetSnap.headers.map((h, i) => (
                                  <option key={i} value={i}>{colLetter(i)}{h ? `: ${h.slice(0, 24)}` : ''}</option>
                                ))}
                              </select>
                            </label>
                          ))}
                        </div>

                        {/* Preview dữ liệu */}
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                          <table className="w-full text-[10px] border-collapse">
                            <thead>
                              <tr className="bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-blue-50">
                                <th className="p-1.5 border border-blue-900/20">#</th>
                                {sheetSnap.headers.map((h, i) => (
                                  <th key={i} className={`p-1.5 border border-blue-900/20 min-w-[80px] max-w-[160px] ${
                                    ([columnMap.colMan, columnMap.colChay, columnMap.colDessert, columnMap.colDay, columnMap.colShift].includes(i))
                                      ? 'bg-amber-400 text-slate-950' : ''
                                  }`}>
                                    {colLetter(i)}{h ? ` · ${h.slice(0, 16)}` : ''}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {sheetSnap.sampleRows.map((row, r) => (
                                <tr key={r} className={r % 2 ? 'bg-slate-50' : ''}>
                                  <td className="p-1.5 border border-slate-100 text-slate-400 font-bold">{r + 1}</td>
                                  {sheetSnap.headers.map((_, c) => (
                                    <td key={c} className={`p-1.5 border border-slate-100 truncate max-w-[160px] ${
                                      ([columnMap.colMan, columnMap.colChay, columnMap.colDessert, columnMap.colDay, columnMap.colShift].includes(c))
                                        ? 'bg-amber-50 font-semibold text-slate-900' : 'text-slate-600'
                                    }`} title={row[c]}>{row[c] || '—'}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[10px] text-slate-500">
                          Cột viền vàng = đã chọn. Bắt buộc chọn cột Món mặn hoặc Món chay; khuyến nghị chọn cột Thứ/Ngày để món rơi đúng ngày.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* File thực đơn đang nạp kiểm định hiện tại */}
                {activeUploadedFile && (
                  <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-slate-900">{activeUploadedFile.fileName}</span>
                          <span className="px-2 py-0.2 bg-teal-200 text-teal-900 rounded font-bold text-[10px]">
                            {activeUploadedFile.fileType.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-teal-800 font-medium text-[11px] mt-0.5">
                          📅 Khoảng ngày áp dụng: <strong>{activeUploadedFile.dateRange}</strong> • Nhà cung cấp: <strong>{activeUploadedFile.vendorName || 'Tám Phương'}</strong> • {activeUploadedFile.menu.length * 3} ca ăn
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={openManualReassign}
                        className="px-2.5 py-1 bg-(--vc-brand-2) hover:brightness-110 text-white rounded-lg font-bold text-[11px] transition flex items-center space-x-1"
                        title="Cắt/di chuyển dòng món vào đúng Sáng / Trưa / Tối rồi lưu về file"
                      >
                        <Share2 className="w-3.5 h-3.5 text-amber-300" />
                        <span>Phân bổ lại ca</span>
                      </button>
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg font-bold text-[11px] flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Đang kiểm định</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. SỔ TAY QUY TẮC CHO QUẢN LÝ ĐỌC TRONG QUÁ TRÌNH KIỂM ĐỊNH (QUY TẮC ĐỊNH LƯỢNG & 23 MÓN CẤM MÙA HÈ) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-tight">
                        2. SỔ TAY QUY CHUẨN KIỂM ĐỊNH (QUẢN LÝ ĐỌC & ĐỐI CHIẾU)
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Người quản lý tra cứu các tiêu chí định lượng và danh mục cấm ngay tại đây trong lúc xem xét thực đơn
                      </p>
                    </div>
                  </div>

                  {/* Switch between Portion Rules and 23 Prohibited Summer Dishes */}
                  <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
                    <button
                      onClick={() => setEvalRuleTab('portions')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1.5 ${
                        evalRuleTab === 'portions' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600" />
                      <span>Quy tắc Định lượng (6 món)</span>
                    </button>
                    <button
                      onClick={() => setEvalRuleTab('summer23')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center space-x-1.5 ${
                        evalRuleTab === 'summer23' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>23 Món cấm mùa hè</span>
                    </button>
                  </div>
                </div>

                {/* Sub-view: Portion Rules */}
                {evalRuleTab === 'portions' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 font-medium">Bảng ngưỡng định lượng tiêu chuẩn Vincons:</span>
                      <button
                        onClick={() => {
                          setEditingRule(rules[0]);
                          setShowRuleEditModal(true);
                        }}
                        className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold rounded-lg border border-teal-200 transition"
                      >
                        ⚙️ Tùy chỉnh mức định lượng
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {rules.map(r => (
                        <div key={r.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-800">{r.title}</span>
                            <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 font-semibold text-[10px] border border-teal-200">
                              {r.badge}
                            </span>
                          </div>
                          <div className="text-base font-extrabold text-teal-900">
                            Tối thiểu: {r.minVal} {r.unit} trở lên
                          </div>
                          <div className="text-[10px] text-slate-500 leading-snug">
                            {r.positionDesc}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub-view: 23 Prohibited Summer Dishes */}
                {evalRuleTab === 'summer23' && (
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="text-xs text-rose-700 font-bold flex items-center space-x-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                        <span>Danh mục 23 món ăn có nguy cơ ôi thiu cao mùa nóng (Tuyệt đối không đưa vào thực đơn lán trại)</span>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={summerSearch}
                          onChange={(e) => setSummerSearch(e.target.value)}
                          placeholder="Tra cứu món cấm (vd: gà luộc, nấm...)"
                          className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                      {PROHIBITED_SUMMER_DISHES
                        .filter(p => p.name.toLowerCase().includes(summerSearch.toLowerCase()) || (p.note && p.note.toLowerCase().includes(summerSearch.toLowerCase())))
                        .map(p => (
                          <div key={p.id} className="p-2.5 rounded-xl border border-rose-100 bg-rose-50/30 flex items-start space-x-2 text-xs">
                            <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                              #{p.id}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-900">{p.name}</div>
                              {p.note && <div className="text-[10px] text-teal-800 font-semibold">{p.note}</div>}
                              <div className="text-[10px] text-slate-500 mt-0.5">💡 {p.recommendation}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 3. TÍNH NĂNG KIỂM TRA TRÙNG MÓN THEO FILE & NGÀY THÁNG */}
              <div className="bg-white rounded-2xl border border-amber-200 shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900">
                        3. Kiểm tra Trùng món so với các thực đơn tải lên khác (Theo ngày tháng & File)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Hệ thống tự động đối chiếu thực đơn đang chọn với các file thực đơn khác đã tải lên, phát hiện trùng lặp theo ngày tháng cụ thể.
                      </p>
                    </div>
                  </div>

                  <span className="px-3 py-1 bg-amber-50 text-amber-900 font-bold text-xs rounded-xl border border-amber-200">
                    Phát hiện {duplicateDishes.length} món lặp lại
                  </span>
                </div>

                {duplicateDishes.length === 0 ? (
                  <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2 border border-emerald-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>Thực đơn này hoàn toàn tươi mới! Không bị trùng lặp với các file thực đơn khác đã tải lên.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="overflow-x-auto border border-amber-200 rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-amber-50/80 text-amber-900 border-b uppercase text-[10px] font-bold">
                            <th className="p-3">Món ăn bị trùng</th>
                            <th className="p-3">Thực đơn đang chọn (Thứ / Ngày / Ca)</th>
                            <th className="p-3">Trùng ở file thực đơn nào (File & Ngày phục vụ)</th>
                            <th className="p-3 text-center">Số lần xuất hiện</th>
                            <th className="p-3 text-center">Đánh giá trùng lặp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {duplicateDishes.map((item, idx) => (
                            <tr key={idx} className="hover:bg-amber-50/30">
                              <td className="p-3 font-bold text-slate-900">
                                {item.dishName}
                              </td>
                              <td className="p-3">
                                <span className="font-semibold text-teal-800">{item.currentDay} {item.currentDateStr ? `(${item.currentDateStr})` : ''}</span> — <span className="text-slate-600 font-medium">{item.currentShift}</span>
                              </td>
                              <td className="p-3 space-y-1.5">
                                {item.occurrences.map((occ, oIdx) => (
                                  <div key={oIdx} className="text-slate-700 font-medium flex flex-wrap items-center gap-1.5">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold text-[10px] border border-slate-200">
                                      📄 {occ.fileName}
                                    </span>
                                    <span className="text-amber-900 font-bold">
                                      {occ.dateRange}:
                                    </span>
                                    <span className="text-slate-800">
                                      {occ.dayOfWeek} ({occ.dateStr}) — {occ.shift}
                                    </span>
                                  </div>
                                ))}
                              </td>
                              <td className="p-3 text-center font-bold text-amber-900">
                                {item.totalCount} lần
                              </td>
                              <td className="p-3 text-center">
                                {item.totalCount >= 3 ? (
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                                    Lặp nhiều (≥3 lần)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold text-[10px]">
                                    Chấp nhận được ({item.totalCount} lần)
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. BẢNG ĐÁNH GIÁ CHỈ RÕ VI PHẠM QUY TẮC NÀO VÀ QUY TẮC ĐÓ LÀ GÌ */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900 uppercase">
                      4. BẢNG ĐÁNH GIÁ CHI TIẾT ĐỊNH LƯỢNG & MÓN ĂN (CHỈ RÕ QUY TẮC VI PHẠM)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Hiển thị rõ ràng tên lỗi, quy chuẩn tham chiếu và nút điều chỉnh trực tiếp tên món hoặc gram đạm
                    </p>
                  </div>

                  <span className="px-2.5 py-1 bg-teal-50 text-teal-800 font-bold text-xs rounded-xl border border-teal-200">
                    {inspectionMatrix.length * 2}/14 ca chính đã kiểm định
                  </span>
                </div>

                {/* Warning details list */}
                <div className="space-y-3">
                  {inspectionMatrix.flatMap((day, dIdx) => [
                    { day, shiftName: 'Bữa trưa', detail: day.lunch, dIdx, shiftKey: 'lunch' as const },
                    { day, shiftName: 'Bữa tối', detail: day.dinner, dIdx, shiftKey: 'dinner' as const }
                  ]).map((item, idx) => {
                    const shiftTag = `${item.day.dayOfWeek} — ${item.shiftName}`;
                    const shiftWarnings = evaluationResult.warnings.filter(w => w.dayShift === shiftTag);
                    const hasViolations = shiftWarnings.length > 0;
                    const isExpanded = expandedWarningShift === shiftTag;

                    return (
                      <div
                        key={idx}
                        className={`border rounded-2xl p-4 transition space-y-3 ${
                          hasViolations
                            ? 'bg-rose-50/20 border-rose-200'
                            : 'bg-emerald-50/20 border-emerald-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100/80 pb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-extrabold text-sm text-slate-900">
                              {item.day.dayOfWeek} ({item.day.dateStr})
                            </span>
                            <span className="px-2 py-0.5 rounded-lg bg-teal-100 text-teal-800 font-bold text-xs">
                              {item.shiftName}
                            </span>
                            {hasViolations ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px] flex items-center space-x-1">
                                <AlertTriangle className="w-3 h-3" />
                                <span>Phát hiện {shiftWarnings.length} vi phạm</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px] flex items-center space-x-1">
                                <Check className="w-3 h-3" />
                                <span>Đạt chuẩn</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setShowEditMealModal({ dayIdx: item.dIdx, shiftKey: item.shiftKey, detail: item.detail })}
                              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200 transition flex items-center space-x-1"
                            >
                              <Edit3 className="w-3 h-3 text-blue-600" />
                              <span>Sửa món ca này</span>
                            </button>

                            {hasViolations && (
                              <button
                                onClick={() => setExpandedWarningShift(isExpanded ? null : shiftTag)}
                                className="px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-xs rounded-lg transition flex items-center space-x-1"
                              >
                                <span>{isExpanded ? 'Thu gọn lỗi' : 'Xem rõ quy tắc vi phạm'}</span>
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Dishes list */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <div className="font-bold text-slate-700 mb-1">MÓN MẶN:</div>
                            <div className="text-slate-800 leading-relaxed font-medium">
                              {item.detail.meatDishes.join(', ')}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">Tráng miệng: {item.detail.meatDessert}</div>
                          </div>

                          <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                            <div className="font-bold text-amber-800 mb-1">MÓN CHAY:</div>
                            <div className="text-slate-800 leading-relaxed font-medium">
                              {item.detail.vegDishes.join(', ')}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">Tráng miệng: {item.detail.vegDessert}</div>
                          </div>
                        </div>

                        {/* DETAILED VIOLATIONS CARD SPECIFYING EXACT RULE AND REQUIREMENT */}
                        {hasViolations && (isExpanded || true) && (
                          <div className="pt-2 space-y-2 border-t border-rose-100">
                            <div className="text-[11px] font-bold text-rose-900 uppercase">
                              Chi tiết vi phạm quy tắc an toàn & định lượng trong ca này:
                            </div>
                            {shiftWarnings.map(w => (
                              <div
                                key={w.id}
                                className="p-3 bg-white border border-rose-200 rounded-xl space-y-1 shadow-xs text-xs"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="px-2 py-0.5 rounded font-black text-[10px] bg-rose-600 text-white">
                                      {w.ruleTag}
                                    </span>
                                    <span className="font-extrabold text-rose-900">{w.ruleName}</span>
                                    <span className="text-slate-400">·</span>
                                    <span className="font-bold text-slate-900">Món: "{w.dishName}"</span>
                                  </div>
                                </div>

                                <div className="text-slate-700 font-medium">
                                  {w.message}
                                </div>

                                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                                  <strong className="text-slate-900">Quy chuẩn áp dụng:</strong> {w.ruleRequirement}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. QUẢN LÝ KHO TỆP THỰC ĐƠN TUẦN (NẠP KIỂM ĐỊNH, TRA CỨU & XÓA TRỰC TIẾP) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 space-y-5">
                {/* Header & Controls Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 bg-gradient-to-br from-teal-500 to-teal-700 text-white rounded-xl shadow-xs">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3 className="font-extrabold text-base text-slate-900 tracking-tight">
                          5. Quản lý kho tệp thực đơn tuần (Nạp kiểm định, Tra cứu & Xóa)
                        </h3>
                        <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 font-extrabold text-xs rounded-full">
                          {archives.length} file lưu trữ
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Lưu trữ thực đơn theo khoảng ngày thực tế. Chọn file để nạp dữ liệu kiểm định, so trùng 4 tuần và xóa trực tiếp để giải phóng bộ nhớ.
                      </p>
                    </div>
                  </div>

                  {/* Actions right */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                      <button
                        onClick={() => setArchiveViewMode('grid')}
                        className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center space-x-1 transition ${
                          archiveViewMode === 'grid'
                            ? 'bg-white text-teal-800 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="Xem dạng thẻ lưới trực quan"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Dạng thẻ</span>
                      </button>
                      <button
                        onClick={() => setArchiveViewMode('table')}
                        className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center space-x-1 transition ${
                          archiveViewMode === 'table'
                            ? 'bg-white text-teal-800 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                        title="Xem dạng bảng danh sách chi tiết"
                      >
                        <List className="w-3.5 h-3.5" />
                        <span>Dạng bảng</span>
                      </button>
                    </div>

                    {/* Lưu thực đơn hiện tại thành file mới */}
                    <button
                      onClick={handleSaveCurrentWeekToArchive}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center space-x-1.5"
                      title="Lưu phiên thực đơn hiện tại thành bản ghi mới trong kho"
                    >
                      <History className="w-3.5 h-3.5 text-teal-600" />
                      <span>Lưu bản ghi mới</span>
                    </button>

                    {/* Dọn dẹp file > 3 tháng */}
                    <button
                      onClick={handleRequestPurge}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition flex items-center space-x-1.5"
                      title="Dọn dẹp các file cũ hơn 3 tháng (giữ lại 4 file gần nhất)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Dọn dẹp &gt; 3 tháng</span>
                      {archives.length > 4 && (
                        <span className="ml-1 px-1.5 py-0.2 bg-rose-200 text-rose-800 rounded-full text-[10px]">
                          +{archives.length - 4}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Tổng file lưu trữ</span>
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="text-xl font-black text-slate-900">
                      {archives.length} <span className="text-xs font-semibold text-slate-500">tệp thực đơn</span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center space-x-2 pt-0.5">
                      <span className="text-emerald-700 font-semibold">{archives.filter(f => f.fileType === 'excel').length} Excel</span>
                      <span>•</span>
                      <span className="text-blue-700 font-semibold">{archives.filter(f => f.fileType === 'csv').length} CSV</span>
                      <span>•</span>
                      <span className="text-purple-700 font-semibold">{archives.filter(f => f.fileType === 'image').length} Ảnh</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-teal-50/60 rounded-xl border border-teal-200/80 space-y-1">
                    <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Tệp đang kiểm định</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                    <div className="text-xs font-extrabold text-teal-950 truncate" title={activeUploadedFile?.fileName}>
                      {activeUploadedFile?.fileName || 'Chưa chọn'}
                    </div>
                    <div className="text-[11px] font-bold text-teal-800 flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-teal-600" />
                      <span>{activeUploadedFile?.dateRange || '—'}</span>
                    </div>
                  </div>

                  <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-1">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Nhà cung cấp & Ca ăn</span>
                      <Utensils className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                    <div className="text-sm font-extrabold text-slate-800 truncate">
                      {activeUploadedFile?.vendorName || 'Tám Phương'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-medium">
                      {activeUploadedFile?.menu.length * 3 || 21} ca ăn (Sáng, Trưa, Tối)
                    </div>
                  </div>

                  <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-1">
                    <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
                      <span>Đối chiếu so trùng 4 tuần</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div className="text-xl font-black text-amber-900">
                      {duplicateDishes.length} <span className="text-xs font-semibold text-amber-700">món trùng</span>
                    </div>
                    <div className="text-[10px] text-amber-700 font-medium">
                      So sánh tự động với {Math.max(0, archives.length - 1)} file khác
                    </div>
                  </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm file theo tên, khoảng ngày (vd: 26/10), nhà cung cấp..."
                      value={archiveSearchTerm}
                      onChange={(e) => setArchiveSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-8 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    {archiveSearchTerm && (
                      <button
                        onClick={() => setArchiveSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center space-x-1.5 overflow-x-auto">
                    <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap pl-1">Loại tệp:</span>
                    {(['all', 'excel', 'csv', 'image'] as const).map(type => {
                      const count = type === 'all'
                        ? archives.length
                        : archives.filter(f => f.fileType === type).length;
                      const label = type === 'all' ? 'Tất cả' : type === 'excel' ? 'Excel' : type === 'csv' ? 'CSV' : 'Ảnh';
                      return (
                        <button
                          key={type}
                          onClick={() => setArchiveTypeFilter(type)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                            archiveTypeFilter === type
                              ? 'bg-teal-700 text-white shadow-xs'
                              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {label} ({count})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* FILE LIST VIEW */}
                {filteredArchives.length === 0 ? (
                  <div className="text-center py-10 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
                    <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="font-bold text-slate-700 text-sm">Không tìm thấy file thực đơn phù hợp</p>
                    <p className="text-xs text-slate-400">Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc để hiển thị toàn bộ.</p>
                    {(archiveSearchTerm || archiveTypeFilter !== 'all') && (
                      <button
                        onClick={() => { setArchiveSearchTerm(''); setArchiveTypeFilter('all'); }}
                        className="mt-2 px-3 py-1.5 bg-white border border-slate-200 text-teal-700 font-bold text-xs rounded-xl hover:bg-slate-100 transition shadow-xs"
                      >
                        Đặt lại bộ lọc
                      </button>
                    )}
                  </div>
                ) : archiveViewMode === 'grid' ? (
                  /* DẠNG THẺ LƯỚI TRỰC QUAN (CARD GRID) */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                    {filteredArchives.map((file) => {
                      const isSelected = selectedFileId === file.id;
                      const sampleLunchDishes = file.menu[0]?.lunch?.meatDishes?.slice(0, 2).join(', ') || 'Thực đơn tiêu chuẩn';

                      return (
                        <div
                          key={file.id}
                          className={`relative flex flex-col justify-between bg-white rounded-2xl p-4.5 border transition-all duration-200 ${
                            isSelected
                              ? 'border-teal-400 ring-2 ring-teal-500/20 bg-gradient-to-b from-teal-50/40 via-white to-white shadow-md'
                              : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                          }`}
                        >
                          {/* Card Header: Type badge & Status */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                              file.fileType === 'excel'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : file.fileType === 'csv'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}>
                              {file.fileType === 'excel' ? <FileSpreadsheet className="w-3 h-3 text-emerald-600" /> :
                               file.fileType === 'csv' ? <FileText className="w-3 h-3 text-blue-600" /> :
                               <Camera className="w-3 h-3 text-purple-600" />}
                              <span>{file.fileType}</span>
                            </span>

                            {isSelected ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-teal-600 text-white rounded-full font-extrabold text-[10px] shadow-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                <span>ĐANG KIỂM ĐỊNH</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold text-[10px]">
                                Sẵn sàng
                              </span>
                            )}
                          </div>

                          {/* Card Body: File Name & Dates */}
                          <div className="space-y-2.5 mb-4">
                            <div>
                              <h4
                                className="font-extrabold text-sm text-slate-900 leading-snug line-clamp-2 hover:text-teal-700 transition cursor-pointer"
                                onClick={() => handleSelectFile(file.id)}
                                title={file.fileName}
                              >
                                {file.fileName}
                              </h4>
                              <div className="flex items-center space-x-1 text-[11px] text-slate-400 font-medium mt-0.5">
                                <span>{file.fileSize || '38.0 KB'}</span>
                                <span>•</span>
                                <span>{file.menu.length * 3} ca ăn tuần</span>
                              </div>
                            </div>

                            {/* Date range banner */}
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                              <div className="flex items-center space-x-1.5 text-xs font-black text-slate-800">
                                <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                                <span>{file.dateRange}</span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span className="font-semibold text-teal-800 truncate">{file.vendorName || 'Tám Phương'}</span>
                                <span className="text-[10px] text-slate-400 shrink-0">{file.uploadedAt}</span>
                              </div>
                            </div>

                            {/* Dishes snippet */}
                            <div className="px-2.5 py-1.5 bg-teal-50/40 rounded-lg text-[11px] text-slate-600 border border-teal-100/60 truncate">
                              <span className="font-bold text-teal-900">Mẫu món: </span>
                              <span>{sampleLunchDishes}</span>
                            </div>
                          </div>

                          {/* Card Actions Footer */}
                          <div className="pt-3 border-t border-slate-100 flex items-center space-x-1.5">
                            {isSelected ? (
                              <div className="flex-1 py-2 px-3 bg-teal-100/80 text-teal-900 border border-teal-300 rounded-xl font-bold text-xs flex items-center justify-center space-x-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                                <span>Đang nạp</span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSelectFile(file.id)}
                                className="flex-1 py-2 px-3 bg-teal-700 hover:bg-teal-800 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center space-x-1.5"
                                title="Nạp thực đơn này vào hệ thống kiểm định"
                              >
                                <FileCheck className="w-3.5 h-3.5" />
                                <span>Chọn nạp</span>
                              </button>
                            )}

                            {/* Preview detail */}
                            <button
                              onClick={() => setPreviewArchiveFile(file)}
                              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                              title="Xem chi tiết thực đơn 7 ngày"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Delete button */}
                            <button
                              onClick={() => handleRequestDeleteFile(file)}
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl transition border border-rose-200"
                              title="Xóa tệp này khỏi hệ thống"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* DẠNG BẢNG CHI TIẾT (TABLE VIEW) */
                  <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-xs">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-100/90 text-slate-700 border-b border-slate-200 uppercase text-[10px] font-extrabold tracking-wider">
                          <th className="p-3.5">Tên file & Loại</th>
                          <th className="p-3.5">Khoảng ngày áp dụng</th>
                          <th className="p-3.5">Nhà cung cấp</th>
                          <th className="p-3.5">Thời điểm tải lên</th>
                          <th className="p-3.5 text-center">Trạng thái</th>
                          <th className="p-3.5 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredArchives.map((file) => {
                          const isSelected = selectedFileId === file.id;
                          return (
                            <tr
                              key={file.id}
                              className={`transition-colors ${
                                isSelected ? 'bg-teal-50/60' : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <td className="p-3.5">
                                <div className="flex items-center space-x-3">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                                    file.fileType === 'excel'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      : file.fileType === 'csv'
                                      ? 'bg-blue-50 text-blue-800 border-blue-200'
                                      : 'bg-purple-50 text-purple-800 border-purple-200'
                                  }`}>
                                    {file.fileType}
                                  </span>
                                  <div>
                                    <div
                                      onClick={() => handleSelectFile(file.id)}
                                      className="font-extrabold text-slate-900 hover:text-teal-700 cursor-pointer text-xs"
                                    >
                                      {file.fileName}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-medium">
                                      {file.fileSize || '38.0 KB'} • {file.menu.length * 3} ca ăn tuần
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3.5 font-bold text-slate-800">
                                <div className="flex items-center space-x-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                                  <span>{file.dateRange}</span>
                                </div>
                              </td>
                              <td className="p-3.5 font-bold text-teal-800">
                                {file.vendorName || 'Tám Phương'}
                              </td>
                              <td className="p-3.5 text-slate-500 font-medium text-[11px]">
                                {file.uploadedAt}
                              </td>
                              <td className="p-3.5 text-center">
                                {isSelected ? (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-teal-600 text-white rounded-full font-bold text-[10px] shadow-xs">
                                    <Check className="w-3 h-3" />
                                    <span>Đang kiểm định</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full font-medium text-[10px]">
                                    Sẵn sàng
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-right">
                                <div className="inline-flex items-center space-x-1.5">
                                  {!isSelected ? (
                                    <button
                                      onClick={() => handleSelectFile(file.id)}
                                      className="px-2.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg font-bold text-[11px] shadow-xs transition flex items-center space-x-1"
                                      title="Nạp thực đơn này vào hệ thống kiểm định"
                                    >
                                      <FileCheck className="w-3 h-3" />
                                      <span>Nạp ngay</span>
                                    </button>
                                  ) : (
                                    <span className="px-2.5 py-1.5 bg-teal-100 text-teal-800 border border-teal-300 rounded-lg font-bold text-[11px]">
                                      Đang nạp
                                    </span>
                                  )}
                                  <button
                                    onClick={() => setPreviewArchiveFile(file)}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                                    title="Xem chi tiết thực đơn 7 ngày"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleRequestDeleteFile(file)}
                                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold text-[11px] border border-rose-200 transition inline-flex items-center"
                                    title="Xóa tệp này khỏi hệ thống"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: BÁO CÁO SUẤT ĂN (CHỈ HIỂN THỊ RIGHT SIDEBAR TẠI ĐÂY) */}
          {activeTab === 'report' && (
            <div className="space-y-6">
              {/* Header Box — banner gradient enterprise */}
              <div className="bg-gradient-to-r from-(--vc-brand-1) via-(--vc-brand-2) to-(--vc-brand-3) rounded-2xl shadow-md p-5 space-y-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-amber-400/20 to-orange-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3 relative">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
                      <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                        HỆ THỐNG BÁO CÁO SUẤT ĂN · LÁN TRẠI HÓC MÔN
                      </h2>
                    </div>
                    <p className="text-xs text-blue-200 mt-0.5">
                      Dữ liệu thực đơn chuẩn 100% của 7 Nhà Cung Cấp. Nhập số lượng suất ăn & sao chép văn bản báo cáo chuẩn hóa chỉ với 1 nhấp chuột.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setActiveTab('menu')}
                      className="px-3.5 py-2 bg-white/10 hover:bg-white/20 backdrop-blur text-blue-50 font-bold text-xs rounded-xl transition border border-white/15 flex items-center space-x-1.5 shadow-sm"
                    >
                      <Utensils className="w-3.5 h-3.5 text-amber-300" />
                      <span>Ma trận tuần (21 ca)</span>
                    </button>

                    <button
                      onClick={() => {
                        setVendors(INITIAL_MEAL_VENDORS);
                        setPortionArchive(prev => {
                          const map: Record<string, VendorPortionTrio> = {};
                          INITIAL_MEAL_VENDORS.forEach(v => { map[v.id] = { td8: v.td8, td11_1: v.td11_1, td11_3: v.td11_3 }; });
                          return { ...prev, [reportShiftKey]: map };
                        });
                        showToast('Đã nạp lại số suất mẫu chuẩn cho buổi hiện tại!');
                      }}
                      className="px-3.5 py-2 bg-white/10 hover:bg-white/20 backdrop-blur text-blue-50 font-bold text-xs rounded-xl transition border border-white/15 flex items-center space-x-1.5 shadow-sm"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                      <span>Nạp lại menu chuẩn</span>
                    </button>

                    <button
                      onClick={() => setShowReportArchive(v => !v)}
                      className={`px-3.5 py-2 backdrop-blur font-bold text-xs rounded-xl transition flex items-center space-x-1.5 shadow-sm border ${showReportArchive ? 'bg-amber-400 text-slate-950 border-transparent' : 'bg-white/10 hover:bg-white/20 text-blue-50 border-white/15'}`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Quản lý file theo NCC</span>
                    </button>
                  </div>
                </div>

                {/* Quản lý file theo NCC — upload zone + danh sách lưu trữ (tab Báo cáo Suất ăn) */}
                {showReportArchive && (
                  <SupplierFileArchive
                    {...supplierArchiveCtrl}
                    jumpToInspection
                  />
                )}

                {/* Search Bar */}
                <div className="relative max-w-md">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-amber-300" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm món ăn, nhà cung cấp..."
                    className="w-full pl-9 pr-4 py-2 bg-white/10 backdrop-blur border border-white/20 focus:bg-white focus:text-slate-900 rounded-xl text-xs text-white placeholder-blue-200/70 focus:outline-none focus:ring-2 focus:ring-amber-400/60 focus:border-transparent transition"
                  />
                </div>
              </div>

              {/* Cảnh báo lệch suất nếu có */}
              {vendorPortionDiscrepancies.length > 0 && (
                <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center space-x-2 text-rose-700 font-bold text-sm">
                    <AlertTriangle className="w-5 h-5 text-rose-600" />
                    <span>CẢNH BÁO: PHÁT HIỆN LỆCH TỔNG SUẤT TẠI CÁC NHÀ CUNG CẤP!</span>
                  </div>
                  <div className="text-xs text-rose-600 space-y-1">
                    {vendorPortionDiscrepancies.map(item => (
                      <div key={item.vendorId} className="flex items-center justify-between bg-white/80 p-2 rounded-lg border border-rose-200">
                        <span className="font-bold">{item.vendorName}:</span>
                        <span>
                          Tổng tính toán (TĐ8 + TĐ11.1 + TĐ11.3) = <strong>{item.calculated}</strong> suất | Báo đặt khai báo = <strong>{item.expected}</strong> suất
                          (Chênh lệch: <strong className="text-rose-700">{item.diff > 0 ? `+${item.diff}` : item.diff}</strong> suất)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* BẢNG NHẬP & PHÂN BỔ SỐ LƯỢNG SUẤT ĂN */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">Bảng Nhập & Phân Bổ Số Lượng Suất Ăn</h3>
                      <p className="text-[11px] text-slate-400">
                        Số suất phân bổ THEO BỮI hiện tại — mỗi buổi (Sáng/Trưa/Tối) giữ bộ số riêng, không dùng chung số buổi trước
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleClearAllPortions}
                      className="group inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white hover:border-rose-600 text-xs font-bold transition shadow-xs active:scale-95"
                      title="Xóa nhanh toàn bộ số suất của bữa hiện tại (TĐ8/11.1/11.3 về 0)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa tất cả số suất</span>
                    </button>
                    <span className="px-2.5 py-1 bg-teal-50 text-teal-800 text-xs font-bold rounded-xl border border-teal-200">
                      Buổi: {reportShift} · {dayOfWeekStr} ({formattedDateStr})
                    </span>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200">
                      Đang chọn: {selectedVendorsForReport.length}/{vendors.length} NCC ({selectedExportMeals.toLocaleString('vi-VN')} suất)
                    </span>
                  </div>
                </div>

                {/* Quick Value Fill Preset Toolbar */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-700">Điền nhanh cho 1 NCC đang chọn:</span>
                    <select
                      value={quickFillColumn}
                      onChange={(e) => setQuickFillColumn(e.target.value as any)}
                      className="p-1.5 border rounded-lg bg-white font-bold text-teal-900 text-xs"
                    >
                      <option value="td8">Cột TĐ 8</option>
                      <option value="td11_1">Cột TĐ 11.1</option>
                      <option value="td11_3">Cột TĐ 11.3</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    {[50, 100, 150, 200, 500].map(val => (
                      <button
                        key={val}
                        onClick={() => handleQuickFillValue(val)}
                        className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition"
                      >
                        ={val}
                      </button>
                    ))}
                    <button
                      onClick={() => handleQuickFillValue(0)}
                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-xs font-bold text-rose-700 transition"
                    >
                      Đặt 0
                    </button>
                  </div>
                </div>

                {/* Interactive Table with - / + Stepper Buttons */}
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-gradient-to-r from-(--vc-brand-1) via-(--vc-brand-2) to-(--vc-brand-3) text-blue-50 border-b border-white/10 uppercase text-[10px] tracking-wider font-bold">
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedVendorsForReport.length === vendors.length}
                            onChange={() => {
                              if (selectedVendorsForReport.length === vendors.length) {
                                setSelectedVendorsForReport([vendors[0].id]);
                              } else {
                                setSelectedVendorsForReport(vendors.map(v => v.id));
                              }
                            }}
                            className="rounded accent-amber-400"
                          />
                        </th>
                        <th className="p-3">NHÀ CUNG CẤP</th>
                        <th className="p-3 text-center">TĐ 8</th>
                        <th className="p-3 text-center">TĐ 11.1</th>
                        <th className="p-3 text-center">TĐ 11.3</th>
                        <th className="p-3 text-right">TỔNG NCC</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {vendors
                        .filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()) || v.code.toLowerCase().includes(searchTerm.toLowerCase()))
                        .map(vendor => {
                          const isSelected = selectedVendorsForReport.includes(vendor.id);
                          const totalV = vendor.td8 + vendor.td11_1 + vendor.td11_3;

                          return (
                            <tr key={vendor.id} className={`hover:bg-blue-50/40 transition ${isSelected ? 'bg-blue-50/30' : ''}`}>
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelectedVendorsForReport(prev =>
                                      prev.includes(vendor.id) ? prev.filter(x => x !== vendor.id) : [...prev, vendor.id]
                                    );
                                  }}
                                  className="rounded accent-amber-400"
                                />
                              </td>

                              <td className="p-3">
                                <div className="flex items-center space-x-2">
                                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[10px] ${isSelected ? 'bg-gradient-to-br from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 shadow-sm' : 'bg-blue-950/90 text-amber-300'}`}>
                                    {vendor.code}
                                  </span>
                                  <div>
                                    <div className="font-bold text-slate-900">{vendor.name}</div>
                                    <div className="text-[10px] text-slate-400 font-medium">{vendor.ktx}</div>
                                  </div>
                                </div>
                              </td>

                              {/* TĐ 8 with stepper */}
                              <td className="p-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleAdjustPortion(vendor.id, 'td8', -10)}
                                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-(--vc-brand-2) hover:bg-blue-50 text-slate-600 hover:text-(--vc-brand-2) flex items-center justify-center shadow-xs active:scale-90 transition"
                                    title="Giảm 10 suất"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <input
                                    type="number"
                                    value={vendor.td8}
                                    onChange={(e) => updateVendorPortions(vendor.id, 'td8', Number(e.target.value))}
                                    className="w-14 sm:w-20 h-9 text-sm font-black text-center bg-white border-2 border-slate-200 hover:border-slate-300 rounded-lg focus:border-(--vc-brand-2) focus:ring-2 focus:ring-blue-200 focus:outline-none transition"
                                  />
                                  <button
                                    onClick={() => handleAdjustPortion(vendor.id, 'td8', 10)}
                                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-amber-500 hover:bg-amber-50 text-slate-600 hover:text-orange-600 flex items-center justify-center shadow-xs active:scale-90 transition"
                                    title="Tăng 10 suất"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>

                              {/* TĐ 11.1 with stepper */}
                              <td className="p-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleAdjustPortion(vendor.id, 'td11_1', -10)}
                                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-(--vc-brand-2) hover:bg-blue-50 text-slate-600 hover:text-(--vc-brand-2) flex items-center justify-center shadow-xs active:scale-90 transition"
                                    title="Giảm 10 suất"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <input
                                    type="number"
                                    value={vendor.td11_1}
                                    onChange={(e) => updateVendorPortions(vendor.id, 'td11_1', Number(e.target.value))}
                                    className="w-14 sm:w-20 h-9 text-sm font-black text-center bg-white border-2 border-slate-200 hover:border-slate-300 rounded-lg focus:border-(--vc-brand-2) focus:ring-2 focus:ring-blue-200 focus:outline-none transition text-blue-800"
                                  />
                                  <button
                                    onClick={() => handleAdjustPortion(vendor.id, 'td11_1', 10)}
                                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-amber-500 hover:bg-amber-50 text-slate-600 hover:text-orange-600 flex items-center justify-center shadow-xs active:scale-90 transition"
                                    title="Tăng 10 suất"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>

                              {/* TĐ 11.3 with stepper */}
                              <td className="p-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleAdjustPortion(vendor.id, 'td11_3', -10)}
                                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-(--vc-brand-2) hover:bg-blue-50 text-slate-600 hover:text-(--vc-brand-2) flex items-center justify-center shadow-xs active:scale-90 transition"
                                    title="Giảm 10 suất"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                  <input
                                    type="number"
                                    value={vendor.td11_3}
                                    onChange={(e) => updateVendorPortions(vendor.id, 'td11_3', Number(e.target.value))}
                                    className="w-14 sm:w-20 h-9 text-sm font-black text-center bg-white border-2 border-slate-200 hover:border-slate-300 rounded-lg focus:border-(--vc-brand-2) focus:ring-2 focus:ring-blue-200 focus:outline-none transition text-orange-700"
                                  />
                                  <button
                                    onClick={() => handleAdjustPortion(vendor.id, 'td11_3', 10)}
                                    className="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-amber-500 hover:bg-amber-50 text-slate-600 hover:text-orange-600 flex items-center justify-center shadow-xs active:scale-90 transition"
                                    title="Tăng 10 suất"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>

                              {/* TỔNG NCC */}
                              <td className="p-3 text-right font-extrabold text-sm">
                                {vendor.expectedTotal !== undefined && vendor.expectedTotal !== totalV ? (
                                  <div className="flex flex-col items-end">
                                    <span className="text-rose-600 font-black animate-pulse">
                                      {totalV.toLocaleString('vi-VN')}
                                    </span>
                                    <span className="text-[10px] text-rose-500 font-bold bg-rose-50 px-1 rounded">
                                      Lệch ({vendor.expectedTotal})
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-blue-950 text-amber-300 font-black">
                                    {totalV.toLocaleString('vi-VN')}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-(--vc-brand-2) to-(--vc-brand-3) text-white border-t-2 border-amber-400">
                        <td colSpan={2} className="p-3 uppercase text-[11px] font-black text-amber-300 tracking-wider">
                          Tổng cộng ({selectedVendorsForReport.length}/{vendors.length} NCC đang chọn)
                        </td>
                        <td className="p-3 text-center text-sm font-black text-amber-300 tabular-nums">
                          {selectedPortionTotals.td8.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-center text-sm font-black text-amber-300 tabular-nums">
                          {selectedPortionTotals.td11_1.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-center text-sm font-black text-amber-300 tabular-nums">
                          {selectedPortionTotals.td11_3.toLocaleString('vi-VN')}
                        </td>
                        <td className="p-3 text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-(--vc-accent-1) text-slate-950 font-black text-sm shadow-sm animate-pulse">
                            {selectedPortionTotals.grand.toLocaleString('vi-VN')}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* KHỐI 2: THỰC ĐƠN & CHỈNH SỬA TRỰC TIẾP MÓN ĂN */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                    <div>
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                        Thực Đơn & Chỉnh Sửa Trực Tiếp Món Ăn
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        Chỉnh sửa món mặn, món chay và tráng miệng theo từng nhà cung cấp
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Badge ca / ngày */}
                    <span className="px-3 py-1 bg-teal-50 text-teal-800 text-xs font-bold rounded-xl border border-teal-200">
                      {reportShift} · {dayOfWeekStr} ({formattedDateStr})
                    </span>

                    {/* Nút nạp lại menu gốc */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetVendor = vendors.find(v => v.id === activeVendorForEdit) || vendors[0];
                        // Nguồn: ma trận kiểm định (inspectionMatrix) — KHÁC nguồn với thực đơn riêng NCC
                        const dayData = inspectionMatrix.find(d => d.dayOfWeek === dayOfWeekStr) || inspectionMatrix[0];
                        const shiftKey = reportShift === 'Bữa sáng' ? 'breakfast' : reportShift === 'Bữa trưa' ? 'lunch' : 'dinner';
                        const originalDetail = JSON.parse(JSON.stringify(dayData[shiftKey])) as ShiftMealDetail;

                        // B1.4 — xác nhận nếu sẽ GHI ĐÈ slot đã có dữ liệu (nêu rõ nội dung bị thay)
                        const existing = getShiftDetail(supplierMenus, activeVendorForEdit, weekStartDate, reportDayIdx, reportShiftKey);
                        const willReplace = Boolean(existing && JSON.stringify(existing) !== JSON.stringify(originalDetail));
                        if (willReplace) {
                          const ok = confirm(
                            `"Nạp lại menu gốc" sẽ GHI ĐÈ thực đơn riêng của ${targetVendor.name} — ${dayOfWeekStr} (${reportShift}):\n\n` +
                            `• Hiện tại: ${describeMealDetail(existing)}\n` +
                            `• Sẽ thay bằng (nguồn ma trận kiểm định): ${describeMealDetail(originalDetail)}\n\n` +
                            `Tiếp tục?`
                          );
                          if (!ok) return;
                        }

                        updateVendorShiftDetail(activeVendorForEdit, reportDayIdx, reportDayShiftKey, originalDetail);
                        showToast(`Đã nạp lại menu gốc cho ${targetVendor.name}!`);
                      }}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      Nạp lại menu gốc ({vendors.find(v => v.id === activeVendorForEdit)?.name || 'Tám Phương'})
                    </button>

                    {/* Nút đỏ: Xóa món ca này */}
                    <button
                      type="button"
                      onClick={() => {
                        const targetVendor = vendors.find(v => v.id === activeVendorForEdit) || vendors[0];
                        if (confirm(`Bạn có chắc muốn xóa toàn bộ món ăn ca này của ${targetVendor.name}?`)) {
                          updateVendorShiftDetail(activeVendorForEdit, reportDayIdx, reportDayShiftKey, {
                            meatDishes: [],
                            meatDessert: '',
                            vegDishes: [],
                            vegDessert: ''
                          });
                          showToast(`Đã xóa toàn bộ món ca này của ${targetVendor.name}!`);
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition"
                    >
                      Xóa món ca này
                    </button>
                  </div>
                </div>

                {/* Hàng chip chọn NCC để xem/sửa */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Chọn NCC để xem/sửa:</span>
                    <span className="text-teal-800 font-extrabold text-[11px]">
                      Đang xem: {vendors.find(v => v.id === activeVendorForEdit)?.name} ({vendors.find(v => v.id === activeVendorForEdit)?.code})
                    </span>
                  </div>
                  <SupplierChips
                    vendors={vendors}
                    selectedVendorId={activeVendorForEdit}
                    onSelectVendor={(vId) => setActiveVendorForEdit(vId)}
                    showPortionCount={true}
                  />
                </div>

                {/* Hai cột: Suất ăn mặn & Suất ăn chay */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <MenuColumn
                    type="man"
                    vendorName={vendors.find(v => v.id === activeVendorForEdit)?.name || 'Tám Phương'}
                    dishes={reportMealsByVendorId[activeVendorForEdit]?.meatDishes || []}
                    dessert={reportMealsByVendorId[activeVendorForEdit]?.meatDessert || 'Trái cây theo mùa'}
                    onUpdateDishes={(newDishes) => {
                      updateVendorShiftDetail(activeVendorForEdit, reportDayIdx, reportDayShiftKey, {
                        ...reportMealsByVendorId[activeVendorForEdit],
                        meatDishes: newDishes
                      });
                    }}
                    onUpdateDessert={(newDessert) => {
                      updateVendorShiftDetail(activeVendorForEdit, reportDayIdx, reportDayShiftKey, {
                        ...reportMealsByVendorId[activeVendorForEdit],
                        meatDessert: newDessert
                      });
                    }}
                  />

                  <MenuColumn
                    type="chay"
                    vendorName={vendors.find(v => v.id === activeVendorForEdit)?.name || 'Tám Phương'}
                    dishes={reportMealsByVendorId[activeVendorForEdit]?.vegDishes || []}
                    dessert={reportMealsByVendorId[activeVendorForEdit]?.vegDessert || 'Trái cây theo mùa'}
                    onUpdateDishes={(newDishes) => {
                      updateVendorShiftDetail(activeVendorForEdit, reportDayIdx, reportDayShiftKey, {
                        ...reportMealsByVendorId[activeVendorForEdit],
                        vegDishes: newDishes
                      });
                    }}
                    onUpdateDessert={(newDessert) => {
                      updateVendorShiftDetail(activeVendorForEdit, reportDayIdx, reportDayShiftKey, {
                        ...reportMealsByVendorId[activeVendorForEdit],
                        vegDessert: newDessert
                      });
                    }}
                  />
                </div>
              </div>

              {/* KHỐI 3: VĂN BẢN BÁO CÁO CHUẨN HÓA · LÁN TRẠI HÓC MÔN */}
              <ReportBuilder
                vendors={vendors}
                shiftName={reportShift}
                dateFormattedStr={formattedDateStr}
                mealsByVendorId={reportMealsByVendorId}
                ktxZones={ktxZones}
                onChangeKtxZones={(next) => setKtxZones(next)}
                onEditVendorMenu={(vendorId) => {
                  setActiveVendorForEdit(vendorId);
                  showToast(`Đang chỉnh sửa thực đơn của ${vendors.find(v => v.id === vendorId)?.name}`);
                }}
                onToast={showToast}
              />
            </div>
          )}

          {/* TAB: THỰC ĐƠN NHÀ CUNG CẤP — hiển thị RIÊNG từng NCC từ CSDL supplier_menus */}
          {activeTab === 'menu' && !selectedVendorHasMenu ? (
            /* Trạng thái rỗng: NCC chưa có thực đơn riêng — KHÔNG fallback sang Tám Phương/NCC khác */
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 shadow-xs p-10 text-center space-y-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center">
                <FileSpreadsheet className="w-7 h-7 text-slate-400" />
              </div>
              <h3 className="text-sm font-extrabold text-slate-900">Chưa có thực đơn cho NCC này</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {vendors.find(v => v.id === selectedVendorForMenu)?.name} chưa có thực đơn nào trong tuần {getWeekRangeStr(weekStartDate)}.
                Hãy tải file thực đơn để bắt đầu — dữ liệu được lưu riêng cho NCC này, không ảnh hưởng NCC khác.
              </p>
              <button
                onClick={() => setAutomationWizard({
                  lockedVendorId: selectedVendorForMenu,
                  lockedVendorName: vendors.find(v => v.id === selectedVendorForMenu)?.name
                })}
                className="inline-flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 rounded-xl text-xs font-bold shadow-md transition hover:brightness-105"
              >
                <Upload className="w-4 h-4" />
                <span>Tải file thực đơn</span>
              </button>
            </div>
          ) : activeTab === 'menu' && (
            <WeeklyMenuTable
              vendors={vendors}
              selectedVendorId={selectedVendorForMenu}
              onSelectVendor={(vId) => setSelectedVendorForMenu(vId)}
              weeklyMenu={selectedVendorWeekMenu}
              onUpdateShiftMenu={(dayIdx, shiftKey, updatedDetail) => {
                // Ghi vào slot RIÊNG của NCC đang chọn trong CSDL supplier_menus (isolated) —
                // KHÔNG đụng ma trận kiểm định, KHÔNG đụng NCC khác
                updateVendorShiftDetail(selectedVendorForMenu, dayIdx, shiftKey, updatedDetail);
                showToast(`Đã cập nhật thực đơn của ${vendors.find(v => v.id === selectedVendorForMenu)?.name || 'NCC'}!`);
              }}
              onClearShiftMenu={(dayIdx, shiftKey) => {
                const targetDay = selectedVendorWeekMenu[dayIdx];
                const vendorName = vendors.find(v => v.id === selectedVendorForMenu)?.name || 'NCC';
                if (confirm(`Bạn có chắc muốn xóa món ăn ${shiftKey.toUpperCase()} của ${targetDay.dayOfWeek} (${vendorName})?`)) {
                  updateVendorShiftDetail(selectedVendorForMenu, dayIdx, shiftKey, {
                    meatDishes: [],
                    meatDessert: '',
                    vegDishes: [],
                    vegDessert: ''
                  });
                  showToast(`Đã xóa món ca này của ${vendorName}!`);
                }
              }}
              onLoadIntoReport={(dayOfWeek, dateStr, shiftKey, mealDetail) => {
                // 1. Chuyển ca tương ứng
                const shiftMap: Record<string, 'Bữa sáng' | 'Bữa trưa' | 'Bữa tối'> = {
                  breakfast: 'Bữa sáng',
                  lunch: 'Bữa trưa',
                  dinner: 'Bữa tối'
                };
                const newShift = shiftMap[shiftKey] || 'Bữa tối';

                // 2. Chuyển ngày tương ứng
                const foundDay = weekDays.find(w => w.dayOfWeek === dayOfWeek);
                const targetDayIdx = foundDay ? weekDays.indexOf(foundDay) : reportDayIdx;

                // 3. B1.4 — NẾU sẽ ghi đè slot đã có dữ liệu KHÁC → xác nhận nêu rõ nội dung bị thay
                const vendorName = vendors.find(v => v.id === selectedVendorForMenu)?.name || 'NCC';
                const existing = getShiftDetail(supplierMenus, selectedVendorForMenu, weekStartDate, targetDayIdx, shiftKeyFromDayKey(shiftKey));
                const incoming: ShiftMealDetail = JSON.parse(JSON.stringify(mealDetail));
                const willReplace = Boolean(existing && JSON.stringify(existing) !== JSON.stringify(incoming));
                if (willReplace) {
                  const ok = confirm(
                    `"Nạp vào báo cáo" sẽ GHI ĐÈ thực đơn riêng của ${vendorName} — ${dayOfWeek} (${newShift}):\n\n` +
                    `• Hiện tại: ${describeMealDetail(existing)}\n` +
                    `• Sẽ thay bằng: ${describeMealDetail(incoming)}\n\n` +
                    `Tiếp tục?`
                  );
                  if (!ok) return;
                }

                setReportShift(newShift);
                if (foundDay) {
                  setReportDate(foundDay.isoDate);
                }

                // 4. Ghi vào slot RIÊNG của NCC đang chọn (ngày + ca tương ứng) — không đụng NCC khác
                setActiveVendorForEdit(selectedVendorForMenu);
                updateVendorShiftDetail(selectedVendorForMenu, targetDayIdx, shiftKey, incoming);

                // 5. Chuyển tab sang Báo cáo suất ăn
                setActiveTab('report');
                showToast(`Đã nạp thực đơn ${dayOfWeek} (${newShift}) của ${vendorName} sang Báo cáo!`);
              }}
              onToast={showToast}
            />
          )}

          {/* TAB: KHÔNG GIAN NHÀ CUNG CẤP */}
          {activeTab === 'vendor' && (() => {
            const wsVendor = vendors.find(v => v.id === activeWorkspaceVendorId) || vendors[0];
            return (
              <VendorWorkspace
                vendor={wsVendor}
                vendors={vendors}
                onSelectVendor={setActiveWorkspaceVendorId}
                weekStart={weekStartDate}
                supplierMenus={supplierMenus}
                vendorArchives={archives.filter(f => f.vendorId === wsVendor.id)}
                allArchivesCount={archives.length}
                onOpenUploadWizard={(vid) => setAutomationWizard({
                  lockedVendorId: vid,
                  lockedVendorName: vendors.find(v => v.id === vid)?.name
                })}
                onSelectFile={handleSelectFile}
                onPreviewFile={(f) => setPreviewArchiveFile(f)}
                onDeleteFile={(f) => setFileToDelete(f)}
                onGoToReport={goToReportForVendor}
                onRunPortionCheck={runVendorPortionCheck}
                onToast={showToast}
              />
            );
          })()}

          {/* TAB: TỔNG QUAN HỆ THỐNG */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Tổng suất ăn ca hiện tại ({reportShift})</span>
                  <div className="text-3xl font-black text-teal-900 mt-2">{totalShiftMeals.toLocaleString('vi-VN')} suất</div>
                  <div className="text-xs text-slate-500 mt-1">Toàn bộ 7 nhà cung cấp tại KTX Hóc Môn</div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Phân bổ KTX 1 ({(ktxZones.KTX1 || []).length} NCC)</span>
                  <div className="text-3xl font-black text-blue-900 mt-2">
                    {vendors.filter(v => (ktxZones.KTX1 || []).includes(v.id)).reduce((a, b) => a + b.td8 + b.td11_1 + b.td11_3, 0).toLocaleString('vi-VN')} suất
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {(ktxZones.KTX1 || []).map(id => vendors.find(v => v.id === id)?.name).filter(Boolean).join(', ') || 'Chưa chọn NCC'}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Phân bổ KTX 2 ({(ktxZones.KTX2 || []).length} NCC)</span>
                  <div className="text-3xl font-black text-emerald-800 mt-2">
                    {vendors.filter(v => (ktxZones.KTX2 || []).includes(v.id)).reduce((a, b) => a + b.td8 + b.td11_1 + b.td11_3, 0).toLocaleString('vi-VN')} suất
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {(ktxZones.KTX2 || []).map(id => vendors.find(v => v.id === id)?.name).filter(Boolean).join(', ') || 'Chưa chọn NCC'}
                  </div>
                </div>
              </div>

              {/* 23 Món cấm card */}
              <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 uppercase tracking-tight">
                      DANH MỤC 23 MÓN ĂN KHÔNG ÁP DỤNG MÙA HÈ (NGUY CƠ ÔI/THIU)
                    </h3>
                    <p className="text-[11px] text-slate-500">Khuyến khích sử dụng các món kho, hầm, om cho công nhân hiện trường</p>
                  </div>
                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold text-xs rounded-xl">
                    23 Món Cấm
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs">
                  {PROHIBITED_SUMMER_DISHES.map(p => (
                    <div key={p.id} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start space-x-2">
                      <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {p.id}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        {p.note && <div className="text-[10px] text-teal-700 font-semibold">{p.note}</div>}
                        <div className="text-[10px] text-slate-400">{p.recommendation}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: THỐNG KÊ SỐ LIỆU */}
          {activeTab === 'statistics' && (
            <>
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-slate-900">Báo cáo Thống kê & Phân bổ Suất ăn KTX Hóc Môn</h3>
                  <p className="text-xs text-slate-500">Dữ liệu chi phí và lượng suất ăn theo từng nhà cung cấp</p>
                </div>
                <button
                  onClick={handleCopyZaloReport}
                  className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Xuất Báo Cáo Zalo</span>
                </button>
              </div>

              <div className="space-y-4 pt-2">
                {vendors.map(v => {
                  const total = v.td8 + v.td11_1 + v.td11_3;
                  const costPerShift = (total * v.price) / 1000000;
                  return (
                    <div key={v.id} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span>{v.name} ({v.ktx})</span>
                        <span className="text-teal-900">
                          {total.toLocaleString('vi-VN')} suất / ca ({costPerShift.toFixed(1)} triệu VNĐ)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-teal-500 to-slate-800 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min((total / 1500) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* QUẢN LÝ FILE THEO NCC — component dùng chung */}
            <SupplierFileArchive
              vendors={supplierArchiveCtrl.vendors}
              archives={supplierArchiveCtrl.archives}
              uploadVendor={supplierArchiveCtrl.uploadVendor}
              onUploadVendor={supplierArchiveCtrl.onUploadVendor}
              uploadWeek={supplierArchiveCtrl.uploadWeek}
              onUploadWeek={supplierArchiveCtrl.onUploadWeek}
              weekOptions={supplierArchiveCtrl.weekOptions}
              onProcessUpload={supplierArchiveCtrl.onProcessUpload}
              onActivate={supplierArchiveCtrl.onActivate}
              onPreview={supplierArchiveCtrl.onPreview}
              onDownload={supplierArchiveCtrl.onDownload}
              onDelete={supplierArchiveCtrl.onDelete}
              filter={supplierArchiveCtrl.filter}
              onFilter={supplierArchiveCtrl.onFilter}
            />            </>
          )}
        </div>

        {/* RIGHT SIDEBAR: BỘ ĐIỀU KHIỂN CA ĂN & DANH SÁCH 7 NCC - CHỈ HIỂN THỊ DUY NHẤT TẠI TAB BÁO CÁO SUẤT ĂN */}
        {activeTab === 'report' && (
          <aside className="w-full lg:w-80 bg-white border-l border-slate-200 p-4 space-y-4 shrink-0 lg:sticky lg:top-4 h-fit">
            {/* Card 1: BỘ ĐIỀU KHIỂN CA ĂN */}
            <div className="bg-(--vc-brand-1) text-white rounded-2xl p-4 space-y-4 shadow-sm border border-slate-700/50">
              <div className="flex items-center justify-between text-xs border-b border-slate-700/60 pb-2">
                <span className="font-bold tracking-wider text-teal-400 uppercase text-[10px]">BỘ ĐIỀU KHIỂN CA ĂN</span>
                <span className="text-slate-300 text-[11px] font-medium">Ký Túc Xá Hóc Môn</span>
              </div>

              {/* Shift pills via ShiftSelector */}
              <ShiftSelector
                selectedShift={reportShift}
                onSelectShift={(s) => setReportShift(s)}
              />

              {/* Ngày phục vụ: dropdown Thứ 2..CN kèm ngày (tính tự động) + nút sửa */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-400" />
                    <span className="font-semibold">Ngày phục vụ:</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const input = prompt('Nhập ngày phục vụ (định dạng YYYY-MM-DD):', reportDate);
                      if (input && !isNaN(Date.parse(input))) {
                        setReportDate(input);
                        const monday = getMondayOfDate(parseDateSafe(input));
                        setWeekStartDate(formatISODate(monday));
                        showToast(`Đã chuyển ngày phục vụ sang ${input}`);
                      }
                    }}
                    className="text-[11px] text-teal-300 hover:text-teal-200 font-bold underline cursor-pointer"
                  >
                    Sửa ngày
                  </button>
                </div>

                <select
                  value={reportDate}
                  onChange={(e) => {
                    const newDate = e.target.value;
                    setReportDate(newDate);
                    const monday = getMondayOfDate(parseDateSafe(newDate));
                    const mondayISO = formatISODate(monday);
                    if (mondayISO !== weekStartDate) {
                      setWeekStartDate(mondayISO);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-teal-300 focus:outline-none focus:border-teal-400 cursor-pointer"
                >
                  {weekDays.map(dw => (
                    <option key={dw.dayIndex} value={dw.isoDate} className="bg-slate-900 text-white">
                      {dw.dayOfWeek} ({dw.dateStr})
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift totals */}
              <div className="pt-2 border-t border-slate-700/60 space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">Tổng suất ca {reportShift}:</span>
                  <span className="font-extrabold text-base text-white">
                    {totalShiftMeals.toLocaleString('vi-VN')} <span className="text-xs font-normal text-slate-400">suất</span>
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Suất đang chọn xuất:</span>
                  <span className="font-bold text-teal-300">
                    {selectedExportMeals.toLocaleString('vi-VN')} suất ({selectedVendorsForReport.length} NCC)
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: DANH SÁCH NHÀ CUNG CẤP (7) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-xs text-slate-900 uppercase tracking-tight">
                    DANH SÁCH NHÀ CUNG CẤP ({vendors.length})
                  </h4>
                  <div className="text-[10px] text-slate-400">Nhấp để bật/tắt hiển thị trong báo cáo</div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  {selectedVendorsForReport.length} Bật
                </span>
              </div>

              <div className="space-y-2">
                {vendors.map(v => {
                  const isSelected = selectedVendorsForReport.includes(v.id);
                  const totalV = v.td8 + v.td11_1 + v.td11_3;

                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        setSelectedVendorsForReport(prev =>
                          prev.includes(v.id) ? (prev.length === 1 ? prev : prev.filter(x => x !== v.id)) : [...prev, v.id]
                        );
                      }}
                      className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-teal-50/40 border-teal-500 shadow-xs ring-1 ring-teal-500/30'
                          : 'bg-white border-slate-100 text-slate-400 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 flex-1 min-w-0 pr-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${
                          isSelected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-400'
                        }`}>
                          {v.code}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5">
                            <span className={`text-xs font-bold truncate ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                              {v.name}
                            </span>
                            <span className="text-[9px] text-slate-400 font-semibold">{v.ktx}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            TĐ8: {v.td8} · 11.1: {v.td11_1} · 11.3: {v.td11_3}
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${
                        isSelected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {totalV}s
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleCopyZaloReport}
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center justify-center space-x-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Sao chép gửi Zalo toàn bộ</span>
              </button>
            </div>
          </aside>
        )}
      </main>

      {/* MODAL: CHỈNH SỬA QUY TẮC ĐỊNH LƯỢNG */}
      {showRuleEditModal && editingRule && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">Tùy chỉnh định lượng yêu cầu</h3>
              <button onClick={() => setShowRuleEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {rules.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                  <span className="font-semibold text-slate-700">{r.title}:</span>
                  <div className="flex items-center space-x-1.5">
                    <input
                      type="number"
                      value={r.minVal}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setRules(rules.map((rule, idx) => idx === i ? { ...rule, minVal: val } : rule));
                      }}
                      className="w-16 p-1 border rounded text-center font-bold"
                    />
                    <span className="text-slate-500 font-semibold">{r.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => {
                  setShowRuleEditModal(false);
                  showToast('Đã lưu quy tắc định lượng mới!');
                }}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition"
              >
                Lưu & Đánh giá lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SỬA MÓN ĂN CA */}
      {showEditMealModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-sm text-slate-900">
                Chỉnh sửa món ăn ({inspectionMatrix[showEditMealModal.dayIdx]?.dayOfWeek} - {showEditMealModal.shiftKey.toUpperCase()})
              </h3>
              <button onClick={() => setShowEditMealModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Danh sách món mặn (ngăn cách bởi dấu phẩy):</label>
                <textarea
                  rows={4}
                  value={showEditMealModal.detail.meatDishes.join(', ')}
                  onChange={(e) => {
                    const newDishes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    setShowEditMealModal({
                      ...showEditMealModal,
                      detail: { ...showEditMealModal.detail, meatDishes: newDishes }
                    });
                  }}
                  className="w-full p-2.5 border rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-amber-800 mb-1">Danh sách món chay (ngăn cách bởi dấu phẩy):</label>
                <textarea
                  rows={3}
                  value={showEditMealModal.detail.vegDishes.join(', ')}
                  onChange={(e) => {
                    const newDishes = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    setShowEditMealModal({
                      ...showEditMealModal,
                      detail: { ...showEditMealModal.detail, vegDishes: newDishes }
                    });
                  }}
                  className="w-full p-2.5 border rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tráng miệng:</label>
                <input
                  type="text"
                  value={showEditMealModal.detail.meatDessert || ''}
                  onChange={(e) => setShowEditMealModal({
                    ...showEditMealModal,
                    detail: { ...showEditMealModal.detail, meatDessert: e.target.value }
                  })}
                  className="w-full p-2 border rounded-xl font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowEditMealModal(null)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  const updatedMenu = [...inspectionMatrix];
                  updatedMenu[showEditMealModal.dayIdx][showEditMealModal.shiftKey] = showEditMealModal.detail;
                  setInspectionMatrix(updatedMenu);
                  // Ghi song song vào CSDL supplier_menus của NCC đang xem ma trận
                  updateVendorShiftDetail(matrixOwnerVendorId, showEditMealModal.dayIdx, showEditMealModal.shiftKey, showEditMealModal.detail);
                  setShowEditMealModal(null);
                  showToast('Đã cập nhật thực đơn thành công!');
                }}
                className="px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition"
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PANEL: QUẢN LÝ TỆP THỰC ĐƠN — mở được từ MỌI tab */}
      <MenuFilePanel
        open={menuFilePanelOpen}
        onClose={() => setMenuFilePanelOpen(false)}
        archives={archives}
        vendors={vendors}
        weekOptions={archiveWeekOptions}
        defaultWeek={weekStartDate}
        onUploadFile={handlePanelUpload}
        onApplyFile={handlePanelApplyFile}
        onPreviewFile={(f) => setPreviewArchiveFile(f)}
        onDeleteFile={(f) => setFileToDelete(f)}
      />

      {/* MODAL: TỰ ĐỘNG HÓA BÁO CÁO — Wizard 4 bước trích xuất thực đơn AI */}
      {automationWizard && (
        <MenuUploadWizard
          open
          onClose={() => setAutomationWizard(null)}
          weekStartDate={weekStartDate}
          currentMenu={inspectionMatrix}
          onApply={handleWizardApply}
          lockedVendorId={automationWizard.lockedVendorId}
          lockedVendorName={automationWizard.lockedVendorName}
        />
      )}

      {/* BANNER: HOÀN TÁC ÁP DỤNG THỰC ĐƠN (30 phút) */}
      {undoInfo && (
        <div className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100%-2rem)] sm:w-auto sm:max-w-md bg-slate-900 text-white rounded-2xl shadow-2xl p-3.5 flex items-center space-x-3 border border-slate-700">
          <div className="p-2 bg-amber-500/20 rounded-xl shrink-0">
            <Undo2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold">Đã áp dụng thực đơn mới</div>
            <div className="text-[11px] text-slate-300">Có thể hoàn tác trong {Math.max(0, Math.ceil((undoInfo.expiresAt - Date.now()) / 60000))} phút.</div>
          </div>
          <button
            onClick={handleUndoApply}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-[0.98] text-slate-900 rounded-xl text-xs font-black transition shrink-0"
          >
            Hoàn tác
          </button>
          <button
            onClick={() => { discardUndoSnapshot(); setUndoInfo(null); }}
            className="p-1.5 text-slate-400 hover:text-white transition shrink-0"
            title="Bỏ qua"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* MODAL: XÁC NHẬN XÓA FILE THỰC ĐƠN */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Xác nhận xóa file thực đơn</h3>
                <p className="text-[11px] text-slate-400">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa file thực đơn này khỏi hệ thống? File sẽ bị gỡ bỏ hoàn toàn và không còn tham gia đối chiếu so trùng 4 tuần.
            </p>

            {/* File info preview */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                  fileToDelete.fileType === 'excel' ? 'bg-emerald-100 text-emerald-800' :
                  fileToDelete.fileType === 'csv' ? 'bg-blue-100 text-blue-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {fileToDelete.fileType}
                </span>
                <span className="font-bold text-xs text-slate-900 truncate" title={fileToDelete.fileName}>
                  {fileToDelete.fileName}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-200/60">
                <div>
                  <span className="text-slate-400">Khoảng ngày:</span>{' '}
                  <span className="font-bold text-slate-800">{fileToDelete.dateRange}</span>
                </div>
                <div>
                  <span className="text-slate-400">Nhà cung cấp:</span>{' '}
                  <span className="font-bold text-slate-800">{fileToDelete.vendorName || 'Tám Phương'}</span>
                </div>
              </div>
            </div>

            {selectedFileId === fileToDelete.id && (
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 font-medium flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>File này hiện đang được kích hoạt kiểm định. Nếu xóa, hệ thống sẽ tự động chuyển sang file thực đơn khả dụng kế tiếp.</span>
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executeDeleteFile}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa vĩnh viễn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DỌN DẸP FILE > 3 THÁNG */}
      {showPurgeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-5 sm:p-6 space-y-4 border border-slate-100">
            <div className="flex items-center space-x-3 text-rose-600 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">Dọn dẹp file thực đơn cũ (&gt; 3 tháng)</h3>
                <p className="text-[11px] text-slate-400">Tối ưu dung lượng lưu trữ hệ thống</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Theo quy chuẩn vận hành KTX Hóc Môn, sau mỗi 3 tháng quản lý có thể thanh lọc các file thực đơn cũ để giải phóng bộ nhớ. Hệ thống sẽ giữ lại <strong>4 file thực đơn gần nhất</strong> và xóa các bản ghi cũ hơn.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Tổng số file hiện có:</span>
                <strong className="text-slate-900">{archives.length} file</strong>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>Số file cũ sẽ dọn dẹp:</span>
                <strong>{Math.max(0, archives.length - 4)} file</strong>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Số file giữ lại kiểm định:</span>
                <strong>4 file gần nhất</strong>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowPurgeModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={executePurgeOldArchives}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Tiến hành dọn dẹp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XEM CHI TIẾT THỰC ĐƠN TRONG TỆP (PREVIEW MODAL) */}
      {previewArchiveFile && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className={`p-2.5 rounded-xl ${
                  previewArchiveFile.fileType === 'excel' ? 'bg-emerald-100 text-emerald-800' :
                  previewArchiveFile.fileType === 'csv' ? 'bg-blue-100 text-blue-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 truncate max-w-md">
                      {previewArchiveFile.fileName}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                      {previewArchiveFile.fileType}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    Áp dụng: <strong className="text-teal-800">{previewArchiveFile.dateRange}</strong> • Nhà cung cấp: <strong className="text-slate-800">{previewArchiveFile.vendorName}</strong> • {previewArchiveFile.menu.length * 3} ca ăn
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {selectedFileId !== previewArchiveFile.id ? (
                  <button
                    onClick={() => {
                      handleSelectFile(previewArchiveFile.id);
                      setPreviewArchiveFile(null);
                    }}
                    className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-xs"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    <span>Nạp vào kiểm định ngay</span>
                  </button>
                ) : (
                  <span className="px-3 py-1.5 bg-teal-100 text-teal-800 font-bold text-xs rounded-xl border border-teal-300">
                    ✓ Đang kiểm định file này
                  </span>
                )}
                <button
                  onClick={() => setPreviewArchiveFile(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Scrollable 7-day preview */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {previewArchiveFile.menu.map((dayItem, dIdx) => (
                  <div key={dIdx} className="bg-slate-50/70 rounded-xl p-3.5 border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="font-extrabold text-xs text-slate-900">{dayItem.dayOfWeek}</span>
                      <span className="text-[11px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                        {dayItem.dateStr}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Sáng */}
                      <div className="p-2 bg-white rounded-lg border border-slate-100 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Bữa sáng:</span>
                        <div className="text-slate-800 font-medium">
                          {dayItem.breakfast.meatDishes.join(', ') || 'Chưa cập nhật'}
                        </div>
                      </div>

                      {/* Trưa */}
                      <div className="p-2 bg-white rounded-lg border border-slate-100 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">Bữa trưa:</span>
                        <div className="text-slate-800 font-semibold">
                          Mặn: {dayItem.lunch.meatDishes.join('; ') || '—'}
                        </div>
                        <div className="text-slate-600 text-[11px]">
                          Xào/Canh: {dayItem.lunch.vegDishes.join('; ') || '—'}
                        </div>
                        <div className="text-slate-400 text-[10px]">
                          Tráng miệng: {dayItem.lunch.meatDessert || 'Trái cây'}
                        </div>
                      </div>

                      {/* Tối */}
                      <div className="p-2 bg-white rounded-lg border border-slate-100 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Bữa tối:</span>
                        <div className="text-slate-800 font-semibold">
                          Mặn: {dayItem.dinner.meatDishes.join('; ') || '—'}
                        </div>
                        <div className="text-slate-600 text-[11px]">
                          Xào/Canh: {dayItem.dinner.vegDishes.join('; ') || '—'}
                        </div>
                        <div className="text-slate-400 text-[10px]">
                          Tráng miệng: {dayItem.dinner.meatDessert || 'Trái cây'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Toàn bộ dữ liệu hiển thị theo bảng thực đơn gốc được lưu trữ trong tệp.
              </span>
              <button
                onClick={() => setPreviewArchiveFile(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
