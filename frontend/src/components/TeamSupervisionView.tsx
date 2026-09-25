import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  Kanban as KanbanIcon,
  LayoutList,
  AlertCircle,
  ShieldAlert,
  Download,
  MessageCircle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Eye,
  Star,
  User as UserIcon,
  X,
  ExternalLink,
  ChevronDown,
  ArrowRight,
  BarChart2,
  Radio,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { User, Bitacora, Team, Actividad, EstadoActividad, LiveFeedActividad } from '../types';
import { KanbanBoard } from './KanbanBoard';
import { ResumenPreview } from './ResumenPreview';
import { EmptyState } from './EmptyState';
import {
  formatDuration,
  formatDateDisplay,
  formatDateLong,
  getTodayLocalDateStr,
  getYesterdayLocalDateStr,
  shiftDateByDays,
  exportActivitiesToCSV,
} from '../utils/formatters';
import { api } from '../services/api';
import { RichHtmlRenderer } from './RichHtmlRenderer';

interface TeamSupervisionViewProps {
  currentUser: User | null;
  teams: Team[];
  users?: User[];
}

export const TeamSupervisionView: React.FC<TeamSupervisionViewProps> = ({ currentUser, teams, users }) => {
  // Date selection state: Defaults to today (local timezone)
  const [selectedDate, setSelectedDate] = useState<string>(getTodayLocalDateStr());
  // Team selection filter for admin / leaders with multiple teams: 'all' or team ID
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  // 'all' for Master Team View, or user ID for Individual View
  const [selectedMemberId, setSelectedMemberId] = useState<number | 'all'>('all');
  // In Team Mode: 'feed' (realtime live stream), 'semaforo' (workload radar) or 'kanban' (board)
  const [teamTab, setTeamTab] = useState<'feed' | 'semaforo' | 'kanban'>('feed');
  // Side drawer for inspecting a member's activities without switching view
  const [drawerMemberId, setDrawerMemberId] = useState<number | null>(null);

  const [teamBitacoras, setTeamBitacoras] = useState<Bitacora[]>([]);
  const [liveActivities, setLiveActivities] = useState<LiveFeedActividad[]>([]);
  const [subView, setSubView] = useState<'kanban' | 'resumen'>('kanban');
  const [loading, setLoading] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [feedSearch, setFeedSearch] = useState('');

  const todayStr = useMemo(() => getTodayLocalDateStr(), []);
  const yesterdayStr = useMemo(() => getYesterdayLocalDateStr(), []);

  const handlePrevDay = () => setSelectedDate((prev) => shiftDateByDays(prev, -1));
  const handleNextDay = () => setSelectedDate((prev) => shiftDateByDays(prev, 1));
  const handleToday = () => setSelectedDate(todayStr);
  const handleYesterday = () => setSelectedDate(yesterdayStr);

  const isSelectedToday = selectedDate === todayStr;
  const isSelectedYesterday = selectedDate === yesterdayStr;

  // Teams mapping dictionary
  const teamsMap = useMemo(() => {
    const map = new Map<number, Team>();
    teams.forEach((t) => map.set(t.id, t));
    return map;
  }, [teams]);

  // Filter teams accessible to this leader / admin
  const accessibleTeams = useMemo(() => {
    return currentUser?.role === 'admin' || currentUser?.role === 'lider' || currentUser?.is_leader
      ? teams
      : teams.filter((t) => t.id === currentUser?.team_id || t.lider_id === currentUser?.id);
  }, [teams, currentUser]);

  const primaryTeam = accessibleTeams[0] || teams[0] || null;

  // Flatten accessible members using both users list and teams list
  const allMembers = useMemo(() => {
    if (users && users.length > 0) {
      let filteredUsers = users.filter((u) => u.is_active !== 0 && (u.is_active as any) !== false);

      if (currentUser?.role === 'admin' || currentUser?.role === 'lider' || currentUser?.is_leader) {
        if (selectedTeamFilter !== 'all') {
          const tid = Number(selectedTeamFilter);
          filteredUsers = filteredUsers.filter((u) => u.team_id === tid);
        }
      } else {
        // Operador/Analista: miembros de su propio equipo
        const leaderTeamIds = new Set(accessibleTeams.map((t) => t.id));
        filteredUsers = filteredUsers.filter(
          (u) =>
            (u.team_id && leaderTeamIds.has(u.team_id)) ||
            u.id === currentUser?.id ||
            accessibleTeams.some((t) => t.members?.some((m) => m.id === u.id))
        );
        if (selectedTeamFilter !== 'all') {
          const tid = Number(selectedTeamFilter);
          filteredUsers = filteredUsers.filter((u) => u.team_id === tid);
        }
      }

      return filteredUsers.map((u) => ({
        ...u,
        team_name: (u.team_id && teamsMap.get(u.team_id)?.nombre) || u.team_name || 'Sin Equipo',
      }));
    }

    // Fallback if users prop is not provided:
    const list: User[] = [];
    accessibleTeams.forEach((t) => {
      if (t.members) {
        t.members.forEach((m) => {
          if (!list.some((existing) => existing.id === m.id)) {
            list.push({ ...m, team_name: t.nombre });
          }
        });
      }
    });
    return list;
  }, [accessibleTeams, users, currentUser, selectedTeamFilter, teamsMap]);

  // Load bitacoras and live activities for all members in the accessible teams
  const loadAllTeamData = async () => {
    setLoading(true);
    try {
      const teamIdParam = selectedTeamFilter !== 'all' ? selectedTeamFilter : undefined;
      const [bitacorasList, liveRes] = await Promise.all([
        api.getBitacoras(selectedDate, undefined, teamIdParam ? Number(teamIdParam) : undefined, currentUser?.id),
        api.getEquipoActividadesEnVivo(selectedDate, currentUser?.id, teamIdParam).catch(() => ({
          actividades: [],
          fecha: selectedDate,
          success: true,
          total: 0,
        })),
      ]);

      // Filter bitacoras that belong to accessible members
      const memberNames = new Set(allMembers.map((m) => m.full_name.toLowerCase()));
      const memberUsernames = new Set(allMembers.map((m) => (m.username || '').toLowerCase()).filter(Boolean));
      const memberIds = new Set(allMembers.map((m) => m.id));

      const filteredBitacoras = (bitacorasList || []).filter(
        (b) =>
          (b.user_id && memberIds.has(b.user_id)) ||
          memberNames.has((b.colaborador || '').toLowerCase()) ||
          memberUsernames.has((b.colaborador || '').toLowerCase())
      );

      setTeamBitacoras(filteredBitacoras);
      setLiveActivities(liveRes.actividades || []);
      setLastRefreshTime(new Date());
    } catch (e) {
      console.error('Error fetching team bitacoras', e);
    } finally {
      setLoading(false);
    }
  };

  // Immediate fetch on mount, date change, or team filter change
  useEffect(() => {
    loadAllTeamData();
  }, [selectedDate, selectedTeamFilter, currentUser?.id]);

  // Periodic Auto-refresh polling every 20 seconds so leaders always see live activities
  useEffect(() => {
    const interval = setInterval(() => {
      loadAllTeamData();
    }, 20000);
    return () => clearInterval(interval);
  }, [selectedDate, selectedTeamFilter, currentUser?.id, allMembers.length]);

  // List of unique dates that have recorded bitacoras for quick jump
  const recordedDates = useMemo(() => {
    const dates = Array.from(new Set(teamBitacoras.map((b) => b.fecha))).filter(Boolean);
    return dates.sort().reverse();
  }, [teamBitacoras]);

  // Workload radar calculation per member for selectedDate
  const memberWorkload = useMemo(() => {
    return allMembers.map((member) => {
      // Find bitacora matching member AND selectedDate
      const memberLogs = teamBitacoras.filter(
        (b) =>
          b.user_id === member.id ||
          b.colaborador.toLowerCase() === member.full_name.toLowerCase() ||
          (member.username && b.colaborador.toLowerCase() === member.username.toLowerCase())
      );
      const dateLog = memberLogs.find((b) => b.fecha === selectedDate) || null;

      const activities = dateLog ? (dateLog.actividades || []).filter((a) => !a.is_deleted) : [];
      const totalMinutos = activities.reduce(
        (sum, a) => sum + (Number(a.duracion_min) || 0),
        0
      );
      const completedCount = activities.filter((a) => a.estado === 'completada').length;
      const inReviewCount = activities.filter((a) => a.estado === 'en_revision').length;
      const inProgressCount = activities.filter((a) => a.estado === 'en_proceso').length;
      const needsSupport = dateLog?.necesita_apoyo === 'Si';

      let statusType: 'optimo' | 'bajo' | 'sobrecarga' | 'sin_registro' = 'optimo';
      let statusLabel = 'Carga Óptima';
      let statusBadge = 'bg-[#E6F9F5] text-[#00A88B] border-[#00C9A7]/30';
      let barColor = 'bg-[#00C9A7]';

      if (totalMinutos === 0) {
        statusType = 'sin_registro';
        statusLabel = 'Sin registro';
        statusBadge = 'bg-slate-100 text-slate-500 border-slate-200';
        barColor = 'bg-slate-300';
      } else if (totalMinutos < 360) {
        statusType = 'bajo';
        statusLabel = 'Bajo Registro (<6h)';
        statusBadge = 'bg-amber-50 text-amber-700 border-amber-200';
        barColor = 'bg-amber-500';
      } else if (totalMinutos > 510) {
        statusType = 'sobrecarga';
        statusLabel = 'Sobrecarga (+8.5h)';
        statusBadge = 'bg-rose-50 text-rose-700 border-rose-200';
        barColor = 'bg-rose-500';
      }

      return {
        member,
        dateLog,
        totalMinutos,
        hoursFormatted: (totalMinutos / 60).toFixed(1),
        activitiesCount: activities.length,
        completedCount,
        inReviewCount,
        inProgressCount,
        needsSupport,
        supportDetail: dateLog?.apoyo_detalle || '',
        statusType,
        statusLabel,
        statusBadge,
        barColor,
      };
    });
  }, [allMembers, teamBitacoras, selectedDate]);

  // Master unified activities for selectedDate (when 'all' is selected)
  const unifiedActivities: Actividad[] = useMemo(() => {
    const list: Actividad[] = [];

    allMembers.forEach((member) => {
      const memberLogs = teamBitacoras.filter(
        (b) =>
          b.user_id === member.id ||
          b.colaborador.toLowerCase() === member.full_name.toLowerCase() ||
          (member.username && b.colaborador.toLowerCase() === member.username.toLowerCase())
      );
      const activeLog = memberLogs.find((b) => b.fecha === selectedDate);
      if (activeLog && activeLog.actividades) {
        activeLog.actividades
          .filter((a) => !a.is_deleted)
          .forEach((act) => {
            list.push({
              ...act,
              colaborador: member.full_name,
              colaborador_id: member.id,
              colaborador_phone: member.phone,
            });
          });
      }
    });

    return list;
  }, [allMembers, teamBitacoras, selectedDate]);

  // Filtered live feed activities based on search and member selection
  const filteredLiveFeed = useMemo(() => {
    let list = liveActivities;
    if (selectedMemberId !== 'all') {
      const targetM = allMembers.find((m) => m.id === selectedMemberId);
      list = list.filter(
        (act) =>
          act.user_id === selectedMemberId ||
          (targetM && act.colaborador.toLowerCase() === targetM.full_name.toLowerCase()) ||
          (targetM?.username && act.colaborador.toLowerCase() === targetM.username.toLowerCase())
      );
    }
    if (feedSearch.trim()) {
      const q = feedSearch.toLowerCase();
      list = list.filter(
        (act) =>
          act.descripcion.toLowerCase().includes(q) ||
          act.colaborador.toLowerCase().includes(q) ||
          (act.para_cliente && act.para_cliente.toLowerCase().includes(q)) ||
          (act.tipo_trabajo && act.tipo_trabajo.toLowerCase().includes(q))
      );
    }
    return list;
  }, [liveActivities, selectedMemberId, feedSearch, allMembers]);

  // Individual selected member and bitacora for selectedDate
  const selectedMember = useMemo(() => {
    if (selectedMemberId === 'all') return null;
    return allMembers.find((m) => m.id === selectedMemberId) || null;
  }, [selectedMemberId, allMembers]);

  const currentIndividualBitacora = useMemo(() => {
    if (!selectedMember) return null;
    const memberLogs = teamBitacoras.filter(
      (b) =>
        b.user_id === selectedMember.id ||
        b.colaborador.toLowerCase() === selectedMember.full_name.toLowerCase() ||
        (selectedMember.username && b.colaborador.toLowerCase() === selectedMember.username.toLowerCase())
    );
    return memberLogs.find((b) => b.fecha === selectedDate) || null;
  }, [selectedMember, teamBitacoras, selectedDate]);

  // Drawer selected member inspection data
  const drawerWorkload = useMemo(() => {
    if (!drawerMemberId) return null;
    return memberWorkload.find((wl) => wl.member.id === drawerMemberId) || null;
  }, [drawerMemberId, memberWorkload]);

  // Handle Leader 1-Click Approval
  const handleApproveActivity = async (activityId: number | string) => {
    try {
      if (typeof activityId === 'number') {
        await api.updateActividadEstado(activityId, 'completada');
      }
      setFeedbackMsg('Actividad aprobada y marcada como completada');
      setTimeout(() => setFeedbackMsg(''), 3000);
      loadAllTeamData();
    } catch (e) {
      console.error('Error aprobando actividad', e);
    }
  };

  // Handle Leader 1-Click Reject / Return to In Process
  const handleRejectActivity = async (activityId: number | string) => {
    try {
      if (typeof activityId === 'number') {
        await api.updateActividadEstado(activityId, 'en_proceso');
      }
      setFeedbackMsg('Actividad devuelta a "En Proceso"');
      setTimeout(() => setFeedbackMsg(''), 3000);
      loadAllTeamData();
    } catch (e) {
      console.error('Error devolviendo actividad', e);
    }
  };

  // Handle Quick State Update
  const handleUpdateActivityState = async (index: number, nuevoEstado: EstadoActividad) => {
    const targetList = selectedMemberId === 'all' ? unifiedActivities : currentIndividualBitacora?.actividades || [];
    const act = targetList[index];
    if (act && typeof act.id === 'number') {
      await api.updateActividadEstado(act.id, nuevoEstado);
      loadAllTeamData();
    }
  };

  // Export to Excel / CSV with selected date in filename
  const handleExportCSV = () => {
    const listToExport = selectedMemberId === 'all' ? unifiedActivities : currentIndividualBitacora?.actividades || [];
    const prefix =
      selectedMemberId === 'all'
        ? `bitacora_${primaryTeam?.nombre.toLowerCase().replace(/\s+/g, '_') || 'equipo'}_${selectedDate}`
        : `bitacora_${selectedMember?.username || 'colaborador'}_${selectedDate}`;
    exportActivitiesToCSV(listToExport, prefix);
  };

  return (
    <div className="space-y-6">
      {/* ================= PANEL DE CONTROL UNIFICADO ================= */}
      <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-4 sm:p-5 shadow-sm space-y-3.5 transition-all duration-200">
        {/* FILA 1: TÍTULO, SELECTOR DE EQUIPO, LIVE BADGE Y ACCIONES GLOBALES */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#252636]/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00F0FF]/20 to-[#00A3BF]/20 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center shrink-0 border border-[#00F0FF]/30">
              <Users className="w-5 h-5 text-[#00A3BF] dark:text-[#00F0FF]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Supervisión de Equipo
                </h2>

                {/* Filtro de Equipo si es Admin o tiene más de 1 equipo */}
                {accessibleTeams.length > 1 ? (
                  <select
                    value={selectedTeamFilter}
                    onChange={(e) => setSelectedTeamFilter(e.target.value)}
                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 dark:bg-[#1A1C29] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-[#252636] focus:outline-none focus:ring-1 focus:ring-[#00F0FF] cursor-pointer"
                  >
                    <option value="all">🏢 Todos los Equipos ({accessibleTeams.length})</option>
                    {accessibleTeams.map((t) => (
                      <option key={t.id} value={t.id.toString()}>
                        👥 {t.nombre}
                      </option>
                    ))}
                  </select>
                ) : primaryTeam ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#00F0FF]/10 text-[#0090A0] dark:text-[#00F0FF] border border-[#00F0FF]/30">
                    {primaryTeam.nombre}
                  </span>
                ) : null}

                {/* Pulsing Live Monitor Badge */}
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span>En Vivo (auto 20s)</span>
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Línea de tiempo en vivo, semáforo de horas acumuladas y aprobación de tareas con 1 clic
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón Refrescar Manual */}
            <button
              type="button"
              onClick={loadAllTeamData}
              disabled={loading}
              title={`Última actualización: ${lastRefreshTime.toLocaleTimeString()}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-[#1A1C29] hover:bg-slate-200 dark:hover:bg-[#252636] text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold transition-all cursor-pointer border border-slate-200 dark:border-[#252636]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#00F0FF]' : ''}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>

            {/* Toggle de Vistas del Equipo: Feed en Vivo / Semáforo / Kanban */}
            {selectedMemberId === 'all' ? (
              <div className="flex items-center bg-slate-100 dark:bg-[#161722] p-0.5 rounded-full border border-slate-200/80 dark:border-[#252636] max-w-full overflow-x-auto scrollbar-none">
                <button
                  type="button"
                  onClick={() => setTeamTab('feed')}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 min-h-[34px] ${
                    teamTab === 'feed'
                      ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-bold'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5 text-current animate-pulse shrink-0" />
                  <span>Feed <span className="hidden sm:inline">en Vivo</span> ({liveActivities.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeamTab('semaforo')}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 min-h-[34px] ${
                    teamTab === 'semaforo'
                      ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-bold'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  <span>Semáforo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTeamTab('kanban')}
                  className={`flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full text-xs transition-all cursor-pointer shrink-0 min-h-[34px] ${
                    teamTab === 'kanban'
                      ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-bold'
                  }`}
                >
                  <KanbanIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Tablero <span className="hidden sm:inline">({unifiedActivities.length})</span></span>
                </button>
              </div>
            ) : (
              /* Si está en modo individual, toggle Kanban / Resumen */
              <div className="flex items-center bg-slate-100 dark:bg-[#161722] p-0.5 rounded-full border border-slate-200/80 dark:border-[#252636]">
                <button
                  type="button"
                  onClick={() => setSubView('kanban')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    subView === 'kanban'
                      ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <KanbanIcon className="w-3.5 h-3.5" />
                  <span>Kanban</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubView('resumen')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    subView === 'resumen'
                      ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <LayoutList className="w-3.5 h-3.5" />
                  <span>Resumen</span>
                </button>
              </div>
            )}

            {/* Exportar Excel CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-[#A855F7] to-[#6366F1] hover:from-[#9333EA] hover:to-[#4F46E5] active:scale-95 text-white rounded-full text-xs font-bold transition-all shadow-md shadow-purple-500/25 cursor-pointer min-h-[36px]"
              title="Descargar reporte en formato Excel CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert if an action occurred */}
        {feedbackMsg && (
          <div className="bg-[#E6F9F5] dark:bg-mint-500/15 border border-[#00C9A7]/30 text-[#007D67] dark:text-[#00C9A7] px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 animate-in fade-in shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-[#00C9A7] shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* FILA 2: NAVEGADOR DE FECHA LIMPIO Y DIRECTO */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Fecha actual formateada */}
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-[#00A3BF] dark:text-[#00F0FF]" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {formatDateLong(selectedDate)}
            </span>
            {isSelectedToday ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-[#00F0FF] text-slate-950">
                Hoy
              </span>
            ) : isSelectedYesterday ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                Ayer
              </span>
            ) : (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-[#1A1C29] text-slate-600 dark:text-slate-400 border border-slate-200/90 dark:border-[#252636]">
                Histórico
              </span>
            )}
          </div>

          {/* Controles de fecha: < >, Hoy, Ayer, Selector de fecha nativo */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center bg-white dark:bg-[#1A1C29] p-0.5 rounded-full border border-slate-200/90 dark:border-[#252636] shadow-2xs">
              <button
                type="button"
                onClick={handlePrevDay}
                title="Día anterior"
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextDay}
                title="Día siguiente"
                className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleToday}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isSelectedToday
                  ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                  : 'bg-white dark:bg-[#1A1C29] text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-[#252636] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={handleYesterday}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                isSelectedYesterday
                  ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                  : 'bg-white dark:bg-[#1A1C29] text-slate-700 dark:text-slate-300 border border-slate-200/90 dark:border-[#252636] hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              Ayer
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-[#1A1C29] hover:bg-slate-100 dark:hover:bg-white/5 text-xs font-bold text-slate-800 dark:text-slate-100 rounded-full border border-slate-200/90 dark:border-[#252636] focus:border-[#00F0FF] outline-hidden cursor-pointer"
              title="Elegir otra fecha"
            />
          </div>
        </div>

        {/* FILA 3: FILTRO DE COLABORADORES (PÍLDORAS HORIZONTALES) */}
        <div className="pt-2 border-t border-slate-100 dark:border-[#252636]/60 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {/* Botón Todo el Equipo */}
            <button
              type="button"
              onClick={() => setSelectedMemberId('all')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                selectedMemberId === 'all'
                  ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                  : 'bg-slate-100 dark:bg-[#161722] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-[#252636] hover:bg-slate-200 dark:hover:bg-[#1E2030]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Todo el Equipo</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  selectedMemberId === 'all'
                    ? 'bg-slate-950/20 text-slate-950'
                    : 'bg-slate-200 dark:bg-[#252636] text-slate-700 dark:text-slate-300'
                }`}
              >
                {allMembers.length}
              </span>
            </button>

            {/* Chips de cada colaborador */}
            {allMembers.map((m) => {
              const isSelected = selectedMemberId === m.id;
              const memberLog = teamBitacoras.find(
                (b) => (b.user_id === m.id || b.colaborador === m.full_name) && b.fecha === selectedDate
              );
              const count = memberLog ? (memberLog.actividades || []).filter((a) => !a.is_deleted).length : 0;
              const hasSupport = memberLog?.necesita_apoyo === 'Si';

              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSelectedMemberId(m.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    isSelected
                      ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                      : 'bg-white dark:bg-[#161722] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1E2030] border border-slate-200/80 dark:border-[#252636]'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      hasSupport ? 'bg-amber-400 animate-ping' : isSelected ? 'bg-slate-950' : count > 0 ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  />
                  <span>{m.full_name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      isSelected
                        ? 'bg-slate-950/20 text-slate-950'
                        : 'bg-slate-200 dark:bg-[#252636] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Breadcrumb cuando se selecciona a un colaborador */}
          {selectedMemberId !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedMemberId('all')}
              className="text-xs font-bold text-[#00A3BF] dark:text-[#00F0FF] hover:underline flex items-center gap-1 cursor-pointer shrink-0"
            >
              <span>← Volver a Todo el Equipo</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= CONTENIDO PRINCIPAL ================= */}
      {selectedMemberId === 'all' ? (
        <div className="space-y-6">
          {/* TAB 1: FEED EN VIVO (LÍNEA DE TIEMPO DE ACTIVIDADES EN TIEMPO REAL) */}
          {teamTab === 'feed' && (
            <div className="space-y-4">
              {/* Header & Feed Search */}
              <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Línea de Tiempo de Actividades en Tiempo Real
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Viendo lo que tus colaboradores han anotado y actualizado para el {formatDateDisplay(selectedDate)}
                    </p>
                  </div>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Filtrar por tarea, cliente o miembro..."
                    value={feedSearch}
                    onChange={(e) => setFeedSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#1A1C29] border border-slate-200 dark:border-[#252636] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00F0FF]/30 text-slate-800 dark:text-white placeholder:text-slate-400"
                  />
                  {feedSearch && (
                    <button
                      onClick={() => setFeedSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Feed Stream Cards */}
              {loading && liveActivities.length === 0 ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-[#00F0FF]" />
                  <p className="text-sm font-medium">Sincronizando actividades del equipo en vivo...</p>
                </div>
              ) : filteredLiveFeed.length === 0 ? (
                <EmptyState
                  icon={Clock}
                  title={`No hay actividades anotadas para el ${formatDateDisplay(selectedDate)}`}
                  description="Los colaboradores aún no han registrado tareas en esta fecha, o están redactando en su panel. Las tareas aparecerán aquí en vivo en cuanto se sincronicen."
                  actionText="Ir al día de Hoy"
                  onAction={handleToday}
                />
              ) : (
                <div className="space-y-3">
                  {filteredLiveFeed.map((act) => {
                    const isCompleted = act.estado === 'completada';
                    const isInReview = act.estado === 'en_revision';
                    const isInProgress = act.estado === 'en_proceso';

                    return (
                      <div
                        key={act.id}
                        className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-4 sm:p-5 shadow-xs hover:border-[#00F0FF]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
                      >
                        <div className="flex items-start gap-3.5 flex-1 min-w-0">
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00F0FF] to-[#00A3BF] text-slate-950 font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                            {act.colaborador.charAt(0)}
                          </div>

                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-slate-900 dark:text-white">
                                {act.colaborador}
                              </span>
                              {act.team_name && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#1A1C29] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#252636]">
                                  {act.team_name}
                                </span>
                              )}
                              {act.para_cliente && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
                                  {act.para_cliente}
                                </span>
                              )}
                              <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {act.hora_inicio || '08:30'} ({formatDuration(act.duracion_min || 0)})
                              </span>
                            </div>

                            <div className="text-sm text-slate-800 dark:text-slate-200 font-medium break-words">
                              <RichHtmlRenderer content={act.descripcion} />
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-400">
                              <span>Tipo: <strong className="text-slate-600 dark:text-slate-300 font-normal">{act.tipo_trabajo}</strong></span>
                              {act.updated_at && (
                                <>
                                  <span>•</span>
                                  <span>Actualizado: {act.updated_at}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status badge & Leader fast actions */}
                        <div className="flex items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-[#252636]">
                          {/* Estado Badge */}
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 ${
                              isCompleted
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                                : isInReview
                                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60'
                                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isCompleted ? 'bg-emerald-500' : isInReview ? 'bg-purple-500 animate-pulse' : 'bg-amber-500 animate-pulse'
                              }`}
                            />
                            {isCompleted ? 'Completada' : isInReview ? 'En Revisión' : 'En Proceso'}
                          </span>

                          {/* Quick 1-click Approval button */}
                          {!isCompleted && act.id && (
                            <button
                              type="button"
                              onClick={() => handleApproveActivity(act.id!)}
                              className="px-3.5 py-1.5 bg-[#00F0FF] hover:bg-[#00D8E6] text-slate-950 text-xs font-bold rounded-xl shadow-xs transition-transform active:scale-95 cursor-pointer flex items-center gap-1"
                              title="Aprobar de inmediato esta actividad"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Aprobar</span>
                            </button>
                          )}

                          {isCompleted && act.id && (
                            <button
                              type="button"
                              onClick={() => handleRejectActivity(act.id!)}
                              className="px-2.5 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1A1C29] text-xs font-medium rounded-lg transition-colors cursor-pointer"
                              title="Reabrir / pasar a En Proceso"
                            >
                              Reabrir
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: RADAR / SEMÁFORO + TABLA RESUMEN */}
          {teamTab === 'semaforo' && (
            <div className="space-y-6">
              {/* Radar Cards */}
              <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-5 sm:p-6 shadow-sm space-y-4 transition-all duration-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#252636]/60 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#00A3BF] dark:text-[#00F0FF]" />
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Semáforo de Carga de Trabajo — {formatDateDisplay(selectedDate)}
                    </h3>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> 6-8.5h (Óptimo)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500" /> &lt;6h (Bajo)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500" /> &gt;8.5h (Sobrecarga)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {memberWorkload.map((wl) => {
                    const percentage = Math.min(100, Math.round((wl.totalMinutos / 480) * 100));

                    return (
                      <div
                        key={wl.member.id}
                        onClick={() => setDrawerMemberId(wl.member.id)}
                        className="p-4 rounded-xl border border-slate-200/90 dark:border-[#252636] bg-slate-50/60 dark:bg-[#161722]/80 hover:bg-white dark:hover:bg-[#1A1C29] hover:border-[#00F0FF]/40 dark:hover:border-[#00F0FF]/40 hover:shadow-md transition-all cursor-pointer relative group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-1 mb-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-xl bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] font-extrabold text-sm flex items-center justify-center shrink-0">
                                {wl.member.full_name.charAt(0)}
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                                  {wl.member.full_name}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                                  {wl.member.role === 'lider' ? (
                                    <>
                                      <Star className="w-3 h-3 text-amber-500 shrink-0" />
                                      <span className="font-semibold text-amber-600 dark:text-amber-400">Líder</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span>Analista</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${wl.statusBadge}`}>
                              {wl.statusLabel}
                            </span>
                          </div>

                          {/* Big Hours & Progress Bar */}
                          <div className="space-y-1.5 mb-3">
                            <div className="flex items-baseline justify-between">
                              <span className="text-slate-400 dark:text-slate-500 text-[11px] font-semibold">Horas ({formatDateDisplay(selectedDate)}):</span>
                              <div className="font-mono text-xl font-black text-slate-900 dark:text-white">
                                <span className="text-[#00A3BF] dark:text-[#00F0FF]">{wl.hoursFormatted}h</span> <span className="text-slate-400 dark:text-slate-500 text-xs font-normal">/ 8h</span>
                              </div>
                            </div>
                            <div className="w-full h-2 bg-slate-200/80 dark:bg-[#12131C] rounded-full overflow-hidden border border-slate-200/50 dark:border-[#252636]/60">
                              <div
                                className={`h-full ${wl.barColor} transition-all duration-500`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>

                          {/* Task Summary Badges */}
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 dark:text-slate-300 flex-wrap">
                            <span className="bg-white dark:bg-[#1A1C29] px-2 py-0.5 rounded-full border border-slate-200 dark:border-[#252636] font-semibold">
                              {wl.activitiesCount} tareas
                            </span>
                            {wl.inReviewCount > 0 && (
                              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 px-2 py-0.5 rounded-full font-bold border border-amber-200 dark:border-amber-700 inline-flex items-center gap-1">
                                <Eye className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                                {wl.inReviewCount} por revisar
                              </span>
                            )}
                            {wl.completedCount > 0 && (
                              <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                {wl.completedCount}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Support Alert / Quick WhatsApp Button */}
                        {wl.needsSupport && (
                          <div className="mt-3 pt-2.5 border-t border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-1 text-[11px]">
                            <span className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              Requiere Apoyo
                            </span>
                            {wl.member.phone && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const clean = (wl.member.phone || '').replace(/\D/g, '');
                                  const phone = clean.length === 9 ? `51${clean}` : clean;
                                  const msg = encodeURIComponent(
                                    `Hola ${wl.member.full_name}, veo en tu bitácora del ${formatDateDisplay(selectedDate)} que solicitaste apoyo: "${wl.supportDetail}". ¿Cómo podemos resolverlo?`
                                  );
                                  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                                }}
                                className="flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-500 hover:bg-emerald-600 px-2.5 py-1 rounded-full transition-colors"
                              >
                                <MessageCircle className="w-3 h-3" />
                                <span>Apoyar</span>
                              </button>
                            )}
                          </div>
                        )}

                        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-[#252636]/60 flex items-center justify-between text-xs text-[#00A3BF] dark:text-[#00F0FF] font-bold group-hover:text-[#00D8E6]">
                          <span>Inspeccionar tareas</span>
                          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Support Requests Banner if any exist */}
              {memberWorkload.filter((wl) => wl.needsSupport).length > 0 && (
                <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-sm">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Colaboradores que solicitaron apoyo hoy ({memberWorkload.filter((wl) => wl.needsSupport).length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {memberWorkload
                      .filter((wl) => wl.needsSupport)
                      .map((wl) => (
                        <div
                          key={wl.member.id}
                          className="p-3.5 bg-white dark:bg-[#161722] rounded-2xl border border-amber-200 dark:border-amber-800/60 flex flex-col justify-between gap-2"
                        >
                          <div>
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                              <span>{wl.member.full_name}</span>
                              <span className="text-[10px] text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-full font-semibold">
                                {wl.hoursFormatted}h registradas
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">
                              "{wl.supportDetail || 'Requiere apoyo del líder'}"
                            </p>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                            <button
                              type="button"
                              onClick={() => setDrawerMemberId(wl.member.id)}
                              className="text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#00A88B] dark:hover:text-[#00C9A7] px-3 py-1 rounded-full"
                            >
                              Ver actividades
                            </button>
                            {wl.member.phone && (
                              <button
                                type="button"
                                onClick={() => {
                                  const clean = (wl.member.phone || '').replace(/\D/g, '');
                                  const phone = clean.length === 9 ? `51${clean}` : clean;
                                  const msg = encodeURIComponent(
                                    `Hola ${wl.member.full_name}, revisé tu solicitud de apoyo del ${formatDateDisplay(selectedDate)}: "${wl.supportDetail}".`
                                  );
                                  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                                }}
                                className="flex items-center gap-1 text-xs font-bold text-white bg-[#00C9A7] hover:bg-[#00B894] px-3.5 py-1.5 rounded-full shadow-xs"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                                <span>WhatsApp</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TABLERO KANBAN MAESTRO */}
          {teamTab === 'kanban' && (
            <div className="space-y-4">
              <div className="bg-[#E6F9F5] border border-[#00C9A7]/30 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-800 shadow-2xs">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#00C9A7] shrink-0" />
                  <span>
                    <strong>Tablero Maestro de Equipo:</strong> Viendo actividades del <strong>{formatDateDisplay(selectedDate)}</strong> ({unifiedActivities.length} tareas totales). Arrastra tareas entre columnas o usa los botones rápidos para aprobarlas.
                  </span>
                </div>
              </div>

              {unifiedActivities.length > 0 ? (
                <KanbanBoard
                  actividades={unifiedActivities}
                  onUpdateEstado={handleUpdateActivityState}
                  onAddActividadConEstado={() => {}}
                  onRemoveActividad={() => {}}
                  colaborador="Todo el Equipo"
                  isLeaderView={true}
                  showCollaboratorBadge={true}
                  onApproveActivity={(index) => {
                    const act = unifiedActivities[index];
                    if (act && typeof act.id === 'number') {
                      handleApproveActivity(act.id);
                    }
                  }}
                  onRejectActivity={(index) => {
                    const act = unifiedActivities[index];
                    if (act && typeof act.id === 'number') {
                      handleRejectActivity(act.id);
                    }
                  }}
                />
              ) : (
                <EmptyState
                  icon={Calendar}
                  title={`No hay actividades registradas el ${formatDateDisplay(selectedDate)}`}
                  description="Ningún colaborador de tu equipo ha registrado bitácora en esta fecha. Puedes cambiar de día con las flechas superiores o volver a hoy."
                  actionText="Ir al día de Hoy"
                  onAction={handleToday}
                  secondaryText={
                    recordedDates.length > 0 && recordedDates[0] !== selectedDate
                      ? `Ver última fecha (${formatDateDisplay(recordedDates[0])})`
                      : undefined
                  }
                  onSecondaryAction={
                    recordedDates.length > 0 && recordedDates[0] !== selectedDate
                      ? () => setSelectedDate(recordedDates[0])
                      : undefined
                  }
                />
              )}
            </div>
          )}
        </div>
      ) : (
        /* MODO INDIVIDUAL: REVISIÓN DETALLADA POR COLABORADOR */
        <div className="space-y-4">
          {/* Support alert banner */}
          {currentIndividualBitacora?.necesita_apoyo === 'Si' && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-3xl p-4 shadow-2xs flex items-start justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">¡Atención Líder!</strong> Este colaborador reportó que
                  necesita tu apoyo para avanzar:
                  <div className="mt-1 font-semibold text-amber-950 dark:text-amber-100 bg-white/80 dark:bg-[#13141F] p-2.5 rounded-xl border border-amber-200 dark:border-amber-700/60">
                    "{currentIndividualBitacora.apoyo_detalle || 'Sin detalle de apoyo'}"
                  </div>
                </div>
              </div>

              {selectedMember?.phone && (
                <button
                  type="button"
                  onClick={() => {
                    const clean = (selectedMember.phone || '').replace(/\D/g, '');
                    const phone = clean.length === 9 ? `51${clean}` : clean;
                    const msg = encodeURIComponent(
                      `Hola ${selectedMember.full_name}, revisé tu bitácora del ${formatDateDisplay(selectedDate)} y vi que necesitas apoyo: "${currentIndividualBitacora.apoyo_detalle}". Coordinemos para resolverlo.`
                    );
                    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#00C9A7] hover:bg-[#00B894] text-white rounded-full font-bold shadow-xs transition-all shrink-0 cursor-pointer min-h-[40px]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Contactar por WhatsApp</span>
                </button>
              )}
            </div>
          )}

          {/* Individual view: Kanban or Resumen */}
          {currentIndividualBitacora ? (
            subView === 'resumen' ? (
              <ResumenPreview bitacora={currentIndividualBitacora} isGenerated={true} />
            ) : (
              <KanbanBoard
                actividades={(currentIndividualBitacora.actividades || []).filter((a) => !a.is_deleted)}
                onUpdateEstado={handleUpdateActivityState}
                onAddActividadConEstado={() => {}}
                onRemoveActividad={() => {}}
                colaborador={selectedMember?.full_name || 'Colaborador'}
                isLeaderView={true}
                showCollaboratorBadge={false}
                onApproveActivity={(index) => {
                  const act = (currentIndividualBitacora.actividades || []).filter((a) => !a.is_deleted)[index];
                  if (act && typeof act.id === 'number') {
                    handleApproveActivity(act.id);
                  }
                }}
                onRejectActivity={(index) => {
                  const act = (currentIndividualBitacora.actividades || []).filter((a) => !a.is_deleted)[index];
                  if (act && typeof act.id === 'number') {
                    handleRejectActivity(act.id);
                  }
                }}
              />
            )
          ) : (
            <EmptyState
              icon={Calendar}
              title={`Sin bitácora de ${selectedMember?.full_name}`}
              description={`No hay actividades registradas para este colaborador en la fecha ${formatDateDisplay(selectedDate)}.`}
              actionText="Volver al Equipo"
              onAction={() => setSelectedMemberId('all')}
            />
          )}
        </div>
      )}

      {/* ================= DRAWER LATERAL: INSPECCIÓN RÁPIDA DE COLABORADOR ================= */}
      {drawerWorkload && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setDrawerMemberId(null)}
          />
          <div className="relative bg-white dark:bg-[#13141F] w-full max-w-lg h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 dark:border-[#252636] z-10 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-[#252636] flex items-center justify-between bg-slate-50/70 dark:bg-[#161722]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] text-slate-950 font-black flex items-center justify-center shadow-xs">
                  {drawerWorkload.member.full_name.charAt(0)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                    {drawerWorkload.member.full_name}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    <span className="flex items-center gap-1 font-medium">
                      {drawerWorkload.member.role === 'lider' ? (
                        <>
                          <Star className="w-3 h-3 text-amber-500" /> Líder
                        </>
                      ) : (
                        <>
                          <UserIcon className="w-3 h-3 text-slate-400" /> Analista
                        </>
                      )}
                    </span>
                    <span>•</span>
                    <span>{drawerWorkload.member.team_name || 'Equipo'}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDrawerMemberId(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#161722] rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Daily metrics summary */}
              <div className="bg-slate-50 dark:bg-[#161722] rounded-2xl p-3.5 border border-slate-200/70 dark:border-[#252636] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Fecha inspeccionada:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatDateDisplay(selectedDate)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Horas registradas:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{drawerWorkload.hoursFormatted}h / 8.0h</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-400">Estado de carga:</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${drawerWorkload.statusBadge}`}>
                    {drawerWorkload.statusLabel}
                  </span>
                </div>
              </div>

              {/* Support Alert in Drawer */}
              {drawerWorkload.needsSupport && (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-2xl p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Requiere apoyo reportado:</span>
                  </div>
                  <p className="italic bg-white/80 dark:bg-[#13141F] p-2.5 rounded-xl border border-amber-200 dark:border-amber-700/60 font-medium">
                    "{drawerWorkload.supportDetail || 'Sin detalle de apoyo'}"
                  </p>
                  {drawerWorkload.member.phone && (
                    <button
                      type="button"
                      onClick={() => {
                        const clean = (drawerWorkload.member.phone || '').replace(/\D/g, '');
                        const phone = clean.length === 9 ? `51${clean}` : clean;
                        const msg = encodeURIComponent(
                          `Hola ${drawerWorkload.member.full_name}, veo en tu bitácora del ${formatDateDisplay(selectedDate)} que necesitas apoyo: "${drawerWorkload.supportDetail}".`
                        );
                        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 text-slate-950 rounded-full font-bold shadow-xs cursor-pointer min-h-[40px]"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Contactar por WhatsApp</span>
                    </button>
                  )}
                </div>
              )}

              {/* Activities list for this member */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    Actividades del día ({drawerWorkload.dateLog?.actividades.filter((a) => !a.is_deleted).length || 0})
                  </h5>
                </div>

                {drawerWorkload.dateLog && drawerWorkload.dateLog.actividades.filter((a) => !a.is_deleted).length > 0 ? (
                  <div className="space-y-2.5">
                    {drawerWorkload.dateLog.actividades
                      .filter((a) => !a.is_deleted)
                      .map((act, idx) => (
                        <div
                          key={act.id || idx}
                          className="p-3.5 bg-white dark:bg-[#161722] rounded-2xl border border-slate-200 dark:border-[#252636] shadow-2xs space-y-2 hover:border-slate-300 dark:hover:border-[#00F0FF]/40 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white leading-snug flex-1">
                              <RichHtmlRenderer content={act.descripcion} clampLines={2} />
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                act.estado === 'completada'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60'
                                  : act.estado === 'en_revision'
                                  ? 'bg-[#A855F7]/15 text-[#C084FC] border border-[#A855F7]/30'
                                  : 'bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30'
                              }`}
                            >
                              {act.estado === 'completada'
                                ? 'Completada'
                                : act.estado === 'en_revision'
                                ? 'En Revisión'
                                : 'En Proceso'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-[#252636]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {act.hora_inicio || '08:30'} ({act.duracion_min || 0} min)
                            </span>

                            {/* Quick 1-click Approval/Reject */}
                            <div className="flex items-center gap-1.5">
                              {act.estado !== 'completada' && (
                                <button
                                  type="button"
                                  onClick={() => act.id && handleApproveActivity(act.id)}
                                  className="px-3 py-1 bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30 rounded-full text-[10px] font-bold transition-colors cursor-pointer"
                                >
                                  Aprobar
                                </button>
                              )}
                              {act.estado === 'completada' && (
                                <button
                                  type="button"
                                  onClick={() => act.id && handleRejectActivity(act.id)}
                                  className="px-3 py-1 bg-slate-100 dark:bg-[#1A1C29] hover:bg-slate-200 dark:hover:bg-[#252636] text-slate-600 dark:text-slate-300 rounded-full text-[10px] font-medium transition-colors cursor-pointer"
                                >
                                  Reabrir
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={Calendar}
                    title="Sin tareas registradas"
                    description="Este colaborador aún no ha guardado actividades para esta fecha."
                    className="py-8"
                  />
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-[#252636] bg-slate-50/70 dark:bg-[#161722] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedMemberId(drawerWorkload.member.id);
                  setDrawerMemberId(null);
                }}
                className="flex-1 py-2.5 px-4 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 rounded-full text-xs font-bold shadow-sm transition-all text-center cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
              >
                <span>Ver en Pantalla Completa</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setDrawerMemberId(null)}
                className="py-2.5 px-5 bg-white hover:bg-slate-100 dark:bg-[#1A1C29] dark:hover:bg-[#252636] text-slate-700 dark:text-slate-200 rounded-full text-xs font-semibold border border-slate-200 dark:border-[#252636] shadow-2xs transition-all cursor-pointer min-h-[44px]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
