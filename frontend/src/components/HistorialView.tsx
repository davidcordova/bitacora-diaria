import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  User as UserIcon,
  Clock,
  Building2,
  Trash2,
  ExternalLink,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Filter,
  X,
  RotateCcw,
  Eye,
  FileText,
  Users,
  LayoutList,
  LayoutGrid,
  AlertTriangle,
} from 'lucide-react';
import { Bitacora, User, Actividad } from '../types';
import {
  formatDuration,
  formatDateDisplay,
  formatDateLong,
  getTodayLocalDateStr,
  getYesterdayLocalDateStr,
  stripHtml,
} from '../utils/formatters';
import { HistorialResumenModal } from './HistorialResumenModal';
import { EmptyState } from './EmptyState';
import { api } from '../services/api';

interface HistorialViewProps {
  historial: Bitacora[];
  users?: User[];
  currentUser?: User | null;
  onLoadBitacora: (bitacora: Bitacora) => void;
  onDeleteBitacora: (id: number) => void;
}

export const HistorialView: React.FC<HistorialViewProps> = ({
  historial,
  users,
  currentUser,
  onLoadBitacora,
  onDeleteBitacora,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [colaboradorFilter, setColaboradorFilter] = useState('');
  const [selectedBitacoraForModal, setSelectedBitacoraForModal] = useState<Bitacora | null>(null);
  const [displayMode, setDisplayMode] = useState<'list' | 'grid'>('list');
  const [loading, setLoading] = useState(false);
  const [liveHistorial, setLiveHistorial] = useState<Bitacora[]>(historial || []);
  const [filtroActividades, setFiltroActividades] = useState<'activas' | 'todas' | 'estancadas'>('activas');

  const isActividadInactiva = (act: Actividad, bitacoraFecha?: string): boolean => {
    if (act.estado === 'completada') return false;
    if (act.is_stagnant) return true;
    if (typeof act.dias_sin_cambio === 'number' && act.dias_sin_cambio >= 7) return true;
    const dateStr = act.updated_at || act.created_at || (bitacoraFecha ? `${bitacoraFecha} 12:00:00` : null);
    if (!dateStr) return false;
    const cleanStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const ts = new Date(cleanStr).getTime();
    if (isNaN(ts)) return false;
    const days = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
    return days >= 7;
  };

  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const yesterdayStr = useMemo(() => getYesterdayLocalDateStr(), []);

  // Sincronizar si el prop externo 'historial' cambia
  useEffect(() => {
    if (historial && historial.length > 0) {
      setLiveHistorial((prev) => {
        // Combinar evitando duplicados
        const map = new Map<number, Bitacora>();
        historial.forEach((b) => map.set(b.id, b));
        prev.forEach((b) => map.set(b.id, b));
        return Array.from(map.values()).sort((a, b) => (b.fecha > a.fecha ? 1 : b.fecha < a.fecha ? -1 : b.id - a.id));
      });
    }
  }, [historial]);

  // Carga proactiva desde el servidor en montaje y al cambiar filtros
  const fetchFromServer = async (fecha?: string, colab?: string) => {
    setLoading(true);
    try {
      const data = await api.getBitacoras(
        fecha || undefined,
        colab || undefined,
        undefined,
        currentUser?.id
      );
      if (Array.isArray(data)) {
        setLiveHistorial(data);
      }
    } catch (e) {
      console.warn('Error fetching bitacoras in HistorialView:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFromServer(dateFilter, colaboradorFilter);
  }, [dateFilter, colaboradorFilter, currentUser?.id]);

  // PRIVACIDAD POR ROL:
  // Si el usuario es analista (y no líder ni admin), solo puede ver su propia información
  const role = currentUser?.role || 'analista';
  const isAdmin = role === 'admin';
  const isLeader = role === 'lider' || currentUser?.is_leader || isAdmin;
  const isAnalyst = !isLeader && (role === 'analista' || role === 'operador');

  // Base list filtered by role privacy
  const roleFilteredHistorial = useMemo(() => {
    if (!currentUser) return liveHistorial;
    if (isAnalyst) {
      // Los analistas SOLO ven sus propias bitácoras
      return liveHistorial.filter(
        (b) =>
          b.user_id === currentUser.id ||
          (currentUser.full_name && b.colaborador.toLowerCase() === currentUser.full_name.toLowerCase())
      );
    }
    return liveHistorial;
  }, [liveHistorial, currentUser, isAnalyst]);

  // Distinct collaborators list (only for leaders and admins)
  const collaboratorsList = useMemo(() => {
    if (isAnalyst) return [];
    const names = new Set<string>();
    if (users) {
      users.forEach((u) => {
        if (u.full_name) names.add(u.full_name);
      });
    }
    roleFilteredHistorial.forEach((b) => {
      if (b.colaborador) names.add(b.colaborador);
    });
    return Array.from(names).sort();
  }, [roleFilteredHistorial, users, isAnalyst]);

  // Distinct recorded dates for quick jump
  const recordedDates = useMemo(() => {
    const dates = Array.from(new Set(roleFilteredHistorial.map((b) => b.fecha))).filter(Boolean);
    return dates.sort().reverse();
  }, [roleFilteredHistorial]);

  const hasActiveFilters = Boolean(searchTerm || dateFilter || colaboradorFilter);

  const clearFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setColaboradorFilter('');
  };

  const totalStagnantTasks = useMemo(() => {
    let count = 0;
    roleFilteredHistorial.forEach((b) => {
      count += (b.actividades || []).filter((a) => isActividadInactiva(a, b.fecha)).length;
    });
    return count;
  }, [roleFilteredHistorial]);

  const filtered = useMemo(() => {
    return roleFilteredHistorial.filter((b) => {
      // Filter by specific date
      if (dateFilter && b.fecha !== dateFilter) {
        return false;
      }
      // Filter by collaborator (only if leader/admin)
      if (!isAnalyst && colaboradorFilter) {
        const target = colaboradorFilter.trim().toLowerCase();
        const bColab = (b.colaborador || '').trim().toLowerCase();
        const targetUser = users?.find((u) => u.full_name?.trim().toLowerCase() === target);
        const matchesId = targetUser && b.user_id === targetUser.id;
        const matchesName = bColab === target || bColab.includes(target) || target.includes(bColab);
        if (!matchesName && !matchesId) {
          return false;
        }
      }
      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesColab = b.colaborador.toLowerCase().includes(term);
        const matchesFecha = b.fecha.includes(term);
        const matchesArea = b.area.toLowerCase().includes(term);
        const matchesAct = b.actividades.some((a) => stripHtml(a.descripcion).toLowerCase().includes(term));
        if (!matchesColab && !matchesFecha && !matchesArea && !matchesAct) {
          return false;
        }
      }
      // Si el filtro de actividades es 'estancadas', mostrar solo bitácoras que tengan al menos una tarea estancada
      if (filtroActividades === 'estancadas') {
        const hasStagnant = (b.actividades || []).some((a) => isActividadInactiva(a, b.fecha));
        if (!hasStagnant) {
          return false;
        }
      }
      return true;
    });
  }, [roleFilteredHistorial, dateFilter, colaboradorFilter, searchTerm, isAnalyst, users, filtroActividades]);

  return (
    <div className="space-y-4">
      {/* Alerta Destacada de Tareas Estancadas (+7 días) */}
      {totalStagnantTasks > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {totalStagnantTasks} actividad{totalStagnantTasks === 1 ? '' : 'es'} sin cambios desde hace más de 7 días
              </span>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">
                Se han ocultado del historial principal para mantener limpias tus jornadas pasadas. Recibirás recordatorios automáticos cada 7 días hasta que cambien de estado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFiltroActividades((prev) => (prev === 'estancadas' ? 'activas' : 'estancadas'))}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm text-xs shrink-0 self-end sm:self-auto"
          >
            {filtroActividades === 'estancadas' ? 'Ver Historial Normal' : 'Revisar Tareas Estancadas'}
          </button>
        </div>
      )}

      {/* Search and filter controls bar */}
      <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-4 sm:p-5 space-y-3.5 shadow-sm transition-all duration-200">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* 1. Text Search Input */}
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar en descripción de tareas, área o palabras clave..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] text-xs text-slate-800 dark:text-slate-100 rounded-xl border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 outline-hidden transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* 2. Specific Date Picker Input */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className={`pl-8 pr-3 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer outline-hidden ${
                  dateFilter
                    ? 'bg-[#00F0FF]/15 text-[#0090A0] dark:text-[#00F0FF] border-[#00F0FF]/40'
                    : 'bg-slate-50 dark:bg-[#161722] text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-[#252636] hover:bg-slate-100 dark:hover:bg-[#1C1D2A]'
                }`}
                title="Filtrar por fecha específica"
              />
              <Calendar className="w-3.5 h-3.5 text-[#00A3BF] dark:text-[#00F0FF] absolute left-2.5 pointer-events-none" />
            </div>

            {/* Quick date presets */}
            <button
              type="button"
              onClick={() => setDateFilter(todayStr)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === todayStr
                  ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                  : 'bg-slate-100 dark:bg-[#161722] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-[#252636] hover:bg-slate-200 dark:hover:bg-[#1C1D2A]'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setDateFilter(yesterdayStr)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                dateFilter === yesterdayStr
                  ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                  : 'bg-slate-100 dark:bg-[#161722] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-[#252636] hover:bg-slate-200 dark:hover:bg-[#1C1D2A]'
              }`}
            >
              Ayer
            </button>
          </div>

          {/* 3. Collaborator Filter Dropdown (Only visible to Leaders and Admin) */}
          {!isAnalyst && (
            <div className="relative min-w-[200px]">
              <select
                value={colaboradorFilter}
                onChange={(e) => setColaboradorFilter(e.target.value)}
                className={`w-full pl-8 pr-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer outline-hidden ${
                  colaboradorFilter
                    ? 'bg-[#00F0FF]/15 text-[#0090A0] dark:text-[#00F0FF] border-[#00F0FF]/40'
                    : 'bg-slate-50 dark:bg-[#161722] text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-[#252636] hover:bg-slate-100 dark:hover:bg-[#1C1D2A]'
                }`}
              >
                <option value="" className="bg-white dark:bg-[#161722]">Todos los colaboradores</option>
                {collaboratorsList.map((name) => (
                  <option key={name} value={name} className="bg-white dark:bg-[#161722]">
                    {name}
                  </option>
                ))}
              </select>
              <UserIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
            </div>
          )}

          {/* 3.2 Activity Stagnancy Filter */}
          <div className="relative min-w-[195px]">
            <select
              value={filtroActividades}
              onChange={(e) => setFiltroActividades(e.target.value as any)}
              className={`w-full pl-8 pr-3 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer outline-hidden ${
                filtroActividades === 'estancadas'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40'
                  : filtroActividades === 'todas'
                  ? 'bg-slate-50 dark:bg-[#161722] text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-[#252636]'
                  : 'bg-[#00F0FF]/15 text-[#0090A0] dark:text-[#00F0FF] border-[#00F0FF]/40'
              }`}
              title="Filtrar visibilidad de actividades en el historial"
            >
              <option value="activas" className="bg-white dark:bg-[#161722]">
                Ocultar inactivas (Recomendado)
              </option>
              <option value="todas" className="bg-white dark:bg-[#161722]">
                Mostrar todas las tareas
              </option>
              <option value="estancadas" className="bg-white dark:bg-[#161722]">
                ⚠️ Solo estancadas (+7 días)
              </option>
            </select>
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          {/* 3.1 Refresh Button */}
          <button
            type="button"
            onClick={() => fetchFromServer(dateFilter, colaboradorFilter)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-[#161722] hover:bg-slate-200 dark:hover:bg-[#1C1D2A] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-[#252636] rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
            title="Recargar bitácoras del servidor"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#00F0FF]' : ''}`} />
            <span>{loading ? 'Cargando...' : 'Refrescar'}</span>
          </button>

          {/* 4. Reset Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
              title="Limpiar todos los filtros activos"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar filtros</span>
            </button>
          )}
        </div>

        {/* Filter status summary pills */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#252636]/60 text-xs text-slate-500 dark:text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Mostrando <strong className="text-slate-800 dark:text-slate-200">{filtered.length}</strong> de <strong className="text-slate-800 dark:text-slate-200">{roleFilteredHistorial.length}</strong> bitácoras
            </span>
            {dateFilter && (
              <span className="inline-flex items-center gap-1.5 bg-[#00F0FF]/10 text-[#0090A0] dark:text-[#00F0FF] border border-[#00F0FF]/30 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                <Calendar className="w-3 h-3 text-[#00A3BF] dark:text-[#00F0FF]" />
                <span>{formatDateDisplay(dateFilter)}</span>
                <button
                  type="button"
                  onClick={() => setDateFilter('')}
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {!isAnalyst && colaboradorFilter && (
              <span className="inline-flex items-center gap-1.5 bg-[#00F0FF]/10 text-[#0090A0] dark:text-[#00F0FF] border border-[#00F0FF]/30 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                <UserIcon className="w-3 h-3 text-[#00A3BF] dark:text-[#00F0FF]" />
                <span>{colaboradorFilter}</span>
                <button
                  type="button"
                  onClick={() => setColaboradorFilter('')}
                  className="hover:text-rose-500 cursor-pointer ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {/* Right controls: Date quick-jump + View toggle */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Quick jump to date with records */}
            {recordedDates.length > 0 && (
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-slate-400 dark:text-slate-500">Ir a:</span>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-slate-50 dark:bg-[#161722] text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-xl px-2.5 py-1 border border-slate-200/90 dark:border-[#252636] cursor-pointer outline-hidden"
                >
                  <option value="" className="bg-white dark:bg-[#161722]">Seleccionar fecha...</option>
                  {recordedDates.map((d) => (
                    <option key={d} value={d} className="bg-white dark:bg-[#161722]">
                      {d} ({formatDateDisplay(d)})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* View Mode Switcher: Lista vs Tarjetas */}
            <div className="flex items-center bg-slate-100 dark:bg-[#161722] p-0.5 rounded-full border border-slate-200/80 dark:border-[#252636]">
              <button
                type="button"
                onClick={() => setDisplayMode('list')}
                title="Vista de Lista"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  displayMode === 'list'
                    ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('grid')}
                title="Vista de Cuadrícula / Tarjetas"
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  displayMode === 'grid'
                    ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Tarjetas</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No se encontraron bitácoras"
          description="No hay registros guardados que coincidan con la fecha o el término de búsqueda seleccionado."
          actionText={hasActiveFilters ? 'Limpiar Filtros' : undefined}
          onAction={hasActiveFilters ? clearFilters : undefined}
        />
      ) : displayMode === 'list' ? (
        /* VISTA DE LISTA MODERNA (TABLE / LIST VIEW) */
        <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] shadow-sm overflow-hidden transition-all duration-200">
          {/* Table Header (Desktop) */}
          <div className="hidden lg:grid grid-cols-12 gap-3 px-6 py-3.5 bg-slate-50 dark:bg-[#161722] border-b border-slate-100 dark:border-[#252636] text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
            <div className="col-span-2">Fecha</div>
            <div className="col-span-3">Colaborador / Área</div>
            <div className="col-span-2">Actividades & Tiempo</div>
            <div className="col-span-3">Tareas Registradas</div>
            <div className="col-span-1 text-center">Estado</div>
            <div className="col-span-1 text-right">Acciones</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-slate-100 dark:divide-[#252636]/60">
            {filtered.map((item, idx) => {
              const totalMin = item.actividades.reduce(
                (sum, a) => sum + (Number(a.duracion_min) || 0),
                0
              );

              return (
                <div
                  key={item.id || idx}
                  onClick={() => setSelectedBitacoraForModal(item)}
                  className="group px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-[#181A26] transition-colors cursor-pointer"
                >
                  {/* Desktop Row Layout */}
                  <div className="hidden lg:grid grid-cols-12 gap-3 items-center">
                    {/* Col 1: Fecha */}
                    <div className="col-span-2 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30 flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4 text-[#00A3BF] dark:text-[#00F0FF]" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {formatDateDisplay(item.fecha)}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 capitalize">
                          {new Date(`${item.fecha}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short' })}
                        </div>
                      </div>
                    </div>

                    {/* Col 2: Colaborador / Área */}
                    <div className="col-span-3 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#1A1C29] text-slate-700 dark:text-slate-200 font-extrabold text-xs flex items-center justify-center border border-slate-200 dark:border-[#252636] shrink-0">
                        {item.colaborador.charAt(0)}
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate group-hover:text-[#00A3BF] dark:group-hover:text-[#00F0FF] transition-colors">
                          {item.colaborador}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          <span>{item.area}</span>
                        </div>
                      </div>
                    </div>

                    {/* Col 3: Actividades & Tiempo */}
                    <div className="col-span-2">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#00F0FF]/10 text-[#0090A0] dark:text-[#00F0FF] text-xs font-bold border border-[#00F0FF]/25">
                        <Clock className="w-3.5 h-3.5 text-[#00A3BF] dark:text-[#00F0FF]" />
                        <span>{formatDuration(totalMin)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 ml-1">
                        {item.actividades.length} {item.actividades.length === 1 ? 'actividad' : 'actividades'}
                      </div>
                    </div>

                    {/* Col 4: Tareas Registradas */}
                    <div className="col-span-3 pr-2">
                      <div className="space-y-1">
                        {(() => {
                          const actsToShow = (item.actividades || []).filter((act) => {
                            if (filtroActividades === 'todas') return true;
                            if (filtroActividades === 'estancadas') return isActividadInactiva(act, item.fecha);
                            return !isActividadInactiva(act, item.fecha);
                          });
                          const hiddenCount = (item.actividades || []).length - actsToShow.length;

                          if (actsToShow.length === 0) {
                            return (
                              <div className="text-xs text-slate-400 dark:text-slate-500 italic flex items-center gap-1.5 flex-wrap">
                                <span>Sin actividades activas</span>
                                {hiddenCount > 0 && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 font-semibold">
                                    ({hiddenCount} inactiva{hiddenCount > 1 ? 's' : ''} oculta{hiddenCount > 1 ? 's' : ''})
                                  </span>
                                )}
                              </div>
                            );
                          }

                          return (
                            <>
                              {actsToShow.slice(0, 2).map((act, aIdx) => (
                                <div key={aIdx} className="text-xs text-slate-600 dark:text-slate-300 truncate flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] shrink-0" />
                                  <span className="truncate">{stripHtml(act.descripcion)}</span>
                                </div>
                              ))}
                              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                {actsToShow.length > 2 && (
                                  <span className="text-[10px] text-[#00A3BF] dark:text-[#00F0FF] font-bold">
                                    +{actsToShow.length - 2} tareas más...
                                  </span>
                                )}
                                {hiddenCount > 0 && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 font-semibold">
                                    +{hiddenCount} inactiva{hiddenCount > 1 ? 's' : ''} oculta{hiddenCount > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Col 5: Estado */}
                    <div className="col-span-1 text-center">
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 uppercase tracking-wider">
                        {item.estado || 'Generada'}
                      </span>
                    </div>

                    {/* Col 6: Acciones */}
                    <div className="col-span-1 flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBitacoraForModal(item);
                        }}
                        title="Ver Resumen Completo"
                        className="p-2 text-slate-600 dark:text-slate-400 hover:text-[#00A3BF] dark:hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 dark:hover:bg-[#00F0FF]/15 rounded-full transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLoadBitacora(item);
                        }}
                        title="Cargar y Continuar en esta Bitácora"
                        className="p-2 text-slate-600 dark:text-slate-400 hover:text-[#00A3BF] dark:hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 dark:hover:bg-[#00F0FF]/15 rounded-full transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      {item.id && (isAdmin || item.user_id === currentUser?.id) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('¿Estás seguro de eliminar esta bitácora del historial?')) {
                              onDeleteBitacora(item.id as number);
                            }
                          }}
                          title="Eliminar registro"
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile / Tablet Compact Layout */}
                  <div className="lg:hidden flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#00C9A7]" />
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {formatDateDisplay(item.fecha)}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-mint-50 dark:bg-mint-950/40 text-[#00A88B] dark:text-[#00C9A7] border border-emerald-200 dark:border-emerald-800/60 uppercase">
                        {item.estado || 'Generada'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-[10px] flex items-center justify-center">
                          {item.colaborador.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{item.colaborador}</span>
                        <span className="text-slate-400 dark:text-slate-500">• {item.area}</span>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[11px]">
                        <Clock className="w-3 h-3 text-[#00C9A7]" />
                        <span>{formatDuration(totalMin)}</span>
                      </div>
                    </div>

                    {item.actividades.length > 0 && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate bg-slate-50 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[#00C9A7] font-bold">• </span>
                        {stripHtml(item.actividades[0].descripcion)}
                        {item.actividades.length > 1 && ` (+${item.actividades.length - 1} más)`}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBitacoraForModal(item);
                        }}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#00A3BF] dark:hover:text-[#00F0FF] bg-slate-100 dark:bg-[#1A1C29] hover:bg-[#00F0FF]/10 dark:hover:bg-[#00F0FF]/15 px-3.5 py-2 min-h-[38px] rounded-xl cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Resumen</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadBitacora(item);
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-[#0090A0] dark:text-[#00F0FF] bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 px-3.5 py-2 min-h-[38px] rounded-xl cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Cargar</span>
                        </button>
                        {item.id && (isAdmin || item.user_id === currentUser?.id) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('¿Estás seguro de eliminar esta bitácora del historial?')) {
                                onDeleteBitacora(item.id as number);
                              }
                            }}
                            className="p-2 min-w-[38px] min-h-[38px] flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* VISTA DE CUADRÍCULA / TARJETAS (GRID VIEW) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item, idx) => {
            const totalMin = item.actividades.reduce(
              (sum, a) => sum + (Number(a.duracion_min) || 0),
              0
            );

            return (
              <div
                key={item.id || idx}
                onClick={() => setSelectedBitacoraForModal(item)}
                className="group relative bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-5 hover:border-[#00F0FF]/40 dark:hover:border-[#00F0FF]/40 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer border-l-4 border-l-[#00F0FF]"
              >
                <div>
                  {/* Top metadata */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-[#252636]/60 mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-[#00A3BF] dark:text-[#00F0FF]" />
                      <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                        {formatDateDisplay(item.fecha)}
                      </span>
                    </div>
                    <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 uppercase tracking-wider">
                      {item.estado || 'Generada'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 mb-4">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{item.colaborador}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>{item.area}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      <span>
                        {item.actividades.length} actividades •{' '}
                        <strong className="text-slate-800 dark:text-slate-200">{formatDuration(totalMin)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Actividades preview */}
                  <div className="bg-slate-50/80 dark:bg-[#161722] rounded-xl p-3 mb-4 space-y-1.5 max-h-36 overflow-y-auto border border-slate-200/60 dark:border-[#252636]/60">
                    {(() => {
                      const actsToShow = (item.actividades || []).filter((act) => {
                        if (filtroActividades === 'todas') return true;
                        if (filtroActividades === 'estancadas') return isActividadInactiva(act, item.fecha);
                        return !isActividadInactiva(act, item.fecha);
                      });
                      const hiddenCount = (item.actividades || []).length - actsToShow.length;

                      if (actsToShow.length === 0) {
                        return (
                          <div className="text-xs text-slate-400 dark:text-slate-500 italic flex items-center gap-1.5 flex-wrap">
                            <span>Sin actividades activas</span>
                            {hiddenCount > 0 && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 font-semibold">
                                ({hiddenCount} inactiva{hiddenCount > 1 ? 's' : ''} oculta{hiddenCount > 1 ? 's' : ''})
                              </span>
                            )}
                          </div>
                        );
                      }

                      return (
                        <>
                          {actsToShow.slice(0, 3).map((act, aIdx) => (
                            <div key={aIdx} className="text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                              <span className="text-[#00A3BF] dark:text-[#00F0FF] font-bold">•</span>
                              <span className="truncate flex-1">{stripHtml(act.descripcion)}</span>
                            </div>
                          ))}
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            {actsToShow.length > 3 && (
                              <span className="text-[10px] text-[#00A3BF] dark:text-[#00F0FF] font-bold">
                                +{actsToShow.length - 3} actividades más...
                              </span>
                            )}
                            {hiddenCount > 0 && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 font-semibold">
                                +{hiddenCount} inactiva{hiddenCount > 1 ? 's' : ''} oculta{hiddenCount > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-[#252636]/60 mt-auto">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBitacoraForModal(item);
                      }}
                      className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#00A3BF] dark:hover:text-[#00F0FF] bg-slate-100 dark:bg-[#161722] hover:bg-[#00F0FF]/15 px-3 py-1.5 rounded-full border border-slate-200 dark:border-[#252636] transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-400" />
                      <span>Ver Resumen</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadBitacora(item);
                      }}
                      className="flex items-center gap-1 text-xs font-bold text-[#0090A0] dark:text-[#00F0FF] bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 px-3 py-1.5 rounded-full border border-[#00F0FF]/30 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Cargar</span>
                    </button>
                  </div>

                  {/* Delete button: Only allow if admin or owner */}
                  {item.id && (isAdmin || item.user_id === currentUser?.id) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('¿Estás seguro de eliminar esta bitácora del historial?')) {
                          onDeleteBitacora(item.id as number);
                        }
                      }}
                      title="Eliminar registro"
                      className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Historial Resumen Detailed Modal */}
      <HistorialResumenModal
        isOpen={Boolean(selectedBitacoraForModal)}
        onClose={() => setSelectedBitacoraForModal(null)}
        bitacora={selectedBitacoraForModal}
        onLoadInEditor={onLoadBitacora}
        currentUser={currentUser}
        users={users}
      />
    </div>
  );
};
