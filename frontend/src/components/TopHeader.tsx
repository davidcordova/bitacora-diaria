import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  User as UserIcon,
  Cloud,
  CloudOff,
  RefreshCw,
  Menu,
  CalendarCheck,
  Kanban,
  BarChart3,
  Users,
  History,
  Lightbulb,
  KeyRound,
  Settings,
  ChevronDown,
  UserCheck,
  Search,
  X,
  BookOpen,
  LayoutList,
} from 'lucide-react';
import { User, ViewMode } from '../types';

interface TopHeaderProps {
  currentView?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  currentUser: User | null;
  bitacoraFecha?: string;
  activitiesCount?: number;
  onOpenProfile?: () => void;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onForceSyncCloud?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onToggleMobileMenu?: () => void;
  delegatedTargets?: User[];
  activeProxyUser?: User | null;
  onSelectProxyUser?: (user: User | null) => void;
  onOpenErrorReport?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentView = 'lista',
  onViewChange,
  currentUser,
  bitacoraFecha,
  activitiesCount = 0,
  onOpenProfile,
  autoSaveStatus = 'idle',
  onForceSyncCloud,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onToggleMobileMenu,
  delegatedTargets = [],
  activeProxyUser = null,
  onSelectProxyUser,
  onOpenErrorReport,
}) => {
  const [proxyMenuOpen, setProxyMenuOpen] = useState(false);
  const [proxySearch, setProxySearch] = useState('');
  const proxyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (proxyMenuRef.current && !proxyMenuRef.current.contains(e.target as Node)) {
        setProxyMenuOpen(false);
      }
    };
    if (proxyMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [proxyMenuOpen]);

  const formatHeaderDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
      }
    } catch (e) {}
    return dateStr;
  };

  const getViewMeta = () => {
    switch (currentView) {
      case 'kanban':
        return {
          title: 'Tablero Kanban',
          icon: <Kanban className="w-4 h-4 text-sky-600 dark:text-[#00F0FF]" />,
          badge: activitiesCount > 0 ? `${activitiesCount} tareas` : null,
          badgeColor:
            'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
        };
      case 'dashboard':
        return {
          title: 'Dashboard',
          icon: <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
          badge: null,
          badgeColor: '',
        };
      case 'equipo':
        return {
          title: 'Supervisión de Equipo',
          icon: <Users className="w-4 h-4 text-sky-600 dark:text-[#00F0FF]" />,
          badge: null,
          badgeColor: '',
        };
      case 'gestion':
        return {
          title: 'Gestión del Sistema',
          icon: <Settings className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
          badge: null,
          badgeColor: '',
        };
      case 'historial':
        return {
          title: 'Historial de Jornadas',
          icon: <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
          badge: null,
          badgeColor: '',
        };
      case 'buzon':
        return {
          title: 'Buzón de Ideas',
          icon: <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          badge: null,
          badgeColor: '',
        };
      case 'vault':
        return {
          title: 'Bóveda & Accesos TI',
          icon: <KeyRound className="w-4 h-4 text-sky-600 dark:text-[#00F0FF]" />,
          badge: null,
          badgeColor: '',
        };
      case 'manual':
        return {
          title: 'Manual & Guía',
          icon: <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          badge: null,
          badgeColor: '',
        };
      case 'lista':
      default:
        return {
          title: 'Mi Bitácora',
          icon: <CalendarCheck className="w-4 h-4 text-sky-600 dark:text-[#00F0FF]" />,
          badge: bitacoraFecha ? formatHeaderDate(bitacoraFecha) : null,
          badgeColor:
            'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60',
        };
    }
  };

  const meta = getViewMeta();
  const isWorklogView = currentView === 'lista' || currentView === 'kanban';

  return (
    <header className="w-full px-3 sm:px-6 py-2.5 border-b border-slate-200/80 dark:border-white/5 bg-white/95 dark:bg-[#0D0E15]/95 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 select-none min-h-[64px]">
      {/* Left Area: Mobile Hamburger Menu + Active Module + Fast Lista/Kanban Switcher */}
      <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label="Abrir menú de navegación"
            className="md:hidden min-w-[38px] min-h-[38px] p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer shrink-0 flex items-center justify-center"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shrink-0">
            {meta.icon}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
              {meta.title}
            </h1>
            {meta.badge && (
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border hidden sm:inline-block ${meta.badgeColor}`}
              >
                {meta.badge}
              </span>
            )}
          </div>
        </div>

        {/* Fast View Switcher when working on daily tasks (Lista vs Kanban) */}
        {isWorklogView && onViewChange && (
          <div className="hidden lg:flex items-center bg-slate-100 dark:bg-[#161722] p-0.5 rounded-xl border border-slate-200/80 dark:border-[#252636] ml-2">
            <button
              type="button"
              onClick={() => onViewChange('lista')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentView === 'lista'
                  ? 'bg-white dark:bg-[#1E2030] text-sky-700 dark:text-[#00F0FF] shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => onViewChange('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                currentView === 'kanban'
                  ? 'bg-white dark:bg-[#1E2030] text-sky-700 dark:text-[#00F0FF] shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>
        )}
      </div>

      {/* Action Icons Right */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Cloud Sync Status */}
        {onForceSyncCloud && (
          <button
            type="button"
            onClick={
              autoSaveStatus === 'error' && onOpenErrorReport ? onOpenErrorReport : onForceSyncCloud
            }
            title={
              autoSaveStatus === 'saving'
                ? 'Sincronizando con el servidor...'
                : autoSaveStatus === 'error'
                ? 'Error al sincronizar con el servidor. Clic para ver diagnóstico técnico y reportar incidencia'
                : 'Sincronizado en la nube. Clic para forzar actualización'
            }
            className={`min-h-[36px] px-2.5 py-1.5 rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold border ${
              autoSaveStatus === 'saving'
                ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50'
                : autoSaveStatus === 'error'
                ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50 animate-pulse'
                : 'text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-800/40 hover:bg-emerald-100/70'
            }`}
          >
            {autoSaveStatus === 'saving' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : autoSaveStatus === 'error' ? (
              <CloudOff className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <Cloud className="w-3.5 h-3.5 text-emerald-500" />
            )}
            <span className="hidden xl:inline text-[11px]">
              {autoSaveStatus === 'saving'
                ? 'Guardando...'
                : autoSaveStatus === 'error'
                ? 'Sin conexión'
                : 'Sincronizado'}
            </span>
          </button>
        )}

        {/* Notification Bell */}
        <button
          type="button"
          onClick={onOpenNotifications}
          title={
            unreadNotificationsCount > 0
              ? `${unreadNotificationsCount} notificación(es) nueva(s) - Clic para ver historial`
              : 'Centro de Notificaciones'
          }
          className="relative min-w-[36px] min-h-[36px] p-2 text-slate-500 hover:text-sky-700 dark:text-slate-400 dark:hover:text-[#00F0FF] hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 px-1.5 py-0.2 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs animate-in zoom-in duration-150">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Context Selector / Modo Apoyo */}
        {(delegatedTargets.length > 0 || activeProxyUser) &&
          onSelectProxyUser && (
            <div className="relative" ref={proxyMenuRef}>
              <div
                className={`inline-flex items-center rounded-full border text-xs font-semibold transition-all shadow-2xs ${
                  activeProxyUser
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400'
                    : 'bg-slate-100/80 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-sky-500/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setProxyMenuOpen(!proxyMenuOpen)}
                  className={`flex items-center gap-1.5 sm:gap-2 pl-2.5 sm:pl-3 py-1.5 rounded-l-full transition-colors cursor-pointer ${
                    activeProxyUser ? 'pr-1.5 hover:bg-amber-500/15' : 'pr-2.5 sm:pr-3 rounded-r-full'
                  }`}
                  title={
                    activeProxyUser
                      ? `Registrando tareas en apoyo a: ${activeProxyUser.full_name}. Clic para cambiar colaborador.`
                      : 'Modo Apoyo: registrar tareas para otro colaborador'
                  }
                >
                  <UserCheck
                    className={`w-3.5 h-3.5 ${activeProxyUser ? 'text-amber-500' : 'text-sky-600 dark:text-[#00F0FF]'}`}
                  />
                  <span className="hidden sm:inline font-medium">
                    {activeProxyUser
                      ? `Apoyando: ${activeProxyUser.full_name.split(' ')[0]}`
                      : 'Modo Apoyo'}
                  </span>
                  {!activeProxyUser && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-500/15 text-sky-700 dark:text-[#00F0FF] font-bold">
                      {delegatedTargets.length}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
                {activeProxyUser && (
                  <button
                    type="button"
                    onClick={() => onSelectProxyUser(null)}
                    aria-label="Volver a mi bitácora personal"
                    title="Volver a mi bitácora personal"
                    className="pr-2 pl-1 py-1.5 hover:bg-amber-500/25 rounded-r-full transition-colors cursor-pointer text-amber-600 dark:text-amber-300 inline-flex items-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {proxyMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-[#12131C] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5 mb-2">
                    <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center justify-between">
                      <span>Seleccionar Colaborador</span>
                      {activeProxyUser && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          Modo Apoyo
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Registra tareas directamente en la jornada de un compañero de trabajo.
                    </p>
                  </div>

                  {delegatedTargets.length > 3 && (
                    <div className="relative px-2 mb-2">
                      <Search className="w-3.5 h-3.5 absolute left-4 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={proxySearch}
                        onChange={(e) => setProxySearch(e.target.value)}
                        placeholder="Buscar por nombre o equipo..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onSelectProxyUser(null);
                      setProxyMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      !activeProxyUser
                        ? 'bg-sky-500/15 text-sky-800 dark:text-[#00F0FF] font-bold'
                        : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-sky-500/20 text-sky-700 dark:text-[#00F0FF] flex items-center justify-center font-bold text-xs shrink-0">
                      {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'M'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate font-semibold">Mi Bitácora Personal</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {currentUser?.full_name}
                      </div>
                    </div>
                    {!activeProxyUser && (
                      <span className="text-[10px] font-bold text-sky-700 dark:text-[#00F0FF]">
                        Activo
                      </span>
                    )}
                  </button>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/5 max-h-56 overflow-y-auto space-y-1">
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Colaboradores Asignados ({delegatedTargets.length})
                    </div>
                    {delegatedTargets
                      .filter((u) => {
                        if (!proxySearch.trim()) return true;
                        const q = proxySearch.toLowerCase();
                        return (
                          u.full_name.toLowerCase().includes(q) ||
                          (u.team_name && u.team_name.toLowerCase().includes(q))
                        );
                      })
                      .map((target) => {
                        const isSelected = activeProxyUser?.id === target.id;
                        return (
                          <button
                            key={target.id}
                            type="button"
                            onClick={() => {
                              onSelectProxyUser(target);
                              setProxyMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold'
                                : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {target.full_name ? target.full_name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs truncate font-semibold">
                                {target.full_name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {target.team_name || 'Equipo general'}
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                En curso
                              </span>
                            )}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}

        {/* User Profile Pill Button (Single canonical profile trigger) */}
        {currentUser && (
          <button
            type="button"
            onClick={onOpenProfile}
            title={`Conectado como ${currentUser.full_name} (@${currentUser.username}) - Clic para ver y editar mi perfil`}
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] border border-slate-200/80 dark:border-[#252636] hover:border-sky-500/40 dark:hover:border-[#00F0FF]/40 rounded-full transition-all cursor-pointer group text-left min-h-[36px]"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-600 to-blue-600 dark:from-[#00F0FF] dark:to-cyan-500 text-white dark:text-slate-950 font-black flex items-center justify-center text-xs shadow-2xs group-hover:scale-105 transition-transform shrink-0 font-heading">
              {currentUser.full_name ? (
                currentUser.full_name.charAt(0).toUpperCase()
              ) : (
                <UserIcon className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="hidden md:block max-w-[135px]">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-sky-700 dark:group-hover:text-[#00F0FF] transition-colors truncate leading-tight">
                {currentUser.full_name || 'Mi Perfil'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize truncate font-medium leading-tight">
                {currentUser.role || 'analista'}
              </div>
            </div>
          </button>
        )}
      </div>
    </header>
  );
};
