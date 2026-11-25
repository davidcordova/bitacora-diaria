import React, { useMemo, useState, useEffect } from 'react';
import { CheckSquare, Sparkles, Play, RefreshCw, UserCheck, ChevronDown } from 'lucide-react';
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
  collapsible?: boolean;
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
  collapsible = true,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(!collapsible || necesitaApoyo === 'Si');

  useEffect(() => {
    if (!collapsible || necesitaApoyo === 'Si') {
      setIsExpanded(true);
    }
  }, [collapsible, necesitaApoyo]);

  const openTasks = useMemo(
    () =>
      (actividades || []).filter(
        (a) => !a.is_deleted && a.estado !== 'completada' && (a.descripcion || '').trim().length > 0
      ),
    [actividades]
  );

  const hasNotes = Boolean(pendientes.trim() || prioridadSiguiente.trim() || necesitaApoyo === 'Si');

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
    <div className="bg-white dark:bg-[#12151D] rounded-xl border border-slate-200/75 dark:border-white/[0.07] overflow-hidden transition-all">
      {/* Compact Header Bar (Always visible; toggles expansion when collapsible) */}
      <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => collapsible && setIsExpanded((prev) => !prev)}
          className={`flex items-center gap-2.5 text-left min-w-0 flex-1 ${
            collapsible ? 'cursor-pointer group' : 'cursor-default'
          }`}
        >
          <CheckSquare className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
                Cierre de jornada
              </h2>
              {hasNotes && !isExpanded && (
                <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">
                  · Con notas
                </span>
              )}
              {!hasNotes && !isExpanded && (
                <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                  {openTasks.length > 0
                    ? `· ${openTasks.length} en curso · Opcional`
                    : '· Pendientes y prioridad para mañana'}
                </span>
              )}
            </div>
          </div>
          {collapsible && (
            <ChevronDown
              className={`w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform duration-150 shrink-0 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          )}
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {isExpanded && openTasks.length > 0 && (
            <button
              type="button"
              onClick={handleAutoFillFromOpenTasks}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
              title="Rellenar pendientes y prioridad automáticamente con las actividades en curso"
            >
              <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span className="hidden sm:inline">Autocompletar ({openTasks.length})</span>
              <span className="sm:hidden">Auto ({openTasks.length})</span>
            </button>
          )}

          {!isExpanded && !isProxyMode && (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-60 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[34px]"
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>{isSaving ? 'Guardando...' : 'Generar bitácora'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Form Content */}
      {isExpanded && (
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 border-t border-slate-100 dark:border-white/[0.06] space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Pendientes <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
              </label>
              <textarea
                rows={2}
                value={pendientes}
                onChange={(e) => onChange('pendientes', e.target.value)}
                placeholder="Temas que continuarán en otra fecha..."
                className="w-full px-3 py-2 bg-slate-50/70 dark:bg-[#191D28] focus:bg-white dark:focus:bg-[#191D28] text-[13px] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200/80 dark:border-white/[0.08] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 outline-hidden transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Prioridad siguiente <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
              </label>
              <textarea
                rows={2}
                value={prioridadSiguiente}
                onChange={(e) => onChange('prioridad_siguiente', e.target.value)}
                placeholder="Foco principal para mañana..."
                className="w-full px-3 py-2 bg-slate-50/70 dark:bg-[#191D28] focus:bg-white dark:focus:bg-[#191D28] text-[13px] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200/80 dark:border-white/[0.08] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 outline-hidden transition-all resize-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                ¿Requiere apoyo?
              </label>
              <div className="grid grid-cols-2 gap-1 bg-slate-100/90 dark:bg-[#191D28] p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => onChange('necesita_apoyo', 'No')}
                  className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors cursor-pointer text-center ${
                    necesitaApoyo === 'No'
                      ? 'bg-white dark:bg-[#252B3B] text-slate-900 dark:text-white shadow-2xs font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => onChange('necesita_apoyo', 'Si')}
                  className={`py-1.5 px-2.5 text-xs font-medium rounded-md transition-colors cursor-pointer text-center ${
                    necesitaApoyo === 'Si'
                      ? 'bg-amber-500 text-white shadow-2xs font-semibold'
                      : 'text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                >
                  Sí, requiero apoyo
                </button>
              </div>
            </div>

            <div className="md:col-span-8">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Detalle del apoyo{' '}
                {necesitaApoyo === 'Si' ? (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">(requerido)</span>
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
                className={`w-full px-3 py-2 text-[13px] rounded-lg border transition-all outline-hidden ${
                  necesitaApoyo === 'No'
                    ? 'bg-slate-50/50 dark:bg-[#141720] text-slate-400 dark:text-slate-600 border-slate-200/60 dark:border-white/[0.05] cursor-not-allowed'
                    : 'bg-white dark:bg-[#191D28] text-slate-800 dark:text-slate-100 border-amber-300 dark:border-amber-500/40 focus:ring-2 focus:ring-amber-500/15'
                }`}
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-end">
            {isProxyMode ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-medium">
                <UserCheck className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  El cierre formal corresponde al titular ({proxyUserName || 'colaborador'}).
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
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
      )}
    </div>
  );
};
