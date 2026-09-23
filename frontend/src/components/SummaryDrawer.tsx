import React, { useEffect } from 'react';
import { X, FileText, Sparkles } from 'lucide-react';
import { ResumenPreview } from './ResumenPreview';
import { Bitacora } from '../types';
import { formatDuration } from '../utils/formatters';

interface SummaryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bitacora: Bitacora;
  isGenerated: boolean;
  onOpenWhatsApp?: () => void;
}

export const SummaryDrawer: React.FC<SummaryDrawerProps> = ({
  isOpen,
  onClose,
  bitacora,
  isGenerated,
  onOpenWhatsApp,
}) => {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const totalMinutos = bitacora.actividades.reduce(
    (sum, a) => sum + (Number(a.duracion_min) || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop with soft blur */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* Slide-over panel (Right docked on desktop, bottom/full on mobile) */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-lg md:max-w-xl bg-white dark:bg-[#13141F] border-l border-slate-200/80 dark:border-[#252636] shadow-2xl flex flex-col transform transition-transform ease-out duration-300 animate-in slide-in-from-right">
          {/* Header Bar */}
          <div className="px-5 py-4 bg-slate-50 dark:bg-[#161722] border-b border-slate-200/80 dark:border-[#252636] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00F0FF] to-[#00A3BF] text-slate-950 flex items-center justify-center shadow-sm shadow-[#00F0FF]/20 shrink-0">
                <FileText className="w-5 h-5 font-bold" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 leading-tight">
                    Resumen de Bitácora
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30">
                    {bitacora.actividades.length} {bitacora.actividades.length === 1 ? 'tarea' : 'tareas'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Tiempo total acumulado: <strong className="text-slate-800 dark:text-slate-200">{formatDuration(totalMinutos)}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono hidden sm:inline">ESC para cerrar</span>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#161722] rounded-full transition-colors cursor-pointer"
                title="Cerrar panel de resumen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            <ResumenPreview
              bitacora={bitacora}
              isGenerated={isGenerated}
              onOpenWhatsApp={onOpenWhatsApp}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
