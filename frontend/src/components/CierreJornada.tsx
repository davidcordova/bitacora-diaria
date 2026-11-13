import React, { useMemo } from 'react';
import { CheckSquare, Sparkles, Play, RefreshCw, UserCheck } from 'lucide-react';
import { Actividad } from '../types';
import { stripHtml } from '../utils/formatters';

interface CierreJornadaProps {
  pendientes: string;
  necesitaApoyo: 'Si' | 'No';
  apoyoDetalle: string;
  prioridadSiguiente: string;
  isSaving: boolean;
  onChange: (field: string, value: string) => void;
  onSubmit: () => void;
  isProxyMode?: boolean;
  proxyUserName?: string;
  actividades?: Actividad[];
}

export const CierreJornada: React.FC<CierreJornadaProps> = ({
  pendientes,
  necesitaApoyo,
  apoyoDetalle,
  prioridadSiguiente,
  isSaving,
  onChange,
  onSubmit,
  isProxyMode = false,
  proxyUserName,
  actividades = [],
}) => {
  const openTasks = useMemo(
    () =>
      (actividades || []).filter(
        (a) => !a.is_deleted && a.estado !== 'completada' && (a.descripcion || '').trim().length > 0
      ),
    [actividades]
  );

  const handleAutoFillFromOpenTasks = () => {
    if (openTasks.length === 0) return;
    const lines = openTasks.map((t) => {
      const plain = stripHtml(t.descripcion || '').trim();
      const statusLabel =
        t.estado === 'en_revision' ? '[En revisión]' : t.estado === 'pendiente' ? '[Por iniciar]' : '[En proceso]';
      return `• ${plain} ${statusLabel}`;
    });
    const combined = lines.join('\n');
    onChange('pendientes', combined);
    if (!prioridadSiguiente.trim()) {
      const firstPlain = stripHtml(openTasks[0].descripcion || '').trim();
      onChange('prioridad_siguiente', `Culminar: ${firstPlain}`);
    }
  };

  return (
    <div className="bg-white dark:bg-[#161922] rounded-xl border border-slate-200/80 dark:border-white/[0.07] p-4 sm:p-5 shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-slate-200/70 dark:border-white/[0.06] pb-3">
        <div className="flex items-center gap-2.5 text-slate-800 dark:text-slate-100">
          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-white/[0.08]">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-[15px] font-bold tracking-tight">Cierre de jornada</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Opcional: registra pendientes o prioridades para la siguiente jornada.
            </p>
          </div>
        </div>

        {openTasks.length > 0 && (
          <button
            type="button"
            onClick={handleAutoFillFromOpenTasks}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200/70 dark:bg-[#1E222D] dark:hover:bg-white/[0.08] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/[0.08] transition-colors cursor-pointer"
            title="Rellenar pendientes y prioridad automáticamente con las actividades aún en curso"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Autocompletar ({openTasks.length} en curso)</span>
          </button>
        )}
      </div>

      {/* 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Pendientes <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
          </label>
          <textarea
            rows={2}
            value={pendientes}
            onChange={(e) => onChange('pendientes', e.target.value)}
            placeholder="Notas sobre temas que continuarán en otra fecha..."
            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] focus:bg-white dark:focus:bg-[#1E222D] text-xs sm:text-[13px] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200/90 dark:border-white/[0.08] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 outline-hidden transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Prioridad siguiente <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
          </label>
          <textarea
            rows={2}
            value={prioridadSiguiente}
            onChange={(e) => onChange('prioridad_siguiente', e.target.value)}
            placeholder="Foco principal para mañana..."
            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] focus:bg-white dark:focus:bg-[#1E222D] text-xs sm:text-[13px] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200/90 dark:border-white/[0.08] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 outline-hidden transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Row 2: Apoyo */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-4">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            ¿Requiere apoyo del equipo?
          </label>
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-[#1E222D] p-1 rounded-lg border border-slate-200/80 dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => onChange('necesita_apoyo', 'No')}
              className={`py-1.5 px-2.5 text-xs font-semibold rounded-md transition-colors cursor-pointer text-center ${
                necesitaApoyo === 'No'
                  ? 'bg-white dark:bg-[#282E3D] text-slate-800 dark:text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              No, en orden
            </button>
            <button
              type="button"
              onClick={() => onChange('necesita_apoyo', 'Si')}
              className={`py-1.5 px-2.5 text-xs font-semibold rounded-md transition-colors cursor-pointer text-center ${
                necesitaApoyo === 'Si'
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
            >
              Sí, requiero apoyo
            </button>
          </div>
        </div>

        <div className="md:col-span-8">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            Detalle del apoyo{' '}
            {necesitaApoyo === 'Si' ? (
              <span className="text-amber-600 dark:text-amber-400 font-semibold">(requerido)</span>
            ) : (
              <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
            )}
          </label>
          <input
            type="text"
            value={apoyoDetalle}
            onChange={(e) => onChange('apoyo_detalle', e.target.value)}
            placeholder={
              necesitaApoyo === 'Si'
                ? 'Especifica el bloqueo o soporte que necesitas...'
                : 'Sin bloqueos registrados'
            }
            disabled={necesitaApoyo === 'No'}
            className={`w-full px-3 py-2 text-xs sm:text-[13px] rounded-lg border transition-all outline-hidden ${
              necesitaApoyo === 'No'
                ? 'bg-slate-50/70 dark:bg-[#141720] text-slate-400 dark:text-slate-600 border-slate-200/70 dark:border-white/[0.05] cursor-not-allowed'
                : 'bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-100 border-amber-300 dark:border-amber-500/40 focus:ring-2 focus:ring-amber-500/15'
            }`}
          />
        </div>
      </div>

      {/* Action Area */}
      <div className="mt-4 pt-3.5 border-t border-slate-200/70 dark:border-white/[0.06] flex items-center justify-end">
        {isProxyMode ? (
          <div className="flex items-center gap-2 p-2 px-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-medium">
            <UserCheck className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              <strong>Modo Apoyo:</strong> El cierre formal corresponde al titular ({proxyUserName || 'colaborador'}).
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[36px]"
          >
            {isSaving ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isSaving ? 'Guardando...' : 'Generar Bitácora'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
