import React, { useState, useEffect } from 'react';
import {
  X,
  StickyNote,
  CheckSquare,
  Square,
  ArrowRightCircle,
  Link2,
  Edit3,
  Plus,
  RefreshCw,
  Pin,
  Lock,
  Users,
  UserCheck,
} from 'lucide-react';
import {
  Nota,
  TipoNota,
  VisibilidadNota,
  ChecklistItemNota,
  Actividad,
} from '../../types';
import { api } from '../../services/api';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { RichHtmlRenderer } from '../RichHtmlRenderer';
import { formatDuration, stripHtml } from '../../utils/formatters';
import {
  ACCENT_COLORS,
  TIPOS_NOTA_CONFIG,
  VISIBILIDAD_LABELS,
  getChecklistProgress,
  parseChecklistLines,
  formatQuickNotaHtml,
} from './notaStyles';

interface NotaContextDrawerProps {
  isOpen: boolean;
  mode: 'quick-create' | 'inspect';
  notaId?: number | null;
  onClose: () => void;
  todayActividades?: Actividad[];
  onNotaCreatedOrUpdated?: (nota: Nota) => void;
  onEditFullNota: (nota: Nota) => void;
  onConvertToActividad: (nota: Nota, checklistItem?: ChecklistItemNota) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const NotaContextDrawer: React.FC<NotaContextDrawerProps> = ({
  isOpen,
  mode,
  notaId,
  onClose,
  todayActividades = [],
  onNotaCreatedOrUpdated,
  onEditFullNota,
  onConvertToActividad,
  onShowToast,
}) => {
  const [inspectNota, setInspectNota] = useState<Nota | null>(null);
  const [loading, setLoading] = useState(false);

  // Quick capture state
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [tipoNota, setTipoNota] = useState<TipoNota>('apunte');
  const [checklistText, setChecklistText] = useState('');
  const [paraCliente, setParaCliente] = useState('');
  const [visibilidad, setVisibilidad] = useState<VisibilidadNota>('personal');
  const [linkActId, setLinkActId] = useState<number | ''>('');
  const [savingQuick, setSavingQuick] = useState(false);

  useModalBehavior(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    if (mode === 'inspect' && notaId) {
      setLoading(true);
      api
        .getNotaById(notaId)
        .then((n) => setInspectNota(n))
        .catch((err) => {
          onShowToast?.(err?.message || 'No se pudo cargar la nota', 'error');
          onClose();
        })
        .finally(() => setLoading(false));
    } else if (mode === 'quick-create') {
      setTitulo('');
      setContenido('');
      setTipoNota('apunte');
      setChecklistText('');
      setParaCliente('');
      setVisibilidad('personal');
      setLinkActId('');
    }
  }, [isOpen, mode, notaId]);

  if (!isOpen) return null;

  const handleToggleChecklistItem = async (item: ChecklistItemNota) => {
    if (!inspectNota) return;
    try {
      const res = await api.updateNotaChecklist(inspectNota.id, {
        item_id: item.id,
        completado: !item.completado,
      });
      setInspectNota(res.nota);
      onNotaCreatedOrUpdated?.(res.nota);
    } catch (err: any) {
      onShowToast?.(err?.message || 'Error al actualizar checklist', 'error');
    }
  };

  const handleQuickSave = async (e: React.FormEvent, alsoConvert = false) => {
    e.preventDefault();
    if (!titulo.trim()) {
      onShowToast?.('Ingresa un título para la nota rápida', 'error');
      return;
    }

    const chkItems = tipoNota === 'checklist' ? parseChecklistLines(checklistText) : [];

    setSavingQuick(true);
    try {
      const res = await api.createNota({
        titulo: titulo.trim(),
        contenido: formatQuickNotaHtml(contenido),
        tipo_nota: tipoNota,
        checklist_json: chkItems,
        para_cliente: paraCliente.trim(),
        visibilidad,
        actividad_ids: linkActId ? [Number(linkActId)] : [],
      });
      onNotaCreatedOrUpdated?.(res.nota);
      onShowToast?.('Nota guardada al instante', 'success');
      onClose();
      if (alsoConvert) {
        onConvertToActividad(res.nota);
      }
    } catch (err: any) {
      onShowToast?.(err?.message || 'Error al guardar nota rápida', 'error');
    } finally {
      setSavingQuick(false);
    }
  };

