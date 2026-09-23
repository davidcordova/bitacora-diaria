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
} from 'lucide-react';
import { DashboardStats, Team, User } from '../types';
import { formatDuration } from '../utils/formatters';
import { api } from '../services/api';
import { EmptyState } from './EmptyState';
import { SplineAreaChart, GradientBarChart, CyberDonutChart } from './CyberCharts';

interface DashboardViewProps {
  currentUser: User | null;
  teams: Team[];
}

export const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, teams }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<number | ''>(
    currentUser?.role === 'lider' && currentUser.team_id ? currentUser.team_id : ''
  );
  const [loading, setLoading] = useState(true);

  // Controles de gráficos interactivos
  const [splineMetric, setSplineMetric] = useState<'actividades' | 'minutos'>('actividades');
  const [donutCategory, setDonutCategory] = useState<'tipo' | 'estado'>('tipo');
  const [barMetricType, setBarMetricType] = useState<'colaboradores' | 'horarios'>('colaboradores');

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await api.getDashboardStats(
        selectedTeamId ? Number(selectedTeamId) : undefined,
        undefined,
        currentUser?.id
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
  }, [selectedTeamId]);

  const totalMinutos = stats?.resumen?.total_minutos || 0;
  const totalBitacoras = stats?.resumen?.total_bitacoras || 0;
  const totalColaboradores = stats?.resumen?.total_colaboradores || 0;

  // Cálculos de actividades
  const totalActividades = stats?.por_estado?.reduce((sum, item) => sum + item.cantidad, 0) || 0;
  const completadas = stats?.por_estado?.find((e) => e.estado === 'completada')?.cantidad || 0;
  const porcentajeCompletadas =
    totalActividades > 0 ? Math.round((completadas / totalActividades) * 100) : 0;

  // KPIs Adicionales
  const promedioJornada = stats?.kpis_adicionales?.promedio_minutos_jornada || (totalBitacoras > 0 ? Math.round(totalMinutos / totalBitacoras) : 0);
  const ratioPlanificado = stats?.kpis_adicionales?.ratio_planificado ?? 0;

  // Datos para Gráfico Donut / Pastel
  const donutTipoData = (stats?.por_tipo || []).map((t) => ({
    label: t.tipo,
    value: t.cantidad,
    sublabel: formatDuration(t.minutos),
  }));

  const donutEstadoData = (stats?.por_estado || []).map((e) => {
    const labels: Record<string, string> = {
      completada: 'Completadas',
      en_proceso: 'En Proceso',
      en_revision: 'En Revisión',
      pendiente: 'Por Iniciar',
    };
    const colors: Record<string, string> = {
      completada: '#00F0FF',
      en_proceso: '#6366F1',
      en_revision: '#F59E0B',
      pendiente: '#94A3B8',
    };
    return {
      label: labels[e.estado] || e.estado,
      value: e.cantidad,
      color: colors[e.estado],
      sublabel: formatDuration(e.minutos),
    };
  });

  // Datos para Gráfico de Barras
  const barColabData = (stats?.por_colaborador || []).map((c) => {
    const rate = c.total_actividades > 0 ? Math.round((c.actividades_completadas / c.total_actividades) * 100) : 0;
    return {
      label: c.colaborador.split(' ')[0] + (c.colaborador.split(' ')[1] ? ` ${c.colaborador.split(' ')[1][0]}.` : ''),
      value: Math.round(c.total_minutos / 60 * 10) / 10,
      sublabel: `${rate}% completado`,
    };
  });

  const barHorariosData = (stats?.distribucion_horaria || []).map((h) => ({
    label: h.franja,
    value: h.cantidad,
    sublabel: formatDuration(h.minutos),
  }));

  return (
    <div className="space-y-6 max-w-[1700px] mx-auto pb-10">
      {/* ================= BARRA SUPERIOR DE TELEMETRÍA ================= */}
      <div className="saas-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#00F0FF]/15 text-[#00F0FF] flex items-center justify-center shrink-0 shadow-xs border border-[#00F0FF]/25">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight font-heading">
                Centro de Telemetría & Rendimiento
              </h2>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30">
                <span className="w-2 h-2 rounded-full bg-[#00F0FF] beacon-pulse" />
                <span>En vivo</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {currentUser?.role === 'admin'
                ? 'Consola global de operaciones, horas y distribución de proyectos'
                : `Supervisión de escuadrón: ${currentUser?.team_name || 'Mi Equipo'}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto self-end sm:self-center">
          <button
            type="button"
            onClick={fetchStats}
            title="Actualizar telemetría"
            className="p-2 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#00F0FF]' : ''}`} />
          </button>

          {/* Filtro por equipo si es admin */}
          {currentUser?.role === 'admin' && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value ? Number(e.target.value) : '')}
                className="px-4 py-2 bg-slate-50 dark:bg-[#13141F] hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-full border border-slate-200 dark:border-white/10 focus:outline-hidden focus:border-[#00F0FF] cursor-pointer min-h-[38px]"
              >
                <option value="" className="dark:bg-[#13141F]">Todos los Equipos</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id} className="dark:bg-[#13141F]">
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
          title="Sin estadísticas registradas aún"
          description="Aún no se han guardado bitácoras o actividades para el equipo o periodo seleccionado. Una vez que los colaboradores completen sus jornadas, verás métricas en tiempo real aquí."
          actionText={selectedTeamId ? 'Ver Todos los Equipos' : undefined}
          onAction={selectedTeamId ? () => setSelectedTeamId('') : undefined}
        />
      ) : (
        <>
          {/* ================= 4 METRIC CARDS DE ALTO IMPACTO ================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {/* Card 1: Horas Totales */}
            <div className="saas-card p-6 flex flex-col justify-between h-44 hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200/60 dark:border-white/10">
                  <Clock className="w-5 h-5 text-[#00F0FF]" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  VOLUMEN
                </span>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading">
                  {formatDuration(totalMinutos)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00F0FF]" />
                  <span>En {totalBitacoras} {totalBitacoras === 1 ? 'jornada' : 'jornadas'} registradas</span>
                </div>
              </div>
            </div>

            {/* Card 2: SPOTLIGHT CARD HERO (CIAN A ÍNDIGO) */}
            <div className="saas-card-accent p-6 flex flex-col justify-between h-44 relative overflow-hidden group transition-all duration-300">
              <div className="absolute -right-6 -bottom-6 w-36 h-36 bg-white/20 rounded-full blur-2xl pointer-events-none group-hover:scale-125 transition-transform" />
              
              <div className="flex items-center justify-between relative z-10">
                <div className="w-10 h-10 rounded-2xl bg-black/20 text-[#0B0C13] flex items-center justify-center backdrop-blur-xs">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-extrabold text-[#0B0C13]/90 uppercase tracking-widest bg-black/15 px-3 py-0.5 rounded-full font-mono">
                  EQUIPO ACTIVO
                </span>
              </div>
              <div className="relative z-10">
                <div className="text-3xl sm:text-4xl font-extrabold text-[#0B0C13] tracking-tight font-heading">
                  {totalColaboradores}
                </div>
                <div className="text-xs text-[#0B0C13]/85 font-bold mt-1">
                  Colaboradores supervisados con actividad
                </div>
              </div>
            </div>

            {/* Card 3: Total Actividades */}
            <div className="saas-card p-6 flex flex-col justify-between h-44 hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 flex items-center justify-center border border-slate-200/60 dark:border-white/10">
                  <Layers className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                  ACTIVIDADES
                </span>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight font-heading">
                  {totalActividades}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  {completadas} completadas de {totalActividades}
                </div>
              </div>
            </div>

            {/* Card 4: Tasa de Completitud & Eficiencia */}
            <div className="saas-card p-6 flex flex-col justify-between h-44 hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-[#00F0FF]/15 text-[#00F0FF] flex items-center justify-center border border-[#00F0FF]/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-[#00A3BF] dark:text-[#00F0FF] uppercase tracking-wider bg-[#00F0FF]/10 px-2.5 py-0.5 rounded-full font-mono">
                  {porcentajeCompletadas}% META
                </span>
              </div>
              <div>
                <div className="text-3xl sm:text-4xl font-extrabold text-[#00A3BF] dark:text-[#00F0FF] tracking-tight font-heading">
                  {porcentajeCompletadas}%
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
                  Tasa de entrega satisfactoria
                </div>
              </div>
            </div>
          </div>

          {/* ================= SECONDARY TELEMETRY STRIP (MÉTRICAS OPERATIVAS) ================= */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="saas-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Promedio por Jornada
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                    {formatDuration(promedioJornada)}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">/ día</span>
            </div>

            <div className="saas-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-[#00F0FF] border border-cyan-500/20">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Trabajo Planificado
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                    {ratioPlanificado > 0 ? `${ratioPlanificado}%` : 'Flexible'}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">vs Reactivo</span>
            </div>

            <div className="saas-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Carga por Persona
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white font-heading">
                    {totalColaboradores > 0 ? (totalActividades / totalColaboradores).toFixed(1) : 0}
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">tareas / pers.</span>
            </div>
          </div>

          {/* ================= ALERTA DE APOYO / BLOQUEOS ================= */}
          {stats?.alertas_apoyo && stats.alertas_apoyo.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-300 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Atención Inmediata: Solicitudes de apoyo o bloqueos activos</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {stats.alertas_apoyo.map((alerta) => (
                  <div
                    key={alerta.id}
                    className="bg-white dark:bg-[#13141F] rounded-2xl p-4 border border-amber-500/30 text-xs shadow-2xs space-y-1.5"
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
          )}

          {/* ================= SECCIÓN 1: GRÁFICO DE LÍNEAS / SPLINE ÁREA (TENDENCIA) ================= */}
          <div className="saas-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <LineChart className="w-4 h-4 text-[#00F0FF]" />
                  <span>Tendencia Diaria de Producción & Tiempo</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Curva spline de telemetría de actividades y horas registradas por jornada
                </p>
              </div>

              {/* Selector de Métrica */}
              <div className="flex items-center bg-slate-100 dark:bg-black/30 p-1 rounded-full border border-slate-200 dark:border-white/10 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setSplineMetric('actividades')}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    splineMetric === 'actividades'
                      ? 'bg-[#00F0FF] text-slate-950 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Por Actividades
                </button>
                <button
                  type="button"
                  onClick={() => setSplineMetric('minutos')}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    splineMetric === 'minutos'
                      ? 'bg-[#00F0FF] text-slate-950 shadow-xs'
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
              height={260}
            />
          </div>

          {/* ================= SECCIÓN 2: DOS COLUMNAS (DONUT CHART & BAR CHART) ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Columna Izquierda: Gráfico Pastel / Donut (6 cols) */}
            <div className="lg:col-span-6 saas-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-white/5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#EC4899]" />
                    <span>Desglose {donutCategory === 'tipo' ? 'por Tipo de Trabajo' : 'por Estado'}</span>
                  </h3>

                  {/* Toggle Tipo vs Estado */}
                  <div className="flex items-center bg-slate-100 dark:bg-black/30 p-1 rounded-full border border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setDonutCategory('tipo')}
                      className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
                        donutCategory === 'tipo'
                          ? 'bg-[#EC4899] text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Tipo
                    </button>
                    <button
                      type="button"
                      onClick={() => setDonutCategory('estado')}
                      className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
                        donutCategory === 'estado'
                          ? 'bg-[#EC4899] text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Estado
                    </button>
                  </div>
                </div>

                <CyberDonutChart
                  data={donutCategory === 'tipo' ? donutTipoData : donutEstadoData}
                  centerTitle={String(totalActividades)}
                  centerSubtitle="Actividades"
                  valueFormatter={(v) => `${v} tareas`}
                />
              </div>
            </div>

            {/* Columna Derecha: Gráfico de Barras con Gradiente (6 cols) */}
            <div className="lg:col-span-6 saas-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-white/5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-[#00F0FF]" />
                    <span>Distribución de Carga ({barMetricType === 'colaboradores' ? 'Horas / Analista' : 'Tareas / Franja'})</span>
                  </h3>

                  {/* Toggle Colaboradores vs Horarios */}
                  <div className="flex items-center bg-slate-100 dark:bg-black/30 p-1 rounded-full border border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setBarMetricType('colaboradores')}
                      className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
                        barMetricType === 'colaboradores'
                          ? 'bg-[#00F0FF] text-slate-950 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Analistas
                    </button>
                    <button
                      type="button"
                      onClick={() => setBarMetricType('horarios')}
                      className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full transition-all cursor-pointer ${
                        barMetricType === 'horarios'
                          ? 'bg-[#00F0FF] text-slate-950 shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Horas
                    </button>
                  </div>
                </div>

                <GradientBarChart
                  data={barMetricType === 'colaboradores' ? barColabData : barHorariosData}
                  valueFormatter={(val) => (barMetricType === 'colaboradores' ? `${val}h` : `${val} acts`)}
                  height={240}
                />
              </div>
            </div>
          </div>

          {/* ================= SECCIÓN 3: TABLA DE PRODUCTIVIDAD ================= */}
          <div className="saas-card p-6">
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100 dark:border-white/5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-[#00F0FF]" />
                <span>Productividad y Tasa de Éxito por Colaborador</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">Supervisión en tiempo real</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-semibold border-b border-slate-100 dark:border-white/5 pb-2">
                    <th className="pb-3">Colaborador</th>
                    <th className="pb-3">Equipo</th>
                    <th className="pb-3">Jornadas</th>
                    <th className="pb-3">Tiempo Total</th>
                    <th className="pb-3">Actividades</th>
                    <th className="pb-3">Completadas</th>
                    <th className="pb-3 text-right">Rendimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {stats?.por_colaborador && stats.por_colaborador.length > 0 ? (
                    stats.por_colaborador.map((c, i) => {
                      const rate =
                        c.total_actividades > 0
                          ? Math.round((c.actividades_completadas / c.total_actividades) * 100)
                          : 0;
                      return (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/3 transition-colors">
                          <td className="py-3.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center text-[10px] font-extrabold border border-[#00F0FF]/30">
                              {c.colaborador.charAt(0)}
                            </span>
                            <span>{c.colaborador}</span>
                          </td>
                          <td className="py-3.5 text-slate-500 dark:text-slate-400">{c.team_name || 'General'}</td>
                          <td className="py-3.5 text-slate-600 dark:text-slate-300 font-mono">{c.bitacoras_count}</td>
                          <td className="py-3.5 font-bold text-slate-900 dark:text-white font-mono">{formatDuration(c.total_minutos)}</td>
                          <td className="py-3.5 text-slate-600 dark:text-slate-300 font-mono">{c.total_actividades}</td>
                          <td className="py-3.5 text-[#00A3BF] dark:text-[#00F0FF] font-bold font-mono">
                            {c.actividades_completadas}
                          </td>
                          <td className="py-3.5 text-right">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-bold font-mono ${
                                rate >= 80
                                  ? 'bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30'
                                  : rate >= 50
                                  ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                  : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
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
        </>
      )}
    </div>
  );
};
