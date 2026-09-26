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

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#13141F]/95 backdrop-blur-md border-t border-slate-200/90 dark:border-[#252636] py-1.5 px-1 flex items-center justify-around shadow-lg shadow-slate-900/10 safe-area-bottom">
      {/* 1. Mi Bitácora */}
      <button
        type="button"
        onClick={() => onViewChange('lista')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
          currentView === 'lista' ? 'text-cyan-600 dark:text-[#00F0FF] font-bold' : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        <LayoutList className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Bitácora</span>
      </button>

      {/* 2. Actividades (Kanban) */}
      <button
        type="button"
        onClick={() => onViewChange('kanban')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer relative min-h-[44px] ${
          currentView === 'kanban' ? 'text-cyan-600 dark:text-[#00F0FF] font-bold' : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <Kanban className="w-5 h-5" />
        </div>
        <span className="text-[10px] mt-0.5">Tareas</span>
      </button>

      {/* 3. Seguimiento (si es líder/admin) o Historial */}
      {isLider ? (
        <button
          type="button"
          onClick={() => onViewChange('equipo')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
            currentView === 'equipo' ? 'text-cyan-600 dark:text-[#00F0FF] font-bold' : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Equipo</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onViewChange('historial')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer min-h-[44px] ${
            currentView === 'historial' ? 'text-cyan-600 dark:text-[#00F0FF] font-bold' : 'text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Historial</span>
        </button>
      )}

      {/* 4. Resumen */}
      <button
        type="button"
        onClick={onOpenSummary}
        className="flex flex-col items-center justify-center py-1 px-2.5 text-slate-400 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-all cursor-pointer min-h-[44px]"
      >
        <FileText className="w-5 h-5 text-cyan-600 dark:text-[#00F0FF]" />
        <span className="text-[10px] mt-0.5">Resumen</span>
      </button>

      {/* 5. Más (Abre Drawer de Menú) */}
      <button
        type="button"
        onClick={onToggleMobileMenu}
        className="flex flex-col items-center justify-center py-1 px-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-xl transition-all cursor-pointer min-h-[44px]"
      >
        <Menu className="w-5 h-5" />
        <span className="text-[10px] mt-0.5">Más</span>
      </button>
    </nav>
  );
};
