import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  Plus,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  Building2,
  Tag,
  Lock,
  Unlock,
  Timer,
  ShieldAlert,
  RefreshCw,
  Edit2,
  Trash2,
  Users,
  User,
  Globe,
  Server,
  Sparkles,
  SlidersHorizontal,
  X,
  AlertCircle,
  HelpCircle,
  FolderPlus,
  Send,
  MessageSquare,
  Key,
  Smartphone,
  Mail,
  RotateCcw,
  CheckCircle2,
  Clock,
  Settings,
  Briefcase,
  Layers,
  ChevronDown,
  ChevronUp,
  Zap,
  FileSpreadsheet,
  Upload,
  Download,
  FileUp,
  FileDown,
  AlertTriangle
} from 'lucide-react';
import {
  QuickLink,
  ItEmpresa,
  ItMarca,
  ItCredential,
  ItCredentialPermission,
  ItPlatformUser,
  ItPlataforma,
  ItCargo,
  User as UserType
} from '../types';
import { api } from '../services/api';
import { copyToClipboard } from '../utils/formatters';
import {
  generateCorporateEmail,
  generateCorporatePassword,
  generateStrongPlatformPassword,
  isMailPlatform,
  detectCorporateEntity,
  CorporateEntity,
} from '../utils/itAccountHelpers';

interface VaultViewProps {
  currentUser?: UserType | null;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const TIPO_SERVICIOS_PRESET = [
  'Todos',
  'Correo Corporativo',
  'ERP / Finanzas',
  'Storage / Servidor',
  'Cloud / Tenant',
  'Comunicaciones',
  'Base de Datos',
  'Seguridad & Redes',
  'General',
];

const CATEGORIAS_QUICKLINKS = [
  'Todas',
  'General',
  'Herramientas',
  'Comunicaciones',
  'Sistemas',
  'Marketing',
  'Diseño',
  'Operaciones',
];

export const VaultView: React.FC<VaultViewProps> = ({ currentUser, onShowToast }) => {
  // Pestaña activa principal: 'users' (Directorio por Plataforma) | 'vault' (Bóveda Maestras IT) | 'links' (Accesos Directos)
  const [activeTab, setActiveTab] = useState<'users' | 'vault' | 'links'>('users');

  // ================= CATÁLOGOS MAESTROS =================
  const [empresas, setEmpresas] = useState<ItEmpresa[]>([]);
  const [plataformasCatalog, setPlataformasCatalog] = useState<ItPlataforma[]>([]);
  const [cargosCatalog, setCargosCatalog] = useState<ItCargo[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);
  const [catalogTab, setCatalogTab] = useState<'empresas' | 'plataformas' | 'cargos'>('empresas');

  // Formularios de Creación en Catálogos
  const [newPlatNombre, setNewPlatNombre] = useState('');
  const [newPlatTipo, setNewPlatTipo] = useState('Correo Corporativo');
  const [newCargoNombre, setNewCargoNombre] = useState('');
  const [newCargoArea, setNewCargoArea] = useState('Marketing');
  const [newEmpresaNombre, setNewEmpresaNombre] = useState('');
  const [newEmpresaColor, setNewEmpresaColor] = useState('#00F0FF');
  const [newMarcaNombre, setNewMarcaNombre] = useState('');
  const [newMarcaEmpresaId, setNewMarcaEmpresaId] = useState<number>(0);

  // ================= DIRECTORIO DE USUARIOS POR PLATAFORMA =================
  const [platformUsers, setPlatformUsers] = useState<ItPlatformUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [userSearch, setUserSearch] = useState<string>('');
  const [selectedUserEmpresaId, setSelectedUserEmpresaId] = useState<number | 'todas'>('todas');
  const [selectedUserPlataforma, setSelectedUserPlataforma] = useState<string>('todas');
  const [selectedUserEstado, setSelectedUserEstado] = useState<string>('todos');
  const [revealedUserPwIds, setRevealedUserPwIds] = useState<Record<number, boolean>>({});

  // Modales Directorio
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [editingPlatformUser, setEditingPlatformUser] = useState<ItPlatformUser | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<ItPlatformUser | null>(null);
  const [resetGeneratedPass, setResetGeneratedPass] = useState<string>('');
  const [resetShareMessage, setResetShareMessage] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);

  // ================= IMPORTACIÓN & EXPORTACIÓN EXCEL =================
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [selectedFileForImport, setSelectedFileForImport] = useState<File | null>(null);
  const [importPreviewData, setImportPreviewData] = useState<{
    success: boolean;
    filename: string;
    total_filas: number;
    ready_count: number;
    update_count: number;
    invalid_count: number;
    rows: any[];
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importMode, setImportMode] = useState<'crear_o_actualizar' | 'solo_nuevos'>('crear_o_actualizar');
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState<boolean>(false);
  const [isExportingAccounts, setIsExportingAccounts] = useState<boolean>(false);
  const [filterPreviewStatus, setFilterPreviewStatus] = useState<'todos' | 'ready' | 'update' | 'invalid'>('todos');

  // Formulario de Usuario en Plataforma
  const [selectedCorporateEntity, setSelectedCorporateEntity] = useState<CorporateEntity>('marketing_alterno');
  const [userFormData, setUserFormData] = useState({
    empresa_id: 0,
    marca_id: 0,
    plataforma: 'Zimbra',
    colaborador_nombre: '',
    colaborador_cargo: '',
    colaborador_email: '',
    colaborador_telefono: '',
    usuario_login: '',
    password_actual: '',
    estado: 'activo' as 'activo' | 'suspendido' | 'por_crear' | 'baja',
    notas: '',
  });

  // ================= GENERADOR RÁPIDO DE CLAVES =================
  const [isGenModalOpen, setIsGenModalOpen] = useState<boolean>(false);
  const [genLength, setGenLength] = useState<number>(14);
  const [genIncludeSpecial, setGenIncludeSpecial] = useState<boolean>(true);
  const [genIncludeNumbers, setGenIncludeNumbers] = useState<boolean>(true);
  const [generatedQuickPass, setGeneratedQuickPass] = useState<string>('');

  // ================= BÓVEDA MAESTRA IT =================
  const [credentials, setCredentials] = useState<ItCredential[]>([]);
  const [loadingVault, setLoadingVault] = useState<boolean>(true);
  const [vaultSearch, setVaultSearch] = useState<string>('');
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<number | 'todas'>('todas');
  const [selectedMarcaId, setSelectedMarcaId] = useState<number | 'todas'>('todas');
  const [selectedTipoServicio, setSelectedTipoServicio] = useState<string>('Todos');
  const [revealedCredPwIds, setRevealedCredPwIds] = useState<Record<number, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modales Bóveda
  const [isCredModalOpen, setIsCredModalOpen] = useState<boolean>(false);
  const [editingCred, setEditingCred] = useState<ItCredential | null>(null);
  const [isPermModalOpen, setIsPermModalOpen] = useState<boolean>(false);
  const [selectedCredForPerms, setSelectedCredForPerms] = useState<ItCredential | null>(null);
  const [credPermissions, setCredPermissions] = useState<ItCredentialPermission[]>([]);
  const [savingPerms, setSavingPerms] = useState<boolean>(false);

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

  // ================= ACCESOS DIRECTOS =================
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState<boolean>(true);
  const [linkSearch, setLinkSearch] = useState<string>('');
  const [linkCategoria, setLinkCategoria] = useState<string>('Todas');
  const [linkFilterScope, setLinkFilterScope] = useState<'todos' | 'mis' | 'equipo' | 'global'>('todos');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const [revealedLinkPwIds, setRevealedLinkPwIds] = useState<Record<number, boolean>>({});

  const [linkFormData, setLinkFormData] = useState({
    titulo: '',
    url: '',
    categoria: 'General',
    descripcion: '',
    icono: 'Link',
    color: '#00F0FF',
    usuario: '',
    password: '',
    visibilidad: 'personal' as 'personal' | 'equipo' | 'global',
  });

  // ================= SEGURIDAD DE BÓVEDA TI (MODO SUDO / PIN) =================
  const [isVaultUnlocked, setIsVaultUnlocked] = useState<boolean>(false);
  const [unlockRemainingSeconds, setUnlockRemainingSeconds] = useState<number>(0);
  const [hasSecurityPin, setHasSecurityPin] = useState<boolean>(false);
  const [isSecurityBarExpanded, setIsSecurityBarExpanded] = useState<boolean>(true);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState<boolean>(false);
  const [isPinConfigModalOpen, setIsPinConfigModalOpen] = useState<boolean>(false);
  const [unlockMode, setUnlockMode] = useState<'pin' | 'password'>('pin');
  const [unlockPinInput, setUnlockPinInput] = useState<string>('');
  const [unlockPasswordInput, setUnlockPasswordInput] = useState<string>('');
  const [unlockError, setUnlockError] = useState<string>('');
  const [unlocking, setUnlocking] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Formulario Configurar PIN
  const [pinCurrentPass, setPinCurrentPass] = useState<string>('');
  const [pinNewPin, setPinNewPin] = useState<string>('');
  const [pinConfirmPin, setPinConfirmPin] = useState<string>('');
  const [savingPin, setSavingPin] = useState<boolean>(false);
  const [pinConfigError, setPinConfigError] = useState<string>('');

  // Contador de revelaciones por minuto (Anti-exfiltración masiva)
  const [recentRevealsTimestamps, setRecentRevealsTimestamps] = useState<number[]>([]);

  const isAdminOrLeader = currentUser?.role === 'admin' || currentUser?.role === 'lider' || currentUser?.is_leader;

  // ================= CARGA DE CATÁLOGOS =================
  const loadCatalogs = async () => {
    try {
      const [emps, plats, crgs] = await Promise.all([
        api.getItEmpresas(),
        api.getItPlataformas(),
        api.getItCargos(),
      ]);
      setEmpresas(emps || []);
      setPlataformasCatalog(plats || []);
      setCargosCatalog(crgs || []);
    } catch (e) {
      console.error('Error loading catalogs:', e);
    }
  };

