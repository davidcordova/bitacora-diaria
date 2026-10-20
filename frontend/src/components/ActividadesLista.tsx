import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  Cloud,
  CloudOff,
  Link2,
  MessageSquare,
  GitBranch,
  ArrowUpRight,
  Terminal,
  ShieldCheck,
  Zap,
  Rocket,
  Coffee,
  Play,
  Square,
  Check,
} from 'lucide-react';
import { Actividad, EstadoActividad, User, Evidencia } from '../types';
import { formatDuration, calculateHoraFin } from '../utils/formatters';
import { ActividadModal } from './ActividadModal';
import { ActividadDetalleModal } from './ActividadDetalleModal';
import { ActividadReferenciaModal } from './ActividadReferenciaModal';
import { RichHtmlRenderer } from './RichHtmlRenderer';


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
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedTime?: Date | null;
  onForceSyncCloud?: () => void;
  onOpenErrorReport?: () => void;
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
  autoSaveStatus = 'idle',
  lastSavedTime = null,
  onForceSyncCloud,
  onOpenErrorReport,
}) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingActividad, setEditingActividad] = useState<Actividad | null>(null);

  // Detail inspection modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDetailActividad, setSelectedDetailActividad] = useState<Actividad | null>(null);
  const [selectedDetailIndex, setSelectedDetailIndex] = useState<number | null>(null);

  // Reference navigation & highlight states
  const [highlightedActId, setHighlightedActId] = useState<number | string | null>(null);
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [selectedRefId, setSelectedRefId] = useState<number | string | null>(null);
  const [selectedRefVinculo, setSelectedRefVinculo] = useState<string | undefined>('continuacion');

  // IT Quick-Bar & Fast Entry states
  const [quickDesc, setQuickDesc] = useState('');
  const [quickDuration, setQuickDuration] = useState<number>(30);
  const [quickTipo, setQuickTipo] = useState<string>('Desarrollo');
  const [quickCliente, setQuickCliente] = useState<string>('Interno TI');
  const [recentFeedback, setRecentFeedback] = useState<string | null>(null);

  // Live Timer states
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerStartTimeStr, setTimerStartTimeStr] = useState<string>('');

  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((sec) => sec + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  // Compute tasks that reference other tasks in the current day (reverse linkages)
  const childTasksMap = useMemo(() => {
    const map = new Map<number, Actividad[]>();
    actividades.forEach((act) => {
      if (act.parent_task_id) {
        const pId = Number(act.parent_task_id);
        const list = map.get(pId) || [];
        list.push(act);
        map.set(pId, list);
      }
    });
    return map;
  }, [actividades]);

  // Check if there is a pending auto-scroll to an activity (e.g. after date change)
  useEffect(() => {
    const pending = sessionStorage.getItem('pending_highlight_act_id');
    if (pending) {
      const actId = Number(pending);
      if (actividades.some((a) => Number(a.id) === actId)) {
        sessionStorage.removeItem('pending_highlight_act_id');
        setTimeout(() => {
          const rowEl = document.getElementById(`act-row-${actId}`) || document.getElementById(`act-m-${actId}`);
          if (rowEl) {
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedActId(actId);
            setTimeout(() => setHighlightedActId(null), 2800);
          }
        }, 350);
      }
    }
  }, [actividades, fecha]);

  const handleNavigateToRef = (targetId: number | string, tipoVinculo = 'continuacion', e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const numId = Number(targetId);
    // 1. If target activity is in the current list, scroll directly to it and highlight
    const localAct = actividades.find((a) => Number(a.id) === numId);
    if (localAct) {
      const rowEl = document.getElementById(`act-row-${numId}`) || document.getElementById(`act-m-${numId}`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setHighlightedActId(numId);
      setTimeout(() => {
        setHighlightedActId((prev) => (prev === numId ? null : prev));
      }, 2800);
      return;
    }

    // 2. If target activity belongs to another date, open the reference inspector modal
    setSelectedRefId(numId);
    setSelectedRefVinculo(tipoVinculo);
    setRefModalOpen(true);
  };

  const handleNavigateToDateAndHighlight = (targetDate: string, targetActId: number | string) => {
    if (onDateChange) {
      sessionStorage.setItem('pending_highlight_act_id', targetActId.toString());
      onDateChange(targetDate);
    }
  };

  const totalMinutos = actividades.reduce(
    (sum, act) => sum + (Number(act.duracion_min) || 0),
    0
  );

  const completadasCount = useMemo(
    () => actividades.filter((a) => a.estado === 'completada').length,
    [actividades]
  );
  const enProcesoCount = useMemo(
    () => actividades.filter((a) => a.estado === 'en_proceso' || a.estado === 'en_revision').length,
    [actividades]
  );
  const pendientesCount = useMemo(
    () => actividades.filter((a) => a.estado === 'pendiente' || !a.estado).length,
    [actividades]
  );
  const targetMinutos = 480; // Meta estándar de 8 horas diarias
  const porcentajeJornada = Math.min(100, Math.round((totalMinutos / targetMinutos) * 100));

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

  // Presets técnicos específicos para el área de Sistemas
  const IT_PRESETS = [
    {
      id: 'daily',
      icon: Terminal,
      label: 'Daily Standup',
      tipo: 'Reunión',
      cliente: 'Interno TI',
      duracion: 15,
      color: 'text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/40 border-cyan-200 dark:border-cyan-800/60',
    },
    {
      id: 'backups',
      icon: ShieldCheck,
      label: 'Monitoreo & Backups',
      tipo: 'Mantenimiento',
      cliente: 'Infraestructura TI',
      duracion: 30,
      color: 'text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60',
    },
    {
      id: 'deploy',
      icon: Rocket,
      label: 'Deploy / Pase a Prod',
      tipo: 'Despliegue',
      cliente: 'Producción',
      duracion: 45,
      color: 'text-purple-700 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800/60',
    },
    {
      id: 'ticket',
      icon: Zap,
      label: 'Soporte a Usuario',
      tipo: 'Soporte Técnico',
      cliente: 'Mesa de Ayuda',
      duracion: 20,
      color: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
    },
    {
      id: 'almuerzo',
      icon: Coffee,
      label: 'Almuerzo / Pausa',
      tipo: 'Pausa',
      cliente: 'Personal',
      duracion: 60,
      color: 'text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700',
    },
  ];

  const getNextStartTime = () => {
    if (actividades.length === 0) return horaInicio || '08:30';
    for (let i = actividades.length - 1; i >= 0; i--) {
      const a = actividades[i];
      if (a.hora_fin && a.hora_fin !== '--:--') return a.hora_fin;
      if (a.hora_inicio && a.duracion_min) {
        const calculated = calculateHoraFin(a.hora_inicio, a.duracion_min, fecha);
        if (calculated && calculated !== '--:--') return calculated;
      }
    }
    return horaInicio || '08:30';
  };

  const handleApplyPreset = (preset: typeof IT_PRESETS[0]) => {
    const start = getNextStartTime();
    const end = calculateHoraFin(start, preset.duracion, fecha) || start;
    onAddActividad({
      hora_inicio: start,
      hora_fin: end,
      duracion_min: preset.duracion,
      tipo_trabajo: preset.tipo,
      para_cliente: preset.cliente,
      descripcion: preset.label,
      estado: 'completada',
    });
    setRecentFeedback(`¡"${preset.label}" agregada en 1 clic!`);
    setTimeout(() => setRecentFeedback(null), 3000);
  };

  const handleQuickAddSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanDesc = quickDesc.trim();
    if (!cleanDesc) return;
    const start = getNextStartTime();
    const end = calculateHoraFin(start, quickDuration, fecha) || start;
    onAddActividad({
      hora_inicio: start,
      hora_fin: end,
      duracion_min: quickDuration,
      tipo_trabajo: quickTipo,
      para_cliente: quickCliente,
      descripcion: cleanDesc,
      estado: 'completada',
    });
    setQuickDesc('');
    setRecentFeedback('¡Actividad registrada rápidamente!');
    setTimeout(() => setRecentFeedback(null), 3000);
  };

  const handleStartTimer = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    setTimerStartTimeStr(`${hh}:${mm}`);
    setTimerSeconds(0);
    setIsTimerRunning(true);
  };

  const handleStopTimer = () => {
    const durationMin = Math.max(5, Math.round(timerSeconds / 60));
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const endTimeStr = `${hh}:${mm}`;

    onAddActividad({
      hora_inicio: timerStartTimeStr || getNextStartTime(),
      hora_fin: endTimeStr,
      duracion_min: durationMin,
      tipo_trabajo: quickTipo || 'Soporte Técnico',
      para_cliente: quickCliente || 'Interno TI',
      descripcion: quickDesc.trim() || 'Actividad registrada con cronómetro en vivo',
      estado: 'completada',
    });

    setIsTimerRunning(false);
    setTimerSeconds(0);
    setTimerStartTimeStr('');
    setQuickDesc('');
    setRecentFeedback(`¡Cronómetro finalizado: ${durationMin} min registrados!`);
    setTimeout(() => setRecentFeedback(null), 3500);
  };

  const formatTimerClock = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Atajos de teclado para desarrolladores (N, Esc, Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toUpperCase();
      const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      // 'N' abre modal de nueva actividad si no se está escribiendo
      if ((e.key === 'n' || e.key === 'N') && !isInputActive && !createModalOpen && !detailModalOpen && !refModalOpen) {
        e.preventDefault();
        handleOpenCreateModal();
        return;
      }

      // 'Ctrl+Enter' o 'Cmd+Enter' para registro rápido
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        if (quickDesc.trim()) {
          e.preventDefault();
          handleQuickAddSubmit();
        }
      }

      // 'Escape' cierra modales
      if (e.key === 'Escape') {
        if (createModalOpen) setCreateModalOpen(false);
        if (detailModalOpen) setDetailModalOpen(false);
        if (refModalOpen) setRefModalOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [createModalOpen, detailModalOpen, refModalOpen, quickDesc, quickDuration, quickTipo, quickCliente]);

  // Helper for status badge style (high-contrast WCAG AA compliant)
  const getStatusBadge = (estado: EstadoActividad) => {
    switch (estado) {
      case 'completada':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300/80 dark:border-emerald-800/60',
          dot: 'bg-emerald-500',
          label: 'Completada',
          icon: CheckCircle2,
        };
      case 'en_proceso':
        return {
          bg: 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-300/80 dark:border-sky-800/60',
          dot: 'bg-sky-500',
          label: 'En proceso',
          icon: Timer,
        };
      case 'en_revision':
        return {
          bg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-300/80 dark:border-purple-800/60',
          dot: 'bg-purple-500',
          label: 'En revisión',
          icon: Eye,
        };
      case 'pendiente':
      default:
        return {
          bg: 'bg-slate-100 dark:bg-[#1A1C29] text-slate-800 dark:text-slate-200 border-slate-300 dark:border-[#252636]',
          dot: 'bg-slate-500',
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
        return 'border-l-sky-500';
      case 'en_revision':
        return 'border-l-purple-500';
      case 'pendiente':
      default:
        return 'border-l-slate-400 dark:border-l-slate-600';
    }
  };

  return (
    <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] shadow-sm overflow-hidden transition-all duration-200">
      {/* 1. EXECUTIVE TOOLBAR */}
      <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#252636] bg-slate-50/60 dark:bg-[#161722]/60">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Title + Date Navigator + Start Time */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Title */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/15 to-blue-500/15 text-cyan-700 dark:text-[#00F0FF] border border-cyan-500/20 shrink-0">
                <ListChecks className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
                  Actividades
                </h2>
              </div>
            </div>

            {/* Error de Conexión (solo visible en caso de fallo para reintento y reporte) */}
            {autoSaveStatus === 'error' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={onForceSyncCloud}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-all cursor-pointer shadow-xs"
                  title="Hubo un problema de conexión al guardar. Clic para reintentar ahora"
                >
                  <CloudOff className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                  <span>Sin conexión (Reintentar)</span>
                </button>
                {onOpenErrorReport && (
                  <button
                    type="button"
                    onClick={onOpenErrorReport}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer shadow-xs"
                    title="Ver diagnóstico del error y adjuntar captura para soporte"
                  >
                    <span>⚠️ Ver detalle / Reportar</span>
                  </button>
                )}
              </div>
            )}

            {/* Inline Date Navigator */}
            {fecha && onDateChange && (
              <div className="flex items-center gap-0.5 bg-white dark:bg-[#1A1C29] p-0.5 rounded-xl border border-slate-200/90 dark:border-[#252636] shadow-2xs">
                <button
                  type="button"
                  onClick={() => changeDayByOffset(-1)}
                  title="Día anterior"
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="relative flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        dateInputRef.current?.showPicker();
                      } catch (e) {
                        dateInputRef.current?.focus();
                      }
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50/80 dark:bg-[#141522] hover:bg-slate-100 dark:hover:bg-[#1E2030] rounded-lg cursor-pointer transition-colors"
                    title="Haz clic para seleccionar fecha en el calendario"
                  >
                    <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00F0FF] shrink-0" />
                    <span>{formatHeaderDate(fecha)}</span>
                    {isToday(fecha) && (
                      <span className="text-[10px] bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 font-extrabold px-2 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800/60">
                        Hoy
                      </span>
                    )}
                  </button>

                  {!isToday(fecha) && (
                    <button
                      type="button"
                      onClick={goToToday}
                      className="text-[10px] font-bold text-cyan-700 dark:text-[#00F0FF] hover:underline px-2 py-0.5 cursor-pointer ml-0.5"
                      title="Volver a la fecha de hoy"
                    >
                      Ir a Hoy
                    </button>
                  )}

                  <input
                    ref={dateInputRef}
                    type="date"
                    value={fecha}
                    onChange={(e) => {
                      if (e.target.value) {
                        onDateChange(e.target.value);
                      }
                    }}
                    className="sr-only"
                    tabIndex={-1}
                    aria-hidden="true"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => changeDayByOffset(1)}
                  title="Día siguiente"
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Referential Start Time Pill */}
            <div
              className="flex items-center gap-1.5 text-xs bg-white dark:bg-[#1A1C29] text-slate-600 dark:text-slate-300 px-3 py-1 rounded-xl border border-slate-200/90 dark:border-[#252636] shadow-2xs"
              title="Hora referencial de inicio"
            >
              <Clock className="w-3 h-3 text-cyan-600 dark:text-[#00F0FF] shrink-0" />
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">Inicio:</span>
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
          </div>

          {/* Right: Primary Action Button */}
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 hover:shadow-cyan-600/30 transition-all shrink-0 cursor-pointer min-h-[38px]"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Agregar actividad</span>
            </button>
          </div>
        </div>

        {/* 2. EXECUTIVE DAILY PROGRESS HERO (Only visible when there are activities) */}
        {actividades.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200/70 dark:border-[#252636]/60">
            {/* Top row: Target info & KPI stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  Progreso de la Jornada:
                </span>
                <span className="text-xs font-extrabold text-cyan-700 dark:text-cyan-400">
                  {formatDuration(totalMinutos)}
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  de 8h 00m ({porcentajeJornada}%)
                </span>
              </div>

              {/* 4 Mini KPI Chips */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-[#1A1C29] border border-slate-200/80 dark:border-[#252636] text-slate-700 dark:text-slate-300 font-semibold shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-cyan-500" />
                  <span>Total: <strong>{actividades.length}</strong></span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>Completadas: <strong>{completadasCount}</strong></span>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/50 text-sky-800 dark:text-sky-300 font-semibold shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-sky-500" />
                  <span>En Proceso: <strong>{enProcesoCount}</strong></span>
                </div>
                {pendientesCount > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-slate-400" />
                    <span>Por iniciar: <strong>{pendientesCount}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-200/80 dark:bg-slate-800/80 h-2.5 rounded-full overflow-hidden p-0.5">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  porcentajeJornada >= 100
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                    : 'bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600'
                }`}
                style={{ width: `${porcentajeJornada}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 2. IT POWER-USER BAR: QUICK PRESETS, INLINE QUICK-ADD & LIVE TIMER */}
      <div className="p-3.5 sm:p-4 bg-slate-50/80 dark:bg-[#151622]/80 border-b border-slate-200/80 dark:border-[#252636] space-y-3">
        {/* Fila 1: Presets Rápidos de 1 Clic y Cronómetro en Vivo */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Quick Presets for Systems & IT */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline-flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Presets TI:</span>
            </span>
            {IT_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shadow-2xs hover:scale-102 active:scale-95 ${preset.color}`}
                  title={`Registrar "${preset.label}" (${preset.duracion} min) en 1 solo clic`}
                >
                  <Icon className="w-3 h-3 shrink-0" />
                  <span>{preset.label}</span>
                  <span className="opacity-60 text-[10px]">({preset.duracion}m)</span>
                </button>
              );
            })}
          </div>

          {/* Right: Live Activity Timer Toggle + Keyboard shortcut hint */}
          <div className="flex items-center gap-2">
            {!isTimerRunning ? (
              <button
                type="button"
                onClick={handleStartTimer}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-white dark:bg-[#1A1C29] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#252636] hover:border-cyan-500/50 shadow-2xs transition-all cursor-pointer"
                title="Iniciar cronómetro para medir una tarea técnica en tiempo real"
              >
                <Play className="w-3 h-3 text-cyan-600 dark:text-[#00F0FF] fill-current" />
                <span>Cronómetro en Vivo</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 shadow-xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>⏱ {formatTimerClock(timerSeconds)}</span>
                <button
                  type="button"
                  onClick={handleStopTimer}
                  className="ml-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-bold hover:bg-rose-500 cursor-pointer shadow-2xs"
                  title="Detener cronómetro y registrar actividad"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Detener y Guardar</span>
                </button>
              </div>
            )}

            <span className="hidden xl:inline-block text-[10px] text-slate-400 dark:text-slate-500 font-mono bg-white dark:bg-white/5 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-white/5">
              Atajo: <kbd className="font-bold text-slate-700 dark:text-slate-300">[N]</kbd>
            </span>
          </div>
        </div>

        {/* Fila 2: Registro Rápido en Línea (Inline Quick-Add) */}
        <form onSubmit={handleQuickAddSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={quickDesc}
              onChange={(e) => setQuickDesc(e.target.value)}
              placeholder="⚡ Registro rápido: describe la tarea y presiona Enter (ej: Reinicio de pool nginx en servidor web #SRV-02)..."
              className="w-full pl-3.5 pr-28 py-2 text-xs bg-white dark:bg-[#1A1C29] text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20 outline-hidden transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-2xs font-medium"
            />
            {/* Quick Duration Buttons embedded inside input */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1">
              {[15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setQuickDuration(mins)}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-all cursor-pointer ${
                    quickDuration === mins
                      ? 'bg-cyan-600 text-white shadow-2xs'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-100 dark:bg-white/5'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
          </div>

          {/* Quick Category Selector & Submit Button */}
          <div className="flex items-center gap-1.5">
            <select
              value={quickTipo}
              onChange={(e) => setQuickTipo(e.target.value)}
              className="text-xs font-semibold px-2.5 py-2 rounded-xl bg-white dark:bg-[#1A1C29] text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-[#252636] focus:outline-none focus:border-cyan-500 cursor-pointer shadow-2xs"
            >
              <option value="Desarrollo">💻 Desarrollo</option>
              <option value="Soporte Técnico">🛠️ Soporte</option>
              <option value="Infraestructura">🌐 Redes / Servidores</option>
              <option value="Mantenimiento">🔧 Mantenimiento</option>
              <option value="Reunión">👥 Reunión</option>
            </select>

            <button
              type="submit"
              disabled={!quickDesc.trim()}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0 min-h-[34px]"
            >
              + Agregar
            </button>
          </div>
        </form>

        {/* Temporary Feedback Banner if preset was clicked */}
        {recentFeedback && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800/40 animate-in fade-in">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{recentFeedback}</span>
          </div>
        )}
      </div>

      {/* Empty State */}
      {actividades.length === 0 ? (
        <div className="text-center py-12 px-4 bg-slate-50/40 dark:bg-slate-900/30">
          <div className="w-12 h-12 rounded-2xl bg-cyan-100/70 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 flex items-center justify-center mx-auto mb-3 border border-cyan-200 dark:border-cyan-800/40">
            <ListChecks className="w-6 h-6 stroke-[2.5]" />
          </div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
            Sin actividades {isToday(fecha) ? 'hoy' : 'para esta fecha'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Agrega tu primera actividad para comenzar a registrar tu jornada laboral.
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Agregar actividad</span>
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP EXECUTIVE TABLE LIST VIEW (Hidden on small screens) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/90 dark:border-[#252636] bg-slate-50/80 dark:bg-[#161722]/80 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-3 w-36 whitespace-nowrap">Horario</th>
                  <th className="py-3 px-4 min-w-[260px]">Actividad</th>
                  <th className="py-3 px-3 w-40 whitespace-nowrap">Cliente / Tipo</th>
                  <th className="py-3 px-3 w-28 whitespace-nowrap">Colaboración</th>
                  <th className="py-3 px-2 w-14 text-center whitespace-nowrap">Adj.</th>
                  <th className="py-3 px-3 w-36 whitespace-nowrap">Estado</th>
                  <th className="py-3 px-3 w-20 text-right whitespace-nowrap">Acciones</th>
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
                      id={act.id ? `act-row-${act.id}` : undefined}
                      onClick={() => handleOpenDetailModal(act, index)}
                      className={`group hover:bg-slate-50/90 dark:hover:bg-[#181A26] transition-all cursor-pointer border-l-4 ${getBorderColor(
                        act.estado
                      )} ${highlightedActId === act.id ? 'act-highlighted ring-2 ring-cyan-500' : ''}`}
                    >
                      {/* # Orden */}
                      <td className="py-3.5 px-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#1A1C29] border border-slate-200 dark:border-[#252636] font-mono text-xs font-bold text-slate-600 dark:text-slate-400">
                          {index + 1}
                        </span>
                      </td>

                      {/* Horario / Tiempo */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {(!act.hora_inicio || act.hora_inicio === '--:--') && (!act.duracion_min || act.duracion_min === 0) ? (
                          <div className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 font-semibold bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-900/50">
                            <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>Arrastrada · 0m</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                              <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                              <span>{act.hora_inicio || '--:--'}</span>
                              <span className="text-slate-400 dark:text-slate-500 font-normal">→</span>
                              <span>{act.hora_fin || calculateHoraFin(act.hora_inicio, act.duracion_min, fecha) || '--:--'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-cyan-700 dark:text-[#00F0FF] font-bold">{act.duracion_min} min</span>
                              {(act.parent_task_id || act.is_rollover) && (
                                <span className="text-purple-600 dark:text-purple-400 font-semibold text-[10px]">· Continuada</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actividad / Descripción */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            {act.parent_task_id && (
                              <button
                                type="button"
                                onClick={(e) => handleNavigateToRef(act.parent_task_id!, act.tipo_vinculo, e)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-800 dark:text-[#00F0FF] bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/50 dark:hover:bg-cyan-900/60 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-800/60 shrink-0 cursor-pointer transition-all shadow-2xs group/ref"
                                title={act.parent_task_desc ? `Vinculada con: ${act.parent_task_desc} (Clic para ir a la tarea)` : `Clic para ir a la actividad referenciada #${act.parent_task_id}`}
                              >
                                <Link2 className="w-2.5 h-2.5 text-cyan-600 dark:text-[#00F0FF] group-hover/ref:rotate-45 transition-transform" />
                                <span>Ref #{act.parent_task_id}</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover/ref:opacity-100" />
                              </button>
                            )}

                            {act.id !== undefined && act.id !== null && childTasksMap.has(Number(act.id)) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const firstChild = childTasksMap.get(Number(act.id))![0];
                                  if (firstChild.id) handleNavigateToRef(firstChild.id, firstChild.tipo_vinculo, e);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-950/60 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/40 shrink-0 cursor-pointer transition-all"
                                title={`Esta actividad tiene ${childTasksMap.get(Number(act.id))!.length} continuación(es) hoy. Clic para ir.`}
                              >
                                <GitBranch className="w-2.5 h-2.5" />
                                <span>↳ {childTasksMap.get(Number(act.id))!.length} vinc.</span>
                              </button>
                            )}

                            {act.comentarios && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-500/30 shrink-0"
                                title={`Comentario: ${act.comentarios}`}
                              >
                                <MessageSquare className="w-2.5 h-2.5 text-amber-500" />
                                <span>Nota</span>
                              </span>
                            )}
                            {act.created_by_name && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-semibold text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded-md border border-teal-500/30 shrink-0"
                                title={`Registrado en apoyo por ${act.created_by_name}`}
                              >
                                <UserCheck className="w-2.5 h-2.5 text-teal-500" />
                                <span>Apoyo: {act.created_by_name.split(' ')[0]}</span>
                              </span>
                            )}
                          </div>
                          <RichHtmlRenderer
                            content={act.descripcion}
                            clampLines={2}
                            className="font-semibold text-slate-800 dark:text-slate-100 leading-relaxed group-hover:text-cyan-900 dark:group-hover:text-white transition-colors"
                          />
                        </div>
                      </td>

                      {/* Cliente / Tipo combinado */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {act.para_cliente ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
                              <span className="w-2 h-2 rounded-full bg-cyan-500 shrink-0" />
                              <span className="truncate">{act.para_cliente}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500 text-xs">Sin cliente</span>
                          )}
                          {act.tipo_trabajo && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1A1C29] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-[#252636] w-fit">
                              <Briefcase className="w-2.5 h-2.5 text-slate-400" />
                              <span>{act.tipo_trabajo}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Colaboración */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {hasShared ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 px-2 py-0.5 rounded-lg truncate max-w-[110px]"
                            title={`Compartida con: ${sharedNames.join(', ')}`}
                          >
                            <Users className="w-3 h-3 text-indigo-500 shrink-0" />
                            <span className="truncate">
                              {sharedNames.length > 0 ? sharedNames.join(', ') : `${act.shared_with?.length} colab.`}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 text-[11px]">Individual</span>
                        )}
                      </td>

                      {/* Adjuntos */}
                      <td className="py-3.5 px-2 text-center whitespace-nowrap">
                        {evidenceCount > 0 ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-800 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800/60 px-2 py-0.5 rounded-md"
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
                        <div className="relative inline-flex items-center">
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
                            className={`text-xs font-bold pl-3 pr-7 py-1.5 rounded-xl border transition-all cursor-pointer outline-hidden shadow-2xs appearance-none ${statusConfig.bg}`}
                          >
                            <option value="pendiente" className="bg-white dark:bg-[#161722] text-slate-800 dark:text-slate-200">● Por iniciar</option>
                            <option value="en_proceso" className="bg-white dark:bg-[#161722] text-slate-800 dark:text-slate-200">● En proceso</option>
                            <option value="en_revision" className="bg-white dark:bg-[#161722] text-slate-800 dark:text-slate-200">● En revisión</option>
                            <option value="completada" className="bg-white dark:bg-[#161722] text-slate-800 dark:text-slate-200">● Completada</option>
                          </select>
                          <ChevronRight className="w-3 h-3 rotate-90 absolute right-2.5 pointer-events-none opacity-60" />
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(act, index)}
                            className="p-1.5 text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 rounded-lg transition-colors cursor-pointer"
                            title="Editar actividad"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onRemoveActividad(index)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
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
                  id={act.id ? `act-m-${act.id}` : undefined}
                  onClick={() => handleOpenDetailModal(act, index)}
                  className={`p-4 hover:bg-slate-50/80 dark:hover:bg-[#181A26] transition-all cursor-pointer border-l-4 ${getBorderColor(
                    act.estado
                  )} ${highlightedActId === act.id ? 'act-highlighted ring-2 ring-cyan-500 shadow-md' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-sm bg-slate-100 dark:bg-[#1A1C29] border border-slate-200 dark:border-[#252636] font-mono text-[10px] font-bold text-slate-600 dark:text-slate-400">
                        {index + 1}
                      </span>
                      {(!act.hora_inicio || act.hora_inicio === '--:--') && (!act.duracion_min || act.duracion_min === 0) ? (
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800/40">
                          {act.parent_task_id || act.is_rollover ? 'Arrastrada · sin tiempo hoy' : 'Sin horario'}
                        </span>
                      ) : (
                        <>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {act.hora_inicio || '--:--'} - {act.hora_fin || calculateHoraFin(act.hora_inicio, act.duracion_min, fecha) || '--:--'}
                          </span>
                          <span className="text-xs font-extrabold text-cyan-800 dark:text-[#00F0FF] bg-cyan-100/70 dark:bg-[#00F0FF]/15 px-2.5 py-0.5 rounded-full border border-cyan-300 dark:border-[#00F0FF]/30">
                            {act.duracion_min}m
                          </span>
                        </>
                      )}
                      {hasShared && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800/40 inline-flex items-center gap-1">
                          <Users className="w-3 h-3 text-indigo-500" />
                          <span>Compartida</span>
                        </span>
                      )}
                      {act.created_by_name && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 bg-teal-500/10 text-teal-700 dark:text-teal-300 rounded-full border border-teal-500/30 inline-flex items-center gap-1"
                          title={`Registrado en apoyo por ${act.created_by_name}`}
                        >
                          <UserCheck className="w-3 h-3 text-teal-500" />
                          <span>Apoyo: {act.created_by_name.split(' ')[0]}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(act, index)}
                        className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-cyan-700 dark:hover:text-[#00F0FF] hover:bg-cyan-50 dark:hover:bg-[#00F0FF]/15 rounded-full transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveActividad(index)}
                        className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Badges de vinculación / continuación interactivos en móvil */}
                  {(act.parent_task_id || (act.id !== undefined && act.id !== null && childTasksMap.has(Number(act.id))) || act.comentarios) && (
                    <div className="flex flex-wrap items-center gap-1.5 mb-2" onClick={(e) => e.stopPropagation()}>
                      {act.parent_task_id && (
                        <button
                          type="button"
                          onClick={(e) => handleNavigateToRef(act.parent_task_id!, act.tipo_vinculo, e)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-800 dark:text-[#00F0FF] bg-cyan-100/70 hover:bg-cyan-200 dark:bg-[#00F0FF]/15 dark:hover:bg-[#00F0FF]/25 px-2 py-0.5 rounded-md border border-cyan-300 dark:border-[#00F0FF]/40 cursor-pointer shadow-2xs"
                          title="Clic para ir a la actividad referenciada"
                        >
                          <Link2 className="w-2.5 h-2.5" />
                          <span>Ref #{act.parent_task_id}</span>
                          <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                        </button>
                      )}

                      {act.id !== undefined && act.id !== null && childTasksMap.has(Number(act.id)) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const firstChild = childTasksMap.get(Number(act.id))![0];
                            if (firstChild.id) handleNavigateToRef(firstChild.id, firstChild.tipo_vinculo, e);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800/40 cursor-pointer"
                        >
                          <GitBranch className="w-2.5 h-2.5" />
                          <span>↳ {childTasksMap.get(Number(act.id))!.length} vinc.</span>
                        </button>
                      )}

                      {act.comentarios && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-500/30">
                          <MessageSquare className="w-2.5 h-2.5 text-amber-500" />
                          <span>Nota</span>
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mb-2">
                    <RichHtmlRenderer
                      content={act.descripcion}
                      clampLines={2}
                      className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      {act.tipo_trabajo && <span className="font-semibold text-slate-700 dark:text-slate-300">{act.tipo_trabajo}</span>}
                      {act.para_cliente && (
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 dark:bg-[#00F0FF]" />
                          <span>Para: <strong className="text-slate-700 dark:text-slate-200">{act.para_cliente}</strong></span>
                        </span>
                      )}
                      {evidenceCount > 0 && (
                        <span className="font-bold text-cyan-800 dark:text-[#00F0FF] inline-flex items-center gap-1">
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
        fecha={fecha}
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
        onNavigateToRef={(refId, tipo) => {
          setDetailModalOpen(false);
          handleNavigateToRef(refId, tipo);
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
        fecha={fecha}
      />

      {/* MODAL 3: Referenced Task Deep Inspection & Navigation */}
      <ActividadReferenciaModal
        isOpen={refModalOpen}
        onClose={() => setRefModalOpen(false)}
        refId={selectedRefId}
        tipoVinculo={selectedRefVinculo}
        onNavigateToDate={handleNavigateToDateAndHighlight}
      />
    </div>
  );
};

