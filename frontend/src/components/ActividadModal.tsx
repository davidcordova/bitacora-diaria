import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clock,
  Briefcase,
  UserCheck,
  CheckCircle2,
  Timer,
  Eye,
  ListTodo,
  Users,
  Paperclip,
  Sparkles,
  AlertCircle,
  Plus,
  MessageSquare,
  Link2,
  Unlink,
  Search,
  GitBranch,
} from 'lucide-react';
import { Actividad, EstadoActividad, User, Evidencia, ActividadReferencia } from '../types';
import { TIPOS_TRABAJO } from '../utils/initialData';
import {
  calculateHoraFin,
  calculateDuracionMin,
  getCurrentTimeStr,
  getCurrentRoundedTimeStr,
  getRefrigerioMinutos,
  previewCandidateOverlap,
  formatDuration,
} from '../utils/formatters';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { EvidenceDropzone } from './EvidenceDropzone';
import { HtmlEditor } from './HtmlEditor';
import { api } from '../services/api';


interface ActividadModalProps {
  isOpen: boolean;
  onClose: () => void;
  actividadToEdit: Actividad | null;
  editIndex: number | null;
  onSave: (actividad: Actividad, editIndex: number | null) => void;
  users: User[];
  currentUser: User | null;
  fecha?: string;
  existingActividades?: Actividad[];
}

