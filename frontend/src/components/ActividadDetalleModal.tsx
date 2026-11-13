import React, { useState, useMemo } from 'react';
import {
  X,
  Clock,
  Timer,
  Briefcase,
  UserCheck,
  CheckCircle2,
  Eye,
  ListTodo,
  Users,
  Paperclip,
  ExternalLink,
  Edit3,
  Copy,
  Check,
  RefreshCw,
  History,
  AlertTriangle,
  FileText,
  Link2,
  MessageSquare,
} from 'lucide-react';
import { Actividad, EstadoActividad, Evidencia } from '../types';
import { formatDuration, getTimeInStatusInfo, stripHtml, calculateHoraFin, copyToClipboard } from '../utils/formatters';
import { EvidenceViewerModal } from './EvidenceViewerModal';
import { RichHtmlRenderer } from './RichHtmlRenderer';
import { useModalBehavior } from '../hooks/useModalBehavior';

interface ActividadDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  actividad: Actividad | null;
  index: number | null;
  onEdit: (actividad: Actividad, index: number) => void;
  onUpdateEstado?: (index: number, nuevoEstado: EstadoActividad) => void;
  onNavigateToRef?: (targetRefId: number | string, tipoVinculo?: string) => void;
  fecha?: string;
}

export const ActividadDetalleModal: React.FC<ActividadDetalleModalProps> = ({
  isOpen,
  onClose,
  actividad,
  index,
  onEdit,
  onUpdateEstado,
  onNavigateToRef,
  fecha,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  useModalBehavior(isOpen && Boolean(actividad), onClose);

  // Filtrar evidencias adjuntas para evitar mostrar dos veces imágenes/archivos que ya están embebidos en la descripción
  const displayEvidencias = useMemo(() => {
    if (!actividad || !actividad.evidencias) return [];
    const desc = actividad.descripcion || '';
    return actividad.evidencias.filter((ev, index, self) => {
      if (!ev || !ev.url) return false;
      const isFirst = self.findIndex((o) => (o.id && o.id === ev.id) || o.url === ev.url) === index;
      if (!isFirst) return false;

      const url = ev.url.trim();
      const filename = url.split('/').pop()?.split('?')[0] || '';
      if (url && desc.includes(url)) return false;
      if (filename && desc.includes(filename)) return false;

      // Descartar captura/image.png duplicada con el mismo prefijo de timestamp (YYYYMMDD_HHMMSS)
      const tsMatch = filename.match(/^(\d{8}_\d{6})/);
      if (tsMatch && desc.includes(tsMatch[1])) return false;

      return true;
    });
  }, [actividad?.evidencias, actividad?.descripcion]);

  if (!isOpen || !actividad) return null;

  const handleCopyDescription = async () => {
    const text = stripHtml(actividad.descripcion);
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEvidence = (idx: number) => {
    setViewerIndex(idx);
    setViewerOpen(true);
  };

  const getStatusBadge = (estado: EstadoActividad) => {
    switch (estado) {
      case 'completada':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
          label: 'Completada',
          icon: CheckCircle2,
        };
      case 'en_proceso':
        return {
          bg: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/25',
          label: 'En proceso',
          icon: Timer,
        };
      case 'en_revision':
        return {
          bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
          label: 'En revisión',
          icon: Eye,
        };
      case 'pendiente':
      default:
        return {
          bg: 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10',
          label: 'Por iniciar',
          icon: ListTodo,
        };
    }
  };

  const statusConfig = getStatusBadge(actividad.estado);
  const StatusIcon = statusConfig.icon;
  const timeInfo = getTimeInStatusInfo(actividad.updated_at, actividad.created_at, actividad.estado);
  const hasAccumulated =
    Boolean(actividad.tiempo_acumulado_min && actividad.tiempo_acumulado_min > (actividad.duracion_min || 0));
  const discountedMin = Number(actividad.minutos_descontados) || 0;
  const grossMin = Number(actividad.duracion_bruta_min) || Number(actividad.duracion_min) || 0;

  const sharedNames = actividad.shared_with_names || [];
  const hasShared = (actividad.shared_with && actividad.shared_with.length > 0) || sharedNames.length > 0;

  const cleanParentDesc = actividad.parent_task_desc
    ? stripHtml(actividad.parent_task_desc).trim()
    : '';

  return (
    <>
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto overflow-x-hidden"
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl bg-white dark:bg-[#161922] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-white/10 overflow-hidden max-h-[calc(100dvh-1rem)] sm:max-h-[92dvh] my-auto flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-50/70 dark:bg-[#1A1E29] border-b border-slate-200/80 dark:border-white/[0.07] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  Actividad {index !== null ? `#${index + 1}` : ''}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-md border ${statusConfig.bg}`}
                >
                  <StatusIcon className="w-3.5 h-3.5" />
                  <span>{statusConfig.label}</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center justify-center"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 w-full flex-1 text-slate-800 dark:text-slate-200">
            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 p-3.5 bg-slate-50/80 dark:bg-[#1A1E29] rounded-xl border border-slate-200/80 dark:border-white/[0.07]">
              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Inicio
                </span>
                <div className="mt-1 font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 tabular-nums">
                  {actividad.hora_inicio || '—'}
                </div>
              </div>

              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Fin
                </span>
                <div className="mt-1 font-semibold text-xs sm:text-sm text-slate-800 dark:text-slate-100 tabular-nums">
                  {actividad.hora_inicio
                    ? actividad.hora_fin || calculateHoraFin(actividad.hora_inicio, actividad.duracion_min, fecha) || '—'
                    : '—'}
                </div>
              </div>

              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Tiempo Neto
                </span>
                <div className="mt-1 font-bold text-xs sm:text-sm text-sky-700 dark:text-sky-400 tabular-nums">
                  {formatDuration(actividad.duracion_min || 0)}
                </div>
              </div>

              <div className="min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Tipo
                </span>
                <div
                  className="mt-1 font-medium text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate"
                  title={actividad.tipo_trabajo || undefined}
                >
                  {actividad.tipo_trabajo || '—'}
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1 min-w-0">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Cliente / Área
                </span>
                <div
                  className="mt-1 font-medium text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate"
                  title={actividad.para_cliente || undefined}
                >
                  {actividad.para_cliente || '—'}
                </div>
              </div>
            </div>

            {discountedMin > 0 && (
              <div className="p-3 rounded-xl bg-sky-50/80 dark:bg-sky-500/10 border border-sky-200/80 dark:border-sky-500/20 text-xs text-sky-900 dark:text-sky-200">
                Ventana total registrada: <strong>{formatDuration(grossMin)}</strong> · Se descontaron automáticamente{' '}
                <strong>{formatDuration(discountedMin)}</strong> ocupados por actividades internas realizadas dentro de este horario.
              </div>
            )}

            {/* Supporting Metadata */}
            {(hasShared ||
              actividad.created_by_name ||
              actividad.parent_task_id ||
              hasAccumulated ||
              timeInfo.isStalled) && (
              <div className="flex flex-wrap items-center gap-2">
                {hasShared && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 rounded-md text-xs text-slate-700 dark:text-slate-300">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Compartida con:{' '}
                      {sharedNames.length > 0
                        ? sharedNames.join(', ')
                        : `${actividad.shared_with?.length} compañero(s)`}
                    </span>
                  </span>
                )}

                {actividad.created_by_name && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-xs text-slate-700 dark:text-slate-300">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                    <span>Registrada por: {actividad.created_by_name}</span>
                  </span>
                )}

                {hasAccumulated && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 px-2.5 py-1 rounded-md">
                    <Timer className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDuration(actividad.tiempo_acumulado_min || 0)} acumulados</span>
                  </span>
                )}

                {timeInfo.isStalled && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md border text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/25">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>{timeInfo.label}</span>
                  </span>
                )}

                {actividad.parent_task_id && (
                  <div className="w-full min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] overflow-hidden">
                    <div className="flex items-start gap-2 min-w-0 flex-1 overflow-hidden">
                      <Link2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1 overflow-hidden text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {actividad.tipo_vinculo === 'subtarea'
                            ? 'Subtarea de'
                            : actividad.tipo_vinculo === 'bloqueado_por'
                            ? 'Bloqueada por'
                            : actividad.tipo_vinculo === 'relacionada'
                            ? 'Relacionada con'
                            : 'Continuación de'}
                          :
                        </span>
                        <p
                          className="text-slate-600 dark:text-slate-400 line-clamp-2 break-words [overflow-wrap:anywhere] mt-0.5 leading-snug"
                          title={cleanParentDesc || undefined}
                        >
                          {cleanParentDesc || `Actividad previa #${actividad.parent_task_id}`}
                        </p>
                      </div>
                    </div>
                    {onNavigateToRef && (
                      <button
                        type="button"
                        onClick={() => onNavigateToRef(actividad.parent_task_id!, actividad.tipo_vinculo)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#222735] hover:bg-slate-100 dark:hover:bg-white/10 text-sky-600 dark:text-sky-400 border border-slate-200 dark:border-white/10 text-xs font-semibold transition-colors shrink-0 cursor-pointer self-start sm:self-center"
                      >
                        <span>Ver origen</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Full Description Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Descripción
                </label>
                <button
                  type="button"
                  onClick={handleCopyDescription}
                  className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                  title="Copiar descripción al portapapeles"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 bg-slate-50/70 dark:bg-[#1A1E29] rounded-xl border border-slate-200/80 dark:border-white/[0.07] leading-relaxed text-sm text-slate-800 dark:text-slate-200 min-w-0 max-w-full overflow-x-hidden break-words [overflow-wrap:anywhere]">
                {actividad.descripcion ? (
                  <RichHtmlRenderer content={actividad.descripcion} />
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 italic">Sin descripción registrada.</span>
                )}
              </div>
            </div>

            {/* Comentarios u Observaciones */}
            {actividad.comentarios && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Comentarios
                  </label>
                </div>
                <div className="p-3 bg-slate-50/70 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.07] rounded-xl text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed min-w-0 max-w-full overflow-x-hidden break-words [overflow-wrap:anywhere]">
                  {actividad.comentarios}
                </div>
              </div>
            )}

            {/* Attached Evidences */}
            {displayEvidencias.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Evidencias adjuntas ({displayEvidencias.length})
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {displayEvidencias.map((ev, evIdx) => (
                    <button
                      key={ev.id || evIdx}
                      type="button"
                      onClick={() => handleOpenEvidence(evIdx)}
                      className="flex items-center justify-between p-2.5 bg-white dark:bg-[#1A1E29] hover:bg-slate-50 dark:hover:bg-[#222735] border border-slate-200/80 dark:border-white/[0.08] rounded-xl transition-colors cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0">
                          <Paperclip className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {ev.nombre}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                            Ver archivo
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-50/80 dark:bg-[#1A1E29] border-t border-slate-200/80 dark:border-white/[0.07] shrink-0 gap-2.5 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden sm:inline">
                Estado:
              </span>
              <select
                value={actividad.estado}
                onChange={(e) => {
                  if (onUpdateEstado && index !== null) {
                    onUpdateEstado(index, e.target.value as EstadoActividad);
                  }
                }}
                className={`text-xs font-semibold rounded-lg border px-2.5 py-1.5 cursor-pointer outline-none ${statusConfig.bg}`}
              >
                <option value="completada" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">Completada</option>
                <option value="en_proceso" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">En proceso</option>
                <option value="en_revision" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">En revisión</option>
                <option value="pendiente" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">Por iniciar</option>
              </select>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer min-h-[36px]"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (index !== null) {
                    onEdit(actividad, index);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer min-h-[36px]"
              >
                <Edit3 className="w-3.5 h-3.5 shrink-0" />
                <span>Editar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for Evidences */}
      <EvidenceViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        evidencias={displayEvidencias}
        initialIndex={viewerIndex}
      />
    </>
  );
};
