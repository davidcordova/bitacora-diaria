import React from 'react';
import {
  CalendarCheck,
  LayoutList,
  Kanban,
  History,
  Users,
  BarChart3,
  Shield,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Star,
  User as UserIcon,
  HelpCircle,
  X,
  Sun,
  Moon,
  KeyRound,
  Trash2,
} from 'lucide-react';
import { ViewMode, User, SystemSettings } from '../types';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  activitiesCount: number;
  onOpenMobileSummary: () => void;
  currentUser: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  onOpenHelp?: () => void;
  systemSettings?: SystemSettings;
  isDark?: boolean;
  onToggleTheme?: () => void;
  onOpenChangePassword?: () => void;
  onOpenPapelera?: () => void;
  papeleraCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  activitiesCount,
  onOpenMobileSummary,
  currentUser,
  onOpenLogin,
  onLogout,
  isCollapsed,
  onToggleCollapse,
  isOpenMobile = false,
  onCloseMobile,
  onOpenHelp,
  systemSettings,
  isDark = false,
  onToggleTheme,
  onOpenChangePassword,
  onOpenPapelera,
  papeleraCount = 0,
}) => {
  const role = currentUser?.role || 'analista';
  const isAdmin = role === 'admin';
  const isLider = role === 'lider' || currentUser?.is_leader || isAdmin;

  const navItems = [
    {
      id: 'lista' as ViewMode,
      label: 'Mi Bitácora',
      icon: LayoutList,
      show: true,
      badge: activitiesCount > 0 ? activitiesCount : null,
    },
    {
      id: 'kanban' as ViewMode,
      label: 'Actividades',
      icon: Kanban,
      show: true,
      badge: activitiesCount > 0 ? activitiesCount : null,
    },
    {
      id: 'historial' as ViewMode,
      label: 'Historial',
      icon: History,
      show: true,
      badge: null,
    },
    {
      id: 'equipo' as ViewMode,
      label: 'Seguimiento',
      icon: Users,
      show: isLider,
      badge: null,
    },
    {
      id: 'dashboard' as ViewMode,
      label: 'Dashboard',
      icon: BarChart3,
      show: isLider,
      badge: null,
    },
    {
      id: 'gestion' as ViewMode,
      label: 'Gestión',
      icon: Shield,
      show: isAdmin,
      badge: null,
    },
  ];

  const handleItemClick = (id: ViewMode) => {
    onViewChange(id);
    if (onCloseMobile) onCloseMobile();
  };

  const roleLabel = isAdmin ? 'ADMIN' : (role === 'lider' || currentUser?.is_leader ? 'LÍDER' : 'ANALISTA');

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full select-none">
      {/* 1. TOP HEADER / BRANDING & TOGGLE */}
      <div>
        <div
          className={`flex items-center justify-between p-4 border-b border-slate-100 dark:border-white/5 min-h-[72px] ${
            isCollapsed && !isOpenMobile ? 'flex-col gap-2 p-2.5' : ''
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {systemSettings?.logo_url ? (
              <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#1B1C2A] border border-slate-100 dark:border-white/10 p-1 flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
                <img
                  src={systemSettings.logo_url}
                  alt="Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00F0FF] to-[#00A3BF] text-slate-950 flex items-center justify-center shadow-md shadow-[#00F0FF]/30 shrink-0 font-bold">
                <CalendarCheck className="w-5 h-5 text-slate-950" />
              </div>
            )}

            {(!isCollapsed || isOpenMobile) && (
              <div className="animate-in fade-in duration-200 overflow-hidden whitespace-nowrap">
                <div className="flex items-center gap-1">
                  <span className="font-heading font-extrabold text-slate-900 dark:text-white text-base tracking-tight leading-none">
                    {systemSettings?.login_heading || 'Bitácora'}
                  </span>
                  <span className="text-[#00F0FF] font-black text-base">.</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mt-1">
                  {systemSettings?.login_subheading ? systemSettings.login_subheading.toUpperCase() : 'CONTROL DIGITAL'}
                </span>
              </div>
            )}
          </div>

          {/* Mobile close button vs Desktop Collapse toggle */}
          {isOpenMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer shrink-0 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expandir menú lateral' : 'Encoger menú lateral'}
              className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer shrink-0"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* 2. NAVIGATION ITEMS */}
        <nav className="p-3 space-y-1.5 mt-2">
          {navItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              const showText = !isCollapsed || isOpenMobile;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  title={!showText ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all group cursor-pointer relative min-h-[44px] ${
                    isActive
                      ? 'border border-[#00F0FF]/50 bg-[#00F0FF]/10 text-slate-900 dark:text-white font-bold shadow-xs'
                      : 'border border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-white/5'
                  } ${!showText ? 'justify-center px-0' : ''}`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-transform ${
                      isActive
                        ? 'text-[#00A3BF] dark:text-[#00F0FF]'
                        : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                    }`}
                  />

                  {showText && (
                    <span className="flex-1 text-left truncate tracking-tight">{item.label}</span>
                  )}

                  {/* Dot on active item if no badge */}
                  {isActive && item.badge === null && showText && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] shrink-0" />
                  )}

                  {/* Badges in Pink/Magenta exactly as in Images 1, 2, 3 */}
                  {item.badge !== null && (
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[#EC4899] text-white shadow-2xs ${
                        !showText ? 'absolute top-1.5 right-2 w-2 h-2 p-0' : ''
                      }`}
                    >
                      {showText && item.badge}
                    </span>
                  )}
                </button>
              );
            })}
        </nav>
      </div>

      {/* 3. BOTTOM FOOTER / USER, THEME, HELP & SUMMARY */}
      <div className="p-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#0D0E15]/90 space-y-2.5">
        {/* Real Switch Toggle: Modo Oscuro / Modo Claro */}
        {onToggleTheme && (
          <div
            onClick={onToggleTheme}
            className={`w-full flex items-center justify-between p-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer ${
              isCollapsed && !isOpenMobile ? 'justify-center' : ''
            }`}
            title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
          >
            <div className="flex items-center gap-2.5">
              {isDark ? (
                <Moon className="w-4 h-4 text-[#00F0FF] shrink-0" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              {(!isCollapsed || isOpenMobile) && (
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {isDark ? 'Modo Oscuro' : 'Modo Claro'}
                </span>
              )}
            </div>

            {(!isCollapsed || isOpenMobile) && (
              <div
                className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 relative ${
                  isDark ? 'bg-[#00F0FF]' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform duration-200 ${
                    isDark ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            )}
          </div>
        )}

        {/* Onboarding Help Guide Button */}
        {onOpenHelp && (
          <button
            type="button"
            onClick={onOpenHelp}
            title={isCollapsed && !isOpenMobile ? 'Guía rápida' : undefined}
            className={`w-full flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold py-2 rounded-2xl transition-all cursor-pointer min-h-[40px] ${
              isCollapsed && !isOpenMobile ? 'justify-center px-0' : 'px-3'
            }`}
          >
            <HelpCircle className="w-4 h-4 text-[#00F0FF] shrink-0" />
            {(!isCollapsed || isOpenMobile) && <span>Guía rápida</span>}
          </button>
        )}

        {/* Papelera de Reciclaje */}
        {onOpenPapelera && (
          <button
            type="button"
            onClick={() => {
              onOpenPapelera();
              if (onCloseMobile) onCloseMobile();
            }}
            title={isCollapsed && !isOpenMobile ? `Papelera (${papeleraCount})` : undefined}
            className={`w-full flex items-center gap-2 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 text-xs font-semibold py-2 rounded-2xl transition-all cursor-pointer min-h-[40px] ${
              isCollapsed && !isOpenMobile ? 'justify-center px-0' : 'px-3'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Trash2 className="w-4 h-4 text-red-500 shrink-0" />
              {papeleraCount > 0 && isCollapsed && !isOpenMobile && (
                <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 rounded-full text-[8px] font-black bg-red-500 text-white flex items-center justify-center">
                  {papeleraCount}
                </span>
              )}
            </div>
            {(!isCollapsed || isOpenMobile) && (
              <>
                <span className="flex-1 text-left">Papelera (15 días)</span>
                {papeleraCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                    {papeleraCount}
                  </span>
                )}
              </>
            )}
          </button>
        )}

        {/* Resumen Button */}
        <button
          type="button"
          onClick={() => {
            onOpenMobileSummary();
            if (onCloseMobile) onCloseMobile();
          }}
          title={isCollapsed && !isOpenMobile ? `Ver Resumen Diario (${activitiesCount} actividades)` : undefined}
          className={`w-full flex items-center bg-slate-900 hover:bg-slate-800 dark:bg-[#161724] dark:hover:bg-[#1E1F30] border border-slate-800 dark:border-white/10 text-white text-xs font-bold py-2.5 rounded-2xl shadow-sm transition-all cursor-pointer min-h-[44px] ${
            isCollapsed && !isOpenMobile ? 'justify-center px-0 relative' : 'gap-2 px-3.5'
          }`}
        >
          <div className="relative flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#00F0FF] shrink-0" />
            {isCollapsed && !isOpenMobile && activitiesCount > 0 && (
              <span className="absolute -top-2 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-extrabold bg-[#00F0FF] text-slate-950 flex items-center justify-center border border-slate-900 shadow-2xs">
                {activitiesCount}
              </span>
            )}
          </div>
          {(!isCollapsed || isOpenMobile) && (
            <>
              <span className="flex-1 text-left">Resumen Diario</span>
              {activitiesCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/15 text-white shrink-0">
                  {activitiesCount}
                </span>
              )}
            </>
          )}
        </button>

        {/* User Profile Card (As seen in Images 1, 2, 3) */}
        {currentUser ? (
          <div
            className={`flex items-center gap-2 p-2 rounded-2xl bg-white dark:bg-[#161724] border border-slate-200/80 dark:border-white/8 shadow-2xs ${
              isCollapsed && !isOpenMobile ? 'flex-col gap-2 py-2.5' : 'justify-between'
            }`}
          >
            {/* Avatar Circle */}
            <div
              className="w-9 h-9 rounded-2xl bg-[#00F0FF] text-slate-950 flex items-center justify-center text-xs font-black shrink-0 shadow-xs"
              title={currentUser.full_name}
            >
              {currentUser.full_name.charAt(0).toUpperCase()}
            </div>

            {(!isCollapsed || isOpenMobile) && (
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-slate-900 dark:text-white leading-tight block truncate">
                  {currentUser.full_name}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-amber-500 uppercase tracking-wider">
                    <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                    <span>{roleLabel}</span>
                  </span>
                  {(currentUser.team_name || 'Sistemas') && (
                    <span className="text-[9px] text-slate-400 truncate max-w-[85px]">
                      • {currentUser.team_name || 'Sistemas'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* User action buttons */}
            <div className="flex items-center gap-0.5 shrink-0">
              {onOpenChangePassword && (
                <button
                  type="button"
                  onClick={onOpenChangePassword}
                  title="Cambiar mi contraseña"
                  className="p-1.5 text-slate-400 hover:text-[#00F0FF] dark:hover:text-[#00F0FF] hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={onLogout}
                title="Cerrar sesión"
                className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer min-w-[28px] min-h-[28px] flex items-center justify-center"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenLogin}
            className="w-full btn-pill-primary text-xs font-bold py-2.5 rounded-full text-center min-h-[44px]"
          >
            Iniciar sesión
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden md:flex bg-white dark:bg-[#0D0E15] border-r border-slate-200/80 dark:border-white/5 h-screen sticky top-0 flex-col justify-between transition-all duration-300 ease-in-out z-40 select-none shadow-[0_4px_20px_rgba(0,0,0,0.02)] shrink-0 ${
          isCollapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-[#0D0E15] h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200 border-r border-transparent dark:border-white/10">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
