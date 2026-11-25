import React, { useState, useEffect } from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Briefcase,
  Filter,
  BarChart3,
  Layers,
  Sparkles,
  Activity,
  PieChart,
  LineChart,
  Flame,
  Compass,
  RefreshCw,
  Zap,
  Calendar,
  ShieldCheck,
  Building,
  UserCheck,
} from 'lucide-react';
import { DashboardStats, Team, User } from '../types';
import { formatDuration, formatHoursClean, formatDateDisplay, getTodayLocalDateStr, shiftDateByDays } from '../utils/formatters';
import { api } from '../services/api';
import { EmptyState } from './EmptyState';
import { SplineAreaChart, GradientBarChart, CyberDonutChart } from './CyberCharts';

interface DashboardViewProps {
  currentUser: User | null;
  teams: Team[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, teams }) => {
  const isLider = currentUser?.role === 'lider' || currentUser?.is_leader;
  const isAdmin = currentUser?.role === 'admin';
  const isLiderOrAdmin = isAdmin || isLider;
  const isOperador = !isLiderOrAdmin;

  // Ámbito de visualización: para operadores siempre es 'personal'; para admin/líder pueden alternar
  const [viewScope, setViewScope] = useState<'global' | 'personal'>(isOperador ? 'personal' : 'global');
  const isPersonalScope = isOperador || viewScope === 'personal';

  // Squad / team del líder
  const leaderTeam = teams.find(
    (t) => t.lider_id === currentUser?.id || t.id === currentUser?.team_id
  );

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>(() => {
    if (currentUser?.role === 'lider') {
      return leaderTeam ? leaderTeam.id : (currentUser?.team_id || '');
    }
    return '';
  });

  // Auto-sync si los equipos se cargan asíncronamente
  useEffect(() => {
    if (currentUser?.role === 'lider' && !selectedTeamId) {
      const lt = teams.find(
        (t) => t.lider_id === currentUser?.id || t.id === currentUser?.team_id
      );
      if (lt) {
        setSelectedTeamId(lt.id);
      }
    }
  }, [teams, currentUser, selectedTeamId]);

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [periodRange, setPeriodRange] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  // Controles de gráficos interactivos
  const [splineMetric, setSplineMetric] = useState<'actividades' | 'minutos'>('actividades');
  const [donutCategory, setDonutCategory] = useState<'tipo' | 'estado' | 'cliente'>('tipo');
  const [barMetricType, setBarMetricType] = useState<'colaboradores' | 'horarios' | 'clientes'>(
    isPersonalScope ? 'horarios' : 'colaboradores'
  );

  const fetchStats = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const activeTeamId = !isPersonalScope
        ? (selectedTeamId ? Number(selectedTeamId) : (currentUser?.role === 'lider' ? (leaderTeam?.id || currentUser?.team_id) : undefined))
        : undefined;

      const todayStr = getTodayLocalDateStr();
      let fechaExacta: string | undefined;
      let fechaDesde: string | undefined;
      let fechaHasta: string | undefined;

      if (periodRange === 'today') {
        fechaExacta = todayStr;
      } else if (periodRange === '7d') {
        fechaDesde = shiftDateByDays(todayStr, -6);
        fechaHasta = todayStr;
      } else if (periodRange === '30d') {
        fechaDesde = shiftDateByDays(todayStr, -29);
        fechaHasta = todayStr;
      }

      const data = await api.getDashboardStats(
        activeTeamId,
        fechaExacta,
        currentUser?.id,
        isPersonalScope ? currentUser?.id : undefined,
        fechaDesde,
        fechaHasta
      );
      setStats(data);
    } catch (e: any) {
      console.error('Error fetching dashboard stats', e);
      setFetchError(e?.message || 'No se pudieron cargar las estadísticas desde el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [selectedTeamId, viewScope, periodRange, currentUser?.id]);

  const totalMinutos = stats?.resumen?.total_minutos || 0;
  const totalBitacoras = stats?.resumen?.total_bitacoras || 0;
  const totalColaboradores = stats?.resumen?.total_colaboradores || 0;

  // Cálculos de actividades
  const totalActividades = stats?.por_estado?.reduce((sum, item) => sum + item.cantidad, 0) || 0;
  const completadas = stats?.por_estado?.find((e) => e.estado === 'completada')?.cantidad || 0;
  const porcentajeCompletadas =
    totalActividades > 0 ? Math.round((completadas / totalActividades) * 100) : 0;

  // KPIs Adicionales
  const promedioJornada =
    stats?.kpis_adicionales?.promedio_minutos_jornada ||
    (totalBitacoras > 0 ? Math.round(totalMinutos / totalBitacoras) : 0);
  const ratioPlanificado = stats?.kpis_adicionales?.ratio_planificado ?? 0;

  // Datos para Gráfico Donut / Pastel
  const donutTipoData = (stats?.por_tipo || []).map((t) => ({
    label: t.tipo,
    value: t.cantidad,
    sublabel: formatHoursClean(t.minutos),
  }));

  const donutEstadoData = (stats?.por_estado || []).map((e) => {
    const labels: Record<string, string> = {
      completada: 'Completadas',
      en_proceso: 'En Proceso',
      en_revision: 'En Revisión',
      pendiente: 'Por Iniciar',
    };
    const colors: Record<string, string> = {
      completada: '#10B981',
      en_proceso: 'var(--accent-primary)',
      en_revision: '#F59E0B',
      pendiente: '#94A3B8',
    };
    return {
      label: labels[e.estado] || e.estado,
      value: e.cantidad,
      color: colors[e.estado],
      sublabel: formatHoursClean(e.minutos),
    };
  });

  const donutClienteData = (stats?.por_cliente || []).map((c) => ({
    label: c.cliente,
    value: c.cantidad,
    sublabel: formatHoursClean(c.minutos),
  }));

  // Datos para Gráfico de Barras
  const barColabData = (stats?.por_colaborador || []).map((c) => {
    const rate =
      c.total_actividades > 0
        ? Math.round((c.actividades_completadas / c.total_actividades) * 100)
        : 0;
    return {
      label:
        c.colaborador.split(' ')[0] +
        (c.colaborador.split(' ')[1] ? ` ${c.colaborador.split(' ')[1][0]}.` : ''),
      value: Math.round((c.total_minutos / 60) * 10) / 10,
      sublabel: `${rate}% completado`,
    };
  });

  const barHorariosData = (stats?.distribucion_horaria || []).map((h) => ({
    label: h.franja,
    value: h.cantidad,
    sublabel: formatHoursClean(h.minutos),
  }));

  const barClientesData = (stats?.por_cliente || []).map((c) => ({
    label: c.cliente.length > 13 ? `${c.cliente.slice(0, 11)}..` : c.cliente,
    value: Math.round((c.minutos / 60) * 10) / 10,
    sublabel: `${c.cantidad} tareas`,
  }));

  const getBarData = () => {
    if (barMetricType === 'colaboradores' && !isPersonalScope) return barColabData;
    if (barMetricType === 'clientes') return barClientesData;
    return barHorariosData;
  };

  const getDonutData = () => {
    if (donutCategory === 'estado') return donutEstadoData;
    if (donutCategory === 'cliente') return donutClienteData;
    return donutTipoData;
  };

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto pb-8">
      {/* ================= BARRA DE FILTROS MINIMALISTA (SIN DOBLE TÍTULO) ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Periodo Temporal */}
          <div className="flex items-center bg-slate-100/90 dark:bg-white/[0.05] p-0.5 rounded-lg shrink-0">
            {[
              { id: 'today', label: 'Hoy' },
              { id: '7d', label: '7 días' },
              { id: '30d', label: '30 días' },
              { id: 'all', label: 'Histórico' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodRange(p.id as any)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  periodRange === p.id
                    ? 'bg-white dark:bg-[#1E2330] text-slate-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Selector de Ámbito: Equipo vs Mi Rendimiento */}
          {isLiderOrAdmin && (
            <div className="flex items-center bg-slate-100/90 dark:bg-white/[0.05] p-0.5 rounded-lg shrink-0">
              <button
                type="button"
                onClick={() => {
                  setViewScope('global');
                  setBarMetricType('colaboradores');
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  viewScope === 'global'
                    ? 'bg-white dark:bg-[#1E2330] text-slate-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Equipo
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewScope('personal');
                  setBarMetricType('horarios');
                }}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  viewScope === 'personal'
                    ? 'bg-white dark:bg-[#1E2330] text-slate-900 dark:text-white shadow-2xs font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Mi rendimiento
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {currentUser?.role === 'admin' && !isPersonalScope && (
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : '')}
              aria-label="Filtrar por equipo"
              className="h-8 px-2.5 bg-white dark:bg-[#12151D] text-xs font-medium text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200/80 dark:border-white/[0.08] focus:outline-hidden focus:border-sky-500 cursor-pointer"
            >
              <option value="" className="dark:bg-[#191D28]">Todos los equipos</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id} className="dark:bg-[#191D28]">
                  {t.nombre}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={fetchStats}
            title="Actualizar datos"
            aria-label="Actualizar datos"
            className="w-8 h-8 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600 dark:text-sky-400' : ''}`} />
          </button>
        </div>
      </div>

      {fetchError && !loading ? (
        <EmptyState
          icon={AlertTriangle}
          title="Error al cargar estadísticas"
          description={fetchError}
          actionText="Reintentar"
          onAction={fetchStats}
        />
      ) : !loading && totalBitacoras === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={isPersonalScope ? 'Sin estadísticas registradas aún' : 'Sin estadísticas de equipo aún'}
          description={
            isPersonalScope
              ? 'Completa tu jornada diaria para ver tus métricas personales aquí.'
              : 'Cuando el equipo registre actividades en este periodo, verás las métricas aquí.'
          }
          actionText={selectedTeamId && !isPersonalScope ? 'Ver todos los equipos' : undefined}
          onAction={selectedTeamId && !isPersonalScope ? () => setSelectedTeamId('') : undefined}
        />
      ) : (
        <div className={`space-y-5 transition-opacity duration-200 ${loading ? 'opacity-65 pointer-events-none' : 'opacity-100'}`}>
          {/* ================= 4 TARJETAS KPI UNIFORMES Y MINIMALISTAS ================= */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="saas-card p-4 sm:p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>Horas registradas</span>
                <Clock className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums truncate">
                  {formatHoursClean(totalMinutos)}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  {totalBitacoras} {totalBitacoras === 1 ? 'jornada' : 'jornadas'}
                </div>
              </div>
            </div>

            <div className="saas-card p-4 sm:p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>{isPersonalScope ? 'Jornadas' : 'Equipo activo'}</span>
                {isPersonalScope ? (
                  <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                ) : (
                  <Users className="w-4 h-4 text-sky-500" />
                )}
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums truncate">
                  {isPersonalScope ? totalBitacoras : totalColaboradores}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  {isPersonalScope ? 'Días con bitácora' : 'Personas con registro'}
                </div>
              </div>
            </div>

            <div className="saas-card p-4 sm:p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>Actividades</span>
                <Layers className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums truncate">
                  {totalActividades}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  {completadas} completadas
                </div>
              </div>
            </div>

            <div className="saas-card p-4 sm:p-5 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                <span>Completitud</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums truncate">
                  {porcentajeCompletadas}%
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                  Tasa de cierre
                </div>
              </div>
            </div>
          </div>

          {/* ================= RESUMEN OPERATIVO EN UNA LÍNEA ================= */}
          <div className="saas-card px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400 dark:text-slate-500">Promedio diario:</span>
              <strong className="font-semibold text-slate-900 dark:text-white tabular-nums">
                {formatHoursClean(promedioJornada)}
              </strong>
              <span className="text-[11px] text-slate-400 tabular-nums">
                ({Math.min(100, Math.round((promedioJornada / 480) * 100))}% de 8h)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Compass className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-400 dark:text-slate-500">
                {isPersonalScope ? 'Ritmo diario:' : 'Promedio por persona:'}
              </span>
              <strong className="font-semibold text-slate-900 dark:text-white tabular-nums">
                {isPersonalScope
                  ? totalBitacoras > 0
                    ? `${(totalActividades / totalBitacoras).toFixed(1)} tareas/día`
                    : '0'
                  : totalColaboradores > 0
                  ? `${(totalActividades / totalColaboradores).toFixed(1)} tareas`
                  : '0'}
              </strong>
            </div>

            {ratioPlanificado > 0 && (
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="text-slate-400 dark:text-slate-500">Planificado:</span>
                <strong className="font-semibold text-slate-900 dark:text-white tabular-nums">
                  {ratioPlanificado}%
                </strong>
              </div>
            )}
          </div>

          {/* ================= ALERTA DE APOYO / BLOQUEOS ================= */}
          {isPersonalScope ? (
            stats?.alertas_apoyo && stats.alertas_apoyo.length > 0 ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300 font-bold text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Tienes solicitudes de apoyo o bloqueos activos registrados</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {stats.alertas_apoyo.map((alerta) => (
                    <div
                      key={alerta.id}
                      className="bg-white dark:bg-[#1E222D] rounded-xl p-3 border border-amber-500/30 text-xs shadow-2xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{alerta.fecha}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-bold">
                          Pendiente
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">
                        {alerta.apoyo_detalle || 'Sin detalle especificado'}
                      </p>
                      {alerta.pendientes && (
                        <p className="text-slate-400 text-[11px] truncate">
                          Tareas pendientes: {alerta.pendientes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3.5 flex items-center justify-between text-xs text-emerald-700 dark:text-emerald-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    Sin bloqueos activos registrados • Tus tareas y jornadas fluyen con normalidad.
                  </span>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold hidden sm:inline">
                  ÓPTIMO
                </span>
              </div>
            )
          ) : (
            stats?.alertas_apoyo && stats.alertas_apoyo.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span>Atención Inmediata: Solicitudes de apoyo o bloqueos activos del equipo</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {stats.alertas_apoyo.map((alerta) => (
                    <div
                      key={alerta.id}
                      className="bg-white dark:bg-[#1E222D] rounded-2xl p-4 border border-amber-500/30 text-xs shadow-2xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">{alerta.colaborador}</span>
                        <span className="text-slate-400 text-[11px] font-mono">{alerta.fecha}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-amber-500">Bloqueo: </span>
                        <span className="text-slate-700 dark:text-slate-300">{alerta.apoyo_detalle || 'Sin detalle especificado'}</span>
                      </div>
                      {alerta.pendientes && (
                        <div className="text-slate-500 dark:text-slate-400 text-[11px] truncate">
                          Pendientes: {alerta.pendientes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          )}

          {/* ================= SECCIÓN 1: GRÁFICO DE LÍNEAS / SPLINE ÁREA (TENDENCIA) ================= */}
          <div className="saas-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-white/[0.06]">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>
                    {isPersonalScope ? 'Mi Tendencia de Producción & Horas' : 'Tendencia Diaria de Producción & Tiempo'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {isPersonalScope
                    ? 'Tendencia diaria de tus actividades y horas trabajadas por jornada'
                    : 'Tendencia diaria de actividades y horas registradas por jornada'}
                </p>
              </div>

              {/* Selector de Métrica */}
              <div className="flex items-center bg-slate-100 dark:bg-[#1E222D] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSplineMetric('actividades')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    splineMetric === 'actividades'
                      ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Por Actividades
                </button>
                <button
                  type="button"
                  onClick={() => setSplineMetric('minutos')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    splineMetric === 'minutos'
                      ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Por Horas
                </button>
              </div>
            </div>

            <SplineAreaChart
              data={stats?.tendencia_diaria || []}
              metric={splineMetric}
              height={220}
            />
          </div>

          {/* ================= SECCIÓN 2: DOS COLUMNAS (DONUT CHART & BAR CHART) ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Gráfico Pastel / Donut (6 cols) */}
            <div className="lg:col-span-6 saas-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <span>
                      Desglose {donutCategory === 'tipo' ? 'por Tipo de Trabajo' : donutCategory === 'cliente' ? 'por Cliente / Proyecto' : 'por Estado'}
                    </span>
                  </h3>

                  {/* Toggle Tipo vs Estado vs Cliente */}
                  <div className="flex items-center bg-slate-100 dark:bg-[#1E222D] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08] self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setDonutCategory('tipo')}
                      className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                        donutCategory === 'tipo'
                          ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Tipo
                    </button>
                    <button
                      type="button"
                      onClick={() => setDonutCategory('cliente')}
                      className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                        donutCategory === 'cliente'
                          ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Cliente
                    </button>
                    <button
                      type="button"
                      onClick={() => setDonutCategory('estado')}
                      className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                        donutCategory === 'estado'
                          ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Estado
                    </button>
                  </div>
                </div>

                <CyberDonutChart
                  data={getDonutData()}
                  centerTitle={String(totalActividades)}
                  centerSubtitle="Actividades"
                  valueFormatter={(v) => `${v} tareas`}
                />
              </div>
            </div>

            {/* Columna Derecha: Gráfico de Barras con Gradiente (6 cols) */}
            <div className="lg:col-span-6 saas-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>
                      {barMetricType === 'colaboradores'
                        ? 'Horas / Analista'
                        : barMetricType === 'clientes'
                        ? 'Horas / Cliente'
                        : 'Tareas / Franja Horaria'}
                    </span>
                  </h3>

                  {/* Toggle Metric Types */}
                  <div className="flex items-center bg-slate-100 dark:bg-[#1E222D] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08] self-start sm:self-auto">
                    {!isPersonalScope && (
                      <button
                        type="button"
                        onClick={() => setBarMetricType('colaboradores')}
                        className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                          barMetricType === 'colaboradores'
                            ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        Analistas
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setBarMetricType('horarios')}
                      className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                        barMetricType === 'horarios'
                          ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Horas Día
                    </button>
                    <button
                      type="button"
                      onClick={() => setBarMetricType('clientes')}
                      className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-lg transition-all cursor-pointer ${
                        barMetricType === 'clientes'
                          ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Clientes
                    </button>
                  </div>
                </div>

                <GradientBarChart
                  data={getBarData()}
                  valueFormatter={(val) =>
                    barMetricType === 'colaboradores' || barMetricType === 'clientes' ? `${val}h` : `${val} acts`
                  }
                  height={220}
                />
              </div>
            </div>
          </div>

          {/* ================= SECCIÓN 3: TABLA / TARJETAS DE RENDIMIENTO ================= */}
          {isPersonalScope ? (
            <div className="saas-card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Jornadas recientes</span>
                </h3>
                <span className="text-xs text-slate-400 tabular-nums">
                  {stats?.jornadas_recientes?.length || 0} jornadas
                </span>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06]">
                {stats?.jornadas_recientes && stats.jornadas_recientes.length > 0 ? (
                  stats.jornadas_recientes.map((j, i) => {
                    const rate =
                      j.total_actividades > 0
                        ? Math.round((j.actividades_completadas / j.total_actividades) * 100)
                        : 0;
                    return (
                      <div key={j.id || i} className="py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900 dark:text-white tabular-nums">
                            {formatDateDisplay(j.fecha)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            {formatHoursClean(j.tiempo_total_min)} · {j.actividades_completadas}/{j.total_actividades} tareas
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums shrink-0 ${
                            rate >= 80
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : rate >= 50
                              ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {rate}%
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400">Sin jornadas registradas aún.</p>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 font-medium border-b border-slate-100 dark:border-white/[0.06]">
                      <th className="pb-2.5">Fecha</th>
                      <th className="pb-2.5">Horas</th>
                      <th className="pb-2.5">Tareas</th>
                      <th className="pb-2.5">Completadas</th>
                      <th className="pb-2.5">Bloqueos</th>
                      <th className="pb-2.5 text-right">Efectividad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                    {stats?.jornadas_recientes && stats.jornadas_recientes.length > 0 ? (
                      stats.jornadas_recientes.map((j, i) => {
                        const rate =
                          j.total_actividades > 0
                            ? Math.round((j.actividades_completadas / j.total_actividades) * 100)
                            : 0;
                        return (
                          <tr key={j.id || i} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 font-medium text-slate-900 dark:text-white tabular-nums">
                              {formatDateDisplay(j.fecha)}
                            </td>
                            <td className="py-3 font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                              {formatHoursClean(j.tiempo_total_min)}
                            </td>
                            <td className="py-3 text-slate-600 dark:text-slate-300 tabular-nums">
                              {j.total_actividades}
                            </td>
                            <td className="py-3 text-sky-700 dark:text-sky-400 font-semibold tabular-nums">
                              {j.actividades_completadas}
                            </td>
                            <td className="py-3 text-slate-500 dark:text-slate-400">
                              {j.necesita_apoyo === 'Si' ? (
                                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>
                                    {j.apoyo_detalle
                                      ? j.apoyo_detalle.length > 30
                                        ? `${j.apoyo_detalle.slice(0, 30)}...`
                                        : j.apoyo_detalle
                                      : 'Reportado'}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                                  rate >= 80
                                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : rate >= 50
                                    ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    : 'bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {rate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No tienes jornadas registradas en este periodo aún.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="saas-card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Rendimiento por colaborador</span>
                </h3>
                <span className="text-xs text-slate-400 tabular-nums">
                  {stats?.por_colaborador?.length || 0} personas
                </span>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06]">
                {stats?.por_colaborador && stats.por_colaborador.length > 0 ? (
                  stats.por_colaborador.map((c, i) => {
                    const rate =
                      c.total_actividades > 0
                        ? Math.round((c.actividades_completadas / c.total_actividades) * 100)
                        : 0;
                    return (
                      <div key={i} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200 flex items-center justify-center text-xs font-semibold shrink-0">
                            {c.colaborador.charAt(0)}
                          </span>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {c.colaborador}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatHoursClean(c.total_minutos)} · {c.actividades_completadas}/{c.total_actividades} tareas · {c.bitacoras_count}d
                            </div>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums shrink-0 ${
                            rate >= 80
                              ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                              : rate >= 50
                              ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {rate}%
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="py-6 text-center text-xs text-slate-400">Sin registros en este periodo.</p>
                )}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 font-medium border-b border-slate-100 dark:border-white/[0.06]">
                      <th className="pb-2.5">Colaborador</th>
                      <th className="pb-2.5">Equipo</th>
                      <th className="pb-2.5">Jornadas</th>
                      <th className="pb-2.5">Tiempo</th>
                      <th className="pb-2.5">Actividades</th>
                      <th className="pb-2.5">Completadas</th>
                      <th className="pb-2.5 text-right">Rendimiento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.05]">
                    {stats?.por_colaborador && stats.por_colaborador.length > 0 ? (
                      stats.por_colaborador.map((c, i) => {
                        const rate =
                          c.total_actividades > 0
                            ? Math.round((c.actividades_completadas / c.total_actividades) * 100)
                            : 0;
                        return (
                          <tr key={i} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02] transition-colors">
                            <td className="py-3 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-semibold">
                                {c.colaborador.charAt(0)}
                              </span>
                              <span>{c.colaborador}</span>
                            </td>
                            <td className="py-3 text-slate-500 dark:text-slate-400">{c.team_name || 'General'}</td>
                            <td className="py-3 text-slate-600 dark:text-slate-300 tabular-nums">{c.bitacoras_count}</td>
                            <td className="py-3 font-semibold text-slate-800 dark:text-slate-100 tabular-nums">{formatHoursClean(c.total_minutos)}</td>
                            <td className="py-3 text-slate-600 dark:text-slate-300 tabular-nums">{c.total_actividades}</td>
                            <td className="py-3 text-sky-700 dark:text-sky-400 font-semibold tabular-nums">
                              {c.actividades_completadas}
                            </td>
                            <td className="py-3 text-right">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums ${
                                  rate >= 80
                                    ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                    : rate >= 50
                                    ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                                    : 'bg-slate-100 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {rate}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          No hay registros de colaboradores en este periodo.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
