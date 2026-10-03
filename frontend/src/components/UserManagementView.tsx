import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  FolderPlus,
  Edit2,
  Trash2,
  Check,
  X,
  Star,
  UserCheck,
  UserX,
  Briefcase,
  AlertCircle,
  Settings,
  Clock,
  User as UserIcon,
  Image as ImageIcon,
  Globe,
  Upload,
  Palette,
  RefreshCw,
  Sparkles,
  Monitor,
  Layers,
  Eye,
  LogIn,
  CalendarCheck,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Search,
} from 'lucide-react';
import { User, Team, UserRole, SystemSettings, UserDelegation } from '../types';
import { api } from '../services/api';
import { EmptyState } from './EmptyState';

interface UserManagementViewProps {
  teams: Team[];
  onRefreshTeams: () => void;
  systemSettings?: SystemSettings;
  onUpdateSettings?: (newSettings: SystemSettings) => void;
  currentUser?: User | null;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  teams,
  onRefreshTeams,
  systemSettings,
  onUpdateSettings,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'usuarios' | 'equipos' | 'delegaciones' | 'configuracion'>('usuarios');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Delegaciones / Usuarios de Apoyo State
  const [delegations, setDelegations] = useState<UserDelegation[]>([]);
  const [loadingDelegations, setLoadingDelegations] = useState(false);
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [savingDelegation, setSavingDelegation] = useState(false);
  const [delegationForm, setDelegationForm] = useState<{
    delegate_user_id: number | '';
    target_user_ids: number[];
    motivo: string;
  }>({
    delegate_user_id: '',
    target_user_ids: [],
    motivo: 'Apoyo en registro de tareas',
  });
  const [delegationModalSearch, setDelegationModalSearch] = useState('');
  const [delegationModalTeamFilter, setDelegationModalTeamFilter] = useState<number | 'all'>('all');
  const [delegationToDelete, setDelegationToDelete] = useState<UserDelegation | null>(null);
  const [showDeleteDelegationModal, setShowDeleteDelegationModal] = useState(false);
  const [delegateToRevokeAll, setDelegateToRevokeAll] = useState<{ id: number; name: string } | null>(null);
  const [showRevokeAllModal, setShowRevokeAllModal] = useState(false);

  // Settings & Branding State
  const [defaultHoraInicio, setDefaultHoraInicio] = useState(systemSettings?.hora_inicio_default || '08:30');
  const [systemTitle, setSystemTitle] = useState(systemSettings?.system_title || 'Bitácora Diaria de Actividades | Marketing Alterno Perú');
  const [logoUrl, setLogoUrl] = useState(systemSettings?.logo_url || '');
  const [faviconUrl, setFaviconUrl] = useState(systemSettings?.favicon_url || '');
  const [loginBgUrl, setLoginBgUrl] = useState(systemSettings?.login_bg_url || '');
  const [loginBgType, setLoginBgType] = useState<'gradient' | 'image'>(systemSettings?.login_bg_type || 'gradient');
  const [loginHeading, setLoginHeading] = useState(systemSettings?.login_heading || 'Bitácora Oficial');
  const [loginSubheading, setLoginSubheading] = useState(systemSettings?.login_subheading || 'Marketing Alterno Perú');
  const [systemMode, setSystemMode] = useState<'production' | 'demo'>(systemSettings?.system_mode || 'production');
  const [showDemoLogins, setShowDemoLogins] = useState(systemSettings?.show_demo_logins === 'true');
  const [cleaningData, setCleaningData] = useState(false);
  const [seedingData, setSeedingData] = useState(false);
  const [showCleanConfirmModal, setShowCleanConfirmModal] = useState(false);

  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const loginBgInputRef = useRef<HTMLInputElement>(null);

