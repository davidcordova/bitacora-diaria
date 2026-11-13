import React, { useState } from 'react';
import {
  Clock,
  Timer,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Edit2,
  CheckCircle2,
  X,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Info,
  AlertTriangle,
  History,
  ShieldCheck,
  Check,
  Undo2,
  MessageCircle,
  Paperclip,
  ListTodo,
  PlayCircle,
  Eye,
  Link2,
  MessageSquare,
} from 'lucide-react';
import { Actividad, EstadoActividad, Evidencia } from '../types';
import { formatDuration, getEstadoBadgeInfo, getTimeInStatusInfo, stripHtml } from '../utils/formatters';
import { TIPOS_TRABAJO } from '../utils/initialData';
import { EvidenceViewerModal } from './EvidenceViewerModal';
import { EvidenceDropzone } from './EvidenceDropzone';
import { RichHtmlRenderer } from './RichHtmlRenderer';
import { HtmlEditor } from './HtmlEditor';
import { useModalBehavior } from '../hooks/useModalBehavior';

interface KanbanBoardProps {
  actividades: Actividad[];
  onUpdateEstado: (index: number, nuevoEstado: EstadoActividad) => void;
  onUpdateActividadDetalle?: (index: number, updatedData: Partial<Actividad>) => void;
  onAddActividadConEstado: (estado: EstadoActividad) => void;
  onRemoveActividad: (index: number) => void;
  onSyncWithBitacora?: () => void;
  colaborador: string;
  isLeaderView?: boolean;
  showCollaboratorBadge?: boolean;
  onApproveActivity?: (index: number) => void;
  onRejectActivity?: (index: number) => void;
}

