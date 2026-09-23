import React, { useState } from 'react';
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
} from 'lucide-react';
import { Actividad, EstadoActividad, Evidencia } from '../types';
import { formatDuration, getTimeInStatusInfo } from '../utils/formatters';
import { EvidenceViewerModal } from './EvidenceViewerModal';

interface ActividadDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  actividad: Actividad | null;
  index: number | null;
  onEdit: (actividad: Actividad, index: number) => void;
  onUpdateEstado?: (index: number, nuevoEstado: EstadoActividad) => void;
}

export const ActividadDetalleModal: React.FC<ActividadDetalleModalProps> = ({
  isOpen,
  onClose,
  actividad,
  index,
  onEdit,
  onUpdateEstado,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  if (!isOpen || !actividad) return null;

  const handleCopyDescription = () => {
    navigator.clipboard.writeText(actividad.descripcion);
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
          bg: 'bg-[#E6F9F5] text-[#00A88B] border-[#00C9A7]/30',
          label: 'Completada',
          icon: CheckCircle2,
        };
      case 'en_proceso':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          label: 'En proceso',
          icon: Timer,
        };
      case 'en_revision':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          label: 'En revisión',
          icon: Eye,
        };
      case 'pendiente':
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
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

  const sharedNames = actividad.shared_with_names || [];
  const hasShared = (actividad.shared_with && actividad.shared_with.length > 0) || sharedNames.length > 0;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl bg-white dark:bg-[#13141F] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-[#252636] overflow-hidden my-8 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-[#161722] border-b border-slate-100 dark:border-[#252636] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-50 dark:bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Detalle de Actividad {index !== null ? `#${index + 1}` : ''}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${statusConfig.bg}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span>{statusConfig.label}</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Visualización completa de descripción, tiempos invertidos, asignación y evidencias.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#161722] rounded-full transition-colors cursor-pointer"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-[#161722] rounded-2xl border border-slate-200/80 dark:border-[#252636]">
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Hora Inicio
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                  <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                  <span>{actividad.hora_inicio || '--:--'}</span>
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Duración
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-extrabold text-xs sm:text-sm text-[#00A88B] dark:text-[#00C9A7]">
                  <Timer className="w-3.5 h-3.5 text-[#00C9A7]" />
                  <span>{actividad.duracion_min} min</span>
                  {actividad.duracion_min > 0 && (
                    <span className="text-[10px] text-[#00A88B] dark:text-[#00C9A7] font-semibold lowercase">
                      ({formatDuration(actividad.duracion_min)})
                    </span>
                  )}
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Tipo de Trabajo
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                  <Briefcase className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span className="truncate">{actividad.tipo_trabajo || 'Sin clasificar'}</span>
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Para / Cliente
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span className="truncate">{actividad.para_cliente || 'Interno'}</span>
                </div>
              </div>
            </div>

            {/* Badges de soporte (Continuada / Acumulada / Tiempo en estado / Compartida) */}
            <div className="flex flex-wrap items-center gap-2">
              {hasShared && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-full text-xs font-bold text-indigo-800 dark:text-indigo-300">
                  <Users className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>
                    Trabajo en Paralelo con:{' '}
                    {sharedNames.length > 0
                      ? sharedNames.join(', ')
                      : `${actividad.shared_with?.length} compañero(s)`}
                  </span>
                </div>
              )}

              {(actividad.parent_task_id || actividad.is_rollover) && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-pink-700 dark:text-pink-300 bg-pink-50 dark:bg-[#EC4899]/15 border border-pink-200 dark:border-[#EC4899]/30 px-3 py-1 rounded-full">
                  <RefreshCw className="w-3.5 h-3.5 text-[#EC4899]" />
                  <span>Continuada de jornada previa</span>
                </span>
              )}

              {hasAccumulated && (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00A3BF] dark:text-[#00F0FF] bg-cyan-50 dark:bg-[#00F0FF]/15 border border-[#00F0FF]/30 px-3 py-1 rounded-full">
                  <Timer className="w-3.5 h-3.5 text-[#00F0FF]" />
                  <span>{actividad.tiempo_acumulado_min} min acumulados</span>
                </span>
              )}

              {timeInfo.label && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full border ${
                    timeInfo.isStalled
                      ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60'
                      : 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#161722] border-slate-200 dark:border-[#252636]'
                  }`}
                >
                  {timeInfo.isStalled ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                  ) : (
                    <History className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>{timeInfo.label}</span>
                </span>
              )}
            </div>

            {/* Full Description Box */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Descripción Detallada de la Actividad
                </label>
                <button
                  type="button"
                  onClick={handleCopyDescription}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-[#00F0FF] dark:hover:text-[#00F0FF] hover:bg-slate-100 dark:hover:bg-[#161722] px-3 py-1 rounded-full transition-colors cursor-pointer"
                  title="Copiar descripción al portapapeles"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#00F0FF]" />
                      <span className="text-[#00A3BF] dark:text-[#00F0FF] font-bold">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copiar texto</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 bg-slate-50/80 dark:bg-[#161722] rounded-2xl border border-slate-200 dark:border-[#252636] leading-relaxed text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium">
                {actividad.descripcion || (
                  <span className="text-slate-400 dark:text-slate-500 italic">No se registró descripción para esta tarea.</span>
                )}
              </div>
            </div>

            {/* Attached Evidences */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Paperclip className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Evidencias Adjuntas ({actividad.evidencias?.length || 0})
                </label>
              </div>

              {!actividad.evidencias || actividad.evidencias.length === 0 ? (
                <div className="p-4 bg-slate-50/60 dark:bg-slate-900/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 text-center">
                  No hay archivos o capturas adjuntas en esta actividad.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {actividad.evidencias.map((ev, evIdx) => (
                    <button
                      key={ev.id || evIdx}
                      type="button"
                      onClick={() => handleOpenEvidence(evIdx)}
                      className="flex items-center justify-between p-3 bg-white dark:bg-[#161722] hover:bg-slate-50 dark:hover:bg-[#1C1D2A] border border-slate-200 dark:border-[#252636] hover:border-[#00F0FF]/40 rounded-2xl transition-all cursor-pointer group text-left shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-cyan-50 dark:bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center shrink-0 border border-[#00F0FF]/30">
                          <Paperclip className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-[#00F0FF]">
                            {ev.nombre}
                          </p>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            Hacer clic para visualizar
                          </span>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[#00F0FF] shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-[#161722] border-t border-slate-100 dark:border-[#252636] shrink-0">
            {/* Quick status selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                Cambiar estado:
              </span>
              <select
                value={actividad.estado}
                onChange={(e) => {
                  if (onUpdateEstado && index !== null) {
                    onUpdateEstado(index, e.target.value as EstadoActividad);
                  }
                }}
                className={`text-xs font-bold rounded-full border px-3 py-1.5 cursor-pointer outline-none ${statusConfig.bg}`}
              >
                <option value="completada" className="bg-white dark:bg-[#161722]">Completada</option>
                <option value="en_proceso" className="bg-white dark:bg-[#161722]">En proceso</option>
                <option value="en_revision" className="bg-white dark:bg-[#161722]">En revisión</option>
                <option value="pendiente" className="bg-white dark:bg-[#161722]">Por iniciar</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (index !== null) {
                    onEdit(actividad, index);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 rounded-full shadow-sm transition-all cursor-pointer min-h-[40px]"
              >
                <Edit3 className="w-4 h-4" />
                <span>Editar Actividad</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#1A1C29] rounded-full transition-colors cursor-pointer min-h-[40px]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lightbox for Evidences */}
      <EvidenceViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        evidencias={actividad.evidencias || []}
        initialIndex={viewerIndex}
      />
    </>
  );
};
