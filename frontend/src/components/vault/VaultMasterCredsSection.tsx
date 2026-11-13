import React, { useState, useMemo } from 'react';
import {
  Search,
  Building2,
  Tag,
  Plus,
  Filter,
  X,
  EyeOff,
  RotateCcw,
  RefreshCw,
  Shield,
  ExternalLink,
  Check,
  Copy,
  Eye,
  Users,
  Edit2,
  Trash2,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import {
  ItCredential,
  ItCredentialPermission,
  ItEmpresa,
  ItPlataforma,
} from '../../types';
import { api } from '../../services/api';
import { confirmDialog } from '../DialogHost';
import { TIPO_SERVICIOS_PRESET, generateVaultPassword } from './VaultConstants';
import { CatalogTabType } from './VaultCatalogModal';

interface VaultMasterCredsSectionProps {
  isActive: boolean;
  credentials: ItCredential[];
  loadingVault: boolean;
  empresas: ItEmpresa[];
  plataformasCatalog: ItPlataforma[];
  vaultSearch: string;
  setVaultSearch: (v: string) => void;
  selectedEmpresaId: number | 'todas';
  setSelectedEmpresaId: (v: number | 'todas') => void;
  selectedMarcaId: number | 'todas';
  setSelectedMarcaId: (v: number | 'todas') => void;
  selectedTipoServicio: string;
  setSelectedTipoServicio: (v: string) => void;
  autoHideFilteredCols: boolean;
  revealedCredPwIds: Record<number, boolean>;
  copiedId: string | null;
  isAdminOrLeader?: boolean;
  currentUserId?: number;
  onToggleRevealCred: (credId: number) => void;
  onCopyText: (
    textOrGetter: string | null | undefined | (() => string),
    label: string,
    credId?: number,
    isPassword?: boolean
  ) => void;
  getCredPw: (id: number) => string;
  isCredModalOpen: boolean;
  setIsCredModalOpen: (v: boolean) => void;
  isPermModalOpen: boolean;
  setIsPermModalOpen: (v: boolean) => void;
  onVaultChanged: () => void;
  onOpenCatalogModal: (tab: CatalogTabType) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const VaultMasterCredsSection: React.FC<VaultMasterCredsSectionProps> = ({
  isActive,
  credentials,
  loadingVault,
  empresas,
  plataformasCatalog,
  vaultSearch,
  setVaultSearch,
  selectedEmpresaId,
  setSelectedEmpresaId,
  selectedMarcaId,
  setSelectedMarcaId,
  selectedTipoServicio,
  setSelectedTipoServicio,
  autoHideFilteredCols,
  revealedCredPwIds,
  copiedId,
  isAdminOrLeader,
  currentUserId,
  onToggleRevealCred,
  onCopyText,
  getCredPw,
  isCredModalOpen,
  setIsCredModalOpen,
  isPermModalOpen,
  setIsPermModalOpen,
  onVaultChanged,
  onOpenCatalogModal,
  onShowToast,
}) => {
  const [editingCred, setEditingCred] = useState<ItCredential | null>(null);
  const [selectedCredForPerms, setSelectedCredForPerms] = useState<ItCredential | null>(null);
  const [credPermissions, setCredPermissions] = useState<ItCredentialPermission[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  const [credFormData, setCredFormData] = useState({
    empresa_id: 0,
    marca_id: 0,
    plataforma: '',
    tipo_servicio: 'Correo Corporativo',
    url_acceso: '',
    usuario_login: '',
    password_secret: '',
    notas: '',
    tipo_cuenta: 'operativa',
  });

  const filterMarcas = useMemo(() => {
    if (selectedEmpresaId === 'todas') return [];
    const emp = empresas.find((e) => e.id === selectedEmpresaId);
    return emp?.marcas || [];
  }, [empresas, selectedEmpresaId]);

  const credFormSelectedEmpresaMarcas = useMemo(() => {
    const emp = empresas.find((e) => e.id === Number(credFormData.empresa_id));
    return emp?.marcas || [];
  }, [empresas, credFormData.empresa_id]);

  const isEmpresaFiltered = selectedEmpresaId !== 'todas';
  const isMarcaFiltered = selectedMarcaId !== 'todas';
  const isTipoServicioFiltered = selectedTipoServicio !== 'Todos';

  const selectedVaultEmpresaObj = useMemo(() => {
    if (selectedEmpresaId === 'todas') return null;
    return empresas.find((e) => e.id === selectedEmpresaId) || null;
  }, [selectedEmpresaId, empresas]);

  const selectedVaultMarcaObj = useMemo(() => {
    if (selectedMarcaId === 'todas' || !selectedVaultEmpresaObj) return null;
    return selectedVaultEmpresaObj.marcas?.find((m) => m.id === selectedMarcaId) || null;
  }, [selectedMarcaId, selectedVaultEmpresaObj]);

  const hasActiveVaultFilters =
    isEmpresaFiltered || isMarcaFiltered || isTipoServicioFiltered || Boolean(vaultSearch.trim());

  const hiddenVaultFieldsList = useMemo(() => {
    const list: string[] = [];
    if (autoHideFilteredCols && isEmpresaFiltered) list.push('Empresa');
    if (autoHideFilteredCols && isMarcaFiltered) list.push('Marca');
    if (autoHideFilteredCols && isTipoServicioFiltered) list.push('Servicio');
    return list;
  }, [autoHideFilteredCols, isEmpresaFiltered, isMarcaFiltered, isTipoServicioFiltered]);

  const handleOpenCredModal = (cred?: ItCredential) => {
    if (empresas.length === 0) {
      onShowToast?.('Primero debes crear al menos una empresa', 'info');
      onOpenCatalogModal('empresas');
      return;
    }
    if (cred) {
      setEditingCred(cred);
      setCredFormData({
        empresa_id: cred.empresa_id,
        marca_id: cred.marca_id || 0,
        plataforma: cred.plataforma,
        tipo_servicio: cred.tipo_servicio || 'Correo Corporativo',
        url_acceso: cred.url_acceso || '',
        usuario_login: cred.usuario_login,
        password_secret: cred.password_secret || '',
        notas: cred.notas || '',
        tipo_cuenta: cred.tipo_cuenta || 'operativa',
      });
    } else {
      setEditingCred(null);
      const defaultEmp = empresas[0];
      setCredFormData({
        empresa_id: defaultEmp.id,
        marca_id: defaultEmp.marcas && defaultEmp.marcas.length > 0 ? defaultEmp.marcas[0].id : 0,
        plataforma: plataformasCatalog.length > 0 ? plataformasCatalog[0].nombre : 'Zimbra Mail',
        tipo_servicio: 'Correo Corporativo',
        url_acceso: '',
        usuario_login: '',
        password_secret: generateVaultPassword(14),
        notas: '',
        tipo_cuenta: 'operativa',
      });
    }
    setIsCredModalOpen(true);
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId) return;
    try {
      if (editingCred) {
        await api.updateItCredential(editingCred.id, {
          ...credFormData,
          marca_id: credFormData.marca_id ? Number(credFormData.marca_id) : undefined,
          updated_by: currentUserId,
        });
        onShowToast?.('Credencial actualizada', 'success');
      } else {
        await api.createItCredential({
          ...credFormData,
          marca_id: credFormData.marca_id ? Number(credFormData.marca_id) : undefined,
          created_by: currentUserId,
        });
        onShowToast?.('Credencial registrada', 'success');
      }
      setIsCredModalOpen(false);
      onVaultChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al guardar credencial', 'error');
    }
  };

  const handleDeleteCred = async (id: number) => {
    if (!(await confirmDialog('¿Eliminar esta credencial maestra?'))) return;
    try {
      await api.deleteItCredential(id);
      onShowToast?.('Credencial eliminada', 'info');
      onVaultChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleOpenPermModal = async (cred: ItCredential) => {
    setSelectedCredForPerms(cred);
    try {
      const perms = await api.getItCredentialPermissions(cred.id);
      setCredPermissions(perms || []);
      setIsPermModalOpen(true);
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al cargar permisos', 'error');
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedCredForPerms) return;
    try {
      setSavingPerms(true);
      await api.updateItCredentialPermissions(
        selectedCredForPerms.id,
        currentUserId || 1,
        credPermissions.map((p) => ({
          user_id: p.user_id,
          can_view: Boolean(p.can_view),
          can_edit: Boolean(p.can_edit),
        }))
      );
      onShowToast?.('Permisos actualizados con éxito', 'success');
      setIsPermModalOpen(false);
      onVaultChanged();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al guardar permisos', 'error');
    } finally {
      setSavingPerms(false);
    }
  };

  return (
    <>
      {isActive && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-white dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cuenta master, NAS root, etc..."
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-slate-400" />
                <select
                  value={selectedEmpresaId}
                  onChange={(e) => {
                    const val = e.target.value === 'todas' ? 'todas' : Number(e.target.value);
                    setSelectedEmpresaId(val);
                    setSelectedMarcaId('todas');
                  }}
                  className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="todas">Todas las Empresas</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {selectedEmpresaId !== 'todas' && filterMarcas.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedMarcaId}
                    onChange={(e) => setSelectedMarcaId(e.target.value === 'todas' ? 'todas' : Number(e.target.value))}
                    className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="todas">Todas las Marcas</option>
                    {filterMarcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <select
                value={selectedTipoServicio}
                onChange={(e) => setSelectedTipoServicio(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {TIPO_SERVICIOS_PRESET.map((t) => (
                  <option key={t} value={t}>
                    {t === 'Todos' ? 'Todos los Servicios' : t}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleOpenCredModal()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Credencial Maestra</span>
            </button>
          </div>

          {hasActiveVaultFilters && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-slate-50 dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] rounded-xl text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 text-[11px] uppercase tracking-wider mr-1">
                  <Filter className="w-3 h-3 text-sky-500" />
                  Filtros activos:
                </span>

                {isEmpresaFiltered && selectedVaultEmpresaObj && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white font-semibold text-xs"
                    style={{ backgroundColor: selectedVaultEmpresaObj.color || '#0284C7' }}
                  >
                    <span>{selectedVaultEmpresaObj.nombre}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmpresaId('todas');
                        setSelectedMarcaId('todas');
                      }}
                      title="Quitar filtro de empresa"
                      className="text-white/80 hover:text-white cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {isMarcaFiltered && selectedVaultMarcaObj && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 font-semibold text-xs">
                    <span>{selectedVaultMarcaObj.nombre}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedMarcaId('todas')}
                      title="Quitar filtro de marca"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {isTipoServicioFiltered && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 font-semibold text-xs">
                    <span>{selectedTipoServicio}</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTipoServicio('Todos')}
                      title="Quitar filtro de servicio"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {vaultSearch.trim() && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-[#222735] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/10 font-semibold text-xs">
                    <span>"{vaultSearch}"</span>
                    <button
                      type="button"
                      onClick={() => setVaultSearch('')}
                      title="Limpiar búsqueda"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {hiddenVaultFieldsList.length > 0 && (
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1 bg-slate-100 dark:bg-[#1A1E29] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10">
                    <EyeOff className="w-3 h-3 text-slate-400" />
                    <span>Campos repetitivos ocultos ({hiddenVaultFieldsList.join(', ')})</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedEmpresaId('todas');
                  setSelectedMarcaId('todas');
                  setSelectedTipoServicio('Todos');
                  setVaultSearch('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 transition-colors cursor-pointer ml-auto"
                title="Restablecer filtros de bóveda"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            </div>
          )}

          {loadingVault ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
              <p className="text-sm">Accediendo a la bóveda maestra IT...</p>
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#161922] border border-dashed border-slate-300 dark:border-white/15 rounded-2xl p-6">
              <Shield className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                No hay credenciales maestras registradas
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {credentials.map((cred) => {
                const isPwRevealed = Boolean(revealedCredPwIds[cred.id]);
                const canEdit = Boolean(cred.can_edit) || isAdminOrLeader;

                return (
                  <div
                    key={cred.id}
                    className="bg-white dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] hover:border-sky-500/40 rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(!autoHideFilteredCols || !isEmpresaFiltered) && (
                            <span
                              className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: cred.empresa_color || '#0284C7' }}
                            >
                              {cred.empresa_nombre}
                            </span>
                          )}
                          {(!autoHideFilteredCols || !isMarcaFiltered) && cred.marca_nombre && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1E222D] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                              {cred.marca_nombre}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1E222D] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                          {cred.tipo_cuenta || 'operativa'}
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{cred.plataforma}</h3>
                          {(!autoHideFilteredCols || !isTipoServicioFiltered) && (
                            <span className="text-xs text-sky-600 dark:text-sky-400 font-medium">
                              {cred.tipo_servicio}
                            </span>
                          )}
                        </div>
                        {cred.url_acceso && (
                          <a
                            href={cred.url_acceso}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg bg-slate-100 dark:bg-[#1E222D] text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center justify-center shrink-0"
                            title="Ir a consola"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>

                      <div className="bg-slate-50 dark:bg-[#1A1E29] rounded-xl p-3 border border-slate-200/80 dark:border-white/[0.08] space-y-2 mb-3 font-mono text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] shrink-0">Usuario:</span>
                          <div className="flex items-center gap-1 justify-end min-w-0">
                            <span className="text-slate-800 dark:text-slate-200 font-semibold truncate select-all">
                              {cred.usuario_login}
                            </span>
                            <button
                              type="button"
                              onClick={() => onCopyText(cred.usuario_login, 'Usuario', cred.id, false)}
                              title="Copiar usuario"
                              className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1 rounded-md text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer inline-flex items-center justify-center shrink-0"
                            >
                              {copiedId === `${cred.id}-Usuario` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70 dark:border-white/[0.06]">
                          <span className="text-slate-500 dark:text-slate-400 text-[11px] shrink-0">Contraseña:</span>
                          <div className="flex items-center gap-1 justify-end min-w-0">
                            <span
                              className={`font-semibold tracking-wider truncate ${
                                isPwRevealed ? 'text-amber-600 dark:text-amber-300 select-all' : 'text-slate-400'
                              }`}
                            >
                              {isPwRevealed ? cred.password_secret : '••••••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => onToggleRevealCred(cred.id)}
                              title={isPwRevealed ? 'Ocultar' : 'Ver por 10s'}
                              className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1 rounded-md text-slate-400 hover:text-amber-500 cursor-pointer inline-flex items-center justify-center shrink-0"
                            >
                              {isPwRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => onCopyText(() => getCredPw(cred.id), 'Contraseña', cred.id, true)}
                              title="Copiar contraseña"
                              className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1 rounded-md text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer inline-flex items-center justify-center shrink-0"
                            >
                              {copiedId === `${cred.id}-Contraseña` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {cred.notas && (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/70 dark:border-white/[0.06] text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                          <p className="line-clamp-2">{cred.notas}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex items-center justify-between gap-2 text-xs">
                      {isAdminOrLeader && (
                        <button
                          type="button"
                          onClick={() => handleOpenPermModal(cred)}
                          className="min-h-[36px] sm:min-h-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors text-[11px] font-medium cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Permisos</span>
                        </button>
                      )}

                      <div className="flex items-center gap-1 ml-auto">
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => handleOpenCredModal(cred)}
                            className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center"
                            title="Editar"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isAdminOrLeader && (
                          <button
                            type="button"
                            onClick={() => handleDeleteCred(cred.id)}
                            className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer flex items-center justify-center"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: CREDENCIAL MAESTRA IT */}
      {isCredModalOpen && (
        <div
          onClick={() => setIsCredModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <span>{editingCred ? 'Editar Credencial Maestra IT' : 'Registrar Credencial Maestra'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsCredModalOpen(false)}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCredential} className="space-y-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Empresa *</label>
                  <select
                    required
                    value={credFormData.empresa_id}
                    onChange={(e) => {
                      const newEmpId = Number(e.target.value);
                      const emp = empresas.find((x) => x.id === newEmpId);
                      setCredFormData({
                        ...credFormData,
                        empresa_id: newEmpId,
                        marca_id: emp?.marcas && emp.marcas.length > 0 ? emp.marcas[0].id : 0,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Marca / Sede</label>
                  <select
                    value={credFormData.marca_id}
                    onChange={(e) => setCredFormData({ ...credFormData, marca_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value={0}>General (Sin marca específica)</option>
                    {credFormSelectedEmpresaMarcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Plataforma *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. Zimbra Admin, Synology Root"
                    value={credFormData.plataforma}
                    onChange={(e) => setCredFormData({ ...credFormData, plataforma: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Servicio</label>
                  <select
                    value={credFormData.tipo_servicio}
                    onChange={(e) => setCredFormData({ ...credFormData, tipo_servicio: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    {TIPO_SERVICIOS_PRESET.filter((t) => t !== 'Todos').map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">URL / Consola</label>
                <input
                  type="text"
                  placeholder="ej. https://mail.marketingalterno.pe:7071"
                  value={credFormData.url_acceso}
                  onChange={(e) => setCredFormData({ ...credFormData, url_acceso: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Usuario / Login Master *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ej. admin@marketingalterno.pe"
                    value={credFormData.usuario_login}
                    onChange={(e) => setCredFormData({ ...credFormData, usuario_login: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Contraseña Secreta *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const generated = generateVaultPassword(16);
                        setCredFormData({ ...credFormData, password_secret: generated });
                        onShowToast?.('Contraseña generada', 'info');
                      }}
                      className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Generar</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required={!editingCred}
                    placeholder={editingCred ? 'Dejar vacío para conservar la contraseña actual' : 'Contraseña'}
                    value={credFormData.password_secret || ''}
                    onChange={(e) => setCredFormData({ ...credFormData, password_secret: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Nivel de Cuenta</label>
                <select
                  value={credFormData.tipo_cuenta}
                  onChange={(e) => setCredFormData({ ...credFormData, tipo_cuenta: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="operativa">Operativa</option>
                  <option value="admin">Administrador</option>
                  <option value="master">Master / Root</option>
                  <option value="consulta">Solo Lectura</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notas de Recuperación
                </label>
                <textarea
                  rows={2}
                  placeholder="ej. Claves de respaldo, puerto, etc."
                  value={credFormData.notas}
                  onChange={(e) => setCredFormData({ ...credFormData, notas: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsCredModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  {editingCred ? 'Actualizar Credencial' : 'Guardar en Bóveda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PERMISOS GRANULARES */}
      {isPermModalOpen && selectedCredForPerms && (
        <div
          onClick={() => setIsPermModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-fadeIn"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] border border-slate-200/90 dark:border-white/10 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/[0.08]">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  <span>Control de Permisos de Acceso</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Credencial:{' '}
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {selectedCredForPerms.plataforma}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPermModalOpen(false)}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <div className="grid grid-cols-12 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 pb-1">
                <span className="col-span-6">Colaborador</span>
                <span className="col-span-3 text-center">Puede Ver</span>
                <span className="col-span-3 text-center">Puede Editar</span>
              </div>

              {credPermissions.map((userPerm, idx) => (
                <div
                  key={userPerm.user_id}
                  className="grid grid-cols-12 items-center px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/70 dark:border-white/[0.08] text-xs"
                >
                  <div className="col-span-6 truncate pr-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{userPerm.full_name}</p>
                    <span className="text-[10px] text-slate-400 capitalize">
                      {userPerm.role} · @{userPerm.username}
                    </span>
                  </div>

                  <div className="col-span-3 flex justify-center">
                    <input
                      type="checkbox"
                      checked={Boolean(userPerm.can_view)}
                      onChange={(e) => {
                        const updated = [...credPermissions];
                        updated[idx] = {
                          ...updated[idx],
                          can_view: e.target.checked,
                          can_edit: e.target.checked ? updated[idx].can_edit : false,
                        };
                        setCredPermissions(updated);
                      }}
                      className="w-4 h-4 rounded accent-sky-600 cursor-pointer"
                    />
                  </div>

                  <div className="col-span-3 flex justify-center">
                    <input
                      type="checkbox"
                      checked={Boolean(userPerm.can_edit)}
                      disabled={!userPerm.can_view}
                      onChange={(e) => {
                        const updated = [...credPermissions];
                        updated[idx] = { ...updated[idx], can_edit: e.target.checked };
                        setCredPermissions(updated);
                      }}
                      className="w-4 h-4 rounded accent-sky-600 cursor-pointer disabled:opacity-30"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200/80 dark:border-white/[0.08] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPermModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingPerms}
                onClick={handleSavePermissions}
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
              >
                {savingPerms ? 'Guardando...' : 'Aplicar Permisos'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
