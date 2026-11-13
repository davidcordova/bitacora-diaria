import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  Edit2,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
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
import { Actividad, EstadoActividad, Evidencia, User } from '../types';
import { formatDuration, getTimeInStatusInfo, stripHtml } from '../utils/formatters';
import { EvidenceViewerModal } from './EvidenceViewerModal';
import { RichHtmlRenderer } from './RichHtmlRenderer';
import { ActividadDetalleModal } from './ActividadDetalleModal';
import { ActividadModal } from './ActividadModal';
import { ActividadReferenciaModal } from './ActividadReferenciaModal';

interface KanbanBoardProps {
  actividades: Actividad[];
  onUpdateEstado: (index: number, nuevoEstado: EstadoActividad) => void;
  onUpdateActividadDetalle?: (index: number, updatedData: Partial<Actividad>) => void;
  onAddActividadConEstado: (estado: EstadoActividad) => void;
  onAddActividad?: (actividad?: Actividad) => void;
  onRemoveActividad: (index: number) => void;
  onSyncWithBitacora?: () => void;
  colaborador: string;
  users?: User[];
  currentUser?: User | null;
  fecha?: string;
  onDateChange?: (date: string) => void;
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
    badgeColor:
      'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10',
    icon: <ListTodo className="w-4 h-4 text-slate-400 dark:text-slate-500" />,
    borderColor: 'border-t-slate-400 dark:border-t-slate-500',
  },
  {
    id: 'en_proceso',
    title: 'En Proceso',
    badgeColor:
      'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/25',
    icon: <PlayCircle className="w-4 h-4 text-sky-600 dark:text-sky-400" />,
    borderColor: 'border-t-sky-500',
  },
  {
    id: 'en_revision',
    title: 'En Revisión',
    badgeColor:
      'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
    icon: <Eye className="w-4 h-4 text-amber-500" />,
    borderColor: 'border-t-amber-500',
  },
  {
    id: 'completada',
    title: 'Completada',
    badgeColor:
      'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    borderColor: 'border-t-emerald-500',
  },
];

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  actividades,
  onUpdateEstado,
  onUpdateActividadDetalle,
  onAddActividadConEstado,
  onAddActividad,
  onRemoveActividad,
  onSyncWithBitacora,
  colaborador,
  users = [],
  currentUser = null,
  fecha,
  onDateChange,
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

  // Unified Detail, Create/Edit & Reference modals
  const [detailIndex, setDetailIndex] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingActividad, setEditingActividad] = useState<Actividad | null>(null);
  const [modalDefaultEstado, setModalDefaultEstado] = useState<EstadoActividad>('completada');

  const [refModalOpen, setRefModalOpen] = useState(false);
  const [selectedRefId, setSelectedRefId] = useState<number | string | null>(null);
  const [selectedRefVinculo, setSelectedRefVinculo] = useState<string | undefined>('continuacion');

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

  const handleOpenCreateForColumn = (estado: EstadoActividad) => {
    if (onAddActividad) {
      setEditingIndex(null);
      setEditingActividad(null);
      setModalDefaultEstado(estado);
      setModalOpen(true);
    } else {
      onAddActividadConEstado(estado);
    }
  };

  const handleOpenEdit = (index: number) => {
    const target = actividades[index];
    if (!target) return;
    setEditingIndex(index);
    setEditingActividad(target);
    setModalDefaultEstado(target.estado || 'completada');
    setModalOpen(true);
  };

  const handleSaveModal = (actividadData: Actividad, editIdx: number | null) => {
    if (editIdx !== null) {
      if (onUpdateActividadDetalle) {
        onUpdateActividadDetalle(editIdx, actividadData);
      }
    } else if (onAddActividad) {
      onAddActividad(actividadData);
    } else {
      onAddActividadConEstado(actividadData.estado || 'pendiente');
    }
  };

  const handleNavigateToRef = (refId: number | string, tipoVinculo?: string) => {
    setSelectedRefId(refId);
    setSelectedRefVinculo(tipoVinculo || 'continuacion');
    setRefModalOpen(true);
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
  const canEditItems = Boolean(onUpdateActividadDetalle);
  const canAddItems = !isLeaderView || Boolean(onAddActividad);

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
              <option value="" className="bg-white dark:bg-[#1E222D]">
                Todos los tipos
              </option>
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
            <span>
              {pendingCount} en curso, {actividades.length - pendingCount} completadas
            </span>
          </span>

          {onSyncWithBitacora && pendingCount > 0 && (
            <button
              type="button"
              onClick={onSyncWithBitacora}
              className="inline-flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer min-h-[36px]"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sincronizar ({pendingCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile-Only Status Tabs (< 768px) */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 select-none">
        <button
          type="button"
          onClick={() => setMobileColumnFilter('todas')}
          className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer min-h-[40px] ${
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
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 cursor-pointer flex items-center gap-1.5 min-h-[40px] ${
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
              className={`bg-slate-50/70 dark:bg-[#141720] border border-slate-200/80 dark:border-white/[0.07] rounded-xl p-3 flex-col min-h-[220px] md:min-h-[460px] min-w-0 overflow-hidden transition-colors border-t-2 ${col.borderColor} ${
                isHiddenOnMobile ? 'hidden md:flex' : 'flex'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <span>{col.icon}</span>
                  <span className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200">
                    {col.title}
                  </span>
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
              {canAddItems && (
                <button
                  type="button"
                  onClick={() => handleOpenCreateForColumn(col.id)}
                  className="w-full mb-2.5 flex items-center justify-center gap-1.5 py-2 sm:py-1.5 px-3 rounded-lg border border-dashed border-slate-300/80 dark:border-white/10 hover:border-sky-500/60 bg-white/70 dark:bg-[#1A1E29]/70 hover:bg-white dark:hover:bg-[#1E222D] text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 text-xs font-medium transition-colors cursor-pointer min-h-[40px] sm:min-h-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva en {col.title}</span>
                </button>
              )}

              {/* Cards Container */}
              <div className="space-y-2.5 flex-1 overflow-y-auto overflow-x-hidden max-h-[600px] pr-0.5">
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
                      onClick={() => setDetailIndex(index)}
                      className={`bg-white dark:bg-[#1A1E29] rounded-lg border p-3 shadow-2xs hover:border-slate-300 dark:hover:border-white/15 transition-all cursor-pointer active:cursor-grabbing relative group min-w-0 overflow-hidden ${
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
                          {act.hora_inicio ? <span>{act.hora_inicio}</span> : <span>Sin horario</span>}
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

                        {!isLeaderView && (
                          <div
                            className="flex items-center gap-1.5 sm:gap-0.5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {canEditItems && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(index)}
                                title="Editar actividad"
                                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onRemoveActividad(index)}
                              title="Mover a papelera"
                              className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
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
                      {(act.para_cliente ||
                        act.tipo_trabajo ||
                        act.parent_task_id ||
                        (act.evidencias && act.evidencias.length > 0)) && (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-400 dark:text-slate-500 mb-2">
                          {act.para_cliente && (
                            <span className="font-medium text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                              {act.para_cliente}
                            </span>
                          )}
                          {act.tipo_trabajo && <span>{act.tipo_trabajo}</span>}
                          {act.parent_task_id && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToRef(act.parent_task_id!, act.tipo_vinculo);
                              }}
                              className="inline-flex items-center gap-0.5 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer"
                              title={act.parent_task_desc || 'Ver tarea origen'}
                            >
                              <Link2 className="w-3 h-3" />
                              <span>Continuación</span>
                            </button>
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
                      <div
                        className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => moveActivity(index, 'prev')}
                          title="Mover a columna anterior"
                          className="min-h-[40px] sm:min-h-0 flex items-center gap-1 px-2.5 sm:px-2 py-1 sm:py-0.5 rounded text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                          <span>Atrás</span>
                        </button>

                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => moveActivity(index, 'next')}
                          title="Avanzar a siguiente columna"
                          className="min-h-[40px] sm:min-h-0 flex items-center gap-1 px-2.5 sm:px-2 py-1 sm:py-0.5 rounded text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 disabled:opacity-25 disabled:pointer-events-none transition-colors cursor-pointer"
                        >
                          <span>Avanzar</span>
                          <ChevronRight className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                        </button>
                      </div>

                      {/* Leader 1-Click Approvals for In-Review Column */}
                      {isLeaderView && act.estado === 'en_revision' && (
                        <div className="mt-2.5 pt-2 border-t border-amber-200/80 dark:border-amber-500/25 bg-amber-50/60 dark:bg-amber-500/10 -mx-3 -mb-3 p-2.5 rounded-b-lg flex items-center justify-between gap-1.5">
                          <div className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Revisión</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onApproveActivity) onApproveActivity(index);
                                else onUpdateEstado(index, 'completada');
                              }}
                              className="min-h-[36px] sm:min-h-0 flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors cursor-pointer"
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
                              className="min-h-[36px] sm:min-h-0 flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-colors cursor-pointer"
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

      {/* UNIFIED CREATION & EDITION MODAL (shared with Mi Bitácora) */}
      <ActividadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        actividadToEdit={editingActividad}
        editIndex={editingIndex}
        onSave={handleSaveModal}
        users={users}
        currentUser={currentUser}
        fecha={fecha}
        existingActividades={actividades}
        defaultEstado={modalDefaultEstado}
      />

      {/* MODAL DETALLE DE ACTIVIDAD DESDE KANBAN */}
      <ActividadDetalleModal
        isOpen={detailIndex !== null}
        onClose={() => setDetailIndex(null)}
        actividad={detailIndex !== null ? actividades[detailIndex] || null : null}
        index={detailIndex}
        fecha={fecha}
        onEdit={(_act, idx) => {
          setDetailIndex(null);
          if (canEditItems) handleOpenEdit(idx);
        }}
        onUpdateEstado={onUpdateEstado}
        onNavigateToRef={(refId, tipo) => {
          setDetailIndex(null);
          handleNavigateToRef(refId, tipo);
        }}
      />

      {/* MODAL INSPECCIÓN DE TAREA VINCULADA / ORIGEN */}
      <ActividadReferenciaModal
        isOpen={refModalOpen}
        onClose={() => setRefModalOpen(false)}
        refId={selectedRefId}
        tipoVinculo={selectedRefVinculo}
        onNavigateToDate={(targetFecha) => {
          if (onDateChange) onDateChange(targetFecha);
        }}
      />

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
