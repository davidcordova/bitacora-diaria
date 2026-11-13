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
  Play,
  Square,
  Check,
  X,
} from 'lucide-react';
import { Actividad, EstadoActividad, User, Evidencia } from '../types';
import { formatDuration, calculateHoraFin, getTodayLocalDateStr, shiftDateByDays, stripHtml } from '../utils/formatters';
import { TIPOS_TRABAJO } from '../utils/initialData';
import { api } from '../services/api';
import { ActividadModal } from './ActividadModal';
import { ActividadDetalleModal } from './ActividadDetalleModal';
import { ActividadReferenciaModal } from './ActividadReferenciaModal';
import { RichHtmlRenderer } from './RichHtmlRenderer';
import { RevisionBadge } from './RevisionModal';


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
  const [quickCliente, setQuickCliente] = useState<string>('');
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
  const [recentFeedback, setRecentFeedback] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState<boolean>(false);

  // Cargar sugerencias normalizadas de clientes una sola vez al montar (las nuevas se fusionan con useMemo)
  useEffect(() => {
    let mounted = true;
    api.getClientesSugerencias().then((list) => {
      if (mounted && list.length > 0) setClientSuggestions(list);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const mergedClientSuggestions = useMemo(() => {
    const map = new Map<string, string>();
    clientSuggestions.forEach((c) => {
      const clean = c.trim();
      if (clean) map.set(clean.toLowerCase(), clean);
    });
    actividades.forEach((a) => {
      const clean = (a.para_cliente || '').trim();
      if (clean && !map.has(clean.toLowerCase())) {
        map.set(clean.toLowerCase(), clean);
      }
    });
    return Array.from(map.values());
  }, [clientSuggestions, actividades]);

  // Live Timer: se guarda el instante de inicio (no un contador) para que no se atrase
  // cuando el navegador frena la pestaña en segundo plano y para sobrevivir a recargas.
  const timerStorageKey = `bitacora_timer_${currentUser?.id ?? 'anon'}`;
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(() => {
    const saved = Number(localStorage.getItem(timerStorageKey));
    // Ignorar cronómetros olvidados de una jornada anterior (> 16 h)
    return Number.isFinite(saved) && saved > Date.now() - 16 * 3600 * 1000 ? saved : null;
  });
  const [timerNow, setTimerNow] = useState<number>(Date.now());
  const isTimerRunning = timerStartedAt !== null;
  const timerSeconds = isTimerRunning ? Math.max(0, Math.floor((timerNow - timerStartedAt) / 1000)) : 0;

  useEffect(() => {
    if (!isTimerRunning) return;
    setTimerNow(Date.now());
    const interval = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  // Reflejar el cronómetro activo en el título de la pestaña del navegador
  useEffect(() => {
    if (!isTimerRunning) return;
    const prevTitle = document.title;
    const m = Math.floor(timerSeconds / 60);
    const s = timerSeconds % 60;
    const clock = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    document.title = `⏱ ${clock} · ${quickDesc.trim() || 'Cronómetro Bitácora'}`;
    return () => {
      document.title = prevTitle;
    };
  }, [isTimerRunning, timerSeconds, quickDesc]);

  const handleCancelTimer = () => {
    localStorage.removeItem(timerStorageKey);
    setTimerStartedAt(null);
  };

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
    return dateStr === getTodayLocalDateStr();
  };

  const changeDayByOffset = (offset: number) => {
    if (!fecha || !onDateChange) return;
    onDateChange(shiftDateByDays(fecha, offset));
  };

  const goToToday = () => {
    if (!onDateChange) return;
    onDateChange(getTodayLocalDateStr());
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
      tipo: 'Capacitación / Reunión',
      cliente: 'Interno TI',
      duracion: 15,
    },
    {
      id: 'backups',
      icon: ShieldCheck,
      label: 'Monitoreo & Backups',
      tipo: 'Mantenimiento',
      cliente: 'Infraestructura TI',
      duracion: 30,
    },
    {
      id: 'deploy',
      icon: Rocket,
      label: 'Deploy / Pase a Prod',
      tipo: 'Desarrollo',
      cliente: 'Producción',
      duracion: 45,
    },
    {
      id: 'ticket',
      icon: Zap,
      label: 'Soporte a Usuario',
      tipo: 'Soporte técnico',
      cliente: 'Mesa de Ayuda',
      duracion: 20,
    },
  ];

  // Hora de inicio encadenada: la hora de fin MÁS TARDÍA del día (no la del último
  // elemento del arreglo, que puede estar desordenado por ediciones o arrastres).
  const getNextStartTime = () => {
    let latest = '';
    for (const a of actividades) {
      let fin = a.hora_fin && a.hora_fin !== '--:--' ? a.hora_fin : '';
      if (!fin && a.hora_inicio && a.duracion_min) {
        const calculated = calculateHoraFin(a.hora_inicio, a.duracion_min, fecha);
        if (calculated && calculated !== '--:--') fin = calculated;
      }
      if (fin && fin > latest) latest = fin;
    }
    return latest || horaInicio || '08:30';
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

  const toHHMM = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  const handleStartTimer = () => {
    const now = Date.now();
    localStorage.setItem(timerStorageKey, String(now));
    setTimerStartedAt(now);
    setTimerNow(now);
  };

  const handleStopTimer = () => {
    if (timerStartedAt === null) return;
    const endMs = Date.now();
    const durationMin = Math.max(1, Math.round((endMs - timerStartedAt) / 60000));

    onAddActividad({
      hora_inicio: toHHMM(new Date(timerStartedAt)),
      hora_fin: toHHMM(new Date(endMs)),
      duracion_min: durationMin,
      tipo_trabajo: quickTipo || 'Soporte técnico',
      para_cliente: quickCliente || 'Interno TI',
      descripcion: quickDesc.trim() || 'Actividad registrada con cronómetro en vivo',
      estado: 'completada',
    });

    localStorage.removeItem(timerStorageKey);
    setTimerStartedAt(null);
    setQuickDesc('');
    setRecentFeedback(`¡Cronómetro finalizado: ${durationMin} min registrados!`);
    setTimeout(() => setRecentFeedback(null), 3500);
  };

  const formatTimerClock = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return h > 0 ? `${h}:${mmss}` : mmss;
  };

  // Atajos de teclado para desarrolladores (N, Esc, Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const activeTag = (activeEl?.tagName || '').toUpperCase();
      const isInputActive =
        activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT' || !!activeEl?.isContentEditable;

      // 'N' abre modal de nueva actividad si no se está escribiendo
      if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey && !e.altKey && !isInputActive && !createModalOpen && !detailModalOpen && !refModalOpen) {
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

  const getStatusBadge = (estado: EstadoActividad) => {
    switch (estado) {
      case 'completada':
        return {
          bg: 'bg-emerald-50/90 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
          label: 'Completada',
        };
      case 'en_proceso':
        return {
          bg: 'bg-sky-50/90 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/25',
          label: 'En proceso',
        };
      case 'en_revision':
        return {
          bg: 'bg-amber-50/90 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
          label: 'En revisión',
        };
      case 'pendiente':
      default:
        return {
          bg: 'bg-slate-100/80 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border-slate-200/90 dark:border-white/10',
          label: 'Por iniciar',
        };
    }
  };

  return (
    <div className="bg-white dark:bg-[#161922] rounded-xl border border-slate-200/80 dark:border-white/[0.07] shadow-2xs overflow-hidden">
      {/* 1. CLEAN UNIFIED HEADER BAR */}
      <div className="px-4 sm:px-5 py-3 border-b border-slate-200/70 dark:border-white/[0.06] flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Left: Date Navigator + Start Time + Connection Alert */}
        <div className="flex flex-wrap items-center gap-2.5">
          {fecha && onDateChange && (
            <div className="inline-flex items-center bg-slate-50 dark:bg-[#1E222D] p-0.5 rounded-lg border border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => changeDayByOffset(-1)}
                title="Día anterior"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
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
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-white/[0.05] rounded-md cursor-pointer transition-colors"
                  title="Seleccionar fecha en el calendario"
                >
                  <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-400 shrink-0" />
                  <span>{formatHeaderDate(fecha)}</span>
                </button>

                {!isToday(fecha) && (
                  <button
                    type="button"
                    onClick={goToToday}
                    className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline px-2 py-0.5 cursor-pointer"
                    title="Volver a la fecha de hoy"
                  >
                    Ir a hoy
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
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Subtle Referential Start Time */}
          <div
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-[#1E222D] border border-slate-200/80 dark:border-white/[0.08]"
            title="Hora referencial de inicio de la jornada"
          >
            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Inicio</span>
            {onHoraInicioChange ? (
              <input
                type="time"
                value={horaInicio || '08:30'}
                onChange={(e) => onHoraInicioChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer w-14 tabular-nums"
                title="Ajustar hora referencial de inicio"
              />
            ) : (
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                {horaInicio || '08:30'}
              </span>
            )}
          </div>

          {autoSaveStatus === 'error' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={onForceSyncCloud}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/25 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Hubo un problema de conexión al guardar. Clic para reintentar ahora"
              >
                <CloudOff className="w-3.5 h-3.5 text-rose-500" />
                <span>Reintentar guardado</span>
              </button>
              {onOpenErrorReport && (
                <button
                  type="button"
                  onClick={onOpenErrorReport}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25 cursor-pointer"
                >
                  <span>Ver detalle</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Quiet Inline Progress + Primary Action */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4">
          {actividades.length > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 tabular-nums">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatDuration(totalMinutos)}
                </span>
                <span className="text-slate-400 dark:text-slate-500">/ 8h</span>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {completadasCount} de {actividades.length} completadas
                </span>
              </div>
              <div
                className="hidden sm:block w-24 bg-slate-100 dark:bg-white/[0.08] h-1.5 rounded-full overflow-hidden"
                title={`${porcentajeJornada}% de la meta diaria de 8 horas`}
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    porcentajeJornada >= 100 ? 'bg-emerald-500' : 'bg-sky-600 dark:bg-sky-500'
                  }`}
                  style={{ width: `${porcentajeJornada}%` }}
                />
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer min-h-[34px]"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nueva actividad</span>
          </button>
        </div>
      </div>

      {/* 2. CLEAN SINGLE-ROW QUICK ENTRY BAR (Zero Input Overlap) */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-50/70 dark:bg-[#1A1E29]/60 border-b border-slate-200/70 dark:border-white/[0.06] space-y-2">
        <form onSubmit={handleQuickAddSubmit} className="flex flex-col xl:flex-row items-stretch xl:items-center gap-2">
          <input
            type="text"
            value={quickDesc}
            onChange={(e) => setQuickDesc(e.target.value)}
            placeholder="Registrar actividad rápida... (Enter para agregar, N para formulario completo)"
            className="flex-1 min-w-0 px-3 py-1.5 text-xs sm:text-[13px] bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200/90 dark:border-white/[0.08] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 outline-hidden transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 min-h-[34px]"
          />

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5">
            <select
              value={quickDuration}
              onChange={(e) => setQuickDuration(Number(e.target.value))}
              aria-label="Duración rápida"
              title="Duración estimada"
              className="w-full sm:w-auto text-xs font-medium px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E222D] text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-white/[0.08] focus:outline-none focus:border-sky-500 cursor-pointer min-h-[34px] tabular-nums"
            >
              <option value={15}>15 min</option>
              <option value={30}>30 min</option>
              <option value={45}>45 min</option>
              <option value={60}>1 h</option>
              <option value={90}>1h 30m</option>
              <option value={120}>2 h</option>
              <option value={180}>3 h</option>
              <option value={240}>4 h</option>
            </select>

            <input
              type="text"
              list="quick-clientes-datalist"
              value={quickCliente}
              onChange={(e) => setQuickCliente(e.target.value)}
              placeholder="Cliente / Área"
              className="w-full sm:w-36 text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E222D] text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-white/[0.08] focus:outline-none focus:border-sky-500 min-h-[34px] placeholder:text-slate-400 min-w-0"
              title="Cliente o área (opcional)"
            />
            <datalist id="quick-clientes-datalist">
              {mergedClientSuggestions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>

            <select
              value={quickTipo}
              onChange={(e) => setQuickTipo(e.target.value)}
              aria-label="Tipo de trabajo para registro rápido"
              className="col-span-2 sm:col-span-1 w-full sm:w-40 text-xs px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E222D] text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-white/[0.08] focus:outline-none focus:border-sky-500 cursor-pointer min-h-[34px]"
            >
              {TIPOS_TRABAJO.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-1.5">
              <button
                type="submit"
                disabled={!quickDesc.trim()}
                className="flex-1 sm:flex-initial px-3 py-1.5 bg-slate-800 hover:bg-slate-900 dark:bg-sky-600 dark:hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 min-h-[34px]"
              >
                Agregar
              </button>

              {/* Live Timer */}
              {!isTimerRunning ? (
                <button
                  type="button"
                  onClick={handleStartTimer}
                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-[#1E222D] text-slate-600 dark:text-slate-300 border border-slate-200/90 dark:border-white/[0.08] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer min-h-[34px] shrink-0"
                  title="Iniciar cronómetro en vivo"
                >
                  <Play className="w-3 h-3 text-slate-500 dark:text-slate-400 fill-current" />
                  <span className="hidden sm:inline">Cronómetro</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/25 min-h-[34px] shrink-0">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="font-mono tabular-nums">{formatTimerClock(timerSeconds)}</span>
                  <button
                    type="button"
                    onClick={handleStopTimer}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600 text-white text-[11px] font-semibold hover:bg-rose-500 cursor-pointer"
                    title="Detener cronómetro y registrar actividad"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" />
                    <span>Guardar</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelTimer}
                    className="p-0.5 text-rose-400 hover:text-rose-700 dark:hover:text-rose-200 cursor-pointer"
                    title="Descartar cronómetro"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Quiet Presets Toggle */}
              <button
                type="button"
                onClick={() => setShowPresets((prev) => !prev)}
                className={`inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer min-h-[34px] shrink-0 ${
                  showPresets
                    ? 'bg-slate-200/80 dark:bg-white/10 text-slate-800 dark:text-white border-slate-300 dark:border-white/15'
                    : 'bg-white dark:bg-[#1E222D] text-slate-500 dark:text-slate-400 border-slate-200/90 dark:border-white/[0.08] hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="Plantillas rápidas de 1 clic"
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Plantillas</span>
              </button>
            </div>
          </div>
        </form>

        {/* Collapsible Presets Row (Only shown when explicitly toggled) */}
        {showPresets && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {IT_PRESETS.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-[#1E222D] hover:bg-slate-100 dark:hover:bg-white/[0.07] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] transition-colors cursor-pointer"
                  title={`Registrar "${preset.label}" (${preset.duracion} min)`}
                >
                  <Icon className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{preset.label}</span>
                  <span className="text-slate-400 text-[11px]">({preset.duracion}m)</span>
                </button>
              );
            })}
          </div>
        )}

        {recentFeedback && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-200/80 dark:border-emerald-500/20">
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>{recentFeedback}</span>
          </div>
        )}
      </div>

      {/* Empty State */}
      {actividades.length === 0 ? (
        <div className="text-center py-12 px-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-3">
            <ListChecks className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
            Sin actividades {isToday(fecha) ? 'hoy' : 'en esta fecha'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
            Escribe arriba para un registro rápido o abre el formulario para detallar horarios y evidencias.
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Nueva actividad</span>
          </button>
        </div>
      ) : (
        <>
          {/* DESKTOP CLEAN 6-COLUMN TABLE (Zero horizontal clipping on 1366px screens) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02] text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-40 whitespace-nowrap">Horario</th>
                  <th className="py-2.5 px-4">Actividad</th>
                  <th className="py-2.5 px-3 w-44 whitespace-nowrap">Cliente / Tipo</th>
                  <th className="py-2.5 px-3 w-36 whitespace-nowrap">Estado</th>
                  <th className="py-2.5 px-3 w-20 text-right whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05] text-xs text-slate-700 dark:text-slate-300">
                {actividades.map((act, index) => {
                  const statusConfig = getStatusBadge(act.estado);
                  const sharedNames = act.shared_with_names || [];
                  const hasShared = (act.shared_with && act.shared_with.length > 0) || sharedNames.length > 0;
                  const evidenceCount = act.evidencias?.length || 0;
                  const isUntimed =
                    (!act.hora_inicio || act.hora_inicio === '--:--') &&
                    (!act.duracion_min || act.duracion_min === 0);
                  const discountedMin = Number(act.minutos_descontados) || 0;
                  const grossMin = Number(act.duracion_bruta_min) || Number(act.duracion_min) || 0;
                  const hasChildLinks =
                    act.id !== undefined && act.id !== null && childTasksMap.has(Number(act.id));
                  const hasMetaRow =
                    Boolean(act.parent_task_id) ||
                    hasChildLinks ||
                    hasShared ||
                    evidenceCount > 0 ||
                    Boolean(act.comentarios) ||
                    Boolean(act.created_by_name);

                  return (
                    <tr
                      key={act.id || `act-${index}`}
                      id={act.id ? `act-row-${act.id}` : undefined}
                      onClick={() => handleOpenDetailModal(act, index)}
                      className={`group hover:bg-slate-50/80 dark:hover:bg-white/[0.025] transition-colors cursor-pointer ${
                        highlightedActId === act.id ? 'act-highlighted bg-sky-50/60 dark:bg-sky-500/10' : ''
                      }`}
                    >
                      {/* # */}
                      <td className="py-3 px-3 text-center align-top">
                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                          {index + 1}
                        </span>
                      </td>

                      {/* Horario & Duración Neta */}
                      <td className="py-3 px-3 whitespace-nowrap align-top">
                        {isUntimed ? (
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 dark:text-slate-500">Sin horario</span>
                            {(act.parent_task_id || act.is_rollover) && (
                              <span className="text-[11px] text-slate-400/80 dark:text-slate-500">
                                Pendiente previa
                              </span>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5 tabular-nums">
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                              <span>{act.hora_inicio || '--:--'}</span>
                              <span className="text-slate-400 dark:text-slate-500 mx-1">–</span>
                              <span>
                                {act.hora_fin || calculateHoraFin(act.hora_inicio, act.duracion_min, fecha) || '--:--'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-semibold text-slate-500 dark:text-slate-400">
                                {formatDuration(act.duracion_min)}
                              </span>
                              {discountedMin > 0 && (
                                <span
                                  className="text-[10px] font-medium text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-1.5 py-0.2 rounded"
                                  title={`Ventana total: ${formatDuration(grossMin)}. Se descontaron automáticamente ${formatDuration(discountedMin)} ocupados por actividades realizadas dentro de este rango.`}
                                >
                                  −{formatDuration(discountedMin)} int.
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Actividad (Descripción limpia + metadatos discretos solo cuando existen) */}
                      <td className="py-3 px-4 align-top w-full max-w-0">
                        <div className="flex flex-col gap-1 min-w-0 overflow-hidden">
                          <RichHtmlRenderer
                            content={act.descripcion}
                            clampLines={2}
                            className="text-[13px] font-medium text-slate-800 dark:text-slate-100 leading-snug"
                          />

                          {hasMetaRow && (
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 min-w-0">
                              {act.parent_task_id && (
                                <button
                                  type="button"
                                  onClick={(e) => handleNavigateToRef(act.parent_task_id!, act.tipo_vinculo, e)}
                                  className="inline-flex items-center gap-1 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                                  title={
                                    act.parent_task_desc
                                      ? `Ver origen: ${stripHtml(act.parent_task_desc)}`
                                      : 'Ver actividad de origen'
                                  }
                                >
                                  <Link2 className="w-3 h-3" />
                                  <span>
                                    {act.tipo_vinculo && act.tipo_vinculo !== 'continuacion'
                                      ? 'Vinculada'
                                      : 'Continuación'}
                                  </span>
                                </button>
                              )}

                              {hasChildLinks && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const firstChild = childTasksMap.get(Number(act.id))![0];
                                    if (firstChild.id) handleNavigateToRef(firstChild.id, firstChild.tipo_vinculo, e);
                                  }}
                                  className="inline-flex items-center gap-1 hover:text-sky-600 dark:hover:text-sky-400 transition-colors cursor-pointer"
                                  title="Ir a la actividad vinculada"
                                >
                                  <GitBranch className="w-3 h-3" />
                                  <span>Seguimiento ({childTasksMap.get(Number(act.id))!.length})</span>
                                </button>
                              )}

                              {hasShared && (
                                <span
                                  className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"
                                  title={`Compartida con: ${sharedNames.join(', ')}`}
                                >
                                  <Users className="w-3 h-3" />
                                  <span className="truncate max-w-[160px]">
                                    {sharedNames.length > 0 ? sharedNames.join(', ') : `${act.shared_with?.length} colab.`}
                                  </span>
                                </span>
                              )}

                              {evidenceCount > 0 && (
                                <span
                                  className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"
                                  title={`${evidenceCount} archivo(s) adjunto(s)`}
                                >
                                  <Paperclip className="w-3 h-3" />
                                  <span>{evidenceCount} adj.</span>
                                </span>
                              )}

                              {act.comentarios && (
                                <span
                                  className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"
                                  title={`Nota: ${act.comentarios}`}
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>Nota</span>
                                </span>
                              )}

                              {act.created_by_name && (
                                <span
                                  className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"
                                  title={`Registrado en apoyo por ${act.created_by_name}`}
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Apoyo: {act.created_by_name.split(' ')[0]}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {(act.estado === 'en_revision' || act.revision_decision) && (
                            <div className="mt-1">
                              <RevisionBadge actividad={act} />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Cliente / Tipo limpio sin cajas redundantes */}
                      <td className="py-3 px-3 whitespace-nowrap align-top">
                        {act.para_cliente || act.tipo_trabajo ? (
                          <div className="flex flex-col gap-0.5">
                            {act.para_cliente && (
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[160px]">
                                {act.para_cliente}
                              </span>
                            )}
                            {act.tipo_trabajo && (
                              <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[160px]">
                                {act.tipo_trabajo}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-3 whitespace-nowrap align-top" onClick={(e) => e.stopPropagation()}>
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
                            className={`text-xs font-semibold pl-2.5 pr-6 py-1 rounded-lg border transition-colors cursor-pointer outline-hidden appearance-none ${statusConfig.bg}`}
                          >
                            <option value="pendiente" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">Por iniciar</option>
                            <option value="en_proceso" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">En proceso</option>
                            <option value="en_revision" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">En revisión</option>
                            <option value="completada" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">Completada</option>
                          </select>
                          <ChevronRight className="w-3 h-3 rotate-90 absolute right-2 pointer-events-none opacity-50" />
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-3 text-right whitespace-nowrap align-top" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(act, index)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-md transition-colors cursor-pointer"
                            title="Editar actividad"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onRemoveActividad(index)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                            title="Mover a papelera"
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

          {/* MOBILE / TABLET CLEAN LIST VIEW (< 1024px) */}
          <div className="lg:hidden divide-y divide-slate-100 dark:divide-white/[0.06]">
            {actividades.map((act, index) => {
              const statusConfig = getStatusBadge(act.estado);
              const sharedNames = act.shared_with_names || [];
              const hasShared = (act.shared_with && act.shared_with.length > 0) || sharedNames.length > 0;
              const evidenceCount = act.evidencias?.length || 0;
              const isUntimed =
                (!act.hora_inicio || act.hora_inicio === '--:--') &&
                (!act.duracion_min || act.duracion_min === 0);
              const discountedMin = Number(act.minutos_descontados) || 0;

              return (
                <div
                  key={act.id || `act-m-${index}`}
                  id={act.id ? `act-m-${act.id}` : undefined}
                  onClick={() => handleOpenDetailModal(act, index)}
                  className={`p-3.5 hover:bg-slate-50/80 dark:hover:bg-white/[0.025] transition-colors cursor-pointer ${
                    highlightedActId === act.id ? 'act-highlighted bg-sky-50/60 dark:bg-sky-500/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
                      <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                        #{index + 1}
                      </span>
                      {isUntimed ? (
                        <span className="text-slate-400 dark:text-slate-500">Sin horario</span>
                      ) : (
                        <>
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {act.hora_inicio || '--:--'} –{' '}
                            {act.hora_fin || calculateHoraFin(act.hora_inicio, act.duracion_min, fecha) || '--:--'}
                          </span>
                          <span className="font-semibold text-slate-500 dark:text-slate-400">
                            ({formatDuration(act.duracion_min)})
                          </span>
                          {discountedMin > 0 && (
                            <span className="text-[10px] font-medium text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-1.5 py-0.2 rounded">
                              −{formatDuration(discountedMin)} int.
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(act, index)}
                        className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-colors cursor-pointer"
                        title="Editar"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveActividad(index)}
                        className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mb-2 min-w-0 overflow-hidden">
                    <RichHtmlRenderer
                      content={act.descripcion}
                      clampLines={2}
                      className="text-[13px] font-medium text-slate-800 dark:text-slate-100 leading-snug"
                    />
                    {(act.estado === 'en_revision' || act.revision_decision) && (
                      <div className="mt-1">
                        <RevisionBadge actividad={act} />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
                      {act.para_cliente && (
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[130px]">
                          {act.para_cliente}
                        </span>
                      )}
                      {act.tipo_trabajo && (
                        <span className="text-slate-400 dark:text-slate-500">{act.tipo_trabajo}</span>
                      )}
                      {act.parent_task_id && (
                        <button
                          type="button"
                          onClick={(e) => handleNavigateToRef(act.parent_task_id!, act.tipo_vinculo, e)}
                          className="inline-flex items-center gap-0.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>Continuación</span>
                        </button>
                      )}
                      {hasShared && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{sharedNames[0] || 'Compartida'}</span>
                        </span>
                      )}
                      {evidenceCount > 0 && (
                        <span className="inline-flex items-center gap-0.5">
                          <Paperclip className="w-3 h-3" />
                          <span>{evidenceCount}</span>
                        </span>
                      )}
                    </div>

                    <div className="relative inline-flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
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
                        className={`text-[11px] font-semibold pl-2.5 pr-6 py-1 rounded-lg border transition-colors cursor-pointer outline-hidden appearance-none ${statusConfig.bg}`}
                      >
                        <option value="pendiente" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">Por iniciar</option>
                        <option value="en_proceso" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">En proceso</option>
                        <option value="en_revision" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">En revisión</option>
                        <option value="completada" className="bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200">Completada</option>
                      </select>
                      <ChevronRight className="w-3 h-3 rotate-90 absolute right-2 pointer-events-none opacity-50" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* MODAL 1: Detail Inspection Modal */}
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
        existingActividades={actividades}
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

