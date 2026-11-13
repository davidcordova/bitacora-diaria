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
          icon: <Kanban className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
          badge: bitacoraFecha ? formatHeaderDate(bitacoraFecha) : null,
          badgeColor:
            'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/10',
        };
      case 'dashboard':
        return {
          title: 'Dashboard',
          icon: <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
          badge: null,
          badgeColor: '',
        };
      case 'equipo':
        return {
          title: 'Supervisión de Equipo',
          icon: <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
          badge: null,
          badgeColor: '',
        };
      case 'gestion':
        return {
          title: 'Gestión del Sistema',
          icon: <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />,
          badge: null,
          badgeColor: '',
        };
      case 'historial':
        return {
          title: 'Historial de Jornadas',
          icon: <History className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
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
          icon: <KeyRound className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
          badge: null,
          badgeColor: '',
        };
      case 'manual':
        return {
          title: 'Manual & Guía',
          icon: <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
          badge: null,
          badgeColor: '',
        };
      case 'lista':
      default:
        return {
          title: 'Mi Bitácora',
          icon: <CalendarCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
          badge: null,
          badgeColor: '',
        };
    }
  };

  const meta = getViewMeta();
  const isWorklogView = currentView === 'lista' || currentView === 'kanban';

  return (
    <header className="w-full px-3 sm:px-6 py-2.5 border-b border-slate-200/80 dark:border-white/[0.07] bg-white/95 dark:bg-[#13161E]/95 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 select-none min-h-[60px]">
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
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/[0.08] shrink-0">
            {meta.icon}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
              {meta.title}
            </h1>
            {meta.badge && (
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-md border hidden sm:inline-block ${meta.badgeColor}`}
              >
                {meta.badge}
              </span>
            )}
          </div>
        </div>

        {/* Fast View Switcher when working on daily tasks (Lista vs Kanban) */}
        {isWorklogView && onViewChange && (
          <div className="hidden md:flex items-center bg-slate-100 dark:bg-[#1A1E29] p-0.5 rounded-lg border border-slate-200/80 dark:border-white/[0.07] ml-2 shrink-0">
            <button
              type="button"
              onClick={() => onViewChange('lista')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'lista'
                  ? 'bg-white dark:bg-[#252A38] text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              onClick={() => onViewChange('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                currentView === 'kanban'
                  ? 'bg-white dark:bg-[#252A38] text-slate-900 dark:text-white shadow-2xs'
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
                : 'Sincronizado en la nube. Clic para actualizar'
            }
            className={`min-h-[34px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-medium border ${
              autoSaveStatus === 'saving'
                ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25'
                : autoSaveStatus === 'error'
                ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/25'
                : 'text-slate-500 dark:text-slate-400 bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {autoSaveStatus === 'saving' ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : autoSaveStatus === 'error' ? (
              <CloudOff className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <Cloud className="w-3.5 h-3.5 text-emerald-500/80" />
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
          className="relative min-w-[36px] min-h-[36px] p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/[0.05] rounded-lg transition-colors cursor-pointer flex items-center justify-center"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 px-1 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-2xs">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Context Selector / Modo Apoyo */}
        {(delegatedTargets.length > 0 || activeProxyUser) &&
          onSelectProxyUser && (
            <div className="relative" ref={proxyMenuRef}>
              <div
                className={`inline-flex items-center rounded-lg border text-xs font-medium transition-all ${
                  activeProxyUser
                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 text-amber-800 dark:text-amber-300'
                    : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.07]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setProxyMenuOpen(!proxyMenuOpen)}
                  className={`flex items-center gap-1.5 pl-2.5 py-1.5 rounded-l-lg transition-colors cursor-pointer ${
                    activeProxyUser ? 'pr-1.5' : 'pr-2.5 rounded-r-lg'
                  }`}
                  title={
                    activeProxyUser
                      ? `Registrando tareas en apoyo a: ${activeProxyUser.full_name}. Clic para cambiar colaborador.`
                      : 'Modo Apoyo: registrar tareas para otro colaborador'
                  }
                >
                  <UserCheck
                    className={`w-3.5 h-3.5 ${activeProxyUser ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}
                  />
                  <span className="hidden sm:inline">
                    {activeProxyUser
                      ? `Apoyo: ${activeProxyUser.full_name.split(' ')[0]}`
                      : 'Modo Apoyo'}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>
                {activeProxyUser && (
                  <button
                    type="button"
                    onClick={() => onSelectProxyUser(null)}
                    aria-label="Volver a mi bitácora personal"
                    title="Volver a mi bitácora personal"
                    className="pr-2 pl-1 py-1.5 hover:bg-amber-500/15 rounded-r-lg transition-colors cursor-pointer text-amber-700 dark:text-amber-300 inline-flex items-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {proxyMenuOpen && (
                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 max-h-[calc(100dvh-5rem)] overflow-y-auto overflow-x-hidden bg-white dark:bg-[#181C26] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-white/[0.06] mb-2">
                    <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center justify-between">
                      <span>Seleccionar Colaborador</span>
                      {activeProxyUser && (
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md">
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
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-sky-500"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      onSelectProxyUser(null);
                      setProxyMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                      !activeProxyUser
                        ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-xs shrink-0">
                      {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'M'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate font-semibold">Mi Bitácora Personal</div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {currentUser?.full_name}
                      </div>
                    </div>
                    {!activeProxyUser && (
                      <span className="text-[10px] font-semibold text-sky-700 dark:text-sky-400">
                        Activo
                      </span>
                    )}
                  </button>

                  <div className="mt-2 pt-2 border-t border-slate-100 dark:border-white/[0.06] max-h-56 overflow-y-auto space-y-1">
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
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 font-semibold'
                                : 'hover:bg-slate-50 dark:hover:bg-white/[0.04] text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
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
                              <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
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
            className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 bg-slate-50 dark:bg-white/[0.04] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] rounded-full transition-all cursor-pointer group text-left min-h-[34px]"
          >
            <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-[11px] shrink-0">
              {currentUser.full_name ? (
                currentUser.full_name.charAt(0).toUpperCase()
              ) : (
                <UserIcon className="w-3.5 h-3.5" />
              )}
            </div>
            <div className="hidden md:block max-w-[135px]">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate leading-tight">
                {currentUser.full_name || 'Mi Perfil'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize truncate leading-tight">
                {currentUser.role || 'analista'}
              </div>
            </div>
          </button>
        )}
      </div>
    </header>
  );
};
