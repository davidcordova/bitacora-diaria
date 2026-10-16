import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';

/**
 * Diálogos propios (reemplazan window.confirm / window.alert):
 *   if (!(await confirmDialog('¿Eliminar?'))) return;
 *   alertDialog('No se pudo subir el archivo');
 * Requiere montar <DialogHost /> una vez en la raíz de la app.
 */

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface DialogRequest extends ConfirmOptions {
  kind: 'confirm' | 'alert';
  resolve: (value: boolean) => void;
}

let enqueue: ((req: DialogRequest) => void) | null = null;

const DELETE_WORDS = /eliminar|borrar|purgar|revocar|permanente/i;

export function confirmDialog(input: string | ConfirmOptions): Promise<boolean> {
  const opts: ConfirmOptions = typeof input === 'string' ? { message: input } : input;
  const danger = opts.danger ?? DELETE_WORDS.test(opts.message);
  return new Promise((resolve) => {
    if (!enqueue) {
      // Sin host montado (no debería ocurrir): degradar al diálogo nativo
      resolve(window.confirm(opts.message));
      return;
    }
    enqueue({ kind: 'confirm', ...opts, danger, resolve });
  });
}

export function alertDialog(message: string, title = 'Aviso'): Promise<void> {
  return new Promise((resolve) => {
    if (!enqueue) {
      window.alert(message);
      resolve();
      return;
    }
    enqueue({ kind: 'alert', title, message, resolve: () => resolve() });
  });
}

export const DialogHost: React.FC = () => {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const current = queue[0];

  useEffect(() => {
    enqueue = (req) => setQueue((q) => [...q, req]);
    return () => {
      enqueue = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    confirmBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const close = (value: boolean) => {
    if (!current) return;
    current.resolve(current.kind === 'alert' ? true : value);
    setQueue((q) => q.slice(1));
  };

  if (!current) return null;

  const isConfirm = current.kind === 'confirm';
  const danger = isConfirm && current.danger;
  const title = current.title || (isConfirm ? (danger ? 'Confirmar eliminación' : 'Confirmar acción') : 'Aviso');

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-3 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-dialog-title"
      aria-describedby="app-dialog-message"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close(false);
      }}
    >
      <div className="w-full max-w-sm bg-white dark:bg-[#13141F] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#252636] p-5 animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              danger
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                : 'bg-[#00F0FF]/10 border-[#00F0FF]/30 text-[#00A3BF] dark:text-[#00F0FF]'
            }`}
          >
            {danger ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <h2 id="app-dialog-title" className="text-sm font-bold text-slate-900 dark:text-white">
              {title}
            </h2>
            <p id="app-dialog-message" className="text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed whitespace-pre-line break-words">
              {current.message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          {isConfirm && (
            <button
              type="button"
              id="app-dialog-cancel"
              onClick={() => close(false)}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            >
              {current.cancelText || 'Cancelar'}
            </button>
          )}
          <button
            type="button"
            id="app-dialog-confirm"
            ref={confirmBtnRef}
            onClick={() => close(true)}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold cursor-pointer transition-all ${
              danger
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] text-slate-950 hover:brightness-110'
            }`}
          >
            {isConfirm ? current.confirmText || (danger ? 'Eliminar' : 'Aceptar') : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  );
};
