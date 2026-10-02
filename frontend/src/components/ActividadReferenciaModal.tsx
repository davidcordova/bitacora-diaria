import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Timer,
  Briefcase,
  UserCheck,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Link2,
  GitBranch,
  RefreshCw,
  Paperclip,
  MessageSquare,
  Loader2,
  AlertCircle,
  Eye,
  ListTodo,
} from 'lucide-react';
import { Actividad, EstadoActividad } from '../types';
import { formatDuration } from '../utils/formatters';
import { RichHtmlRenderer } from './RichHtmlRenderer';
import { api } from '../services/api';

interface ActividadReferenciaModalProps {
  isOpen: boolean;
  onClose: () => void;
  refId: number | string | null;
  tipoVinculo?: string;
  onNavigateToDate?: (targetDate: string, targetActId: number | string) => void;
}

export const ActividadReferenciaModal: React.FC<ActividadReferenciaModalProps> = ({
  isOpen,
  onClose,
  refId,
  tipoVinculo = 'continuacion',
  onNavigateToDate,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refActividad, setRefActividad] = useState<(Actividad & { bitacora_fecha?: string; colaborador?: string }) | null>(null);

  useEffect(() => {
    if (isOpen && refId) {
      let isMounted = true;
      setLoading(true);
      setError(null);
      setRefActividad(null);

      api.getActividadById(Number(refId))
        .then((data) => {
          if (isMounted) {
            setRefActividad(data);
            setLoading(false);
          }
        })
        .catch((err) => {
          if (isMounted) {
            console.error('Error fetching referenced activity:', err);
            setError(`No se pudo cargar la información de la actividad #${refId}. Puede haber sido eliminada o no tienes permisos.`);
            setLoading(false);
          }
        });

      return () => {
        isMounted = false;
      };
    }
  }, [isOpen, refId]);

  if (!isOpen || !refId) return null;

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return 'Fecha no especificada';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return `${days[d.getDay()]}, ${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
      }
    } catch (e) {}
    return dateStr;
  };

  const getVinculoLabel = (tipo?: string) => {
    switch (tipo) {
      case 'subtarea':
        return { label: 'Subtarea dependiente', badge: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/50' };
      case 'bloqueado_por':
        return { label: 'Bloqueada por', badge: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50' };
      case 'relacionada':
        return { label: 'Relacionada con', badge: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-[#00F0FF] border-cyan-200 dark:border-[#00F0FF]/30' };
      case 'continuacion':
      default:
        return { label: 'Continuación de', badge: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/50' };
    }
  };

  const getStatusBadge = (estado?: EstadoActividad) => {
    switch (estado) {
      case 'completada':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60',
          label: 'Completada',
          icon: CheckCircle2,
        };
      case 'en_proceso':
        return {
          bg: 'bg-cyan-50 dark:bg-[#00F0FF]/15 text-cyan-800 dark:text-[#00F0FF] border-cyan-200 dark:border-[#00F0FF]/40',
          label: 'En proceso',
          icon: Timer,
        };
      case 'en_revision':
        return {
          bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200/80 dark:border-purple-800/60',
          label: 'En revisión',
          icon: Eye,
        };
      case 'pendiente':
      default:
        return {
          bg: 'bg-slate-100 dark:bg-[#1A1C29] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#252636]',
          label: 'Por iniciar',
          icon: ListTodo,
        };
    }
  };

  const vinculoInfo = getVinculoLabel(tipoVinculo);
  const statusInfo = getStatusBadge(refActividad?.estado);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#13141F] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-[#252636] overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 bg-slate-50/90 dark:bg-[#161722]/90 border-b border-slate-100 dark:border-[#252636] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-100/70 dark:bg-[#00F0FF]/15 text-cyan-800 dark:text-[#00F0FF] border border-cyan-300/60 dark:border-[#00F0FF]/30">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                  Actividad Referenciada #{refId}
                </h3>
                <span className={`inline-flex items-center text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${vinculoInfo.badge}`}>
                  {vinculoInfo.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Inspección de la tarea origen vinculada
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C1D2A] rounded-full transition-colors cursor-pointer"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-600 dark:text-[#00F0FF]" />
              <p className="text-xs font-medium">Buscando actividad referenciada #{refId}...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
              <div>
                <strong className="block font-semibold mb-0.5">No se pudo cargar la referencia</strong>
                <p>{error}</p>
              </div>
            </div>
          ) : refActividad ? (
            <>
              {/* Origin Bitacora Info Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#161722] border border-slate-200/90 dark:border-[#252636] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                      Bitácora de origen
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      {formatDateDisplay(refActividad.bitacora_fecha)}
                    </span>
                    {refActividad.colaborador && (
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Por: <strong className="text-slate-700 dark:text-slate-300">{refActividad.colaborador}</strong>
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border ${statusInfo.bg}`}>
                    <StatusIcon className="w-3.5 h-3.5" />
                    <span>{statusInfo.label}</span>
                  </span>
                </div>
              </div>

              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50/70 dark:bg-[#161722]/60 rounded-2xl border border-slate-200/80 dark:border-[#252636]">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                    Hora / Tiempo
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{refActividad.hora_inicio || '--:--'}</span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="text-cyan-800 dark:text-[#00F0FF] font-extrabold">{refActividad.duracion_min}m</span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                    Tipo de Trabajo
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{refActividad.tipo_trabajo || 'General'}</span>
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500">
                    Para / Cliente
                  </span>
                  <div className="flex items-center gap-1 mt-0.5 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{refActividad.para_cliente || 'Interno'}</span>
                  </div>
                </div>
              </div>

              {/* Description Content */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Descripción de la tarea referenciada:
                </label>
                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#13141F] border border-slate-200/90 dark:border-[#252636] max-h-48 overflow-y-auto">
                  <RichHtmlRenderer
                    content={refActividad.descripcion}
                    className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed"
                  />
                </div>
              </div>

              {/* Comentarios si tiene */}
              {refActividad.comentarios && (
                <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Notas u Observaciones previas:</span>
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 italic">{refActividad.comentarios}</p>
                </div>
              )}

              {/* Evidencias si tiene */}
              {refActividad.evidencias && refActividad.evidencias.length > 0 && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#161722] border border-slate-200 dark:border-[#252636] flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Paperclip className="w-4 h-4 text-cyan-600 dark:text-[#00F0FF]" />
                  <span>Esta actividad cuenta con <strong>{refActividad.evidencias.length}</strong> archivo(s) o evidencia(s) adjunta(s).</span>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 bg-slate-50/90 dark:bg-[#161722]/90 border-t border-slate-100 dark:border-[#252636] shrink-0 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            Cerrar
          </button>

          {refActividad?.bitacora_fecha && onNavigateToDate && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToDate(refActividad.bitacora_fecha!, refActividad.id!);
              }}
              className="btn-pill-primary px-5 py-2 text-xs font-bold shadow-md inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Abrir Bitácora de {refActividad.bitacora_fecha}</span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
