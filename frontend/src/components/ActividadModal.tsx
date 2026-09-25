import React, { useState, useEffect } from 'react';
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
}

export const ActividadModal: React.FC<ActividadModalProps> = ({
  isOpen,
  onClose,
  actividadToEdit,
  editIndex,
  onSave,
  users,
  currentUser,
}) => {
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [duracionMin, setDuracionMin] = useState<number>(30);
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
        setHoraInicio(actividadToEdit.hora_inicio || '08:00');
        setDuracionMin(Number(actividadToEdit.duracion_min) || 0);
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
        // Defaults for new activity
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0');
        setHoraInicio(`${hh}:${mm}`);
        setDuracionMin(30);
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
  }, [isOpen, actividadToEdit]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleSharedUser = (userId: number) => {
    setSharedWith((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAddMinutes = (extra: number) => {
    setDuracionMin((prev) => Math.max(0, (Number(prev) || 0) + extra));
  };

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

    const actividadResult: Actividad = {
      ...(actividadToEdit || {}),
      id: actividadToEdit?.id,
      hora_inicio: horaInicio,
      duracion_min: Number(duracionMin) || 0,
      tipo_trabajo: tipoTrabajo,
      descripcion: descripcion.trim(),
      para_cliente: paraCliente.trim(),
      estado,
      shared_with: sharedWith,
      evidencias,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-200 select-none">
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#13141F] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-[#252636] max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50/80 dark:bg-[#161722]/80 border-b border-slate-100 dark:border-[#252636] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editIndex !== null ? 'Editar Actividad' : 'Nueva Actividad'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Detalla el tiempo invertido, evidencias y asignación compartida en paralelo.
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

        {/* Modal Form with Scrollable Body & Sticky Footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Row 1: Time, Duration & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Hora Inicio */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Hora de Inicio
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#161722] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-[#252636] focus:bg-white dark:focus:bg-[#161722] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                />
                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Duración */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Duración (min)</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleAddMinutes(15)}
                    className="text-[10px] px-2 py-0.5 font-medium bg-slate-100 dark:bg-[#161722] border border-slate-200/60 dark:border-[#252636] hover:border-[#00F0FF]/40 text-slate-600 dark:text-slate-300 rounded-full transition-colors"
                  >
                    +15m
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddMinutes(30)}
                    className="text-[10px] px-2 py-0.5 font-medium bg-slate-100 dark:bg-[#161722] border border-slate-200/60 dark:border-[#252636] hover:border-[#00F0FF]/40 text-slate-600 dark:text-slate-300 rounded-full transition-colors"
                  >
                    +30m
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={duracionMin || ''}
                  onChange={(e) => setDuracionMin(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#161722] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-[#252636] focus:bg-white dark:focus:bg-[#161722] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                />
                <Timer className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            {/* Estado */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Estado</label>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoActividad)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-[#252636] focus:bg-white dark:focus:bg-[#161722] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
              >
                <option value="completada" className="bg-white dark:bg-[#161722]">Completada</option>
                <option value="en_proceso" className="bg-white dark:bg-[#161722]">En proceso</option>
                <option value="en_revision" className="bg-white dark:bg-[#161722]">En revisión</option>
                <option value="pendiente" className="bg-white dark:bg-[#161722]">Por iniciar</option>
              </select>
            </div>
          </div>

          {/* Row 2: Tipo de Trabajo, Para/Cliente & Trabajo en Paralelo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tipo de Trabajo
              </label>
              <div className="relative">
                <select
                  value={tipoTrabajo}
                  onChange={(e) => setTipoTrabajo(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#161722] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-[#252636] focus:bg-white dark:focus:bg-[#161722] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                >
                  {TIPOS_TRABAJO.map((tipo) => (
                    <option key={tipo} value={tipo} className="bg-white dark:bg-[#161722]">
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
                  value={paraCliente}
                  onChange={(e) => setParaCliente(e.target.value)}
                  placeholder="Ej: AlphaStudio, RRHH..."
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#161722] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-[#252636] focus:bg-white dark:focus:bg-[#161722] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                />
                <UserCheck className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Trabajar en paralelo con <span className="text-slate-400 dark:text-slate-500 font-normal">(opcional)</span>
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
                  className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#161722] text-xs font-medium text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200 dark:border-[#252636] focus:bg-white dark:focus:bg-[#161722] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all"
                >
                  <option value="" className="bg-white dark:bg-[#161722]">Solo yo (Individual)</option>
                  {availableCollaborators.map((u) => (
                    <option key={u.id} value={u.id} className="bg-white dark:bg-[#161722]">
                      {u.full_name}
                    </option>
                  ))}
                </select>
                <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400 absolute left-2.5 top-2.5 pointer-events-none" />
              </div>

              {/* Badges de colaboradores seleccionados */}
              {sharedWith.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {sharedWith.map((uid) => {
                    const u = users.find((x) => x.id === uid);
                    if (!u) return null;
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60"
                      >
                        <Users className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                        <span>{u.full_name}</span>
                        <button
                          type="button"
                          onClick={() => setSharedWith(sharedWith.filter((id) => id !== uid))}
                          className="hover:text-rose-600 text-indigo-400 cursor-pointer ml-0.5"
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
                      className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 bg-transparent cursor-pointer border-0 outline-none p-0"
                    >
                      <option value="">+ Sumar otro...</option>
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Descripción de la Actividad <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                Editor enriquecido HTML con formato y enlaces
              </span>
            </div>
            <HtmlEditor
              value={descripcion}
              onChange={(newHtml) => setDescripcion(newHtml)}
              placeholder="Describe lo realizado en esta actividad... (puedes dar formato en negrita, insertar viñetas, adjuntar enlaces o pegar imágenes aquí)"
              onAttachEvidence={(newEv) => {
                setEvidencias((prev) => [...prev, newEv]);
              }}
            />
          </div>

          {/* Row 4.5: Comentarios u Observaciones (Opcional) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-cyan-500" />
                <span>Comentarios</span>
                <span className="text-[10px] text-slate-400 font-normal">(Opcional)</span>
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Notas internas, observaciones o bloqueos</span>
            </div>
            <textarea
              rows={2}
              placeholder="Agrega notas o comentarios internos sobre esta actividad (ej: entregable enviado, esperando confirmación, etc.)..."
              value={comentarios}
              onChange={(e) => setComentarios(e.target.value)}
              className="w-full px-3.5 py-2 bg-slate-50 dark:bg-[#161722] text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 rounded-xl border border-slate-200 dark:border-[#252636] focus:bg-white dark:focus:bg-[#161722] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-none transition-all resize-none"
            />
          </div>

          {/* Row 4.8: Vincular / Referenciar Actividades */}
          <div className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-[#161722]/80 border border-slate-200/80 dark:border-[#252636] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-cyan-50 dark:bg-[#00F0FF]/10 text-cyan-600 dark:text-[#00F0FF] border border-[#00F0FF]/20">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Vincular / Referenciar Actividad
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Relaciona esta tarea con una actividad anterior (continuación, subtarea o bloqueo).
                  </p>
                </div>
              </div>

              {parentTaskId ? (
                <button
                  type="button"
                  onClick={() => {
                    setParentTaskId(null);
                    setParentTaskDesc('');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
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
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-cyan-600 dark:text-[#00F0FF] bg-cyan-500/10 hover:bg-cyan-500/20 border border-[#00F0FF]/30 rounded-xl transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Vincular con otra</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowLinkSelector(false)}
                  className="text-xs text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Si ya está vinculada, mostrar badge con info */}
            {parentTaskId ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-cyan-500/10 dark:bg-cyan-950/30 border border-cyan-500/30">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-cyan-500 text-slate-950 shrink-0">
                    {tipoVinculo === 'continuacion'
                      ? 'Continuación de'
                      : tipoVinculo === 'subtarea'
                      ? 'Subtarea de'
                      : tipoVinculo === 'bloqueado_por'
                      ? 'Bloqueado por'
                      : 'Relacionada con'}
                  </span>
                  <span className="text-xs font-medium text-slate-800 dark:text-cyan-200 truncate">
                    Ref #{parentTaskId}: {parentTaskDesc || 'Actividad previa vinculada'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <select
                    value={tipoVinculo}
                    onChange={(e) => setTipoVinculo(e.target.value)}
                    className="text-[11px] font-semibold bg-white dark:bg-[#13141F] text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1 border border-cyan-500/40 focus:outline-none cursor-pointer"
                  >
                    <option value="continuacion">Continuación de</option>
                    <option value="subtarea">Subtarea de</option>
                    <option value="bloqueado_por">Bloqueado por</option>
                    <option value="relacionada">Relacionada con</option>
                  </select>
                </div>
              </div>
            ) : showLinkSelector && (
              <div className="space-y-2 pt-2 border-t border-slate-200/60 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <select
                    value={tipoVinculo}
                    onChange={(e) => setTipoVinculo(e.target.value)}
                    className="text-xs font-medium bg-white dark:bg-[#181926] text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 border border-slate-200 dark:border-white/10 focus:border-[#00F0FF] focus:outline-none"
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
                      className="w-full bg-white dark:bg-[#181926] text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 rounded-xl pl-8 pr-3 py-1.5 border border-slate-200 dark:border-white/10 focus:border-[#00F0FF] focus:outline-none"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2 pointer-events-none" />
                  </div>
                </div>

                {/* Lista de sugerencias de actividades */}
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
                          className="w-full text-left p-2 rounded-xl bg-white dark:bg-[#181926] hover:bg-cyan-50 dark:hover:bg-cyan-950/30 border border-slate-200/60 dark:border-white/5 hover:border-[#00F0FF]/40 transition-colors flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                              <span className="text-cyan-600 dark:text-[#00F0FF]">#{ref.id}</span>
                              <span className="text-slate-400">({ref.bitacora_fecha || 'Reciente'})</span>
                              {ref.para_cliente && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                  {ref.para_cliente}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {cleanDesc || 'Sin descripción'}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-cyan-600 dark:text-[#00F0FF] shrink-0">
                            Vincular →
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Row 5: Evidencias Adjuntas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Evidencias Adjuntas ({evidencias.length})
            </label>
            <EvidenceDropzone
              evidencias={evidencias}
              onChange={(newEv) => setEvidencias(newEv)}
              compact={false}
            />
          </div>
          </div>

          {/* Sticky Modal Footer */}
          <div className="shrink-0 px-6 py-3.5 border-t border-slate-100 dark:border-[#252636] bg-slate-50/90 dark:bg-[#161722]/90 backdrop-blur-md flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#1A1C29] rounded-full transition-colors cursor-pointer min-h-[40px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-6 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 rounded-full shadow-sm shadow-[#00F0FF]/25 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all cursor-pointer min-h-[40px]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{editIndex !== null ? 'Actualizar Actividad' : 'Guardar Actividad'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
