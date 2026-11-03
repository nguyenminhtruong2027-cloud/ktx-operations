// src/utils/theme.ts
// Bộ chọn 4 chủ đề giao diện: lưu localStorage, đồng bộ documentElement[data-theme].

export const THEME_KEY = 'vc_theme';

export interface ThemeDef {
  id: string;
  name: string;
  desc: string;
  dots: [string, string, string];
}

export const VC_THEMES: ThemeDef[] = [
  { id: 'navy', name: 'Enterprise Navy', desc: 'Xanh Vincons đậm truyền thống', dots: ['#16234d', '#223c82', '#2f55b0'] },
  { id: 'forest', name: 'Forest Green Planner', desc: 'Xanh lá mạ phong cách tracker', dots: ['#0b2b1a', '#14532d', '#1f7a3d'] },
  { id: 'dark', name: 'Dark Executive', desc: 'Chế độ tối sang trọng cho trực đêm', dots: ['#0b1220', '#1e293b', '#384f6b'] },
  { id: 'slate', name: 'Clean Corporate Slate', desc: 'Xám công nghiệp cho kho & suất ăn', dots: ['#1f2937', '#334155', '#475569'] }
];

export function getThemeId(): string {
  try {
    return localStorage.getItem(THEME_KEY) || 'navy';
  } catch {
    return 'navy';
  }
}

export function setThemeId(id: string) {
  try {
    localStorage.setItem(THEME_KEY, id);
  } catch { /* ignore */ }
  document.documentElement.dataset.theme = id;
}

export function applyThemeOnLoad() {
  document.documentElement.dataset.theme = getThemeId();
}