export const ActividadModal: React.FC<ActividadModalProps> = ({
  isOpen,
  onClose,
  actividadToEdit,
  editIndex,
  onSave,
  users,
  currentUser,
  fecha,
  existingActividades = [],
}) => {
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [duracionMin, setDuracionMin] = useState<number>(30);
  const [horaFin, setHoraFin] = useState('08:30');
  const [tipoTrabajo, setTipoTrabajo] = useState('Desarrollo');
  const [descripcion, setDescripcion] = useState('');
  const [paraCliente, setParaCliente] = useState('');
  const [estado, setEstado] = useState<EstadoActividad>('completada');
  const [sharedWith, setSharedWith] = useState<number[]>([]);
  const [evidencias, setEvidencias] = useState<Evidencia[]>([]);
  const [comentarios, setComentarios] = useState('');
  const [parentTaskId, setParentTaskId] = useState<number | null>(null);
  const [parentTaskDesc, setParentTaskDesc] = useState<string>('');
  const [tipoVinculo, setTipoVinculo] = useState<string>('continuacion');
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [referencias, setReferencias] = useState<ActividadReferencia[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [refSearch, setRefSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    api.getClientesSugerencias().then((list) => {
      if (mounted) setClientSuggestions(list);
    });
    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const loadReferencias = async (query = '') => {
    try {
      setLoadingRefs(true);
      const list = await api.getActividadesReferencias(currentUser?.id, currentUser?.full_name, query);
      const filtered = actividadToEdit?.id ? list.filter((a) => a.id !== Number(actividadToEdit.id)) : list;
      setReferencias(filtered);
    } catch (err) {
      console.error('Error fetching referencias:', err);
    } finally {
      setLoadingRefs(false);
    }
  };

  // Sync form state when modal opens or actividadToEdit changes
  useEffect(() => {
    if (isOpen) {
      if (actividadToEdit) {
        const rawIni = (actividadToEdit.hora_inicio || '').trim();
        const rawFin = (actividadToEdit.hora_fin || '').trim();
        const rawDur = Number(actividadToEdit.duracion_min) || 0;
        const isUntimed = (!rawIni || rawIni === '--:--') && (!rawFin || rawFin === '--:--') && rawDur === 0;

        if (isUntimed) {
          setHoraInicio('');
          setDuracionMin(0);
          setHoraFin('');
        } else {
          const hIni = rawIni && rawIni !== '--:--' ? rawIni : getCurrentRoundedTimeStr(5);
          const hFin =
            rawFin && rawFin !== '--:--'
              ? rawFin
              : calculateHoraFin(hIni, rawDur, fecha);
          const windowDur = hIni && hFin ? calculateDuracionMin(hIni, hFin, fecha) : rawDur;
          setHoraInicio(hIni);
          setDuracionMin(windowDur);
          setHoraFin(hFin);
        }
        setTipoTrabajo(actividadToEdit.tipo_trabajo || 'Desarrollo');
        setDescripcion(actividadToEdit.descripcion || '');
        setParaCliente(actividadToEdit.para_cliente || '');
        setEstado(actividadToEdit.estado || 'completada');
        setSharedWith(actividadToEdit.shared_with || []);
        setEvidencias(actividadToEdit.evidencias || []);
        setComentarios(actividadToEdit.comentarios || '');
        setParentTaskId(actividadToEdit.parent_task_id ? Number(actividadToEdit.parent_task_id) : null);
        setParentTaskDesc(actividadToEdit.parent_task_desc || '');
        setTipoVinculo(actividadToEdit.tipo_vinculo || 'continuacion');
      } else {
        // Defaults for new activity (hora actual en Perú redondeada a 5 min)
        const hIni = getCurrentRoundedTimeStr(5);
        setHoraInicio(hIni);
        setDuracionMin(30);
        setHoraFin(calculateHoraFin(hIni, 30, fecha));
        setTipoTrabajo('Desarrollo');
        setDescripcion('');
        setParaCliente('');
        setEstado('completada');
        setSharedWith([]);
        setEvidencias([]);
        setComentarios('');
        setParentTaskId(null);
        setParentTaskDesc('');
        setTipoVinculo('continuacion');
      }
      setShowLinkSelector(false);
      setRefSearch('');
      setErrorMsg(null);
    }
  }, [isOpen, actividadToEdit, fecha]);

  // Bloqueo de scroll del body y cierre por tecla Escape
  useModalBehavior(isOpen, onClose);

  // Atajo Ctrl+Enter / Cmd+Enter para envío rápido
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && isOpen) {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Interceptar Ctrl+V global en el modal para capturas de pantalla (solo fuera de campos de texto y del editor)
  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.closest('[contenteditable="true"]') ||
          target.closest('.prose') ||
          target.closest('.html-editor'))
      ) {
        // Dejar que el editor correspondiente o campo maneje el pegado sin duplicar en evidencias
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            try {
              const uploaded = await api.uploadFile(file);
              setEvidencias((prev) => [...prev, uploaded]);
            } catch (err) {
              console.error('Error al subir captura pegada:', err);
            }
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleSharedUser = (userId: number) => {
    setSharedWith((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleHoraInicioChange = (val: string) => {
    setHoraInicio(val);
    if (!val) {
      setHoraFin('');
      setDuracionMin(0);
    } else if (duracionMin > 0) {
      setHoraFin(calculateHoraFin(val, duracionMin, fecha));
    } else if (horaFin) {
      setDuracionMin(calculateDuracionMin(val, horaFin, fecha));
    } else {
      setDuracionMin(30);
      setHoraFin(calculateHoraFin(val, 30, fecha));
    }
  };

  const handleDuracionChange = (val: number) => {
    const mins = Math.max(0, val || 0);
    setDuracionMin(mins);
    if (mins > 0 && !horaInicio) {
      const hIni = getCurrentRoundedTimeStr(5);
      setHoraInicio(hIni);
      setHoraFin(calculateHoraFin(hIni, mins, fecha));
    } else if (horaInicio) {
      setHoraFin(calculateHoraFin(horaInicio, mins, fecha));
    }
  };

  const handleHoraFinChange = (val: string) => {
    setHoraFin(val);
    if (horaInicio && val) {
      const calculatedMins = calculateDuracionMin(horaInicio, val, fecha);
      setDuracionMin(calculatedMins);
    } else if (!horaInicio && val) {
      setHoraInicio(val);
      setDuracionMin(0);
    }
  };

  const handleSetHoraFinNow = () => {
    const nowStr = getCurrentTimeStr();
    const effectiveStart = horaInicio || getCurrentRoundedTimeStr(5);
    if (!horaInicio) setHoraInicio(effectiveStart);
    setHoraFin(nowStr);
    const calculatedMins = calculateDuracionMin(effectiveStart, nowStr, fecha);
    setDuracionMin(calculatedMins);
  };

  const handleAddMinutes = (extra: number) => {
    const nextDur = Math.max(0, (Number(duracionMin) || 0) + extra);
    setDuracionMin(nextDur);
    const effectiveStart = horaInicio || getCurrentRoundedTimeStr(5);
    if (!horaInicio) setHoraInicio(effectiveStart);
    setHoraFin(calculateHoraFin(effectiveStart, nextDur, fecha));
  };

  const otherActividades = (existingActividades || []).filter(
    (_, idx) => editIndex === null || idx !== editIndex
  );
  const resolvedHoraFin =
    horaInicio && (horaFin || duracionMin > 0)
      ? horaFin || calculateHoraFin(horaInicio, Number(duracionMin) || 0, fecha)
      : '';
  const overlapPreview =
    horaInicio && resolvedHoraFin
      ? previewCandidateOverlap(horaInicio, resolvedHoraFin, otherActividades, actividadToEdit?.id, fecha)
      : { grossMin: 0, netMin: 0, subtractedFromSelf: 0, subtractedFromContainers: 0 };

  // Interceptar Ctrl+V para capturas en el textarea de descripción
  const handlePasteInDescription = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const blob = items[i].getAsFile();
        if (!blob) continue;

        try {
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64 = event.target?.result as string;
            if (base64) {
              const uploaded = await api.uploadBase64(base64, `captura_${Date.now()}.png`);
              setEvidencias((prev) => [...prev, uploaded]);
            }
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.error('Error al pegar captura en modal:', err);
        }
        break;
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const plainText = descripcion.replace(/<[^>]*>/g, '').trim();
    if (!plainText && !/<img\s+[^>]*src=/i.test(descripcion)) {
      setErrorMsg('La descripción de la actividad es obligatoria.');
      return;
    }

    // Filtrar evidencias para que no incluyan archivos o imágenes ya embebidos en el HTML de descripción
    const cleanEvidencias = (evidencias || []).filter((ev, index, self) => {
      if (!ev || !ev.url) return false;
      const isFirst = self.findIndex((o) => (o.id && o.id === ev.id) || o.url === ev.url) === index;
      if (!isFirst) return false;

      const url = ev.url.trim();
      const filename = url.split('/').pop()?.split('?')[0] || '';
      if (url && descripcion.includes(url)) return false;
      if (filename && descripcion.includes(filename)) return false;

      const tsMatch = filename.match(/^(\d{8}_\d{6})/);
      if (tsMatch && descripcion.includes(tsMatch[1])) return false;

      return true;
    });

    const isUntimedSave = !horaInicio;
    const effectiveNetDur = isUntimedSave
      ? 0
      : overlapPreview.grossMin > 0
      ? overlapPreview.netMin
      : Number(duracionMin) || 0;

    const actividadResult: Actividad = {
      ...(actividadToEdit || {}),
      id: actividadToEdit?.id,
      hora_inicio: isUntimedSave ? '' : horaInicio,
      hora_fin: isUntimedSave ? '' : resolvedHoraFin,
      duracion_min: effectiveNetDur,
      duracion_bruta_min: isUntimedSave ? 0 : overlapPreview.grossMin || effectiveNetDur,
      minutos_descontados: isUntimedSave ? 0 : overlapPreview.subtractedFromSelf,
      tipo_trabajo: tipoTrabajo,
      descripcion: descripcion.trim(),
      para_cliente: paraCliente.trim(),
      estado,
      shared_with: sharedWith,
      evidencias: cleanEvidencias,
      shared_uuid: actividadToEdit?.shared_uuid,
      comentarios: comentarios.trim() || undefined,
      parent_task_id: parentTaskId || null,
      parent_task_desc: parentTaskDesc || undefined,
      tipo_vinculo: tipoVinculo,
    };

    onSave(actividadResult, editIndex);
    onClose();
  };

  // Available collaborators to share with (exclude current user)
  const availableCollaborators = users.filter(
    (u) => u.id !== currentUser?.id && u.is_active !== false
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs animate-in fade-in duration-150 select-none overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#161922] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-white/10 max-h-[calc(100dvh-1rem)] sm:max-h-[92dvh] my-auto flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-50/70 dark:bg-[#1A1E29] border-b border-slate-200/80 dark:border-white/[0.07] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/70 dark:border-sky-500/20 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              {editIndex !== null ? 'Editar Actividad' : 'Nueva Actividad'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer shrink-0"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form with Scrollable Body & Sticky Footer */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Row 1: Smart Time Engine (Inicio, Duración de Ventana, Fin) & Estado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* Hora Inicio */}
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-1.5 gap-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                    Hora de Inicio
                  </label>
                  {horaInicio && (
                    <button
                      type="button"
                      onClick={() => handleHoraInicioChange('')}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                      title="Dejar sin horario asignado"
                    >
                      Sin hora
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => handleHoraInicioChange(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-[#1E222D] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 outline-hidden transition-all tabular-nums"
                  />
                  <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Duración */}
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-1.5 min-w-0">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                    Duración
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={duracionMin || ''}
                    onChange={(e) => handleDuracionChange(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full pl-8 pr-11 py-2 bg-slate-50 dark:bg-[#1E222D] text-xs font-semibold text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-[#1E222D] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 outline-hidden transition-all tabular-nums"
                  />
                  <Timer className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
                  <span className="absolute right-3 top-2 text-[11px] font-medium text-slate-400 dark:text-slate-500 pointer-events-none">
                    min
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1 mt-1.5">
                  {[
                    { m: 15, label: '+15m' },
                    { m: 30, label: '+30m' },
                    { m: 45, label: '+45m' },
                    { m: 60, label: '+1h' },
                    { m: 120, label: '+2h' },
                  ].map((item) => (
                    <button
                      key={item.m}
                      type="button"
                      onClick={() => handleAddMinutes(item.m)}
                      className="py-1 text-[10px] font-medium bg-slate-100 dark:bg-[#1E222D] hover:bg-slate-200/80 dark:hover:bg-white/[0.08] border border-slate-200/80 dark:border-white/[0.08] text-slate-600 dark:text-slate-300 rounded-md transition-colors cursor-pointer text-center"
                      title={`Añadir ${item.label}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hora Fin */}
              <div className="min-w-0">
                <div className="flex items-center justify-between mb-1.5 min-w-0 gap-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                    Hora Fin
                  </label>
                  <button
                    type="button"
                    onClick={handleSetHoraFinNow}
                    className="text-[10px] px-1.5 py-0.2 font-semibold bg-slate-100 dark:bg-white/[0.06] hover:bg-sky-50 dark:hover:bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-slate-200 dark:border-white/10 rounded transition-colors cursor-pointer shrink-0"
                    title="Fijar la hora actual como Hora Fin"
                  >
                    Ahora
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="time"
                    value={horaFin}
                    onChange={(e) => handleHoraFinChange(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-[#1E222D] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 outline-hidden transition-all tabular-nums"
                  />
                  <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Estado */}
              <div className="min-w-0">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 truncate">
                  Estado
                </label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value as EstadoActividad)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-[#1E222D] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 outline-hidden transition-all cursor-pointer"
                >
                  <option value="completada" className="bg-white dark:bg-[#1E222D]">Completada</option>
                  <option value="en_proceso" className="bg-white dark:bg-[#1E222D]">En proceso</option>
                  <option value="en_revision" className="bg-white dark:bg-[#1E222D]">En revisión</option>
                  <option value="pendiente" className="bg-white dark:bg-[#1E222D]">Por iniciar</option>
                </select>
              </div>
            </div>

            {/* Live Smart Overlap Subtraction Feedback */}
            {(overlapPreview.subtractedFromSelf > 0 || overlapPreview.subtractedFromContainers > 0) && (
              <div className="p-3 rounded-xl bg-sky-50/80 dark:bg-sky-500/10 border border-sky-200/80 dark:border-sky-500/25 text-sky-900 dark:text-sky-200 text-xs space-y-1">
                {overlapPreview.subtractedFromSelf > 0 && (
                  <p>
                    <strong className="font-semibold">Tiempo neto efectivo: {formatDuration(overlapPreview.netMin)}</strong>{' '}
                    <span className="text-sky-800/90 dark:text-sky-300/90">
                      (de {formatDuration(overlapPreview.grossMin)} de ventana total; se descuentan{' '}
                      <strong>{formatDuration(overlapPreview.subtractedFromSelf)}</strong> ocupados por tareas internas registradas en este horario).
                    </span>
                  </p>
                )}
                {overlapPreview.subtractedFromContainers > 0 && (
                  <p className="text-sky-800/90 dark:text-sky-300/90">
                    Al guardar, se descontarán automáticamente{' '}
                    <strong className="font-semibold">{formatDuration(overlapPreview.subtractedFromContainers)}</strong>{' '}
                    de la actividad de mayor duración que abarca este rango horario.
                  </p>
                )}
              </div>
            )}

            {/* Banner de refrigerio si la tarea cruza 1:00 PM - 2:00 PM */}
            {horaInicio && horaFin && getRefrigerioMinutos(horaInicio, horaFin, fecha) > 0 && (
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 text-amber-800 dark:text-amber-300 text-xs">
                <span className="text-sm shrink-0">🍽️</span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">Refrigerio descontado (13:00 – 14:00):</span>{' '}
                  <span className="opacity-90">
                    Los {getRefrigerioMinutos(horaInicio, horaFin, fecha)} min de almuerzo no suman como horas efectivas de trabajo.
                  </span>
                </div>
              </div>
            )}

            {/* Row 2: Tipo de Trabajo, Para/Cliente & Trabajo en Paralelo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Tipo de Trabajo
                </label>
                <div className="relative">
                  <select
                    value={tipoTrabajo}
                    onChange={(e) => setTipoTrabajo(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-[#1E222D] focus:border-sky-500 outline-hidden transition-all"
                  >
                    {TIPOS_TRABAJO.map((tipo) => (
                      <option key={tipo} value={tipo} className="bg-white dark:bg-[#1E222D]">
                        {tipo}
                      </option>
                    ))}
                  </select>
                  <Briefcase className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Para / Cliente <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="modal-clientes-datalist"
                    value={paraCliente}
                    onChange={(e) => setParaCliente(e.target.value)}
                    placeholder="Ej: Gerencia, RRHH..."
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-[#1E222D] focus:border-sky-500 outline-hidden transition-all"
                  />
                  <datalist id="modal-clientes-datalist">
                    {clientSuggestions.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <UserCheck className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Colaboración <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
                </label>
                <div className="relative">
                  <select
                    value={sharedWith[0] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) {
                        setSharedWith([]);
                      } else {
                        const uid = Number(val);
                        if (!sharedWith.includes(uid)) {
                          setSharedWith([uid]);
                        }
                      }
                    }}
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-[#1E222D] focus:border-sky-500 outline-hidden transition-all"
                  >
                    <option value="" className="bg-white dark:bg-[#1E222D]">Individual</option>
                    {availableCollaborators.map((u) => (
                      <option key={u.id} value={u.id} className="bg-white dark:bg-[#1E222D]">
                        {u.full_name}
                      </option>
                    ))}
                  </select>
                  <Users className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
                </div>

                {sharedWith.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {sharedWith.map((uid) => {
                      const u = users.find((x) => x.id === uid);
                      if (!u) return null;
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                        >
                          <span>{u.full_name}</span>
                          <button
                            type="button"
                            onClick={() => setSharedWith(sharedWith.filter((id) => id !== uid))}
                            className="hover:text-rose-600 text-slate-400 cursor-pointer"
                            title="Quitar"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                    {availableCollaborators.length > sharedWith.length && (
                      <select
                        value=""
                        onChange={(e) => {
                          const extraUid = Number(e.target.value);
                          if (extraUid && !sharedWith.includes(extraUid)) {
                            setSharedWith([...sharedWith, extraUid]);
                          }
                        }}
                        className="text-[11px] font-medium text-sky-600 dark:text-sky-400 bg-transparent cursor-pointer border-0 outline-none p-0"
                      >
                        <option value="">+ Agregar otro</option>
                        {availableCollaborators
                          .filter((u) => !sharedWith.includes(u.id))
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.full_name}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Row 4: Descripción */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Descripción de la Actividad <span className="text-rose-500">*</span>
              </label>
              <HtmlEditor
                value={descripcion}
                onChange={(newHtml) => setDescripcion(newHtml)}
                placeholder="Describe lo realizado en esta actividad..."
              />
            </div>

            {/* Row 4.5: Comentarios u Observaciones (Opcional) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                <span>Comentarios</span>
                <span className="text-[11px] text-slate-400 font-normal">(opcional)</span>
              </label>
              <textarea
                rows={2}
                placeholder="Notas u observaciones internas..."
                value={comentarios}
                onChange={(e) => setComentarios(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-lg border border-slate-200 dark:border-white/10 focus:bg-white dark:focus:bg-[#1E222D] focus:border-sky-500 outline-none transition-all resize-none"
              />
            </div>

            {/* Row 4.8: Vincular / Referenciar Actividades */}
            <div className="p-3 rounded-xl bg-slate-50/70 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    Vincular con actividad previa
                  </span>
                </div>

                {parentTaskId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setParentTaskId(null);
                      setParentTaskDesc('');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
                    title="Desvincular actividad"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                    <span>Quitar vínculo</span>
                  </button>
                ) : !showLinkSelector ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowLinkSelector(true);
                      loadReferencias();
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-[#1E222D] hover:bg-slate-100 dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Vincular</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowLinkSelector(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {parentTaskId ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-white dark:bg-[#1E222D] border border-slate-200/80 dark:border-white/10">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 shrink-0">
                      {tipoVinculo === 'continuacion'
                        ? 'Continuación'
                        : tipoVinculo === 'subtarea'
                        ? 'Subtarea'
                        : tipoVinculo === 'bloqueado_por'
                        ? 'Bloqueado por'
                        : 'Relacionada'}
                    </span>
                    <span className="text-xs text-slate-700 dark:text-slate-200 truncate">
                      {parentTaskDesc || `Actividad previa #${parentTaskId}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <select
                      value={tipoVinculo}
                      onChange={(e) => setTipoVinculo(e.target.value)}
                      className="text-[11px] font-medium bg-slate-50 dark:bg-[#161922] text-slate-700 dark:text-slate-200 rounded-md px-2 py-1 border border-slate-200 dark:border-white/10 focus:outline-none cursor-pointer"
                    >
                      <option value="continuacion">Continuación de</option>
                      <option value="subtarea">Subtarea de</option>
                      <option value="bloqueado_por">Bloqueado por</option>
                      <option value="relacionada">Relacionada con</option>
                    </select>
                  </div>
                </div>
              ) : (
                showLinkSelector && (
                  <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <select
                        value={tipoVinculo}
                        onChange={(e) => setTipoVinculo(e.target.value)}
                        className="text-xs font-medium bg-white dark:bg-[#1E222D] text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-white/10 focus:border-sky-500 focus:outline-none"
                      >
                        <option value="continuacion">Continuación de</option>
                        <option value="subtarea">Subtarea de</option>
                        <option value="bloqueado_por">Bloqueado por</option>
                        <option value="relacionada">Relacionada con</option>
                      </select>

                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="Buscar actividad previa por texto o cliente..."
                          value={refSearch}
                          onChange={(e) => {
                            setRefSearch(e.target.value);
                            loadReferencias(e.target.value);
                          }}
                          className="w-full bg-white dark:bg-[#1E222D] text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 rounded-lg pl-8 pr-3 py-1.5 border border-slate-200 dark:border-white/10 focus:border-sky-500 focus:outline-none"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {loadingRefs ? (
                        <div className="text-center py-3 text-xs text-slate-400">Cargando actividades recientes...</div>
                      ) : referencias.length === 0 ? (
                        <div className="text-center py-3 text-xs text-slate-400">No se encontraron actividades para vincular</div>
                      ) : (
                        referencias.map((ref) => {
                          const cleanDesc = ref.descripcion.replace(/<[^>]*>/g, '').trim();
                          return (
                            <button
                              key={ref.id}
                              type="button"
                              onClick={() => {
                                setParentTaskId(ref.id);
                                setParentTaskDesc(cleanDesc);
                                setShowLinkSelector(false);
                              }}
                              className="w-full text-left p-2 rounded-lg bg-white dark:bg-[#1E222D] hover:bg-slate-50 dark:hover:bg-white/[0.06] border border-slate-200/70 dark:border-white/[0.08] transition-colors flex items-center justify-between gap-2 cursor-pointer"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                  <span className="text-slate-400">{ref.bitacora_fecha || 'Reciente'}</span>
                                  {ref.para_cliente && (
                                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300">
                                      {ref.para_cliente}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 truncate mt-0.5">
                                  {cleanDesc || 'Sin descripción'}
                                </p>
                              </div>
                              <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 shrink-0">
                                Vincular
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Row 5: Evidencias Adjuntas */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Evidencias Adjuntas {evidencias.length > 0 ? `(${evidencias.length})` : ''}
              </label>
              <EvidenceDropzone
                evidencias={evidencias}
                onChange={(newEv) => setEvidencias(newEv)}
                compact={false}
              />
            </div>
          </div>

          {/* Sticky Modal Footer */}
          <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-slate-200/80 dark:border-white/[0.07] bg-slate-50/80 dark:bg-[#1A1E29] flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer min-h-[36px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors cursor-pointer min-h-[36px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{editIndex !== null ? 'Guardar cambios' : 'Guardar actividad'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