  const persistedTodayActs = todayActividades.filter(
    (a) => !a.is_deleted && a.id !== undefined && /^\d+$/.test(String(a.id))
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 dark:bg-black/65 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-[#161922] h-full border-l border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-slate-50 dark:bg-[#1A1E29] border-b border-slate-200/80 dark:border-white/[0.08] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/70 dark:border-sky-500/25 shrink-0">
              <StickyNote className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                {mode === 'quick-create' ? 'Nota Rápida' : 'Contexto de Nota'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {mode === 'quick-create' ? 'Captura al vuelo (Alt+N)' : 'Vinculada a tu actividad'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center shrink-0"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {mode === 'quick-create' ? (
          <form onSubmit={(e) => handleQuickSave(e, false)} className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-1.5">
                {(['apunte', 'checklist'] as TipoNota[]).map((tn) => (
                  <button
                    key={tn}
                    type="button"
                    onClick={() => setTipoNota(tn)}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                      tipoNota === tn
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 dark:bg-[#1E222D] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {TIPOS_NOTA_CONFIG[tn].shortLabel}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Título *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Idea, requerimiento o recordatorio..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {tipoNota === 'checklist' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Puntos del checklist (uno por línea)
                  </label>
                  <textarea
                    rows={5}
                    value={checklistText}
                    onChange={(e) => setChecklistText(e.target.value)}
                    placeholder={'Revisar endpoint SUNAT\nValidar PDF en móvil\nDesplegar a QA'}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Detalle rápido
                  </label>
                  <textarea
                    rows={5}
                    value={contenido}
                    onChange={(e) => setContenido(e.target.value)}
                    placeholder="Contexto, enlaces, acuerdos..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Cliente / Área
                  </label>
                  <input
                    type="text"
                    value={paraCliente}
                    onChange={(e) => setParaCliente(e.target.value)}
                    placeholder="Opcional"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Visibilidad
                  </label>
                  <select
                    value={visibilidad}
                    onChange={(e) => setVisibilidad(e.target.value as VisibilidadNota)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="personal">Personal</option>
                    <option value="equipo">Equipo</option>
                  </select>
                </div>
              </div>

              {persistedTodayActs.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Vincular a actividad de hoy (opcional)
                  </label>
                  <select
                    value={linkActId}
                    onChange={(e) => setLinkActId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">Sin vincular por ahora</option>
                    {persistedTodayActs.map((a, idx) => (
                      <option key={String(a.id)} value={Number(a.id)}>
                        #{idx + 1} · {stripHtml(a.descripcion).slice(0, 55)}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1A1E29] flex items-center justify-between gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                disabled={savingQuick}
                onClick={(e) => handleQuickSave(e as any, true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 dark:bg-emerald-500/10 dark:hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-200 dark:border-emerald-500/25 text-xs font-semibold cursor-pointer transition-colors"
              >
                <ArrowRightCircle className="w-3.5 h-3.5" />
                <span>Guardar y convertir</span>
              </button>

              <button
                type="submit"
                disabled={savingQuick}
                className="ml-auto px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
              >
                {savingQuick ? 'Guardando...' : 'Guardar nota'}
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            {loading || !inspectNota ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                <span className="text-xs">Cargando contexto...</span>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                  <div
                    className={`p-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] border-l-4 ${
                      ACCENT_COLORS[inspectNota.color_acento || 'slate'].border
                    } space-y-2`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {inspectNota.titulo}
                      </h4>
                      {inspectNota.is_pinned && <Pin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#222735] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-medium">
                        {inspectNota.visibilidad === 'personal' ? (
                          <Lock className="w-3 h-3" />
                        ) : inspectNota.visibilidad === 'compartida' ? (
                          <UserCheck className="w-3 h-3" />
                        ) : (
                          <Users className="w-3 h-3" />
                        )}
                        {VISIBILIDAD_LABELS[inspectNota.visibilidad]?.label || 'Personal'}
                      </span>

                      {inspectNota.para_cliente && (
                        <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/25 font-medium">
                          {inspectNota.para_cliente}
                        </span>
                      )}

                      {inspectNota.etiquetas?.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 text-[10px]"
                        >
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {inspectNota.contenido && (
                    <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] overflow-x-hidden">
                      <RichHtmlRenderer content={inspectNota.contenido} />
                    </div>
                  )}

                  {inspectNota.checklist_json && inspectNota.checklist_json.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                        <span>Checklist</span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {getChecklistProgress(inspectNota.checklist_json).done}/
                          {getChecklistProgress(inspectNota.checklist_json).total}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {inspectNota.checklist_json.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/70 dark:border-white/[0.07] text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => handleToggleChecklistItem(item)}
                              className="flex items-start gap-2 text-left flex-1 cursor-pointer min-w-0"
                            >
                              {item.completado ? (
                                <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                              )}
                              <span
                                className={`break-words ${
                                  item.completado
                                    ? 'line-through text-slate-400'
                                    : 'text-slate-800 dark:text-slate-200'
                                }`}
                              >
                                {item.texto}
                              </span>
                            </button>

                            {item.actividad_id ? (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 shrink-0">
                                #{item.actividad_id}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  onClose();
                                  onConvertToActividad(inspectNota, item);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white dark:bg-[#222735] hover:bg-sky-600 text-sky-600 dark:text-sky-400 hover:text-white border border-slate-200 dark:border-white/10 text-[10px] font-semibold cursor-pointer shrink-0 transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                <span>Act</span>
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {inspectNota.actividades_vinculadas && inspectNota.actividades_vinculadas.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Link2 className="w-3.5 h-3.5 text-sky-500" />
                        <span>Actividades vinculadas ({inspectNota.actividades_vinculadas.length})</span>
                      </span>
                      <div className="space-y-1.5">
                        {inspectNota.actividades_vinculadas.map((act) => (
                          <div
                            key={act.id}
                            className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/70 dark:border-white/[0.07] text-xs"
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">
                                #{act.id} · {act.fecha}
                              </span>
                              <span>
                                {act.estado.replace('_', ' ')}
                                {act.duracion_min > 0 ? ` · ${formatDuration(act.duracion_min)}` : ''}
                              </span>
                            </div>
                            <p className="text-slate-800 dark:text-slate-200 font-medium mt-0.5 line-clamp-2">
                              {act.descripcion_plana || stripHtml(act.descripcion)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-slate-200/80 dark:border-white/[0.08] bg-slate-50 dark:bg-[#1A1E29] flex items-center justify-between gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onConvertToActividad(inspectNota);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 dark:bg-emerald-500/10 dark:hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-200 dark:border-emerald-500/25 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    <ArrowRightCircle className="w-3.5 h-3.5" />
                    <span>Convertir en actividad</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditFullNota(inspectNota);
                    }}
                    className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar completo</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
