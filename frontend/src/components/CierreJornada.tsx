import React from 'react';
import { CheckSquare, Sparkles, Send, Play } from 'lucide-react';

interface CierreJornadaProps {
  pendientes: string;
  necesitaApoyo: 'Si' | 'No';
  apoyoDetalle: string;
  prioridadSiguiente: string;
  isSaving: boolean;
  onChange: (field: string, value: string) => void;
  onSubmit: () => void;
}

export const CierreJornada: React.FC<CierreJornadaProps> = ({
  pendientes,
  necesitaApoyo,
  apoyoDetalle,
  prioridadSiguiente,
  isSaving,
  onChange,
  onSubmit,
}) => {
  return (
    <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-5 sm:p-6 shadow-sm transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 border-b border-slate-100 dark:border-[#252636]/60 pb-3.5">
        <div className="flex items-center gap-2.5 text-slate-800 dark:text-white">
          <div className="p-2 rounded-xl bg-[#EC4899]/15 text-[#EC4899]">
            <CheckSquare className="w-4 h-4 stroke-[2.5]" />
          </div>
          <h2 className="text-base sm:text-lg font-extrabold tracking-tight">Cierre de jornada</h2>
        </div>
        <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
          Campos requeridos <span className="text-rose-500">*</span>
        </span>
      </div>

      {/* 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 mb-4.5">
        {/* Col 1: Pendientes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Pendientes para otro momento <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={pendientes}
            onChange={(e) => onChange('pendientes', e.target.value)}
            placeholder="Ajustes o tareas que quedan pendientes para otra fecha..."
            className="w-full px-3.5 py-2.5 bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white dark:bg-[#161722] dark:hover:bg-[#1A1C29] dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] dark:focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            required
          />
        </div>

        {/* Col 2: Prioridad para el siguiente día */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Prioridad para el siguiente día <span className="text-rose-500">*</span>
          </label>
          <textarea
            rows={3}
            value={prioridadSiguiente}
            onChange={(e) => onChange('prioridad_siguiente', e.target.value)}
            placeholder="¿Cuál será tu principal objetivo al iniciar la siguiente jornada?"
            className="w-full px-3.5 py-2.5 bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white dark:bg-[#161722] dark:hover:bg-[#1A1C29] dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] dark:focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
            required
          />
        </div>
      </div>

      {/* Row 2: Apoyo del jefe */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* ¿Necesitas apoyo del jefe? */}
        <div className="md:col-span-3">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            ¿Necesitas apoyo del jefe? <span className="text-rose-500">*</span>
          </label>
          <select
            value={necesitaApoyo}
            onChange={(e) => onChange('necesita_apoyo', e.target.value)}
            className={`w-full px-3.5 py-2.5 text-xs sm:text-sm font-bold rounded-xl border transition-all outline-hidden cursor-pointer ${
              necesitaApoyo === 'Si'
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700 ring-2 ring-amber-100 dark:ring-amber-900/30'
                : 'bg-slate-50/80 hover:bg-slate-100/70 dark:bg-[#161722] dark:hover:bg-[#1A1C29] text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-[#252636]'
            }`}
          >
            <option value="No" className="bg-white dark:bg-[#161722] text-slate-800 dark:text-slate-200">No</option>
            <option value="Si" className="bg-white dark:bg-[#161722] text-slate-800 dark:text-slate-200">Si</option>
          </select>
        </div>

        {/* ¿En qué? */}
        <div className="md:col-span-9">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            ¿En qué?{' '}
            {necesitaApoyo === 'Si' ? (
              <span className="text-amber-600 dark:text-amber-400 font-bold">(Requerido)</span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 font-normal">(Opcional)</span>
            )}
          </label>
          <input
            type="text"
            value={apoyoDetalle}
            onChange={(e) => onChange('apoyo_detalle', e.target.value)}
            placeholder={
              necesitaApoyo === 'Si'
                ? 'Especifica el bloqueo o apoyo requerido...'
                : 'Opcional si no requiere apoyo'
            }
            disabled={necesitaApoyo === 'No'}
            className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border transition-all outline-hidden ${
              necesitaApoyo === 'No'
                ? 'bg-slate-100/60 dark:bg-[#12131C] text-slate-400 dark:text-slate-600 border-slate-200 dark:border-[#252636]/60 cursor-not-allowed'
                : 'bg-slate-50/80 hover:bg-slate-100/70 focus:bg-white dark:bg-[#161722] dark:hover:bg-[#1A1C29] dark:focus:bg-[#161722] text-slate-800 dark:text-slate-100 border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] dark:focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30'
            }`}
          />
        </div>
      </div>

      {/* Action Button: Glowing Purple Pill "Generar bitácora del día" */}
      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-[#252636]/60 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <Sparkles className="w-4 h-4 text-[#00F0FF]" />
          <span>Genera el resumen listo para compartir por WhatsApp, correo o Teams.</span>
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          className="w-full sm:w-auto flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#A855F7] to-[#6366F1] hover:from-[#9333EA] hover:to-[#4F46E5] active:scale-95 disabled:opacity-60 text-white px-7 py-3 rounded-full text-xs sm:text-sm font-extrabold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all cursor-pointer min-h-[42px]"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isSaving ? 'Guardando...' : 'Generar bitácora del día'}</span>
        </button>
      </div>
    </div>
  );
};
