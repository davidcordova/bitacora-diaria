import React from 'react';
import { LayoutList, Kanban, History, Users, FileText, Menu } from 'lucide-react';
import { ViewMode, User } from '../types';

interface BottomNavProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  activitiesCount: number;
  onOpenSummary: () => void;
  onToggleMobileMenu: () => void;
  currentUser: User | null;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentView,
  onViewChange,
  activitiesCount,
  onOpenSummary,
  onToggleMobileMenu,
  currentUser,
}) => {
  const role = currentUser?.role || 'analista';
  const isAdmin = role === 'admin';
  const isLider = role === 'lider' || currentUser?.is_leader || isAdmin;

  const secondaryLabels: Partial<Record<ViewMode, string>> = {
    dashboard: 'Métricas',
    vault: 'Accesos',
    buzon: 'Buzón',
    gestion: 'Gestión',
    manual: 'Guía',
    ...(isLider ? { historial: 'Historial' } : {}),
  };
  const activeSecondaryLabel = secondaryLabels[currentView];
  const isMoreActive = Boolean(activeSecondaryLabel);

  const navItemClass = (active: boolean) =>
    `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative min-h-[44px] ${
      active
        ? 'text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 dark:bg-sky-500/10'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
    }`;

  return (
    <nav
      aria-label="Navegación móvil principal"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#12141E]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-white/10 py-1.5 px-1 flex items-center justify-around shadow-lg shadow-slate-900/10 safe-area-bottom"
    >
      {/* 1. Mi Bitácora */}
      <button
        type="button"
        onClick={() => onViewChange('lista')}
        aria-current={currentView === 'lista' ? 'page' : undefined}
        className={navItemClass(currentView === 'lista')}
      >
        <div className="relative">
          <LayoutList className="w-5 h-5" />
          {activitiesCount > 0 && (
            <span className="absolute -top-1.5 -right-2.5 px-1 min-w-[15px] h-[15px] rounded-full bg-sky-600 text-white text-[9px] font-extrabold flex items-center justify-center">
              {activitiesCount > 99 ? '99+' : activitiesCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5">Bitácora</span>
      </button>

      {/* 2. Actividades (Kanban) */}
      <button
        type="button"
        onClick={() => onViewChange('kanban')}
        aria-current={currentView === 'kanban' ? 'page' : undefined}
        className={navItemClass(currentView === 'kanban')}
      >
        <Kanban className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Tablero</span>
      </button>

      {/* 3. Seguimiento (si es líder/admin) o Historial */}
      {isLider ? (
        <button
          type="button"
          onClick={() => onViewChange('equipo')}
          aria-current={currentView === 'equipo' ? 'page' : undefined}
          className={navItemClass(currentView === 'equipo')}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Equipo</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onViewChange('historial')}
          aria-current={currentView === 'historial' ? 'page' : undefined}
          className={navItemClass(currentView === 'historial')}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Historial</span>
        </button>
      )}

      {/* 4. Resumen */}
      <button
        type="button"
        onClick={onOpenSummary}
        className="flex flex-col items-center justify-center py-1 px-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl transition-all cursor-pointer min-h-[44px]"
      >
        <FileText className="w-5 h-5 text-sky-600 dark:text-sky-400" />
        <span className="text-[10px] mt-0.5">Resumen</span>
      </button>

      {/* 5. Más (Abre Drawer de Menú e indica vista secundaria activa) */}
      <button
        type="button"
        onClick={onToggleMobileMenu}
        aria-current={isMoreActive ? 'page' : undefined}
        className={navItemClass(isMoreActive)}
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5 truncate max-w-[56px]">
          {activeSecondaryLabel || 'Más'}
        </span>
      </button>
    </nav>
  );
};
