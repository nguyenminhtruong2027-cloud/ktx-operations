// src/meals/menuSyncBus.ts
// EVENT BUS đồng bộ dữ liệu thực đơn (menuFiles / supplier_menus / archives):
// • Trong app: CustomEvent — mọi tab/component cùng cây React tự cập nhật ngay lập tức.
// • Liên cửa sổ/module khác: ping qua localStorage + sự kiện 'storage' của trình duyệt.
// Nguyên tắc: CHỈ phát tín hiệu & thông báo — không ghi/xóa dữ liệu nghiệp vụ nào.

export const MENU_SYNC_EVENT = 'vincons:menu-sync';
export const MENU_SYNC_PING_KEY = 'meals_sync_ping_v1';

const SOURCE_ID = `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export type MenuSyncKind = 'supplier_menus' | 'archives' | 'menu-apply';

export interface MenuSyncDetail {
  sourceId: string;
  kind: MenuSyncKind;
  at: number;
}

/** Phát tín hiệu "dữ liệu thực đơn vừa thay đổi" tới mọi tab/cửa sổ */
export function broadcastMenuSync(kind: MenuSyncKind) {
  const detail: MenuSyncDetail = { sourceId: SOURCE_ID, kind, at: Date.now() };
  try {
    window.dispatchEvent(new CustomEvent(MENU_SYNC_EVENT, { detail }));
  } catch { /* môi trường không có window */ }
  try {
    // Ping qua localStorage để các cửa sổ/module khác bắt được qua 'storage' event
    localStorage.setItem(MENU_SYNC_PING_KEY, JSON.stringify(detail));
  } catch { /* localStorage không khả dụng */ }
}

/**
 * Lắng nghe thay đổi dữ liệu thực đơn.
 * `fromSelf === true` khi tín hiệu do chính cây React này phát (state đã tự cập nhật).
 * Trả về hàm hủy đăng ký.
 */
export function subscribeMenuSync(handler: (kind: MenuSyncKind, fromSelf: boolean) => void): () => void {
  const onCustom = (e: Event) => {
    const d = (e as CustomEvent<MenuSyncDetail>).detail;
    if (!d) return;
    handler(d.kind, d.sourceId === SOURCE_ID);
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== MENU_SYNC_PING_KEY || !e.newValue) return;
    try {
      const d = JSON.parse(e.newValue) as MenuSyncDetail;
      handler(d.kind, d.sourceId === SOURCE_ID);
    } catch { /* dữ liệu ping hỏng — bỏ qua */ }
  };
  window.addEventListener(MENU_SYNC_EVENT, onCustom);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(MENU_SYNC_EVENT, onCustom);
    window.removeEventListener('storage', onStorage);
  };
}
