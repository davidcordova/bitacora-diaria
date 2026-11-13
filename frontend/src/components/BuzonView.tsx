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
  Paperclip,
  Image as ImageIcon,
  Eye,
  ExternalLink,
  Download,
  FileText,
  UploadCloud,
  Loader2,
  Bug,
} from 'lucide-react';
import { Sugerencia, User, CategoriaSugerencia, ImpactoSugerencia, EstadoSugerencia, Evidencia } from '../types';
import { api } from '../services/api';
import { EmptyState } from './EmptyState';
import { confirmDialog } from './DialogHost';
import { useModalBehavior } from '../hooks/useModalBehavior';

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
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/25',
  },
  herramienta_it: {
    label: 'Herramientas / IT',
    icon: '💻',
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-500/10',
    border: 'border-sky-200 dark:border-sky-500/25',
  },
  bienestar_equipo: {
    label: 'Bienestar y Cultura',
    icon: '🌱',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/25',
  },
  innovacion: {
    label: 'Innovación / Producto',
    icon: '🚀',
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-500/10',
    border: 'border-sky-200 dark:border-sky-500/25',
  },
  comunicacion: {
    label: 'Comunicación Interna',
    icon: '💬',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-white/[0.06]',
    border: 'border-slate-200 dark:border-white/10',
  },
  sistema: {
    label: 'Sistema / Bitácora',
    icon: '⚙️',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-white/[0.06]',
    border: 'border-slate-200 dark:border-white/10',
  },
  error_bug: {
    label: 'Reporte de Error / Bug',
    icon: '🐛',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/25',
  },
  otro: {
    label: 'Otra Idea',
    icon: '💡',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-white/[0.06]',
    border: 'border-slate-200 dark:border-white/10',
  },
};

const ESTADOS_CONFIG: Record<
  EstadoSugerencia,
  { label: string; color: string; bg: string; border: string }
> = {
  pendiente: {
    label: 'Pendiente',
    color: 'text-slate-700 dark:text-slate-300',
    bg: 'bg-slate-100 dark:bg-white/[0.06]',
    border: 'border-slate-200 dark:border-white/10',
  },
  en_revision: {
    label: 'En Evaluación',
    color: 'text-amber-800 dark:text-amber-300',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/25',
  },
  planificada: {
    label: 'Planificada',
    color: 'text-sky-800 dark:text-sky-300',
    bg: 'bg-sky-50 dark:bg-sky-500/10',
    border: 'border-sky-200 dark:border-sky-500/25',
  },
  implementada: {
    label: 'Implementada 🎉',
    color: 'text-emerald-800 dark:text-emerald-300',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/25',
  },
  descartada: {
    label: 'No Viable',
    color: 'text-rose-800 dark:text-rose-300',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/25',
  },
};