  const fetchPlatformUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await api.getItPlatformUsers({
        empresa_id: selectedUserEmpresaId === 'todas' ? undefined : selectedUserEmpresaId,
        plataforma: selectedUserPlataforma === 'todas' ? undefined : selectedUserPlataforma,
        estado: selectedUserEstado === 'todos' ? undefined : selectedUserEstado,
        search: userSearch,
      });
      setPlatformUsers(res || []);
    } catch (err: any) {
      console.error('Error fetching platform users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchLinks = async () => {
    try {
      setLoadingLinks(true);
      const res = await api.getQuickLinks({
        user_id: currentUser?.id,
        categoria: linkCategoria === 'Todas' ? undefined : linkCategoria,
        search: linkSearch,
      });
      setLinks(res || []);
    } catch (err: any) {
      console.error('Error fetching quick links:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  const fetchVaultData = async () => {
    try {
      setLoadingVault(true);
      const credsRes = await api.getItCredentials({
        user_id: currentUser?.id,
        empresa_id: selectedEmpresaId === 'todas' ? undefined : selectedEmpresaId,
        marca_id: selectedMarcaId === 'todas' ? undefined : selectedMarcaId,
        tipo_servicio: selectedTipoServicio === 'Todos' ? undefined : selectedTipoServicio,
        search: vaultSearch,
      });
      setCredentials(credsRes || []);
    } catch (err: any) {
      console.error('Error fetching vault data:', err);
    } finally {
      setLoadingVault(false);
    }
  };

  const checkPinStatus = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await api.getVaultPinStatus(currentUser.id);
      setHasSecurityPin(Boolean(res?.has_pin));
      if (!res?.has_pin) {
        setUnlockMode('password');
      }
    } catch (e) {
      console.error('Error checking pin status:', e);
    }
  };

  useEffect(() => {
    loadCatalogs();
    checkPinStatus();
  }, [currentUser?.id]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchPlatformUsers();
    } else if (activeTab === 'vault') {
      fetchVaultData();
    } else if (activeTab === 'links') {
      fetchLinks();
    }
  }, [
    activeTab,
    selectedUserEmpresaId,
    selectedUserPlataforma,
    selectedUserEstado,
    userSearch,
    selectedEmpresaId,
    selectedMarcaId,
    selectedTipoServicio,
    vaultSearch,
    linkCategoria,
    linkSearch,
    currentUser?.id,
  ]);

  useEffect(() => {
    if (!isVaultUnlocked || unlockRemainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setUnlockRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsVaultUnlocked(false);
          setRevealedUserPwIds({});
          setRevealedCredPwIds({});
          setRevealedLinkPwIds({});
          if (onShowToast) onShowToast('🔒 La sesión segura de la bóveda ha expirado', 'info');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isVaultUnlocked, unlockRemainingSeconds]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleLockVaultNow = () => {
    setIsVaultUnlocked(false);
    setUnlockRemainingSeconds(0);
    setRevealedUserPwIds({});
    setRevealedCredPwIds({});
    setRevealedLinkPwIds({});
    if (onShowToast) onShowToast('🔒 Bóveda bloqueada', 'info');
  };

  const handleExtendSession = () => {
    setUnlockRemainingSeconds((prev) => Math.min(prev + 300, 900));
    if (onShowToast) onShowToast('⏱️ Sesión extendida (+5 min)', 'success');
  };

  const unlockProgressPercent = isVaultUnlocked
    ? Math.min(100, Math.max(0, (unlockRemainingSeconds / 300) * 100))
    : 0;

  const requireVaultUnlock = (action: () => void): boolean => {
    if (!isVaultUnlocked) {
      setPendingAction(() => action);
      setUnlockError('');
      setUnlockPinInput('');
      setUnlockPasswordInput('');
      setIsUnlockModalOpen(true);
      return false;
    }
    return true;
  };

  const registerRevealAuditAndRateLimit = () => {
    const now = Date.now();
    const recent = [...recentRevealsTimestamps, now].filter((t) => now - t <= 60000);
    setRecentRevealsTimestamps(recent);
    if (recent.length >= 12) {
      if (onShowToast) onShowToast('⚠️ Alerta de Seguridad: Se han consultado más de 12 contraseñas en el último minuto', 'error');
    }
  };

  const handleVerifyUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setUnlockError('');
    setUnlocking(true);
    try {
      const creds = unlockMode === 'pin' ? { pin: unlockPinInput } : { password: unlockPasswordInput };
      const res = await api.verifyVaultUnlock(currentUser.id, creds);
      setIsVaultUnlocked(true);
      setUnlockRemainingSeconds(res.expires_in || 300);
      setIsUnlockModalOpen(false);
      setUnlockPinInput('');
      setUnlockPasswordInput('');
      if (onShowToast) onShowToast('🔓 Bóveda desbloqueada por 5 minutos', 'success');
      
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } catch (err: any) {
      setUnlockError(err.message || 'Credencial de desbloqueo incorrecta');
    } finally {
      setUnlocking(false);
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setPinConfigError('');
    if (pinNewPin !== pinConfirmPin) {
      setPinConfigError('El nuevo PIN y su confirmación no coinciden');
      return;
    }
    if (pinNewPin.length < 4 || pinNewPin.length > 8) {
      setPinConfigError('El PIN debe tener entre 4 y 8 dígitos');
      return;
    }
    setSavingPin(true);
    try {
      await api.setVaultPin(currentUser.id, pinCurrentPass, pinNewPin);
      setHasSecurityPin(true);
      setUnlockMode('pin');
      setIsPinConfigModalOpen(false);
      setPinCurrentPass('');
      setPinNewPin('');
      setPinConfirmPin('');
      if (onShowToast) onShowToast('PIN de seguridad configurado exitosamente', 'success');
    } catch (err: any) {
      setPinConfigError(err.message || 'Error al configurar PIN');
    } finally {
      setSavingPin(false);
    }
  };

  // Generador de Contraseñas
  const generatePassword = (length = 14, includeSpecial = true, includeNumbers = true) => {
    let pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeNumbers) pool += '0123456789';
    if (includeSpecial) pool += '!@#$%&*';

    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    let pass = '';
    for (let i = 0; i < length; i++) {
      pass += pool[array[i] % pool.length];
    }
    return pass;
  };

  const handleCopyText = async (text: string, label: string, credId?: number, isPassword = false) => {
    if (!text) return;

    if (isPassword) {
      if (!requireVaultUnlock(() => handleCopyText(text, label, credId, isPassword))) {
        return;
      }
      registerRevealAuditAndRateLimit();
    }

    const ok = await copyToClipboard(text);
    if (ok) {
      const key = `${credId || 'gen'}-${label}`;
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2500);

      if (isPassword) {
        if (onShowToast) onShowToast(`📋 ${label} copiada. Se eliminará del portapapeles en 30 segundos`, 'success');
        setTimeout(async () => {
          await copyToClipboard('');
        }, 30000);
      } else {
        if (onShowToast) onShowToast(`${label} copiado al portapapeles`, 'success');
      }

      if (credId && isPassword && currentUser?.id) {
        api.auditItCredential(credId, currentUser.id, 'copy_password');
      }
    } else {
      if (onShowToast) onShowToast(`Error al copiar ${label} al portapapeles`, 'error');
    }
  };

  const handleToggleRevealUserPw = (id: number) => {
    const isRev = Boolean(revealedUserPwIds[id]);
    if (!isRev) {
      if (!requireVaultUnlock(() => handleToggleRevealUserPw(id))) return;
      registerRevealAuditAndRateLimit();
    }
    setRevealedUserPwIds((prev) => ({ ...prev, [id]: !isRev }));
    if (!isRev) {
      setTimeout(() => {
        setRevealedUserPwIds((prev) => ({ ...prev, [id]: false }));
      }, 10000);
    }
  };

  const handleToggleRevealCred = (credId: number) => {
    const isCurrentlyRevealed = Boolean(revealedCredPwIds[credId]);
    if (!isCurrentlyRevealed) {
      if (!requireVaultUnlock(() => handleToggleRevealCred(credId))) return;
      registerRevealAuditAndRateLimit();
    }
    setRevealedCredPwIds((prev) => ({ ...prev, [credId]: !isCurrentlyRevealed }));
    if (!isCurrentlyRevealed) {
      if (currentUser?.id) {
        api.auditItCredential(credId, currentUser.id, 'view_password');
      }
      setTimeout(() => {
        setRevealedCredPwIds((prev) => ({ ...prev, [credId]: false }));
      }, 10000);
    }
  };

  const handleToggleRevealLinkPw = (id: number) => {
    const isRev = Boolean(revealedLinkPwIds[id]);
    if (!isRev) {
      if (!requireVaultUnlock(() => handleToggleRevealLinkPw(id))) return;
      registerRevealAuditAndRateLimit();
    }
    setRevealedLinkPwIds((prev) => ({ ...prev, [id]: !isRev }));
    if (!isRev) {
      setTimeout(() => {
        setRevealedLinkPwIds((prev) => ({ ...prev, [id]: false }));
      }, 10000);
    }
  };

  // ================= OPERACIONES DE CATÁLOGOS =================
  const handleCreatePlataforma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlatNombre.trim()) return;
    try {
      await api.createItPlataforma({ nombre: newPlatNombre.trim(), tipo_servicio: newPlatTipo });
      setNewPlatNombre('');
      if (onShowToast) onShowToast('Plataforma agregada al catálogo', 'success');
      loadCatalogs();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al crear plataforma', 'error');
    }
  };

  const handleDeletePlataforma = async (id: number) => {
    if (!confirm('¿Eliminar esta plataforma del catálogo maestro?')) return;
    try {
      await api.deleteItPlataforma(id);
      if (onShowToast) onShowToast('Plataforma eliminada', 'info');
      loadCatalogs();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleCreateCargo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCargoNombre.trim()) return;
    try {
      await api.createItCargo({ nombre: newCargoNombre.trim(), area: newCargoArea.trim() });
      setNewCargoNombre('');
      if (onShowToast) onShowToast('Cargo agregado al catálogo', 'success');
      loadCatalogs();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al crear cargo', 'error');
    }
  };

  const handleDeleteCargo = async (id: number) => {
    if (!confirm('¿Eliminar este cargo del catálogo maestro?')) return;
    try {
      await api.deleteItCargo(id);
      if (onShowToast) onShowToast('Cargo eliminado', 'info');
      loadCatalogs();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleCreateEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpresaNombre.trim()) return;
    try {
      await api.createItEmpresa({ nombre: newEmpresaNombre.trim(), color: newEmpresaColor });
      setNewEmpresaNombre('');
      if (onShowToast) onShowToast('Empresa creada con éxito', 'success');
      loadCatalogs();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al crear empresa', 'error');
    }
  };

  const handleDeleteEmpresa = async (id: number) => {
    if (!confirm('¿Eliminar esta empresa y todas sus marcas asociadas?')) return;
    try {
      await api.deleteItEmpresa(id);
      if (onShowToast) onShowToast('Empresa eliminada', 'info');
      loadCatalogs();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleCreateMarca = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMarcaNombre.trim() || !newMarcaEmpresaId) {
      if (onShowToast) onShowToast('Selecciona una empresa e ingresa el nombre de la marca', 'error');
      return;
    }
    try {
      await api.createItMarca({ empresa_id: newMarcaEmpresaId, nombre: newMarcaNombre.trim() });
      setNewMarcaNombre('');
      if (onShowToast) onShowToast('Marca añadida a la empresa', 'success');
      loadCatalogs();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al crear marca', 'error');
    }
  };

  const handleDeleteMarca = async (id: number) => {
    if (!confirm('¿Eliminar esta marca?')) return;
    try {
      await api.deleteItMarca(id);
      if (onShowToast) onShowToast('Marca eliminada', 'info');
      loadCatalogs();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al eliminar', 'error');
    }
  };

  // ================= USUARIOS DE PLATAFORMA =================
  const handleOpenUserModal = (user?: ItPlatformUser) => {
    if (empresas.length === 0) {
      if (onShowToast) onShowToast('Primero debes crear al menos una empresa', 'info');
      setCatalogTab('empresas');
      setIsCatalogModalOpen(true);
      return;
    }

    if (user) {
      setEditingPlatformUser(user);
      const userEmp = empresas.find((e) => e.id === user.empresa_id);
      setSelectedCorporateEntity(detectCorporateEntity(userEmp?.nombre));
      setUserFormData({
        empresa_id: user.empresa_id,
        marca_id: user.marca_id || 0,
        plataforma: user.plataforma,
        colaborador_nombre: user.colaborador_nombre,
        colaborador_cargo: user.colaborador_cargo || '',
        colaborador_email: user.colaborador_email || '',
        colaborador_telefono: user.colaborador_telefono || '',
        usuario_login: user.usuario_login,
        password_actual: user.password_actual,
        estado: user.estado || 'activo',
        notas: user.notas || '',
      });
    } else {
      setEditingPlatformUser(null);
      // Empresa por defecto: Buscar "Marketing Alterno Perú" o que contenga "marketing"
      const mktEmp = empresas.find((e) => /marketing\s*alterno/i.test(e.nombre));
      const defaultEmp = mktEmp || empresas[0];

      // Plataforma por defecto: "Zimbra"
      const zimbraPlat = plataformasCatalog.find((p) => /zimbra/i.test(p.nombre));
      const defaultPlat = selectedUserPlataforma !== 'todas'
        ? selectedUserPlataforma
        : (zimbraPlat ? zimbraPlat.nombre : 'Zimbra');

      const initialEntity = detectCorporateEntity(defaultEmp?.nombre);
      setSelectedCorporateEntity(initialEntity);

      const autoPass = isMailPlatform(defaultPlat)
        ? generateCorporatePassword('')
        : generateStrongPlatformPassword(14);

      setUserFormData({
        empresa_id: defaultEmp.id,
        marca_id: defaultEmp.marcas && defaultEmp.marcas.length > 0 ? defaultEmp.marcas[0].id : 0,
        plataforma: defaultPlat,
        colaborador_nombre: '',
        colaborador_cargo: cargosCatalog.length > 0 ? cargosCatalog[0].nombre : '',
        colaborador_email: '',
        colaborador_telefono: '',
        usuario_login: '',
        password_actual: autoPass,
        estado: 'activo',
        notas: '',
      });
    }
    setIsUserModalOpen(true);
  };

  const handleColaboradorNameChange = (name: string) => {
    const isMail = isMailPlatform(userFormData.plataforma);
    if (isMail) {
      const generatedEmail = generateCorporateEmail(name, selectedCorporateEntity);
      const generatedPass = generateCorporatePassword(name);
      setUserFormData((prev) => ({
        ...prev,
        colaborador_nombre: name,
        usuario_login: generatedEmail,
        colaborador_email: generatedEmail,
        password_actual: generatedPass,
      }));
    } else {
      setUserFormData((prev) => ({
        ...prev,
        colaborador_nombre: name,
      }));
    }
  };

  const handleSelectCorporateEntity = (entity: CorporateEntity) => {
    setSelectedCorporateEntity(entity);
    if (userFormData.colaborador_nombre) {
      const mail = generateCorporateEmail(userFormData.colaborador_nombre, entity);
      setUserFormData((prev) => ({
        ...prev,
        usuario_login: mail,
        colaborador_email: mail,
      }));
      if (onShowToast) {
        const label = entity === 'solopromo' ? 'Soporte Promocional' : entity === 'hp' ? 'HP' : 'Marketing Alterno';
        onShowToast(`Formato de correo actualizado para ${label}`, 'info');
      }
    }
  };

  const handlePlataformaInputChange = (newPlat: string) => {
    const isMail = isMailPlatform(newPlat);
    const wasMail = isMailPlatform(userFormData.plataforma);

    let newLogin = userFormData.usuario_login;
    let newEmail = userFormData.colaborador_email;
    let newPass = userFormData.password_actual;

    if (isMail && (!wasMail || !newLogin)) {
      if (userFormData.colaborador_nombre) {
        const mail = generateCorporateEmail(userFormData.colaborador_nombre, selectedCorporateEntity);
        newLogin = mail;
        newEmail = mail;
        newPass = generateCorporatePassword(userFormData.colaborador_nombre);
      }
    } else if (!isMail && wasMail) {
      newPass = generateStrongPlatformPassword(14);
    }

    setUserFormData((prev) => ({
      ...prev,
      plataforma: newPlat,
      usuario_login: newLogin,
      colaborador_email: newEmail,
      password_actual: newPass,
    }));
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    if (!userFormData.empresa_id || !userFormData.colaborador_nombre.trim() || !userFormData.usuario_login.trim() || !userFormData.password_actual.trim()) {
      if (onShowToast) onShowToast('Empresa, Colaborador, Usuario y Contraseña son obligatorios', 'error');
      return;
    }

    try {
      if (editingPlatformUser) {
        await api.updateItPlatformUser(editingPlatformUser.id, {
          ...userFormData,
          marca_id: userFormData.marca_id ? Number(userFormData.marca_id) : undefined,
          updated_by: currentUser.id,
        });
        if (onShowToast) onShowToast('Cuenta de usuario actualizada', 'success');
      } else {
        await api.createItPlatformUser({
          ...userFormData,
          marca_id: userFormData.marca_id ? Number(userFormData.marca_id) : undefined,
          created_by: currentUser.id,
        });
        if (onShowToast) onShowToast('Usuario registrado con éxito en la plataforma', 'success');
      }
      setIsUserModalOpen(false);
      fetchPlatformUsers();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al guardar usuario', 'error');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('¿Estás seguro de eliminar esta cuenta de usuario del directorio?')) return;
    try {
      await api.deleteItPlatformUser(userId);
      if (onShowToast) onShowToast('Cuenta de usuario eliminada', 'info');
      fetchPlatformUsers();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleOpenResetModal = (user: ItPlatformUser) => {
    setSelectedUserForReset(user);
    const newPass = isMailPlatform(user.plataforma)
      ? generateCorporatePassword(user.colaborador_nombre)
      : generateStrongPlatformPassword(14);
    setResetGeneratedPass(newPass);

    const empName = user.empresa_nombre || 'la Empresa';
    const msg = `Hola ${user.colaborador_nombre}, el área de Sistemas de ${empName} te comparte tus credenciales actualizadas:\n\nPlataforma: ${user.plataforma}\nUsuario: ${user.usuario_login}\nContraseña temporal: ${newPass}\n\nPor favor inicia sesión y cambia tu contraseña por seguridad.`;
    setResetShareMessage(msg);
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = async () => {
    if (!selectedUserForReset || !currentUser?.id) return;
    try {
      setIsResetting(true);
      const res = await api.resetItPlatformUserPassword(
        selectedUserForReset.id,
        currentUser.id,
        resetGeneratedPass
      );
      if (onShowToast) onShowToast('Contraseña restablecida con éxito', 'success');
      setResetShareMessage(res.share_message);
      fetchPlatformUsers();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al resetear', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendWhatsApp = (phone?: string, text?: string) => {
    if (!phone) {
      if (onShowToast) onShowToast('El colaborador no tiene teléfono registrado', 'info');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const encoded = encodeURIComponent(text || '');
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  // ================= OPERACIONES DE EXCEL (PLANTILLA, EXPORTACIÓN, IMPORTACIÓN) =================
  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      await api.downloadItPlatformUsersTemplate();
      if (onShowToast) onShowToast('Plantilla oficial de Excel descargada exitosamente', 'success');
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al descargar plantilla', 'error');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleExportAccounts = async () => {
    try {
      setIsExportingAccounts(true);
      await api.exportItPlatformUsers({
        empresa_id: selectedUserEmpresaId === 'todas' ? undefined : selectedUserEmpresaId,
        plataforma: selectedUserPlataforma === 'todas' ? undefined : selectedUserPlataforma,
        estado: selectedUserEstado === 'todos' ? undefined : selectedUserEstado,
        search: userSearch,
        include_passwords: true,
      });
      if (onShowToast) onShowToast('Archivo Excel de cuentas generado exitosamente', 'success');
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al exportar cuentas', 'error');
    } finally {
      setIsExportingAccounts(false);
    }
  };

  const processImportFile = async (file: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      if (onShowToast) onShowToast('Por favor selecciona un archivo Excel (.xlsx, .xls) o CSV (.csv)', 'error');
      return;
    }

    setSelectedFileForImport(file);
    setIsLoadingPreview(true);
    setImportPreviewData(null);
    try {
      const preview = await api.previewItPlatformUsersImport(file);
      setImportPreviewData(preview);
      if (onShowToast) {
        onShowToast(`Archivo analizado: ${preview.total_filas} filas detectadas (${preview.ready_count} nuevas, ${preview.update_count} a actualizar)`, 'info');
      }
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al analizar archivo', 'error');
      setSelectedFileForImport(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImportFile(file);
    }
  };

  const handleConfirmImport = async () => {
    if (!importPreviewData || !importPreviewData.rows?.length) return;
    const validRows = importPreviewData.rows.filter(r => r.status !== 'invalid');
    if (validRows.length === 0) {
      if (onShowToast) onShowToast('No hay filas válidas para importar en este archivo', 'error');
      return;
    }

    try {
      setIsImporting(true);
      const res = await api.importItPlatformUsers({
        rows: validRows,
        modo: importMode,
        created_by: currentUser?.id,
      });
      if (onShowToast) onShowToast(res.mensaje || 'Importación procesada con éxito', 'success');
      setIsImportModalOpen(false);
      setSelectedFileForImport(null);
      setImportPreviewData(null);
      fetchPlatformUsers();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al importar datos', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // ================= OPERACIONES DE CREDENCIALES MAESTRAS IT =================
  const handleOpenCredModal = (cred?: ItCredential) => {
    if (empresas.length === 0) {
      if (onShowToast) onShowToast('Primero debes crear al menos una empresa', 'info');
      setCatalogTab('empresas');
      setIsCatalogModalOpen(true);
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
        password_secret: cred.password_secret,
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
        password_secret: generatePassword(14),
        notas: '',
        tipo_cuenta: 'operativa',
      });
    }
    setIsCredModalOpen(true);
  };

  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    try {
      if (editingCred) {
        await api.updateItCredential(editingCred.id, {
          ...credFormData,
          marca_id: credFormData.marca_id ? Number(credFormData.marca_id) : undefined,
          updated_by: currentUser.id,
        });
        if (onShowToast) onShowToast('Credencial actualizada', 'success');
      } else {
        await api.createItCredential({
          ...credFormData,
          marca_id: credFormData.marca_id ? Number(credFormData.marca_id) : undefined,
          created_by: currentUser.id,
        });
        if (onShowToast) onShowToast('Credencial registrada', 'success');
      }
      setIsCredModalOpen(false);
      fetchVaultData();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al guardar credencial', 'error');
    }
  };

  const handleDeleteCred = async (id: number) => {
    if (!confirm('¿Eliminar esta credencial maestra?')) return;
    try {
      await api.deleteItCredential(id);
      if (onShowToast) onShowToast('Credencial eliminada', 'info');
      fetchVaultData();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al eliminar', 'error');
    }
  };

  const handleOpenPermModal = async (cred: ItCredential) => {
    setSelectedCredForPerms(cred);
    try {
      const perms = await api.getItCredentialPermissions(cred.id);
      setCredPermissions(perms || []);
      setIsPermModalOpen(true);
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al cargar permisos', 'error');
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedCredForPerms) return;
    try {
      setSavingPerms(true);
      await api.updateItCredentialPermissions(
        selectedCredForPerms.id,
        currentUser?.id || 1,
        credPermissions.map((p) => ({
          user_id: p.user_id,
          can_view: Boolean(p.can_view),
          can_edit: Boolean(p.can_edit),
        }))
      );
      if (onShowToast) onShowToast('Permisos actualizados con éxito', 'success');
      setIsPermModalOpen(false);
      fetchVaultData();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al guardar permisos', 'error');
    } finally {
      setSavingPerms(false);
    }
  };

  // ================= OPERACIONES DE ACCESOS DIRECTOS =================
  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      if (linkFilterScope === 'mis' && link.user_id !== currentUser?.id) return false;
      if (linkFilterScope === 'equipo' && link.visibilidad !== 'equipo') return false;
      if (linkFilterScope === 'global' && link.visibilidad !== 'global') return false;
      return true;
    });
  }, [links, linkFilterScope, currentUser?.id]);

  const handleOpenLinkModal = (link?: QuickLink) => {
    if (link) {
      setEditingLink(link);
      setLinkFormData({
        titulo: link.titulo,
        url: link.url,
        categoria: link.categoria || 'General',
        descripcion: link.descripcion || '',
        icono: link.icono || 'Link',
        color: link.color || '#00F0FF',
        usuario: link.usuario || '',
        password: link.password || '',
        visibilidad: (link.visibilidad as any) || 'personal',
      });
    } else {
      setEditingLink(null);
      setLinkFormData({
        titulo: '',
        url: '',
        categoria: 'General',
        descripcion: '',
        icono: 'Link',
        color: '#00F0FF',
        usuario: '',
        password: '',
        visibilidad: 'personal',
      });
    }
    setIsLinkModalOpen(true);
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    if (!linkFormData.titulo.trim() || !linkFormData.url.trim()) {
      if (onShowToast) onShowToast('Título y URL son obligatorios', 'error');
      return;
    }
    try {
      if (editingLink) {
        await api.updateQuickLink(editingLink.id, {
          ...linkFormData,
          user_id: currentUser.id,
        });
        if (onShowToast) onShowToast('Acceso directo actualizado', 'success');
      } else {
        await api.createQuickLink({
          ...linkFormData,
          user_id: currentUser.id,
        });
        if (onShowToast) onShowToast('Acceso directo creado', 'success');
      }
      setIsLinkModalOpen(false);
      fetchLinks();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al guardar enlace', 'error');
    }
  };

  const handleDeleteLink = async (id: number) => {
    if (!confirm('¿Eliminar este acceso directo?')) return;
    try {
      await api.deleteQuickLink(id);
      if (onShowToast) onShowToast('Acceso directo eliminado', 'info');
      fetchLinks();
    } catch (err: any) {
      if (onShowToast) onShowToast(err.message || 'Error al eliminar', 'error');
    }
  };

  // Contadores dinámicos por plataforma
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: platformUsers.length };
    platformUsers.forEach((u) => {
      counts[u.plataforma] = (counts[u.plataforma] || 0) + 1;
    });
    return counts;
  }, [platformUsers]);

  // Lista unificada de plataformas para las pestañas superiores
  const displayPlatforms = useMemo(() => {
    const list = [...plataformasCatalog.map((p) => p.nombre)];
    platformUsers.forEach((u) => {
      if (!list.includes(u.plataforma)) list.push(u.plataforma);
    });
    return list;
  }, [plataformasCatalog, platformUsers]);

  const formSelectedEmpresaMarcas = useMemo(() => {
    const emp = empresas.find((e) => e.id === Number(userFormData.empresa_id));
    return emp?.marcas || [];
  }, [empresas, userFormData.empresa_id]);

  const credFormSelectedEmpresaMarcas = useMemo(() => {
    const emp = empresas.find((e) => e.id === Number(credFormData.empresa_id));
    return emp?.marcas || [];
  }, [empresas, credFormData.empresa_id]);

  const filterMarcas = useMemo(() => {
    if (selectedEmpresaId === 'todas') return [];
    const emp = empresas.find((e) => e.id === selectedEmpresaId);
    return emp?.marcas || [];
  }, [empresas, selectedEmpresaId]);

  // ================= OCULTAMIENTO INTELIGENTE DE CAMPOS/COLUMNAS FILTRADAS =================
  const [autoHideFilteredCols, setAutoHideFilteredCols] = useState<boolean>(true);

  // Pestaña 1: Directorio de Usuarios (Platform Users)
  const showEmpresaCol = !autoHideFilteredCols || selectedUserEmpresaId === 'todas';
  const showPlataformaCol = !autoHideFilteredCols || selectedUserPlataforma === 'todas';
  const showEstadoCol = !autoHideFilteredCols || selectedUserEstado === 'todos';

  const selectedUserEmpresaObj = useMemo(() => {
    if (selectedUserEmpresaId === 'todas') return null;
    return empresas.find((e) => e.id === selectedUserEmpresaId) || null;
  }, [selectedUserEmpresaId, empresas]);

  const hiddenUserColsList = useMemo(() => {
    const list: string[] = [];
    if (!showEmpresaCol) list.push('Empresa & Marca');
    if (!showPlataformaCol) list.push('Plataforma');
    if (!showEstadoCol) list.push('Estado');
    return list;
  }, [showEmpresaCol, showPlataformaCol, showEstadoCol]);

  const hasActiveUserFilters =
    selectedUserEmpresaId !== 'todas' ||
    selectedUserPlataforma !== 'todas' ||
    selectedUserEstado !== 'todos' ||
    Boolean(userSearch.trim());

  // Pestaña 2: Bóveda Maestra IT (Credentials)
  const isEmpresaFilteredInVault = selectedEmpresaId !== 'todas';
  const isMarcaFilteredInVault = selectedMarcaId !== 'todas';
  const isTipoServicioFilteredInVault = selectedTipoServicio !== 'Todos';

  const selectedVaultEmpresaObj = useMemo(() => {
    if (selectedEmpresaId === 'todas') return null;
    return empresas.find((e) => e.id === selectedEmpresaId) || null;
  }, [selectedEmpresaId, empresas]);

  const selectedVaultMarcaObj = useMemo(() => {
    if (selectedMarcaId === 'todas' || !selectedVaultEmpresaObj) return null;
    return selectedVaultEmpresaObj.marcas?.find((m) => m.id === selectedMarcaId) || null;
  }, [selectedMarcaId, selectedVaultEmpresaObj]);

  const hasActiveVaultFilters =
    isEmpresaFilteredInVault ||
    isMarcaFilteredInVault ||
    isTipoServicioFilteredInVault ||
    Boolean(vaultSearch.trim());

  const hiddenVaultFieldsList = useMemo(() => {
    const list: string[] = [];
    if (autoHideFilteredCols && isEmpresaFilteredInVault) list.push('Empresa');
    if (autoHideFilteredCols && isMarcaFilteredInVault) list.push('Marca');
    if (autoHideFilteredCols && isTipoServicioFilteredInVault) list.push('Servicio');
    return list;
  }, [autoHideFilteredCols, isEmpresaFilteredInVault, isMarcaFilteredInVault, isTipoServicioFilteredInVault]);

  // Pestaña 3: Accesos Directos (Quick Links)
  const isCategoriaFilteredInLinks = linkCategoria !== 'Todas';
  const isScopeFilteredInLinks = linkFilterScope !== 'todos';
  const hasActiveLinksFilters = isCategoriaFilteredInLinks || isScopeFilteredInLinks || Boolean(linkSearch.trim());

  const hiddenLinksFieldsList = useMemo(() => {
    const list: string[] = [];
    if (autoHideFilteredCols && isCategoriaFilteredInLinks) list.push('Categoría');
    if (autoHideFilteredCols && isScopeFilteredInLinks) list.push('Ámbito');
    return list;
  }, [autoHideFilteredCols, isCategoriaFilteredInLinks, isScopeFilteredInLinks]);

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* ================= CABECERA PRINCIPAL ================= */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 dark:text-[#00F0FF] border border-cyan-500/20">
              <KeyRound className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Accesos & Bóveda
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botón Gestión de Catálogos (Empresas, Marcas, Plataformas, Cargos) */}
            {isAdminOrLeader && (
              <button
                onClick={() => setIsCatalogModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                title="Configurar catálogos de Empresas, Marcas, Plataformas y Cargos"
              >
                <Settings className="w-4 h-4 text-purple-500" />
                <span>Catálogos</span>
              </button>
            )}

            {/* Botón Generador de Claves */}
            <button
              onClick={() => {
                const pass = generatePassword(genLength, genIncludeSpecial, genIncludeNumbers);
                setGeneratedQuickPass(pass);
                setIsGenModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 dark:text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer shadow-xs"
              title="Generar contraseñas seguras"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generar Clave</span>
            </button>

            {/* Toggle de las 3 Pestañas */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 overflow-x-auto max-w-full">
              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-[#00F0FF] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Cuentas ({platformUsers.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('vault')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'vault'
                    ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-[#00F0FF] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Bóveda ({credentials.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('links')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  activeTab === 'links'
                    ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-[#00F0FF] shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Accesos ({links.length})</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= BARRA DE ESTADO DE SEGURIDAD (MODO SUDO / PIN) ================= */}
      {!isSecurityBarExpanded ? (
        /* VISTA COMPACTA / RIBBON MINIMALISTA (44px) */
        <div className={`rounded-2xl px-4 py-2.5 border transition-all duration-300 backdrop-blur-xl shadow-xs flex items-center justify-between gap-3 ${
          isVaultUnlocked
            ? 'bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 border-emerald-500/40 dark:border-emerald-500/30'
            : 'bg-white/80 dark:bg-slate-900/80 border-slate-200/90 dark:border-white/10'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`p-1.5 rounded-lg border shrink-0 ${
              isVaultUnlocked
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
            }`}>
              {isVaultUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-white truncate">
              {isVaultUnlocked ? 'Bóveda Desbloqueada' : 'Bóveda Protegida'}
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border hidden sm:inline-block ${
              isVaultUnlocked
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
                : 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50'
            }`}>
              AES-256 Fernet
            </span>
            {isVaultUnlocked && (
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 animate-spin text-emerald-500" style={{ animationDuration: '6s' }} />
                {formatTimer(unlockRemainingSeconds)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isVaultUnlocked ? (
              <>
                <button
                  onClick={handleExtendSession}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 cursor-pointer transition-colors shadow-2xs"
                  title="Extender 5 minutos más de sesión"
                >
                  +5 min
                </button>
                <button
                  onClick={handleLockVaultNow}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-900/60 cursor-pointer transition-colors shadow-2xs"
                  title="Bloquear bóveda de inmediato"
                >
                  Bloquear
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setPendingAction(null);
                  setUnlockError('');
                  setUnlockPinInput('');
                  setUnlockPasswordInput('');
                  setIsUnlockModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Desbloquear</span>
              </button>
            )}

            <button
              onClick={() => {
                setPinConfigError('');
                setPinCurrentPass('');
                setPinNewPin('');
                setPinConfirmPin('');
                setIsPinConfigModalOpen(true);
              }}
              className="p-1.5 rounded-lg text-slate-500 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title={hasSecurityPin ? 'Cambiar PIN' : 'Configurar PIN'}
            >
              <Key className="w-4 h-4 text-cyan-500" />
            </button>

            <button
              onClick={() => setIsSecurityBarExpanded(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Expandir centro de seguridad"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* VISTA COMPLETA / CENTRO DE SEGURIDAD HUD */
        <div className={`rounded-2xl border transition-all duration-300 backdrop-blur-xl shadow-sm relative overflow-hidden ${
          isVaultUnlocked
            ? 'bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 border-emerald-500/40 dark:border-emerald-500/30'
            : 'bg-white/90 dark:bg-slate-900/85 border-slate-200/90 dark:border-white/10'
        }`}>
          {/* Línea de acento superior sutil */}
          <div className={`h-1 w-full ${
            isVaultUnlocked
              ? 'bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500'
              : 'bg-gradient-to-r from-amber-400 via-cyan-500 to-blue-500'
          }`} />

          <div className="p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div className={`p-2.5 rounded-2xl border flex items-center justify-center shrink-0 shadow-xs ${
                  isVaultUnlocked
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 animate-pulse'
                    : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                }`}>
                  {isVaultUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <span>{isVaultUnlocked ? 'Bóveda Desbloqueada — Sesión Segura Activa' : 'Bóveda Protegida — Modo Seguro'}</span>
                    </h2>

                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                      isVaultUnlocked
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800/60'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isVaultUnlocked ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {isVaultUnlocked ? 'Desbloqueada' : 'Protegida'}
                    </span>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50">
                      AES-256 Fernet
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                    {isVaultUnlocked
                      ? 'Las contraseñas maestras y de plataformas pueden consultarse y copiarse. Por política de seguridad, la bóveda se bloqueará automáticamente al expirar el tiempo de sesión.'
                      : 'Las contraseñas están ofuscadas bajo cifrado Fernet. Desbloquea con tu PIN o contraseña de usuario para habilitar la visualización y copia segura.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-end sm:self-center shrink-0">
                {isVaultUnlocked ? (
                  <>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold shadow-2xs">
                      <Timer className="w-3.5 h-3.5 animate-spin text-emerald-500" style={{ animationDuration: '6s' }} />
                      <span>Auto-bloqueo: {formatTimer(unlockRemainingSeconds)}</span>
                    </div>

                    <button
                      onClick={handleExtendSession}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                      title="Extender sesión 5 minutos adicionales"
                    >
                      +5 min
                    </button>

                    <button
                      onClick={handleLockVaultNow}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                      title="Bloquear inmediatamente y ofuscar contraseñas"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Bloquear Ahora</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setPendingAction(null);
                      setUnlockError('');
                      setUnlockPinInput('');
                      setUnlockPasswordInput('');
                      setIsUnlockModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-bold shadow-md shadow-cyan-500/25 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Desbloquear Bóveda</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setPinConfigError('');
                    setPinCurrentPass('');
                    setPinNewPin('');
                    setPinConfirmPin('');
                    setIsPinConfigModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                  title="Configurar o cambiar tu PIN de 4 dígitos para desbloqueo rápido"
                >
                  <Key className="w-3.5 h-3.5 text-cyan-500" />
                  <span>{hasSecurityPin ? 'Cambiar PIN' : '⚡ Configurar PIN'}</span>
                </button>

                <button
                  onClick={() => setIsSecurityBarExpanded(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Minimizar barra de seguridad para más espacio"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Barra de progreso de tiempo cuando está desbloqueada */}
            {isVaultUnlocked && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-cyan-500" /> Tiempo restante de sesión
                  </span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                    {formatTimer(unlockRemainingSeconds)} ({Math.round(unlockProgressPercent)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      unlockRemainingSeconds <= 60
                        ? 'bg-rose-500 animate-pulse'
                        : unlockRemainingSeconds <= 120
                        ? 'bg-amber-500'
                        : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
                    }`}
                    style={{ width: `${unlockProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Fila de Insignias y Consejos de Seguridad */}
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Cifrado Fernet HMAC SHA-256</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-cyan-500" />
                  <span>
                    {hasSecurityPin ? 'PIN 4 dígitos activo' : 'Autenticación por contraseña'}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Anti-exfiltración (máx 12 revelaciones/min)</span>
                </span>
              </div>

              <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                <span>💡 Tip: También puedes hacer clic sobre cualquier</span>
                <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">••••••••••</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 1: DIRECTORIO DE USUARIOS POR PLATAFORMA (SOPORTE Y RESETEO)       */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Barra de Filtros de Directorio */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                {/* Buscador */}
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar colaborador, usuario o email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                {/* Filtro por Empresa */}
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedUserEmpresaId}
                    onChange={(e) => setSelectedUserEmpresaId(e.target.value === 'todas' ? 'todas' : Number(e.target.value))}
                    className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="todas">🏢 Todas las Empresas</option>
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                    ))}
                  </select>
                </div>

                {/* Filtro por Estado */}
                <select
                  value={selectedUserEstado}
                  onChange={(e) => setSelectedUserEstado(e.target.value)}
                  className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="activo">🟢 Activos</option>
                  <option value="por_crear">🟡 Por Crear (Alta Previa)</option>
                  <option value="suspendido">⏸ Suspendidos</option>
                  <option value="baja">🔴 De Baja</option>
                </select>
              </div>

              {/* Botonera de Acciones Excel & Registro */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Descargar Plantilla */}
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  title="Descargar plantilla oficial de Excel con ejemplos para rellenar"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 transition-all cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">{isDownloadingTemplate ? 'Descargando...' : 'Descargar Plantilla'}</span>
                  <span className="sm:hidden">Plantilla</span>
                </button>

                {/* Exportar Cuentas */}
                <button
                  type="button"
                  onClick={handleExportAccounts}
                  disabled={isExportingAccounts || platformUsers.length === 0}
                  title="Exportar todas las cuentas mostradas a Excel (.xlsx)"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-blue-500" />
                  <span className="hidden sm:inline">{isExportingAccounts ? 'Exportando...' : 'Exportar (.xlsx)'}</span>
                  <span className="sm:hidden">Exportar</span>
                </button>

                {/* Importar Excel */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFileForImport(null);
                    setImportPreviewData(null);
                    setIsImportModalOpen(true);
                  }}
                  title="Carga masiva de cuentas desde un archivo Excel o CSV"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Importar Excel</span>
                </button>

                {/* Botón Nueva Cuenta */}
                <button
                  type="button"
                  onClick={() => handleOpenUserModal()}
                  className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Registrar Cuenta</span>
                </button>
              </div>
            </div>

            {/* Chips de Plataforma con conteo automático */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5" /> Plataforma:
              </span>
              <button
                onClick={() => setSelectedUserPlataforma('todas')}
                className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                  selectedUserPlataforma === 'todas'
                    ? 'bg-cyan-500 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Todas ({platformUsers.length})
              </button>

              {displayPlatforms.map((plat) => {
                const count = platformCounts[plat] || 0;
                return (
                  <button
                    key={plat}
                    onClick={() => setSelectedUserPlataforma(plat)}
                    className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-all cursor-pointer ${
                      selectedUserPlataforma === plat
                        ? 'bg-cyan-500 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {plat} ({count})
                  </button>
                );
              })}
            </div>

            {/* Barra de Filtros Activos & Espacio Maximizado */}
            {hasActiveUserFilters && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 text-[11px] uppercase tracking-wider mr-1">
                    <Filter className="w-3 h-3 text-cyan-500" />
                    Filtros activos:
                  </span>

                  {selectedUserEmpresaId !== 'todas' && selectedUserEmpresaObj && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white font-semibold text-xs shadow-2xs"
                      style={{ backgroundColor: selectedUserEmpresaObj.color || '#0891b2' }}
                    >
                      <span>🏢 {selectedUserEmpresaObj.nombre}</span>
                      <button
                        onClick={() => setSelectedUserEmpresaId('todas')}
                        title="Quitar filtro de empresa"
                        className="text-white/80 hover:text-white cursor-pointer ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}

                  {selectedUserPlataforma !== 'todas' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 dark:bg-cyan-500/25 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-semibold text-xs">
                      <span>💻 {selectedUserPlataforma}</span>
                      <button
                        onClick={() => setSelectedUserPlataforma('todas')}
                        title="Quitar filtro de plataforma"
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}

                  {selectedUserEstado !== 'todos' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-semibold text-xs">
                      <span>
                        {selectedUserEstado === 'activo'
                          ? '🟢 Activos'
                          : selectedUserEstado === 'por_crear'
                          ? '🟡 Por Crear'
                          : selectedUserEstado === 'suspendido'
                          ? '⏸ Suspendidos'
                          : '🔴 De Baja'}
                      </span>
                      <button
                        onClick={() => setSelectedUserEstado('todos')}
                        title="Quitar filtro de estado"
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}

                  {userSearch.trim() && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-semibold text-xs">
                      <span>🔍 "{userSearch}"</span>
                      <button
                        onClick={() => setUserSearch('')}
                        title="Limpiar búsqueda"
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}

                  {hiddenUserColsList.length > 0 && autoHideFilteredCols && (
                    <span className="text-[11px] text-cyan-800 dark:text-cyan-300 font-medium flex items-center gap-1 bg-cyan-50 dark:bg-cyan-950/50 px-2.5 py-1 rounded-lg border border-cyan-200 dark:border-cyan-500/30">
                      <EyeOff className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                      <span>
                        {hiddenUserColsList.length} {hiddenUserColsList.length === 1 ? 'columna repetitiva oculta' : 'columnas repetitivas ocultas'} ({hiddenUserColsList.join(', ')})
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {/* Botón switch para alternar auto-ocultamiento */}
                  <button
                    onClick={() => setAutoHideFilteredCols(!autoHideFilteredCols)}
                    title={autoHideFilteredCols ? 'Click para mostrar todas las columnas sin ocultar' : 'Click para auto-ocultar columnas repetidas'}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      autoHideFilteredCols
                        ? 'bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {autoHideFilteredCols ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        <span>Ocultar redundantes: ON</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>Ver todas las cols</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setSelectedUserEmpresaId('todas');
                      setSelectedUserPlataforma('todas');
                      setSelectedUserEstado('todos');
                      setUserSearch('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer"
                    title="Restablecer todos los filtros"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpiar filtros</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tabla de Usuarios de Plataforma */}
          {loadingUsers ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
              <p className="text-sm">Cargando directorio de cuentas por plataforma...</p>
            </div>
          ) : platformUsers.length === 0 ? (
            <div className="text-center py-16 bg-white/40 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700/60 rounded-2xl p-6">
              <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No se encontraron usuarios en esta plataforma/criterio</p>
              <button
                onClick={() => handleOpenUserModal()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 text-xs font-semibold border border-cyan-500/30 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar colaborador</span>
              </button>
            </div>
          ) : (
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Colaborador / Cargo</th>
                      {showEmpresaCol && <th className="py-3 px-4">Empresa & Marca</th>}
                      {showPlataformaCol && <th className="py-3 px-4">Plataforma</th>}
                      <th className="py-3 px-4">Usuario / Email</th>
                      <th className="py-3 px-4">Contraseña Actual</th>
                      {showEstadoCol && <th className="py-3 px-4">Estado</th>}
                      <th className="py-3 px-4 text-right">Acciones de Soporte</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {platformUsers.map((u) => {
                      const isPwRev = Boolean(revealedUserPwIds[u.id]);

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {!showEstadoCol && (
                                <span
                                  className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                    u.estado === 'activo'
                                      ? 'bg-emerald-500'
                                      : u.estado === 'por_crear'
                                      ? 'bg-amber-500'
                                      : u.estado === 'suspendido'
                                      ? 'bg-orange-500'
                                      : 'bg-rose-500'
                                  }`}
                                  title={`Estado: ${
                                    u.estado === 'activo'
                                      ? 'Activa'
                                      : u.estado === 'por_crear'
                                      ? 'Por Crear'
                                      : u.estado === 'suspendido'
                                      ? 'Suspendida'
                                      : 'Baja'
                                  }`}
                                />
                              )}
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {u.colaborador_nombre}
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {u.colaborador_cargo || 'Sin cargo asignado'}
                            </div>
                            {!showEmpresaCol && u.marca_nombre && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                🏷️ {u.marca_nombre}
                              </div>
                            )}
                            {u.colaborador_telefono && (
                              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                <Smartphone className="w-3 h-3" />
                                <span>{u.colaborador_telefono}</span>
                              </div>
                            )}
                          </td>

                          {showEmpresaCol && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white inline-block shadow-xs mb-0.5"
                                style={{ backgroundColor: u.empresa_color || '#3B82F6' }}
                              >
                                {u.empresa_nombre}
                              </span>
                              {u.marca_nombre && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  🏷️ {u.marca_nombre}
                                </div>
                              )}
                            </td>
                          )}

                          {showPlataformaCol && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-medium text-slate-800 dark:text-slate-200">
                                {u.plataforma}
                              </span>
                            </td>
                          )}

                          <td className="py-3 px-4 font-mono text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-700 dark:text-slate-300 font-semibold select-all">
                                {u.usuario_login}
                              </span>
                              <button
                                onClick={() => handleCopyText(u.usuario_login, 'Usuario', u.id, false)}
                                title="Copiar usuario"
                                className="text-slate-400 hover:text-cyan-500 p-0.5 cursor-pointer"
                              >
                                {copiedId === `${u.id}-Usuario` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            {u.colaborador_email && (
                              <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                {u.colaborador_email}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700/60">
                              <span className={`font-semibold ${isPwRev ? 'text-amber-500 dark:text-amber-300 select-all' : 'text-slate-400'}`}>
                                {isPwRev ? u.password_actual : '••••••••••'}
                              </span>
                              <button
                                onClick={() => handleToggleRevealUserPw(u.id)}
                                title={isPwRev ? 'Ocultar' : 'Ver por 10s'}
                                className="text-slate-400 hover:text-amber-400 p-0.5 cursor-pointer"
                              >
                                {isPwRev ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleCopyText(u.password_actual, 'Contraseña', u.id, true)}
                                title="Copiar clave"
                                className="text-slate-400 hover:text-cyan-500 p-0.5 cursor-pointer"
                              >
                                {copiedId === `${u.id}-Contraseña` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            {u.ultimo_reseteo && (
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Clock className="w-3 h-3" />
                                <span>Act: {u.ultimo_reseteo.split(' ')[0]}</span>
                              </div>
                            )}
                          </td>

                          {showEstadoCol && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  u.estado === 'activo'
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                    : u.estado === 'por_crear'
                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                    : u.estado === 'suspendido'
                                    ? 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                                    : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                                }`}
                              >
                                {u.estado === 'activo'
                                  ? '● Activa'
                                  : u.estado === 'por_crear'
                                  ? '⏳ Por Crear'
                                  : u.estado === 'suspendido'
                                  ? '⏸ Suspendida'
                                  : '✕ Baja'}
                              </span>
                            </td>
                          )}

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 justify-end">
                              <button
                                onClick={() => handleOpenResetModal(u)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white text-xs font-semibold border border-amber-500/20 transition-all cursor-pointer"
                                title="Resetear contraseña y preparar mensaje de soporte"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Resetear</span>
                              </button>

                              {u.colaborador_telefono && (
                                <button
                                  onClick={() => {
                                    const msg = `Hola ${u.colaborador_nombre}, tus credenciales de ${u.plataforma} son:\nUsuario: ${u.usuario_login}\nClave: ${u.password_actual}`;
                                    handleSendWhatsApp(u.colaborador_telefono, msg);
                                  }}
                                  className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors cursor-pointer"
                                  title="Enviar datos por WhatsApp"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handleOpenUserModal(u)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Editar cuenta"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {isAdminOrLeader && (
                                <button
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Eliminar del directorio"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: BÓVEDA MAESTRA IT                                              */}
      {/* ========================================================================= */}
      {activeTab === 'vault' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cuenta master, NAS root, etc..."
                  value={vaultSearch}
                  onChange={(e) => setVaultSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                  className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="todas">🏢 Todas las Empresas</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                  ))}
                </select>
              </div>

              {selectedEmpresaId !== 'todas' && filterMarcas.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedMarcaId}
                    onChange={(e) => setSelectedMarcaId(e.target.value === 'todas' ? 'todas' : Number(e.target.value))}
                    className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="todas">🏷️ Todas las Marcas</option>
                    {filterMarcas.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
              )}

              <select
                value={selectedTipoServicio}
                onChange={(e) => setSelectedTipoServicio(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {TIPO_SERVICIOS_PRESET.map((t) => (
                  <option key={t} value={t}>{t === 'Todos' ? 'Todos los Servicios' : t}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleOpenCredModal()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Credencial Maestra</span>
            </button>
          </div>

          {/* Barra de Filtros Activos de Bóveda */}
          {hasActiveVaultFilters && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-cyan-50/60 dark:bg-slate-800/50 border border-cyan-100 dark:border-slate-700/60 rounded-xl text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 text-[11px] uppercase tracking-wider mr-1">
                  <Filter className="w-3 h-3 text-cyan-500" />
                  Filtros activos:
                </span>

                {isEmpresaFilteredInVault && selectedVaultEmpresaObj && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white font-semibold text-xs shadow-2xs"
                    style={{ backgroundColor: selectedVaultEmpresaObj.color || '#0891b2' }}
                  >
                    <span>🏢 {selectedVaultEmpresaObj.nombre}</span>
                    <button
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

                {isMarcaFilteredInVault && selectedVaultMarcaObj && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 dark:bg-blue-500/25 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40 font-semibold text-xs">
                    <span>🏷️ {selectedVaultMarcaObj.nombre}</span>
                    <button
                      onClick={() => setSelectedMarcaId('todas')}
                      title="Quitar filtro de marca"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {isTipoServicioFilteredInVault && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 dark:bg-cyan-500/25 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-semibold text-xs">
                    <span>⚙️ {selectedTipoServicio}</span>
                    <button
                      onClick={() => setSelectedTipoServicio('Todos')}
                      title="Quitar filtro de servicio"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {vaultSearch.trim() && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-semibold text-xs">
                    <span>🔍 "{vaultSearch}"</span>
                    <button
                      onClick={() => setVaultSearch('')}
                      title="Limpiar búsqueda"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {hiddenVaultFieldsList.length > 0 && (
                  <span className="text-[11px] text-cyan-800 dark:text-cyan-300 font-medium flex items-center gap-1 bg-cyan-50 dark:bg-cyan-950/50 px-2.5 py-1 rounded-lg border border-cyan-200 dark:border-cyan-500/30">
                    <EyeOff className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span>
                      Campos repetitivos ocultos ({hiddenVaultFieldsList.join(', ')})
                    </span>
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setSelectedEmpresaId('todas');
                  setSelectedMarcaId('todas');
                  setSelectedTipoServicio('Todos');
                  setVaultSearch('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer ml-auto"
                title="Restablecer filtros de bóveda"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            </div>
          )}

          {loadingVault ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
              <p className="text-sm">Accediendo a la bóveda maestra IT...</p>
            </div>
          ) : credentials.length === 0 ? (
            <div className="text-center py-16 bg-white/40 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700/60 rounded-2xl p-6">
              <Shield className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No hay credenciales maestras registradas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {credentials.map((cred) => {
                const isPwRevealed = Boolean(revealedCredPwIds[cred.id]);
                const canEdit = Boolean(cred.can_edit) || isAdminOrLeader;

                return (
                  <div key={cred.id} className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 hover:border-cyan-500/40 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {(!autoHideFilteredCols || !isEmpresaFilteredInVault) && (
                            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white shadow-xs" style={{ backgroundColor: cred.empresa_color || '#3B82F6' }}>
                              {cred.empresa_nombre}
                            </span>
                          )}
                          {(!autoHideFilteredCols || !isMarcaFilteredInVault) && cred.marca_nombre && (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {cred.marca_nombre}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                          {cred.tipo_cuenta || 'operativa'}
                        </span>
                      </div>

                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white text-base">{cred.plataforma}</h3>
                          {(!autoHideFilteredCols || !isTipoServicioFilteredInVault) && (
                            <span className="text-xs text-cyan-600 dark:text-[#00F0FF] font-medium">{cred.tipo_servicio}</span>
                          )}
                        </div>
                        {cred.url_acceso && (
                          <a href={cred.url_acceso} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-cyan-500 transition-colors" title="Ir a consola">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>

                      <div className="bg-slate-950/60 dark:bg-black/60 rounded-xl p-3 border border-slate-800/80 space-y-2 mb-3 font-mono text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 text-[11px]">Usuario:</span>
                          <div className="flex items-center gap-1.5 justify-end truncate">
                            <span className="text-slate-200 font-semibold truncate select-all">{cred.usuario_login}</span>
                            <button onClick={() => handleCopyText(cred.usuario_login, 'Usuario', cred.id, false)} title="Copiar" className="text-slate-400 hover:text-cyan-400 p-1 cursor-pointer">
                              {copiedId === `${cred.id}-Usuario` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
                          <span className="text-slate-400 text-[11px]">Contraseña:</span>
                          <div className="flex items-center gap-1.5 justify-end truncate">
                            <span className={`font-semibold tracking-wider ${isPwRevealed ? 'text-amber-300' : 'text-slate-400'}`}>
                              {isPwRevealed ? cred.password_secret : '••••••••••••'}
                            </span>
                            <button onClick={() => handleToggleRevealCred(cred.id)} title={isPwRevealed ? 'Ocultar' : 'Ver por 10s'} className="text-slate-400 hover:text-amber-400 p-1 cursor-pointer">
                              {isPwRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => handleCopyText(cred.password_secret, 'Contraseña', cred.id, true)} title="Copiar" className="text-slate-400 hover:text-cyan-400 p-1 cursor-pointer">
                              {copiedId === `${cred.id}-Contraseña` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {cred.notas && (
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 mb-3">
                          <p className="line-clamp-2">{cred.notas}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                      {isAdminOrLeader && (
                        <button onClick={() => handleOpenPermModal(cred)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:text-purple-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-[11px] cursor-pointer">
                          <Users className="w-3.5 h-3.5" />
                          <span>Permisos</span>
                        </button>
                      )}

                      <div className="flex items-center gap-1 ml-auto">
                        {canEdit && (
                          <button onClick={() => handleOpenCredModal(cred)} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {isAdminOrLeader && (
                          <button onClick={() => handleDeleteCred(cred.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Eliminar">
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

      {/* ========================================================================= */}
      {/* PESTAÑA 3: ACCESOS DIRECTOS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'links' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar enlace, URL o descripción..."
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <select
                value={linkCategoria}
                onChange={(e) => setLinkCategoria(e.target.value)}
                className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {CATEGORIAS_QUICKLINKS.map((c) => (
                  <option key={c} value={c}>{c === 'Todas' ? 'Todas las Categorías' : c}</option>
                ))}
              </select>

              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800/80 p-0.5 border border-slate-200 dark:border-slate-700/60 text-xs font-medium">
                {(['todos', 'mis', 'equipo', 'global'] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setLinkFilterScope(scope)}
                    className={`px-3 py-1.5 rounded-lg capitalize transition-all cursor-pointer ${
                      linkFilterScope === scope
                        ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-[#00F0FF] shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {scope === 'todos' ? 'Todos' : scope === 'mis' ? '👤 Mis Enlaces' : scope === 'equipo' ? '👥 Equipo' : '🌐 Global'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleOpenLinkModal()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Acceso</span>
            </button>
          </div>

          {/* Barra de Filtros Activos de Accesos Directos */}
          {hasActiveLinksFilters && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 bg-cyan-50/60 dark:bg-slate-800/50 border border-cyan-100 dark:border-slate-700/60 rounded-xl text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 text-[11px] uppercase tracking-wider mr-1">
                  <Filter className="w-3 h-3 text-cyan-500" />
                  Filtros activos:
                </span>

                {isCategoriaFilteredInLinks && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 dark:bg-cyan-500/25 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-semibold text-xs">
                    <span>🏷️ {linkCategoria}</span>
                    <button
                      onClick={() => setLinkCategoria('Todas')}
                      title="Quitar filtro de categoría"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {isScopeFilteredInLinks && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/15 dark:bg-blue-500/25 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-500/40 font-semibold text-xs">
                    <span>
                      {linkFilterScope === 'mis' ? '👤 Mis Enlaces' : linkFilterScope === 'equipo' ? '👥 Equipo' : '🌐 Global'}
                    </span>
                    <button
                      onClick={() => setLinkFilterScope('todos')}
                      title="Quitar filtro de ámbito"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {linkSearch.trim() && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-semibold text-xs">
                    <span>🔍 "{linkSearch}"</span>
                    <button
                      onClick={() => setLinkSearch('')}
                      title="Limpiar búsqueda"
                      className="hover:text-rose-500 cursor-pointer ml-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {hiddenLinksFieldsList.length > 0 && (
                  <span className="text-[11px] text-cyan-800 dark:text-cyan-300 font-medium flex items-center gap-1 bg-cyan-50 dark:bg-cyan-950/50 px-2.5 py-1 rounded-lg border border-cyan-200 dark:border-cyan-500/30">
                    <EyeOff className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                    <span>
                      Campos repetitivos ocultos ({hiddenLinksFieldsList.join(', ')})
                    </span>
                  </span>
                )}
              </div>

              <button
                onClick={() => {
                  setLinkCategoria('Todas');
                  setLinkFilterScope('todos');
                  setLinkSearch('');
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-colors cursor-pointer ml-auto"
                title="Restablecer filtros de accesos"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar filtros</span>
              </button>
            </div>
          )}

          {loadingLinks ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-500" />
              <p className="text-sm">Cargando accesos rápidos...</p>
            </div>
          ) : filteredLinks.length === 0 ? (
            <div className="text-center py-16 bg-white/40 dark:bg-slate-900/40 border border-dashed border-slate-300 dark:border-slate-700/60 rounded-2xl p-6">
              <ExternalLink className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-base font-semibold text-slate-700 dark:text-slate-300">No hay accesos directos registrados</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLinks.map((link) => {
                const canManage = isAdminOrLeader || link.user_id === currentUser?.id;
                const isPwRevealed = Boolean(revealedLinkPwIds[link.id]);

                return (
                  <div key={link.id} className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 hover:border-cyan-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs" style={{ backgroundColor: link.color || '#00F0FF' }}>
                            {link.titulo.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900 dark:text-white text-sm group-hover:text-cyan-500 transition-colors line-clamp-1">{link.titulo}</h3>
                            {(!autoHideFilteredCols || !isCategoriaFilteredInLinks) && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">{link.categoria || 'General'}</span>
                            )}
                          </div>
                        </div>
                        {(!autoHideFilteredCols || !isScopeFilteredInLinks) && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                            {link.visibilidad === 'personal' ? '👤 Personal' : link.visibilidad === 'equipo' ? '👥 Equipo' : '🌐 Global'}
                          </span>
                        )}
                      </div>

                      {link.descripcion && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">{link.descripcion}</p>
                      )}

                      {(link.usuario || link.password) && (
                        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 border border-slate-200/60 dark:border-slate-700/50 mb-3 space-y-1.5 text-xs font-mono">
                          {link.usuario && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400 text-[11px]">User:</span>
                              <div className="flex items-center gap-1.5 flex-1 justify-end truncate">
                                <span className="text-slate-700 dark:text-slate-300 truncate">{link.usuario}</span>
                                <button onClick={() => handleCopyText(link.usuario!, 'Usuario')} title="Copiar" className="text-slate-400 hover:text-cyan-500 p-1 cursor-pointer">
                                  {copiedId === `gen-Usuario` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          )}

                          {link.password && (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400 text-[11px]">Pass:</span>
                              <div className="flex items-center gap-1.5 flex-1 justify-end truncate">
                                <span className="text-slate-700 dark:text-slate-300">{isPwRevealed ? link.password : '••••••••'}</span>
                                <button onClick={() => handleToggleRevealLinkPw(link.id)} title={isPwRevealed ? 'Ocultar' : 'Ver por 10s'} className="text-slate-400 hover:text-cyan-500 p-1 cursor-pointer">
                                  {isPwRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => handleCopyText(link.password!, 'Contraseña', link.id, true)} title="Copiar" className="text-slate-400 hover:text-cyan-500 p-1 cursor-pointer">
                                  {copiedId === `${link.id}-Contraseña` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-auto">
                      <div className="flex items-center gap-1">
                        {canManage && (
                          <>
                            <button onClick={() => handleOpenLinkModal(link)} className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Editar">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDeleteLink(link.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer" title="Eliminar">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>

                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500 text-cyan-600 dark:text-[#00F0FF] hover:text-white text-xs font-semibold border border-cyan-500/30 transition-all">
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

      {/* ========================================================================= */}
      {/* MODAL MAESTRO: GESTIÓN DE CATÁLOGOS TI (EMPRESAS, MARCAS, PLATAFORMAS, CARGOS) */}
      {/* ========================================================================= */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                <span>Gestión de Catálogos TI</span>
              </h2>
              <button onClick={() => setIsCatalogModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Pestaña del Catálogo */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs font-semibold">
              <button
                onClick={() => setCatalogTab('empresas')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  catalogTab === 'empresas' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-300 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Empresas & Marcas ({empresas.length})</span>
              </button>
              <button
                onClick={() => setCatalogTab('plataformas')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  catalogTab === 'plataformas' ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-cyan-300 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Server className="w-4 h-4" />
                <span>Plataformas ({plataformasCatalog.length})</span>
              </button>
              <button
                onClick={() => setCatalogTab('cargos')}
                className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  catalogTab === 'cargos' ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-300 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>Cargos & Áreas ({cargosCatalog.length})</span>
              </button>
            </div>

            {/* TAB 1: EMPRESAS & MARCAS */}
            {catalogTab === 'empresas' && (
              <div className="space-y-4 text-xs animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Nueva Empresa */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                      <Building2 className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Agregar Empresa</span>
                    </h3>
                    <form onSubmit={handleCreateEmpresa} className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Nombre de la empresa"
                          value={newEmpresaNombre}
                          onChange={(e) => setNewEmpresaNombre(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                        />
                        <input
                          type="color"
                          value={newEmpresaColor}
                          onChange={(e) => setNewEmpresaColor(e.target.value)}
                          className="w-10 h-9 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer"
                          title="Color"
                        />
                      </div>
                      <button type="submit" className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold cursor-pointer">
                        + Guardar Empresa
                      </button>
                    </form>
                  </div>

                  {/* Nueva Marca */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                      <Tag className="w-3.5 h-3.5 text-purple-400" />
                      <span>Agregar Marca</span>
                    </h3>
                    <form onSubmit={handleCreateMarca} className="space-y-2">
                      <select
                        required
                        value={newMarcaEmpresaId}
                        onChange={(e) => setNewMarcaEmpresaId(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                      >
                        <option value={0}>Selecciona Empresa...</option>
                        {empresas.map((emp) => (
                          <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Nombre de la marca o sede"
                          value={newMarcaNombre}
                          onChange={(e) => setNewMarcaNombre(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                        />
                        <button type="submit" className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold cursor-pointer whitespace-nowrap">
                          Vincular
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Listado */}
                <div className="space-y-2">
                  <span className="font-semibold text-slate-500 text-xs">Empresas Registradas:</span>
                  <div className="space-y-2 max-h-52 overflow-y-auto">
                    {empresas.map((emp) => (
                      <div key={emp.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: emp.color || '#3B82F6' }} />
                            <span className="font-bold text-slate-900 dark:text-white">{emp.nombre}</span>
                          </div>
                          <button onClick={() => handleDeleteEmpresa(emp.id)} className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer" title="Eliminar empresa">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 pl-5">
                          {emp.marcas && emp.marcas.length > 0 ? (
                            emp.marcas.map((m) => (
                              <span key={m.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                <span>🏷️ {m.nombre}</span>
                                <button onClick={() => handleDeleteMarca(m.id)} className="text-slate-400 hover:text-rose-500 ml-0.5 cursor-pointer">×</button>
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Sin marcas vinculadas</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: PLATAFORMAS */}
            {catalogTab === 'plataformas' && (
              <div className="space-y-4 text-xs animate-fadeIn">
                {/* Formulario Nueva Plataforma */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                    <Server className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Registrar Nueva Plataforma</span>
                  </h3>
                  <form onSubmit={handleCreatePlataforma} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="ej. Zimbra, Fortinet VPN, Odoo"
                      value={newPlatNombre}
                      onChange={(e) => setNewPlatNombre(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                    <select
                      value={newPlatTipo}
                      onChange={(e) => setNewPlatTipo(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    >
                      {TIPO_SERVICIOS_PRESET.filter((t) => t !== 'Todos').map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button type="submit" className="py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-semibold cursor-pointer">
                      + Agregar Plataforma
                    </button>
                  </form>
                </div>

                {/* Listado de Plataformas */}
                <div className="space-y-2">
                  <span className="font-semibold text-slate-500 text-xs">Plataformas en el Sistema:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                    {plataformasCatalog.map((plat) => (
                      <div key={plat.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{plat.nombre}</div>
                          <span className="text-[10px] text-cyan-500">{plat.tipo_servicio}</span>
                        </div>
                        <button onClick={() => handleDeletePlataforma(plat.id)} className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CARGOS / ÁREAS */}
            {catalogTab === 'cargos' && (
              <div className="space-y-4 text-xs animate-fadeIn">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-2">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Registrar Nuevo Cargo / Puesto</span>
                  </h3>
                  <form onSubmit={handleCreateCargo} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="ej. Diseñador Gráfico, Contador"
                      value={newCargoNombre}
                      onChange={(e) => setNewCargoNombre(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Área (ej. Marketing, Finanzas)"
                      value={newCargoArea}
                      onChange={(e) => setNewCargoArea(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                    <button type="submit" className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer">
                      + Agregar Cargo
                    </button>
                  </form>
                </div>

                <div className="space-y-2">
                  <span className="font-semibold text-slate-500 text-xs">Cargos Disponibles ({cargosCatalog.length}):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                    {cargosCatalog.map((c) => (
                      <div key={c.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{c.nombre}</div>
                          <span className="text-[10px] text-emerald-500">Área: {c.area || 'General'}</span>
                        </div>
                        <button onClick={() => handleDeleteCargo(c.id)} className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsCatalogModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR / EDITAR USUARIO EN PLATAFORMA                           */}
      {/* ========================================================================= */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-500" />
                <span>{editingPlatformUser ? 'Editar Cuenta de Usuario' : 'Registrar Cuenta en Plataforma'}</span>
              </h2>
              <button onClick={() => setIsUserModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs sm:text-sm">
              {/* Empresa & Plataforma con botones rápidos de gestión */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Empresa *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogTab('empresas');
                        setIsCatalogModalOpen(true);
                      }}
                      className="text-purple-500 hover:text-purple-400 text-[11px] font-semibold cursor-pointer"
                    >
                      + Gestionar
                    </button>
                  </div>
                  <select
                    required
                    value={userFormData.empresa_id}
                    onChange={(e) => {
                      const newEmpId = Number(e.target.value);
                      const emp = empresas.find((x) => x.id === newEmpId);
                      const newEntity = detectCorporateEntity(emp?.nombre);
                      setSelectedCorporateEntity(newEntity);

                      let newLogin = userFormData.usuario_login;
                      let newEmail = userFormData.colaborador_email;
                      if (isMailPlatform(userFormData.plataforma) && userFormData.colaborador_nombre) {
                        const gen = generateCorporateEmail(userFormData.colaborador_nombre, newEntity);
                        newLogin = gen;
                        newEmail = gen;
                      }

                      setUserFormData({
                        ...userFormData,
                        empresa_id: newEmpId,
                        marca_id: emp?.marcas && emp.marcas.length > 0 ? emp.marcas[0].id : 0,
                        usuario_login: newLogin,
                        colaborador_email: newEmail,
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Plataforma *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogTab('plataformas');
                        setIsCatalogModalOpen(true);
                      }}
                      className="text-cyan-500 hover:text-cyan-400 text-[11px] font-semibold cursor-pointer"
                    >
                      + Gestionar
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    list="plat-options"
                    placeholder="Zimbra Mail, Active Directory..."
                    value={userFormData.plataforma}
                    onChange={(e) => handlePlataformaInputChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <datalist id="plat-options">
                    {plataformasCatalog.map((p) => (
                      <option key={p.id} value={p.nombre} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nombre Completo del Colaborador *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Luis Cordova Lopez o Carlos Mendoza Vargas"
                  value={userFormData.colaborador_nombre}
                  onChange={(e) => handleColaboradorNameChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Cargo / Área con selector y gestión */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Cargo / Área</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogTab('cargos');
                        setIsCatalogModalOpen(true);
                      }}
                      className="text-emerald-500 hover:text-emerald-400 text-[11px] font-semibold cursor-pointer"
                    >
                      + Gestionar
                    </button>
                  </div>
                  <input
                    type="text"
                    list="cargos-options"
                    placeholder="Selecciona o escribe puesto..."
                    value={userFormData.colaborador_cargo}
                    onChange={(e) => setUserFormData({ ...userFormData, colaborador_cargo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                  <datalist id="cargos-options">
                    {cargosCatalog.map((c) => (
                      <option key={c.id} value={c.nombre} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Teléfono / WhatsApp
                  </label>
                  <input
                    type="text"
                    placeholder="ej. 51987654321"
                    value={userFormData.colaborador_telefono}
                    onChange={(e) => setUserFormData({ ...userFormData, colaborador_telefono: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-medium text-slate-700 dark:text-slate-300">
                      Usuario / Email de Inicio *
                    </label>
                    {isMailPlatform(userFormData.plataforma) && (
                      <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold">
                        Algoritmo {selectedCorporateEntity === 'solopromo' ? 'Solopromo' : selectedCorporateEntity === 'hp' ? 'HP' : 'Marketing'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="ej. lcordova@marketing-alterno.com"
                    value={userFormData.usuario_login}
                    onChange={(e) => setUserFormData({ ...userFormData, usuario_login: e.target.value, colaborador_email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-xs"
                  />

                  {/* Selector rápido de formato corporativo según entidad */}
                  {isMailPlatform(userFormData.plataforma) && (
                    <div className="mt-1.5 space-y-1">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Formato por entidad:</span>
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSelectCorporateEntity('marketing_alterno')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                            selectedCorporateEntity === 'marketing_alterno'
                              ? 'bg-cyan-500 text-white border-cyan-500 shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                          }`}
                          title="[Inicial][Apellido]@marketing-alterno.com (ej. lcordova@marketing-alterno.com)"
                        >
                          🏢 Marketing Alterno
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectCorporateEntity('solopromo')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                            selectedCorporateEntity === 'solopromo'
                              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                          }`}
                          title="[Primer Nombre].[Apellido]@solopromo.net (ej. luis.cordova@solopromo.net)"
                        >
                          🏷️ Solopromo
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSelectCorporateEntity('hp')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all cursor-pointer ${
                            selectedCorporateEntity === 'hp'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                          }`}
                          title="[Inicial][Apellido].hp@marketing-alterno.com (ej. lcordova.hp@marketing-alterno.com)"
                        >
                          💻 HP
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Contraseña *</label>
                    <div className="flex items-center gap-1.5">
                      {isMailPlatform(userFormData.plataforma) ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const pass = generateCorporatePassword(userFormData.colaborador_nombre);
                              setUserFormData({ ...userFormData, password_actual: pass });
                              if (onShowToast) onShowToast('Contraseña corporativa generada (ej. Lu1s2026@)', 'info');
                            }}
                            className="text-cyan-600 dark:text-cyan-400 hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            title="Generar contraseña corporativa: Inicial mayúscula + vocales en leet + números + símbolo (@, #, $, !), de 8 a 12 caracteres"
                          >
                            <Sparkles className="w-3 h-3 text-cyan-500" />
                            <span>✨ Corp (Leet)</span>
                          </button>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              const pass = generateStrongPlatformPassword(14);
                              setUserFormData({ ...userFormData, password_actual: pass });
                              if (onShowToast) onShowToast('Contraseña segura aleatoria generada', 'info');
                            }}
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-[11px] font-medium cursor-pointer"
                            title="Generar contraseña aleatoria de 14 caracteres"
                          >
                            🎲 Aleatoria
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const pass = generateStrongPlatformPassword(14);
                            setUserFormData({ ...userFormData, password_actual: pass });
                            if (onShowToast) onShowToast('Contraseña segura de plataforma generada', 'info');
                          }}
                          className="text-cyan-600 dark:text-cyan-400 hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          title="Generar clave segura de alta entropía (14 caracteres) para plataformas de software"
                        >
                          <Sparkles className="w-3 h-3 text-cyan-500" />
                          <span>✨ Clave Segura</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Clave"
                    value={userFormData.password_actual}
                    onChange={(e) => setUserFormData({ ...userFormData, password_actual: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-xs"
                  />
                  {isMailPlatform(userFormData.plataforma) ? (
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      💡 Regla: <span className="font-semibold text-slate-700 dark:text-slate-300">[Inicial][Nombre leet][Números][@#$!]</span> (8-12 chars, ej. <span className="font-mono text-cyan-700 dark:text-cyan-300 font-bold">Lu1s2026@</span>).
                    </p>
                  ) : (
                    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                      🔒 Clave segura de alta entropía generada para software interno (sin creación de correo).
                    </p>
                  )}
                </div>
              </div>

              {/* Estado de Cuenta & Marca */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Estado de la Cuenta
                  </label>
                  <select
                    value={userFormData.estado}
                    onChange={(e) => setUserFormData({ ...userFormData, estado: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                  >
                    <option value="activo">🟢 Activa (Ya creada en plataforma)</option>
                    <option value="por_crear">🟡 Por Crear (Alta previa / Pendiente)</option>
                    <option value="suspendido">⏸ Suspendida temporalmente</option>
                    <option value="baja">🔴 De Baja (Ex-colaborador)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Marca / Sede</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogTab('empresas');
                        setIsCatalogModalOpen(true);
                      }}
                      className="text-purple-500 hover:text-purple-400 text-[11px] font-semibold cursor-pointer"
                    >
                      + Gestionar
                    </button>
                  </div>
                  <select
                    value={userFormData.marca_id}
                    onChange={(e) => setUserFormData({ ...userFormData, marca_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value={0}>General (Sin marca específica)</option>
                    {formSelectedEmpresaMarcas.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Notas de Soporte</label>
                <input
                  type="text"
                  placeholder="ej. Solicitó cambio de clave el 15/01, carpeta asignada, etc."
                  value={userFormData.notas}
                  onChange={(e) => setUserFormData({ ...userFormData, notas: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  {editingPlatformUser ? 'Actualizar Cuenta' : 'Guardar en Directorio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RESETEO RÁPIDO DE CLAVE Y PLANTILLA DE MENSAJE                     */}
      {/* ========================================================================= */}
      {isResetModalOpen && selectedUserForReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-500" />
                <span>Resetear Contraseña de Soporte</span>
              </h2>
              <button onClick={() => setIsResetModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700/60 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Colaborador:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedUserForReset.colaborador_nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Plataforma:</span>
                <span className="font-semibold text-cyan-500">{selectedUserForReset.plataforma}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Usuario:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300 font-semibold">{selectedUserForReset.usuario_login}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Nueva Contraseña Generada
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const np = generatePassword(14);
                    setResetGeneratedPass(np);
                    const empName = selectedUserForReset.empresa_nombre || 'la Empresa';
                    setResetShareMessage(
                      `Hola ${selectedUserForReset.colaborador_nombre}, el área de Sistemas de ${empName} te comparte tus credenciales actualizadas:\n\nPlataforma: ${selectedUserForReset.plataforma}\nUsuario: ${selectedUserForReset.usuario_login}\nContraseña temporal: ${np}\n\nPor favor inicia sesión y cambia tu contraseña por seguridad.`
                    );
                  }}
                  className="text-xs text-cyan-500 hover:text-cyan-400 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Regenerar</span>
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={resetGeneratedPass}
                  onChange={(e) => {
                    setResetGeneratedPass(e.target.value);
                    const empName = selectedUserForReset.empresa_nombre || 'la Empresa';
                    setResetShareMessage(
                      `Hola ${selectedUserForReset.colaborador_nombre}, el área de Sistemas de ${empName} te comparte tus credenciales actualizadas:\n\nPlataforma: ${selectedUserForReset.plataforma}\nUsuario: ${selectedUserForReset.usuario_login}\nContraseña temporal: ${e.target.value}\n\nPor favor inicia sesión y cambia tu contraseña por seguridad.`
                    );
                  }}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-xs text-amber-500 font-bold border border-slate-200 dark:border-slate-700 focus:outline-none"
                />
                <button
                  onClick={() => handleCopyText(resetGeneratedPass, 'Contraseña temporal')}
                  className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-xs font-semibold cursor-pointer"
                  title="Copiar contraseña"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Mensaje de Respuesta Listo para Enviar:</span>
                <button
                  onClick={() => handleCopyText(resetShareMessage, 'Mensaje de soporte')}
                  className="text-cyan-500 hover:text-cyan-400 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copiar Mensaje</span>
                </button>
              </label>
              <textarea
                rows={4}
                value={resetShareMessage}
                onChange={(e) => setResetShareMessage(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans focus:outline-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
              {selectedUserForReset.colaborador_telefono ? (
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(selectedUserForReset.colaborador_telefono, resetShareMessage)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar por WhatsApp</span>
                </button>
              ) : <div />}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="px-3 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={isResetting}
                  onClick={handleConfirmReset}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-xs font-semibold shadow-md shadow-amber-500/20 cursor-pointer disabled:opacity-50"
                >
                  {isResetting ? 'Guardando...' : 'Aplicar Reseteo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPORTACIÓN MASIVA DE CUENTAS POR PLATAFORMA (EXCEL / CSV)          */}
      {/* ========================================================================= */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[92vh] flex flex-col">
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    Importación Masiva de Cuentas por Plataforma
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Carga múltiples cuentas de colaboradores mediante archivo Excel (.xlsx) o delimitado (.csv)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setSelectedFileForImport(null);
                  setImportPreviewData(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido Scrolleable */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
              {/* Tarjeta de Recomendación / Descargar Plantilla */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      ¿Aún no tienes el formato estructurado?
                    </p>
                    <p className="text-slate-500 dark:text-slate-400">
                      Descarga nuestra plantilla oficial con columnas obligatorias, catálogos y filas de ejemplo.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isDownloadingTemplate ? 'Descargando...' : 'Descargar Plantilla (.xlsx)'}</span>
                </button>
              </div>

              {/* Zona de Carga (Dropzone) */}
              <div className="relative">
                <input
                  type="file"
                  id="excel-file-upload-input"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!selectedFileForImport ? (
                  <label
                    htmlFor="excel-file-upload-input"
                    className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl bg-slate-50/50 dark:bg-slate-800/20 hover:bg-emerald-500/5 transition-all cursor-pointer text-center group"
                  >
                    <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform mb-3">
                      <Upload className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Haz clic para seleccionar o arrastra aquí tu archivo Excel
                    </p>
                    <p className="text-xs text-slate-400">
                      Formatos compatibles: Microsoft Excel (.xlsx, .xls) o archivo CSV (.csv)
                    </p>
                  </label>
                ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-xs">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white block text-sm">
                          {selectedFileForImport.name}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {(selectedFileForImport.size / 1024).toFixed(1)} KB • Archivo cargado
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label
                        htmlFor="excel-file-upload-input"
                        className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all"
                      >
                        Cambiar archivo
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFileForImport(null);
                          setImportPreviewData(null);
                        }}
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-xl transition-all cursor-pointer"
                        title="Quitar archivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Indicador de Carga del Preview */}
              {isLoadingPreview && (
                <div className="py-8 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin" />
                  <p className="text-xs font-medium animate-pulse">
                    Analizando filas y cotejando cuentas con la base de datos...
                  </p>
                </div>
              )}

              {/* Resultados de la Previsualización */}
              {importPreviewData && !isLoadingPreview && (
                <div className="space-y-4">
                  {/* Tarjetas de Métricas del Preview */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60">
                      <span className="text-slate-400 text-[11px] block">Total detectadas</span>
                      <span className="text-lg font-bold text-slate-800 dark:text-slate-200">
                        {importPreviewData.total_filas}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400">
                      <span className="text-emerald-600 dark:text-emerald-400/80 text-[11px] block">Nuevas (Crear)</span>
                      <span className="text-lg font-bold text-emerald-600 dark:text-emerald-300">
                        {importPreviewData.ready_count}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
                      <span className="text-amber-600 dark:text-amber-400/80 text-[11px] block">Existentes (Actualizar)</span>
                      <span className="text-lg font-bold text-amber-600 dark:text-amber-300">
                        {importPreviewData.update_count}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400">
                      <span className="text-red-600 dark:text-red-400/80 text-[11px] block">Incompletas / Error</span>
                      <span className="text-lg font-bold text-red-600 dark:text-red-300">
                        {importPreviewData.invalid_count}
                      </span>
                    </div>
                  </div>

                  {/* Selector de Modo de Sincronización */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block">
                      Política de Sincronización para Cuentas Existentes:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        importMode === 'crear_o_actualizar'
                          ? 'bg-white dark:bg-slate-800 border-cyan-500 text-slate-900 dark:text-white shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                      }`}>
                        <input
                          type="radio"
                          name="importMode"
                          value="crear_o_actualizar"
                          checked={importMode === 'crear_o_actualizar'}
                          onChange={() => setImportMode('crear_o_actualizar')}
                          className="mt-0.5 text-cyan-500 focus:ring-cyan-500"
                        />
                        <div>
                          <span className="font-semibold block">Actualizar datos existentes (Recomendado)</span>
                          <span className="text-[11px] text-slate-400">
                            Actualiza cargo, correo, teléfono y contraseña si coincide en Empresa, Plataforma y Usuario.
                          </span>
                        </div>
                      </label>

                      <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer ${
                        importMode === 'solo_nuevos'
                          ? 'bg-white dark:bg-slate-800 border-cyan-500 text-slate-900 dark:text-white shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                      }`}>
                        <input
                          type="radio"
                          name="importMode"
                          value="solo_nuevos"
                          checked={importMode === 'solo_nuevos'}
                          onChange={() => setImportMode('solo_nuevos')}
                          className="mt-0.5 text-cyan-500 focus:ring-cyan-500"
                        />
                        <div>
                          <span className="font-semibold block">Solo registrar cuentas nuevas</span>
                          <span className="text-[11px] text-slate-400">
                            Ignora los usuarios que ya existan en la plataforma sin modificar sus registros actuales.
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Filtro de la Tabla Preview */}
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Vista previa de datos a procesar:
                    </span>
                    <div className="flex items-center gap-1">
                      {(['todos', 'ready', 'update', 'invalid'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFilterPreviewStatus(st)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            filterPreviewStatus === st
                              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {st === 'todos' && `Todas (${importPreviewData.total_filas})`}
                          {st === 'ready' && `Nuevas (${importPreviewData.ready_count})`}
                          {st === 'update' && `Actualizar (${importPreviewData.update_count})`}
                          {st === 'invalid' && `Errores (${importPreviewData.invalid_count})`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tabla con scroll de las filas leídas */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Estado</th>
                          <th className="p-2.5">Empresa</th>
                          <th className="p-2.5">Plataforma</th>
                          <th className="p-2.5">Colaborador</th>
                          <th className="p-2.5">Usuario Login</th>
                          <th className="p-2.5">Contraseña</th>
                          <th className="p-2.5">Detalle</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                        {importPreviewData.rows
                          .filter(r => filterPreviewStatus === 'todos' || r.status === filterPreviewStatus)
                          .map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="p-2.5 font-mono text-[11px] text-slate-400">{row.index}</td>
                              <td className="p-2.5 whitespace-nowrap">
                                {row.status === 'ready' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <Check className="w-3 h-3" /> Nueva
                                  </span>
                                )}
                                {row.status === 'update' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    <RotateCcw className="w-3 h-3" /> Existente
                                  </span>
                                )}
                                {row.status === 'invalid' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                                    <AlertTriangle className="w-3 h-3" /> Error
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 font-medium whitespace-nowrap">{row.empresa || '-'}</td>
                              <td className="p-2.5 font-semibold text-cyan-600 dark:text-cyan-400 whitespace-nowrap">{row.plataforma || '-'}</td>
                              <td className="p-2.5 whitespace-nowrap">{row.colaborador_nombre || '-'}</td>
                              <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">{row.usuario_login || '-'}</td>
                              <td className="p-2.5 font-mono text-[11px] whitespace-nowrap">
                                {row.password_actual ? '••••••••' : <span className="text-slate-400 italic">(Autogenerar)</span>}
                              </td>
                              <td className="p-2.5 text-[11px] text-slate-500 dark:text-slate-400 max-w-xs truncate" title={row.status_message}>
                                {row.status_message}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer de Acciones del Modal */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <ShieldCheck className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Cifrado militar automático AES-256 en todas las contraseñas cargadas.</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsImportModalOpen(false);
                    setSelectedFileForImport(null);
                    setImportPreviewData(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!importPreviewData || isImporting || (importPreviewData.ready_count === 0 && importPreviewData.update_count === 0)}
                  onClick={handleConfirmImport}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-md shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Importando datos...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        Confirmar e Importar {importPreviewData ? (importPreviewData.ready_count + (importMode === 'crear_o_actualizar' ? importPreviewData.update_count : 0)) : 0} Cuentas
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: GENERADOR RÁPIDO DE CLAVES                                         */}
      {/* ========================================================================= */}
      {isGenModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span>Generador de Contraseñas Seguras</span>
              </h2>
              <button onClick={() => setIsGenModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center space-y-2">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-medium">Contraseña Generada</span>
              <div className="font-mono text-base font-bold text-[#00F0FF] select-all break-all tracking-wider">
                {generatedQuickPass}
              </div>
              <button
                onClick={() => handleCopyText(generatedQuickPass, 'Contraseña')}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs cursor-pointer transition-all shadow-md shadow-cyan-500/30"
              >
                {copiedId === 'gen-Contraseña' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId === 'gen-Contraseña' ? 'Copiada' : 'Copiar al portapapeles'}</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex justify-between font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <span>Longitud de caracteres:</span>
                  <span className="font-bold text-cyan-500">{genLength} caracteres</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="24"
                  value={genLength}
                  onChange={(e) => {
                    const l = Number(e.target.value);
                    setGenLength(l);
                    setGeneratedQuickPass(generatePassword(l, genIncludeSpecial, genIncludeNumbers));
                  }}
                  className="w-full accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={genIncludeSpecial}
                    onChange={(e) => {
                      setGenIncludeSpecial(e.target.checked);
                      setGeneratedQuickPass(generatePassword(genLength, e.target.checked, genIncludeNumbers));
                    }}
                    className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>Incluir caracteres especiales (!@#$%&*)</span>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={genIncludeNumbers}
                    onChange={(e) => {
                      setGenIncludeNumbers(e.target.checked);
                      setGeneratedQuickPass(generatePassword(genLength, genIncludeSpecial, e.target.checked));
                    }}
                    className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span>Incluir números (0-9)</span>
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setGeneratedQuickPass(generatePassword(genLength, genIncludeSpecial, genIncludeNumbers))}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Generar Otra</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsGenModalOpen(false);
                  handleOpenUserModal();
                  setUserFormData((prev) => ({ ...prev, password_actual: generatedQuickPass }));
                }}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold cursor-pointer shadow-md shadow-cyan-500/20"
              >
                + Usar y Registrar Usuario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREDENCIAL MAESTRA IT                                              */}
      {/* ========================================================================= */}
      {isCredModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-cyan-500" />
                <span>{editingCred ? 'Editar Credencial Maestra IT' : 'Registrar Credencial Maestra'}</span>
              </h2>
              <button onClick={() => setIsCredModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {empresas.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.nombre}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Marca / Sede</label>
                  <select
                    value={credFormData.marca_id}
                    onChange={(e) => setCredFormData({ ...credFormData, marca_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value={0}>General (Sin marca específica)</option>
                    {credFormSelectedEmpresaMarcas.map((m) => (
                      <option key={m.id} value={m.id}>{m.nombre}</option>
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Servicio</label>
                  <select
                    value={credFormData.tipo_servicio}
                    onChange={(e) => setCredFormData({ ...credFormData, tipo_servicio: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {TIPO_SERVICIOS_PRESET.filter((t) => t !== 'Todos').map((s) => (
                      <option key={s} value={s}>{s}</option>
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Usuario / Login Master *</label>
                  <input
                    type="text"
                    required
                    placeholder="ej. admin@marketingalterno.pe"
                    value={credFormData.usuario_login}
                    onChange={(e) => setCredFormData({ ...credFormData, usuario_login: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Contraseña Secreta *</label>
                    <button
                      type="button"
                      onClick={() => {
                        const generated = generatePassword(16);
                        setCredFormData({ ...credFormData, password_secret: generated });
                        if (onShowToast) onShowToast('Contraseña generada', 'info');
                      }}
                      className="text-cyan-500 hover:text-cyan-400 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Generar</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Contraseña"
                    value={credFormData.password_secret}
                    onChange={(e) => setCredFormData({ ...credFormData, password_secret: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Nivel de Cuenta</label>
                <select
                  value={credFormData.tipo_cuenta}
                  onChange={(e) => setCredFormData({ ...credFormData, tipo_cuenta: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="operativa">Operativa</option>
                  <option value="admin">Administrador</option>
                  <option value="master">Master / Root</option>
                  <option value="consulta">Solo Lectura</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Notas de Recuperación</label>
                <textarea
                  rows={2}
                  placeholder="ej. Claves de respaldo, puerto, etc."
                  value={credFormData.notas}
                  onChange={(e) => setCredFormData({ ...credFormData, notas: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setIsCredModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 cursor-pointer">
                  {editingCred ? 'Actualizar Credencial' : 'Guardar en Bóveda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PERMISOS GRANULARES                                                */}
      {/* ========================================================================= */}
      {isPermModalOpen && selectedCredForPerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-cyan-500" />
                  <span>Control de Permisos de Acceso</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Credencial: <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedCredForPerms.plataforma}</span>
                </p>
              </div>
              <button onClick={() => setIsPermModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
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
                <div key={userPerm.user_id} className="grid grid-cols-12 items-center px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <div className="col-span-6 truncate pr-2">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{userPerm.full_name}</p>
                    <span className="text-[10px] text-slate-400 capitalize">{userPerm.role} • @{userPerm.username}</span>
                  </div>

                  <div className="col-span-3 flex justify-center">
                    <input
                      type="checkbox"
                      checked={Boolean(userPerm.can_view)}
                      onChange={(e) => {
                        const updated = [...credPermissions];
                        updated[idx].can_view = e.target.checked;
                        if (!e.target.checked) updated[idx].can_edit = false;
                        setCredPermissions(updated);
                      }}
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                    />
                  </div>

                  <div className="col-span-3 flex justify-center">
                    <input
                      type="checkbox"
                      checked={Boolean(userPerm.can_edit)}
                      disabled={!userPerm.can_view}
                      onChange={(e) => {
                        const updated = [...credPermissions];
                        updated[idx].can_edit = e.target.checked;
                        setCredPermissions(updated);
                      }}
                      className="w-4 h-4 rounded text-cyan-500 focus:ring-cyan-500 border-slate-300 dark:border-slate-600 cursor-pointer disabled:opacity-30"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setIsPermModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer">
                Cancelar
              </button>
              <button type="button" disabled={savingPerms} onClick={handleSavePermissions} className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50">
                {savingPerms ? 'Guardando...' : 'Aplicar Permisos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ACCESO DIRECTO                                                     */}
      {/* ========================================================================= */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-cyan-500" />
                <span>{editingLink ? 'Editar Acceso Directo' : 'Nuevo Acceso Directo'}</span>
              </h2>
              <button onClick={() => setIsLinkModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Categoría</label>
                  <select
                    value={linkFormData.categoria}
                    onChange={(e) => setLinkFormData({ ...linkFormData, categoria: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    {CATEGORIAS_QUICKLINKS.filter((c) => c !== 'Todas').map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Visibilidad</label>
                  <select
                    value={linkFormData.visibilidad}
                    onChange={(e) => setLinkFormData({ ...linkFormData, visibilidad: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="personal">👤 Solo para mí</option>
                    <option value="equipo">👥 Compartido con Equipo</option>
                    {isAdminOrLeader && <option value="global">🌐 Global (Toda la Empresa)</option>}
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">Credenciales de acceso rápido (Opcional)</span>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    placeholder="Usuario / Email"
                    value={linkFormData.usuario}
                    onChange={(e) => setLinkFormData({ ...linkFormData, usuario: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Contraseña"
                    value={linkFormData.password}
                    onChange={(e) => setLinkFormData({ ...linkFormData, password: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button type="button" onClick={() => setIsLinkModalOpen(false)} className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 cursor-pointer">
                  {editingLink ? 'Actualizar' : 'Guardar Acceso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DESBLOQUEO DE BÓVEDA TI (PIN / CONTRASEÑA DE SESIÓN)              */}
      {/* ========================================================================= */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">Verificación de Seguridad</h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Desbloquea para ver y copiar</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsUnlockModalOpen(false);
                  setPendingAction(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Selector de Modo: PIN vs Contraseña */}
            {hasSecurityPin ? (
              <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockMode('pin');
                    setUnlockError('');
                  }}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    unlockMode === 'pin'
                      ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-[#00F0FF] shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  PIN de 4 Dígitos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnlockMode('password');
                    setUnlockError('');
                  }}
                  className={`py-1.5 rounded-lg transition-all cursor-pointer ${
                    unlockMode === 'password'
                      ? 'bg-white dark:bg-slate-700 text-cyan-600 dark:text-[#00F0FF] shadow-xs'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  Contraseña de Sesión
                </button>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>
                  Ingresa tu contraseña de sesión para desbloquear. Luego podrás configurar un PIN de 4 dígitos para un acceso más ágil.
                </p>
              </div>
            )}

            {unlockError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{unlockError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyUnlock} className="space-y-4">
              {unlockMode === 'pin' && hasSecurityPin ? (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5 text-center">
                    Ingresa tu PIN de Seguridad (4-8 dígitos)
                  </label>
                  <input
                    type="password"
                    maxLength={8}
                    required
                    autoFocus
                    placeholder="••••"
                    value={unlockPinInput}
                    onChange={(e) => setUnlockPinInput(e.target.value.replace(/\D/g, ''))}
                    className="w-full text-center text-2xl tracking-[0.5em] font-mono py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Contraseña de tu cuenta en Bitácora
                  </label>
                  <input
                    type="password"
                    required
                    autoFocus
                    placeholder="Tu contraseña de usuario"
                    value={unlockPasswordInput}
                    onChange={(e) => setUnlockPasswordInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Sesión activa por 5 minutos</span>
                <span className="font-mono">AES-256</span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsUnlockModalOpen(false);
                    setPendingAction(null);
                  }}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={unlocking}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
                >
                  {unlocking ? 'Verificando...' : 'Desbloquear Bóveda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURAR PIN DE SEGURIDAD                                        */}
      {/* ========================================================================= */}
      {isPinConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-black/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-4 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  <Key className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {hasSecurityPin ? 'Cambiar PIN de Bóveda' : 'Configurar PIN de Bóveda'}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Acceso rápido a contraseñas</p>
                </div>
              </div>
              <button
                onClick={() => setIsPinConfigModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pinConfigError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{pinConfigError}</span>
              </div>
            )}

            <form onSubmit={handleSavePin} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Contraseña de inicio de sesión actual *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Tu clave actual en Bitácora"
                  value={pinCurrentPass}
                  onChange={(e) => setPinCurrentPass(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nuevo PIN (4 a 8 dígitos numéricos) *
                </label>
                <input
                  type="password"
                  maxLength={8}
                  required
                  placeholder="ej. 1234"
                  value={pinNewPin}
                  onChange={(e) => setPinNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.4em] font-mono py-2 text-base rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Confirmar Nuevo PIN *
                </label>
                <input
                  type="password"
                  maxLength={8}
                  required
                  placeholder="Confirma el mismo PIN"
                  value={pinConfirmPin}
                  onChange={(e) => setPinConfirmPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.4em] font-mono py-2 text-base rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPinConfigModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPin}
                  className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-500/20 cursor-pointer disabled:opacity-50"
                >
                  {savingPin ? 'Guardando...' : 'Guardar PIN de Seguridad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
