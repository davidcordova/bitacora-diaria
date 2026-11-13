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
  const [periodRange, setPeriodRange] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  // Controles de gráficos interactivos
  const [splineMetric, setSplineMetric] = useState<'actividades' | 'minutos'>('actividades');
  const [donutCategory, setDonutCategory] = useState<'tipo' | 'estado' | 'cliente'>('tipo');
  const [barMetricType, setBarMetricType] = useState<'colaboradores' | 'horarios' | 'clientes'>(
    isPersonalScope ? 'horarios' : 'colaboradores'
  );

  const fetchStats = async () => {
    setLoading(true);
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
    } catch (e) {
      console.error('Error fetching dashboard stats', e);
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
    <div className="space-y-6 max-w-[1700px] mx-auto pb-10">
      {/* ================= BARRA SUPERIOR DE DASHBOARD ================= */}
      <div className="saas-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-200/70 dark:border-sky-500/20">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight font-heading">
                {isPersonalScope ? 'Mi Rendimiento' : 'Dashboard'}
              </h2>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                · {isPersonalScope ? 'Vista personal' : 'Equipo'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto self-end sm:self-center flex-wrap">
          {/* Selector de Periodo Temporal */}
          <div className="flex items-center bg-slate-100 dark:bg-[#1E222D] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08] shrink-0">
            {[
              { id: 'today', label: 'Hoy' },
              { id: '7d', label: '7 Días' },
              { id: '30d', label: '30 Días' },
              { id: 'all', label: 'Histórico' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodRange(p.id as any)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  periodRange === p.id
                    ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Selector de Ámbito: Global vs Personal (Solo para Líderes y Admin) */}
          {isLiderOrAdmin && (
            <div className="flex items-center bg-slate-100 dark:bg-[#1E222D] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08] shrink-0">
              <button
                type="button"
                onClick={() => {
                  setViewScope('global');
                  setBarMetricType('colaboradores');
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewScope === 'global'
                    ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Global Equipo
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewScope('personal');
                  setBarMetricType('horarios');
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  viewScope === 'personal'
                    ? 'bg-white dark:bg-sky-600 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Mi Rendimiento
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={fetchStats}
            title="Actualizar datos"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600 dark:text-sky-400' : ''}`} />
          </button>

          {/* Filtro por equipo si es admin y está en vista global */}
          {currentUser?.role === 'admin' && !isPersonalScope && (
            <div className="flex items-center gap-2 shrink-0">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : '')}
                className="px-3.5 py-2 bg-slate-50 dark:bg-[#1E222D] hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-white/[0.08] focus:outline-hidden focus:border-sky-500 cursor-pointer min-h-[38px]"
              >
                <option value="" className="dark:bg-[#1E222D]">Todos los Equipos</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} className="dark:bg-[#1E222D]">
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {!loading && totalBitacoras === 0 ? (
        <EmptyState
          icon={BarChart3}
          title={isPersonalScope ? "Sin estadísticas registradas aún" : "Sin estadísticas de equipo aún"}
          description={
            isPersonalScope
              ? "Aún no has registrado jornadas o actividades en tu bitácora. Completa tu jornada diaria para ver tus métricas personales aquí."
              : "Aún no se han guardado bitácoras o actividades para el equipo o periodo seleccionado. Una vez que los colaboradores completen sus jornadas, verás métricas en tiempo real aquí."
          }
          actionText={selectedTeamId && !isPersonalScope ? 'Ver Todos los Equipos' : undefined}
          onAction={selectedTeamId && !isPersonalScope ? () => setSelectedTeamId('') : undefined}
        />
      ) : (
        <div className={`space-y-6 transition-opacity duration-200 ${loading ? 'opacity-65 pointer-events-none' : 'opacity-100'}`}>
          {/* ================= 4 METRIC CARDS ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Horas Totales */}
            <div className="saas-card p-5 sm:p-6 flex flex-col justify-between min-h-[144px]">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200/60 dark:border-white/[0.08]">
                  <Clock className="w-4.5 h-4.5 text-sky-600 dark:text-sky-400" />
                </div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  {isPersonalScope ? 'MI VOLUMEN' : 'VOLUMEN'}
                </span>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading truncate">
                  {formatHoursClean(totalMinutos)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-1.5 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                  <span>
                    {totalMinutos.toLocaleString('es-PE')} min en {totalBitacoras} {totalBitacoras === 1 ? 'jornada' : 'jornadas'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: SPOTLIGHT CARD */}
            <div className="saas-card-accent p-5 sm:p-6 flex flex-col justify-between min-h-[144px] relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center">
                  {isPersonalScope ? <Calendar className="w-4.5 h-4.5" /> : <Users className="w-4.5 h-4.5" />}
                </div>
                <span className="text-[11px] font-semibold text-white/90 uppercase tracking-wider bg-white/15 px-2.5 py-0.5 rounded-md">
                  {isPersonalScope ? 'JORNADAS' : 'EQUIPO ACTIVO'}
                </span>
              </div>
              <div className="relative z-10">
                <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-heading truncate">
                  {isPersonalScope ? `${totalBitacoras} registradas` : totalColaboradores}
                </div>
                <div className="text-xs text-white/85 font-medium mt-1 truncate">
                  {isPersonalScope
                    ? 'Días con bitácora guardada en el periodo'
                    : 'Colaboradores supervisados con actividad'}
                </div>
              </div>
            </div>

            {/* Card 3: Total Actividades */}
            <div className="saas-card p-5 sm:p-6 flex flex-col justify-between min-h-[144px]">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/[0.05] text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200/60 dark:border-white/[0.08]">
                  <Layers className="w-4.5 h-4.5 text-indigo-500 dark:text-indigo-400" />
                </div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  ACTIVIDADES
                </span>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading truncate">
                  {totalActividades}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 truncate">
                  {completadas} completadas de {totalActividades}
                </div>
              </div>
            </div>

            {/* Card 4: Tasa de Completitud & Eficiencia */}
            <div className="saas-card p-5 sm:p-6 flex flex-col justify-between min-h-[144px]">
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-200/70 dark:border-emerald-500/20">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                </div>
                <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-md">
                  META
                </span>
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading truncate">
                  {porcentajeCompletadas}%
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 truncate">
                  {isPersonalScope ? 'Efectividad sobre tareas asignadas' : 'Tasa de entrega satisfactoria'}
                </div>
              </div>
            </div>
          </div>

          {/* ================= SECONDARY TELEMETRY STRIP (MÉTRICAS OPERATIVAS) ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="saas-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-500/20">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Promedio Diario vs Meta (8h)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                      {formatHoursClean(promedioJornada)}
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      promedioJornada >= 450
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : promedioJornada >= 360
                        ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'bg-slate-100 dark:bg-white/[0.08] text-slate-600 dark:text-slate-400'
                    }`}>
                      {Math.min(100, Math.round((promedioJornada / 480) * 100))}% de 8h
                    </span>
                  </div>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">/ jornada</span>
            </div>

            <div className="saas-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-500/20">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Trabajo Planificado
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                    {ratioPlanificado > 0 ? `${ratioPlanificado}%` : '0% (Reactivo)'}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">vs Reactivo</span>
            </div>

            <div className="saas-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    {isPersonalScope ? 'Ritmo Diario' : 'Carga Promedio'}
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                    {isPersonalScope
                      ? (totalBitacoras > 0 ? (totalActividades / totalBitacoras).toFixed(1) : '0')
                      : (totalColaboradores > 0 ? (totalActividades / totalColaboradores).toFixed(1) : '0')}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                {isPersonalScope ? 'tareas / jornada' : 'prom. periodo'}
              </span>
            </div>
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

          {/* ================= SECCIÓN 3: TABLA DE RENDIMIENTO SEGÚN ROL ================= */}
          {isPersonalScope ? (
            /* Vista Operador / Personal: Historial de sus jornadas */
            <div className="saas-card p-6">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Historial de Mis Jornadas y Rendimiento</span>
                </h3>
                <span className="text-xs text-slate-400 font-mono">
                  {stats?.jornadas_recientes?.length || 0} jornadas registradas
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-100 dark:border-white/[0.06] pb-2">
                      <th className="pb-3">Fecha</th>
                      <th className="pb-3">Horas Registradas</th>
                      <th className="pb-3">Tareas Totales</th>
                      <th className="pb-3">Completadas</th>
                      <th className="pb-3">Bloqueos Reportados</th>
                      <th className="pb-3 text-right">Efectividad</th>
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
                          <tr key={j.id || i} className="hover:bg-slate-50 dark:hover:bg-white/[0.025] transition-colors">
                            <td className="py-3.5 font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              <span>{formatDateDisplay(j.fecha)}</span>
                            </td>
                            <td className="py-3.5 font-bold text-slate-900 dark:text-white font-mono">
                              {formatHoursClean(j.tiempo_total_min)}
                            </td>
                            <td className="py-3.5 text-slate-600 dark:text-slate-300 font-mono">
                              {j.total_actividades}
                            </td>
                            <td className="py-3.5 text-sky-700 dark:text-sky-400 font-bold font-mono">
                              {j.actividades_completadas}
                            </td>
                            <td className="py-3.5 text-slate-600 dark:text-slate-300">
                              {j.necesita_apoyo === 'Si' ? (
                                <span className="inline-flex items-center gap-1 text-amber-500 font-semibold">
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
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Sin bloqueos</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 text-right">
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono ${
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
            /* Vista Admin / Líder: Tabla de colaboradores */
            <div className="saas-card p-6">
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-white/[0.06]">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Productividad y Tasa de Éxito por Colaborador</span>
                </h3>
                <span className="text-xs text-slate-400 font-medium">Supervisión en tiempo real</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-slate-400 font-semibold border-b border-slate-100 dark:border-white/[0.06] pb-2">
                      <th className="pb-3">Colaborador</th>
                      <th className="pb-3">Equipo</th>
                      <th className="pb-3">Jornadas</th>
                      <th className="pb-3">Tiempo Total</th>
                      <th className="pb-3">Actividades</th>
                      <th className="pb-3">Completadas</th>
                      <th className="pb-3 text-right">Rendimiento</th>
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
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/[0.025] transition-colors">
                            <td className="py-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200 flex items-center justify-center text-[10px] font-bold">
                                {c.colaborador.charAt(0)}
                              </span>
                              <span>{c.colaborador}</span>
                            </td>
                            <td className="py-3.5 text-slate-500 dark:text-slate-400">{c.team_name || 'General'}</td>
                            <td className="py-3.5 text-slate-600 dark:text-slate-300 font-mono">{c.bitacoras_count}</td>
                            <td className="py-3.5 font-bold text-slate-900 dark:text-white font-mono">{formatHoursClean(c.total_minutos)}</td>
                            <td className="py-3.5 text-slate-600 dark:text-slate-300 font-mono">{c.total_actividades}</td>
                            <td className="py-3.5 text-sky-700 dark:text-sky-400 font-bold font-mono">
                              {c.actividades_completadas}
                            </td>
                            <td className="py-3.5 text-right">
                              <span
                                className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono ${
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
