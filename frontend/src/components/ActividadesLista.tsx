import React, { useState } from 'react';
import {
  ListChecks,
  Plus,
  Trash2,
  Clock,
  Briefcase,
  UserCheck,
  CheckCircle2,
  Timer,
  Eye,
  ListTodo,
  RefreshCw,
  Users,
  Paperclip,
  Edit3,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { Actividad, EstadoActividad, User, Evidencia } from '../types';
import { formatDuration } from '../utils/formatters';
import { ActividadModal } from './ActividadModal';
import { ActividadDetalleModal } from './ActividadDetalleModal';

interface ActividadesListaProps {
  actividades: Actividad[];
  onAddActividad: (actividad?: Actividad) => void;
  onUpdateActividad: (index: number, field: keyof Actividad, value: any) => void;
  onUpdateActividadDetalle?: (index: number, updatedData: Partial<Actividad>) => void;
  onUpdateEstado?: (index: number, nuevoEstado: EstadoActividad) => void;
  onRemoveActividad: (index: number) => void;
  users?: User[];
  currentUser?: User | null;
  fecha?: string;
  onDateChange?: (date: string) => void;
  horaInicio?: string;
  onHoraInicioChange?: (time: string) => void;
}

export const ActividadesLista: React.FC<ActividadesListaProps> = ({
  actividades,
  onAddActividad,
  onUpdateActividad,
  onUpdateActividadDetalle,
  onUpdateEstado,
  onRemoveActividad,
  users = [],
  currentUser = null,
  fecha,
  onDateChange,
  horaInicio = '08:30',
  onHoraInicioChange,
}) => {
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingActividad, setEditingActividad] = useState<Actividad | null>(null);

  // Detail inspection modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailActividad, setSelectedDetailActividad] = useState<Actividad | null>(null);
  const [selectedDetailIndex, setSelectedDetailIndex] = useState<number | null>(null);

  const totalMinutos = actividades.reduce(
    (sum, act) => sum + (Number(act.duracion_min) || 0),
    0
  );

  // Date manipulation helpers for inline executive navigator
  const formatHeaderDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const dayName = days[d.getDay()];
        const monthName = months[d.getMonth()];
        return `${dayName}, ${d.getDate()} ${monthName} ${d.getFullYear()}`;
      }
    } catch (e) {}
    return dateStr;
  };

  const isToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return dateStr === `${yyyy}-${mm}-${dd}`;
  };

  const changeDayByOffset = (offset: number) => {
    if (!fecha || !onDateChange) return;
    try {
      const parts = fecha.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        d.setDate(d.getDate() + offset);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        onDateChange(`${yyyy}-${mm}-${dd}`);
      }
    } catch (e) {}
  };

  const goToToday = () => {
    if (!onDateChange) return;
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    onDateChange(`${yyyy}-${mm}-${dd}`);
  };

  const handleOpenCreateModal = () => {
    setEditingIndex(null);
    setEditingActividad(null);
    setCreateModalOpen(true);
  };

  const handleOpenEditModal = (act: Actividad, index: number) => {
    setEditingIndex(index);
    setEditingActividad(act);
    setCreateModalOpen(true);
  };

  const handleOpenDetailModal = (act: Actividad, index: number) => {
    setSelectedDetailActividad(act);
    setSelectedDetailIndex(index);
    setDetailModalOpen(true);
  };

  const handleSaveModal = (savedAct: Actividad, editIdx: number | null) => {
    if (editIdx !== null) {
      if (onUpdateActividadDetalle) {
        onUpdateActividadDetalle(editIdx, savedAct);
      } else {
        Object.entries(savedAct).forEach(([key, val]) => {
          onUpdateActividad(editIdx, key as keyof Actividad, val);
        });
      }
    } else {
      onAddActividad(savedAct);
    }
  };

  // Helper for status badge style
  const getStatusBadge = (estado: EstadoActividad) => {
    switch (estado) {
      case 'completada':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/60',
          dot: 'bg-emerald-500',
          label: 'Completada',
          icon: CheckCircle2,
        };
      case 'en_proceso':
        return {
          bg: 'bg-[#00F0FF]/10 dark:bg-[#00F0FF]/15 text-[#0090A0] dark:text-[#00F0FF] border-[#00F0FF]/30 dark:border-[#00F0FF]/40',
          dot: 'bg-[#00F0FF]',
          label: 'En proceso',
          icon: Timer,
        };
      case 'en_revision':
        return {
          bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200/80 dark:border-purple-800/60',
          dot: 'bg-purple-500',
          label: 'En revisión',
          icon: Eye,
        };
      case 'pendiente':
      default:
        return {
          bg: 'bg-slate-100 dark:bg-[#1A1C29] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#252636]',
          dot: 'bg-slate-400',
          label: 'Por iniciar',
          icon: ListTodo,
        };
    }
  };

  const getBorderColor = (estado: EstadoActividad) => {
    switch (estado) {
      case 'completada':
        return 'border-l-emerald-500';
      case 'en_proceso':
        return 'border-l-[#00F0FF]';
      case 'en_revision':
        return 'border-l-purple-500';
      case 'pendiente':
      default:
        return 'border-l-slate-300 dark:border-l-slate-700';
    }
  };

  return (
    <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] shadow-sm overflow-hidden transition-all duration-200">
      {/* Executive Header with En Jornada badge, Integrated Date & Start Time */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#252636] bg-slate-50/50 dark:bg-[#161722]/60">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          {/* Left: Title + En Jornada + Date & Reference Time */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Title */}
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] shrink-0">
                <ListChecks className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                Actividades del día
              </h2>
            </div>

            {/* En Jornada Badge */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#00F0FF]/10 text-[#0090A0] dark:text-[#00F0FF] border border-[#00F0FF]/30">
              <span className="w-2 h-2 rounded-full bg-[#00F0FF] animate-pulse" />
              <span>EN JORNADA</span>
            </span>

            {/* Inline Date Navigator */}
            {fecha && onDateChange && (
              <div className="flex items-center gap-0.5 bg-white dark:bg-[#1A1C29] p-0.5 rounded-full border border-slate-200/90 dark:border-[#252636] shadow-2xs">
                <button
                  type="button"
                  onClick={() => changeDayByOffset(-1)}
                  title="Día anterior"
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="relative flex items-center">
                  <label className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50/80 dark:bg-[#141522] hover:bg-slate-100 dark:hover:bg-[#1E2030] rounded-full cursor-pointer transition-colors">
                    <Calendar className="w-3.5 h-3.5 text-[#00A3BF] dark:text-[#00F0FF] shrink-0" />
                    <span>{formatHeaderDate(fecha)}</span>
                    {isToday(fecha) ? (
                      <span className="text-[9px] bg-[#00F0FF]/15 text-[#0090A0] dark:text-[#00F0FF] font-extrabold px-2 py-0.5 rounded-full border border-[#00F0FF]/30">
                        Hoy
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          goToToday();
                        }}
                        className="text-[10px] font-bold text-[#00A3BF] dark:text-[#00F0FF] hover:underline ml-0.5"
                      >
                        Ir a Hoy
                      </button>
                    )}
                    <input
                      type="date"
                      value={fecha}
                      onChange={(e) => onDateChange(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      title="Haz clic para seleccionar otra fecha en el calendario"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => changeDayByOffset(1)}
                  title="Día siguiente"
                  className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Referential Start Time Pill */}
            <div
              className="flex items-center gap-1.5 text-xs bg-white dark:bg-[#1A1C29] text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full border border-slate-200/90 dark:border-[#252636] transition-colors"
              title="Hora de inicio de la jornada (referencial, por defecto 08:30 am)"
            >
              <Clock className="w-3 h-3 text-[#00A3BF] dark:text-[#00F0FF] shrink-0" />
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Inicio ref:</span>
              {onHoraInicioChange ? (
                <input
                  type="time"
                  value={horaInicio || '08:30'}
                  onChange={(e) => onHoraInicioChange(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer w-14"
                  title="Ajustar hora referencial de inicio"
                />
              ) : (
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{horaInicio || '08:30'}</span>
              )}
            </div>

            {/* Metrics summary */}
            {actividades.length > 0 && (
              <span className="px-3 py-1 bg-[#00F0FF]/10 text-[#0090A0] dark:text-[#00F0FF] rounded-full text-xs font-bold border border-[#00F0FF]/25 hidden md:inline-flex items-center gap-1.5">
                <span>{actividades.length} {actividades.length === 1 ? 'actividad' : 'actividades'}</span>
                <span>•</span>
                <span>{formatDuration(totalMinutos)}</span>
              </span>
            )}
          </div>

          {/* Right: Primary Action Button */}
          <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center justify-center gap-1.5 bg-[#00F0FF] hover:bg-[#00D8E6] active:scale-95 text-slate-950 px-5 py-2 rounded-full text-xs font-extrabold shadow-sm shadow-[#00F0FF]/25 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all shrink-0 cursor-pointer min-h-[38px]"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Agregar actividad</span>
            </button>
          </div>
        </div>
      </div>

      {/* Empty State */}
      {actividades.length === 0 ? (
        <div className="text-center py-14 px-4 bg-slate-50/40 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-2xl bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center mx-auto mb-3">
            <ListChecks className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
            No hay actividades registradas hoy
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-4">
            Comienza agregando tu primera actividad individual o asigna colaboradores en paralelo para sincronizar el avance.
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#00F0FF] hover:bg-[#00D8E6] text-slate-950 rounded-full text-xs font-extrabold shadow-sm shadow-[#00F0FF]/25 hover:shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Crear primera actividad</span>
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP EXECUTIVE TABLE LIST VIEW (Hidden on small screens) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/90 dark:border-[#252636] bg-slate-50/80 dark:bg-[#161722]/80 text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 w-12 text-center">#</th>
                  <th className="py-3 px-3 w-32 whitespace-nowrap">Horario / Tiempo</th>
                  <th className="py-3 px-3 min-w-[220px]">Actividad (Descripción)</th>
                  <th className="py-3 px-3 w-28 whitespace-nowrap">Tipo</th>
                  <th className="py-3 px-3 w-28 whitespace-nowrap">Para / Cliente</th>
                  <th className="py-3 px-3 w-36 whitespace-nowrap">Trabajo en Paralelo</th>
                  <th className="py-3 px-2 w-20 text-center whitespace-nowrap">Adjuntos</th>
                  <th className="py-3 px-3 w-32 whitespace-nowrap">Estado</th>
                  <th className="py-3 px-3 w-24 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#252636]/60 text-xs text-slate-700 dark:text-slate-300">
                {actividades.map((act, index) => {
                  const statusConfig = getStatusBadge(act.estado);
                  const sharedNames = act.shared_with_names || [];
                  const hasShared = (act.shared_with && act.shared_with.length > 0) || sharedNames.length > 0;
                  const evidenceCount = act.evidencias?.length || 0;

                  return (
                    <tr
                      key={act.id || `act-${index}`}
                      onClick={() => handleOpenDetailModal(act, index)}
                      className={`group hover:bg-slate-50/80 dark:hover:bg-[#181A26] transition-colors cursor-pointer border-l-4 ${getBorderColor(
                        act.estado
                      )}`}
                    >
                      {/* # Orden */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-100 dark:bg-[#1A1C29] border border-slate-200 dark:border-[#252636] font-mono text-xs font-bold text-slate-500 dark:text-slate-400">
                          {index + 1}
                        </span>
                      </td>

                      {/* Horario / Tiempo */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                          <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                          <span>{act.hora_inicio || '--:--'}</span>
                          <span className="text-slate-300 dark:text-slate-700 mx-0.5">•</span>
                          <span className="text-[#00A3BF] dark:text-[#00F0FF] font-extrabold">{act.duracion_min}m</span>
                        </div>
                        {(act.parent_task_id || act.is_rollover) && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-purple-600 dark:text-purple-400 font-bold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800/40 mt-1">
                            <RefreshCw className="w-2.5 h-2.5" />
                            <span>Continuada</span>
                          </span>
                        )}
                      </td>

                      {/* Actividad / Descripción */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-start gap-1.5">
                          <p
                            className="font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed group-hover:text-slate-950 dark:group-hover:text-white transition-colors"
                            title="Haz clic para ver la descripción completa y detalles"
                          >
                            {act.descripcion || <span className="text-slate-400 dark:text-slate-500 italic">Sin descripción</span>}
                          </p>
                        </div>
                      </td>

                      {/* Tipo de Trabajo */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {act.tipo_trabajo ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1A1C29] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#252636]">
                            <Briefcase className="w-3 h-3 text-[#00A3BF] dark:text-[#00F0FF]" />
                            <span>{act.tipo_trabajo}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </td>

                      {/* Para / Cliente */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {act.para_cliente ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                            <span className="w-2 h-2 rounded-full bg-[#00F0FF] shrink-0" />
                            <span className="truncate">{act.para_cliente}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </td>

                      {/* Trabajo en Paralelo */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {hasShared ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#EC4899] bg-[#EC4899]/10 border border-[#EC4899]/30 px-2.5 py-0.5 rounded-full truncate max-w-[130px]"
                            title={`Compartida con: ${sharedNames.join(', ')}`}
                          >
                            <Users className="w-3 h-3 text-[#EC4899] shrink-0" />
                            <span className="truncate">
                              {sharedNames.length > 0 ? sharedNames.join(', ') : `${act.shared_with?.length} colab.`}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-[11px]">Individual</span>
                        )}
                      </td>

                      {/* Adjuntos */}
                      <td className="py-3.5 px-3 text-center whitespace-nowrap">
                        {evidenceCount > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00A3BF] dark:text-[#00F0FF] bg-[#00F0FF]/10 dark:bg-[#00F0FF]/15 border border-[#00F0FF]/30 px-2.5 py-0.5 rounded-full"
                            title={`${evidenceCount} archivo(s) adjunto(s)`}
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>{evidenceCount}</span>
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>

                      {/* Estado con selector rápido */}
                      <td className="py-3.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center">
                          <select
                            value={act.estado}
                            onChange={(e) => {
                              const nuevoEstado = e.target.value as EstadoActividad;
                              if (onUpdateEstado) {
                                onUpdateEstado(index, nuevoEstado);
                              } else {
                                onUpdateActividad(index, 'estado', nuevoEstado);
                              }
                            }}
                            className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all cursor-pointer outline-hidden shadow-2xs ${statusConfig.bg}`}
                          >
                            <option value="pendiente" className="bg-white dark:bg-[#161722] text-slate-800 dark:text-slate-200">Por iniciar</option>
                            <option value="en_proceso" className="bg-white dark:bg-[#161722] text-slate-800 dark:text-slate-200">En proceso</option>
                            <option value="en_revision" className="bg-white dark:bg-[#161722] text-slate-800 dark:text-slate-200">En revisión</option>
                            <option value="completada" className="bg-white dark:bg-[#161722] text-slate-800 dark:text-slate-200">Completada</option>
                          </select>
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDetailModal(act, index)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#00A3BF] dark:hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 dark:hover:bg-[#00F0FF]/15 rounded-full transition-colors cursor-pointer"
                            title="Ver detalle completo y evidencias"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(act, index)}
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#00A3BF] dark:hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 dark:hover:bg-[#00F0FF]/15 rounded-full transition-colors cursor-pointer"
                            title="Editar actividad"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onRemoveActividad(index)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors cursor-pointer"
                            title="Eliminar actividad"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE / TABLET COMPACT LIST VIEW (< 1024px) */}
          <div className="lg:hidden divide-y divide-slate-100 dark:divide-[#252636]/60">
            {actividades.map((act, index) => {
              const statusConfig = getStatusBadge(act.estado);
              const sharedNames = act.shared_with_names || [];
              const hasShared = (act.shared_with && act.shared_with.length > 0) || sharedNames.length > 0;
              const evidenceCount = act.evidencias?.length || 0;

              return (
                <div
                  key={act.id || `act-m-${index}`}
                  onClick={() => handleOpenDetailModal(act, index)}
                  className={`p-4 hover:bg-slate-50/80 dark:hover:bg-[#181A26] transition-colors cursor-pointer border-l-4 ${getBorderColor(
                    act.estado
                  )}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-sm bg-slate-100 dark:bg-[#1A1C29] border border-slate-200 dark:border-[#252636] font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{act.hora_inicio || '--:--'}</span>
                      <span className="text-xs font-extrabold text-[#00A3BF] dark:text-[#00F0FF] bg-[#00F0FF]/10 dark:bg-[#00F0FF]/15 px-2.5 py-0.5 rounded-full border border-[#00F0FF]/30">
                        {act.duracion_min}m
                      </span>
                      {hasShared && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-[#EC4899]/10 text-[#EC4899] rounded-full border border-[#EC4899]/30 inline-flex items-center gap-1">
                          <Users className="w-3 h-3 text-[#EC4899]" />
                          <span>Compartida</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenDetailModal(act, index)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#00A3BF] dark:hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 dark:hover:bg-[#00F0FF]/15 rounded-full transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(act, index)}
                        className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#00A3BF] dark:hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 dark:hover:bg-[#00F0FF]/15 rounded-full transition-colors"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveActividad(index)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-relaxed mb-2">
                    {act.descripcion || <span className="text-slate-400 dark:text-slate-500 italic">Sin descripción</span>}
                  </p>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      {act.tipo_trabajo && <span className="font-semibold text-slate-700 dark:text-slate-300">{act.tipo_trabajo}</span>}
                      {act.para_cliente && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
                          <span>Para: <strong className="text-slate-700 dark:text-slate-200">{act.para_cliente}</strong></span>
                        </span>
                      )}
                      {evidenceCount > 0 && (
                        <span className="font-bold text-[#00A3BF] dark:text-[#00F0FF] inline-flex items-center gap-1">
                          <Paperclip className="w-3 h-3" />
                          <span>{evidenceCount}</span>
                        </span>
                      )}
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig.bg}`}>
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODAL 1: Detail Inspection Modal (opens when clicking row or eye) */}
      <ActividadDetalleModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        actividad={selectedDetailActividad}
        index={selectedDetailIndex}
        onEdit={(act, idx) => {
          setDetailModalOpen(false);
          handleOpenEditModal(act, idx);
        }}
        onUpdateEstado={(idx, nuevoSt) => {
          if (onUpdateEstado) onUpdateEstado(idx, nuevoSt);
          if (selectedDetailActividad) {
            setSelectedDetailActividad({ ...selectedDetailActividad, estado: nuevoSt });
          }
        }}
      />

      {/* MODAL 2: Creation & Edition Modal */}
      <ActividadModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        actividadToEdit={editingActividad}
        editIndex={editingIndex}
        onSave={handleSaveModal}
        users={users}
        currentUser={currentUser}
      />
    </div>
  );
};
