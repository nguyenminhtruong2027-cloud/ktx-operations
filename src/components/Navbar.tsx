import { useState } from 'react';
import { User, NotificationItem } from '../types';
import { Bell, Shield, UserCheck, RefreshCw, Database, FileText, Menu, X, CheckSquare, Utensils, Palette, Check } from 'lucide-react';
import { VC_THEMES, getThemeId, setThemeId } from '../utils/theme';

interface NavbarProps {
  currentUser: User;
  users: User[];
  onSwitchUser: (userId: string) => void;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onOpenHandover: () => void;
  onOpenFirebaseModal: () => void;
  onGenerateTodayTasks: () => void;
  onResetToDefault: () => void;
  activeModule: 'tasks' | 'meals';
  onModuleChange: (mod: 'tasks' | 'meals') => void;
}

export default function Navbar({
  currentUser,
  users,
  onSwitchUser,
  notifications,
  onMarkNotificationRead,
  onOpenHandover,
  onOpenFirebaseModal,
  onGenerateTodayTasks,
  onResetToDefault,
  activeModule,
  onModuleChange
}: NavbarProps) {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showThemeDropdown, setShowThemeDropdown] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>(() => getThemeId());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pickTheme = (id: string) => {
    setThemeId(id);
    setCurrentTheme(id);
    setShowThemeDropdown(false);
  };

  const unreadNotifs = notifications.filter(n => !n.read && n.userId === currentUser.id);

  const canTasks = currentUser.canAccessTasks !== false; // default true if undefined
  const canMeals = currentUser.canAccessMeals !== false; // default true if undefined

  return (
    <header className="bg-gradient-to-r from-(--vc-brand-1) via-(--vc-brand-2) to-(--vc-brand-3) text-white shadow-md sticky top-0 z-40">
      {/* Thanh nhấn thương hiệu: cam ấm → xanh đậm */}
      <div className="h-[3px] vc-accent-bar" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-(--vc-accent-1) to-(--vc-accent-2) flex items-center justify-center font-bold text-xl shadow-md text-slate-950">
              VC
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">VINCONS - Vận hành KTX & Lán trại</div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight">Hệ thống Điều hành Vận hành</h1>
            </div>
          </div>

          {/* Module Switcher in Header (Desktop) */}
          <div className="hidden lg:flex items-center space-x-1 bg-blue-950/60 backdrop-blur p-1 rounded-2xl border border-white/10 shadow-inner">
            {canTasks && (
              <button
                onClick={() => onModuleChange('tasks')}
                className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeModule === 'tasks'
                    ? 'bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 shadow-md'
                    : 'text-blue-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                <span>Công việc</span>
              </button>
            )}

            {canMeals && (
              <button
                onClick={() => onModuleChange('meals')}
                className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeModule === 'meals'
                    ? 'bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 shadow-md'
                    : 'text-blue-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <Utensils className="w-4 h-4" />
                <span>Suất ăn (Hóc Môn)</span>
              </button>
            )}
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center space-x-2.5">
            {/* Generate Tasks Button */}
            {currentUser.role === 'manager' && activeModule === 'tasks' && (
              <button
                onClick={onGenerateTodayTasks}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-white/10 hover:bg-white/20 backdrop-blur text-xs font-bold rounded-xl transition shadow-sm border border-white/15"
                title="Tạo phiếu việc tự động cho ngày hôm nay từ mẫu checklist"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-200" />
                <span>Sinh phiếu việc</span>
              </button>
            )}

            {/* Shift Handover Button */}
            {activeModule === 'tasks' && (
              <button
                onClick={onOpenHandover}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) hover:brightness-110 text-slate-950 text-xs font-bold rounded-xl transition shadow-md"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Bàn giao ca</span>
              </button>
            )}

            {/* Theme Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                className="flex items-center space-x-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-blue-50 text-xs font-semibold rounded-xl transition border border-white/15"
                title="Chọn chủ đề giao diện (lưu tự động)"
              >
                <Palette className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden xl:inline">
                  {VC_THEMES.find(t => t.id === currentTheme)?.name.split(' ')[0] || 'Theme'}
                </span>
                <span className={`hidden xl:flex items-center space-x-0.5`}>
                  {(VC_THEMES.find(t => t.id === currentTheme)?.dots || []).map((c, i) => (
                    <span key={i} className="w-2 h-2 rounded-full border border-white/30" style={{ backgroundColor: c }} />
                  ))}
                </span>
              </button>

              {showThemeDropdown && (
                <div className="absolute right-0 mt-2 w-72 bg-white text-slate-800 rounded-2xl shadow-lg py-2 z-50 border border-slate-100 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                    <p className="font-bold text-xs text-slate-900">Chọn chủ đề giao diện</p>
                    <p className="text-[10px] text-slate-500">Lưu tự động — giữ nguyên khi F5</p>
                  </div>
                  <div className="py-1">
                    {VC_THEMES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => pickTheme(t.id)}
                        className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-2 transition ${
                          t.id === currentTheme ? 'bg-blue-50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5">
                          <span className="flex items-center space-x-0.5 shrink-0">
                            {t.dots.map((c, i) => (
                              <span key={i} className="w-3 h-3 rounded-full border border-slate-200" style={{ backgroundColor: c }} />
                            ))}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{t.name}</div>
                            <div className="text-[10px] text-slate-500">{t.desc}</div>
                          </div>
                        </div>
                        {t.id === currentTheme && <Check className="w-4 h-4 text-amber-500 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Firebase Info */}
            <button
              onClick={onOpenFirebaseModal}
              className="flex items-center space-x-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-blue-50 text-xs font-semibold rounded-xl transition border border-white/15"
              title="Hướng dẫn kết nối Firebase"
            >
              <Database className="w-3.5 h-3.5 text-emerald-300" />
              <span className="hidden lg:inline">Firebase</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="relative p-2.5 rounded-xl hover:bg-white/10 transition border border-transparent hover:border-white/10"
                title="Thông báo"
              >
                <Bell className="w-5 h-5 text-amber-300" />
                {unreadNotifs.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4.5 h-4.5 min-w-[18px] bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
                    {unreadNotifs.length}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white text-slate-800 rounded-2xl shadow-lg py-2 z-50 border border-slate-100 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <span className="font-bold text-sm text-slate-900">Thông báo trong app</span>
                    <span className="text-xs bg-blue-950 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                      {unreadNotifs.length} chưa đọc
                    </span>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {notifications.filter(n => n.userId === currentUser.id).length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">Không có thông báo nào</div>
                    ) : (
                      notifications
                        .filter(n => n.userId === currentUser.id)
                        .map(n => (
                          <div
                            key={n.id}
                            onClick={() => onMarkNotificationRead(n.id)}
                            className={`p-3 hover:bg-slate-50 cursor-pointer transition ${!n.read ? 'bg-blue-50/60 border-l-2 border-orange-400' : ''}`}
                          >
                            <div className="font-bold text-xs text-(--vc-brand-2)">{n.title}</div>
                            <div className="text-xs text-slate-600 mt-0.5">{n.message}</div>
                            <div className="text-[10px] text-slate-400 mt-1">{n.timestamp}</div>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile & Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 backdrop-blur px-3 py-1.5 rounded-xl border border-white/15 transition"
              >
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-7 h-7 rounded-lg object-cover ring-2 ring-amber-400/70"
                />
                <div className="text-left">
                  <div className="text-xs font-bold leading-tight">{currentUser.name}</div>
                  <div className="text-[10px] text-amber-300 font-semibold">
                    {currentUser.role === 'manager' ? '🛡️ Quản lý (Admin)' : '👷 Nhân viên'}
                  </div>
                </div>
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white text-slate-800 rounded-2xl shadow-lg py-2 z-50 border border-slate-100 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50">
                    <p className="text-xs text-slate-500">Đăng nhập với tư cách:</p>
                    <p className="font-bold text-sm text-(--vc-brand-2)">{currentUser.name}</p>
                    <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
                    <div className="flex items-center space-x-1 mt-1.5">
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-950 text-blue-100 rounded-md">
                        Công việc: {currentUser.canAccessTasks !== false ? 'Có' : 'Không'}
                      </span>
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 rounded-md">
                        Suất ăn: {currentUser.canAccessMeals !== false ? 'Có' : 'Không'}
                      </span>
                    </div>
                  </div>

                  <div className="px-3 py-2">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      Chuyển đổi tài khoản (Thử nghiệm):
                    </p>
                    {users.map(u => (
                      <button
                        key={u.id}
                        onClick={() => {
                          onSwitchUser(u.id);
                          setShowUserDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                          u.id === currentUser.id
                            ? 'bg-(--vc-brand-2) text-white font-bold'
                            : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div>
                          <div className="font-semibold">{u.name}</div>
                          <div className={`text-[10px] ${u.id === currentUser.id ? 'text-amber-300' : 'text-slate-400'}`}>
                            {u.role === 'manager' ? 'Quản lý' : 'Nhân viên'} - {u.khuVuc.slice(0, 16)}...
                          </div>
                        </div>
                        {u.id === currentUser.id && <UserCheck className="w-4 h-4 text-amber-300" />}
                      </button>
                    ))}
                  </div>

                  <div className="px-3 pb-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => {
                        if (confirm('Khôi phục toàn bộ dữ liệu mẫu ban đầu của hệ thống?')) {
                          onResetToDefault();
                          setShowUserDropdown(false);
                        }
                      }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-50 rounded-xl flex items-center space-x-1.5 font-bold transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Khôi phục dữ liệu gốc</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center space-x-2">
            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="relative p-2 rounded-xl bg-white/10 border border-white/15"
            >
              <Bell className="w-5 h-5 text-amber-300" />
              {unreadNotifs.length > 0 && (
                <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md">
                  {unreadNotifs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-white/10 border border-white/15 text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-gradient-to-b from-(--vc-brand-1) to-(--vc-brand-0) border-t border-white/10 px-4 py-4 space-y-4">
          <div className="flex items-center space-x-3 pb-3 border-b border-white/10">
            <img src={currentUser.avatar} alt="" className="w-10 h-10 rounded-xl ring-2 ring-amber-400/70 object-cover" />
            <div>
              <div className="font-bold text-sm text-white">{currentUser.name}</div>
              <div className="text-xs text-amber-300">
                {currentUser.role === 'manager' ? 'Quản lý (Admin)' : 'Nhân viên'}
              </div>
            </div>
          </div>

          {/* Module Switcher Mobile */}
          <div className="grid grid-cols-2 gap-2 bg-blue-950/60 p-2 rounded-2xl border border-white/10">
            {canTasks && (
              <button
                onClick={() => {
                  onModuleChange('tasks');
                  setMobileMenuOpen(false);
                }}
                className={`py-2.5 rounded-xl text-xs font-bold text-center transition ${activeModule === 'tasks' ? 'bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 shadow-md' : 'bg-white/5 text-blue-100'}`}
              >
                Công việc
              </button>
            )}
            {canMeals && (
              <button
                onClick={() => {
                  onModuleChange('meals');
                  setMobileMenuOpen(false);
                }}
                className={`py-2.5 rounded-xl text-xs font-bold text-center transition ${activeModule === 'meals' ? 'bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 shadow-md' : 'bg-white/5 text-blue-100'}`}
              >
                Suất ăn (Hóc Môn)
              </button>
            )}
          </div>

          <div className="space-y-2">
            {/* Theme Switcher Mobile */}
            <div className="bg-white/10 rounded-2xl border border-white/10 p-3">
              <p className="text-[10px] font-bold text-blue-200 uppercase tracking-wider mb-2">Chủ đề giao diện</p>
              <div className="grid grid-cols-2 gap-2">
                {VC_THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => pickTheme(t.id)}
                    className={`flex items-center space-x-2 p-2 rounded-xl text-left transition ${t.id === currentTheme ? 'bg-white/20 border border-amber-400/50' : 'bg-white/5 border border-white/10'}`}
                  >
                    <span className="flex items-center space-x-0.5 shrink-0">
                      {t.dots.map((c, i) => (
                        <span key={i} className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    <span className="text-[10px] font-bold text-blue-50 leading-tight">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                onOpenFirebaseModal();
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-white/10 text-blue-50 rounded-xl text-sm font-semibold border border-white/10"
            >
              <Database className="w-4 h-4 text-emerald-300" />
              <span>Hướng dẫn Firebase</span>
            </button>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Chuyển tài khoản thử nghiệm:</p>
            <div className="space-y-1">
              {users.map(u => (
                <button
                  key={u.id}
                  onClick={() => {
                    onSwitchUser(u.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition ${
                    u.id === currentUser.id ? 'bg-gradient-to-r from-(--vc-accent-1) to-(--vc-accent-2) text-slate-950 font-bold shadow-md' : 'bg-white/5 text-slate-200'
                  }`}
                >
                  <span>{u.name} ({u.role === 'manager' ? 'QL' : 'NV'})</span>
                  {u.id === currentUser.id && <UserCheck className="w-4 h-4" />}
                </button>
              ))}
            </div>
            <div className="pt-3">
              <button
                onClick={() => {
                  if (confirm('Khôi phục toàn bộ dữ liệu mẫu ban đầu của hệ thống?')) {
                    onResetToDefault();
                    setMobileMenuOpen(false);
                  }
                }}
                className="w-full flex items-center justify-center space-x-1.5 py-2 bg-red-900/60 hover:bg-red-900 text-red-200 text-xs rounded-xl transition font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Khôi phục dữ liệu gốc</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
