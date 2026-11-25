import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  Archive,
  Trash2,
  RotateCcw,
  LayoutGrid,
  Columns2,
  Link2,
  CheckSquare,
  Square,
  ArrowRightCircle,
  Lock,
  Users,
  UserCheck,
  Calendar,
  Tag,
  Edit3,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  Nota,
  TipoNota,
  ChecklistItemNota,
  User,
} from '../../types';
import { api } from '../../services/api';
import { confirmDialog } from '../DialogHost';
import { RichHtmlRenderer } from '../RichHtmlRenderer';
import { formatDuration, stripHtml } from '../../utils/formatters';
import { NotaModal } from './NotaModal';
import {
  ACCENT_COLORS,
  TIPOS_NOTA_CONFIG,
  VISIBILIDAD_LABELS,
  getChecklistProgress,
} from './notaStyles';

interface NotasViewProps {
  currentUser: User | null;
  users: User[];
  onConvertToActividad: (nota: Nota, checklistItem?: ChecklistItemNota) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onNotasChanged?: () => void;
}

const ESTADO_TABS = [
  { id: 'activas_y_ejecucion', label: 'Activas' },
  { id: 'en_ejecucion', label: 'En ejecución' },
  { id: 'convertida', label: 'Convertidas' },
  { id: 'archivada', label: 'Archivadas' },
  { id: 'papelera', label: 'Papelera' },
  { id: 'todas', label: 'Todas' },
] as const;

