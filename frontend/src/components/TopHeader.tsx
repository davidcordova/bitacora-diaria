import React, { useState } from 'react';
import { Search, Bell, HelpCircle, User as UserIcon, KeyRound, Trash2, Cloud, CloudOff, RefreshCw, Menu } from 'lucide-react';
import { User } from '../types';

interface TopHeaderProps {
  currentUser: User | null;
  onOpenHelp?: () => void;
  onSearch?: (query: string) => void;
  onOpenChangePassword?: () => void;
  onOpenPapelera?: () => void;
  papeleraCount?: number;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onForceSyncCloud?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onToggleMobileMenu?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  onOpenHelp,
  onSearch,
  onOpenChangePassword,
  onOpenPapelera,
  papeleraCount = 0,
  autoSaveStatus = 'idle',
  onForceSyncCloud,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onToggleMobileMenu,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (onSearch) onSearch(q);
  };

  return (
    <header className="w-full px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-100 dark:border-white/5 bg-white/90 dark:bg-[#0D0E15]/90 backdrop-blur-md flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 select-none">
      {/* Left Area: Mobile Hamburger Menu + Search Bar */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-lg">
        {onToggleMobileMenu && (
          <button
            type="button"
            onClick={onToggleMobileMenu}
            aria-label="Abrir menú de navegación"
            className="md:hidden min-w-[40px] min-h-[40px] p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer shrink-0 flex items-center justify-center"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Search Input Bar */}
        <div className="flex-1 relative min-w-0">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Buscar tarea, código, cliente..."
            className="w-full pl-8 sm:pl-9 pr-3 sm:pr-4 py-2 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl border border-slate-200/80 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
          />
          <Search className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400 dark:text-slate-500 absolute left-2.5 sm:left-3 top-2.5 sm:top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Action Icons Right */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {/* Sincronización en la nube */}
        {onForceSyncCloud && (
          <button
            type="button"
            onClick={onForceSyncCloud}
            title={
              autoSaveStatus === 'saving'
                ? 'Sincronizando con el servidor...'
                : autoSaveStatus === 'error'
                ? 'Error al sincronizar con el servidor. Clic para forzar sincronización'
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
          className="relative min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] p-2 text-slate-500 hover:text-[#00F0FF] dark:text-slate-400 dark:hover:text-[#00F0FF] hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationsCount > 0 && (
            <span className="absolute top-1 right-1 px-1.5 py-0.2 min-w-[16px] h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs animate-in zoom-in duration-150">
              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
            </span>
          )}
        </button>

        {/* Papelera de Reciclaje */}
        {onOpenPapelera && (
          <button
            type="button"
            onClick={onOpenPapelera}
            title="Papelera de reciclaje (15 días de retención)"
            className="relative min-w-[38px] min-h-[38px] sm:min-w-[40px] sm:min-h-[40px] p-2 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors cursor-pointer flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
            {papeleraCount > 0 && (
              <span className="absolute top-1 right-1 px-1.5 py-0.2 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                {papeleraCount}
              </span>
            )}
          </button>
        )}

        {/* Cambiar contraseña (Desktop / Tablet) */}
        {onOpenChangePassword && (
          <button
            type="button"
            onClick={onOpenChangePassword}
            title="Cambiar mi contraseña"
            className="hidden sm:flex min-w-[40px] min-h-[40px] p-2 text-slate-500 hover:text-[#00F0FF] dark:text-slate-400 dark:hover:text-[#00F0FF] hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer items-center justify-center"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        )}

        {/* Help Circle (Desktop / Tablet) */}
        {onOpenHelp && (
          <button
            type="button"
            onClick={onOpenHelp}
            title="Guía rápida y ayuda"
            className="hidden sm:flex min-w-[40px] min-h-[40px] p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer items-center justify-center"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}

        {/* User Avatar Circle */}
        <div 
          onClick={onOpenChangePassword}
          title={currentUser ? `${currentUser.full_name} (@${currentUser.username}) - Clic para cambiar clave` : undefined}
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center text-xs font-extrabold cursor-pointer shrink-0 hover:scale-105 active:scale-95 transition-transform"
        >
          {currentUser?.full_name ? (
            currentUser.full_name.charAt(0).toUpperCase()
          ) : (
            <UserIcon className="w-4 h-4" />
          )}
        </div>
      </div>
    </header>
  );
};