const IMPACTOS_CONFIG: Record<ImpactoSugerencia, { label: string; badge: string }> = {
  bajo: { label: 'Bajo', badge: 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10' },
  medio: { label: 'Medio', badge: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/25' },
  alto: { label: 'Alto Impacto', badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25' },
  estrategico: { label: 'Estratégico ★', badge: 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-500/35 font-semibold' },
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImageFile = (urlOrName?: string) => {
  if (!urlOrName) return false;
  return /\.(png|jpe?g|gif|webp|svg)($|\?)/i.test(urlOrName);
};

export const BuzonView: React.FC<BuzonViewProps> = ({ currentUser, onShowToast }) => {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoriaFilter, setCategoriaFilter] = useState<string>('todas');
  const [estadoFilter, setEstadoFilter] = useState<string>('todas');
  const [soloMias, setSoloMias] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'reciente' | 'popular'>('popular');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modal para proponer idea / reporte
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<{
    titulo: string;
    descripcion: string;
    categoria: CategoriaSugerencia;
    impacto: ImpactoSugerencia;
    es_anonimo: boolean;
    evidencias: Evidencia[];
  }>({
    titulo: '',
    descripcion: '',
    categoria: 'mejora_proceso',
    impacto: 'medio',
    es_anonimo: false,
    evidencias: [],
  });
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [previewEvidencia, setPreviewEvidencia] = useState<Evidencia | null>(null);

  // Modal para responder / cambiar estado (Admin o Líder)
  const [respondModalSug, setRespondModalSug] = useState<Sugerencia | null>(null);
  const [adminEstado, setAdminEstado] = useState<EstadoSugerencia>('en_revision');
  const [adminRespuesta, setAdminRespuesta] = useState<string>('');
  const [savingStatus, setSavingStatus] = useState<boolean>(false);

  const isAdminOrLeader = currentUser?.role === 'admin' || currentUser?.role === 'lider' || currentUser?.is_leader;

  useModalBehavior(Boolean(isModalOpen || respondModalSug || previewEvidencia), () => {
    if (previewEvidencia) {
      setPreviewEvidencia(null);
    } else if (respondModalSug) {
      setRespondModalSug(null);
    } else if (isModalOpen) {
      setIsModalOpen(false);
    }
  });

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
  }, [categoriaFilter, estadoFilter, soloMias, sortBy, currentUser?.id]);

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

  // Interceptar pegado Ctrl+V de capturas de pantalla cuando el modal está abierto
  useEffect(() => {
    if (!isModalOpen) return;
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            try {
              setIsUploading(true);
              const uploaded = await api.uploadFile(file);
              setFormData((prev) => ({
                ...prev,
                evidencias: [...prev.evidencias, uploaded],
              }));
              if (onShowToast) onShowToast('¡Captura pegada y adjuntada como prueba!', 'success');
            } catch (err: any) {
              console.error('Error al subir screenshot:', err);
              if (onShowToast) onShowToast(err.message || 'Error al procesar captura', 'error');
            } finally {
              setIsUploading(false);
            }
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isModalOpen, onShowToast]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    const newEvidencias: Evidencia[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploaded = await api.uploadFile(file);
        newEvidencias.push(uploaded);
      }
      setFormData((prev) => ({
        ...prev,
        evidencias: [...prev.evidencias, ...newEvidencias],
      }));
      if (onShowToast) onShowToast(`${newEvidencias.length} prueba(s) adjuntada(s) con éxito`, 'success');
    } catch (err: any) {
      console.error('Error al subir archivos:', err);
      if (onShowToast) onShowToast(err.message || 'Error al subir archivo', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveEvidencia = (indexToRemove: number) => {
    setFormData((prev) => ({
      ...prev,
      evidencias: prev.evidencias.filter((_, idx) => idx !== indexToRemove),
    }));
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
        evidencias: formData.evidencias,
      });
      if (onShowToast) onShowToast('¡Tu propuesta/reporte ha sido enviado con éxito!', 'success');
      setIsModalOpen(false);
      setFormData({
        titulo: '',
        descripcion: '',
        categoria: 'mejora_proceso',
        impacto: 'medio',
        es_anonimo: false,
        evidencias: [],
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
    if (!(await confirmDialog('¿Seguro que deseas eliminar esta propuesta del buzón?'))) return;
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
    <div className="space-y-6 pb-12 animate-fade-in text-slate-800 dark:text-slate-100">
      {/* HEADER PRINCIPAL */}
      <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/[0.08] p-5 sm:p-6 shadow-xs">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200/80 dark:border-sky-500/25 text-sky-600 dark:text-sky-400">
              <Lightbulb className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Buzón de Ideas
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Propuestas de mejora continua, herramientas y retroalimentación del equipo
              </p>
            </div>
          </div>

          <button
            id="btn-nueva-sugerencia"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs text-white bg-sky-600 hover:bg-sky-700 active:scale-[0.99] transition-colors cursor-pointer min-h-[38px] self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Proponer Idea</span>
          </button>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-200/80 dark:border-white/[0.07]">
          <div className="bg-slate-50/80 dark:bg-[#1A1E29] rounded-xl p-3.5 border border-slate-200/80 dark:border-white/[0.06]">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Total Ideas
            </div>
            <div className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1 tabular-nums">{stats.total}</div>
          </div>
          <div className="bg-slate-50/80 dark:bg-[#1A1E29] rounded-xl p-3.5 border border-slate-200/80 dark:border-white/[0.06]">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              En Evaluación / Plan
            </div>
            <div className="text-xl md:text-2xl font-bold text-amber-600 dark:text-amber-300 mt-1 tabular-nums">{stats.enRevision}</div>
          </div>
          <div className="bg-slate-50/80 dark:bg-[#1A1E29] rounded-xl p-3.5 border border-slate-200/80 dark:border-white/[0.06]">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              Implementadas
            </div>
            <div className="text-xl md:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">{stats.implementadas}</div>
          </div>
          <div className="bg-slate-50/80 dark:bg-[#1A1E29] rounded-xl p-3.5 border border-slate-200/80 dark:border-white/[0.06]">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <ThumbsUp className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              Votos del Equipo
            </div>
            <div className="text-xl md:text-2xl font-bold text-sky-700 dark:text-sky-300 mt-1 tabular-nums">{stats.totalVotos}</div>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS Y ORDENAMIENTO */}
      <div className="bg-white dark:bg-[#161922] rounded-2xl p-4 border border-slate-200/90 dark:border-white/[0.08] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Búsqueda rápida */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar propuesta por título, autor o contenido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#1E222D] text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl pl-10 pr-10 py-2.5 border border-slate-200 dark:border-white/10 focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] focus:outline-none transition-colors"
            />
            <span className="absolute left-3.5 top-3 text-slate-400 pointer-events-none">
              <Filter className="w-4 h-4" />
            </span>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Toggle Más Votadas / Más Recientes */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#1A1E29] rounded-xl border border-slate-200/80 dark:border-white/[0.07] self-start md:self-auto">
            <button
              type="button"
              onClick={() => setSortBy('popular')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px] cursor-pointer ${
                sortBy === 'popular'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Más Votadas
            </button>
            <button
              type="button"
              onClick={() => setSortBy('reciente')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px] cursor-pointer ${
                sortBy === 'reciente'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Más Recientes
            </button>
          </div>

          {/* Filtro Mis Propuestas */}
          {currentUser && (
            <button
              type="button"
              onClick={() => setSoloMias(!soloMias)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border min-h-[38px] cursor-pointer ${
                soloMias
                  ? 'bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-300 dark:border-sky-500/40'
                  : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-slate-200/80 dark:border-white/[0.07]'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              Solo Mis Propuestas
            </button>
          )}
        </div>

        {/* Categorías y Estados chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80 dark:border-white/[0.07]">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Categoría:
          </span>
          <button
            type="button"
            onClick={() => setCategoriaFilter('todas')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[32px] ${
              categoriaFilter === 'todas'
                ? 'bg-sky-600 text-white font-semibold'
                : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200/80 dark:border-white/[0.07]'
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
                type="button"
                onClick={() => setCategoriaFilter(catKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer min-h-[32px] ${
                  active
                    ? `${cat.bg} ${cat.color} ${cat.border} border font-semibold`
                    : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200/80 dark:border-white/[0.07]'
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
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Estado:
          </span>
          <button
            type="button"
            onClick={() => setEstadoFilter('todas')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[32px] ${
              estadoFilter === 'todas'
                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-semibold'
                : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200/80 dark:border-white/[0.07]'
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
                type="button"
                onClick={() => setEstadoFilter(estKey)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer min-h-[32px] ${
                  active
                    ? `${est.bg} ${est.color} ${est.border} border font-semibold`
                    : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-slate-200/80 dark:border-white/[0.07]'
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
          <div className="w-10 h-10 border-3 border-sky-500/20 border-t-sky-600 dark:border-t-sky-400 rounded-full animate-spin" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando buzón de sugerencias...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <EmptyState
          title="No se encontraron sugerencias"
          description={
            searchTerm
              ? 'No hay propuestas que coincidan con tus términos de búsqueda.'
              : 'Aún no hay propuestas registradas con estos filtros. ¡Sé el primero en proponer una idea!'
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
                className="group relative bg-white dark:bg-[#161922] hover:bg-slate-50/60 dark:hover:bg-[#1A1E29] border border-slate-200/90 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/15 rounded-2xl p-4 sm:p-5 transition-colors shadow-2xs flex flex-col md:flex-row items-start gap-4 md:gap-5"
              >
                {/* BOTÓN DE VOTACIÓN ADAPTATIVO */}
                <div className="flex md:flex-col items-center justify-center gap-2 self-stretch md:self-start bg-slate-50 dark:bg-[#1A1E29] p-2.5 rounded-xl border border-slate-200/80 dark:border-white/[0.06] min-w-[70px]">
                  <button
                    type="button"
                    onClick={() => handleVote(sug.id)}
                    title={hasVoted ? 'Retirar voto' : 'Votar por esta idea'}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                      hasVoted
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-white dark:bg-white/[0.05] text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-300 hover:bg-slate-100 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <ChevronUp className={`w-6 h-6 ${hasVoted ? 'stroke-[3]' : 'stroke-[2]'}`} />
                  </button>
                  <span
                    className={`text-base font-bold tracking-tight tabular-nums ${
                      hasVoted ? 'text-sky-600 dark:text-sky-400' : 'text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {sug.votos || 0}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
                    {sug.votos === 1 ? 'voto' : 'votos'}
                  </span>
                </div>

                {/* CONTENIDO PRINCIPAL */}
                <div className="flex-1 space-y-3 min-w-0 w-full">
                  {/* BADGES SUPERIORES */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Categoría */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium border ${cat.bg} ${cat.color} ${cat.border}`}
                    >
                      <span>{cat.icon}</span>
                      <span>{cat.label}</span>
                    </span>

                    {/* Estado */}
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${est.bg} ${est.color} ${est.border}`}
                    >
                      {est.label}
                    </span>

                    {/* Impacto */}
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] ${imp.badge}`}>
                      {imp.label}
                    </span>

                    {/* Fecha */}
                    <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                      {sug.created_at ? new Date(sug.created_at).toLocaleDateString('es-PE') : ''}
                    </span>
                  </div>

                  {/* TÍTULO Y DESCRIPCIÓN */}
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors break-words">
                      {sug.titulo}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 whitespace-pre-wrap leading-relaxed break-words">
                      {sug.descripcion}
                    </p>
                  </div>

                  {/* PRUEBAS / EVIDENCIAS ADJUNTAS */}
                  {sug.evidencias && sug.evidencias.length > 0 && (
                    <div className="pt-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                        <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                        <span>Pruebas y capturas adjuntas ({sug.evidencias.length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {sug.evidencias.map((ev, evIdx) => {
                          const isImg = isImageFile(ev.url) || isImageFile(ev.nombre);
                          return (
                            <div
                              key={evIdx}
                              className="group/ev relative flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 hover:border-sky-500/40 hover:bg-sky-50/40 dark:hover:bg-sky-500/10 transition-colors cursor-pointer max-w-xs"
                              onClick={() => {
                                if (isImg) {
                                  setPreviewEvidencia(ev);
                                } else {
                                  window.open(ev.url, '_blank');
                                }
                              }}
                              title={ev.nombre}
                            >
                              {isImg ? (
                                <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 shrink-0 border border-slate-300 dark:border-slate-700 relative">
                                  <img
                                    src={ev.url}
                                    alt={ev.nombre}
                                    className="w-full h-full object-cover group-hover/ev:scale-105 transition-transform"
                                  />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/ev:opacity-100 flex items-center justify-center transition-opacity text-white">
                                    <Eye className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 flex items-center justify-center shrink-0">
                                  <FileText className="w-5 h-5" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
                                  {ev.nombre}
                                </p>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                  <span>{formatFileSize(ev.tamano)}</span>
                                  <span className="text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-0.5">
                                    {isImg ? 'Ver prueba' : 'Descargar'}
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* METADATOS DEL AUTOR */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <span className="p-1 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400">
                        {sug.es_anonimo ? <Shield className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" /> : <UserIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
                      </span>
                      <span>
                        Propuesto por:{' '}
                        <strong className={sug.es_anonimo ? 'text-amber-700 dark:text-amber-400 font-semibold' : 'text-slate-800 dark:text-slate-200'}>
                          {sug.es_anonimo ? 'Colaborador Anónimo 👤' : (sug.colaborador || 'Colaborador')}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* BOTÓN RESPONDER (ADMIN/LÍDER) */}
                      {isAdminOrLeader && (
                        <button
                          type="button"
                          onClick={() => {
                            setRespondModalSug(sug);
                            setAdminEstado(sug.estado);
                            setAdminRespuesta(sug.respuesta_admin || '');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-100 dark:hover:bg-sky-500/20 border border-sky-200 dark:border-sky-500/25 transition-colors min-h-[36px] cursor-pointer"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Evaluar / Responder</span>
                        </button>
                      )}

                      {/* BOTÓN ELIMINAR */}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSug(sug.id)}
                          title="Eliminar sugerencia"
                          className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* RESPUESTA OFICIAL DE LIDERAZGO / ADMIN (SI EXISTE) */}
                  {sug.respuesta_admin && (
                    <div className="mt-3 p-4 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border-l-4 border-l-sky-500 dark:border-l-sky-400 border border-slate-200/80 dark:border-white/[0.08] space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                          <Award className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          Respuesta de Liderazgo ({sug.respondido_por || 'Equipo Directivo'}):
                        </span>
                        {sug.respondido_at && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                            {new Date(sug.respondido_at).toLocaleDateString('es-PE')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed break-words">
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
        <div
          onClick={() => setIsModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in overflow-y-auto"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-sky-500/25">
                  <Lightbulb className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Nueva Propuesta de Mejora</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Tu aporte constructivo ayuda a evolucionar todo el equipo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* TÍTULO */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Título de la Idea o Sugerencia *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Automatizar resumen semanal de pendientes, incorporar plantilla de diseño..."
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#1E222D] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-200 dark:border-white/10 focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] focus:outline-none"
                />
              </div>

              {/* CATEGORÍA E IMPACTO */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Categoría *</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value as CategoriaSugerencia })}
                    className="w-full bg-slate-50 dark:bg-[#1E222D] text-sm text-slate-900 dark:text-white rounded-xl px-3 py-2.5 border border-slate-200 dark:border-white/10 focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] focus:outline-none"
                  >
                    {(Object.keys(CATEGORIAS_CONFIG) as CategoriaSugerencia[]).map((key) => (
                      <option key={key} value={key}>
                        {CATEGORIAS_CONFIG[key].icon} {CATEGORIAS_CONFIG[key].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Impacto Estimado</label>
                  <select
                    value={formData.impacto}
                    onChange={(e) => setFormData({ ...formData, impacto: e.target.value as ImpactoSugerencia })}
                    className="w-full bg-slate-50 dark:bg-[#1E222D] text-sm text-slate-900 dark:text-white rounded-xl px-3 py-2.5 border border-slate-200 dark:border-white/10 focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] focus:outline-none"
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
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Descripción Detallada y Beneficios *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Explica qué problema resuelve, cómo se podría implementar y qué beneficios traerá al equipo..."
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#1E222D] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-4 py-3 border border-slate-200 dark:border-white/10 focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] focus:outline-none resize-none"
                />
              </div>

              {/* PRUEBAS / CAPTURAS DE PANTALLA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pruebas / Capturas de pantalla
                  </label>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">
                    Pega con <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10 text-[10px] font-mono">Ctrl + V</kbd> o sube archivos
                  </span>
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFileUpload(e.dataTransfer.files);
                  }}
                  className={`relative border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                    isDragging
                      ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-500/10'
                      : 'border-slate-200 dark:border-white/10 hover:border-sky-500/40 bg-slate-50/60 dark:bg-[#1A1E29]'
                  }`}
                >
                  <input
                    type="file"
                    id="buzon-file-input"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                  <label
                    htmlFor="buzon-file-input"
                    className="flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <div className="p-2 rounded-full bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400">
                      {isUploading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <UploadCloud className="w-5 h-5" />
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {isUploading ? 'Subiendo prueba...' : 'Selecciona o arrastra capturas del error aquí'}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Imágenes (PNG, JPG, WEBP), PDFs o documentos
                    </p>
                  </label>
                </div>

                {/* Lista de evidencias adjuntas */}
                {formData.evidencias.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    {formData.evidencias.map((ev, idx) => {
                      const isImg = isImageFile(ev.url) || isImageFile(ev.nombre);
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-2 rounded-xl bg-slate-100 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-xs"
                        >
                          {isImg ? (
                            <img
                              src={ev.url}
                              alt={ev.nombre}
                              className="w-8 h-8 rounded object-cover shrink-0 border border-slate-300 dark:border-slate-700"
                            />
                          ) : (
                            <FileText className="w-6 h-6 text-slate-500 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{ev.nombre}</p>
                            <p className="text-[10px] text-slate-400">{formatFileSize(ev.tamano)}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveEvidencia(idx)}
                            className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors flex items-center justify-center cursor-pointer"
                            title="Quitar prueba"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* CHECKBOX ANÓNIMO */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08]">
                <input
                  type="checkbox"
                  id="check-anonimo"
                  checked={formData.es_anonimo}
                  onChange={(e) => setFormData({ ...formData, es_anonimo: e.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-sky-600 focus:ring-sky-500/20"
                />
                <label htmlFor="check-anonimo" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <span className="font-semibold text-slate-900 dark:text-white block">Enviar de forma 100% Anónima</span>
                  Tu nombre de usuario o identidad no se mostrará públicamente ni ante tus compañeros de equipo.
                </label>
              </div>

              {/* BOTONES */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors min-h-[38px] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition-colors min-h-[38px] cursor-pointer"
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
        <div
          onClick={() => setRespondModalSug(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fade-in overflow-y-auto"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-sky-500/25">
                  <Award className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Gestión de Propuesta</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Actualiza el estado y responde a los colaboradores</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRespondModalSug(null)}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center cursor-pointer"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-[#1A1E29] p-3 rounded-xl border border-slate-200/80 dark:border-white/[0.08] space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white break-words">{respondModalSug.titulo}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-3 break-words">{respondModalSug.descripcion}</div>

              {/* PRUEBAS ADJUNTAS EN EL MODAL DE EVALUACIÓN */}
              {respondModalSug.evidencias && respondModalSug.evidencias.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                  <div className="text-[11px] font-bold text-sky-700 dark:text-sky-400 flex items-center gap-1 mb-1.5">
                    <Paperclip className="w-3 h-3" />
                    <span>Pruebas adjuntas por el colaborador ({respondModalSug.evidencias.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {respondModalSug.evidencias.map((ev, evIdx) => {
                      const isImg = isImageFile(ev.url) || isImageFile(ev.nombre);
                      return (
                        <div
                          key={evIdx}
                          onClick={() => {
                            if (isImg) setPreviewEvidencia(ev);
                            else window.open(ev.url, '_blank');
                          }}
                          className="flex items-center gap-1.5 p-1.5 px-2.5 rounded-lg bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 text-xs cursor-pointer hover:border-sky-500 transition-colors"
                          title="Clic para ver o descargar"
                        >
                          {isImg ? (
                            <img src={ev.url} alt={ev.nombre} className="w-5 h-5 rounded object-cover" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-500" />
                          )}
                          <span className="truncate max-w-[140px] text-slate-700 dark:text-slate-300 font-medium">{ev.nombre}</span>
                          <Eye className="w-3 h-3 text-slate-400 ml-1" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleUpdateStatusSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Estado de la Propuesta *
                </label>
                <select
                  value={adminEstado}
                  onChange={(e) => setAdminEstado(e.target.value as EstadoSugerencia)}
                  className="w-full bg-slate-50 dark:bg-[#1E222D] text-sm text-slate-900 dark:text-white rounded-xl px-3 py-2.5 border border-slate-200 dark:border-white/10 focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] focus:outline-none"
                >
                  <option value="pendiente">Pendiente de Revisión</option>
                  <option value="en_revision">En Evaluación / Análisis</option>
                  <option value="planificada">Planificada para Implementar</option>
                  <option value="implementada">Implementada con Éxito 🎉</option>
                  <option value="descartada">No Viable / Descartada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Respuesta Oficial o Retroalimentación (Visible para todo el equipo)
                </label>
                <textarea
                  rows={4}
                  placeholder="Detalla la decisión tomada, fecha tentativa de aplicación o agradecimiento al autor..."
                  value={adminRespuesta}
                  onChange={(e) => setAdminRespuesta(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#1E222D] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-4 py-3 border border-slate-200 dark:border-white/10 focus:border-sky-500 focus:bg-white dark:focus:bg-[#1E222D] focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setRespondModalSug(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors min-h-[38px] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingStatus}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 transition-colors min-h-[38px] cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{savingStatus ? 'Guardando...' : 'Guardar y Publicar Respuesta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LIGHTBOX / VISOR DE CAPTURA A PANTALLA COMPLETA */}
      {previewEvidencia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/85 backdrop-blur-sm animate-fade-in overflow-y-auto"
          onClick={() => setPreviewEvidencia(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="relative max-w-4xl w-full my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[92vh] flex flex-col bg-[#161922] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-[#1A1E29] border-b border-white/10 text-white shrink-0">
              <div className="flex items-center gap-2 min-w-0 pr-4">
                <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm font-semibold truncate">{previewEvidencia.nombre}</span>
                {previewEvidencia.tamano && (
                  <span className="text-xs text-slate-400 shrink-0">({formatFileSize(previewEvidencia.tamano)})</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewEvidencia.url}
                  download={previewEvidencia.nombre}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center justify-center"
                  title="Abrir imagen original / descargar"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewEvidencia(null)}
                  className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg bg-white/10 hover:bg-rose-500 text-white transition-colors flex items-center justify-center cursor-pointer"
                  title="Cerrar visor (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-2 flex-1 min-h-0 flex items-center justify-center overflow-auto bg-black/60">
              <img
                src={previewEvidencia.url}
                alt={previewEvidencia.nombre}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
