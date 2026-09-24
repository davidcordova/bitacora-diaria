import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  // Limitar a máximo los 3 toasts más recientes para no saturar ni tapar la pantalla
  const recentToasts = toasts.slice(-3);

  return (
    <div className="fixed bottom-4 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {recentToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    // 3000ms antes de empezar la animación de salida
    const closeTimer = setTimeout(() => {
      setIsClosing(true);
    }, 2900);

    // 3200ms para desmontarlo completamente
    const removeTimer = setTimeout(() => {
      onDismissRef.current(toast.id);
    }, 3200);

    return () => {
      clearTimeout(closeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id]);

  const handleManualDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      onDismissRef.current(toast.id);
    }, 150);
  };

  const config = {
    success: {
      bg: 'bg-slate-900/95 dark:bg-[#161722]/95 text-white border-[#00F0FF]/40 shadow-slate-950/30',
      icon: CheckCircle2,
      iconColor: 'text-[#00F0FF]',
      barColor: 'bg-[#00F0FF]',
    },
    error: {
      bg: 'bg-rose-950/95 text-white border-rose-600/60 shadow-rose-950/30',
      icon: AlertCircle,
      iconColor: 'text-rose-400',
      barColor: 'bg-rose-400',
    },
    info: {
      bg: 'bg-slate-900/95 dark:bg-[#161722]/95 text-white border-slate-700/60 shadow-slate-950/30',
      icon: Info,
      iconColor: 'text-cyan-400',
      barColor: 'bg-cyan-400',
    },
  }[toast.type];

  const Icon = config.icon;

  return (
    <div
      className={`pointer-events-auto relative overflow-hidden flex flex-col p-3 rounded-2xl border backdrop-blur-md shadow-2xl transition-all duration-200 ${
        isClosing
          ? 'opacity-0 translate-y-2 scale-95 pointer-events-none'
          : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-bottom-2 fade-in'
      } ${config.bg}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.iconColor}`} />
        <div className="flex-1 min-w-0">
          {toast.title && (
            <h4 className="text-xs font-bold leading-tight mb-0.5 text-white">{toast.title}</h4>
          )}
          <p className="text-[11px] text-slate-200 leading-snug break-words">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={handleManualDismiss}
          className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          title="Cerrar notificación"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Barra de progreso de auto-expiración */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10 overflow-hidden">
        <div className={`h-full ${config.barColor} animate-toast-progress`} />
      </div>
    </div>
  );
};

