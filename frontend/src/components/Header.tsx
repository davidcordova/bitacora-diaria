import React from 'react';
import {
  CalendarCheck,
  LayoutList,
  Kanban,
  History,
  FileText,
  BarChart3,
  Users,
  Shield,
  LogOut,
  LogIn,
} from 'lucide-react';
import { ViewMode, User } from '../types';

interface HeaderProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  activitiesCount: number;
  onOpenMobileSummary: () => void;
  currentUser: User | null;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  activitiesCount,
  onOpenMobileSummary,
  currentUser,
  onOpenLogin,
  onLogout,
}) => {
  // Roles definition
  const role = currentUser?.role || 'analista';
  const isAdmin = role === 'admin';
  const isLider = role === 'lider' || currentUser?.is_leader || isAdmin;

  const getRoleLabel = () => {
    if (isAdmin) return 'Admin';
    if (role === 'lider' || currentUser?.is_leader) return 'Líder';
    return 'Analista';
  };

  const getRoleBadgeClass = () => {
    if (isAdmin) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (role === 'lider' || currentUser?.is_leader) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-mint-50 text-[#00A88B] border border-emerald-200';
  };

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
      <div className="w-[98%] max-w-[98vw] mx-auto px-2 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-3">
        {/* Left: Compact Logo & Branding */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#00C9A7] to-[#00B894] text-white flex items-center justify-center shadow-sm shadow-[#00C9A7]/20 shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-extrabold text-slate-900 text-sm sm:text-base tracking-tight leading-none">
                Bitácora
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">
                • Marketing Alterno
              </span>
            </div>
            {currentUser?.team_name && (
              <div className="text-[10px] text-[#00A88B] font-semibold truncate max-w-[180px] hidden sm:block">
                {currentUser.team_name}
              </div>
            )}
          </div>
        </div>

        {/* Center: Inline Navigation Menu (Unified in 1 row!) */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
          {/* 1. Mi Bitácora (All roles: Analista, Líder, Admin) */}
          <button
            type="button"
            onClick={() => onViewChange('lista')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              currentView === 'lista'
                ? 'bg-[#00C9A7] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-[#00A88B] hover:bg-mint-50'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            <span>Mi Bitácora</span>
          </button>

          {/* 2. Actividades (Kanban) - All roles */}
          <button
            type="button"
            onClick={() => onViewChange('kanban')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              currentView === 'kanban'
                ? 'bg-[#00C9A7] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-[#00A88B] hover:bg-mint-50'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>Actividades</span>
            {activitiesCount > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  currentView === 'kanban' ? 'bg-[#009E83] text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {activitiesCount}
              </span>
            )}
          </button>

          {/* 3. Historial - All roles */}
          <button
            type="button"
            onClick={() => onViewChange('historial')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              currentView === 'historial'
                ? 'bg-[#00C9A7] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-[#00A88B] hover:bg-mint-50'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial</span>
          </button>

          {/* 4. Seguimiento de Equipo - Only Líderes & Admin */}
          {isLider && (
            <button
              type="button"
              onClick={() => onViewChange('equipo')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                currentView === 'equipo'
                  ? 'bg-[#00C9A7] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-[#00A88B] hover:bg-mint-50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Seguimiento</span>
            </button>
          )}

          {/* 5. Dashboard (Métricas y Analítica) */}
          <button
            type="button"
            onClick={() => onViewChange('dashboard')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              currentView === 'dashboard'
                ? 'bg-[#00C9A7] text-white shadow-xs font-bold'
                : 'text-slate-600 hover:text-[#00A88B] hover:bg-mint-50'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>{isLider ? 'Dashboard' : 'Mi Rendimiento'}</span>
          </button>

          {/* 6. Gestión Usuarios y Equipos - Only Admin */}
          {isAdmin && (
            <button
              type="button"
              onClick={() => onViewChange('gestion')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                currentView === 'gestion'
                  ? 'bg-[#00C9A7] text-white shadow-xs font-bold'
                  : 'text-slate-600 hover:text-[#00A88B] hover:bg-mint-50'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Gestión</span>
            </button>
          )}
        </nav>

        {/* Right: User Login Status & Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Botón Resumen Desplegable (Desktop y Móvil) */}
          <button
            type="button"
            onClick={onOpenMobileSummary}
            className="flex items-center gap-1.5 bg-[#1E293B] hover:bg-slate-800 text-white text-xs font-bold px-3.5 py-1.5 rounded-full shadow-xs transition-all cursor-pointer hover:shadow-md hover:scale-102 active:scale-98"
            title="Desplegar vista previa del resumen de bitácora"
          >
            <FileText className="w-3.5 h-3.5 text-[#00C9A7]" />
            <span>Resumen</span>
            {activitiesCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-[#00C9A7] text-white">
                {activitiesCount}
              </span>
            )}
          </button>

          {/* User Profile Pill */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 py-1 px-3 rounded-full">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#00C9A7] to-[#00B894] text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-2xs">
                {currentUser.full_name.charAt(0)}
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-xs font-bold text-slate-800 leading-none block">
                  {currentUser.full_name}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border inline-block ${getRoleBadgeClass()}`}>
                    {getRoleLabel()}
                  </span>
                  {(currentUser.team_name || 'Sistemas') && (
                    <span className="text-[9px] font-medium text-slate-500 bg-slate-100/80 px-1.5 py-0.2 rounded-full border border-slate-200/60 inline-block truncate max-w-[130px]">
                      {currentUser.team_name || 'Sistemas'}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={onLogout}
                title="Cerrar sesión"
                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 bg-[#00C9A7] hover:bg-[#00B894] text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-2xs cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Entrar</span>
            </button>
          )}

          {/* Origami Logo */}
          <div className="hidden md:flex items-center pl-2 border-l border-slate-200">
            <svg className="w-5 h-5 text-red-600 shrink-0" viewBox="0 0 100 100" fill="currentColor">
              <path d="M50 5 L95 90 L75 90 L50 40 L25 90 L5 90 Z" />
              <path d="M50 48 L68 85 L32 85 Z" fill="#991b1b" />
            </svg>
          </div>
        </div>
      </div>
    </header>
  );
};
