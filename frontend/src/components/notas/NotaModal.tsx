import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  StickyNote,
  Pin,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Link2,
  Unlink,
  ArrowRightCircle,
  Lock,
  Users,
  UserCheck,
  Calendar,
  Tag,
  Briefcase,
  Search,
  RefreshCw,
} from 'lucide-react';
import {
  Nota,
  TipoNota,
  VisibilidadNota,
  ColorAcentoNota,
  ChecklistItemNota,
  NotaVinculoActividad,
  ActividadReferencia,
  User,
} from '../../types';
import { api } from '../../services/api';
import { useModalBehavior } from '../../hooks/useModalBehavior';
import { HtmlEditor } from '../HtmlEditor';
import { formatDuration, stripHtml } from '../../utils/formatters';
import { ACCENT_COLORS, TIPOS_NOTA_CONFIG, VISIBILIDAD_LABELS } from './notaStyles';

interface NotaModalProps {
  isOpen: boolean;
  onClose: () => void;
  notaToEdit?: Nota | null;
  initialTemplate?: TipoNota;
  users: User[];
  currentUser: User | null;
  onSaved: (nota: Nota, isNew: boolean) => void;
  onConvertToActividad: (nota: Nota, checklistItem?: ChecklistItemNota) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const NotaModal: React.FC<NotaModalProps> = ({
  isOpen,
  onClose,
  notaToEdit,
  initialTemplate = 'apunte',
  users,
  currentUser,
  onSaved,
  onConvertToActividad,
  onShowToast,
}) => {
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [tipoNota, setTipoNota] = useState<TipoNota>('apunte');
  const [checklist, setChecklist] = useState<ChecklistItemNota[]>([]);
  const [newCheckText, setNewCheckText] = useState('');
  const [paraCliente, setParaCliente] = useState('');
  const [etiquetas, setEtiquetas] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [colorAcento, setColorAcento] = useState<ColorAcentoNota>('slate');
  const [visibilidad, setVisibilidad] = useState<VisibilidadNota>('personal');
  const [sharedWith, setSharedWith] = useState<number[]>([]);
  const [isPinned, setIsPinned] = useState(false);
  const [fechaRecordatorio, setFechaRecordatorio] = useState('');
  const [linkedActivities, setLinkedActivities] = useState<NotaVinculoActividad[]>([]);
  const [clientSuggestions, setClientSuggestions] = useState<string[]>([]);
  const [showActPicker, setShowActPicker] = useState(false);
  const [actRefs, setActRefs] = useState<ActividadReferencia[]>([]);
  const [actSearch, setActSearch] = useState('');
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [selectedInitialActIds, setSelectedInitialActIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useModalBehavior(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    api.getClientesSugerencias().then(setClientSuggestions).catch(() => {});

    if (notaToEdit) {
      setTitulo(notaToEdit.titulo || '');
      setContenido(notaToEdit.contenido || '');
      setTipoNota(notaToEdit.tipo_nota || 'apunte');
      setChecklist(notaToEdit.checklist_json || []);
      setParaCliente(notaToEdit.para_cliente || '');
      setEtiquetas(notaToEdit.etiquetas || []);
      setColorAcento(notaToEdit.color_acento || 'slate');
      setVisibilidad(notaToEdit.visibilidad || 'personal');
      setSharedWith(notaToEdit.shared_with || []);
      setIsPinned(Boolean(notaToEdit.is_pinned));
      setFechaRecordatorio(notaToEdit.fecha_recordatorio || '');
      setLinkedActivities(notaToEdit.actividades_vinculadas || []);
      setSelectedInitialActIds([]);
      // Cargar detalle completo (actividades vinculadas actualizadas) si no vino cargado
      api
        .getNotaById(notaToEdit.id)
        .then((full) => {
          setLinkedActivities(full.actividades_vinculadas || []);
          setChecklist(full.checklist_json || []);
        })
        .catch(() => {});
    } else {
      const tmpl = TIPOS_NOTA_CONFIG[initialTemplate] || TIPOS_NOTA_CONFIG.apunte;
      setTitulo('');
      setContenido(tmpl.defaultContent);
      setTipoNota(initialTemplate);
      setChecklist(
        initialTemplate === 'checklist'
          ? [{ id: `chk-${Date.now()}`, texto: '', completado: false, actividad_id: null }]
          : []
      );
      setParaCliente('');
      setEtiquetas([]);
      setColorAcento(initialTemplate === 'tecnica' ? 'sky' : initialTemplate === 'reunion' ? 'amber' : 'slate');
      setVisibilidad('personal');
      setSharedWith([]);
      setIsPinned(false);
      setFechaRecordatorio('');
      setLinkedActivities([]);
      setSelectedInitialActIds([]);
    }
    setNewCheckText('');
    setTagInput('');
    setShowActPicker(false);
    setActSearch('');
    setErrorMsg(null);
  }, [isOpen, notaToEdit, initialTemplate]);

  const loadActRefs = async (q = '') => {
    try {
      setLoadingRefs(true);
      const list = await api.getActividadesReferencias(currentUser?.id, currentUser?.full_name, q);
      setActRefs(list);
    } catch {
      setActRefs([]);
    } finally {
      setLoadingRefs(false);
    }
  };

  if (!isOpen) return null;

  const isOwner = !notaToEdit || (currentUser && Number(notaToEdit.user_id) === Number(currentUser.id));
  const eligibleUsers = users.filter((u) => u.id !== (notaToEdit?.user_id || currentUser?.id));

  const handleAddChecklistItem = () => {
    const txt = newCheckText.trim();
    if (!txt) return;
    setChecklist((prev) => [
      ...prev,
      {
        id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        texto: txt,
        completado: false,
        actividad_id: null,
      },
    ]);
    setNewCheckText('');
  };

  const handleAddTag = (raw: string) => {
    const clean = raw.trim().toLowerCase().replace(/^#/, '');
    if (!clean || etiquetas.includes(clean)) return;
    setEtiquetas((prev) => [...prev, clean.slice(0, 40)]);
    setTagInput('');
  };

  const handleToggleSharedUser = (uid: number) => {
    setSharedWith((prev) => (prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]));
  };

  const persistCurrentNota = async (): Promise<Nota | null> => {
    if (!titulo.trim()) {
      setErrorMsg('El título de la nota es obligatorio.');
      return null;
    }
    const cleanChecklist = checklist.filter((c) => c.texto.trim() !== '');
    setSaving(true);
    setErrorMsg(null);
    try {
      if (notaToEdit) {
        const res = await api.updateNota(notaToEdit.id, {
          titulo: titulo.trim(),
          contenido,
          tipo_nota: tipoNota,
          checklist_json: cleanChecklist,
          para_cliente: paraCliente.trim(),
          etiquetas,
          color_acento: colorAcento,
          visibilidad,
          shared_with: visibilidad === 'compartida' ? sharedWith : [],
          is_pinned: isPinned,
          fecha_recordatorio: fechaRecordatorio || null,
        });
        onSaved(res.nota, false);
        return res.nota;
      } else {
        const res = await api.createNota({
          titulo: titulo.trim(),
          contenido,
          tipo_nota: tipoNota,
          checklist_json: cleanChecklist,
          para_cliente: paraCliente.trim(),
          etiquetas,
          color_acento: colorAcento,
          visibilidad,
          shared_with: visibilidad === 'compartida' ? sharedWith : [],
          is_pinned: isPinned,
          fecha_recordatorio: fechaRecordatorio || null,
          actividad_ids: selectedInitialActIds,
        });
        onSaved(res.nota, true);
        return res.nota;
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar la nota');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await persistCurrentNota();
    if (saved) {
      onShowToast?.(notaToEdit ? 'Nota actualizada' : 'Nota creada', 'success');
      onClose();
    }
  };

  const handleConvertTrigger = async (item?: ChecklistItemNota) => {
    const saved = await persistCurrentNota();
    if (saved) {
      onClose();
      onConvertToActividad(saved, item);
    }
  };

  const handleLinkExistingActivity = async (ref: ActividadReferencia) => {
    if (notaToEdit) {
      try {
        const res = await api.vincularNotaActividad(notaToEdit.id, { actividad_id: ref.id, tipo_relacion: 'contexto' });
        setLinkedActivities(res.nota.actividades_vinculadas || []);
        onSaved(res.nota, false);
        onShowToast?.('Actividad vinculada a la nota', 'success');
      } catch (err: any) {
        onShowToast?.(err?.message || 'No se pudo vincular la actividad', 'error');
      }
    } else {
      setSelectedInitialActIds((prev) => (prev.includes(ref.id) ? prev : [...prev, ref.id]));
      setLinkedActivities((prev) =>
        prev.some((a) => a.id === ref.id)
          ? prev
          : [
              ...prev,
              {
                id: ref.id,
                bitacora_id: 0,
                fecha: ref.bitacora_fecha,
                hora_inicio: ref.hora_inicio,
                duracion_min: ref.duracion_min,
                tipo_trabajo: ref.tipo_trabajo,
                descripcion: ref.descripcion,
                descripcion_plana: stripHtml(ref.descripcion),
                para_cliente: ref.para_cliente,
                estado: ref.estado,
                colaborador: ref.colaborador,
                tipo_relacion: 'contexto',
              },
            ]
      );
    }
  };

  const handleUnlinkActivity = async (actId: number) => {
    if (notaToEdit) {
      try {
        const res = await api.desvincularNotaActividad(notaToEdit.id, actId);
        setLinkedActivities(res.nota.actividades_vinculadas || []);
        setChecklist(res.nota.checklist_json || []);
        onSaved(res.nota, false);
      } catch (err: any) {
        onShowToast?.(err?.message || 'Error al desvincular', 'error');
      }
    } else {
      setSelectedInitialActIds((prev) => prev.filter((id) => id !== actId));
      setLinkedActivities((prev) => prev.filter((a) => a.id !== actId));
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto overflow-x-hidden"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl bg-white dark:bg-[#161922] rounded-2xl shadow-2xl border border-slate-200/90 dark:border-white/10 max-h-[calc(100dvh-1rem)] sm:max-h-[92dvh] my-auto flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-50/80 dark:bg-[#1A1E29] border-b border-slate-200/80 dark:border-white/[0.08] shrink-0 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/70 dark:border-sky-500/25 shrink-0">
              <StickyNote className="w-4 h-4" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {notaToEdit ? 'Editar Nota & Contexto' : 'Nueva Nota'}
            </h3>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsPinned((p) => !p)}
              title={isPinned ? 'Desfijar nota' : 'Fijar arriba'}
              className={`min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer flex items-center gap-1 ${
                isPinned
                  ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
                  : 'bg-white dark:bg-[#222735] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Pin className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isPinned ? 'Fijada' : 'Fijar'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors cursor-pointer flex items-center justify-center"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form ref={formRef} onSubmit={handleSubmit} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 text-xs text-rose-700 dark:text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Título */}
          <div>
            <input
              type="text"
              required
              autoFocus={!notaToEdit}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título de la nota (ej. Acuerdos reunión Sunat Fase 4D)..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Metadatos compactos: Tipo, Cliente/Área, Acento y Recordatorio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Formato</label>
              <select
                value={tipoNota}
                onChange={(e) => {
                  const next = e.target.value as TipoNota;
                  setTipoNota(next);
                  if (!notaToEdit && !contenido.trim() && TIPOS_NOTA_CONFIG[next].defaultContent) {
                    setContenido(TIPOS_NOTA_CONFIG[next].defaultContent);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {(Object.keys(TIPOS_NOTA_CONFIG) as TipoNota[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPOS_NOTA_CONFIG[t].label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400 mb-1">
                <Briefcase className="w-3.5 h-3.5" />
                <span>Cliente / Área</span>
              </label>
              <input
                type="text"
                list="nota-clientes-datalist"
                value={paraCliente}
                onChange={(e) => setParaCliente(e.target.value)}
                placeholder="ej. SOLOPROMO, SISTEMAS"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <datalist id="nota-clientes-datalist">
                {clientSuggestions.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400 mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>Recordatorio</span>
              </label>
              <input
                type="date"
                value={fechaRecordatorio}
                onChange={(e) => setFechaRecordatorio(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Acento visual</label>
              <div className="flex items-center gap-1.5 h-[36px]">
                {(Object.keys(ACCENT_COLORS) as ColorAcentoNota[]).map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setColorAcento(col)}
                    title={ACCENT_COLORS[col].label}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center border cursor-pointer transition-transform ${
                      colorAcento === col
                        ? 'border-sky-500 ring-2 ring-sky-500/30 scale-105 bg-slate-100 dark:bg-white/10'
                        : 'border-slate-200 dark:border-white/10 hover:scale-105'
                    }`}
                  >
                    <span className={`w-3.5 h-3.5 rounded-full ${ACCENT_COLORS[col].dot}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Contenido enriquecido */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
              Contenido / Contexto (admite formato, enlaces, código e imágenes pegadas)
            </label>
            <HtmlEditor
              value={contenido}
              onChange={setContenido}
              placeholder={TIPOS_NOTA_CONFIG[tipoNota].placeholder}
              minHeight="140px"
            />
          </div>

          {/* Checklist interactivo (siempre disponible y versátil) */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <CheckSquare className="w-4 h-4 text-sky-500" />
                <span>Checklist de pasos o acuerdos ({checklist.filter((c) => c.completado).length}/{checklist.length})</span>
              </span>
            </div>

            {checklist.length > 0 && (
              <div className="space-y-1.5">
                {checklist.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-[#1E222D] border border-slate-200/70 dark:border-white/[0.07]"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setChecklist((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, completado: !c.completado } : c))
                        )
                      }
                      className="text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer shrink-0 p-0.5"
                    >
                      {item.completado ? (
                        <CheckSquare className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>

                    <input
                      type="text"
                      value={item.texto}
                      placeholder="Describe el pendiente..."
                      onChange={(e) =>
                        setChecklist((prev) =>
                          prev.map((c, i) => (i === idx ? { ...c, texto: e.target.value } : c))
                        )
                      }
                      className={`flex-1 bg-transparent text-xs focus:outline-none ${
                        item.completado
                          ? 'line-through text-slate-400'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    />

                    {item.actividad_id ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/25 shrink-0">
                        Act #{item.actividad_id}
                      </span>
                    ) : (
                      item.texto.trim() && (
                        <button
                          type="button"
                          onClick={() => handleConvertTrigger(item)}
                          title="Convertir este ítem en una actividad de tu bitácora"
                          className="text-[11px] font-semibold px-2 py-1 rounded-md bg-sky-50 hover:bg-sky-600 dark:bg-sky-500/10 dark:hover:bg-sky-600 text-sky-700 dark:text-sky-300 hover:text-white border border-sky-200 dark:border-sky-500/25 transition-colors cursor-pointer shrink-0"
                        >
                          + Actividad
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => setChecklist((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                      title="Quitar ítem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newCheckText}
                onChange={(e) => setNewCheckText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddChecklistItem();
                  }
                }}
                placeholder="Añadir punto accionable (Enter)..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={handleAddChecklistItem}
                className="px-3 py-1.5 rounded-lg bg-slate-200/80 dark:bg-[#222735] hover:bg-slate-300 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Añadir</span>
              </button>
            </div>
          </div>

          {/* Etiquetas y Visibilidad */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400">
                <Tag className="w-3.5 h-3.5" />
                <span>Etiquetas</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {etiquetas.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#222735] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 text-[11px] font-medium"
                  >
                    <span>#{t}</span>
                    <button
                      type="button"
                      onClick={() => setEtiquetas((prev) => prev.filter((x) => x !== t))}
                      className="text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddTag(tagInput);
                    }
                  }}
                  placeholder="Agregar etiqueta y Enter..."
                  className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag(tagInput)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#222735] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 font-semibold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-600 dark:text-slate-400">Visibilidad</label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['personal', 'compartida', 'equipo'] as VisibilidadNota[]).map((vis) => {
                  const Icon = vis === 'personal' ? Lock : vis === 'compartida' ? UserCheck : Users;
                  return (
                    <button
                      key={vis}
                      type="button"
                      disabled={!isOwner}
                      onClick={() => setVisibilidad(vis)}
                      title={VISIBILIDAD_LABELS[vis].desc}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer disabled:opacity-50 ${
                        visibilidad === vis
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-slate-50 dark:bg-[#1E222D] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{VISIBILIDAD_LABELS[vis].label}</span>
                    </button>
                  );
                })}
              </div>

              {visibilidad === 'compartida' && isOwner && (
                <div className="flex flex-wrap gap-1 pt-1.5 max-h-24 overflow-y-auto">
                  {eligibleUsers.map((u) => {
                    const active = sharedWith.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleToggleSharedUser(u.id)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
                          active
                            ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/35'
                            : 'bg-white dark:bg-[#1E222D] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'
                        }`}
                      >
                        {active ? '✓ ' : ''}
                        {u.full_name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Actividades Vinculadas */}
          <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-sky-500" />
                <span>Actividades vinculadas ({linkedActivities.length})</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const next = !showActPicker;
                  setShowActPicker(next);
                  if (next) loadActRefs(actSearch);
                }}
                className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{showActPicker ? 'Ocultar buscador' : 'Vincular actividad existente'}</span>
              </button>
            </div>

            {linkedActivities.length > 0 && (
              <div className="space-y-1.5">
                {linkedActivities.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-[#1E222D] border border-slate-200/70 dark:border-white/[0.07] text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-mono font-semibold text-sky-600 dark:text-sky-400">#{act.id}</span>
                        <span>{act.fecha}</span>
                        <span>·</span>
                        <span className="capitalize">{act.estado.replace('_', ' ')}</span>
                        {act.duracion_min > 0 && <span>· {formatDuration(act.duracion_min)}</span>}
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 font-medium truncate">
                        {act.descripcion_plana || stripHtml(act.descripcion)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnlinkActivity(act.id)}
                      title="Desvincular actividad"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer shrink-0"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {showActPicker && (
              <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={actSearch}
                      onChange={(e) => setActSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          loadActRefs(actSearch);
                        }
                      }}
                      placeholder="Buscar actividad reciente por texto o cliente..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => loadActRefs(actSearch)}
                    className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Buscar
                  </button>
                </div>

                {loadingRefs ? (
                  <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Buscando actividades...</span>
                  </div>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1">
                    {actRefs.slice(0, 12).map((ref) => {
                      const already = linkedActivities.some((a) => a.id === ref.id);
                      return (
                        <button
                          key={ref.id}
                          type="button"
                          disabled={already}
                          onClick={() => handleLinkExistingActivity(ref)}
                          className="w-full text-left p-2 rounded-lg bg-white dark:bg-[#1E222D] hover:bg-sky-50 dark:hover:bg-sky-500/10 border border-slate-200/70 dark:border-white/[0.06] text-xs flex items-center justify-between gap-2 cursor-pointer disabled:opacity-45"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-slate-400 font-mono mr-1.5">
                              #{ref.id} · {ref.bitacora_fecha}
                            </span>
                            <span className="text-slate-800 dark:text-slate-200 truncate block">
                              {stripHtml(ref.descripcion)}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 shrink-0">
                            {already ? 'Vinculada' : '+ Vincular'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 bg-slate-50/80 dark:bg-[#1A1E29] border-t border-slate-200/80 dark:border-white/[0.08] shrink-0 gap-2 flex-wrap">
          <button
            type="button"
            disabled={saving}
            onClick={() => handleConvertTrigger()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-600 dark:bg-emerald-500/10 dark:hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-200 dark:border-emerald-500/25 text-xs font-semibold transition-colors cursor-pointer"
          >
            <ArrowRightCircle className="w-4 h-4" />
            <span>Convertir en actividad</span>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => formRef.current?.requestSubmit()}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Guardando...' : notaToEdit ? 'Guardar cambios' : 'Guardar nota'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
