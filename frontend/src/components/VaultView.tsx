import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  RefreshCw,
  Edit2,
  Trash2,
  Users,
  Sparkles,
  X,
  Send,
  Key,
  Smartphone,
  RotateCcw,
  Clock,
  Settings,
  ChevronDown,
  ChevronUp,
  Zap,
  FileSpreadsheet,
  Upload,
  Download,
} from 'lucide-react';
import {
  QuickLink,
  ItEmpresa,
  ItCredential,
  ItPlatformUser,
  ItPlataforma,
  ItCargo,
  User as UserType,
} from '../types';
import { api, getVaultToken, clearVaultToken } from '../services/api';
import { copyToClipboard } from '../utils/formatters';
import {
  generateCorporateEmail,
  generateCorporatePassword,
  generateStrongPlatformPassword,
  isMailPlatform,
  detectCorporateEntity,
  CorporateEntity,
} from '../utils/itAccountHelpers';
import { confirmDialog } from './DialogHost';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { generateVaultPassword } from './vault/VaultConstants';
import { VaultCatalogModal, CatalogTabType } from './vault/VaultCatalogModal';
import { VaultImportModal } from './vault/VaultImportModal';
import { VaultSecurityModals } from './vault/VaultSecurityModals';
import { VaultMasterCredsSection } from './vault/VaultMasterCredsSection';
import { VaultQuickLinksSection } from './vault/VaultQuickLinksSection';

interface VaultViewProps {
  currentUser?: UserType | null;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const VaultView: React.FC<VaultViewProps> = ({ currentUser, onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'vault' | 'links'>('users');

  // ================= CATÁLOGOS MAESTROS =================
  const [empresas, setEmpresas] = useState<ItEmpresa[]>([]);
  const [plataformasCatalog, setPlataformasCatalog] = useState<ItPlataforma[]>([]);
  const [cargosCatalog, setCargosCatalog] = useState<ItCargo[]>([]);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);
  const [catalogTab, setCatalogTab] = useState<CatalogTabType>('empresas');

  // ================= DIRECTORIO DE USUARIOS POR PLATAFORMA =================
  const [platformUsers, setPlatformUsers] = useState<ItPlatformUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [userSearch, setUserSearch] = useState<string>('');
  const [selectedUserEmpresaId, setSelectedUserEmpresaId] = useState<number | 'todas'>('todas');
  const [selectedUserPlataforma, setSelectedUserPlataforma] = useState<string>('todas');
  const [selectedUserEstado, setSelectedUserEstado] = useState<string>('todos');
  const [revealedUserPwIds, setRevealedUserPwIds] = useState<Record<number, boolean>>({});

  // Modales Directorio & Excel
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [editingPlatformUser, setEditingPlatformUser] = useState<ItPlatformUser | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<ItPlatformUser | null>(null);
  const [resetGeneratedPass, setResetGeneratedPass] = useState<string>('');
  const [resetShareMessage, setResetShareMessage] = useState<string>('');
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState<boolean>(false);
  const [isExportingAccounts, setIsExportingAccounts] = useState<boolean>(false);

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
  const [isCredModalOpen, setIsCredModalOpen] = useState<boolean>(false);
  const [isPermModalOpen, setIsPermModalOpen] = useState<boolean>(false);

  // ================= ACCESOS DIRECTOS =================
  const [links, setLinks] = useState<QuickLink[]>([]);
  const [loadingLinks, setLoadingLinks] = useState<boolean>(true);
  const [linkSearch, setLinkSearch] = useState<string>('');
  const [linkCategoria, setLinkCategoria] = useState<string>('Todas');
  const [linkFilterScope, setLinkFilterScope] = useState<'todos' | 'mis' | 'equipo' | 'global'>('todos');
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false);
  const [revealedLinkPwIds, setRevealedLinkPwIds] = useState<Record<number, boolean>>({});

  // ================= SEGURIDAD DE BÓVEDA TI (MODO SUDO / PIN) =================
  const [isVaultUnlocked, setIsVaultUnlocked] = useState<boolean>(false);
  const [unlockRemainingSeconds, setUnlockRemainingSeconds] = useState<number>(0);
  const [hasSecurityPin, setHasSecurityPin] = useState<boolean>(false);
  const [isSecurityBarExpanded, setIsSecurityBarExpanded] = useState<boolean>(false);
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

  // Contador de revelaciones por minuto
  const [recentRevealsTimestamps, setRecentRevealsTimestamps] = useState<number[]>([]);

  const anyVaultModalOpen =
    isCatalogModalOpen ||
    isUnlockModalOpen ||
    isPinConfigModalOpen ||
    isResetModalOpen ||
    isPermModalOpen ||
    isGenModalOpen ||
    isImportModalOpen ||
    isUserModalOpen ||
    isCredModalOpen ||
    isLinkModalOpen;

  useModalBehavior(anyVaultModalOpen, () => {
    if (isCatalogModalOpen) setIsCatalogModalOpen(false);
    else if (isUnlockModalOpen) {
      setIsUnlockModalOpen(false);
      setPendingAction(null);
    } else if (isPinConfigModalOpen) setIsPinConfigModalOpen(false);
    else if (isResetModalOpen) setIsResetModalOpen(false);
    else if (isPermModalOpen) setIsPermModalOpen(false);
    else if (isGenModalOpen) setIsGenModalOpen(false);
    else if (isImportModalOpen) setIsImportModalOpen(false);
    else if (isUserModalOpen) setIsUserModalOpen(false);
    else if (isCredModalOpen) setIsCredModalOpen(false);
    else if (isLinkModalOpen) setIsLinkModalOpen(false);
  });