  // User form modal state
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'operador' as UserRole,
    team_id: '' as number | '',
  });

  // Team form modal state
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [teamForm, setTeamForm] = useState({
    nombre: '',
    descripcion: '',
    lider_id: '' as number | '',
    member_ids: [] as number[],
  });

  // Delete / deactivate user modal state
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const [feedbackMsg, setFeedbackMsg] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await api.getAllAdminUsers();
      if (Array.isArray(list) && list.length > 0) {
        setUsers(list);
      } else if (users.length === 0 && Array.isArray(list)) {
        setUsers(list);
      }
    } catch (e) {
      console.error('Error loading admin users', e);
    } finally {
      setLoading(false);
    }
  };

  const loadDelegations = async () => {
    setLoadingDelegations(true);
    try {
      const data = await api.getDelegations();
      setDelegations(data);
    } catch (e) {
      console.error('Error loading delegations:', e);
    } finally {
      setLoadingDelegations(false);
    }
  };

  // Agrupar delegaciones por colaborador de apoyo
  const groupedDelegations = React.useMemo(() => {
    const map = new Map<number, {
      delegate_user_id: number;
      delegate_name: string;
      delegate_username: string;
      motivo: string;
      assigned_by_name?: string;
      created_at?: string;
      targets: {
        delegation_id: number;
        target_user_id: number;
        target_name: string;
        target_username?: string;
        team_name?: string;
      }[];
    }>();

    delegations.forEach((d) => {
      const existing = map.get(d.delegate_user_id);
      const targetItem = {
        delegation_id: d.id,
        target_user_id: d.target_user_id,
        target_name: d.target_name || `Usuario #${d.target_user_id}`,
        target_username: d.target_username,
        team_name: d.team_name || undefined,
      };

      if (existing) {
        if (!existing.targets.some((t) => t.target_user_id === d.target_user_id)) {
          existing.targets.push(targetItem);
        }
      } else {
        map.set(d.delegate_user_id, {
          delegate_user_id: d.delegate_user_id,
          delegate_name: d.delegate_name || `Usuario #${d.delegate_user_id}`,
          delegate_username: d.delegate_username || '',
          motivo: d.motivo || 'Apoyo general',
          assigned_by_name: d.assigned_by_name,
          created_at: d.created_at,
          targets: [targetItem],
        });
      }
    });

    return Array.from(map.values());
  }, [delegations]);

  useEffect(() => {
    loadUsers();
    loadDelegations();
    api.getSettings().then((s) => {
      if (s) {
        if (s.hora_inicio_default) setDefaultHoraInicio(s.hora_inicio_default);
        if (s.system_title) setSystemTitle(s.system_title);
        if (s.logo_url !== undefined) setLogoUrl(s.logo_url);
        if (s.favicon_url !== undefined) setFaviconUrl(s.favicon_url);
        if (s.login_bg_url !== undefined) setLoginBgUrl(s.login_bg_url);
        if (s.login_bg_type) setLoginBgType(s.login_bg_type);
        if (s.login_heading) setLoginHeading(s.login_heading);
        if (s.login_subheading) setLoginSubheading(s.login_subheading);
        if (s.system_mode) setSystemMode(s.system_mode as 'production' | 'demo');
        if (s.show_demo_logins !== undefined) setShowDemoLogins(s.show_demo_logins === 'true');
      }
    }).catch(() => {});
  }, []);

  const handleFileUpload = async (file: File, target: 'logo' | 'favicon' | 'loginBg') => {
    setUploadingTarget(target);
    try {
      const uploaded = await api.uploadFile(file);
      if (target === 'logo') setLogoUrl(uploaded.url);
      if (target === 'favicon') setFaviconUrl(uploaded.url);
      if (target === 'loginBg') {
        setLoginBgUrl(uploaded.url);
        setLoginBgType('image');
      }
      setFeedbackMsg('Recurso cargado correctamente. Haz clic en "Guardar Configuración General" para aplicar.');
      setTimeout(() => setFeedbackMsg(''), 4000);
    } catch (err: any) {
      alert(err.message || 'Error al subir el archivo');
    } finally {
      setUploadingTarget(null);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const payload: Partial<SystemSettings> = {
        hora_inicio_default: defaultHoraInicio,
        system_title: systemTitle.trim(),
        logo_url: logoUrl,
        favicon_url: faviconUrl,
        login_bg_url: loginBgUrl,
        login_bg_type: loginBgType,
        login_heading: loginHeading.trim(),
        login_subheading: loginSubheading.trim(),
        system_mode: systemMode,
        show_demo_logins: showDemoLogins ? 'true' : 'false',
      };
      const updated = await api.updateSettings(payload);
      if (onUpdateSettings) {
        onUpdateSettings(updated);
      }
      setFeedbackMsg('¡Identidad visual, modo de sistema y ajustes guardados con éxito!');
      setTimeout(() => setFeedbackMsg(''), 4000);
    } catch (err: any) {
      setFeedbackMsg(err.message || 'Error al guardar la configuración');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCleanProductionData = async () => {
    setCleaningData(true);
    try {
      const res = await api.cleanProductionData();
      setFeedbackMsg(res.message);
      setSystemMode('production');
      setShowDemoLogins(false);
      setShowCleanConfirmModal(false);
      loadUsers();
      onRefreshTeams();
      if (onUpdateSettings) {
        const updated = await api.getSettings();
        onUpdateSettings(updated);
      }
      setTimeout(() => setFeedbackMsg(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Error al purgar datos');
    } finally {
      setCleaningData(false);
    }
  };

  const handleSeedDemoData = async () => {
    setSeedingData(true);
    try {
      const res = await api.seedDemoData();
      setFeedbackMsg(res.message);
      setSystemMode('demo');
      setShowDemoLogins(true);
      loadUsers();
      onRefreshTeams();
      if (onUpdateSettings) {
        const updated = await api.getSettings();
        onUpdateSettings(updated);
      }
      setTimeout(() => setFeedbackMsg(''), 5000);
    } catch (err: any) {
      alert(err.message || 'Error al cargar datos de demostración');
    } finally {
      setSeedingData(false);
    }
  };

  const handleOpenNewUser = () => {
    setEditingUserId(null);
    setUserForm({
      username: '',
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role: 'operador',
      team_id: '',
    });
    setShowUserModal(true);
  };

  const handleEditUser = (u: User) => {
    setEditingUserId(u.id);
    setUserForm({
      username: u.username,
      full_name: u.full_name,
      email: u.email || '',
      phone: u.phone || '',
      password: '',
      role: u.role,
      team_id: u.team_id || '',
    });
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        await api.updateUser(editingUserId, {
          username: userForm.username.trim(),
          full_name: userForm.full_name.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim(),
          role: userForm.role,
          team_id: userForm.team_id ? Number(userForm.team_id) : null,
          password: userForm.password ? userForm.password : undefined,
        });
        setFeedbackMsg('Usuario actualizado correctamente');
      } else {
        await api.createUser({
          username: userForm.username.trim(),
          full_name: userForm.full_name.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim(),
          role: userForm.role,
          team_id: userForm.team_id ? Number(userForm.team_id) : null,
          password: userForm.password || '123456',
        });
        setFeedbackMsg('Usuario creado con éxito');
      }
      setShowUserModal(false);
      loadUsers();
      onRefreshTeams();
      setTimeout(() => setFeedbackMsg(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Error al guardar usuario');
    }
  };

  const handleToggleActiveUser = async (u: User) => {
    try {
      await api.deleteUser(u.id, false);
      loadUsers();
      setFeedbackMsg(Boolean(u.is_active) ? `Usuario @${u.username} desactivado` : `Usuario @${u.username} reactivado`);
      setTimeout(() => setFeedbackMsg(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Error al actualizar estado del usuario');
    }
  };

  const handleOpenDeleteModal = (u: User) => {
    setUserToDelete(u);
    setShowDeleteUserModal(true);
  };

  const handleConfirmDeleteUser = async (permanent: boolean) => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await api.deleteUser(userToDelete.id, permanent);
      loadUsers();
      onRefreshTeams();
      setShowDeleteUserModal(false);
      setUserToDelete(null);
      setFeedbackMsg(permanent ? 'Usuario eliminado definitivamente del sistema' : 'Estado del usuario actualizado');
      setTimeout(() => setFeedbackMsg(''), 3500);
    } catch (err: any) {
      alert(err.message || 'Error al procesar la eliminación');
    } finally {
      setDeletingUser(false);
    }
  };

  // Delegation / Apoyo actions
  const handleOpenNewDelegation = (preselectedDelegateId?: number) => {
    const initialTargets: number[] = [];
    if (preselectedDelegateId) {
      delegations
        .filter((d) => d.delegate_user_id === preselectedDelegateId)
        .forEach((d) => initialTargets.push(d.target_user_id));
    }
    setDelegationForm({
      delegate_user_id: preselectedDelegateId || '',
      target_user_ids: initialTargets,
      motivo: 'Apoyo en registro de tareas',
    });
    setDelegationModalSearch('');
    setDelegationModalTeamFilter('all');
    setShowDelegationModal(true);
  };

  const handleSaveDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegationForm.delegate_user_id) {
      alert('Debes seleccionar al colaborador que brindará el apoyo');
      return;
    }
    if (delegationForm.target_user_ids.length === 0) {
      alert('Debes seleccionar al menos un colaborador titular para brindarle apoyo');
      return;
    }
    setSavingDelegation(true);
    try {
      const res = await api.createDelegation({
        delegate_user_id: Number(delegationForm.delegate_user_id),
        target_user_ids: delegationForm.target_user_ids,
        motivo: delegationForm.motivo.trim() || 'Apoyo en registro de tareas',
        assigned_by: currentUser?.id || 1,
      });
      setFeedbackMsg(res.message || `${delegationForm.target_user_ids.length} colaborador(es) asignado(s) exitosamente`);
      setShowDelegationModal(false);
      loadDelegations();
      setTimeout(() => setFeedbackMsg(''), 3500);
    } catch (err: any) {
      alert(err.message || 'Error al guardar asignaciones de apoyo');
    } finally {
      setSavingDelegation(false);
    }
  };

  const handleConfirmDeleteDelegation = async () => {
    if (!delegationToDelete) return;
    try {
      await api.deleteDelegation(delegationToDelete.id);
      setFeedbackMsg('Asignación de apoyo revocada exitosamente');
      setShowDeleteDelegationModal(false);
      setDelegationToDelete(null);
      loadDelegations();
      setTimeout(() => setFeedbackMsg(''), 3500);
    } catch (err: any) {
      alert(err.message || 'Error al revocar apoyo');
    }
  };

  const handleConfirmRevokeAllDelegations = async () => {
    if (!delegateToRevokeAll) return;
    try {
      await api.deleteDelegationsByDelegate(delegateToRevokeAll.id);
      setFeedbackMsg(`Se revocaron todas las asignaciones de apoyo de ${delegateToRevokeAll.name}`);
      setShowRevokeAllModal(false);
      setDelegateToRevokeAll(null);
      loadDelegations();
      setTimeout(() => setFeedbackMsg(''), 3500);
    } catch (err: any) {
      alert(err.message || 'Error al revocar asignaciones');
    }
  };

  // Team actions
  const handleOpenNewTeam = () => {
    setEditingTeamId(null);
    setTeamForm({ nombre: '', descripcion: '', lider_id: '', member_ids: [] });
    setShowTeamModal(true);
  };

  const handleEditTeam = (t: Team) => {
    setEditingTeamId(t.id);
    const existingMemberIds = (t.members || []).map((m) => m.id);
    const usersInTeam = users.filter((u) => u.team_id === t.id).map((u) => u.id);
    const allTMembers = Array.from(new Set([...existingMemberIds, ...usersInTeam]));
    setTeamForm({
      nombre: t.nombre,
      descripcion: t.descripcion || '',
      lider_id: t.lider_id || '',
      member_ids: allTMembers,
    });
    setShowTeamModal(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTeamId) {
        await api.updateTeam(editingTeamId, {
          nombre: teamForm.nombre,
          descripcion: teamForm.descripcion,
          lider_id: teamForm.lider_id ? Number(teamForm.lider_id) : null,
          member_ids: teamForm.member_ids,
        });
        setFeedbackMsg('Equipo y asignación de colaboradores actualizados');
      } else {
        await api.createTeam({
          nombre: teamForm.nombre,
          descripcion: teamForm.descripcion,
          lider_id: teamForm.lider_id ? Number(teamForm.lider_id) : null,
          member_ids: teamForm.member_ids,
        });
        setFeedbackMsg('Equipo creado con colaboradores asignados');
      }
      setShowTeamModal(false);
      onRefreshTeams();
      loadUsers();
      setTimeout(() => setFeedbackMsg(''), 3000);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteTeam = async (id: number) => {
    if (window.confirm('¿Deseas eliminar este equipo? Sus miembros quedarán sin equipo asignado.')) {
      await api.deleteTeam(id);
      onRefreshTeams();
      loadUsers();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="saas-card p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-mint-50 dark:bg-mint-950/40 text-[#00A88B] dark:text-[#00C9A7] flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Gestión de Usuarios y Equipos
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Administración de cuentas, roles, permisos y asignación de líderes de equipo
            </p>
          </div>
        </div>

        {/* Tab switcher & action buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="bg-slate-100 dark:bg-[#161722] p-1 rounded-full border border-slate-200/80 dark:border-[#252636] flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab('usuarios')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'usuarios'
                  ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Usuarios ({users.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('equipos')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'equipos'
                  ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Equipos ({teams.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('delegaciones')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'delegaciones'
                  ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Usuarios de Apoyo ({delegations.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('configuracion')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                activeTab === 'configuracion'
                  ? 'bg-[#00F0FF] text-slate-950 font-extrabold shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Configuración</span>
            </button>
          </div>

          {activeTab === 'usuarios' && (
            <button
              type="button"
              onClick={handleOpenNewUser}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 px-4 py-2 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nuevo Usuario</span>
            </button>
          )}

          {activeTab === 'equipos' && (
            <button
              type="button"
              onClick={handleOpenNewTeam}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 px-4 py-2 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Nuevo Equipo</span>
            </button>
          )}

          {activeTab === 'delegaciones' && (
            <button
              type="button"
              onClick={() => handleOpenNewDelegation()}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 px-4 py-2 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Asignar Apoyo</span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-mint-50 dark:bg-mint-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[#00A88B] dark:text-[#00C9A7] text-xs rounded-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-[#00C9A7]" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* TAB 1: USUARIOS */}
      {activeTab === 'usuarios' && (
        <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-4 sm:p-6 shadow-sm overflow-hidden">
          {/* DESKTOP TABLE VIEW (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-[#252636] pb-2">
                  <th className="pb-2">Usuario</th>
                  <th className="pb-2">Nombre Completo</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">WhatsApp / Tel</th>
                  <th className="pb-2">Rol</th>
                  <th className="pb-2">Equipo</th>
                  <th className="pb-2">Estado</th>
                  <th className="pb-2 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#252636]/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-[#161722]/70 transition-colors">
                    <td className="py-3 font-bold text-slate-800 dark:text-slate-200">@{u.username}</td>
                    <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">{u.full_name}</td>
                    <td className="py-3 text-slate-500 dark:text-slate-400">{u.email || '—'}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {u.phone ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                          {u.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          u.role === 'admin'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                            : u.role === 'lider'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                            : 'bg-mint-50 dark:bg-mint-950/40 text-[#00A88B] dark:text-[#00C9A7] border border-emerald-200 dark:border-emerald-800/60'
                        }`}
                      >
                        {u.role === 'admin' ? (
                          <>
                            <Shield className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                            <span>Admin</span>
                          </>
                        ) : u.role === 'lider' ? (
                          <>
                            <Star className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Líder</span>
                          </>
                        ) : (
                          <>
                            <UserIcon className="w-3 h-3 text-[#00C9A7]" />
                            <span>Operador</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{u.team_name || 'Sin asignar'}</td>
                    <td className="py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          u.is_active ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40' : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#161722]'
                        }`}
                      >
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditUser(u)}
                          className="p-1.5 text-slate-400 hover:text-[#00F0FF] hover:bg-slate-100 dark:hover:bg-[#161722] rounded-full cursor-pointer transition-colors"
                          title="Editar usuario (usuario, nombre, clave, rol)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {u.username !== 'admin' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleActiveUser(u)}
                              className={`p-1.5 rounded-full cursor-pointer transition-colors ${
                                Boolean(u.is_active)
                                  ? 'text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                                  : 'text-amber-500 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                              }`}
                              title={Boolean(u.is_active) ? 'Suspender / Desactivar acceso' : 'Reactivar acceso'}
                            >
                              {Boolean(u.is_active) ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full cursor-pointer transition-colors"
                              title="Eliminar usuario definitivamente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS VIEW (< 768px) */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-[#252636]/60">
            {users.map((u) => (
              <div key={`m-user-${u.id}`} className="py-3.5 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#00F0FF]/15 border border-[#00F0FF]/30 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center text-xs font-black shrink-0">
                      {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {u.full_name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        @{u.username}
                      </div>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      u.role === 'admin'
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                        : u.role === 'lider'
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60'
                        : 'bg-mint-50 dark:bg-mint-950/40 text-[#00A88B] dark:text-[#00C9A7] border border-emerald-200 dark:border-emerald-800/60'
                    }`}
                  >
                    {u.role === 'admin' ? 'Admin' : u.role === 'lider' ? 'Líder' : 'Operador'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] bg-slate-100 dark:bg-[#1A1C29] px-2 py-0.5 rounded-md font-semibold text-slate-700 dark:text-slate-300">
                      {u.team_name || 'Sin equipo'}
                    </span>
                    {u.phone && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                        {u.phone}
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        u.is_active ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-[#161722] text-slate-400'
                      }`}
                    >
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditUser(u)}
                      className="p-2 text-slate-400 hover:text-[#00F0FF] hover:bg-slate-100 dark:hover:bg-[#161722] rounded-full cursor-pointer transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                      title="Editar usuario"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {u.username !== 'admin' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleActiveUser(u)}
                          className="p-2 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-[#161722] rounded-full cursor-pointer transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                          title={Boolean(u.is_active) ? 'Suspender acceso' : 'Reactivar acceso'}
                        >
                          {Boolean(u.is_active) ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(u)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-[#161722] rounded-full cursor-pointer transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {users.length === 0 && (
            <EmptyState
              icon={Users}
              title="Sin usuarios registrados"
              description="No hay colaboradores en la lista de administración."
              actionText="Nuevo Usuario"
              onAction={handleOpenNewUser}
              className="mt-4"
            />
          )}
        </div>
      )}

      {/* TAB 2: EQUIPOS */}
      {activeTab === 'equipos' && (
        teams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((t) => (
              <div
                key={t.id}
                className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-5 flex flex-col justify-between shadow-sm hover:border-[#00F0FF]/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">{t.nombre}</h3>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditTeam(t)}
                        className="p-1.5 text-slate-400 hover:text-[#00F0FF] hover:bg-slate-100 dark:hover:bg-[#161722] rounded-full cursor-pointer transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteTeam(t.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.descripcion || 'Sin descripción'}</p>

                  {/* Leader Badge */}
                  <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-3 mb-3 flex items-center gap-2 text-xs">
                    <Star className="w-4 h-4 text-amber-600 dark:text-amber-400 fill-amber-400 dark:fill-amber-500 shrink-0" />
                    <div>
                      <div className="text-[10px] uppercase font-bold text-amber-900 dark:text-amber-300">
                        Líder de Equipo
                      </div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">
                        {t.lider_nombre || 'Sin líder asignado'}
                      </div>
                    </div>
                  </div>

                  {/* Members list */}
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                      Miembros ({t.members_count || 0})
                    </div>
                    <div className="space-y-1">
                      {t.members && t.members.length > 0 ? (
                        t.members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-xs py-1 px-2.5 rounded-full bg-slate-50 dark:bg-[#161722] border border-slate-200/60 dark:border-[#252636] text-slate-700 dark:text-slate-300"
                          >
                            <span className="font-medium">{m.full_name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">@{m.username}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 dark:text-slate-500 italic">Sin colaboradores asignados</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Briefcase}
            title="Sin equipos creados"
            description="Crea un equipo de trabajo para asignar colaboradores y un líder responsable."
            actionText="Nuevo Equipo"
            onAction={handleOpenNewTeam}
          />
        )
      )}

      {/* TAB 3: CONFIGURACIÓN GLOBAL, IDENTIDAD Y LOGIN */}
      {activeTab === 'configuracion' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl pb-10">
          {/* Inputs de archivo ocultos */}
          <input
            type="file"
            ref={logoInputRef}
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'logo');
            }}
          />
          <input
            type="file"
            ref={faviconInputRef}
            accept="image/x-icon,image/png,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'favicon');
            }}
          />
          <input
            type="file"
            ref={loginBgInputRef}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileUpload(e.target.files[0], 'loginBg');
            }}
          />

          {feedbackMsg && (
            <div className="flex items-center gap-2.5 p-3.5 bg-mint-50 border border-mint-200 text-[#00A88B] text-xs font-semibold rounded-2xl shadow-sm animate-in fade-in">
              <Check className="w-4 h-4 shrink-0" />
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* CARD 0: MODO DEL SISTEMA & ENTORNO */}
          <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-6 shadow-sm">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100 dark:border-[#252636] gap-4 flex-wrap">
              <div className="flex items-start gap-3.5">
                <div className={`p-2.5 rounded-2xl shrink-0 border ${
                  systemMode === 'production'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-500/30'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                      Modo del Sistema y Entorno
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                      systemMode === 'production'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    }`}>
                      {systemMode === 'production' ? '● Producción' : '⚡ Demostración'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Define si la plataforma opera para el equipo real de la empresa o en modo demostración para pruebas.
                  </p>
                </div>
              </div>

              {/* Botón selector de modo */}
              <div className="flex items-center bg-slate-100 dark:bg-[#161722] p-1 rounded-full border border-slate-200 dark:border-[#252636]">
                <button
                  type="button"
                  onClick={() => {
                    setSystemMode('production');
                    setShowDemoLogins(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    systemMode === 'production'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Producción</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSystemMode('demo');
                    setShowDemoLogins(true);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    systemMode === 'demo'
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Demostración</span>
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {/* Checkbox accesos rápidos */}
              <label className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-[#161722] border border-slate-200/80 dark:border-[#252636] cursor-pointer hover:bg-slate-100/70 dark:hover:bg-[#1C1D2A] transition-colors">
                <input
                  type="checkbox"
                  checked={showDemoLogins}
                  onChange={(e) => setShowDemoLogins(e.target.checked)}
                  className="w-4 h-4 rounded text-[#00F0FF] focus:ring-[#00F0FF] dark:bg-[#13141F] dark:border-[#252636]"
                />
                <div className="flex-1">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Mostrar accesos rápidos para demostración en la pantalla de Login
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                    Muestra los botones de un clic (Admin, Líder, Analista) en la pantalla de inicio de sesión. Desmárcalo en producción para que sólo se ingrese con usuario y contraseña válidos.
                  </span>
                </div>
              </label>

              {/* Acciones de Base de Datos y Purga */}
              <div className="pt-3 border-t border-slate-100 dark:border-[#252636] flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Limpieza y Purga de Datos
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Vacía las bitácoras y colaboradores de prueba para dejar el sistema impecable en producción con únicamente el Administrador.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCleanConfirmModal(true)}
                    disabled={cleaningData || seedingData}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{cleaningData ? 'Purgando...' : 'Limpiar datos demo (Solo Admin)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSeedDemoData}
                    disabled={cleaningData || seedingData}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#161722] hover:bg-slate-200 dark:hover:bg-[#1C1D2A] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#252636] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${seedingData ? 'animate-spin' : ''}`} />
                    <span>{seedingData ? 'Cargando demo...' : 'Restaurar datos demo'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 1: IDENTIDAD VISUAL Y MARCA */}
          <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-6 shadow-sm">
            <div className="flex items-start gap-3.5 mb-5 pb-4 border-b border-slate-100 dark:border-[#252636]">
              <div className="p-2.5 rounded-2xl bg-cyan-50 dark:bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] shrink-0 border border-[#00F0FF]/30">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Identidad Visual y Marca
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Personaliza el nombre institucional de la plataforma, el logotipo oficial y el favicon visible en la pestaña del navegador.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Título del Sistema */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Título de la Aplicación (Título de Pestaña y Cabecera)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={systemTitle}
                    onChange={(e) => setSystemTitle(e.target.value)}
                    placeholder="Ej. Bitácora Diaria de Actividades | Marketing Alterno Perú"
                    className="w-full px-4 py-2.5 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#161722] border border-slate-200 dark:border-[#252636] rounded-2xl focus:border-[#00F0FF] dark:focus:border-[#00F0FF] focus:bg-white dark:focus:bg-[#161722] focus:ring-1 focus:ring-[#00F0FF]/30 outline-none transition-all"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Se reflejará en la etiqueta &lt;title&gt; del navegador y en la barra lateral del sistema.
                </p>
              </div>

              {/* Grid 2 Columnas: Logo y Favicon */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                {/* Logotipo */}
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-[#161722]/80 border border-slate-200/80 dark:border-[#252636] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        Logotipo Corporativo
                      </label>
                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => setLogoUrl('')}
                          className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                        >
                          Quitar logo
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      Recomendado: SVG o PNG con transparencia (alto máx 48px).
                    </p>

                    {/* Caja de vista previa del logo */}
                    <div className="h-20 rounded-xl bg-white dark:bg-[#13141F] border border-dashed border-slate-200 dark:border-[#252636] flex items-center justify-center p-3 mb-3">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo Preview"
                          className="max-h-14 max-w-full object-contain"
                          onError={() => {}}
                        />
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400 text-xs">
                          <CalendarCheck className="w-6 h-6 text-[#00F0FF]" />
                          <span className="font-medium text-slate-500 dark:text-slate-400">Logo por defecto (Icono)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={uploadingTarget === 'logo'}
                      onClick={() => logoInputRef.current?.click()}
                      className="w-full btn-pill-outline py-2 text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingTarget === 'logo' ? 'Subiendo logo...' : 'Subir Imagen de Logo'}</span>
                    </button>
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="O ingresa URL directa del logo..."
                      className="w-full px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-[#13141F] border border-slate-200 dark:border-[#252636] rounded-xl focus:border-[#00F0FF] outline-none"
                    />
                  </div>
                </div>

                {/* Favicon con Simulador de Pestaña */}
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-[#161722]/80 border border-slate-200/80 dark:border-[#252636] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Globe className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        Favicon (Icono de Pestaña)
                      </label>
                      {faviconUrl && (
                        <button
                          type="button"
                          onClick={() => setFaviconUrl('')}
                          className="text-[11px] font-semibold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                        >
                          Restablecer
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                      Recomendado: Archivo .ico o .png cuadrado de 32x32px.
                    </p>

                    {/* Simulador de pestaña de navegador */}
                    <div className="rounded-xl bg-slate-200/70 dark:bg-[#1A1C29] p-2 mb-3">
                      <div className="bg-white dark:bg-[#13141F] rounded-t-lg px-3 py-1.5 flex items-center gap-2 border-b border-slate-100 dark:border-[#252636] shadow-xs max-w-xs">
                        {faviconUrl ? (
                          <img
                            src={faviconUrl}
                            alt="Favicon"
                            className="w-4 h-4 object-contain rounded-xs shrink-0"
                            onError={() => {}}
                          />
                        ) : (
                          <Globe className="w-4 h-4 text-[#00F0FF] shrink-0" />
                        )}
                        <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                          {systemTitle.length > 24 ? systemTitle.substring(0, 24) + '...' : systemTitle}
                        </span>
                        <X className="w-3 h-3 text-slate-400 ml-auto shrink-0" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled={uploadingTarget === 'favicon'}
                      onClick={() => faviconInputRef.current?.click()}
                      className="w-full btn-pill-outline py-2 text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingTarget === 'favicon' ? 'Subiendo favicon...' : 'Subir Archivo Favicon'}</span>
                    </button>
                    <input
                      type="text"
                      value={faviconUrl}
                      onChange={(e) => setFaviconUrl(e.target.value)}
                      placeholder="O ingresa URL del favicon..."
                      className="w-full px-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 bg-white dark:bg-[#13141F] border border-slate-200 dark:border-[#252636] rounded-xl focus:border-[#00F0FF] outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 2: PERSONALIZACIÓN DE PANTALLA DE LOGIN */}
          <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-6 shadow-sm">
            <div className="flex items-start gap-3.5 mb-5 pb-4 border-b border-slate-100 dark:border-[#252636]">
              <div className="p-2.5 rounded-2xl bg-cyan-50 dark:bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] shrink-0 border border-[#00F0FF]/30">
                <LogIn className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Personalización de Pantalla de Login
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Elige entre el degradado corporativo moderno o un wallpaper con imagen de fondo personalizada.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Selector de Tipo de Fondo */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Tipo de Fondo para Iniciar Sesión
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-md">
                  <button
                    type="button"
                    onClick={() => setLoginBgType('gradient')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      loginBgType === 'gradient'
                        ? 'border-[#00F0FF] bg-[#00F0FF]/10 shadow-xs'
                        : 'border-slate-200 dark:border-[#252636] hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#161722]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0B0C13] via-[#161722] to-[#00F0FF]/30 shrink-0 border border-[#252636] shadow-xs" />
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Obsidian & Cyan</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Diseño limpio y cibernético</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLoginBgType('image')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      loginBgType === 'image'
                        ? 'border-[#00F0FF] bg-[#00F0FF]/10 shadow-xs'
                        : 'border-slate-200 dark:border-[#252636] hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-[#161722]'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1A1C29] flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0 border border-slate-200 dark:border-[#252636] shadow-xs">
                      <ImageIcon className="w-4 h-4 text-[#00F0FF]" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">Wallpaper / Foto</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Imagen personalizada o preset</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Si es imagen, controles de carga y presets */}
              {loginBgType === 'image' && (
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-[#161722] border border-slate-200 dark:border-[#252636] space-y-4 animate-in fade-in">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-1.5">
                      Imagen de Fondo (Subir o URL directa)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        disabled={uploadingTarget === 'loginBg'}
                        onClick={() => loginBgInputRef.current?.click()}
                        className="bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] text-slate-950 font-bold py-2 px-4 rounded-full text-xs flex items-center justify-center gap-2 cursor-pointer shrink-0 shadow-sm hover:brightness-110"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingTarget === 'loginBg' ? 'Subiendo wallpaper...' : 'Subir Wallpaper'}</span>
                      </button>
                      <input
                        type="text"
                        value={loginBgUrl}
                        onChange={(e) => setLoginBgUrl(e.target.value)}
                        placeholder="https://ejemplo.com/fondo.jpg"
                        className="flex-1 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 bg-white dark:bg-[#13141F] border border-slate-200 dark:border-[#252636] rounded-xl focus:border-[#00F0FF] outline-none"
                      />
                    </div>
                  </div>

                  {/* Galería de Presets sugeridos */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">
                      O selecciona uno de nuestros fondos empresariales recomendados:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        {
                          name: 'Oficina Moderna',
                          url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80',
                        },
                        {
                          name: 'Minimal Urbano',
                          url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=80',
                        },
                        {
                          name: 'Equipo & Espacio',
                          url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1600&q=80',
                        },
                        {
                          name: 'Geometría Dark',
                          url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=80',
                        },
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setLoginBgUrl(preset.url)}
                          className={`group relative h-16 rounded-xl overflow-hidden border transition-all text-left cursor-pointer ${
                            loginBgUrl === preset.url
                              ? 'border-[#00F0FF] ring-2 ring-[#00F0FF]/40'
                              : 'border-slate-200 dark:border-[#252636] hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 group-hover:bg-slate-900/30 transition-colors" />
                          <span className="absolute bottom-1 left-2 text-[10px] font-bold text-white drop-shadow-sm truncate">
                            {preset.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Títulos del Login */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Título Principal en Login
                  </label>
                  <input
                    type="text"
                    value={loginHeading}
                    onChange={(e) => setLoginHeading(e.target.value)}
                    placeholder="Ej. Bitácora Oficial"
                    className="w-full px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#161722] border border-slate-200 dark:border-[#252636] rounded-xl focus:border-[#00F0FF] focus:bg-white dark:focus:bg-[#161722] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Subtítulo / Empresa en Login
                  </label>
                  <input
                    type="text"
                    value={loginSubheading}
                    onChange={(e) => setLoginSubheading(e.target.value)}
                    placeholder="Ej. Marketing Alterno Perú"
                    className="w-full px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#161722] border border-slate-200 dark:border-[#252636] rounded-xl focus:border-[#00F0FF] focus:bg-white dark:focus:bg-[#161722] outline-none"
                  />
                </div>
              </div>

              {/* Previsualización en Tiempo Real de la Pantalla de Login */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[#00F0FF]" />
                    Previsualización en tiempo real del Login
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">Escala de maqueta interactiva</span>
                </div>

                <div
                  className="w-full h-56 rounded-2xl relative overflow-hidden border border-slate-200 dark:border-[#252636] shadow-inner flex items-center justify-center p-4 transition-all"
                  style={
                    loginBgType === 'image' && loginBgUrl
                      ? {
                          backgroundImage: `url(${loginBgUrl})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }
                      : {
                          background: 'linear-gradient(135deg, #0B0C13 0%, #161722 50%, #0D1B2A 100%)',
                        }
                  }
                >
                  {/* Overlay oscuro para legibilidad si es imagen */}
                  {loginBgType === 'image' && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" />
                  )}

                  {/* Tarjeta de Login Simulada */}
                  <div className="relative z-10 w-full max-w-xs bg-white/95 dark:bg-[#13141F]/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-white/40 dark:border-[#252636] text-center pointer-events-none scale-90 sm:scale-100 transition-all">
                    <div className="flex items-center justify-center mb-2">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo Preview"
                          className="h-7 max-w-[130px] object-contain"
                          onError={() => {}}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] flex items-center justify-center border border-[#00F0FF]/30">
                          <CalendarCheck className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                      {loginHeading || 'Bitácora Oficial'}
                    </h4>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-2.5">
                      {loginSubheading || 'Marketing Alterno Perú'}
                    </p>

                    <div className="space-y-1.5 opacity-75">
                      <div className="h-6 bg-slate-100 dark:bg-[#161722] rounded-lg border border-slate-200 dark:border-[#252636] flex items-center px-2 text-[10px] text-slate-400 dark:text-slate-500">
                        usuario
                      </div>
                      <div className="h-6 bg-slate-100 dark:bg-[#161722] rounded-lg border border-slate-200 dark:border-[#252636] flex items-center px-2 text-[10px] text-slate-400 dark:text-slate-500">
                        ••••••••
                      </div>
                      <div className="h-6 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] rounded-full text-slate-950 text-[10px] font-bold flex items-center justify-center shadow-xs">
                        Ingresar
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CARD 3: AJUSTES DE JORNADA LABORAL */}
          <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-6 shadow-sm">
            <div className="flex items-start gap-3.5 mb-5 pb-4 border-b border-slate-100 dark:border-[#252636]">
              <div className="p-2.5 rounded-2xl bg-cyan-50 dark:bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] shrink-0 border border-[#00F0FF]/30">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Ajustes de Jornada Laboral
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Configura los parámetros globales que aplican por defecto a todos los colaboradores y a los procesos automatizados.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Hora de Inicio de Jornada (Por Defecto)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="time"
                    value={defaultHoraInicio}
                    onChange={(e) => setDefaultHoraInicio(e.target.value)}
                    className="px-4 py-2 text-sm font-bold text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-[#161722] border border-slate-200 dark:border-[#252636] rounded-full focus:border-[#00F0FF] dark:focus:border-[#00F0FF] focus:bg-white dark:focus:bg-[#161722] focus:ring-1 focus:ring-[#00F0FF]/30 outline-none w-36"
                    required
                  />
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    (Valor estándar: 08:30 am)
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                  Esta hora es de carácter referencial. Se asignará automáticamente como valor inicial al abrir nuevas bitácoras y al proceso de arrastre nocturno (rollover) de actividades.
                </p>
              </div>
            </div>
          </div>

          {/* BOTÓN GUARDAR CONFIGURACIÓN */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={savingSettings}
              className="bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 font-bold px-7 py-3 text-sm rounded-full shadow-md transition-all cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{savingSettings ? 'Guardando cambios...' : 'Guardar Toda la Configuración'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: DELEGACIONES Y USUARIOS DE APOYO */}
      {activeTab === 'delegaciones' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#13141F] rounded-2xl border border-slate-200/90 dark:border-[#252636] p-4 sm:p-6 shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-[#252636]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-[#00F0FF]" />
                  <span>Asignaciones de Usuarios de Apoyo</span>
                  {delegations.length > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-[#00F0FF]">
                      {groupedDelegations.length} {groupedDelegations.length === 1 ? 'usuario' : 'usuarios'} con {delegations.length} {delegations.length === 1 ? 'asignación' : 'asignaciones'}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Designa colaboradores autorizados para registrar y actualizar actividades en nombre de 1 o más compañeros. Las horas se atribuirán al titular.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenNewDelegation()}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 px-4 py-2 rounded-full text-xs font-bold shadow-sm transition-all cursor-pointer self-start sm:self-auto shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Asignar Nuevo Apoyo</span>
              </button>
            </div>

            {loadingDelegations ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-[#00F0FF]" />
                <span className="text-xs">Cargando delegaciones activas...</span>
              </div>
            ) : groupedDelegations.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-[#252636] bg-slate-50/50 dark:bg-white/2">
                <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-[#00F0FF]/10 text-cyan-600 dark:text-[#00F0FF] flex items-center justify-center mx-auto mb-3">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No hay usuarios de apoyo designados</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-4 leading-relaxed">
                  Puedes autorizar a un colaborador (ej. asistente, coordinador o compañero) para que registre actividades de forma asistida en la bitácora de uno o más miembros de la empresa.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenNewDelegation()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00F0FF] text-slate-950 text-xs font-bold hover:brightness-110 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Asignar Primer Usuario de Apoyo</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-[#252636] text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      <th className="pb-3 px-3">Colaborador de Apoyo (Digitador)</th>
                      <th className="pb-3 px-3">Colaboradores a su Cargo ({delegations.length})</th>
                      <th className="pb-3 px-3">Motivo / Alcance</th>
                      <th className="pb-3 px-3">Asignado por</th>
                      <th className="pb-3 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#252636]/60">
                    {groupedDelegations.map((group) => (
                      <tr key={group.delegate_user_id} className="hover:bg-slate-50/80 dark:hover:bg-[#181A26] transition-colors">
                        {/* Usuario Apoyo */}
                        <td className="py-3.5 px-3 align-top">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-[#00F0FF] flex items-center justify-center font-bold text-xs shrink-0">
                              {group.delegate_name ? group.delegate_name.charAt(0).toUpperCase() : 'A'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {group.delegate_name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                @{group.delegate_username}
                              </div>
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-700 dark:text-[#00F0FF] bg-cyan-500/10 px-2 py-0.5 rounded-full">
                                  🤝 {group.targets.length} {group.targets.length === 1 ? 'colaborador' : 'colaboradores'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Titulares Asignados */}
                        <td className="py-3.5 px-3 align-top">
                          <div className="flex flex-wrap gap-1.5 max-w-lg">
                            {group.targets.map((t) => (
                              <span
                                key={t.delegation_id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 shadow-2xs"
                              >
                                <span>{t.target_name}</span>
                                {t.team_name && <span className="text-[10px] opacity-75 font-normal">({t.team_name})</span>}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDelegationToDelete({
                                      id: t.delegation_id,
                                      delegate_user_id: group.delegate_user_id,
                                      target_user_id: t.target_user_id,
                                      delegate_name: group.delegate_name,
                                      target_name: t.target_name,
                                      is_active: 1,
                                      assigned_by: 1,
                                    });
                                    setShowDeleteDelegationModal(true);
                                  }}
                                  className="w-4 h-4 rounded-full hover:bg-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-200 cursor-pointer ml-0.5"
                                  title={`Quitar apoyo a ${t.target_name}`}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* Motivo */}
                        <td className="py-3.5 px-3 align-top">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-medium">
                            <ShieldCheck className="w-3 h-3 text-[#00F0FF]" />
                            <span>{group.motivo || 'Apoyo general'}</span>
                          </span>
                        </td>

                        {/* Asignado Por */}
                        <td className="py-3.5 px-3 align-top text-slate-500 dark:text-slate-400">
                          <div className="font-medium text-slate-700 dark:text-slate-300">
                            {group.assigned_by_name || 'Administrador'}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {group.created_at ? group.created_at.split(' ')[0] : 'Activo'}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-3 align-top text-right space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenNewDelegation(group.delegate_user_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-cyan-600 dark:text-[#00F0FF] hover:bg-cyan-50 dark:hover:bg-cyan-950/40 transition-colors cursor-pointer"
                            title="Asignar más colaboradores a este apoyo"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">Añadir</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDelegateToRevokeAll({ id: group.delegate_user_id, name: group.delegate_name });
                              setShowRevokeAllModal(true);
                            }}
                            className="p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors cursor-pointer inline-flex items-center"
                            title="Revocar todas las asignaciones de este usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL ASIGNAR USUARIOS DE APOYO (SOPORTE MÚLTIPLE) */}
      {showDelegationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#13141F] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200/90 dark:border-[#252636] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-[#252636]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-50 dark:bg-[#00F0FF]/10 text-cyan-600 dark:text-[#00F0FF]">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    Asignar Usuario de Apoyo
                  </h3>
                  <p className="text-[11px] text-slate-400">Autorización para registrar actividades de uno o más colaboradores</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDelegationModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveDelegation} className="space-y-4 text-xs">
              {/* Paso 1: Usuario de Apoyo */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  1. ¿Quién brindará el apoyo? (Usuario Digitador)
                </label>
                <select
                  value={delegationForm.delegate_user_id}
                  onChange={(e) => {
                    const newDelegateId = e.target.value ? Number(e.target.value) : '';
                    setDelegationForm((prev) => ({
                      ...prev,
                      delegate_user_id: newDelegateId,
                      target_user_ids: prev.target_user_ids.filter((id) => id !== newDelegateId),
                    }));
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF]"
                  required
                >
                  <option value="">-- Seleccionar Colaborador de Apoyo --</option>
                  {users
                    .filter((u) => Boolean(u.is_active))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} (@{u.username})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Este usuario tendrá la opción en su cabecera para alternar a "Modo Apoyo".</p>
              </div>

              {/* Paso 2: Selección Múltiple de Colaboradores Titulares */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    2. ¿A quiénes brindará apoyo? (Selecciona 1 o más colaboradores)
                  </label>
                  <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    delegationForm.target_user_ids.length > 0
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      : 'text-slate-400 bg-slate-100 dark:bg-white/5'
                  }`}>
                    {delegationForm.target_user_ids.length} seleccionado(s)
                  </span>
                </div>

                {/* Toolbar de Búsqueda y Filtros */}
                <div className="space-y-2 mb-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={delegationModalSearch}
                      onChange={(e) => setDelegationModalSearch(e.target.value)}
                      placeholder="Buscar colaboradores por nombre..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-[#00F0FF]"
                    />
                  </div>

                  {/* Filtro por Equipos */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
                    <button
                      type="button"
                      onClick={() => setDelegationModalTeamFilter('all')}
                      className={`px-2.5 py-0.5 rounded-full transition-all shrink-0 cursor-pointer ${
                        delegationModalTeamFilter === 'all'
                          ? 'bg-[#00F0FF] text-slate-950 font-bold'
                          : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      Todos
                    </button>
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setDelegationModalTeamFilter(t.id)}
                        className={`px-2.5 py-0.5 rounded-full transition-all shrink-0 cursor-pointer ${
                          delegationModalTeamFilter === t.id
                            ? 'bg-[#00F0FF] text-slate-950 font-bold'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {t.nombre}
                      </button>
                    ))}
                  </div>

                  {/* Acciones de selección masiva */}
                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const selectable = users
                          .filter((u) => Boolean(u.is_active) && u.id !== Number(delegationForm.delegate_user_id))
                          .filter((u) => delegationModalTeamFilter === 'all' || u.team_id === delegationModalTeamFilter)
                          .filter((u) => !delegationModalSearch.trim() || u.full_name.toLowerCase().includes(delegationModalSearch.toLowerCase()));
                        const allIds = Array.from(new Set([...delegationForm.target_user_ids, ...selectable.map((u) => u.id)]));
                        setDelegationForm({ ...delegationForm, target_user_ids: allIds });
                      }}
                      className="text-cyan-600 dark:text-[#00F0FF] hover:underline cursor-pointer font-semibold"
                    >
                      + Seleccionar visibles
                    </button>
                    {delegationForm.target_user_ids.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setDelegationForm({ ...delegationForm, target_user_ids: [] })}
                        className="text-rose-500 hover:underline cursor-pointer font-semibold"
                      >
                        Limpiar selección
                      </button>
                    )}
                  </div>
                </div>

                {/* Lista de Colaboradores con Checkbox */}
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-[#252636] bg-slate-50/50 dark:bg-[#161722]/50 p-2 space-y-1 divide-y divide-slate-100 dark:divide-[#252636]/40">
                  {users
                    .filter((u) => Boolean(u.is_active) && u.id !== Number(delegationForm.delegate_user_id))
                    .filter((u) => delegationModalTeamFilter === 'all' || u.team_id === delegationModalTeamFilter)
                    .filter((u) => !delegationModalSearch.trim() || u.full_name.toLowerCase().includes(delegationModalSearch.toLowerCase()) || (u.team_name && u.team_name.toLowerCase().includes(delegationModalSearch.toLowerCase())))
                    .map((u) => {
                      const isChecked = delegationForm.target_user_ids.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors pt-2 ${
                            isChecked
                              ? 'bg-amber-500/10 border border-amber-500/30'
                              : 'hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDelegationForm((prev) => ({
                                    ...prev,
                                    target_user_ids: [...prev.target_user_ids, u.id],
                                  }));
                                } else {
                                  setDelegationForm((prev) => ({
                                    ...prev,
                                    target_user_ids: prev.target_user_ids.filter((id) => id !== u.id),
                                  }));
                                }
                              }}
                              className="rounded border-slate-300 dark:border-[#252636] text-[#00F0FF] focus:ring-[#00F0FF]"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {u.full_name}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                @{u.username} • {u.team_name || 'Sin equipo'}
                              </div>
                            </div>
                          </div>
                          {isChecked && (
                            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded-full shrink-0">
                              Asignado
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Las horas de las tareas cargadas computarán 100% para cada colaborador titular correspondiente.
                </p>
              </div>

              {/* Paso 3: Motivo */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  3. Motivo o Justificación
                </label>
                <input
                  type="text"
                  value={delegationForm.motivo}
                  onChange={(e) => setDelegationForm({ ...delegationForm, motivo: e.target.value })}
                  placeholder="ej: Asistente administrativo, cobertura de campo, apoyo de escuadrón"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF]"
                />
              </div>

              <div className="p-3 bg-cyan-50/70 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800/40 rounded-2xl text-[11px] text-cyan-900 dark:text-cyan-300 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-cyan-600 dark:text-[#00F0FF] shrink-0 mt-0.5" />
                <span>
                  <strong>Control de Seguridad:</strong> El usuario de apoyo podrá alternar entre cualquiera de estos colaboradores desde su cabecera y registrar tareas con trazabilidad completa. El cierre formal de jornada está protegido y reservado al titular.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDelegationModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#161722] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDelegation}
                  className="bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 font-bold px-5 py-2 rounded-full text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {savingDelegation
                      ? 'Guardando...'
                      : `Guardar Asignaciones (${delegationForm.target_user_ids.length})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR REVOCAR APOYO INDIVIDUAL */}
      {showDeleteDelegationModal && delegationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#13141F] rounded-3xl max-w-sm w-full border border-rose-500/30 p-6 shadow-2xl relative">
            <div className="flex items-center gap-3.5 mb-4 text-rose-500">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Revocar Asignación
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Confirmación de baja de permiso
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              ¿Estás seguro de quitar el apoyo a <strong>{delegationToDelete.target_name}</strong> por parte de <strong>{delegationToDelete.delegate_name}</strong>? El usuario ya no podrá ingresar actividades en nombre de este colaborador.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteDelegationModal(false);
                  setDelegationToDelete(null);
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#161722] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDelegation}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quitar Asignación</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR REVOCAR TODAS LAS ASIGNACIONES DE UN USUARIO */}
      {showRevokeAllModal && delegateToRevokeAll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#13141F] rounded-3xl max-w-sm w-full border border-rose-500/30 p-6 shadow-2xl relative">
            <div className="flex items-center gap-3.5 mb-4 text-rose-500">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Revocar Todo el Apoyo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Eliminar todas las asignaciones
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              ¿Estás seguro de revocar <strong>todas las asignaciones de apoyo</strong> de <strong>{delegateToRevokeAll.name}</strong>? Este colaborador ya no tendrá acceso a la bitácora de ningún compañero.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRevokeAllModal(false);
                  setDelegateToRevokeAll(null);
                }}
                className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#161722] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmRevokeAllDelegations}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/25 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Revocar Todo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL USUARIO */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#13141F] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/90 dark:border-[#252636] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-[#252636]">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {editingUserId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nombre de Usuario (@)
                </label>
                <input
                  type="text"
                  value={userForm.username}
                  disabled={editingUserId !== null && userForm.username === 'admin'}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  placeholder="ej: wchamba, mlopez"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF] disabled:opacity-60"
                  required
                />
                {editingUserId !== null && userForm.username === 'admin' ? (
                  <p className="text-[10px] text-slate-400 mt-1">El usuario 'admin' es reservado para el Administrador Principal.</p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">Identificador con el que el usuario iniciará sesión en la plataforma.</p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  placeholder="ej: Juan Pérez García"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Correo Electrónico</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="correo@marketingalterno.pe"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teléfono / WhatsApp <span className="text-slate-400 dark:text-slate-500 font-normal text-xs">(Ej: +51 987654321)</span>
                </label>
                <input
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  placeholder="+51 987654321"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF] font-mono text-sm"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {editingUserId ? 'Nueva Contraseña (Opcional)' : 'Contraseña de Acceso'}
                </label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  placeholder={editingUserId ? 'Dejar en blanco para conservar la actual' : 'Mínimo 4 caracteres (ej: 123456)'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF]"
                />
                {editingUserId && (
                  <p className="text-[10px] text-slate-400 mt-1">Escribe aquí solo si deseas cambiar o restablecer la clave del colaborador.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Rol</label>
                  <select
                    value={userForm.role}
                    onChange={(e) =>
                      setUserForm({ ...userForm, role: e.target.value as UserRole })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF]"
                  >
                    <option value="operador" className="bg-white dark:bg-[#161722]">Operador</option>
                    <option value="lider" className="bg-white dark:bg-[#161722]">Líder de Equipo</option>
                    <option value="admin" className="bg-white dark:bg-[#161722]">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Equipo</label>
                  <select
                    value={userForm.team_id}
                    onChange={(e) =>
                      setUserForm({
                        ...userForm,
                        team_id: e.target.value ? Number(e.target.value) : '',
                      })
                    }
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF]"
                  >
                    <option value="" className="bg-white dark:bg-[#161722]">Sin equipo</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id} className="bg-white dark:bg-[#161722]">
                        {t.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#161722] rounded-full font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 font-bold px-6 py-2.5 rounded-full shadow-sm cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EQUIPO */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white dark:bg-[#13141F] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200/90 dark:border-[#252636] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-[#252636]">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                {editingTeamId ? 'Editar Equipo' : 'Nuevo Equipo'}
              </h3>
              <button
                type="button"
                onClick={() => setShowTeamModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeam} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre del Equipo</label>
                <input
                  type="text"
                  value={teamForm.nombre}
                  onChange={(e) => setTeamForm({ ...teamForm, nombre: e.target.value })}
                  placeholder="ej: Equipo de Soporte y Redes"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF]"
                  required
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={teamForm.descripcion}
                  onChange={(e) => setTeamForm({ ...teamForm, descripcion: e.target.value })}
                  placeholder="Alcance y responsabilidades..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Líder de Equipo Designado
                </label>
                <select
                  value={teamForm.lider_id}
                  onChange={(e) =>
                    setTeamForm({
                      ...teamForm,
                      lider_id: e.target.value ? Number(e.target.value) : '',
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] dark:text-slate-100 focus:outline-hidden focus:border-[#00F0FF]"
                >
                  <option value="" className="bg-white dark:bg-[#161722]">Seleccionar líder...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="bg-white dark:bg-[#161722]">
                      {u.full_name} (@{u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Asignar Colaboradores al Equipo ({teamForm.member_ids.length} seleccionados)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nonAdminUsers = users.filter((u) => u.role !== 'admin');
                        setTeamForm((prev) => ({
                          ...prev,
                          member_ids: nonAdminUsers.map((u) => u.id),
                        }));
                      }}
                      className="text-[10px] text-[#00F0FF] hover:underline cursor-pointer font-bold"
                    >
                      Todos
                    </button>
                    <span className="text-slate-400">|</span>
                    <button
                      type="button"
                      onClick={() => setTeamForm((prev) => ({ ...prev, member_ids: [] }))}
                      className="text-[10px] text-slate-400 hover:text-slate-200 cursor-pointer font-bold"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636]">
                  {users
                    .filter((u) => u.role !== 'admin')
                    .map((u) => {
                      const isChecked = teamForm.member_ids.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1E2030] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTeamForm((prev) => ({
                                    ...prev,
                                    member_ids: [...prev.member_ids, u.id],
                                  }));
                                } else {
                                  setTeamForm((prev) => ({
                                    ...prev,
                                    member_ids: prev.member_ids.filter((id) => id !== u.id),
                                  }));
                                }
                              }}
                              className="rounded border-slate-300 dark:border-[#252636] text-[#00F0FF] focus:ring-[#00F0FF]"
                            />
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">{u.full_name}</div>
                              <div className="text-[10px] text-slate-400">@{u.username} • {u.team_name || 'Sin equipo'}</div>
                            </div>
                          </div>
                          {isChecked && (
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                              Asignado
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Los colaboradores seleccionados pertenecerán a este escuadrón y serán visibles en la supervisión de su líder.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#161722] rounded-full font-semibold cursor-pointer transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 font-bold px-6 py-2.5 rounded-full shadow-sm cursor-pointer"
                >
                  Guardar Equipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA LIMPIAR DATOS DE PRUEBA */}
      {showCleanConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-[#13141F] rounded-3xl max-w-md w-full border border-rose-500/30 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3.5 mb-4 text-rose-500">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  ¿Purgar todos los datos demo?
                </h3>
                <p className="text-xs text-rose-500 font-semibold mt-0.5">
                  Esta acción es irreversible
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              <p>
                Se eliminarán de forma permanente:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-500 dark:text-slate-400">
                <li>Todas las bitácoras generadas y registros diarios</li>
                <li>Todas las actividades individuales y colaborativas</li>
                <li>Los colaboradores de prueba (Juan, María, Carlos, Pedro)</li>
                <li>Los equipos de demostración</li>
              </ul>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold mt-2">
                ✓ Tu usuario Administrador (<code className="font-mono">admin</code>) se conservará intacto con su contraseña actual.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowCleanConfirmModal(false)}
                disabled={cleaningData}
                className="px-4 py-2 rounded-full text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#161722] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCleanProductionData}
                disabled={cleaningData}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-500 active:scale-98 text-white shadow-lg shadow-rose-600/25 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{cleaningData ? 'Purgando...' : 'Sí, Purgar y Dejar en Producción'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR O DESACTIVAR USUARIO */}
      {showDeleteUserModal && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in select-none">
          <div className="bg-white dark:bg-[#13141F] rounded-3xl max-w-md w-full border border-rose-500/30 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3.5 mb-4 text-rose-500">
              <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  Gestión de Colaborador
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  @{userToDelete.username} • {userToDelete.full_name}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              <p>
                ¿Qué acción deseas realizar con este usuario?
              </p>
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#161722] border border-slate-200/80 dark:border-[#252636] space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">• Eliminar definitivamente:</span>
                  <span className="text-slate-500 dark:text-slate-400">Borra la cuenta del colaborador y sus registros asociados por completo de la base de datos. Esta acción no se puede deshacer.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">• Solo Desactivar:</span>
                  <span className="text-slate-500 dark:text-slate-400">Bloquea el inicio de sesión sin borrar su historial ni sus datos previos. Podrás reactivarlo en cualquier momento.</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteUserModal(false);
                  setUserToDelete(null);
                }}
                disabled={deletingUser}
                className="w-full sm:w-auto px-4 py-2.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#161722] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteUser(false)}
                disabled={deletingUser}
                className="w-full sm:w-auto px-4 py-2.5 rounded-full text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 cursor-pointer disabled:opacity-50"
              >
                {Boolean(userToDelete.is_active) ? 'Solo Desactivar' : 'Reactivar Cuenta'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteUser(true)}
                disabled={deletingUser}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-500 active:scale-98 text-white shadow-lg shadow-rose-600/25 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deletingUser ? 'Eliminando...' : 'Eliminar Definitivamente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
