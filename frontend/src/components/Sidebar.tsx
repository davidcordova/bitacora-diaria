import React, { useState } from 'react';
import {
  CalendarCheck,
  LayoutList,
  History,
  Users,
  BarChart3,
  Shield,
  FileText,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  X,
  Sun,
  Moon,
  KeyRound,
  Trash2,
  Lightbulb,
  BookOpen,
  StickyNote,
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
  notasReminderCount?: number;
}

interface NavItemConfig {
  id: ViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: boolean;
  badge: number | string | null;
  matchViews?: ViewMode[];
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
  notasReminderCount = 0,
}) => {
  useModalBehavior(Boolean(isOpenMobile), onCloseMobile);
  const role = currentUser?.role || 'analista';
  const isAdmin = role === 'admin';
  const isLider = role === 'lider' || currentUser?.is_leader || isAdmin;

  const secondaryViewIds: ViewMode[] = ['vault', 'buzon', 'gestion', 'manual'];
  const [toolsOpen, setToolsOpen] = useState<boolean>(() => secondaryViewIds.includes(currentView));

  const primaryItems: NavItemConfig[] = [
    {
      id: 'lista',
      label: 'Mi Bitácora',
      icon: LayoutList,
      show: true,
      badge: activitiesCount > 0 ? activitiesCount : null,
      matchViews: ['lista', 'kanban'],
    },
    {
      id: 'notas',
      label: 'Notas',
      icon: StickyNote,
      show: true,
      badge: notasReminderCount > 0 ? notasReminderCount : null,
    },
    {
      id: 'historial',
      label: 'Historial',
      icon: History,
      show: true,
      badge: null,
    },
    {
      id: 'equipo',
      label: 'Supervisión',
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
  ];

  const secondaryItems: NavItemConfig[] = [
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
  ];

  const handleItemClick = (id: ViewMode) => {
    onViewChange(id);
    if (onCloseMobile) onCloseMobile();
  };

  const showText = !isCollapsed || isOpenMobile;
  const isSecondaryActive = secondaryViewIds.includes(currentView);
  const showSecondaryItems = !showText || toolsOpen || isSecondaryActive;

  const brandHeading = (systemSettings?.login_heading || 'Bitácora Digital').replace(/\.\s*$/, '');
  const brandSubheading = systemSettings?.login_subheading
    ? systemSettings.login_subheading
        .toLowerCase()
        .replace(/(^|\s)\S/g, (c) => c.toUpperCase())
    : '';

  const renderNavItem = (item: NavItemConfig, subtle = false) => {
    const Icon = item.icon;
    const isActive = item.matchViews
      ? item.matchViews.includes(currentView)
      : currentView === item.id;

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleItemClick(item.id)}
        title={!showText ? item.label : undefined}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors group cursor-pointer relative min-h-[38px] ${
          subtle ? 'text-[12.5px]' : 'text-[13px]'
        } ${
          isActive
            ? 'bg-slate-100/95 dark:bg-white/[0.08] text-slate-900 dark:text-white font-semibold'
            : subtle
            ? 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-white/[0.04] font-medium'
            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.05] font-medium'
        } ${!showText ? 'justify-center px-0' : ''}`}
      >
        <Icon
          className={`w-[17px] h-[17px] shrink-0 transition-colors ${
            isActive
              ? 'text-sky-600 dark:text-sky-400'
              : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
          }`}
        />

        {showText && <span className="flex-1 text-left truncate">{item.label}</span>}

        {item.badge !== null && showText && (
          <span
            className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums leading-none ${
              isActive
                ? 'bg-sky-100/90 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col justify-between h-full select-none">
      {/* 1. TOP HEADER / BRANDING & TOGGLE */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className={`flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200/60 dark:border-white/[0.06] min-h-[56px] shrink-0 ${
            isCollapsed && !isOpenMobile ? 'flex-col gap-2 px-2 py-3' : ''
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {systemSettings?.logo_url ? (
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#1B1F2B] ring-1 ring-slate-200/80 dark:ring-white/10 p-1 flex items-center justify-center shrink-0">
                <img
                  src={systemSettings.logo_url}
                  alt="Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                <CalendarCheck className="w-4 h-4" />
              </div>
            )}

            {showText && (
              <div className="min-w-0 py-0.5">
                <div className="font-heading font-semibold text-slate-900 dark:text-slate-100 text-[13.5px] tracking-tight leading-snug truncate">
                  {brandHeading}
                </div>
                {brandSubheading && (
                  <div className="text-[11px] font-normal text-slate-400 dark:text-slate-500 leading-tight truncate">
                    {brandSubheading}
                  </div>
                )}
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

        {/* 2. NAVIGATION ITEMS: Primary Daily Flow first, Secondary Tools neatly tucked */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3 flex flex-col gap-1">
          <div className="space-y-0.5">
            {primaryItems.filter((i) => i.show).map((item) => renderNavItem(item, false))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-white/[0.06] space-y-0.5">
            {showText && (
              <button
                type="button"
                onClick={() => setToolsOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-2.5 py-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer rounded-md"
              >
                <span>Herramientas</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    showSecondaryItems ? 'rotate-0' : '-rotate-90'
                  }`}
                />
              </button>
            )}
            {showSecondaryItems && (
              <div className="space-y-0.5">
                {secondaryItems.filter((i) => i.show).map((item) => renderNavItem(item, true))}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* 3. MINIMAL UTILITY FOOTER */}
      <div className="p-2.5 border-t border-slate-200/60 dark:border-white/[0.06] space-y-1 shrink-0">
        <button
          type="button"
          onClick={() => {
            onOpenMobileSummary();
            if (onCloseMobile) onCloseMobile();
          }}
          title={!showText ? 'Resumen Diario' : undefined}
          className={`w-full flex items-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.05] text-[12.5px] font-medium py-2 rounded-lg transition-colors cursor-pointer min-h-[36px] ${
            !showText ? 'justify-center px-0' : 'gap-2.5 px-2.5'
          }`}
        >
          <FileText className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          {showText && <span className="flex-1 text-left">Resumen diario</span>}
        </button>

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
              title={`Papelera (${papeleraCount})`}
              className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              {showText && <span className="text-[11.5px]">Papelera</span>}
              {papeleraCount > 0 && showText && (
                <span className="text-[10.5px] font-medium tabular-nums text-slate-400 dark:text-slate-500">
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
                title="Guía rápida"
                aria-label="Guía rápida"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}

            {onToggleTheme && (
              <button
                type="button"
                onClick={onToggleTheme}
                title={isDark ? 'Modo claro' : 'Modo oscuro'}
                aria-label={isDark ? 'Modo claro' : 'Modo oscuro'}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer"
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>
            )}

            {currentUser && (
              <button
                type="button"
                onClick={onLogout}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
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
        className={`hidden md:flex bg-white dark:bg-[#10131A] border-r border-slate-200/70 dark:border-white/[0.06] h-screen sticky top-0 flex-col justify-between transition-all duration-200 ease-in-out z-40 select-none shrink-0 ${
          isCollapsed ? 'w-[60px]' : 'w-56'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-150">
          <div
            className="fixed inset-0 bg-slate-900/45 dark:bg-black/65 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
            className="relative w-72 max-w-[85vw] bg-white dark:bg-[#10131A] h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200 border-r border-slate-200/70 dark:border-white/10"
          >
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
