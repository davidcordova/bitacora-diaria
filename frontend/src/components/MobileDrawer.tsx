import React from 'react';
import { X } from 'lucide-react';
import { ResumenPreview } from './ResumenPreview';
import { Bitacora } from '../types';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  bitacora: Bitacora;
  isGenerated: boolean;
  onOpenWhatsApp?: () => void;
}

export const MobileDrawer: React.FC<MobileDrawerProps> = ({
  isOpen,
  onClose,
  bitacora,
  isGenerated,
  onOpenWhatsApp,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in">
      <div className="bg-white dark:bg-[#13141F] rounded-t-3xl max-h-[85vh] overflow-y-auto p-4 sm:p-6 shadow-2xl relative border-t border-slate-200/90 dark:border-[#252636]">
        <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-200/80 dark:border-[#252636]">
          <div className="w-12 h-1 bg-slate-300 dark:bg-[#252636] rounded-full mx-auto absolute top-2 left-1/2 -translate-x-1/2" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 pt-1">Resumen de Bitácora</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-[#1C1D2A] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <ResumenPreview
          bitacora={bitacora}
          isGenerated={isGenerated}
          onOpenWhatsApp={onOpenWhatsApp}
        />
      </div>
    </div>
  );
};
