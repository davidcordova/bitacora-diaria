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
    <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-5 sm:p-6 shadow-sm transition-all duration-200">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-slate-100 dark:border-[#252636]/60 pb-3">
        <div className="flex items-center gap-2.5 text-slate-800 dark:text-white">
          <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/15 to-blue-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
            <CheckSquare className="w-4 h-4 stroke-[2.5]" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight">Cierre de jornada</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Si dejas los campos en blanco, se registrará automáticamente como jornada sin pendientes.
            </p>
          </div>
        </div>

        {openTasks.length > 0 && (
          <button
            type="button"
            onClick={handleAutoFillFromOpenTasks}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800/60 transition-all cursor-pointer shadow-2xs"
            title="Rellenar pendientes y prioridad automáticamente con las actividades aún no completadas de hoy"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
            <span>Autocompletar con {openTasks.length} tarea(s) en curso</span>
          </button>
        )}
      </div>

      {/* 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Col 1: Pendientes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Pendientes <span className="text-slate-400 dark:text-slate-500 font-normal">(Opcional)</span>
          </label>
          <textarea
            rows={3}
            value={pendientes}
            onChange={(e) => onChange('pendientes', e.target.value)}
            placeholder="Sin tareas pendientes para otra fecha (escribe aquí si algo quedó en curso)..."
            className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-100/60 focus:bg-white dark:bg-[#161722] dark:hover:bg-[#1A1C29] dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-sky-600 dark:focus:border-[#00F0FF] focus:ring-2 focus:ring-sky-500/20 outline-hidden transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>

        {/* Col 2: Prioridad para el siguiente día */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Prioridad de mañana <span className="text-slate-400 dark:text-slate-500 font-normal">(Opcional)</span>
          </label>
          <textarea
            rows={3}
            value={prioridadSiguiente}
            onChange={(e) => onChange('prioridad_siguiente', e.target.value)}
            placeholder="Continuar con el plan de actividades programado (o especifica tu foco de mañana)..."
            className="w-full px-3.5 py-2.5 bg-slate-50/70 hover:bg-slate-100/60 focus:bg-white dark:bg-[#161722] dark:hover:bg-[#1A1C29] dark:focus:bg-[#161722] text-xs sm:text-sm text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-sky-600 dark:focus:border-[#00F0FF] focus:ring-2 focus:ring-sky-500/20 outline-hidden transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Row 2: Apoyo */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* ¿Requiere apoyo? (Modern Segmented Pills) */}
        <div className="md:col-span-4">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            ¿Requiere apoyo del equipo? <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 bg-slate-100/80 dark:bg-[#161722] p-1 rounded-xl border border-slate-200/80 dark:border-[#252636]">
            <button
              type="button"
              onClick={() => onChange('necesita_apoyo', 'No')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                necesitaApoyo === 'No'
                  ? 'bg-white dark:bg-[#1E2030] text-slate-800 dark:text-white shadow-xs border border-slate-200/60 dark:border-white/10'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              No, todo en orden
            </button>
            <button
              type="button"
              onClick={() => onChange('necesita_apoyo', 'Si')}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer text-center ${
                necesitaApoyo === 'Si'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
            >
              ⚠️ Sí, requiero apoyo
            </button>
          </div>
        </div>

        {/* Detalle del apoyo */}
        <div className="md:col-span-8">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Detalle del apoyo{' '}
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
                ? 'Especifica el bloqueo técnico o soporte que necesitas de tu líder...'
                : 'Sin bloqueos registrados para hoy'
            }
            disabled={necesitaApoyo === 'No'}
            className={`w-full px-3.5 py-2.5 text-xs sm:text-sm rounded-xl border transition-all outline-hidden ${
              necesitaApoyo === 'No'
                ? 'bg-slate-100/60 dark:bg-[#12131C] text-slate-400 dark:text-slate-600 border-slate-200 dark:border-[#252636]/60 cursor-not-allowed'
                : 'bg-slate-50/70 hover:bg-slate-100/60 focus:bg-white dark:bg-[#161722] dark:hover:bg-[#1A1C29] dark:focus:bg-[#161722] text-slate-800 dark:text-slate-100 border-amber-300 dark:border-amber-700 focus:ring-2 focus:ring-amber-500/20'
            }`}
          />
        </div>
      </div>

      {/* Action Area */}
      <div className="mt-5 pt-4 border-t border-slate-100 dark:border-[#252636]/60 flex items-center justify-end">
        {isProxyMode ? (
          <div className="flex items-center gap-2 p-2.5 px-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 text-amber-800 dark:text-amber-300 text-xs font-semibold shadow-xs">
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
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 hover:shadow-cyan-600/30 transition-all cursor-pointer min-h-[40px]"
          >
            {isSaving ? (
              <RefreshCw className="w-4 h-4 animate-spin text-white" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>{isSaving ? 'Guardando...' : 'Generar Bitácora'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
