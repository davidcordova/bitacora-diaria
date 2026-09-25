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
    badgeColor: 'bg-slate-100 dark:bg-[#1A1C29] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#252636]',
    icon: <ListTodo className="w-4 h-4 text-slate-400 dark:text-slate-500" />,
    borderColor: 'border-t-slate-400 dark:border-t-slate-600',
  },
  {
    id: 'en_proceso',
    title: 'En Proceso',
    badgeColor: 'bg-[#00F0FF]/15 text-[#0090A0] dark:text-[#00F0FF] border-[#00F0FF]/30',
    icon: <PlayCircle className="w-4 h-4 text-[#00A3BF] dark:text-[#00F0FF]" />,
    borderColor: 'border-t-[#00F0FF]',
  },
  {
    id: 'en_revision',
    title: 'En Revisión',
    badgeColor: 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/60',
    icon: <Eye className="w-4 h-4 text-[#A855F7]" />,
    borderColor: 'border-t-[#A855F7]',
  },
  {
    id: 'completada',
    title: 'Completada',
    badgeColor: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
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
      onUpdateActividadDetalle(editingIndex, editForm);
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
      {/* Informative Business Rules Notice Bar */}
      <div className="bg-white dark:bg-[#13141F] border border-slate-200/90 dark:border-[#252636] border-l-4 border-l-[#00F0FF] rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm transition-all duration-200">
        <div className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300">
          <Info className="w-4 h-4 text-[#00A3BF] dark:text-[#00F0FF] shrink-0" />
          <span>
            <strong className="text-slate-900 dark:text-white">Flujo de Actividades:</strong> Las tareas que no estén en estado{' '}
            <span className="font-bold underline text-[#00A3BF] dark:text-[#00F0FF]">Completada</span> continúan activas, pueden seguir
            editándose y se consideran para tu siguiente bitácora.
          </span>
        </div>

        {onSyncWithBitacora && pendingCount > 0 && (
          <button
            type="button"
            onClick={onSyncWithBitacora}
            className="flex items-center gap-1.5 bg-[#00F0FF] hover:bg-[#00D8E6] active:scale-95 text-slate-950 px-4 py-1.5 rounded-full text-xs font-extrabold shadow-sm shadow-[#00F0FF]/25 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] transition-all shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Sincronizar {pendingCount} activas a Bitácora</span>
          </button>
        )}
      </div>

      {/* Top Filter and Search Bar */}
      <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar actividades por texto, cliente..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] text-xs text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          {uniqueTipos.length > 0 && (
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 dark:bg-[#161722] text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] outline-hidden cursor-pointer"
            >
              <option value="" className="bg-white dark:bg-[#161722]">Todos los tipos</option>
              {uniqueTipos.map((t) => (
                <option key={t} value={t} className="bg-white dark:bg-[#161722]">
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 w-full sm:w-auto justify-between sm:justify-end">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            Colaborador: <span className="text-[#00A3BF] dark:text-[#00F0FF] font-bold">{colaborador}</span>
          </span>
          <span className="text-slate-400 dark:text-slate-500">
            {pendingCount} pendientes • {actividades.length - pendingCount} completadas
          </span>
        </div>
      </div>

      {/* Mobile-Only Status Pill Tabs (< 768px) to Prevent Massive Vertical Scroll */}
      <div className="md:hidden flex items-center gap-1.5 overflow-x-auto pb-1 select-none">
        <button
          type="button"
          onClick={() => setMobileColumnFilter('todas')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer min-h-[34px] ${
            mobileColumnFilter === 'todas'
              ? 'bg-[#00F0FF] text-slate-950 shadow-xs'
              : 'bg-white dark:bg-[#13141F] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#252636]'
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
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 min-h-[34px] ${
                mobileColumnFilter === c.id
                  ? 'bg-[#00F0FF] text-slate-950 shadow-xs'
                  : 'bg-white dark:bg-[#13141F] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#252636]'
              }`}
            >
              <span>{c.title}</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-slate-200">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const colActivities = filteredActivitiesWithIndex.filter(
            ({ act }) => (act.estado || 'pendiente') === col.id
          );
          const colTotalMin = colActivities.reduce(
            (sum, { act }) => sum + (Number(act.duracion_min) || 0),
            0
          );

          // Check if hidden on mobile
          const isHiddenOnMobile = mobileColumnFilter !== 'todas' && mobileColumnFilter !== col.id;

          return (
            <div
              key={col.id}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
              className={`bg-slate-50/70 dark:bg-[#13141F] border border-slate-200/90 dark:border-[#252636] rounded-2xl p-3.5 flex-col min-h-[500px] transition-all border-t-4 ${col.borderColor} ${
                isHiddenOnMobile ? 'hidden md:flex' : 'flex'
              }`}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 dark:border-[#252636]/60">
                <div className="flex items-center gap-2">
                  <span className="text-base">{col.icon}</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{col.title}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-white dark:bg-[#1A1C29] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#252636] shadow-2xs">
                    {colActivities.length}
                  </span>
                </div>

                {colTotalMin > 0 && (
                  <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-white/70 dark:bg-[#1A1C29] px-2.5 py-0.5 rounded-full border border-slate-200/60 dark:border-[#252636]">
                    {formatDuration(colTotalMin)}
                  </span>
                )}
              </div>

              {/* Column Add Card Button */}
              <button
                type="button"
                onClick={() => onAddActividadConEstado(col.id)}
                className="w-full mb-3 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-[#252636] hover:border-[#00F0FF] dark:hover:border-[#00F0FF] bg-white dark:bg-[#161722] hover:bg-slate-50 dark:hover:bg-[#1C1D2A] text-slate-600 dark:text-slate-300 hover:text-[#00A3BF] dark:hover:text-[#00F0FF] text-xs font-bold transition-all cursor-pointer shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Añadir a {col.title}</span>
              </button>

              {/* Cards Container */}
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[600px] pr-0.5">
                {colActivities.map(({ act, index }) => {
                  const estadoInfo = getEstadoBadgeInfo(act.estado);
                  const isFirst = columnOrder.indexOf(col.id) === 0;
                  const isLast = columnOrder.indexOf(col.id) === columnOrder.length - 1;
                  const isCompleted = act.estado === 'completada';
                  const timeInfo = getTimeInStatusInfo(act.updated_at, act.created_at, act.estado);
                  const hasAccumulated =
                    Boolean(act.tiempo_acumulado_min && act.tiempo_acumulado_min > (act.duracion_min || 0));

                  return (
                    <div
                      key={act.id || index}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      className={`bg-white dark:bg-[#161722] rounded-xl border p-3.5 shadow-sm hover:shadow-md hover:border-[#00F0FF]/40 dark:hover:border-[#00F0FF]/40 transition-all cursor-grab active:cursor-grabbing relative group ${
                        timeInfo.isStalled && !isCompleted
                          ? 'border-amber-300 dark:border-amber-500/70 ring-2 ring-amber-200/50 dark:ring-amber-500/20 bg-amber-50/10 dark:bg-amber-950/20'
                          : 'border-slate-200/90 dark:border-[#252636]'
                      } ${draggedIndex === index ? 'opacity-40 scale-98 border-[#00F0FF]' : ''}`}
                    >
                      {/* Collaborator Badge for Group Views */}
                      {(act.colaborador || showCollaboratorBadge) && (
                        <div className="flex items-center justify-between gap-1 mb-2.5 pb-2 border-b border-slate-100 dark:border-[#252636]/60">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-[#00F0FF]/20 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center text-[10px] font-extrabold shadow-2xs border border-[#00F0FF]/30">
                              {(act.colaborador || 'U').charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
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
                              className="flex items-center gap-1 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                              title="Contactar al colaborador por WhatsApp"
                            >
                              <MessageCircle className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                              <span>WhatsApp</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Top Badges & Actions */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {act.hora_inicio && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1A1C29] text-slate-700 dark:text-slate-300 text-[10px] font-medium border border-slate-200 dark:border-[#252636]">
                              <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                              {act.hora_inicio}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00F0FF]/15 text-[#0090A0] dark:text-[#00F0FF] text-[10px] font-extrabold border border-[#00F0FF]/30">
                            <Timer className="w-3 h-3 text-[#00A3BF] dark:text-[#00F0FF]" />
                            {act.duracion_min || 0}m
                          </span>
                          {hasAccumulated && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-[10px] font-bold border border-purple-200 dark:border-purple-800/60"
                              title={`Tiempo acumulado en todas las jornadas: ${act.tiempo_acumulado_min} min (${act.duracion_min || 0} min hoy)`}
                            >
                              <History className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                              <span>{act.tiempo_acumulado_min}m acum.</span>
                            </span>
                          )}
                          {!isCompleted && (
                            <span className="text-[9px] font-bold text-[#0090A0] dark:text-[#00F0FF] bg-[#00F0FF]/10 dark:bg-[#00F0FF]/15 px-2 py-0.5 rounded-full border border-[#00F0FF]/30">
                              Activa
                            </span>
                          )}
                          {(act.parent_task_id || act.is_rollover) && (
                            <span className="text-[9px] font-bold text-[#EC4899] bg-[#EC4899]/15 px-2 py-0.5 rounded-full border border-[#EC4899]/30 inline-flex items-center gap-0.5">
                              <RefreshCw className="w-2.5 h-2.5" />
                              <span>Continuada</span>
                            </span>
                          )}
                          {!isCompleted && timeInfo.isStalled ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 text-[9px] font-bold"
                              title={timeInfo.tooltip}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>{timeInfo.label} (Estancada)</span>
                            </span>
                          ) : !isCompleted && timeInfo.label !== 'Reciente' ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1A1C29] text-slate-600 dark:text-slate-300 text-[9px] font-medium border border-slate-200 dark:border-[#252636]"
                              title={timeInfo.tooltip}
                            >
                              <Clock className="w-2.5 h-2.5 text-slate-400" />
                              <span>{timeInfo.label}</span>
                            </span>
                          ) : null}
                          {act.evidencias && act.evidencias.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEvidencias(act.evidencias || []);
                                setViewerIndex(0);
                                setViewerOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#0090A0] dark:text-[#00F0FF] text-[10px] font-bold border border-[#00F0FF]/30 transition cursor-pointer"
                              title={`Ver ${act.evidencias.length} evidencias adjuntas`}
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{act.evidencias.length}</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(index)}
                            title="Editar actividad"
                            className="p-1 text-slate-400 dark:text-slate-400 hover:text-[#00A3BF] dark:hover:text-[#00F0FF] rounded-full hover:bg-slate-100 dark:hover:bg-[#1A1C29] transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveActividad(index)}
                            title="Eliminar tarea"
                            className="p-1 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Work Type Tag & Link Reference */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                        {act.tipo_trabajo && (
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-[#1A1C29] text-slate-700 dark:text-slate-300 text-[10px] font-semibold border border-slate-200 dark:border-[#252636]">
                            {act.tipo_trabajo}
                          </span>
                        )}
                        {act.parent_task_id && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold text-cyan-600 dark:text-[#00F0FF] bg-cyan-50 dark:bg-[#00F0FF]/15 border border-[#00F0FF]/30 truncate max-w-[140px]"
                            title={act.parent_task_desc ? `Vinculada: ${act.parent_task_desc}` : `Vinculada con actividad #${act.parent_task_id}`}
                          >
                            <Link2 className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">Ref #{act.parent_task_id}</span>
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      <div className="mb-2">
                        {act.descripcion ? (
                          <RichHtmlRenderer
                            content={act.descripcion}
                            clampLines={3}
                            className="text-xs text-slate-800 dark:text-slate-200 font-normal leading-relaxed"
                          />
                        ) : (
                          <p className="text-xs text-slate-400 dark:text-slate-500 italic">(Sin descripción)</p>
                        )}
                      </div>

                      {/* Comentarios en tarjeta Kanban */}
                      {act.comentarios && (
                        <div className="mb-2 p-1.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-500/20 text-[10px] text-amber-900 dark:text-amber-200 flex items-start gap-1">
                          <MessageSquare className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 leading-tight">{act.comentarios}</span>
                        </div>
                      )}

                      {/* Client / Target */}
                      {act.para_cliente && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-3 flex items-center gap-1">
                          <span className="text-slate-400 dark:text-slate-500 font-normal">Para:</span>
                          <span className="text-slate-700 dark:text-slate-200">{act.para_cliente}</span>
                        </div>
                      )}

                      {/* Bottom Mobile / Quick Advance Actions */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-1">
                        <button
                          type="button"
                          disabled={isFirst}
                          onClick={() => moveActivity(index, 'prev')}
                          title="Mover a columna anterior"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                          <ChevronLeft className="w-3 h-3" />
                          <span className="hidden sm:inline">Atrás</span>
                        </button>

                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${estadoInfo.bg}`}>
                          {estadoInfo.label}
                        </span>

                        <button
                          type="button"
                          disabled={isLast}
                          onClick={() => moveActivity(index, 'next')}
                          title="Avanzar a siguiente columna"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold text-[#00A88B] dark:text-[#00C9A7] hover:bg-mint-50 dark:hover:bg-mint-500/15 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        >
                          <span className="hidden sm:inline">Avanzar</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Leader 1-Click Approvals for In-Review Column */}
                      {isLeaderView && act.estado === 'en_revision' && (
                        <div className="mt-2.5 pt-2 border-t border-amber-200/80 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/40 -mx-3.5 -mb-3.5 p-2.5 rounded-b-2xl flex items-center justify-between gap-1.5">
                          <div className="text-[10px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span>Revisión Líder:</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onApproveActivity) onApproveActivity(index);
                                else onUpdateEstado(index, 'completada');
                              }}
                              className="flex items-center gap-1 px-3 py-1 rounded-full bg-[#00C9A7] hover:bg-[#00B894] active:scale-95 text-white text-[10px] font-bold transition-all shadow-xs cursor-pointer"
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
                              className="flex items-center gap-1 px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-bold transition-all cursor-pointer"
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
                  <div className="h-32 border-2 border-dashed border-slate-200/90 dark:border-slate-800 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-600 text-xs text-center p-4">
                    Sin actividades aquí.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL EDICIÓN DE ACTIVIDAD DIRECTA DESDE KANBAN */}
      {editingIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#13141F] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/90 dark:border-[#252636] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80 dark:border-[#252636]">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-[#00F0FF]" />
                <span>Editar Actividad</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingIndex(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/80 dark:border-[#252636] focus:outline-hidden focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 transition-all"
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/80 dark:border-[#252636] focus:outline-hidden focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Tipo de trabajo</label>
                <select
                  value={editForm.tipo_trabajo || ''}
                  onChange={(e) => setEditForm({ ...editForm, tipo_trabajo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/80 dark:border-[#252636] focus:outline-hidden focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 transition-all"
                >
                  <option value="" className="dark:bg-[#161722]">Seleccionar...</option>
                  {TIPOS_TRABAJO.map((t) => (
                    <option key={t} value={t} className="dark:bg-[#161722]">
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
                  onAttachEvidence={(newEv) => {
                    const current = editForm.evidencias || [];
                    setEditForm({ ...editForm, evidencias: [...current, newEv] });
                  }}
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Para / Cliente</label>
                <input
                  type="text"
                  value={editForm.para_cliente || ''}
                  onChange={(e) => setEditForm({ ...editForm, para_cliente: e.target.value })}
                  placeholder="Ej: RR.HH., Cliente XYZ"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/80 dark:border-[#252636] focus:outline-hidden focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 transition-all"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Comentarios (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={editForm.comentarios || ''}
                  onChange={(e) => setEditForm({ ...editForm, comentarios: e.target.value })}
                  placeholder="Notas internas, observaciones o bloqueos..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/80 dark:border-[#252636] focus:outline-hidden focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Estado</label>
                <select
                  value={editForm.estado || 'pendiente'}
                  onChange={(e) =>
                    setEditForm({ ...editForm, estado: e.target.value as EstadoActividad })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200/80 dark:border-[#252636] focus:outline-hidden focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 transition-all"
                >
                  <option value="pendiente" className="dark:bg-[#161722]">Por Iniciar</option>
                  <option value="en_proceso" className="dark:bg-[#161722]">En Proceso</option>
                  <option value="en_revision" className="dark:bg-[#161722]">En Revisión</option>
                  <option value="completada" className="dark:bg-[#161722]">Completada</option>
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
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1C1D2A] rounded-full font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 font-bold px-6 py-2.5 rounded-full shadow-sm shadow-[#00F0FF]/20 cursor-pointer transition-all"
                >
                  Guardar Cambios
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
