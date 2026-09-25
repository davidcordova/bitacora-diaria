import React, { useState, useEffect, useMemo } from 'react';
import {
  Lightbulb,
  ThumbsUp,
  MessageSquare,
  Sparkles,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  User as UserIcon,
  Shield,
  Trash2,
  Send,
  X,
  ChevronUp,
  Check,
  Award,
  Layers,
  Flame,
  Calendar,
} from 'lucide-react';
import { Sugerencia, User, CategoriaSugerencia, ImpactoSugerencia, EstadoSugerencia } from '../types';
import { api } from '../services/api';
import { EmptyState } from './EmptyState';

interface BuzonViewProps {
  currentUser?: User | null;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const CATEGORIAS_CONFIG: Record<
  CategoriaSugerencia,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  mejora_proceso: {
    label: 'Mejora de Procesos',
    icon: '⚡',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  herramienta_it: {
    label: 'Herramientas / IT',
    icon: '💻',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
  },
  bienestar_equipo: {
    label: 'Bienestar y Cultura',
    icon: '🌱',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  innovacion: {
    label: 'Innovación / Producto',
    icon: '🚀',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  comunicacion: {
    label: 'Comunicación Interna',
    icon: '💬',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  sistema: {
    label: 'Sistema / Bitácora',
    icon: '⚙️',
    color: 'text-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/30',
  },
  otro: {
    label: 'Otra Idea',
    icon: '💡',
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
  },
};

const ESTADOS_CONFIG: Record<
  EstadoSugerencia,
  { label: string; color: string; bg: string; border: string }
> = {
  pendiente: {
    label: 'Pendiente',
    color: 'text-slate-300',
    bg: 'bg-slate-800/80',
    border: 'border-slate-600/40',
  },
  en_revision: {
    label: 'En Evaluación',
    color: 'text-amber-300',
    bg: 'bg-amber-950/40',
    border: 'border-amber-500/40',
  },
  planificada: {
    label: 'Planificada',
    color: 'text-cyan-300',
    bg: 'bg-cyan-950/40',
    border: 'border-cyan-500/40',
  },
  implementada: {
    label: 'Implementada 🎉',
    color: 'text-emerald-300',
    bg: 'bg-emerald-950/40',
    border: 'border-emerald-500/40',
  },
  descartada: {
    label: 'No Viable',
    color: 'text-rose-400',
    bg: 'bg-rose-950/40',
    border: 'border-rose-500/30',
  },
};

const IMPACTOS_CONFIG: Record<ImpactoSugerencia, { label: string; badge: string }> = {
  bajo: { label: 'Bajo', badge: 'bg-slate-700 text-slate-300' },
  medio: { label: 'Medio', badge: 'bg-blue-900/60 text-blue-300 border border-blue-500/30' },
  alto: { label: 'Alto Impacto', badge: 'bg-purple-900/60 text-purple-300 border border-purple-500/30' },
  estrategico: { label: 'Estratégico ★', badge: 'bg-amber-900/60 text-amber-300 border border-amber-500/40 font-semibold' },
};

export const BuzonView: React.FC<BuzonViewProps> = ({ currentUser, onShowToast }) => {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [estadoFilter, setEstadoFilter] = useState<string>('todas');
  const [soloMias, setSoloMias] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'reciente' | 'popular'>('popular');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal para proponer idea
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    categoria: 'mejora_proceso' as CategoriaSugerencia,
    impacto: 'medio' as ImpactoSugerencia,
    es_anonimo: false,
  });
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Modal para responder / cambiar estado (Admin o Líder)
  const [respondModalSug, setRespondModalSug] = useState<Sugerencia | null>(null);
  const [adminEstado, setAdminEstado] = useState<EstadoSugerencia>('en_revision');
  const [adminRespuesta, setAdminRespuesta] = useState<string>('');
  const [savingStatus, setSavingStatus] = useState<boolean>(false);

  const isAdminOrLeader = currentUser?.role === 'admin' || currentUser?.role === 'lider' || currentUser?.is_leader;

  const fetchSugerencias = async () => {
    try {
      setLoading(true);
      const res = await api.getSugerencias({
        categoria: categoriaFilter,
        estado: estadoFilter,
        user_id: currentUser?.id,
        requesting_user_id: currentUser?.id,
        mine: soloMias,
        sort: sortBy,
      });
      setSugerencias(res || []);
    } catch (err: any) {
      console.error('Error fetching sugerencias:', err);
      if (onShowToast) onShowToast(err.message || 'Error al cargar el buzón', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSugerencias();
  }, [categoriaFilter, estadoFilter, soloMias, sortBy]);

  const handleVote = async (sugId: number) => {
    if (!currentUser?.id) {
      if (onShowToast) onShowToast('Inicia sesión para votar por esta idea', 'info');
      return;
    }
    try {
      // Optimistic update
      setSugerencias((prev) =>
        prev.map((s) => {
          if (s.id === sugId) {
            const hasVoted = Boolean(s.user_has_voted);
            return {
              ...s,
              user_has_voted: !hasVoted,
              votos: hasVoted ? Math.max(0, s.votos - 1) : s.votos + 1,
            };
          }
          return s;
        })
      );

      const res = await api.votarSugerencia(sugId, currentUser.id);
      if (onShowToast) {
        onShowToast(res.voted ? '¡Voto registrado! Gracias por apoyar esta idea.' : 'Voto retirado', 'info');
      }
    } catch (err: any) {
      // Rollback
      fetchSugerencias();
      if (onShowToast) onShowToast(err.message || 'Error al votar', 'error');
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.titulo.trim() || !formData.descripcion.trim()) {
      if (onShowToast) onShowToast('Por favor completa el título y la descripción', 'info');
      return;
    }
    try {
      setSubmitting(true);
      await api.createSugerencia({
        user_id: currentUser?.id,
        colaborador: currentUser?.full_name || currentUser?.username || 'Colaborador',
        es_anonimo: formData.es_anonimo,
        categoria: formData.categoria,
        titulo: formData.titulo.trim(),
        descripcion: formData.descripcion.trim(),
        impacto: formData.impacto,
      });
      if (onShowToast) onShowToast('¡Tu propuesta ha sido enviada con éxito!', 'success');
      setIsModalOpen(false);
      setFormData({
        titulo: '',
        descripcion: '',
        categoria: 'mejora_proceso',
        impacto: 'medio',
        es_anonimo: false,
      });
      fetchSugerencias();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al registrar propuesta', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!respondModalSug) return;
    try {
      setSavingStatus(true);
      await api.updateSugerenciaStatus(respondModalSug.id, {
        estado: adminEstado,
        respuesta_admin: adminRespuesta.trim(),
        respondido_por: currentUser?.full_name || currentUser?.username || 'Equipo de Liderazgo',
      });
      if (onShowToast) onShowToast('Estado y retroalimentación guardados con éxito', 'success');
      setRespondModalSug(null);
      fetchSugerencias();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al actualizar estado', 'error');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleDeleteSug = async (sugId: number) => {
    if (!window.confirm('¿Seguro que deseas eliminar esta propuesta del buzón?')) return;
    try {
      await api.deleteSugerencia(sugId, currentUser?.id || 0, currentUser?.role);
      if (onShowToast) onShowToast('Propuesta eliminada', 'info');
      setSugerencias((prev) => prev.filter((s) => s.id !== sugId));
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al eliminar', 'error');
    }
  };

  // Filtrado en vivo por texto
  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return sugerencias;
    const term = searchTerm.toLowerCase();
    return sugerencias.filter(
      (s) =>
        s.titulo.toLowerCase().includes(term) ||
        s.descripcion.toLowerCase().includes(term) ||
        (s.colaborador && s.colaborador.toLowerCase().includes(term)) ||
        (s.respuesta_admin && s.respuesta_admin.toLowerCase().includes(term))
    );
  }, [sugerencias, searchTerm]);

  // Resumen métricas
  const stats = useMemo(() => {
    const total = sugerencias.length;
    const implementadas = sugerencias.filter((s) => s.estado === 'implementada').length;
    const enRevision = sugerencias.filter((s) => s.estado === 'en_revision' || s.estado === 'planificada').length;
    const totalVotos = sugerencias.reduce((acc, curr) => acc + (curr.votos || 0), 0);
    return { total, implementadas, enRevision, totalVotos };
  }, [sugerencias]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in text-slate-100">
      {/* HEADER PRINCIPAL */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#111322] via-[#16182c] to-[#121324] border border-cyan-500/20 p-6 md:p-8 shadow-2xl shadow-cyan-950/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-300 border border-cyan-500/30">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>Buzón de Sugerencias & Mejora Continua</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Lightbulb className="w-7 h-7" />
              </span>
              Ideas que Transforman el Equipo
            </h1>
            <p className="text-sm md:text-base text-slate-400 max-w-2xl">
              Comparte propuestas para optimizar procesos, sugerir herramientas o mejorar la dinámica laboral.
              Vota por las ideas de tus compañeros y sigue su implementación en tiempo real.
            </p>
          </div>

          <button
            id="btn-nueva-sugerencia"
            onClick={() => setIsModalOpen(true)}
            className="self-start md:self-center inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/25 active:scale-95 transition-all duration-200 border border-cyan-300/30 min-h-[44px]"
          >
            <Plus className="w-5 h-5" />
            <span>Proponer una Idea</span>
          </button>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-6 pt-6 border-t border-white/5">
          <div className="bg-[#181a2e]/60 rounded-xl p-3.5 border border-white/5">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-cyan-400" />
              Total Ideas
            </div>
            <div className="text-xl md:text-2xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-[#181a2e]/60 rounded-xl p-3.5 border border-white/5">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              En Evaluación / Plan
            </div>
            <div className="text-xl md:text-2xl font-bold text-amber-300 mt-1">{stats.enRevision}</div>
          </div>
          <div className="bg-[#181a2e]/60 rounded-xl p-3.5 border border-white/5">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Implementadas
            </div>
            <div className="text-xl md:text-2xl font-bold text-emerald-400 mt-1">{stats.implementadas}</div>
          </div>
          <div className="bg-[#181a2e]/60 rounded-xl p-3.5 border border-white/5">
            <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-fuchsia-400" />
              Votos de la Comunidad
            </div>
            <div className="text-xl md:text-2xl font-bold text-fuchsia-400 mt-1">{stats.totalVotos}</div>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS Y ORDENAMIENTO */}
      <div className="bg-[#13141F] rounded-2xl p-4 border border-white/5 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Búsqueda rápida */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar propuesta por título, autor o contenido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#181926] text-sm text-slate-200 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 border border-white/10 focus:border-cyan-500 focus:outline-none transition-colors"
            />
            <span className="absolute left-3.5 top-3 text-slate-400">
              <Filter className="w-4 h-4" />
            </span>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toggle Más Votadas / Más Recientes */}
          <div className="flex items-center gap-1 p-1 bg-[#181926] rounded-xl border border-white/5 self-start md:self-auto">
            <button
              onClick={() => setSortBy('popular')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-[36px] ${
                sortBy === 'popular'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Más Votadas
            </button>
            <button
              onClick={() => setSortBy('reciente')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all min-h-[36px] ${
                sortBy === 'reciente'
                  ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Más Recientes
            </button>
          </div>

          {/* Filtro Mis Propuestas */}
          {currentUser && (
            <button
              onClick={() => setSoloMias(!soloMias)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border min-h-[38px] ${
                soloMias
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                  : 'bg-[#181926] text-slate-400 hover:text-slate-200 border-white/5'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              Solo Mis Propuestas
            </button>
          )}
        </div>

        {/* Categorías y Estados chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Categoría:
          </span>
          <button
            onClick={() => setCategoriaFilter('todas')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              categoriaFilter === 'todas'
                ? 'bg-cyan-500 text-white font-semibold shadow-sm'
                : 'bg-[#181926] text-slate-400 hover:text-slate-200 border border-white/5'
            }`}
          >
            Todas
          </button>
          {(Object.keys(CATEGORIAS_CONFIG) as CategoriaSugerencia[]).map((catKey) => {
            const cat = CATEGORIAS_CONFIG[catKey];
            const active = categoriaFilter === catKey;
            return (
              <button
                key={catKey}
                onClick={() => setCategoriaFilter(catKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                  active
                    ? `${cat.bg} ${cat.color} ${cat.border} border font-semibold`
                    : 'bg-[#181926] text-slate-400 hover:text-slate-200 border border-white/5'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Estado chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Estado:
          </span>
          <button
            onClick={() => setEstadoFilter('todas')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              estadoFilter === 'todas'
                ? 'bg-indigo-600 text-white font-semibold'
                : 'bg-[#181926] text-slate-400 hover:text-slate-200 border border-white/5'
            }`}
          >
            Todos
          </button>
          {(Object.keys(ESTADOS_CONFIG) as EstadoSugerencia[]).map((estKey) => {
            const est = ESTADOS_CONFIG[estKey];
            const active = estadoFilter === estKey;
            return (
              <button
                key={estKey}
                onClick={() => setEstadoFilter(estKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? `${est.bg} ${est.color} ${est.border} border font-semibold`
                    : 'bg-[#181926] text-slate-400 hover:text-slate-200 border border-white/5'
                }`}
              >
                {est.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* LISTADO DE PROPUESTAS */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-4">
          <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Cargando buzón de sugerencias...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          title="No se encontraron sugerencias"
          description={
            searchTerm
              ? 'No hay propuestas que coincidan con tus términos de búsqueda.'
              : 'Aún no hay propuestas registradas con estos filtros. ¡Sé el primero en proponer una idea innovadora!'
          }
          icon={Lightbulb}
          actionText="Proponer la Primera Idea"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredList.map((sug) => {
            const cat = CATEGORIAS_CONFIG[sug.categoria] || CATEGORIAS_CONFIG.otro;
            const est = ESTADOS_CONFIG[sug.estado] || ESTADOS_CONFIG.pendiente;
            const imp = IMPACTOS_CONFIG[sug.impacto] || IMPACTOS_CONFIG.medio;
            const isOwner = currentUser?.id && sug.user_id === currentUser.id;
            const canDelete = isOwner || currentUser?.role === 'admin';
            const hasVoted = Boolean(sug.user_has_voted);

            return (
              <div
                key={sug.id}
                className="group relative bg-[#13141F] hover:bg-[#161726] border border-white/10 hover:border-cyan-500/30 rounded-2xl p-5 md:p-6 transition-all duration-200 shadow-md hover:shadow-cyan-950/20 flex flex-col md:flex-row items-start gap-4 md:gap-6"
              >
                {/* BOTÓN DE VOTACIÓN CYBERPUNK */}
                <div className="flex md:flex-col items-center justify-center gap-2 self-stretch md:self-start bg-[#181926] p-2.5 rounded-xl border border-white/5 min-w-[70px]">
                  <button
                    onClick={() => handleVote(sug.id)}
                    title={hasVoted ? 'Retirar voto' : 'Votar por esta idea'}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      hasVoted
                        ? 'bg-gradient-to-br from-cyan-400 to-indigo-600 text-white shadow-lg shadow-cyan-500/30 scale-105'
                        : 'bg-white/5 text-slate-400 hover:text-cyan-300 hover:bg-white/10 active:scale-95'
                    }`}
                  >
                    <ChevronUp className={`w-6 h-6 ${hasVoted ? 'stroke-[3]' : 'stroke-[2]'}`} />
                  </button>
                  <span
                    className={`text-base font-extrabold tracking-tight ${
                      hasVoted ? 'text-cyan-400' : 'text-slate-300'
                    }`}
                  >
                    {sug.votos || 0}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {sug.votos === 1 ? 'voto' : 'votos'}
                  </span>
                </div>

                {/* CONTENIDO PRINCIPAL */}
                <div className="flex-1 space-y-3 min-w-0 w-full">
                  {/* BADGES SUPERIORES */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Categoría */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cat.bg} ${cat.color} ${cat.border}`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>

                    {/* Estado */}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${est.bg} ${est.color} ${est.border}`}
                    >
                      {est.label}
                    </span>

                    {/* Impacto */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] ${imp.badge}`}>
                      {imp.label}
                    </span>

                    {/* Fecha */}
                    <span className="text-xs text-slate-400 ml-auto flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {sug.created_at ? new Date(sug.created_at).toLocaleDateString('es-PE') : ''}
                    </span>
                  </div>

                  {/* TÍTULO Y DESCRIPCIÓN */}
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                      {sug.titulo}
                    </h3>
                    <p className="text-sm text-slate-300 mt-1.5 whitespace-pre-wrap leading-relaxed">
                      {sug.descripcion}
                    </p>
                  </div>

                  {/* METADATOS DEL AUTOR */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-400 border-t border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-white/5 text-slate-400">
                        {sug.es_anonimo ? <Shield className="w-3.5 h-3.5 text-amber-400" /> : <UserIcon className="w-3.5 h-3.5 text-cyan-400" />}
                      </span>
                      <span>
                        Propuesto por:{' '}
                        <strong className={sug.es_anonimo ? 'text-amber-400 font-semibold' : 'text-slate-200'}>
                          {sug.es_anonimo ? 'Colaborador Anónimo 👤' : (sug.colaborador || 'Colaborador')}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* BOTÓN RESPONDER (ADMIN/LÍDER) */}
                      {isAdminOrLeader && (
                        <button
                          onClick={() => {
                            setRespondModalSug(sug);
                            setAdminEstado(sug.estado);
                            setAdminRespuesta(sug.respuesta_admin || '');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Evaluar / Responder</span>
                        </button>
                      )}

                      {/* BOTÓN ELIMINAR */}
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteSug(sug.id)}
                          title="Eliminar sugerencia"
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* RESPUESTA OFICIAL DE LIDERAZGO / ADMIN (SI EXISTE) */}
                  {sug.respuesta_admin && (
                    <div className="mt-3 p-4 rounded-xl bg-gradient-to-r from-[#171a2e] to-[#141528] border-l-4 border-l-cyan-400 border border-cyan-500/20 shadow-inner space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-cyan-400" />
                          Respuesta de Liderazgo ({sug.respondido_por || 'Equipo Directivo'}):
                        </span>
                        {sug.respondido_at && (
                          <span className="text-[11px] text-slate-500">
                            {new Date(sug.respondido_at).toLocaleDateString('es-PE')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {sug.respuesta_admin}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CREAR PROPUESTA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#13141F] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Lightbulb className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">Nueva Propuesta de Mejora</h2>
                  <p className="text-xs text-slate-400">Tu aporte constructivo ayuda a evolucionar todo el equipo</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* TÍTULO */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Título de la Idea o Sugerencia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Automatizar resumen semanal de pendientes, incorporar plantilla de diseño..."
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full bg-[#181926] text-sm text-white placeholder-slate-500 rounded-xl px-4 py-2.5 border border-white/10 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* CATEGORÍA E IMPACTO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Categoría *</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value as CategoriaSugerencia })}
                    className="w-full bg-[#181926] text-sm text-white rounded-xl px-3 py-2.5 border border-white/10 focus:border-cyan-500 focus:outline-none"
                  >
                    {(Object.keys(CATEGORIAS_CONFIG) as CategoriaSugerencia[]).map((key) => (
                      <option key={key} value={key}>
                        {CATEGORIAS_CONFIG[key].icon} {CATEGORIAS_CONFIG[key].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Impacto Estimado</label>
                  <select
                    value={formData.impacto}
                    onChange={(e) => setFormData({ ...formData, impacto: e.target.value as ImpactoSugerencia })}
                    className="w-full bg-[#181926] text-sm text-white rounded-xl px-3 py-2.5 border border-white/10 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="bajo">Bajo (Optimización menor)</option>
                    <option value="medio">Medio (Mejora notable del día a día)</option>
                    <option value="alto">Alto (Ahorro de horas o gran impacto)</option>
                    <option value="estrategico">Estratégico (Cambio estructural clave)</option>
                  </select>
                </div>
              </div>

              {/* DESCRIPCIÓN */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Descripción Detallada y Beneficios *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Explica qué problema resuelve, cómo se podría implementar y qué beneficios traerá al equipo..."
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full bg-[#181926] text-sm text-white placeholder-slate-500 rounded-xl px-4 py-3 border border-white/10 focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              {/* CHECKBOX ANÓNIMO */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#181926]/80 border border-white/5">
                <input
                  type="checkbox"
                  id="check-anonimo"
                  checked={formData.es_anonimo}
                  onChange={(e) => setFormData({ ...formData, es_anonimo: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20"
                />
                <label htmlFor="check-anonimo" className="text-xs text-slate-300 cursor-pointer">
                  <span className="font-semibold text-white block">Enviar de forma 100% Anónima</span>
                  Tu nombre de usuario o identidad no se mostrará públicamente ni ante tus compañeros de equipo.
                </label>
              </div>

              {/* BOTONES */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all"
                >
                  <Send className="w-4 h-4" />
                  <span>{submitting ? 'Publicando...' : 'Publicar Propuesta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESPUESTA ADMIN / LÍDER */}
      {respondModalSug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg bg-[#13141F] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Award className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-white">Gestión de Propuesta</h2>
                  <p className="text-xs text-slate-400">Actualiza el estado y responde a los colaboradores</p>
                </div>
              </div>
              <button
                onClick={() => setRespondModalSug(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#181926] p-3 rounded-xl border border-white/5">
              <div className="text-xs font-bold text-white">{respondModalSug.titulo}</div>
              <div className="text-xs text-slate-400 mt-1 line-clamp-2">{respondModalSug.descripcion}</div>
            </div>

            <form onSubmit={handleUpdateStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Estado de la Propuesta *
                </label>
                <select
                  value={adminEstado}
                  onChange={(e) => setAdminEstado(e.target.value as EstadoSugerencia)}
                  className="w-full bg-[#181926] text-sm text-white rounded-xl px-3 py-2.5 border border-white/10 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="pendiente">Pendiente de Revisión</option>
                  <option value="en_revision">En Evaluación / Análisis</option>
                  <option value="planificada">Planificada para Implementar</option>
                  <option value="implementada">Implementada con Éxito 🎉</option>
                  <option value="descartada">No Viable / Descartada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Respuesta Oficial o Retroalimentación (Visible para todo el equipo)
                </label>
                <textarea
                  rows={4}
                  placeholder="Detalla la decisión tomada, fecha tentativa de aplicación o agradecimiento al autor..."
                  value={adminRespuesta}
                  onChange={(e) => setAdminRespuesta(e.target.value)}
                  className="w-full bg-[#181926] text-sm text-white placeholder-slate-500 rounded-xl px-4 py-3 border border-white/10 focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setRespondModalSug(null)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingStatus ? 'Guardando...' : 'Guardar y Publicar Respuesta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
