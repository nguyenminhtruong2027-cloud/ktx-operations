// src/meals/cloudSync.ts
// B3 — ĐỒNG BỘ ĐÁM MÂY HYBRID (Firebase Firestore):
// • Có mạng + Firebase cấu hình → realtime qua Firestore (onSnapshot) để các thiết bị
//   quản lý/bếp khác cùng xem; thay đổi cục bộ được đẩy lên (upsert, không xóa).
// • Mất mạng / Firebase chưa cấu hình / lỗi → FALLBACK AN TOÀN về localStorage hiện có.
// • Nguyên tắc bất di bất dịch: KHÔNG xóa, KHÔNG ghi đè mất dữ liệu cục bộ —
//   merge 1 chiều, cùng bản ghi thì updatedAt mới hơn thắng; bản ghi cục bộ luôn được giữ.

import {
  collection,
  doc,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../utils/firebase';
import { loadStore } from './supplierMenuStore';
import { subscribeMenuSync } from './menuSyncBus';
import type { SupplierMenuDB, SupplierMenuEntry, UploadedMenuFile } from './types';

const COLLECTION_MENUS = 'supplier_menus';
const COLLECTION_ARCHIVES = 'menu_archives';
const PUSHED_MAP_KEY = 'meals_cloud_pushed_v1';
const ARCHIVES_STORAGE_KEY = 'meals_weekly_archives_v11';

export interface CloudSyncStatus {
  enabled: boolean;
  reason: string;
  lastPushAt: number | null;
  lastError: string | null;
}

const status: CloudSyncStatus = {
  enabled: false,
  reason: 'chưa khởi tạo',
  lastPushAt: null,
  lastError: null
};

export function getCloudStatus(): CloudSyncStatus {
  return { ...status };
}

// ===== Merge AN TOÀN dữ liệu từ mây vào cục bộ (không bao giờ làm mất local) =====

export function mergeSupplierMenus(local: SupplierMenuDB, remote: SupplierMenuDB): SupplierMenuDB {
  const merged: SupplierMenuDB = { ...local };
  for (const [id, remoteEntry] of Object.entries(remote || {})) {
    const localEntry = merged[id];
    if (!localEntry) {
      merged[id] = remoteEntry; // bản ghi chỉ có trên mây → thêm vào
      continue;
    }
    // Cùng bản ghi: updatedAt mới hơn thắng — bản ghi cục bộ không bao giờ bị mất
    const remoteAt = Number(remoteEntry?.updatedAt || 0);
    const localAt = Number(localEntry?.updatedAt || 0);
    if (remoteAt > localAt) merged[id] = remoteEntry;
  }
  return merged;
}

export function mergeArchives(local: UploadedMenuFile[], remote: UploadedMenuFile[]): UploadedMenuFile[] {
  const byId = new Map<string, UploadedMenuFile>();
  (local || []).forEach(f => byId.set(f.id, f));
  (remote || []).forEach(f => {
    if (!byId.has(f.id)) byId.set(f.id, f); // chỉ THÊM bản ghi mới từ mây — không ghi đè cục bộ
  });
  return Array.from(byId.values());
}

// ===== Đẩy thay đổi cục bộ lên Firestore (upsert — không xóa gì trên mây lẫn local) =====

let applyingRemote = false;

function sanitize(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)); // loại bỏ undefined cho an toàn Firestore
}

function loadPushedMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(PUSHED_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePushedMap(map: Record<string, string>) {
  try {
    localStorage.setItem(PUSHED_MAP_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

async function pushLocalToCloud() {
  if (!db || applyingRemote) return;
  const pushed = loadPushedMap();

  // 1) supplier_menus
  try {
    const entries = Object.values(loadStore());
    for (const entry of entries as SupplierMenuEntry[]) {
      const key = `m:${entry.id}`;
      const stamp = String(entry.updatedAt || 0);
      if (pushed[key] === stamp) continue;
      await setDoc(doc(db, COLLECTION_MENUS, entry.id), sanitize(entry), { merge: true });
      pushed[key] = stamp;
    }
  } catch (err) {
    status.lastError = err instanceof Error ? err.message : String(err);
    return; // offline/lỗi → giữ nguyên local, lần broadcast sau sẽ đẩy tiếp
  }

  // 2) menu_archives
  try {
    const raw = localStorage.getItem(ARCHIVES_STORAGE_KEY);
    const archives: UploadedMenuFile[] = raw ? JSON.parse(raw) : [];
    for (const f of archives) {
      const key = `a:${f.id}`;
      const stamp = `${f.uploadedAt}|${f.isActive ? 1 : 0}|${f.menu.length}`;
      if (pushed[key] === stamp) continue;
      await setDoc(doc(db, COLLECTION_ARCHIVES, f.id), sanitize(f), { merge: true });
      pushed[key] = stamp;
    }
  } catch (err) {
    status.lastError = err instanceof Error ? err.message : String(err);
    return;
  }

  savePushedMap(pushed);
  status.lastPushAt = Date.now();
  status.lastError = null;
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void pushLocalToCloud();
  }, 600); // gom nhiều thay đổi trong 1 lần đẩy
}

// ===== Khởi động đồng bộ (hybrid/fallback) =====

export function startCloudSync(handlers: {
  onSupplierMenus: (remote: SupplierMenuDB) => void;
  onArchives: (remote: UploadedMenuFile[]) => void;
}): () => void {
  // Fallback an toàn: Firebase chưa cấu hình → CHỈ dùng localStorage, app chạy bình thường
  if (!isFirebaseConfigured || !db) {
    status.enabled = false;
    status.reason = 'Firebase chưa cấu hình — dữ liệu lưu cục bộ (localStorage)';
    return () => { /* nothing to clean */ };
  }

  status.enabled = true;
  status.reason = 'Đồng bộ realtime qua Firestore';

  // Lắng nghe thay đổi từ mây (realtime) → merge an toàn vào state cục bộ
  const unsubMenus = onSnapshot(collection(db, COLLECTION_MENUS), (snap) => {
    applyingRemote = true;
    try {
      const remote: SupplierMenuDB = {};
      snap.forEach(d => {
        remote[d.id] = d.data() as SupplierMenuEntry;
      });
      handlers.onSupplierMenus(remote);
      status.lastError = null;
    } finally {
      setTimeout(() => { applyingRemote = false; }, 0);
    }
  }, (err) => {
    status.lastError = err instanceof Error ? err.message : String(err);
  });

  const unsubArchives = onSnapshot(collection(db, COLLECTION_ARCHIVES), (snap) => {
    applyingRemote = true;
    try {
      const remote: UploadedMenuFile[] = [];
      snap.forEach(d => {
        remote.push(d.data() as UploadedMenuFile);
      });
      handlers.onArchives(remote);
      status.lastError = null;
    } finally {
      setTimeout(() => { applyingRemote = false; }, 0);
    }
  }, (err) => {
    status.lastError = err instanceof Error ? err.message : String(err);
  });

  // Đẩy thay đổi cục bộ lên mây khi có tín hiệu từ Event Bus (B2)
  const unsubBus = subscribeMenuSync((kind, fromSelf) => {
    if (kind === 'supplier_menus' || kind === 'archives' || kind === 'menu-apply') {
      // kể cả fromSelf (thay đổi cục bộ) — chính là lúc cần đẩy lên mây
      schedulePush();
    }
    void fromSelf;
  });

  // Đẩy lần đầu toàn bộ dữ liệu hiện có (upsert — không ghi đè mất gì)
  schedulePush();

  return () => {
    unsubMenus();
    unsubArchives();
    unsubBus();
    if (pushTimer) clearTimeout(pushTimer);
    status.enabled = false;
    status.reason = 'đã dừng đồng bộ';
  };
}
