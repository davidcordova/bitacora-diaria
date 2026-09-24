import React, { useState } from 'react';
import { Search, Bell, HelpCircle, User as UserIcon, KeyRound, Trash2 } from 'lucide-react';
import { User } from '../types';

interface TopHeaderProps {
  currentUser: User | null;
  onOpenHelp?: () => void;
  onSearch?: (query: string) => void;
  onOpenChangePassword?: () => void;
  onOpenPapelera?: () => void;
  papeleraCount?: number;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentUser,
  onOpenHelp,
  onSearch,
  onOpenChangePassword,
  onOpenPapelera,
  papeleraCount = 0,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (onSearch) onSearch(q);
  };

  return (
    <header className="w-full px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-white/5 bg-white/80 dark:bg-[#0D0E15]/80 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* Search Input Bar */}
      <div className="flex-1 max-w-md relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Buscar bitácora, código o tarea..."
          className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] focus:bg-white dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 rounded-xl border border-slate-200/80 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
        />
        <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
      </div>

      {/* Action Icons Right */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Cambiar contraseña */}
        {onOpenChangePassword && (
          <button
            type="button"
            onClick={onOpenChangePassword}
            title="Cambiar mi contraseña"
            className="p-2 text-slate-500 hover:text-[#00F0FF] dark:text-slate-400 dark:hover:text-[#00F0FF] hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
          </button>
        )}

        {/* Notification Bell */}
        <button
          type="button"
          title="Notificaciones"
          className="relative p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#0D0E15]" />
        </button>

        {/* Help Circle */}
        {onOpenHelp && (
          <button
            type="button"
            onClick={onOpenHelp}
            title="Guía rápida y ayuda"
            className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}

        {/* Papelera de Reciclaje */}
        {onOpenPapelera && (
          <button
            type="button"
            onClick={onOpenPapelera}
            title="Papelera de reciclaje (15 días de retención)"
            className="relative p-2 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            {papeleraCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 px-1.5 py-0.2 min-w-[16px] h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                {papeleraCount}
              </span>
            )}
          </button>
        )}

        {/* User Avatar Circle */}
        <div 
          onClick={onOpenChangePassword}
          title={currentUser ? `${currentUser.full_name} (@${currentUser.username}) - Clic para cambiar clave` : undefined}
          className="w-8 h-8 rounded-full bg-[#00F0FF]/15 border border-[#00F0FF]/40 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center text-xs font-extrabold cursor-pointer shrink-0 hover:scale-105 active:scale-95 transition-transform"
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
