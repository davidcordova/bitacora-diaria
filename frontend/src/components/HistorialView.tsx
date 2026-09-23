import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { Bitacora, User } from '../types';
import {
  formatDuration,
  formatDateDisplay,
  formatDateLong,
  getTodayLocalDateStr,
  getYesterdayLocalDateStr,
} from '../utils/formatters';
import { HistorialResumenModal } from './HistorialResumenModal';
import { EmptyState } from './EmptyState';

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

  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const yesterdayStr = useMemo(() => getYesterdayLocalDateStr(), []);

  // PRIVACIDAD POR ROL:
  // Si el usuario es analista (y no líder ni admin), solo puede ver su propia información
  const role = currentUser?.role || 'analista';
  const isAdmin = role === 'admin';
  const isLeader = role === 'lider' || currentUser?.is_leader || isAdmin;
  const isAnalyst = !isLeader && (role === 'analista' || role === 'operador');

  // Base list filtered by role privacy
  const roleFilteredHistorial = useMemo(() => {
    if (!currentUser) return historial;
    if (isAnalyst) {
      // Los analistas SOLO ven sus propias bitácoras
      return historial.filter(
        (b) =>
          b.user_id === currentUser.id ||
          (currentUser.full_name && b.colaborador.toLowerCase() === currentUser.full_name.toLowerCase())
      );
    }
    return historial;
  }, [historial, currentUser, isAnalyst]);

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

  const filtered = useMemo(() => {
    return roleFilteredHistorial.filter((b) => {
      // Filter by specific date
      if (dateFilter && b.fecha !== dateFilter) {
        return false;
      }
      // Filter by collaborator (only if leader/admin)
      if (!isAnalyst && colaboradorFilter && b.colaborador !== colaboradorFilter) {
        return false;
      }
      // Filter by search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesColab = b.colaborador.toLowerCase().includes(term);
        const matchesFecha = b.fecha.includes(term);
        const matchesArea = b.area.toLowerCase().includes(term);
        const matchesAct = b.actividades.some((a) => a.descripcion.toLowerCase().includes(term));
        if (!matchesColab && !matchesFecha && !matchesArea && !matchesAct) {
          return false;
        }
      }
      return true;
    });
  }, [roleFilteredHistorial, dateFilter, colaboradorFilter, searchTerm, isAnalyst]);

  return (
    <div className="space-y-4">
      {/* Privacy Notice for Analyst */}
      {isAnalyst && (
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 rounded-2xl text-xs text-slate-700 dark:text-slate-300">
          <UserIcon className="w-4 h-4 text-[#00C9A7] shrink-0" />
          <span>
            <strong>Vista Personal:</strong> Estás viendo exclusivamente tu historial de actividades y bitácoras registradas.
          </span>
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
                        {item.actividades.slice(0, 2).map((act, aIdx) => (
                          <div key={aIdx} className="text-xs text-slate-600 dark:text-slate-300 truncate flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF] shrink-0" />
                            <span className="truncate">{act.descripcion}</span>
                          </div>
                        ))}
                        {item.actividades.length > 2 && (
                          <div className="text-[10px] text-[#00A3BF] dark:text-[#00F0FF] font-bold">
                            +{item.actividades.length - 2} tareas más...
                          </div>
                        )}
                        {item.actividades.length === 0 && (
                          <span className="text-xs text-slate-400 dark:text-slate-500 italic">Sin actividades detalladas</span>
                        )}
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
                        {item.actividades[0].descripcion}
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
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#00A88B] dark:hover:text-[#00C9A7] bg-slate-100 dark:bg-slate-800 hover:bg-mint-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded-full cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver Resumen</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLoadBitacora(item);
                          }}
                          className="flex items-center gap-1 text-xs font-bold text-[#00A88B] dark:text-[#00C9A7] bg-mint-50 dark:bg-mint-950/40 hover:bg-mint-100 dark:hover:bg-mint-900/50 px-3 py-1.5 rounded-full cursor-pointer"
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
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-full cursor-pointer"
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
                    {item.actividades.slice(0, 3).map((act, aIdx) => (
                      <div key={aIdx} className="text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                        <span className="text-[#00A3BF] dark:text-[#00F0FF] font-bold">•</span>
                        <span className="truncate flex-1">{act.descripcion}</span>
                      </div>
                    ))}
                    {item.actividades.length > 3 && (
                      <div className="text-[10px] text-[#00A3BF] dark:text-[#00F0FF] font-bold pt-1">
                        +{item.actividades.length - 3} actividades más...
                      </div>
                    )}
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
