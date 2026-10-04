import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  HelpCircle,
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
} from 'lucide-react';
import { User, ViewMode } from '../types';

interface TopHeaderProps {
  currentView?: ViewMode;
  currentUser: User | null;
  bitacoraFecha?: string;
  activitiesCount?: number;
  onOpenHelp?: () => void;
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
  currentUser,
  bitacoraFecha,
  activitiesCount = 0,
  onOpenHelp,
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

  // Cerrar menú al hacer clic fuera
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
  // Helper para formatear fecha en la cabecera
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

  // Metadatos por módulo activo
  const getViewMeta = () => {
    switch (currentView) {
      case 'kanban':
        return {
          title: 'Tablero de Actividades',
          icon: <Kanban className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
          subtitle: 'Flujo visual de tareas por estados',
          badge: `${activitiesCount} en tablero`,
          badgeColor: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
        };
      case 'dashboard':
        return {
          title: 'Dashboard de Rendimiento & KPIs',
          icon: <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
          subtitle: 'Analítica de productividad y horas invertidas',
          badge: 'Métricas en Vivo',
          badgeColor: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
        };
      case 'equipo':
        return {
          title: 'Supervisión de Equipo',
          icon: <Users className="w-4 h-4 text-cyan-600 dark:text-[#00F0FF]" />,
          subtitle: 'Seguimiento de bitácoras y avance en tiempo real',
          badge: 'Líder / Admin',
          badgeColor: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-[#00F0FF] border-cyan-200 dark:border-cyan-800/60',
        };
      case 'gestion':
        return {
          title: 'Administración del Sistema',
          icon: <Settings className="w-4 h-4 text-rose-600 dark:text-rose-400" />,
          subtitle: 'Gestión centralizada de usuarios, equipos y ajustes',
          badge: 'Panel Admin',
          badgeColor: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
        };
      case 'historial':
        return {
          title: 'Historial de Bitácoras',
          icon: <History className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
          subtitle: 'Consultas de jornadas anteriores y registros',
          badge: 'Archivo',
          badgeColor: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/60',
        };
      case 'buzon':
        return {
          title: 'Buzón de Sugerencias',
          icon: <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
          subtitle: 'Propuestas de mejora continua e innovación',
          badge: 'Comunidad',
          badgeColor: 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
        };
      case 'vault':
        return {
          title: 'Accesos Directos & Bóveda TI',
          icon: <KeyRound className="w-4 h-4 text-cyan-600 dark:text-[#00F0FF]" />,
          subtitle: 'Directorio de cuentas, credenciales AES-256 y enlaces',
          badge: 'Gestor IT',
          badgeColor: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-[#00F0FF] border-cyan-200 dark:border-cyan-800/60',
        };
      case 'manual':
        return {
          title: 'Manual de Procesos & Operaciones',
          icon: <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          subtitle: 'Guía interactiva paso a paso para el uso integral del sistema',
          badge: 'Guía Online',
          badgeColor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
        };
      case 'lista':
      default:
        return {
          title: 'Mi Bitácora Diaria',
          icon: <CalendarCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
          subtitle: `Jornada laboral • ${currentUser?.team_name || 'Marketing Alterno'}`,
          badge: bitacoraFecha ? `📅 ${formatHeaderDate(bitacoraFecha)}` : 'Hoy',
          badgeColor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
        };
    }
  };

  const meta = getViewMeta();

  return (
    <header className="w-full px-3 sm:px-6 py-2 sm:py-2.5 border-b border-slate-200/80 dark:border-white/5 bg-white/90 dark:bg-[#0D0E15]/90 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 select-none">
      {/* Left Area: Mobile Hamburger Menu + Active Module Breadcrumb */}
      <div className="flex items-center gap-2.5 sm:gap-3.5 flex-1 min-w-0">
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

        {/* Executive Module Indicator (Replaces redundant duplicate search input) */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 shrink-0 shadow-2xs">
            {meta.icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {meta.title}
              </h1>
              {meta.badge && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shadow-2xs hidden xs:inline-block ${meta.badgeColor}`}>
                  {meta.badge}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden md:block">
              {meta.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Action Icons Right */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Sincronización en la nube */}
        {onForceSyncCloud && (
          <button
            type="button"
            onClick={autoSaveStatus === 'error' && onOpenErrorReport ? onOpenErrorReport : onForceSyncCloud}
            title={
              autoSaveStatus === 'saving'
                ? 'Sincronizando con el servidor...'
                : autoSaveStatus === 'error'
                ? 'Error al sincronizar con el servidor. Clic para ver diagnóstico técnico y reportar incidencia'
                : 'Sincronizado en la nube. Clic para forzar actualización'
            }
            className={`min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] p-2 rounded-full transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs font-semibold ${
              autoSaveStatus === 'saving'
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                : autoSaveStatus === 'error'
                ? 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 animate-pulse'
                : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
            }`}
          >
            {autoSaveStatus === 'saving' ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : autoSaveStatus === 'error' ? (
              <CloudOff className="w-4 h-4 text-rose-500" />
            ) : (
              <Cloud className="w-4 h-4 text-emerald-500" />
            )}
            <span className="hidden xl:inline text-[11px]">
              {autoSaveStatus === 'saving' ? 'Guardando...' : autoSaveStatus === 'error' ? 'Sin conexión' : 'Nube OK'}
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
          className="relative min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] p-2 text-slate-500 hover:text-cyan-700 dark:text-slate-400 dark:hover:text-[#00F0FF] hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 px-1.5 py-0.2 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs animate-in zoom-in duration-150">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Help Circle (Desktop / Tablet) */}
        {onOpenHelp && (
          <button
            type="button"
            onClick={onOpenHelp}
            title="Guía rápida y ayuda"
            className="hidden sm:flex min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer items-center justify-center"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}

        {/* Context Selector / Modo Apoyo */}
        {(delegatedTargets.length > 0 || activeProxyUser || currentUser?.role === 'admin') && onSelectProxyUser && (
          <div className="relative" ref={proxyMenuRef}>
            <button
              type="button"
              onClick={() => setProxyMenuOpen(!proxyMenuOpen)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                activeProxyUser
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
                  : 'bg-slate-100/80 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-cyan-500/40'
              }`}
              title={
                activeProxyUser
                  ? `Registrando tareas en apoyo a: ${activeProxyUser.full_name}. Clic para cambiar o salir.`
                  : 'Modo Apoyo: registrar tareas para otro colaborador'
              }
            >
              <UserCheck className={`w-3.5 h-3.5 ${activeProxyUser ? 'text-amber-500' : 'text-cyan-500'}`} />
              <span className="hidden sm:inline font-medium">
                {activeProxyUser ? `Apoyando: ${activeProxyUser.full_name.split(' ')[0]}` : 'Modo Apoyo'}
              </span>
              {activeProxyUser ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectProxyUser(null);
                  }}
                  className="p-0.5 hover:bg-amber-500/30 rounded-full transition-colors cursor-pointer text-amber-600 dark:text-amber-300 inline-flex items-center"
                  title="Volver a mi bitácora personal"
                >
                  <X className="w-3 h-3" />
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-[#00F0FF] font-bold">
                  {delegatedTargets.length}
                </span>
              )}
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {/* Dropdown Menu */}
            {proxyMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white dark:bg-[#12131C] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5 mb-2">
                  <div className="text-xs font-bold text-slate-800 dark:text-white flex items-center justify-between">
                    <span>Seleccionar Colaborador</span>
                    {activeProxyUser && (
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        Modo Apoyo
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Registra tareas directamente en la jornada de un compañero de trabajo.
                  </p>
                </div>

                {/* Búsqueda rápida si hay más de 3 colaboradores */}
                {delegatedTargets.length > 3 && (
                  <div className="relative px-2 mb-2">
                    <Search className="w-3.5 h-3.5 absolute left-4 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={proxySearch}
                      onChange={(e) => setProxySearch(e.target.value)}
                      placeholder="Buscar por nombre o equipo..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
                    />
                  </div>
                )}

                {/* Opción 1: Mi propia bitácora */}
                <button
                  type="button"
                  onClick={() => {
                    onSelectProxyUser(null);
                    setProxyMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                    !activeProxyUser
                      ? 'bg-cyan-500/15 text-cyan-800 dark:text-[#00F0FF] font-bold'
                      : 'hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-[#00F0FF] flex items-center justify-center font-bold text-xs shrink-0">
                    {currentUser?.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'M'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs truncate font-semibold">Mi Bitácora Personal</div>
                    <div className="text-[10px] text-slate-500 truncate">{currentUser?.full_name}</div>
                  </div>
                  {!activeProxyUser && <span className="text-[10px] font-bold text-cyan-600 dark:text-[#00F0FF]">Activo</span>}
                </button>

                {/* Lista de colaboradores delegados */}
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
                            <div className="text-xs truncate font-semibold">{target.full_name}</div>
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

        {/* User Profile Pill Button (Consolidated "Mi Perfil") */}
        {currentUser && (
          <button
            type="button"
            onClick={onOpenProfile}
            title={`Conectado como ${currentUser.full_name} (@${currentUser.username}) - Clic para ver y editar mi perfil`}
            className="flex items-center gap-2 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] border border-slate-200/80 dark:border-[#252636] hover:border-[#00F0FF]/40 rounded-full transition-all cursor-pointer group text-left min-h-[38px] sm:min-h-[40px]"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#00F0FF] to-cyan-600 text-slate-950 font-black flex items-center justify-center text-xs shadow-xs group-hover:scale-105 transition-transform shrink-0 font-heading">
              {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
            </div>
            <div className="hidden md:block max-w-[140px]">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-cyan-700 dark:group-hover:text-[#00F0FF] transition-colors truncate">
                {currentUser.full_name || 'Mi Perfil'}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize truncate font-medium">
                {currentUser.role || 'analista'}
              </div>
            </div>
          </button>
        )}
      </div>
    </header>
  );
};
