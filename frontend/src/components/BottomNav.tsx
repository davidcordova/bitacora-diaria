import React from 'react';
import { LayoutList, StickyNote, Plus, History, Users, Menu } from 'lucide-react';
import { ViewMode, User } from '../types';

interface BottomNavProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  activitiesCount: number;
  onOpenSummary: () => void;
  onQuickNewActivity?: () => void;
  onToggleMobileMenu: () => void;
  currentUser: User | null;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onViewChange,
  activitiesCount,
  onQuickNewActivity,
  onToggleMobileMenu,
  currentUser,
}) => {
  const role = currentUser?.role || 'analista';
  const isAdmin = role === 'admin';
  const isLider = role === 'lider' || currentUser?.is_leader || isAdmin;

  const secondaryLabels: Partial<Record<ViewMode, string>> = {
    dashboard: 'Métricas',
    vault: 'Bóveda',
    buzon: 'Buzón',
    gestion: 'Gestión',
    manual: 'Guía',
    ...(isLider ? { historial: 'Historial' } : {}),
  };
  const activeSecondaryLabel = secondaryLabels[currentView];
  const isMoreActive = Boolean(activeSecondaryLabel);
  const isBitacoraActive = currentView === 'lista' || currentView === 'kanban';

  const navItemClass = (active: boolean) =>
    `flex-1 flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors cursor-pointer relative min-h-[46px] ${
      active
        ? 'text-sky-600 dark:text-sky-400 font-semibold'
        : 'text-slate-500 dark:text-slate-400 active:text-slate-900 dark:active:text-white'
    }`;

  return (
    <nav
      aria-label="Navegación móvil principal"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0E1118]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-white/[0.08] pt-1.5 px-2 flex items-center justify-between gap-1 safe-area-bottom"
    >
      {/* 1. Mi Bitácora */}
      <button
        type="button"
        onClick={() => onViewChange('lista')}
        aria-current={isBitacoraActive ? 'page' : undefined}
        className={navItemClass(isBitacoraActive)}
      >
        <div className="relative">
          <LayoutList className="w-5 h-5" />
          {activitiesCount > 0 && (
            <span className="absolute -top-1 -right-2 px-1 min-w-[14px] h-[14px] rounded-full bg-sky-600 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
              {activitiesCount > 99 ? '99+' : activitiesCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 leading-none">Bitácora</span>
      </button>

      {/* 2. Notas */}
      <button
        type="button"
        onClick={() => onViewChange('notas')}
        aria-current={currentView === 'notas' ? 'page' : undefined}
        className={navItemClass(currentView === 'notas')}
      >
        <StickyNote className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 leading-none">Notas</span>
      </button>

      {/* 3. Primary Thumb Action: + Nueva actividad */}
      <div className="flex items-center justify-center px-1">
        <button
          type="button"
          onClick={() => {
            if (onQuickNewActivity) {
              onQuickNewActivity();
            } else {
              onViewChange('lista');
            }
          }}
          aria-label="Nueva actividad"
          title="Nueva actividad"
          className="w-11 h-11 rounded-2xl bg-sky-600 hover:bg-sky-700 active:scale-95 text-white shadow-md shadow-sky-600/25 flex items-center justify-center transition-all cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* 4. Equipo (líder/admin) o Historial */}
      {isLider ? (
        <button
          type="button"
          onClick={() => onViewChange('equipo')}
          aria-current={currentView === 'equipo' ? 'page' : undefined}
          className={navItemClass(currentView === 'equipo')}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 leading-none">Equipo</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onViewChange('historial')}
          aria-current={currentView === 'historial' ? 'page' : undefined}
          className={navItemClass(currentView === 'historial')}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] mt-0.5 leading-none">Historial</span>
        </button>
      )}

      {/* 5. Menú (drawer con herramientas secundarias, resumen, tema) */}
      <button
        type="button"
        onClick={onToggleMobileMenu}
        aria-current={isMoreActive ? 'page' : undefined}
        className={navItemClass(isMoreActive)}
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 leading-none truncate max-w-[54px]">
          {activeSecondaryLabel || 'Menú'}
        </span>
      </button>
    </nav>
  );
};