interface ColumnConfig {
  id: EstadoActividad;
  title: string;
  badgeColor: string;
  icon: React.ReactNode;
  borderColor: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'pendiente',
    title: 'Por Iniciar',
    badgeColor: 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10',
    icon: <ListTodo className="w-4 h-4 text-slate-400 dark:text-slate-500" />,
    borderColor: 'border-t-slate-400 dark:border-t-slate-500',
  },
  {
    id: 'en_proceso',
    title: 'En Proceso',
    badgeColor: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/25',
    icon: <PlayCircle className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
    borderColor: 'border-t-sky-500',
  },
  {
    id: 'en_revision',
    title: 'En Revisión',
    badgeColor: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
    icon: <Eye className="w-4 h-4 text-amber-500" />,
    borderColor: 'border-t-amber-500',
  },
  {
    id: 'completada',
    title: 'Completada',
    badgeColor: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    borderColor: 'border-t-emerald-500',
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  actividades,
  onUpdateEstado,
  onUpdateActividadDetalle,
  onAddActividadConEstado,
  onRemoveActividad,
  onSyncWithBitacora,
  colaborador,
  isLeaderView = false,
  showCollaboratorBadge = false,
  onApproveActivity,
  onRejectActivity,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState('');

  // Evidence viewer modal state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedEvidencias, setSelectedEvidencias] = useState<Evidencia[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  // Edit card modal state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Actividad>>({});
  useModalBehavior(editingIndex !== null, () => setEditingIndex(null));

  // Mobile active column selector ('todas' or specific status)
  const [mobileColumnFilter, setMobileColumnFilter] = useState<EstadoActividad | 'todas'>('todas');

  const columnOrder: EstadoActividad[] = ['pendiente', 'en_proceso', 'en_revision', 'completada'];

  const moveActivity = (index: number, direction: 'prev' | 'next') => {
    const currentAct = actividades[index];
    const currentIndex = columnOrder.indexOf(currentAct.estado || 'pendiente');
    const newIdx = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIdx >= 0 && newIdx < columnOrder.length) {
      onUpdateEstado(index, columnOrder[newIdx]);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetEstado: EstadoActividad) => {
    e.preventDefault();
    const indexStr = e.dataTransfer.getData('text/plain');
    const index = parseInt(indexStr, 10);
    if (!isNaN(index) && index >= 0 && index < actividades.length) {
      onUpdateEstado(index, targetEstado);
    }
    setDraggedIndex(null);
  };

  const handleOpenEdit = (index: number) => {
    setEditingIndex(index);
    setEditForm({ ...actividades[index] });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingIndex !== null && onUpdateActividadDetalle) {
      const desc = editForm.descripcion || '';
      const cleanEvidencias = (editForm.evidencias || []).filter((ev, index, self) => {
        if (!ev || !ev.url) return false;
        const isFirst = self.findIndex((o) => (o.id && o.id === ev.id) || o.url === ev.url) === index;
        if (!isFirst) return false;

        const url = ev.url.trim();
        const filename = url.split('/').pop()?.split('?')[0] || '';
        if (url && desc.includes(url)) return false;
        if (filename && desc.includes(filename)) return false;

        // Descartar imagen/captura duplicada con el mismo prefijo de timestamp (YYYYMMDD_HHMMSS)
        const tsMatch = filename.match(/^(\d{8}_\d{6})/);
        if (tsMatch && desc.includes(tsMatch[1])) return false;

        return true;
      });

      onUpdateActividadDetalle(editingIndex, {
        ...editForm,
        evidencias: cleanEvidencias,
      });
    }
    setEditingIndex(null);
  };

  const filteredActivitiesWithIndex = actividades
    .map((act, index) => ({ act, index }))
    .filter(({ act }) => {
      const matchSearch =
        searchTerm === '' ||
        act.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (act.para_cliente && act.para_cliente.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (act.tipo_trabajo && act.tipo_trabajo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchTipo = filterTipo === '' || act.tipo_trabajo === filterTipo;
      return matchSearch && matchTipo;
    });

  const uniqueTipos = Array.from(new Set(actividades.map((a) => a.tipo_trabajo).filter(Boolean)));
  const pendingCount = actividades.filter((a) => a.estado !== 'completada').length;

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="bg-white dark:bg-[#161922] rounded-xl border border-slate-200/80 dark:border-white/[0.07] px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar actividades por texto o cliente..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#1E222D] text-xs text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200/90 dark:border-white/[0.08] focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 outline-hidden transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2 pointer-events-none" />
          </div>

          {uniqueTipos.length > 0 && (
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-[#1E222D] text-xs font-medium text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200/90 dark:border-white/[0.08] focus:border-sky-500 outline-hidden cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-[#1E222D]">Todos los tipos</option>
              {uniqueTipos.map((t) => (
                <option key={t} value={t} className="bg-white dark:bg-[#1E222D]">
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 w-full sm:w-auto justify-between sm:justify-end">
          <span>
            <strong className="font-semibold text-slate-700 dark:text-slate-200">{colaborador}</strong>
            <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
            <span>{pendingCount} en curso, {actividades.length - pendingCount} completadas</span>
          </span>

          {onSyncWithBitacora && pendingCount > 0 && (
            <button
              type="button"
              onClick={onSyncWithBitacora}
              className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sincronizar ({pendingCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile-Only Status Tabs (< 768px) */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
        <button
          type="button"
          onClick={() => setMobileColumnFilter('todas')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer min-h-[32px] ${
            mobileColumnFilter === 'todas'
              ? 'bg-sky-600 text-white'
              : 'bg-white dark:bg-[#161922] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]'
          }`}
        >
          Todas ({actividades.length})
        </button>
        {COLUMNS.map((c) => {
          const count = actividades.filter((a) => (a.estado || 'pendiente') === c.id).length;
          return (
            <button
              key={`m-col-${c.id}`}
              type="button"
              onClick={() => setMobileColumnFilter(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 min-h-[32px] ${
                mobileColumnFilter === c.id
                  ? 'bg-sky-600 text-white'
                  : 'bg-white dark:bg-[#161922] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08]'
              }`}
            >
              <span>{c.title}</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-black/10 dark:bg-white/15 tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {COLUMNS.map((col) => {
          const colActivities = filteredActivitiesWithIndex.filter(
            ({ act }) => (act.estado || 'pendiente') === col.id
          );
          const colTotalMin = colActivities.reduce(
            (sum, { act }) => sum + (Number(act.duracion_min) || 0),
            0
          );

          const isHiddenOnMobile = mobileColumnFilter !== 'todas' && mobileColumnFilter !== col.id;

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`bg-slate-50/70 dark:bg-[#141720] border border-slate-200/80 dark:border-white/[0.07] rounded-xl p-3 flex-col min-h-[480px] transition-colors border-t-2 ${col.borderColor} ${
                isHiddenOnMobile ? 'hidden md:flex' : 'flex'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span>{col.icon}</span>
                  <span className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">{col.title}</span>
                  <span className="px-2 py-0.2 rounded-md text-[11px] font-semibold bg-white dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/[0.08] tabular-nums">
                    {colActivities.length}
                  </span>
                </div>

                {colTotalMin > 0 && (
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
                    {formatDuration(colTotalMin)}
                  </span>
                )}
              </div>

              {/* Column Add Card Button */}
              <button
                type="button"
                onClick={() => onAddActividadConEstado(col.id)}
                className="w-full mb-2.5 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg border border-dashed border-slate-300/80 dark:border-white/10 hover:border-sky-500/60 bg-white/70 dark:bg-[#1A1E29]/70 hover:bg-white dark:hover:bg-[#1E222D] text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 text-xs font-medium transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva en {col.title}</span>
              </button>

              {/* Cards Container */}
              <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[600px] pr-0.5">
                {colActivities.map(({ act, index }) => {
                  const isFirst = columnOrder.indexOf(col.id) === 0;
                  const isLast = columnOrder.indexOf(col.id) === columnOrder.length - 1;
                  const isCompleted = act.estado === 'completada';
                  const timeInfo = getTimeInStatusInfo(act.updated_at, act.created_at, act.estado);
                  const discountedMin = Number(act.minutos_descontados) || 0;

                  return (
                    <div
                      key={act.id || index}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      className={`bg-white dark:bg-[#1A1E29] rounded-lg border p-3 shadow-2xs hover:border-slate-300 dark:hover:border-white/15 transition-all cursor-grab active:cursor-grabbing relative group ${
                        timeInfo.isStalled && !isCompleted
                          ? 'border-amber-300 dark:border-amber-500/40'
                          : 'border-slate-200/80 dark:border-white/[0.07]'
                      } ${draggedIndex === index ? 'opacity-40 scale-98 border-sky-500' : ''}`}
                    >
                      {/* Collaborator Header for Group Views */}
                      {(act.colaborador || showCollaboratorBadge) && (
                        <div className="flex items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-100 dark:border-white/[0.06]">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 flex items-center justify-center text-[10px] font-bold">
                              {(act.colaborador || 'U').charAt(0)}
                            </div>
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {act.colaborador || 'Colaborador'}
                            </span>
                          </div>
                          {act.colaborador_phone && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const clean = (act.colaborador_phone || '').replace(/\D/g, '');
                                const phone = clean.length === 9 ? `51${clean}` : clean;
                                const msg = encodeURIComponent(
                                  `Hola ${act.colaborador || ''}, te escribo sobre tu tarea: "${stripHtml(act.descripcion)}".`
                                );
                                window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                              }}
                              className="flex items-center gap-1 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                              title="Contactar al colaborador por WhatsApp"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Compact Time & Card Actions Row */}
                      <div className="flex items-center justify-between gap-1.5 mb-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                          {act.hora_inicio ? (
                            <span>{act.hora_inicio}</span>
                          ) : (
                            <span>Sin horario</span>
                          )}
                          {(act.duracion_min || 0) > 0 && (
                            <>
                              <span>·</span>
                              <span className="font-semibold text-slate-600 dark:text-slate-300">
                                {formatDuration(act.duracion_min)}
                              </span>
                            </>
                          )}
                          {discountedMin > 0 && (
                            <span
                              className="text-[10px] text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 px-1 py-0.1 rounded"
                              title={`Se descontaron ${formatDuration(discountedMin)} por actividades internas`}
                            >
                              −{formatDuration(discountedMin)} int.
                            </span>
                          )}
                          {!isCompleted && timeInfo.isStalled && (
                            <span
                              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
                              title={timeInfo.tooltip}
                            >
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>{timeInfo.label}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(index)}
                            title="Editar actividad"
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveActividad(index)}
                            title="Mover a papelera"
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="mb-2">
                        {act.descripcion ? (
                          <RichHtmlRenderer
                            content={act.descripcion}
                            clampLines={3}
                            className="text-xs text-slate-800 dark:text-slate-100 font-medium leading-relaxed"
                          />
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">(Sin descripción)</p>
                        )}
                      </div>

                      {/* Comentarios */}
                      {act.comentarios && (
                        <div className="mb-2 p-1.5 rounded bg-slate-50 dark:bg-[#141720] border border-slate-200/70 dark:border-white/[0.06] text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1">
                          <MessageSquare className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-snug">{act.comentarios}</span>
                        </div>
                      )}

                      {/* Quiet Metadata Row */}
                      {(act.para_cliente || act.tipo_trabajo || act.parent_task_id || (act.evidencias && act.evidencias.length > 0)) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500 mb-2">
                          {act.para_cliente && (
                            <span className="font-medium text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                              {act.para_cliente}
                            </span>
                          )}
                          {act.tipo_trabajo && <span>{act.tipo_trabajo}</span>}
                          {act.parent_task_id && (
                            <span className="inline-flex items-center gap-0.5" title={act.parent_task_desc || 'Continuación'}>
                              <Link2 className="w-3 h-3" />
                              <span>Continuación</span>
                            </span>
                          )}
                          {act.evidencias && act.evidencias.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvidencias(act.evidencias || []);
                                setViewerIndex(0);
                                setViewerOpen(true);
                              }}
                              className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                              title={`Ver ${act.evidencias.length} adjunto(s)`}
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{act.evidencias.length}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Quick Column Move Footer */}
                      <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-1">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => moveActivity(index, 'prev')}
                          title="Mover a columna anterior"
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-3 h-3" />
                          <span>Atrás</span>
                        </button>

                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => moveActivity(index, 'next')}
                          title="Avanzar a siguiente columna"
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <span>Avanzar</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Leader 1-Click Approvals for In-Review Column */}
                      {isLeaderView && act.estado === 'en_revision' && (
                        <div className="mt-2.5 pt-2 border-t border-amber-200/80 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/10 -mx-3 -mb-3 p-2.5 rounded-b-lg flex items-center justify-between gap-1.5">
                          <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Revisión</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onApproveActivity) onApproveActivity(index);
                                else onUpdateEstado(index, 'completada');
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Aprobar y marcar como completada"
                            >
                              <Check className="w-3 h-3" />
                              <span>Aprobar</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onRejectActivity) onRejectActivity(index);
                                else onUpdateEstado(index, 'en_proceso');
                              }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Devolver a En Proceso"
                            >
                              <Undo2 className="w-3 h-3" />
                              <span>Devolver</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {colActivities.length === 0 && (
                  <div className="h-28 border border-dashed border-slate-200 dark:border-white/[0.06] rounded-lg flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs text-center p-4">
                    Sin actividades
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL EDICIÓN DE ACTIVIDAD DIRECTA DESDE KANBAN */}
      {editingIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-white/10 max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] my-auto overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80 dark:border-white/[0.07]">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Editar Actividad</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingIndex(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Hora inicio</label>
                  <input
                    type="time"
                    value={editForm.hora_inicio || ''}
                    onChange={(e) => setEditForm({ ...editForm, hora_inicio: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200/80 dark:border-white/10 focus:outline-hidden focus:border-sky-500 transition-all"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Duración (min)</label>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={editForm.duracion_min || ''}
                    onChange={(e) =>
                      setEditForm({ ...editForm, duracion_min: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200/80 dark:border-white/10 focus:outline-hidden focus:border-sky-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tipo de trabajo</label>
                <select
                  value={editForm.tipo_trabajo || ''}
                  onChange={(e) => setEditForm({ ...editForm, tipo_trabajo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200/80 dark:border-white/10 focus:outline-hidden focus:border-sky-500 transition-all"
                >
                  <option value="" className="dark:bg-[#1E222D]">Seleccionar...</option>
                  {TIPOS_TRABAJO.map((t) => (
                    <option key={t} value={t} className="dark:bg-[#1E222D]">
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
                <HtmlEditor
                  value={editForm.descripcion || ''}
                  onChange={(val) => setEditForm({ ...editForm, descripcion: val })}
                  placeholder="Detalle de la tarea..."
                  minHeight="130px"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Para / Cliente</label>
                <input
                  type="text"
                  value={editForm.para_cliente || ''}
                  onChange={(e) => setEditForm({ ...editForm, para_cliente: e.target.value })}
                  placeholder="Ej: RR.HH., Gerencia..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200/80 dark:border-white/10 focus:outline-hidden focus:border-sky-500 transition-all"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Comentarios (opcional)
                </label>
                <textarea
                  rows={2}
                  value={editForm.comentarios || ''}
                  onChange={(e) => setEditForm({ ...editForm, comentarios: e.target.value })}
                  placeholder="Notas internas..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200/80 dark:border-white/10 focus:outline-hidden focus:border-sky-500 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                <select
                  value={editForm.estado || 'pendiente'}
                  onChange={(e) =>
                    setEditForm({ ...editForm, estado: e.target.value as EstadoActividad })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200/80 dark:border-white/10 focus:outline-hidden focus:border-sky-500 transition-all"
                >
                  <option value="pendiente" className="dark:bg-[#1E222D]">Por Iniciar</option>
                  <option value="en_proceso" className="dark:bg-[#1E222D]">En Proceso</option>
                  <option value="en_revision" className="dark:bg-[#1E222D]">En Revisión</option>
                  <option value="completada" className="dark:bg-[#1E222D]">Completada</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Evidencias adjuntas</label>
                <EvidenceDropzone
                  evidencias={editForm.evidencias || []}
                  onChange={(evs) => setEditForm({ ...editForm, evidencias: evs })}
                  compact={true}
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingIndex(null)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg font-medium cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-5 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  Guardar cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Evidence Viewer Lightbox Modal */}
      <EvidenceViewerModal
        isOpen={viewerOpen}
        evidencias={selectedEvidencias}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
};
