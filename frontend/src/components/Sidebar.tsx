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
import { useModalBehavior } from '../hooks/useModalBehavior';

interface SidebarProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  activitiesCount: number;
  onOpenMobileSummary: () => void;
  currentUser: User | null;
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
  useModalBehavior(Boolean(isOpenMobile), onCloseMobile);
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
          className={`flex items-center justify-between px-4 py-3 border-b border-slate-200/70 dark:border-white/[0.06] min-h-[60px] shrink-0 ${
            isCollapsed && !isOpenMobile ? 'flex-col gap-2 px-2 py-3' : ''
          }`}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            {systemSettings?.logo_url ? (
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1B1F2B] border border-slate-200/80 dark:border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={systemSettings.logo_url}
                  alt="Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shadow-2xs shrink-0 font-bold">
                <CalendarCheck className="w-4 h-4" />
              </div>
            )}

            {showText && (
              <div className="animate-in fade-in duration-200 overflow-hidden">
                <div className="flex items-center gap-0.5">
                  <span className="font-heading font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight leading-none truncate">
                    {systemSettings?.login_heading || 'Bitácora'}
                  </span>
                  <span className="text-sky-600 dark:text-sky-400 font-black text-sm leading-none">.</span>
                </div>
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider block mt-0.5 truncate max-w-[150px]">
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
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer shrink-0 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
              aria-label={isCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
              className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer shrink-0"
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
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((i) => i.show);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.id} className="space-y-0.5">
                {showText && (
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
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
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors group cursor-pointer relative min-h-[36px] border ${
                        isActive
                          ? 'bg-sky-50/90 text-sky-700 border-sky-200/70 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20 font-semibold'
                          : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] font-medium'
                      } ${!showText ? 'justify-center px-0' : ''}`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-sky-600 dark:text-sky-400'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                        }`}
                      />

                      {showText && (
                        <span className="flex-1 text-left truncate">{item.label}</span>
                      )}

                      {item.badge !== null && showText && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md tabular-nums ${
                            isActive
                              ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                              : 'bg-slate-100 dark:bg-white/[0.07] text-slate-600 dark:text-slate-400'
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
      <div className="p-2.5 border-t border-slate-200/70 dark:border-white/[0.06] bg-slate-50/50 dark:bg-[#13161E] space-y-1.5 shrink-0">
        {/* Resumen Diario Quick Drawer */}
        <button
          type="button"
          onClick={() => {
            onOpenMobileSummary();
            if (onCloseMobile) onCloseMobile();
          }}
          title={!showText ? 'Ver Resumen Diario' : undefined}
          className={`w-full flex items-center bg-white hover:bg-slate-50 dark:bg-[#1A1E29] dark:hover:bg-[#222735] border border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-200 text-xs font-semibold py-2 rounded-lg transition-colors cursor-pointer min-h-[36px] ${
            !showText ? 'justify-center px-0 relative' : 'gap-2.5 px-3'
          }`}
        >
          <FileText className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          {showText && <span className="flex-1 text-left">Resumen Diario</span>}
        </button>

        {/* Compact Row of Utility Actions: Papelera, Guía, Tema, Salir */}
        <div
          className={`flex items-center ${
            !showText ? 'flex-col gap-1' : 'justify-between gap-1 pt-0.5'
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
              className="relative flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              {showText && <span className="text-[11px]">Papelera</span>}
              {papeleraCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-medium tabular-nums bg-slate-200/70 dark:bg-white/[0.07] text-slate-600 dark:text-slate-400">
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
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
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
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-500" />
                )}
              </button>
            )}

            {currentUser && (
              <button
                type="button"
                onClick={onLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
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
        className={`hidden md:flex bg-white dark:bg-[#13161E] border-r border-slate-200/80 dark:border-white/[0.07] h-screen sticky top-0 flex-col justify-between transition-all duration-300 ease-in-out z-40 select-none shrink-0 ${
          isCollapsed ? 'w-[64px]' : 'w-56'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-[#13161E] h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200 border-r border-transparent dark:border-white/10">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