export const NotasView: React.FC<NotasViewProps> = ({
  currentUser,
  users,
  onConvertToActividad,
  onShowToast,
  onNotasChanged,
}) => {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [totalNotas, setTotalNotas] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filtros de búsqueda global
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [estadoTab, setEstadoTab] = useState<string>('activas_y_ejecucion');
  const [alcance, setAlcance] = useState<'todas' | 'mis' | 'compartidas' | 'equipo'>('todas');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('');
  const [etiquetaFiltro, setEtiquetaFiltro] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [viewLayout, setViewLayout] = useState<'grid' | 'split'>('grid');

  // Split detail + Modal
  const [selectedNota, setSelectedNota] = useState<Nota | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNota, setEditingNota] = useState<Nota | null>(null);
  const [initialTemplate, setInitialTemplate] = useState<TipoNota>('apunte');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchNotasList = useCallback(
    async (offsetVal = 0, append = false) => {
      try {
        if (append) setLoadingMore(true);
        else setLoading(true);
        const res = await api.getNotas({
          q: debouncedSearch || undefined,
          estado: estadoTab,
          alcance,
          tipo_nota: tipoFiltro || undefined,
          cliente: clienteFiltro || undefined,
          etiqueta: etiquetaFiltro || undefined,
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
          limit: 40,
          offset: offsetVal,
        });
        setTotalNotas(res.total);
        setHasMore(res.hasMore);
        setNotas((prev) => (append ? [...prev, ...res.items] : res.items));
      } catch (err: any) {
        onShowToast?.(err?.message || 'Error al cargar notas', 'error');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, estadoTab, alcance, tipoFiltro, clienteFiltro, etiquetaFiltro, fechaDesde, fechaHasta]
  );

  useEffect(() => {
    fetchNotasList(0, false);
  }, [fetchNotasList]);

  const loadFullSelected = async (nota: Nota) => {
    setSelectedNota(nota);
    try {
      setLoadingDetail(true);
      const full = await api.getNotaById(nota.id);
      setSelectedNota(full);
    } catch {
      /* mantener vista previa */
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (viewLayout === 'split' && notas.length > 0 && (!selectedNota || !notas.some((n) => n.id === selectedNota.id))) {
      loadFullSelected(notas[0]);
    }
  }, [viewLayout, notas]);

  const [knownClients, setKnownClients] = useState<string[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);

  useEffect(() => {
    setKnownClients((prev) => {
      const merged = new Set(prev);
      notas.forEach((n) => {
        if (n.para_cliente?.trim()) merged.add(n.para_cliente.trim());
      });
      const arr = Array.from(merged).sort();
      return arr.length === prev.length && arr.every((v, i) => v === prev[i]) ? prev : arr;
    });
    setKnownTags((prev) => {
      const merged = new Set(prev);
      notas.forEach((n) => n.etiquetas?.forEach((t) => merged.add(t)));
      const arr = Array.from(merged).sort();
      return arr.length === prev.length && arr.every((v, i) => v === prev[i]) ? prev : arr;
    });
  }, [notas]);

  const availableClients = knownClients;
  const availableTags = knownTags;

  const pinnedNotas = useMemo(() => notas.filter((n) => n.is_pinned && !n.is_deleted), [notas]);
  const unpinnedNotas = useMemo(() => notas.filter((n) => !n.is_pinned || n.is_deleted), [notas]);

  const handleOpenCreate = (tmpl: TipoNota = 'apunte') => {
    setEditingNota(null);
    setInitialTemplate(tmpl);
    setModalOpen(true);
  };

  const handleOpenEdit = (nota: Nota) => {
    setEditingNota(nota);
    setModalOpen(true);
  };

  const handleTogglePin = async (nota: Nota) => {
    try {
      const res = await api.updateNota(nota.id, { is_pinned: !nota.is_pinned });
      setNotas((prev) => prev.map((n) => (n.id === nota.id ? res.nota : n)));
      if (selectedNota?.id === nota.id) setSelectedNota(res.nota);
      onNotasChanged?.();
    } catch (err: any) {
      onShowToast?.(err?.message || 'Error al fijar nota', 'error');
    }
  };

  const handleToggleArchive = async (nota: Nota) => {
    const nextEstado = nota.estado === 'archivada' ? 'activa' : 'archivada';
    try {
      const res = await api.updateNota(nota.id, { estado: nextEstado });
      onShowToast?.(nextEstado === 'archivada' ? 'Nota archivada' : 'Nota reactivada', 'info');
      fetchNotasList(0, false);
      if (selectedNota?.id === nota.id) setSelectedNota(res.nota);
      onNotasChanged?.();
    } catch (err: any) {
      onShowToast?.(err?.message || 'Error al cambiar estado', 'error');
    }
  };

  const handleDelete = async (nota: Nota) => {
    const isTrash = Boolean(nota.is_deleted);
    const msg = isTrash
      ? '¿Eliminar definitivamente esta nota? Esta acción no se puede deshacer.'
      : '¿Enviar esta nota a la papelera? Podrás restaurarla luego.';
    if (!(await confirmDialog(msg))) return;
    try {
      await api.deleteNota(nota.id, isTrash);
      onShowToast?.(isTrash ? 'Nota eliminada definitivamente' : 'Nota movida a papelera', 'info');
      setNotas((prev) => prev.filter((n) => n.id !== nota.id));
      if (selectedNota?.id === nota.id) setSelectedNota(null);
      onNotasChanged?.();
    } catch (err: any) {
      onShowToast?.(err?.message || 'No se pudo eliminar la nota', 'error');
    }
  };

  const handleRestore = async (nota: Nota) => {
    try {
      await api.restaurarNota(nota.id);
      onShowToast?.('Nota restaurada', 'success');
      fetchNotasList(0, false);
      onNotasChanged?.();
    } catch (err: any) {
      onShowToast?.(err?.message || 'Error al restaurar', 'error');
    }
  };

  const handleToggleChecklistItem = async (nota: Nota, item: ChecklistItemNota) => {
    try {
      const res = await api.updateNotaChecklist(nota.id, {
        item_id: item.id,
        completado: !item.completado,
      });
      setNotas((prev) => prev.map((n) => (n.id === nota.id ? res.nota : n)));
      if (selectedNota?.id === nota.id) setSelectedNota(res.nota);
    } catch (err: any) {
      onShowToast?.(err?.message || 'Error al actualizar ítem', 'error');
    }
  };

  const hasFilters =
    Boolean(debouncedSearch) ||
    alcance !== 'todas' ||
    Boolean(tipoFiltro) ||
    Boolean(clienteFiltro) ||
    Boolean(etiquetaFiltro) ||
    Boolean(fechaDesde) ||
    Boolean(fechaHasta);

  const renderNotaCard = (nota: Nota) => {
    const accent = ACCENT_COLORS[nota.color_acento || 'slate'];
    const chkProg = getChecklistProgress(nota.checklist_json);
    const VisIcon = nota.visibilidad === 'personal' ? Lock : nota.visibilidad === 'compartida' ? UserCheck : Users;
    const isTrash = Boolean(nota.is_deleted);

    return (
      <div
        key={nota.id}
        className={`bg-white dark:bg-[#161922] border border-slate-200/85 dark:border-white/[0.08] border-l-4 ${accent.border} rounded-2xl p-4 shadow-xs hover:border-sky-500/40 transition-colors flex flex-col justify-between gap-3`}
      >
        <div className="space-y-2.5">
          {/* Header fila */}
          <div className="flex items-start justify-between gap-2">
            <button
              type="button"
              onClick={() => handleOpenEdit(nota)}
              className="text-left min-w-0 flex-1 cursor-pointer group"
            >
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  {TIPOS_NOTA_CONFIG[nota.tipo_nota]?.shortLabel || 'Apunte'}
                </span>
                {nota.estado_operativo === 'en_ejecucion' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/25">
                    En ejecución
                  </span>
                )}
                {nota.estado_operativo === 'convertida' && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25">
                    Convertida
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-2">
                {nota.titulo}
              </h3>
            </button>

            {!isTrash && (
              <button
                type="button"
                onClick={() => handleTogglePin(nota)}
                title={nota.is_pinned ? 'Desfijar' : 'Fijar arriba'}
                className={`min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg cursor-pointer transition-colors shrink-0 flex items-center justify-center ${
                  nota.is_pinned
                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-500/10'
                    : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Extracto */}
          {nota.contenido_plano && (
            <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
              {nota.contenido_plano}
            </p>
          )}

          {/* Mini checklist interactivo */}
          {chkProg.total > 0 && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <span>Checklist</span>
                <span className="font-mono">
                  {chkProg.done}/{chkProg.total}
                </span>
              </div>
              {nota.checklist_json.slice(0, 3).map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => handleToggleChecklistItem(nota, item)}
                    className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    {item.completado ? (
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}
                    <span
                      className={`truncate ${
                        item.completado ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {item.texto}
                    </span>
                  </button>
                  {!item.actividad_id && !isTrash && (
                    <button
                      type="button"
                      onClick={() => onConvertToActividad(nota, item)}
                      title="Convertir este ítem en actividad"
                      className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer shrink-0"
                    >
                      + Act
                    </button>
                  )}
                </div>
              ))}
              {chkProg.total > 3 && (
                <span className="text-[10px] text-slate-400 block">+{chkProg.total - 3} ítem(s) más</span>
              )}
            </div>
          )}

          {/* Meta chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1E222D] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10">
              <VisIcon className="w-3 h-3" />
              <span>{VISIBILIDAD_LABELS[nota.visibilidad]?.label || 'Personal'}</span>
            </span>

            {nota.para_cliente && (
              <span className="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/25 font-medium truncate max-w-[140px]">
                {nota.para_cliente}
              </span>
            )}

            {(nota.actividades_count || 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1E222D] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 font-medium">
                <Link2 className="w-3 h-3 text-sky-500" />
                <span>
                  {nota.actividades_count} act.
                  {(nota.tiempo_total_min || 0) > 0 ? ` · ${formatDuration(nota.tiempo_total_min || 0)}` : ''}
                </span>
              </span>
            )}

            {nota.fecha_recordatorio && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25">
                <Calendar className="w-3 h-3" />
                <span>{nota.fecha_recordatorio}</span>
              </span>
            )}

            {nota.etiquetas?.slice(0, 3).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setEtiquetaFiltro(etiquetaFiltro === t ? '' : t)}
                className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 hover:text-sky-600 text-[10px] cursor-pointer"
              >
                #{t}
              </button>
            ))}
          </div>
        </div>

        {/* Footer acciones */}
        <div className="pt-2.5 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2 text-xs">
          {!isTrash ? (
            <>
              <button
                type="button"
                onClick={() => onConvertToActividad(nota)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-600 dark:bg-emerald-500/10 dark:hover:bg-emerald-600 text-emerald-700 dark:text-emerald-300 hover:text-white border border-emerald-200 dark:border-emerald-500/25 text-[11px] font-semibold cursor-pointer transition-colors"
              >
                <ArrowRightCircle className="w-3.5 h-3.5" />
                <span>Convertir</span>
              </button>

              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(nota)}
                  title="Editar"
                  className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleArchive(nota)}
                  title={nota.estado === 'archivada' ? 'Reactivar' : 'Archivar'}
                  className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(nota)}
                  title="Mover a papelera"
                  className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full gap-2">
              <button
                type="button"
                onClick={() => handleRestore(nota)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/25 text-xs font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar</span>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(nota)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/25 text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-5 pb-20 animate-fadeIn">
      {/* Cabecera */}
      <div className="bg-white dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-sky-500/25">
              <StickyNote className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
                Notas & Contexto Operativo
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Busca apuntes históricos, checklists y minutas; vincúlalos a actividades o conviértelos en tareas ({totalNotas} encontradas)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Switcher Mosaico / Vista Dividida */}
            <div className="hidden md:flex items-center bg-slate-100 dark:bg-[#1A1E29] p-0.5 rounded-xl border border-slate-200/80 dark:border-white/[0.08]">
              <button
                type="button"
                onClick={() => setViewLayout('grid')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  viewLayout === 'grid'
                    ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Mosaico</span>
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('split')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  viewLayout === 'split'
                    ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Columns2 className="w-3.5 h-3.5" />
                <span>Dividida</span>
              </button>
            </div>

            {/* Plantillas rápidas */}
            <div className="flex items-center gap-1 flex-wrap">
              {(['checklist', 'reunion', 'tecnica'] as TipoNota[]).map((tmpl) => (
                <button
                  key={tmpl}
                  type="button"
                  onClick={() => handleOpenCreate(tmpl)}
                  className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E222D] dark:hover:bg-[#252B3B] text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-white/10 text-xs font-semibold cursor-pointer transition-colors"
                >
                  + {TIPOS_NOTA_CONFIG[tmpl].shortLabel}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleOpenCreate('apunte')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Nota</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barra de Búsqueda Global & Filtros */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar en título, contenido, checklists, etiquetas o cliente..."
                className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <select
              value={alcance}
              onChange={(e) => setAlcance(e.target.value as any)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="todas">Todo alcance</option>
              <option value="mis">Mis notas</option>
              <option value="compartidas">Compartidas conmigo</option>
              <option value="equipo">De mi equipo</option>
            </select>

            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Todos los formatos</option>
              {(Object.keys(TIPOS_NOTA_CONFIG) as TipoNota[]).map((t) => (
                <option key={t} value={t}>
                  {TIPOS_NOTA_CONFIG[t].label}
                </option>
              ))}
            </select>

            {availableClients.length > 0 && (
              <select
                value={clienteFiltro}
                onChange={(e) => setClienteFiltro(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Todos los clientes</option>
                {availableClients.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            {availableTags.length > 0 && (
              <select
                value={etiquetaFiltro}
                onChange={(e) => setEtiquetaFiltro(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value="">Todas las etiquetas</option>
                {availableTags.map((t) => (
                  <option key={t} value={t}>
                    #{t}
                  </option>
                ))}
              </select>
            )}

            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              title="Creadas desde"
              className="px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200"
            />
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              title="Creadas hasta"
              className="px-2.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200"
            />

            {hasFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setAlcance('todas');
                  setTipoFiltro('');
                  setClienteFiltro('');
                  setEtiquetaFiltro('');
                  setFechaDesde('');
                  setFechaHasta('');
                }}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Pestañas de estado */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {ESTADO_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setEstadoTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  estadoTab === tab.id
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#222735]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
          <span className="text-sm">Buscando notas...</span>
        </div>
      ) : notas.length === 0 ? (
        <div className="bg-white dark:bg-[#161922] border border-dashed border-slate-300 dark:border-white/15 rounded-2xl p-12 text-center space-y-3">
          <StickyNote className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
          <div>
            <p className="text-sm sm:text-base font-semibold text-slate-700 dark:text-slate-200">
              No se encontraron notas con los filtros actuales
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Crea una nota libre, un checklist o una minuta y vincúlala cuando quieras a tus actividades.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenCreate('apunte')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Crear primera nota</span>
          </button>
        </div>
      ) : viewLayout === 'split' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Lista izquierda */}
          <div className="lg:col-span-5 bg-white dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl divide-y divide-slate-100 dark:divide-white/[0.06] max-h-[72vh] overflow-y-auto">
            {notas.map((n) => {
              const active = selectedNota?.id === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => loadFullSelected(n)}
                  className={`w-full text-left p-3.5 transition-colors cursor-pointer ${
                    active ? 'bg-sky-50/80 dark:bg-sky-500/10' : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
                      {n.titulo}
                    </span>
                    {n.is_pinned && <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {n.contenido_plano || `${n.checklist_json?.length || 0} ítems en checklist`}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                    {n.para_cliente && <span className="text-sky-600 dark:text-sky-400 font-semibold">{n.para_cliente}</span>}
                    {(n.actividades_count || 0) > 0 && <span>🔗 {n.actividades_count} act.</span>}
                    <span className="ml-auto">{n.updated_at?.slice(0, 10)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Inspector derecho */}
          <div className="lg:col-span-7 bg-white dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-5 space-y-4">
            {!selectedNota ? (
              <div className="py-16 text-center text-xs text-slate-400">Selecciona una nota para ver su detalle.</div>
            ) : loadingDetail ? (
              <div className="py-16 flex justify-center text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin text-sky-500" />
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-white/[0.06] pb-3">
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedNota.titulo}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1">
                      <span>{TIPOS_NOTA_CONFIG[selectedNota.tipo_nota]?.label}</span>
                      {selectedNota.para_cliente && (
                        <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 font-semibold">
                          {selectedNota.para_cliente}
                        </span>
                      )}
                      {selectedNota.author_name && <span>Por: {selectedNota.author_name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => onConvertToActividad(selectedNota)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <ArrowRightCircle className="w-3.5 h-3.5" />
                      <span>Convertir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(selectedNota)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                  </div>
                </div>

                {selectedNota.contenido && (
                  <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] overflow-x-hidden">
                    <RichHtmlRenderer content={selectedNota.contenido} />
                  </div>
                )}

                {selectedNota.checklist_json?.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300">Checklist</h4>
                    {selectedNota.checklist_json.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/70 dark:border-white/[0.07] text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleChecklistItem(selectedNota, item)}
                          className="flex items-center gap-2 text-left flex-1 cursor-pointer"
                        >
                          {item.completado ? (
                            <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className={item.completado ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-200'}>
                            {item.texto}
                          </span>
                        </button>
                        {item.actividad_id ? (
                          <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400">#{item.actividad_id}</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onConvertToActividad(selectedNota, item)}
                            className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                          >
                            + Actividad
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedNota.actividades_vinculadas && selectedNota.actividades_vinculadas.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      Actividades vinculadas ({selectedNota.actividades_vinculadas.length})
                    </h4>
                    {selectedNota.actividades_vinculadas.map((act) => (
                      <div
                        key={act.id}
                        className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/70 dark:border-white/[0.07] text-xs flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-[11px] font-mono text-sky-600 dark:text-sky-400 mr-2">
                            #{act.id} · {act.fecha}
                          </span>
                          <span className="text-slate-800 dark:text-slate-200 font-medium truncate block">
                            {act.descripcion_plana || stripHtml(act.descripcion)}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {act.estado.replace('_', ' ')} · {formatDuration(act.duracion_min)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {pinnedNotas.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <Pin className="w-3.5 h-3.5 text-amber-500" />
                <span>Fijadas ({pinnedNotas.length})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pinnedNotas.map(renderNotaCard)}
              </div>
            </div>
          )}

          {unpinnedNotas.length > 0 && (
            <div className="space-y-2.5">
              {pinnedNotas.length > 0 && (
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Todas las notas ({unpinnedNotas.length})
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {unpinnedNotas.map(renderNotaCard)}
              </div>
            </div>
          )}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => fetchNotasList(notas.length, true)}
            className="px-5 py-2.5 rounded-xl bg-white dark:bg-[#161922] hover:bg-slate-50 dark:hover:bg-[#1E222D] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
          >
            {loadingMore ? 'Cargando...' : 'Cargar más notas'}
          </button>
        </div>
      )}

      {/* Modal completo */}
      <NotaModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        notaToEdit={editingNota}
        initialTemplate={initialTemplate}
        users={users}
        currentUser={currentUser}
        onSaved={(saved, isNew) => {
          setNotas((prev) => (isNew ? [saved, ...prev] : prev.map((n) => (n.id === saved.id ? saved : n))));
          if (selectedNota?.id === saved.id) setSelectedNota(saved);
          if (isNew) setTotalNotas((t) => t + 1);
          onNotasChanged?.();
        }}
        onConvertToActividad={onConvertToActividad}
        onShowToast={onShowToast}
      />
    </div>
  );
};
