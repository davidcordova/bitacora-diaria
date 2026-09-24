import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
  CheckCheck,
  Trash2,
  X,
  Clock,
  Sparkles,
  BellOff,
  Filter,
} from 'lucide-react';
import { SystemNotification } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: SystemNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onRemoveNotification: (id: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onRemoveNotification,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;
  const filteredNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.read)
    : notifications;

  const formatRelativeTime = (timestamp: string): string => {
    try {
      const now = new Date();
      const date = new Date(timestamp);
      const diffMs = Math.max(0, now.getTime() - date.getTime());
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 60) return 'Hace un momento';
      if (diffMin < 60) return `Hace ${diffMin} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} días`;

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${mins}`;
    } catch {
      return 'Reciente';
    }
  };

  const getTypeConfig = (type: SystemNotification['type']) => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle2,
          iconColor: 'text-emerald-500 dark:text-emerald-400',
          bg: 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40',
          badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
          label: 'Éxito',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: 'text-amber-500 dark:text-amber-400',
          bg: 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40',
          badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
          label: 'Aviso',
        };
      case 'alert':
      case 'error':
        return {
          icon: AlertCircle,
          iconColor: 'text-rose-500 dark:text-rose-400',
          bg: 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/40',
          badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
          label: 'Alerta',
        };
      case 'info':
      default:
        return {
          icon: Info,
          iconColor: 'text-[#00A3BF] dark:text-[#00F0FF]',
          bg: 'bg-sky-50/50 dark:bg-[#161722] border-sky-200/60 dark:border-[#252636]',
          badge: 'bg-[#00F0FF]/10 text-[#0090A0] dark:text-[#00F0FF] border-[#00F0FF]/30',
          label: 'Info',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Background click listener */}
      <div className="absolute inset-0 cursor-pointer" onClick={onClose} />

      {/* Slide-in Notifications Panel */}
      <div
        className="relative w-full sm:max-w-md h-full sm:h-[92vh] sm:rounded-3xl bg-white dark:bg-[#11121B] border-l sm:border border-slate-200 dark:border-[#252636] shadow-2xl flex flex-col overflow-hidden z-10 animate-in slide-in-from-right duration-250"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#202230] bg-slate-50/80 dark:bg-[#161722]/80 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#00F0FF]/15 border border-[#00F0FF]/30 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center shadow-xs">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Notificaciones
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#00F0FF] text-slate-950 shadow-xs">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Historial de eventos y sincronización
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5 rounded-xl transition-colors cursor-pointer"
            title="Cerrar panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter and Global Action Buttons */}
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-[#202230] bg-white dark:bg-[#11121B] flex items-center justify-between gap-2 shrink-0">
          {/* Tabs: Todas / No leídas */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1A1C29] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-white dark:bg-[#252636] text-slate-900 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                filter === 'unread'
                  ? 'bg-white dark:bg-[#252636] text-[#00A3BF] dark:text-[#00F0FF] shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
              }`}
            >
              No leídas ({unreadCount})
            </button>
          </div>

          {/* Actions: Mark all as read & Clear */}
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="flex items-center gap-1 text-[11px] font-bold text-[#00A3BF] dark:text-[#00F0FF] hover:bg-[#00F0FF]/10 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                title="Marcar todas como leídas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Leídas</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                title="Limpiar todo el historial"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Notifications List Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {filteredNotifications.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
              <div className="w-14 h-14 rounded-3xl bg-slate-100 dark:bg-[#1A1C29] border border-slate-200 dark:border-[#252636] flex items-center justify-center mb-3 text-slate-300 dark:text-slate-600">
                <BellOff className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                {filter === 'unread' ? 'Sin notificaciones no leídas' : 'Historial vacío'}
              </h4>
              <p className="text-xs max-w-xs leading-relaxed">
                {filter === 'unread'
                  ? 'Estás al día con todos los registros y avisos del sistema.'
                  : 'Aquí se mostrarán las confirmaciones de guardado, cambios de estado y avisos.'}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const cfg = getTypeConfig(notif.type);
              const IconComp = cfg.icon;

              return (
                <div
                  key={notif.id}
                  onClick={() => {
                    if (!notif.read) onMarkAsRead(notif.id);
                  }}
                  className={`group relative p-3.5 rounded-2xl border transition-all cursor-pointer ${cfg.bg} ${
                    !notif.read
                      ? 'shadow-xs border-l-4 border-l-[#00F0FF]'
                      : 'opacity-85 hover:opacity-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <IconComp className={`w-4 h-4 ${cfg.iconColor}`} />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.2 rounded-md border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                        <h5 className={`text-xs font-bold truncate ${!notif.read ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}`}>
                          {notif.title}
                        </h5>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug break-words">
                        {notif.message}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        <Clock className="w-3 h-3" />
                        <span>{formatRelativeTime(notif.timestamp)}</span>
                      </div>
                    </div>

                    {/* Unread dot or Delete Button */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-[#00F0FF] shadow-xs" title="No leída" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveNotification(notif.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 p-1 rounded-md transition-all cursor-pointer"
                        title="Eliminar notificación"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Panel Footer */}
        <div className="p-3 bg-slate-50/60 dark:bg-[#161722]/60 border-t border-slate-100 dark:border-[#202230] text-[11px] text-slate-400 dark:text-slate-500 text-center shrink-0">
          Bitácora Diaria • Sistema de Notificaciones en Tiempo Real
        </div>
      </div>
    </div>
  );
};