  const isAdminOrLeader =
    currentUser?.role === 'admin' || currentUser?.role === 'lider' || Boolean(currentUser?.is_leader);

  const latestDataRef = useRef<{ users: ItPlatformUser[]; creds: ItCredential[]; links: QuickLink[] }>({
    users: [],
    creds: [],
    links: [],
  });
  const isUnlockedNow = () => Boolean(getVaultToken());
  const getUserPw = (id: number) => latestDataRef.current.users.find((x) => x.id === id)?.password_actual || '';
  const getCredPw = (id: number) => latestDataRef.current.creds.find((x) => x.id === id)?.password_secret || '';
  const getLinkPw = (id: number) => latestDataRef.current.links.find((x) => x.id === id)?.password || '';

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
      latestDataRef.current.users = res || [];
      setPlatformUsers(res || []);
    } catch (err) {
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
      latestDataRef.current.links = res || [];
      setLinks(res || []);
    } catch (err) {
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
      latestDataRef.current.creds = credsRes || [];
      setCredentials(credsRes || []);
    } catch (err) {
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

  const purgeSecretsFromMemory = () => {
    clearVaultToken();
    latestDataRef.current = {
      users: latestDataRef.current.users.map((u) => ({ ...u, password_actual: null, password_anterior: null })),
      creds: latestDataRef.current.creds.map((c) => ({ ...c, password_secret: null })),
      links: latestDataRef.current.links.map((l) => ({ ...l, password: l.password ? null : l.password })),
    };
    setPlatformUsers(latestDataRef.current.users);
    setCredentials(latestDataRef.current.creds);
    setLinks(latestDataRef.current.links);
  };

  useEffect(() => {
    if (!isVaultUnlocked || unlockRemainingSeconds <= 0) return;
    const interval = setInterval(() => {
      setUnlockRemainingSeconds((prev) => {
        if (prev <= 1) {
          setIsVaultUnlocked(false);
          setRevealedUserPwIds({});
          setRevealedCredPwIds({});
          setRevealedLinkPwIds({});
          purgeSecretsFromMemory();
          onShowToast?.('La sesión segura de la bóveda ha expirado', 'info');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isVaultUnlocked, unlockRemainingSeconds]);

  useEffect(() => {
    return () => clearVaultToken();
  }, []);

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
    purgeSecretsFromMemory();
    onShowToast?.('Bóveda bloqueada', 'info');
  };

  const handleExtendSession = () => {
    setPendingAction(null);
    setUnlockError('');
    setUnlockPinInput('');
    setUnlockPasswordInput('');
    setIsUnlockModalOpen(true);
  };

  const UNLOCK_WINDOW_SECONDS = 900;
  const unlockProgressPercent = isVaultUnlocked
    ? Math.min(100, Math.max(0, (unlockRemainingSeconds / UNLOCK_WINDOW_SECONDS) * 100))
    : 0;

  const refetchActiveTab = async () => {
    if (activeTab === 'users') await fetchPlatformUsers();
    else if (activeTab === 'vault') await fetchVaultData();
    else if (activeTab === 'links') await fetchLinks();
  };

  const requireVaultUnlock = (action: () => void): boolean => {
    if (!isUnlockedNow()) {
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
      onShowToast?.('Alerta de Seguridad: Se han consultado más de 12 contraseñas en el último minuto', 'error');
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
      setUnlockRemainingSeconds(res.expires_in || UNLOCK_WINDOW_SECONDS);
      setIsUnlockModalOpen(false);
      setUnlockPinInput('');
      setUnlockPasswordInput('');
      onShowToast?.(
        `Bóveda desbloqueada por ${Math.round((res.expires_in || UNLOCK_WINDOW_SECONDS) / 60)} minutos`,
        'success'
      );

      await refetchActiveTab();
      if (pendingAction) {
        const action = pendingAction;
        setPendingAction(null);
        action();
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
      onShowToast?.('PIN de seguridad configurado exitosamente', 'success');
    } catch (err: any) {
      setPinConfigError(err.message || 'Error al configurar PIN');
    } finally {
      setSavingPin(false);
    }
  };

  const handleCopyText = async (
    textOrGetter: string | null | undefined | (() => string),
    label: string,
    credId?: number,
    isPassword = false
  ) => {
    if (isPassword) {
      if (!requireVaultUnlock(() => handleCopyText(textOrGetter, label, credId, isPassword))) {
        return;
      }
      registerRevealAuditAndRateLimit();
    }
    const text = typeof textOrGetter === 'function' ? textOrGetter() : textOrGetter;
    if (!text) {
      if (isPassword) onShowToast?.('Este registro no tiene contraseña guardada', 'info');
      return;
    }

    const ok = await copyToClipboard(text);
    if (ok) {
      const key = `${credId || 'gen'}-${label}`;
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2500);

      if (isPassword) {
        onShowToast?.(`${label} copiada. Se eliminará del portapapeles en 30 segundos`, 'success');
        setTimeout(async () => {
          await copyToClipboard('');
        }, 30000);
      } else {
        onShowToast?.(`${label} copiado al portapapeles`, 'success');
      }

      if (credId && isPassword && currentUser?.id) {
        api.auditItCredential(credId, currentUser.id, 'copy_password');
      }
    } else {
      onShowToast?.(`Error al copiar ${label} al portapapeles`, 'error');
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

  const openCatalogModalAt = (tab: CatalogTabType) => {
    setCatalogTab(tab);
    setIsCatalogModalOpen(true);
  };

  // ================= USUARIOS DE PLATAFORMA =================
  const handleOpenUserModal = (user?: ItPlatformUser, overridePassword?: string) => {
    if (empresas.length === 0) {
      onShowToast?.('Primero debes crear al menos una empresa', 'info');
      openCatalogModalAt('empresas');
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
        password_actual: user.password_actual || '',
        estado: user.estado || 'activo',
        notas: user.notas || '',
      });
    } else {
      setEditingPlatformUser(null);
      const mktEmp = empresas.find((e) => /marketing\s*alterno/i.test(e.nombre));
      const defaultEmp = mktEmp || empresas[0];
      const zimbraPlat = plataformasCatalog.find((p) => /zimbra/i.test(p.nombre));
      const defaultPlat =
        selectedUserPlataforma !== 'todas'
          ? selectedUserPlataforma
          : zimbraPlat
          ? zimbraPlat.nombre
          : 'Zimbra';

      const initialEntity = detectCorporateEntity(defaultEmp?.nombre);
      setSelectedCorporateEntity(initialEntity);

      const autoPass =
        overridePassword ||
        (isMailPlatform(defaultPlat)
          ? generateCorporatePassword('')
          : generateStrongPlatformPassword(14));

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
      const label = entity === 'solopromo' ? 'Soporte Promocional' : entity === 'hp' ? 'HP' : 'Marketing Alterno';
      onShowToast?.(`Formato de correo actualizado para ${label}`, 'info');
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
    const passwordMissing = !editingPlatformUser && !(userFormData.password_actual || '').trim();
    if (
      !userFormData.empresa_id ||
      !userFormData.colaborador_nombre.trim() ||
      !userFormData.usuario_login.trim() ||
      passwordMissing
    ) {
      onShowToast?.('Empresa, Colaborador, Usuario y Contraseña son obligatorios', 'error');
      return;
    }

    try {
      if (editingPlatformUser) {
        await api.updateItPlatformUser(editingPlatformUser.id, {
          ...userFormData,
          marca_id: userFormData.marca_id ? Number(userFormData.marca_id) : undefined,
          updated_by: currentUser.id,
        });
        onShowToast?.('Cuenta de usuario actualizada', 'success');
      } else {
        await api.createItPlatformUser({
          ...userFormData,
          marca_id: userFormData.marca_id ? Number(userFormData.marca_id) : undefined,
          created_by: currentUser.id,
        });
        onShowToast?.('Usuario registrado con éxito en la plataforma', 'success');
      }
      setIsUserModalOpen(false);
      fetchPlatformUsers();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al guardar usuario', 'error');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!(await confirmDialog('¿Estás seguro de eliminar esta cuenta de usuario del directorio?'))) return;
    try {
      await api.deleteItPlatformUser(userId);
      onShowToast?.('Cuenta de usuario eliminada', 'info');
      fetchPlatformUsers();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al eliminar', 'error');
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
      onShowToast?.('Contraseña restablecida con éxito', 'success');
      setResetShareMessage(res.share_message);
      fetchPlatformUsers();
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al resetear', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const handleSendWhatsApp = (phone?: string, text?: string) => {
    if (!phone) {
      onShowToast?.('El colaborador no tiene teléfono registrado', 'info');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const encoded = encodeURIComponent(text || '');
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  // ================= OPERACIONES DE EXCEL =================
  const handleDownloadTemplate = async () => {
    try {
      setIsDownloadingTemplate(true);
      await api.downloadItPlatformUsersTemplate();
      onShowToast?.('Plantilla oficial de Excel descargada exitosamente', 'success');
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al descargar plantilla', 'error');
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  const handleExportAccounts = async () => {
    if (!requireVaultUnlock(() => handleExportAccounts())) return;
    try {
      setIsExportingAccounts(true);
      await api.exportItPlatformUsers({
        empresa_id: selectedUserEmpresaId === 'todas' ? undefined : selectedUserEmpresaId,
        plataforma: selectedUserPlataforma === 'todas' ? undefined : selectedUserPlataforma,
        estado: selectedUserEstado === 'todos' ? undefined : selectedUserEstado,
        search: userSearch,
        include_passwords: true,
      });
      onShowToast?.('Archivo Excel de cuentas generado exitosamente', 'success');
    } catch (err: any) {
      onShowToast?.(err.message || 'Error al exportar cuentas', 'error');
    } finally {
      setIsExportingAccounts(false);
    }
  };

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { todas: platformUsers.length };
    platformUsers.forEach((u) => {
      counts[u.plataforma] = (counts[u.plataforma] || 0) + 1;
    });
    return counts;
  }, [platformUsers]);

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

  // ================= OCULTAMIENTO INTELIGENTE DE COLUMNAS FILTRADAS =================
  const [autoHideFilteredCols, setAutoHideFilteredCols] = useState<boolean>(true);
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

  return (
    <div className="space-y-5 pb-20 animate-fadeIn">
      {/* ================= CABECERA PRINCIPAL ================= */}
      <div className="bg-white dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-sky-500/25">
              <KeyRound className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Accesos & Bóveda
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdminOrLeader && (
              <button
                type="button"
                onClick={() => openCatalogModalAt('empresas')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E222D] dark:hover:bg-[#252B3B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                title="Configurar catálogos de Empresas, Marcas, Plataformas y Cargos"
              >
                <Settings className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                <span>Catálogos</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const pass = generateVaultPassword(genLength, genIncludeSpecial, genIncludeNumbers);
                setGeneratedQuickPass(pass);
                setIsGenModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25 text-xs font-semibold transition-colors cursor-pointer"
              title="Generar contraseñas seguras"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Generar Clave</span>
            </button>

            <div className="flex items-center bg-slate-100 dark:bg-[#1A1E29] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08] overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Cuentas ({platformUsers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vault')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'vault'
                    ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Bóveda ({credentials.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('links')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  activeTab === 'links'
                    ? 'bg-white dark:bg-[#222735] text-sky-600 dark:text-sky-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
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
        <div
          className={`rounded-2xl px-4 py-2.5 border transition-colors shadow-xs flex items-center justify-between gap-3 flex-wrap ${
            isVaultUnlocked
              ? 'bg-emerald-50/70 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
              : 'bg-white dark:bg-[#161922] border-slate-200/80 dark:border-white/[0.08]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`p-1.5 rounded-lg border shrink-0 ${
                isVaultUnlocked
                  ? 'bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-400'
                  : 'bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-400'
              }`}
            >
              {isVaultUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
              {isVaultUnlocked ? 'Bóveda Desbloqueada' : 'Bóveda Protegida'}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border hidden sm:inline-block bg-slate-100 dark:bg-[#1E222D] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10">
              Cifrado Fernet
            </span>
            {isVaultUnlocked && (
              <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 tabular-nums">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                {formatTimer(unlockRemainingSeconds)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            {isVaultUnlocked ? (
              <>
                <button
                  type="button"
                  onClick={handleExtendSession}
                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#1E222D] hover:bg-slate-100 dark:hover:bg-[#252B3B] text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200 dark:border-white/10 cursor-pointer transition-colors"
                  title="Renovar la sesión segura (pide tu PIN)"
                >
                  Renovar
                </button>
                <button
                  type="button"
                  onClick={handleLockVaultNow}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-semibold border border-rose-200 dark:border-rose-500/25 cursor-pointer transition-colors"
                  title="Bloquear bóveda de inmediato"
                >
                  Bloquear
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPendingAction(null);
                  setUnlockError('');
                  setUnlockPinInput('');
                  setUnlockPasswordInput('');
                  setIsUnlockModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
              >
                <Unlock className="w-3.5 h-3.5" />
                <span>Desbloquear</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPinConfigError('');
                setPinCurrentPass('');
                setPinNewPin('');
                setPinConfirmPin('');
                setIsPinConfigModalOpen(true);
              }}
              className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center"
              title={hasSecurityPin ? 'Cambiar PIN' : 'Configurar PIN'}
            >
              <Key className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsSecurityBarExpanded(true)}
              className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center"
              title="Expandir detalles de seguridad"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`rounded-2xl border transition-colors shadow-xs relative overflow-hidden ${
            isVaultUnlocked
              ? 'bg-emerald-50/60 dark:bg-[#161922] border-emerald-200 dark:border-emerald-500/30'
              : 'bg-white dark:bg-[#161922] border-slate-200/80 dark:border-white/[0.08]'
          }`}
        >
          <div className="p-4 sm:p-5 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5">
                <div
                  className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
                    isVaultUnlocked
                      ? 'bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/35 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-200 dark:border-amber-500/25 text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {isVaultUnlocked ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>

                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                      {isVaultUnlocked
                        ? 'Bóveda Desbloqueada — Sesión Segura Activa'
                        : 'Bóveda Protegida — Modo Seguro'}
                    </h2>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                        isVaultUnlocked
                          ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30'
                          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isVaultUnlocked ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      />
                      {isVaultUnlocked ? 'Desbloqueada' : 'Protegida'}
                    </span>

                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-slate-100 dark:bg-[#1E222D] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10">
                      Cifrado Fernet
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                    {isVaultUnlocked
                      ? 'Las contraseñas maestras y de plataformas pueden consultarse y copiarse. Por política de seguridad, la bóveda se bloqueará automáticamente al expirar el tiempo de sesión.'
                      : 'Las contraseñas se guardan cifradas y el servidor no las entrega hasta que desbloquees con tu PIN o tu contraseña. Cada consulta queda registrada.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-end sm:self-center shrink-0">
                {isVaultUnlocked ? (
                  <>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-mono font-bold tabular-nums">
                      <Timer className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Auto-bloqueo: {formatTimer(unlockRemainingSeconds)}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handleExtendSession}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E222D] dark:hover:bg-[#252B3B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                      title="Renovar la sesión segura (pide tu PIN)"
                    >
                      Renovar
                    </button>

                    <button
                      type="button"
                      onClick={handleLockVaultNow}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/25 text-xs font-semibold transition-colors cursor-pointer"
                      title="Bloquear inmediatamente y ofuscar contraseñas"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Bloquear Ahora</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingAction(null);
                      setUnlockError('');
                      setUnlockPinInput('');
                      setUnlockPasswordInput('');
                      setIsUnlockModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Desbloquear Bóveda</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPinConfigError('');
                    setPinCurrentPass('');
                    setPinNewPin('');
                    setPinConfirmPin('');
                    setIsPinConfigModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E222D] dark:hover:bg-[#252B3B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                  title="Configurar o cambiar tu PIN de 4 dígitos para desbloqueo rápido"
                >
                  <Key className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>{hasSecurityPin ? 'Cambiar PIN' : 'Configurar PIN'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsSecurityBarExpanded(false)}
                  className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer flex items-center justify-center"
                  title="Minimizar barra de seguridad"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>

            {isVaultUnlocked && (
              <div className="pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 text-sky-500" /> Tiempo restante de sesión
                  </span>
                  <span className="font-mono font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                    {formatTimer(unlockRemainingSeconds)} ({Math.round(unlockProgressPercent)}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-[#1E222D] rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${
                      unlockRemainingSeconds <= 60
                        ? 'bg-rose-500'
                        : unlockRemainingSeconds <= 120
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${unlockProgressPercent}%` }}
                  />
                </div>
              </div>
            )}

            <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2.5 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Cifrado Fernet (AES-128 + HMAC-SHA256)</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-sky-500" />
                  <span>{hasSecurityPin ? 'PIN activo' : 'Autenticación por contraseña'}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cada consulta queda auditada</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 1: DIRECTORIO DE USUARIOS POR PLATAFORMA                          */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-white dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              <div className="flex flex-wrap items-center gap-2 flex-1">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar colaborador, usuario o email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedUserEmpresaId}
                    onChange={(e) =>
                      setSelectedUserEmpresaId(e.target.value === 'todas' ? 'todas' : Number(e.target.value))
                    }
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

                <select
                  value={selectedUserEstado}
                  onChange={(e) => setSelectedUserEstado(e.target.value)}
                  className="px-3 py-2 text-xs sm:text-sm rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="todos">Todos los Estados</option>
                  <option value="activo">Activos</option>
                  <option value="por_crear">Por Crear (Alta Previa)</option>
                  <option value="suspendido">Suspendidos</option>
                  <option value="baja">De Baja</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={isDownloadingTemplate}
                  title="Descargar plantilla oficial de Excel con ejemplos para rellenar"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E222D] dark:hover:bg-[#252B3B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="hidden sm:inline">
                    {isDownloadingTemplate ? 'Descargando...' : 'Descargar Plantilla'}
                  </span>
                  <span className="sm:hidden">Plantilla</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAccounts}
                  disabled={isExportingAccounts || platformUsers.length === 0}
                  title="Exportar todas las cuentas mostradas a Excel (.xlsx)"
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#1E222D] dark:hover:bg-[#252B3B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-sky-500" />
                  <span className="hidden sm:inline">{isExportingAccounts ? 'Exportando...' : 'Exportar (.xlsx)'}</span>
                  <span className="sm:hidden">Exportar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  title="Carga masiva de cuentas desde un archivo Excel o CSV"
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/25 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Importar Excel</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenUserModal()}
                  className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Registrar Cuenta</span>
                </button>
              </div>
            </div>

            {/* Chips de Plataforma */}
            <div className="pt-2 border-t border-slate-100 dark:border-white/[0.06] flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-400 text-[11px] font-medium mr-1 flex items-center gap-1 shrink-0">
                <Tag className="w-3.5 h-3.5" /> Plataforma:
              </span>
              <button
                type="button"
                onClick={() => setSelectedUserPlataforma('todas')}
                className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedUserPlataforma === 'todas'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#222735]'
                }`}
              >
                Todas ({platformUsers.length})
              </button>

              {displayPlatforms.map((plat) => {
                const count = platformCounts[plat] || 0;
                return (
                  <button
                    key={plat}
                    type="button"
                    onClick={() => setSelectedUserPlataforma(plat)}
                    className={`px-3 py-1 rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      selectedUserPlataforma === plat
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#222735]'
                    }`}
                  >
                    {plat} ({count})
                  </button>
                );
              })}
            </div>

            {hasActiveUserFilters && (
              <div className="pt-3 border-t border-slate-100 dark:border-white/[0.06] flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1 text-[11px] uppercase tracking-wider mr-1">
                    <Filter className="w-3 h-3 text-sky-500" />
                    Filtros activos:
                  </span>

                  {selectedUserEmpresaId !== 'todas' && selectedUserEmpresaObj && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white font-semibold text-xs"
                      style={{ backgroundColor: selectedUserEmpresaObj.color || '#0284C7' }}
                    >
                      <span>{selectedUserEmpresaObj.nombre}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedUserEmpresaId('todas')}
                        title="Quitar filtro de empresa"
                        className="text-white/80 hover:text-white cursor-pointer ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}

                  {selectedUserPlataforma !== 'todas' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/30 font-semibold text-xs">
                      <span>{selectedUserPlataforma}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedUserPlataforma('todas')}
                        title="Quitar filtro de plataforma"
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}

                  {selectedUserEstado !== 'todos' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-[#222735] text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-white/10 font-semibold text-xs">
                      <span>
                        {selectedUserEstado === 'activo'
                          ? 'Activos'
                          : selectedUserEstado === 'por_crear'
                          ? 'Por Crear'
                          : selectedUserEstado === 'suspendido'
                          ? 'Suspendidos'
                          : 'De Baja'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedUserEstado('todos')}
                        title="Quitar filtro de estado"
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}

                  {userSearch.trim() && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-[#222735] text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-white/10 font-semibold text-xs">
                      <span>"{userSearch}"</span>
                      <button
                        type="button"
                        onClick={() => setUserSearch('')}
                        title="Limpiar búsqueda"
                        className="hover:text-rose-500 cursor-pointer ml-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  )}

                  {hiddenUserColsList.length > 0 && autoHideFilteredCols && (
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium flex items-center gap-1 bg-slate-100 dark:bg-[#1A1E29] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10">
                      <EyeOff className="w-3 h-3 text-slate-400" />
                      <span>
                        {hiddenUserColsList.length}{' '}
                        {hiddenUserColsList.length === 1 ? 'columna oculta' : 'columnas ocultas'} (
                        {hiddenUserColsList.join(', ')})
                      </span>
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setAutoHideFilteredCols(!autoHideFilteredCols)}
                    title={
                      autoHideFilteredCols
                        ? 'Mostrar todas las columnas'
                        : 'Auto-ocultar columnas repetidas por filtro'
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      autoHideFilteredCols
                        ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/25'
                        : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10'
                    }`}
                  >
                    {autoHideFilteredCols ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Ocultar redundantes: ON</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver todas las cols</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserEmpresaId('todas');
                      setSelectedUserPlataforma('todas');
                      setSelectedUserEstado('todos');
                      setUserSearch('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border border-rose-200 dark:border-rose-500/25 transition-colors cursor-pointer"
                    title="Restablecer todos los filtros"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpiar filtros</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tabla de Usuarios */}
          {loadingUsers ? (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
              <p className="text-sm">Cargando directorio de cuentas por plataforma...</p>
            </div>
          ) : platformUsers.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-[#161922] border border-dashed border-slate-300 dark:border-white/15 rounded-2xl p-6">
              <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
              <p className="text-base font-semibold text-slate-700 dark:text-slate-300">
                No se encontraron usuarios en esta plataforma o criterio
              </p>
              <button
                type="button"
                onClick={() => handleOpenUserModal()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/20 text-xs font-semibold border border-sky-200 dark:border-sky-500/25 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Registrar colaborador</span>
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#161922] border border-slate-200/80 dark:border-white/[0.08] rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 dark:bg-[#1A1E29] text-slate-500 dark:text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-200/80 dark:border-white/[0.08]">
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
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {platformUsers.map((u) => {
                      const isPwRev = Boolean(revealedUserPwIds[u.id]);

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors">
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
                                      ? 'bg-amber-600'
                                      : 'bg-rose-500'
                                  }`}
                                  title={`Estado: ${u.estado}`}
                                />
                              )}
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {u.colaborador_nombre}
                              </div>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {u.colaborador_cargo || 'Sin cargo asignado'}
                            </div>
                            {!showEmpresaCol && u.marca_nombre && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                {u.marca_nombre}
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
                                className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white inline-block mb-0.5"
                                style={{ backgroundColor: u.empresa_color || '#0284C7' }}
                              >
                                {u.empresa_nombre}
                              </span>
                              {u.marca_nombre && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">{u.marca_nombre}</div>
                              )}
                            </td>
                          )}

                          {showPlataformaCol && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="font-medium text-slate-800 dark:text-slate-200">{u.plataforma}</span>
                            </td>
                          )}

                          <td className="py-3 px-4 font-mono text-xs">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-700 dark:text-slate-300 font-semibold select-all">
                                {u.usuario_login}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopyText(u.usuario_login, 'Usuario', u.id, false)}
                                title="Copiar usuario"
                                className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1 rounded-md text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer inline-flex items-center justify-center"
                              >
                                {copiedId === `${u.id}-Usuario` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            {u.colaborador_email && (
                              <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                {u.colaborador_email}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 font-mono text-xs whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 bg-slate-100 dark:bg-[#1A1E29] px-2 py-1 rounded-lg border border-slate-200/80 dark:border-white/[0.08]">
                              <span
                                className={`font-semibold ${
                                  isPwRev ? 'text-amber-600 dark:text-amber-300 select-all' : 'text-slate-400'
                                }`}
                              >
                                {isPwRev ? u.password_actual : '••••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleRevealUserPw(u.id)}
                                title={isPwRev ? 'Ocultar' : 'Ver por 10s'}
                                className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1 rounded-md text-slate-400 hover:text-amber-500 cursor-pointer inline-flex items-center justify-center"
                              >
                                {isPwRev ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyText(() => getUserPw(u.id), 'Contraseña', u.id, true)}
                                title="Copiar clave"
                                className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-1 rounded-md text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer inline-flex items-center justify-center"
                              >
                                {copiedId === `${u.id}-Contraseña` ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
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
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25'
                                    : u.estado === 'por_crear'
                                    ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/25'
                                    : u.estado === 'suspendido'
                                    ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
                                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/25'
                                }`}
                              >
                                {u.estado === 'activo'
                                  ? 'Activa'
                                  : u.estado === 'por_crear'
                                  ? 'Por Crear'
                                  : u.estado === 'suspendido'
                                  ? 'Suspendida'
                                  : 'Baja'}
                              </span>
                            </td>
                          )}

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() => handleOpenResetModal(u)}
                                className="min-h-[36px] sm:min-h-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-600 dark:hover:bg-amber-600 text-amber-700 dark:text-amber-300 hover:text-white text-xs font-semibold border border-amber-200 dark:border-amber-500/25 transition-colors cursor-pointer"
                                title="Resetear contraseña y preparar mensaje de soporte"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Resetear</span>
                              </button>

                              {u.colaborador_telefono && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const send = () => {
                                      const msg = `Hola ${u.colaborador_nombre}, tus credenciales de ${u.plataforma} son:\nUsuario: ${u.usuario_login}\nClave: ${getUserPw(u.id)}`;
                                      handleSendWhatsApp(u.colaborador_telefono, msg);
                                    };
                                    if (requireVaultUnlock(send)) send();
                                  }}
                                  className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 transition-colors cursor-pointer inline-flex items-center justify-center"
                                  title="Enviar datos por WhatsApp"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenUserModal(u)}
                                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer inline-flex items-center justify-center"
                                title="Editar cuenta"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {isAdminOrLeader && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id)}
                                  className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer inline-flex items-center justify-center"
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

      {/* PESTAÑA 2 + MODALES BÓVEDA MAESTRA */}
      <VaultMasterCredsSection
        isActive={activeTab === 'vault'}
        credentials={credentials}
        loadingVault={loadingVault}
        empresas={empresas}
        plataformasCatalog={plataformasCatalog}
        vaultSearch={vaultSearch}
        setVaultSearch={setVaultSearch}
        selectedEmpresaId={selectedEmpresaId}
        setSelectedEmpresaId={setSelectedEmpresaId}
        selectedMarcaId={selectedMarcaId}
        setSelectedMarcaId={setSelectedMarcaId}
        selectedTipoServicio={selectedTipoServicio}
        setSelectedTipoServicio={setSelectedTipoServicio}
        autoHideFilteredCols={autoHideFilteredCols}
        revealedCredPwIds={revealedCredPwIds}
        copiedId={copiedId}
        isAdminOrLeader={isAdminOrLeader}
        currentUserId={currentUser?.id}
        onToggleRevealCred={handleToggleRevealCred}
        onCopyText={handleCopyText}
        getCredPw={getCredPw}
        isCredModalOpen={isCredModalOpen}
        setIsCredModalOpen={setIsCredModalOpen}
        isPermModalOpen={isPermModalOpen}
        setIsPermModalOpen={setIsPermModalOpen}
        onVaultChanged={fetchVaultData}
        onOpenCatalogModal={openCatalogModalAt}
        onShowToast={onShowToast}
      />

      {/* PESTAÑA 3 + MODAL ACCESOS DIRECTOS */}
      <VaultQuickLinksSection
        isActive={activeTab === 'links'}
        links={links}
        loadingLinks={loadingLinks}
        linkSearch={linkSearch}
        setLinkSearch={setLinkSearch}
        linkCategoria={linkCategoria}
        setLinkCategoria={setLinkCategoria}
        linkFilterScope={linkFilterScope}
        setLinkFilterScope={setLinkFilterScope}
        autoHideFilteredCols={autoHideFilteredCols}
        revealedLinkPwIds={revealedLinkPwIds}
        copiedId={copiedId}
        isAdminOrLeader={isAdminOrLeader}
        currentUserId={currentUser?.id}
        onToggleRevealLinkPw={handleToggleRevealLinkPw}
        onCopyText={handleCopyText}
        getLinkPw={getLinkPw}
        isLinkModalOpen={isLinkModalOpen}
        setIsLinkModalOpen={setIsLinkModalOpen}
        onLinksChanged={fetchLinks}
        onShowToast={onShowToast}
      />

      {/* MODAL: REGISTRAR / EDITAR USUARIO EN PLATAFORMA */}
      {isUserModalOpen && (
        <div
          onClick={() => setIsUserModalOpen(false)}
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
                <Users className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                <span>{editingPlatformUser ? 'Editar Cuenta de Usuario' : 'Registrar Cuenta en Plataforma'}</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Empresa *</label>
                    {isAdminOrLeader && (
                      <button
                        type="button"
                        onClick={() => openCatalogModalAt('empresas')}
                        className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] font-semibold cursor-pointer"
                      >
                        + Gestionar
                      </button>
                    )}
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
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Plataforma *</label>
                    {isAdminOrLeader && (
                      <button
                        type="button"
                        onClick={() => openCatalogModalAt('plataformas')}
                        className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] font-semibold cursor-pointer"
                      >
                        + Gestionar
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    list="plat-options"
                    placeholder="Zimbra Mail, Active Directory..."
                    value={userFormData.plataforma}
                    onChange={(e) => handlePlataformaInputChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  placeholder="ej. Luis Cordova Lopez"
                  value={userFormData.colaborador_nombre}
                  onChange={(e) => handleColaboradorNameChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Cargo / Área</label>
                    {isAdminOrLeader && (
                      <button
                        type="button"
                        onClick={() => openCatalogModalAt('cargos')}
                        className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] font-semibold cursor-pointer"
                      >
                        + Gestionar
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    list="cargos-options"
                    placeholder="Selecciona o escribe puesto..."
                    value={userFormData.colaborador_cargo}
                    onChange={(e) => setUserFormData({ ...userFormData, colaborador_cargo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                      <span className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold">
                        Formato{' '}
                        {selectedCorporateEntity === 'solopromo'
                          ? 'Solopromo'
                          : selectedCorporateEntity === 'hp'
                          ? 'HP'
                          : 'Marketing'}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="ej. lcordova@marketing-alterno.com"
                    value={userFormData.usuario_login}
                    onChange={(e) =>
                      setUserFormData({
                        ...userFormData,
                        usuario_login: e.target.value,
                        colaborador_email: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-xs"
                  />

                  {isMailPlatform(userFormData.plataforma) && (
                    <div className="mt-1.5 space-y-1">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        Formato por entidad:
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {(['marketing_alterno', 'solopromo', 'hp'] as CorporateEntity[]).map((entity) => (
                          <button
                            key={entity}
                            type="button"
                            onClick={() => handleSelectCorporateEntity(entity)}
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-colors cursor-pointer ${
                              selectedCorporateEntity === entity
                                ? 'bg-sky-600 text-white border-sky-600'
                                : 'bg-slate-100 dark:bg-[#1A1E29] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:bg-slate-200 dark:hover:bg-[#222735]'
                            }`}
                          >
                            {entity === 'marketing_alterno'
                              ? 'Marketing Alterno'
                              : entity === 'solopromo'
                              ? 'Solopromo'
                              : 'HP'}
                          </button>
                        ))}
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
                              onShowToast?.('Contraseña corporativa generada', 'info');
                            }}
                            className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Corp</span>
                          </button>
                          <span className="text-slate-300 dark:text-slate-600">·</span>
                          <button
                            type="button"
                            onClick={() => {
                              const pass = generateStrongPlatformPassword(14);
                              setUserFormData({ ...userFormData, password_actual: pass });
                              onShowToast?.('Contraseña aleatoria generada', 'info');
                            }}
                            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-[11px] font-medium cursor-pointer"
                          >
                            Aleatoria
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            const pass = generateStrongPlatformPassword(14);
                            setUserFormData({ ...userFormData, password_actual: pass });
                            onShowToast?.('Contraseña segura generada', 'info');
                          }}
                          className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Clave Segura</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <input
                    type="text"
                    required={!editingPlatformUser}
                    placeholder={editingPlatformUser ? 'Dejar vacío para conservar clave actual' : 'Clave'}
                    value={userFormData.password_actual || ''}
                    onChange={(e) => setUserFormData({ ...userFormData, password_actual: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Estado de la Cuenta
                  </label>
                  <select
                    value={userFormData.estado}
                    onChange={(e) => setUserFormData({ ...userFormData, estado: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
                  >
                    <option value="activo">Activa (Ya creada en plataforma)</option>
                    <option value="por_crear">Por Crear (Alta previa / Pendiente)</option>
                    <option value="suspendido">Suspendida temporalmente</option>
                    <option value="baja">De Baja (Ex-colaborador)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-slate-700 dark:text-slate-300">Marca / Sede</label>
                    {isAdminOrLeader && (
                      <button
                        type="button"
                        onClick={() => openCatalogModalAt('empresas')}
                        className="text-sky-600 dark:text-sky-400 hover:underline text-[11px] font-semibold cursor-pointer"
                      >
                        + Gestionar
                      </button>
                    )}
                  </div>
                  <select
                    value={userFormData.marca_id}
                    onChange={(e) => setUserFormData({ ...userFormData, marca_id: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value={0}>General (Sin marca específica)</option>
                    {formSelectedEmpresaMarcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
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
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#1E222D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 text-xs"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-200/80 dark:border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  {editingPlatformUser ? 'Actualizar Cuenta' : 'Guardar en Directorio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GESTIÓN DE CATÁLOGOS TI */}
      <VaultCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        initialTab={catalogTab}
        empresas={empresas}
        plataformasCatalog={plataformasCatalog}
        cargosCatalog={cargosCatalog}
        onCatalogsChanged={loadCatalogs}
        onShowToast={onShowToast}
      />

      {/* MODAL: IMPORTACIÓN EXCEL / CSV */}
      <VaultImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        currentUserId={currentUser?.id}
        isDownloadingTemplate={isDownloadingTemplate}
        onDownloadTemplate={handleDownloadTemplate}
        onImported={fetchPlatformUsers}
        onShowToast={onShowToast}
      />

      {/* MODALES DE SEGURIDAD, GENERADOR Y RESETEO */}
      <VaultSecurityModals
        isUnlockModalOpen={isUnlockModalOpen}
        onCloseUnlock={() => {
          setIsUnlockModalOpen(false);
          setPendingAction(null);
        }}
        hasSecurityPin={hasSecurityPin}
        unlockMode={unlockMode}
        setUnlockMode={setUnlockMode}
        unlockPinInput={unlockPinInput}
        setUnlockPinInput={setUnlockPinInput}
        unlockPasswordInput={unlockPasswordInput}
        setUnlockPasswordInput={setUnlockPasswordInput}
        unlockError={unlockError}
        setUnlockError={setUnlockError}
        unlocking={unlocking}
        onVerifyUnlock={handleVerifyUnlock}
        isPinConfigModalOpen={isPinConfigModalOpen}
        onClosePinConfig={() => setIsPinConfigModalOpen(false)}
        pinCurrentPass={pinCurrentPass}
        setPinCurrentPass={setPinCurrentPass}
        pinNewPin={pinNewPin}
        setPinNewPin={setPinNewPin}
        pinConfirmPin={pinConfirmPin}
        setPinConfirmPin={setPinConfirmPin}
        pinConfigError={pinConfigError}
        savingPin={savingPin}
        onSavePin={handleSavePin}
        isGenModalOpen={isGenModalOpen}
        onCloseGen={() => setIsGenModalOpen(false)}
        genLength={genLength}
        setGenLength={setGenLength}
        genIncludeSpecial={genIncludeSpecial}
        setGenIncludeSpecial={setGenIncludeSpecial}
        genIncludeNumbers={genIncludeNumbers}
        setGenIncludeNumbers={setGenIncludeNumbers}
        generatedQuickPass={generatedQuickPass}
        setGeneratedQuickPass={setGeneratedQuickPass}
        copiedId={copiedId}
        onCopyText={handleCopyText}
        onUseGeneratedPassForUser={(pass) => {
          setIsGenModalOpen(false);
          handleOpenUserModal(undefined, pass);
        }}
        isResetModalOpen={isResetModalOpen}
        onCloseReset={() => setIsResetModalOpen(false)}
        selectedUserForReset={selectedUserForReset}
        resetGeneratedPass={resetGeneratedPass}
        setResetGeneratedPass={setResetGeneratedPass}
        resetShareMessage={resetShareMessage}
        setResetShareMessage={setResetShareMessage}
        isResetting={isResetting}
        onConfirmReset={handleConfirmReset}
        onSendWhatsApp={handleSendWhatsApp}
      />
    </div>
  );
};
