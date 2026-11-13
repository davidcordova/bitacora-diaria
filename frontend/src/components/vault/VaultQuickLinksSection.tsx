import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  X,
  EyeOff,
  RotateCcw,
  RefreshCw,
  ExternalLink,
  Check,
  Copy,
  Eye,
  Edit2,
  Trash2,
} from 'lucide-react';
import { QuickLink } from '../../types';
import { api } from '../../services/api';
import { confirmDialog } from '../DialogHost';
import { CATEGORIAS_QUICKLINKS } from './VaultConstants';

interface VaultQuickLinksSectionProps {
  isActive: boolean;
  links: QuickLink[];
  loadingLinks: boolean;
  linkSearch: string;
  setLinkSearch: (v: string) => void;
  linkCategoria: string;
  setLinkCategoria: (v: string) => void;
  linkFilterScope: 'todos' | 'mis' | 'equipo' | 'global';
  setLinkFilterScope: (v: 'todos' | 'mis' | 'equipo' | 'global') => void;
  autoHideFilteredCols: boolean;
  revealedLinkPwIds: Record<number, boolean>;
  copiedId: string | null;
  isAdminOrLeader?: boolean;
  currentUserId?: number;
  onToggleRevealLinkPw: (id: number) => void;
  onCopyText: (
    textOrGetter: string | null | undefined | (() => string),
    label: string,
    credId?: number,
    isPassword?: boolean
  ) => void;
  getLinkPw: (id: number) => string;
  isLinkModalOpen: boolean;
  setIsLinkModalOpen: (v: boolean) => void;
  onLinksChanged: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const VaultQuickLinksSection: React.FC<VaultQuickLinksSectionProps> = ({
  isActive,
  links,
  loadingLinks,
  linkSearch,
  setLinkSearch,
  linkCategoria,
  setLinkCategoria,
  linkFilterScope,
  setLinkFilterScope,
  autoHideFilteredCols,
  revealedLinkPwIds,
  copiedId,
  isAdminOrLeader,
  currentUserId,
  onToggleRevealLinkPw,
  onCopyText,
  getLinkPw,
  isLinkModalOpen,
  setIsLinkModalOpen,
  onLinksChanged,
  onShowToast,
}) => {
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const [linkFormData, setLinkFormData] = useState({
    titulo: '',
    url: '',
    categoria: 'General',
    descripcion: '',
    icono: 'Link',
    color: '#0284C7',
    usuario: '',
    password: '',
    visibilidad: 'personal' as 'personal' | 'equipo' | 'global',
  });

  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      if (linkFilterScope === 'mis' && link.user_id !== currentUserId) return false;
      if (linkFilterScope === 'equipo' && link.visibilidad !== 'equipo') return false;
      if (linkFilterScope === 'global' && link.visibilidad !== 'global') return false;
      return true;
    });
  }, [links, linkFilterScope, currentUserId]);

  const isCategoriaFiltered = linkCategoria !== 'Todas';
  const isScopeFiltered = linkFilterScope !== 'todos';
  const hasActiveLinksFilters = isCategoriaFiltered || isScopeFiltered || Boolean(linkSearch.trim());

  const hiddenLinksFieldsList = useMemo(() => {
    const list: string[] = [];
    if (autoHideFilteredCols && isCategoriaFiltered) list.push('Categoría');
    if (autoHideFilteredCols && isScopeFiltered) list.push('Ámbito');
    return list;
  }, [autoHideFilteredCols, isCategoriaFiltered, isScopeFiltered]);

  const handleOpenLinkModal = (link?: QuickLink) => {
    if (link) {
      setEditingLink(link);
      setLinkFormData({
        titulo: link.titulo,
        url: link.url,
        categoria: link.categoria || 'General',
        descripcion: link.descripcion || '',
        icono: link.icono || 'Link',
        color: link.color || '#0284C7',
        usuario: link.usuario || '',
        password: link.password || '',
        visibilidad: (link.visibilidad as 'personal' | 'equipo' | 'global') || 'personal',
      });
    } else {
      setEditingLink(null);
      setLinkFormData({
        titulo: '',
        url: '',
        categoria: 'General',
        descripcion: '',
        icono: 'Link',
        color: '#0284C7',
        usuario: '',
        password: '',
        visibilidad: 'personal',
      });
    }
    setIsLinkModalOpen(true);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;
    if (!linkFormData.titulo.trim() || !linkFormData.url.trim()) {
      onShowToast?.('Título y URL son obligatorios', 'error');
      return;
    }
    try {
      if (editingLink) {
        await api.updateQuickLink(editingLink.id, {
          ...linkFormData,
          user_id: currentUserId,
        });
        onShowToast?.('Acceso directo actualizado', 'success');
      } else {
        await api.createQuickLink({
          ...linkFormData,
          user_id: currentUserId,
        });
        onShowToast?.('Acceso directo creado', 'success');
      }
      setIsLinkModalOpen(false);
      onLinksChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al guardar enlace', 'error');
    }
  };

  const handleDeleteLink = async (id: number) => {
    if (!(await confirmDialog('¿Eliminar este acceso directo?'))) return;
    try {
      await api.deleteQuickLink(id);
      onShowToast?.('Acceso directo eliminado', 'info');
      onLinksChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al eliminar', 'error');
    }
  };

  return (
    <>
      {isActive && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-white dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar enlace, URL o descripción..."
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <select
                value={linkCategoria}
                onChange={(e) => setLinkCategoria(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {CATEGORIAS_QUICKLINKS.map((c) => (
                  <option key={c} value={c}>
                    {c === 'Todas' ? 'Todas las Categorías' : c}
                  </option>
                ))}
              </select>

              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-[#1A1E29] p-0.5 border border-slate-200 dark:border-white/10 text-xs font-medium overflow-x-auto max-w-full">
                {(['todos', 'mis', 'equipo', 'global'] as const).map((scope) => (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setLinkFilterScope(scope)}
                    className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                      linkFilterScope === scope
                        ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {scope === 'todos'
                      ? 'Todos'
                      : scope === 'mis'
                      ? 'Mis Enlaces'
                      : scope === 'equipo'
                      ? 'Equipo'
                      : 'Global'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenLinkModal()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Acceso</span>
            </button>
          </div>

          {hasActiveLinksFilters && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-slate-50 dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 text-[11px] uppercase tracking-wider mr-1">
                  <Filter className="w-3 h-3 text-sky-500" />
                  Filtros activos:
                </span>

                {isCategoriaFiltered && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 font-semibold text-xs">
                    <span>{linkCategoria}</span>
                    <button
                      type="button"
                      onClick={() => setLinkCategoria('Todas')}
                      title="Quitar filtro de categoría"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {isScopeFiltered && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-[#222735] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/10 font-semibold text-xs">
                    <span>
                      {linkFilterScope === 'mis'
                        ? 'Mis Enlaces'
                        : linkFilterScope === 'equipo'
                        ? 'Equipo'
                        : 'Global'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setLinkFilterScope('todos')}
                      title="Quitar filtro de ámbito"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {linkSearch.trim() && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-[#222735] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/10 font-semibold text-xs">
                    <span>"{linkSearch}"</span>
                    <button
                      type="button"
                      onClick={() => setLinkSearch('')}
                      title="Limpiar búsqueda"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {hiddenLinksFieldsList.length > 0 && (
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1 bg-slate-100 dark:bg-[#1A1E29] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10">
                    <EyeOff className="w-3 h-3 text-slate-400" />
                    <span>Campos repetitivos ocultos ({hiddenLinksFieldsList.join(', ')})</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setLinkCategoria('Todas');
                  setLinkFilterScope('todos');
                  setLinkSearch('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 transition-colors cursor-pointer ml-auto"
                title="Restablecer filtros de accesos"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            </div>
          )}

          {loadingLinks ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
              <p className="text-sm">Cargando accesos rápidos...</p>
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#161922] border border-dashed border-slate-300 dark:border-white/15 rounded-2xl p-6">
              <ExternalLink className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                No hay accesos directos registrados
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLinks.map((link) => {
                const canManage = isAdminOrLeader || link.user_id === currentUserId;
                const isPwRevealed = Boolean(revealedLinkPwIds[link.id]);

                return (
                  <div
                    key={link.id}
                    className="group bg-white dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] hover:border-sky-500/40 rounded-2xl p-5 shadow-xs transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0"
                            style={{ backgroundColor: link.color || '#0284C7' }}
                          >
                            {link.titulo.substring(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors line-clamp-1">
                              {link.titulo}
                            </h3>
                            {(!autoHideFilteredCols || !isCategoriaFiltered) && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1E222D] text-slate-600 dark:text-slate-300 font-medium inline-block mt-0.5">
                                {link.categoria || 'General'}
                              </span>
                            )}
                          </div>
                        </div>
                        {(!autoHideFilteredCols || !isScopeFiltered) && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border bg-slate-100 dark:bg-[#1E222D] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 shrink-0">
                            {link.visibilidad === 'personal'
                              ? 'Personal'
                              : link.visibilidad === 'equipo'
                              ? 'Equipo'
                              : 'Global'}
                          </span>
                        )}
                      </div>

                      {link.descripcion && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">
                          {link.descripcion}
                        </p>
                      )}

                      {(link.usuario || link.password || link.has_password) && (
                        <div className="bg-slate-50 dark:bg-[#1A1E29] rounded-xl p-2.5 border border-slate-200/70 dark:border-white/[0.08] mb-3 space-y-1.5 text-xs font-mono">
                          {link.usuario && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400 text-[11px] shrink-0">User:</span>
                              <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
                                <span className="text-slate-700 dark:text-slate-300 truncate">{link.usuario}</span>
                                <button
                                  type="button"
                                  onClick={() => onCopyText(link.usuario!, 'Usuario', link.id, false)}
                                  title="Copiar usuario"
                                  className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1 rounded-md text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer inline-flex items-center justify-center shrink-0"
                                >
                                  {copiedId === `${link.id}-Usuario` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          {(link.password || link.has_password) && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400 text-[11px] shrink-0">Pass:</span>
                              <div className="flex items-center gap-1 flex-1 justify-end min-w-0">
                                <span
                                  className={`truncate ${
                                    isPwRevealed
                                      ? 'text-amber-600 dark:text-amber-300 font-semibold'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {isPwRevealed ? link.password : '••••••••'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onToggleRevealLinkPw(link.id)}
                                  title={isPwRevealed ? 'Ocultar' : 'Ver por 10s'}
                                  className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1 rounded-md text-slate-400 hover:text-amber-500 cursor-pointer inline-flex items-center justify-center shrink-0"
                                >
                                  {isPwRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onCopyText(() => getLinkPw(link.id), 'Contraseña', link.id, true)}
                                  title="Copiar contraseña"
                                  className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1 rounded-md text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer inline-flex items-center justify-center shrink-0"
                                >
                                  {copiedId === `${link.id}-Contraseña` ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2 mt-auto">
                      <div className="flex items-center gap-1">
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleOpenLinkModal(link)}
                              className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLink(link.id)}
                              className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>

                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 dark:bg-sky-500/10 hover:bg-sky-600 dark:hover:bg-sky-600 text-sky-700 dark:text-sky-300 hover:text-white text-xs font-semibold border border-sky-200 dark:border-sky-500/25 transition-colors"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: ACCESO DIRECTO */}
      {isLinkModalOpen && (
        <div
          onClick={() => setIsLinkModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <span>{editingLink ? 'Editar Acceso Directo' : 'Nuevo Acceso Directo'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLink} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Título / Nombre *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Google Workspace, Jira"
                  value={linkFormData.titulo}
                  onChange={(e) => setLinkFormData({ ...linkFormData, titulo: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">URL / Enlace *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. https://mail.empresa.pe"
                  value={linkFormData.url}
                  onChange={(e) => setLinkFormData({ ...linkFormData, url: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                  <select
                    value={linkFormData.categoria}
                    onChange={(e) => setLinkFormData({ ...linkFormData, categoria: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {CATEGORIAS_QUICKLINKS.filter((c) => c !== 'Todas').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Visibilidad</label>
                  <select
                    value={linkFormData.visibilidad}
                    onChange={(e) => setLinkFormData({ ...linkFormData, visibilidad: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="personal">Solo para mí</option>
                    <option value="equipo">Compartido con Equipo</option>
                    {isAdminOrLeader && <option value="global">Global (Toda la Empresa)</option>}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
                <input
                  type="text"
                  placeholder="Detalles útiles"
                  value={linkFormData.descripcion}
                  onChange={(e) => setLinkFormData({ ...linkFormData, descripcion: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-200/80 dark:border-white/[0.08] space-y-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
                  Credenciales de acceso rápido (Opcional)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Usuario / Email"
                    value={linkFormData.usuario}
                    onChange={(e) => setLinkFormData({ ...linkFormData, usuario: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs"
                  />
                  <input
                    type="text"
                    placeholder={editingLink ? 'Dejar vacío para conservar clave actual' : 'Contraseña'}
                    value={linkFormData.password || ''}
                    onChange={(e) => setLinkFormData({ ...linkFormData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  {editingLink ? 'Actualizar' : 'Guardar Acceso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
