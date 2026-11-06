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
  HelpCircle,
  X,
  Sun,
  Moon,
  KeyRound,
  Trash2,
  Lightbulb,
  BookOpen,
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
  onOpenProfile?: () => void;
  onOpenPapelera?: () => void;
  papeleraCount?: number;
}

interface NavItemConfig {
  id: ViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: boolean;
  badge: number | string | null;
}

interface NavGroupConfig {
  id: string;
  title: string;
  items: NavItemConfig[];
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
  onOpenPapelera,
  papeleraCount = 0,
}) => {
  const role = currentUser?.role || 'analista';
  const isAdmin = role === 'admin';
  const isLider = role === 'lider' || currentUser?.is_leader || isAdmin;

  const navGroups: NavGroupConfig[] = [
    {
      id: 'operacion',
      title: 'Operación Diaria',
      items: [
        {
          id: 'lista',
          label: 'Mi Bitácora',
          icon: LayoutList,
          show: true,
          badge: activitiesCount > 0 ? activitiesCount : null,
        },
        {
          id: 'kanban',
          label: 'Tablero Kanban',
          icon: Kanban,
          show: true,
          badge: null,
        },
        {
          id: 'historial',
          label: 'Historial',
          icon: History,
          show: true,
          badge: null,
        },
      ],
    },
    {
      id: 'analitica',
      title: isLider ? 'Liderazgo & Analítica' : 'Analítica',
      items: [
        {
          id: 'equipo',
          label: 'Supervisión de Equipo',
          icon: Users,
          show: Boolean(isLider),
          badge: null,
        },
        {
          id: 'dashboard',
          label: isLider ? 'Dashboard' : 'Mi Rendimiento',
          icon: BarChart3,
          show: true,
          badge: null,
        },
      ],
    },
    {
      id: 'recursos',
      title: 'Recursos & Gestión',
      items: [
        {
          id: 'vault',
          label: 'Accesos & Bóveda',
          icon: KeyRound,
          show: true,
          badge: null,
        },
        {
          id: 'buzon',
          label: 'Buzón de Ideas',
          icon: Lightbulb,
          show: true,
          badge: null,
        },
        {
          id: 'gestion',
          label: 'Gestión',
          icon: Shield,
          show: isAdmin,
          badge: null,
        },
        {
          id: 'manual',
          label: 'Manual & Guía',
          icon: BookOpen,
          show: true,
          badge: null,
        },
      ],
    },
  ];

  const handleItemClick = (id: ViewMode) => {
    onViewChange(id);
    if (onCloseMobile) onCloseMobile();
  };

  const showText = !isCollapsed || isOpenMobile;

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full select-none">
      {/* 1. TOP HEADER / BRANDING & TOGGLE */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className={`flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-white/5 min-h-[64px] shrink-0 ${
            isCollapsed && !isOpenMobile ? 'flex-col gap-2 px-2 py-3' : ''
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {systemSettings?.logo_url ? (
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-[#1B1C2A] border border-slate-200/80 dark:border-white/10 p-1 flex items-center justify-center shadow-2xs shrink-0 overflow-hidden">
                <img
                  src={systemSettings.logo_url}
                  alt="Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-600 to-blue-600 dark:from-[#00F0FF] dark:to-[#00A3BF] text-white dark:text-slate-950 flex items-center justify-center shadow-sm shrink-0 font-bold">
                <CalendarCheck className="w-5 h-5" />
              </div>
            )}

            {showText && (
              <div className="animate-in fade-in duration-200 overflow-hidden">
                <div className="flex items-center gap-0.5">
                  <span className="font-heading font-extrabold text-slate-900 dark:text-white text-sm sm:text-base tracking-tight leading-none truncate">
                    {systemSettings?.login_heading || 'Bitácora'}
                  </span>
                  <span className="text-sky-600 dark:text-[#00F0FF] font-black text-base leading-none">.</span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mt-0.5 truncate max-w-[150px]">
                  {systemSettings?.login_subheading ? systemSettings.login_subheading : 'Control Digital'}
                </span>
              </div>
            )}
          </div>

          {isOpenMobile ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Cerrar menú lateral"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer shrink-0 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
              aria-label={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
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

        {/* 2. GROUPED NAVIGATION ITEMS */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((i) => i.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.id} className="space-y-1">
                {showText && (
                  <div className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group.title}
                  </div>
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item.id)}
                      title={!showText ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all group cursor-pointer relative min-h-[38px] ${
                        isActive
                          ? 'bg-sky-600 text-white dark:bg-[#00F0FF]/15 dark:text-[#00F0FF] dark:border dark:border-[#00F0FF]/30 font-bold shadow-2xs'
                          : 'border border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-white/5 font-semibold'
                      } ${!showText ? 'justify-center px-0' : ''}`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isActive
                            ? 'text-white dark:text-[#00F0FF]'
                            : 'text-slate-400 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200'
                        }`}
                      />

                      {showText && (
                        <span className="flex-1 text-left truncate tracking-tight">{item.label}</span>
                      )}

                      {item.badge !== null && showText && (
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            isActive
                              ? 'bg-white/20 text-white dark:bg-[#00F0FF] dark:text-slate-950'
                              : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </div>

      {/* 3. COMPACT UTILITY FOOTER */}
      <div className="p-3 border-t border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-[#0D0E15]/90 space-y-1.5 shrink-0">
        {/* Resumen Diario Quick Drawer */}
        <button
          type="button"
          onClick={() => {
            onOpenMobileSummary();
            if (onCloseMobile) onCloseMobile();
          }}
          title={!showText ? 'Ver Resumen Diario' : undefined}
          className={`w-full flex items-center bg-white hover:bg-slate-100 dark:bg-[#161724] dark:hover:bg-[#1E1F30] border border-slate-200/90 dark:border-white/10 text-slate-800 dark:text-white text-xs font-bold py-2 rounded-xl shadow-2xs transition-all cursor-pointer min-h-[38px] ${
            !showText ? 'justify-center px-0 relative' : 'gap-2.5 px-3'
          }`}
        >
          <FileText className="w-4 h-4 text-sky-600 dark:text-[#00F0FF] shrink-0" />
          {showText && <span className="flex-1 text-left">Resumen Diario</span>}
        </button>

        {/* Compact Row of Utility Actions: Papelera, Guía, Tema, Salir */}
        <div
          className={`flex items-center ${
            !showText ? 'flex-col gap-1' : 'justify-between gap-1 pt-1'
          }`}
        >
          {onOpenPapelera && (
            <button
              type="button"
              onClick={() => {
                onOpenPapelera();
                if (onCloseMobile) onCloseMobile();
              }}
              title={`Papelera de reciclaje (${papeleraCount})`}
              className="relative flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              {showText && <span className="text-[11px]">Papelera</span>}
              {papeleraCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                  {papeleraCount}
                </span>
              )}
            </button>
          )}

          <div className={`flex items-center ${!showText ? 'flex-col gap-1' : 'gap-0.5'}`}>
            {onOpenHelp && (
              <button
                type="button"
                onClick={onOpenHelp}
                title="Guía rápida del sistema"
                aria-label="Guía rápida"
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-[#00F0FF] hover:bg-slate-200/60 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                title={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                aria-label={isDark ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-amber-500 dark:hover:text-[#00F0FF] hover:bg-slate-200/60 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
              </button>
            )}

            {currentUser ? (
              <button
                type="button"
                onClick={onLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenLogin}
                className="px-3 py-1.5 btn-pill-primary text-xs font-bold rounded-full"
              >
                Ingresar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside
        className={`hidden md:flex bg-white dark:bg-[#0D0E15] border-r border-slate-200/80 dark:border-white/5 h-screen sticky top-0 flex-col justify-between transition-all duration-300 ease-in-out z-40 select-none shrink-0 ${
          isCollapsed ? 'w-[68px]' : 'w-60'
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
