import React, { useState, useEffect } from 'react';
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
  Settings,
  User as UserIcon,
  AlertTriangle,
} from 'lucide-react';
import { User, Team, UserRole, SystemSettings, UserDelegation } from '../types';
import { api } from '../services/api';
import { EmptyState } from './EmptyState';
import { confirmDialog, alertDialog } from './DialogHost';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { SystemConfigTab } from './management/SystemConfigTab';
import { TeamsSection } from './management/TeamsSection';
import { DelegationsSection } from './management/DelegationsSection';

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
  const [, setLoading] = useState(true);

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

  const showFeedback = (msg: string, ms = 3500) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), ms);
  };

  const anyAdminModalOpen =
    showUserModal ||
    showTeamModal ||
    showDeleteUserModal ||
    showDelegationModal ||
    showDeleteDelegationModal ||
    showRevokeAllModal;

  useModalBehavior(anyAdminModalOpen, () => {
    if (showDeleteDelegationModal) setShowDeleteDelegationModal(false);
    else if (showRevokeAllModal) setShowRevokeAllModal(false);
    else if (showDeleteUserModal) setShowDeleteUserModal(false);
    else if (showDelegationModal) setShowDelegationModal(false);
    else if (showTeamModal) setShowTeamModal(false);
    else if (showUserModal) setShowUserModal(false);
  });

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

  const groupedDelegations = React.useMemo(() => {
    const map = new Map<
      number,
      {
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
      }
    >();

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
  }, []);

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
        showFeedback('Usuario actualizado correctamente', 3000);
      } else {
        if (userForm.password && userForm.password.length < 8) {
          void alertDialog('La contraseña debe tener al menos 8 caracteres.');
          return;
        }
        const res = await api.createUser({
          username: userForm.username.trim(),
          full_name: userForm.full_name.trim(),
          email: userForm.email.trim(),
          phone: userForm.phone.trim(),
          role: userForm.role,
          team_id: userForm.team_id ? Number(userForm.team_id) : null,
          password: userForm.password ? userForm.password.trim() : undefined,
        });
        if (res?.temp_password) {
          void alertDialog(
            `Se ha creado el usuario @${userForm.username.trim()} con éxito.\n\nContraseña temporal asignada:\n${res.temp_password}\n\nCopia esta clave y compártela de forma segura. El sistema le exigirá cambiarla inmediatamente en su primer ingreso.`,
            'Usuario Creado con Clave Temporal'
          );
        }
        showFeedback('Usuario creado con éxito', 3000);
      }
      setShowUserModal(false);
      loadUsers();
      onRefreshTeams();
    } catch (err: any) {
      void alertDialog(err.message || 'Error al guardar usuario');
    }
  };

  const handleToggleActiveUser = async (u: User) => {
    try {
      await api.deleteUser(u.id, false);
      loadUsers();
      showFeedback(
        Boolean(u.is_active) ? `Usuario @${u.username} desactivado` : `Usuario @${u.username} reactivado`,
        3000
      );
    } catch (err: any) {
      void alertDialog(err.message || 'Error al actualizar estado del usuario');
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
      showFeedback(permanent ? 'Usuario eliminado definitivamente del sistema' : 'Estado del usuario actualizado');
    } catch (err: any) {
      void alertDialog(err.message || 'Error al procesar la eliminación');
    } finally {
      setDeletingUser(false);
    }
  };

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
      void alertDialog('Debes seleccionar al colaborador que brindará el apoyo');
      return;
    }
    if (delegationForm.target_user_ids.length === 0) {
      void alertDialog('Debes seleccionar al menos un colaborador titular para brindarle apoyo');
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
      showFeedback(
        res.message || `${delegationForm.target_user_ids.length} colaborador(es) asignado(s) exitosamente`
      );
      setShowDelegationModal(false);
      loadDelegations();
    } catch (err: any) {
      void alertDialog(err.message || 'Error al guardar asignaciones de apoyo');
    } finally {
      setSavingDelegation(false);
    }
  };

  const handleConfirmDeleteDelegation = async () => {
    if (!delegationToDelete) return;
    try {
      await api.deleteDelegation(delegationToDelete.id);
      showFeedback('Asignación de apoyo revocada exitosamente');
      setShowDeleteDelegationModal(false);
      setDelegationToDelete(null);
      loadDelegations();
    } catch (err: any) {
      void alertDialog(err.message || 'Error al revocar apoyo');
    }
  };

  const handleConfirmRevokeAllDelegations = async () => {
    if (!delegateToRevokeAll) return;
    try {
      await api.deleteDelegationsByDelegate(delegateToRevokeAll.id);
      showFeedback(`Se revocaron todas las asignaciones de apoyo de ${delegateToRevokeAll.name}`);
      setShowRevokeAllModal(false);
      setDelegateToRevokeAll(null);
      loadDelegations();
    } catch (err: any) {
      void alertDialog(err.message || 'Error al revocar asignaciones');
    }
  };

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
        showFeedback('Equipo y asignación de colaboradores actualizados', 3000);
      } else {
        await api.createTeam({
          nombre: teamForm.nombre,
          descripcion: teamForm.descripcion,
          lider_id: teamForm.lider_id ? Number(teamForm.lider_id) : null,
          member_ids: teamForm.member_ids,
        });
        showFeedback('Equipo creado con colaboradores asignados', 3000);
      }
      setShowTeamModal(false);
      onRefreshTeams();
      loadUsers();
    } catch (err: any) {
      void alertDialog(err.message);
    }
  };

  const handleDeleteTeam = async (id: number) => {
    if (await confirmDialog('¿Deseas eliminar este equipo? Sus miembros quedarán sin equipo asignado.')) {
      await api.deleteTeam(id);
      onRefreshTeams();
      loadUsers();
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="bg-white dark:bg-[#161922] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 border border-sky-200/80 dark:border-sky-500/25">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              Gestión del Sistema
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Usuarios, equipos, delegaciones de apoyo y configuración institucional
            </p>
          </div>
        </div>

        {/* Tab switcher & action buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap min-w-0 max-w-full">
          <div className="bg-slate-100 dark:bg-[#1A1E29] p-1 rounded-xl border border-slate-200/80 dark:border-white/[0.08] flex items-center overflow-x-auto max-w-full no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('usuarios')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[34px] ${
                activeTab === 'usuarios'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Usuarios ({users.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('equipos')}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[34px] ${
                activeTab === 'equipos'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Equipos ({teams.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('delegaciones')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[34px] ${
                activeTab === 'delegaciones'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Apoyo ({delegations.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('configuracion')}
              className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer min-h-[34px] ${
                activeTab === 'configuracion'
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5 shrink-0" />
              <span>Configuración</span>
            </button>
          </div>

          {activeTab === 'usuarios' && (
            <button
              type="button"
              onClick={handleOpenNewUser}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 min-h-[38px]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Nuevo Usuario</span>
            </button>
          )}

          {activeTab === 'equipos' && (
            <button
              type="button"
              onClick={handleOpenNewTeam}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 min-h-[38px]"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Nuevo Equipo</span>
            </button>
          )}

          {activeTab === 'delegaciones' && (
            <button
              type="button"
              onClick={() => handleOpenNewDelegation()}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 min-h-[38px]"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Asignar Apoyo</span>
            </button>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* TAB 1: USUARIOS */}
      {activeTab === 'usuarios' && (
        <div className="bg-white dark:bg-[#161922] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-4 sm:p-6 shadow-xs overflow-hidden">
          {/* DESKTOP TABLE VIEW (>= 768px) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-white/[0.08] pb-2">
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
              <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-[#1A1E29] transition-colors">
                    <td className="py-3 font-bold text-slate-800 dark:text-slate-200">@{u.username}</td>
                    <td className="py-3 font-semibold text-slate-900 dark:text-slate-100">{u.full_name}</td>
                    <td className="py-3 text-slate-500 dark:text-slate-400">{u.email || '—'}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                      {u.phone ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-semibold bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-500/25">
                          {u.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold ${
                          u.role === 'admin'
                            ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/25'
                            : u.role === 'lider'
                            ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25'
                            : 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/25'
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
                            <UserIcon className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                            <span>Operador</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{u.team_name || 'Sin asignar'}</td>
                    <td className="py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-md text-[10px] font-semibold ${
                          u.is_active
                            ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20'
                            : 'text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-[#1E222D]'
                        }`}
                      >
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleEditUser(u)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-[#1E222D] rounded-lg cursor-pointer transition-colors"
                          title="Editar usuario (usuario, nombre, clave, rol)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {u.username !== 'admin' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleActiveUser(u)}
                              className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                                Boolean(u.is_active)
                                  ? 'text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10'
                                  : 'text-amber-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                              }`}
                              title={Boolean(u.is_active) ? 'Suspender / Desactivar acceso' : 'Reactivar acceso'}
                            >
                              {Boolean(u.is_active) ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteModal(u)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors"
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
          <div className="md:hidden divide-y divide-slate-100 dark:divide-white/[0.06]">
            {users.map((u) => (
              <div key={`m-user-${u.id}`} className="py-3.5 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/25 text-sky-600 dark:text-sky-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.full_name}</div>
                      <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                      u.role === 'admin'
                        ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/25'
                        : u.role === 'lider'
                        ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25'
                        : 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-500/25'
                    }`}
                  >
                    {u.role === 'admin' ? 'Admin' : u.role === 'lider' ? 'Líder' : 'Operador'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] bg-slate-100 dark:bg-[#1E222D] px-2 py-0.5 rounded-md font-semibold text-slate-700 dark:text-slate-300">
                      {u.team_name || 'Sin equipo'}
                    </span>
                    {u.phone && (
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">{u.phone}</span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                        u.is_active
                          ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-[#1E222D] text-slate-400'
                      }`}
                    >
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditUser(u)}
                      className="min-w-[40px] min-h-[40px] p-2 text-slate-400 hover:text-sky-500 hover:bg-slate-100 dark:hover:bg-[#1E222D] rounded-lg cursor-pointer transition-colors flex items-center justify-center"
                      title="Editar usuario"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {u.username !== 'admin' && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleActiveUser(u)}
                          className="min-w-[40px] min-h-[40px] p-2 text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-[#1E222D] rounded-lg cursor-pointer transition-colors flex items-center justify-center"
                          title={Boolean(u.is_active) ? 'Suspender acceso' : 'Reactivar acceso'}
                        >
                          {Boolean(u.is_active) ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteModal(u)}
                          className="min-w-[40px] min-h-[40px] p-2 text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-[#1E222D] rounded-lg cursor-pointer transition-colors flex items-center justify-center"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-4 h-4" />
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

      {/* TAB 2 + MODAL: EQUIPOS */}
      <TeamsSection
        isActiveTab={activeTab === 'equipos'}
        teams={teams}
        users={users}
        showTeamModal={showTeamModal}
        setShowTeamModal={setShowTeamModal}
        editingTeamId={editingTeamId}
        teamForm={teamForm}
        setTeamForm={setTeamForm}
        onOpenNewTeam={handleOpenNewTeam}
        onEditTeam={handleEditTeam}
        onDeleteTeam={handleDeleteTeam}
        onSaveTeam={handleSaveTeam}
      />

      {/* TAB 3 + MODAL: CONFIGURACIÓN GLOBAL */}
      {activeTab === 'configuracion' && (
        <SystemConfigTab
          systemSettings={systemSettings}
          onUpdateSettings={onUpdateSettings}
          onFeedback={(msg) => showFeedback(msg, 4000)}
          onRefreshUsersAndTeams={() => {
            loadUsers();
            onRefreshTeams();
          }}
        />
      )}

      {/* TAB 4 + MODALES: DELEGACIONES Y USUARIOS DE APOYO */}
      <DelegationsSection
        isActiveTab={activeTab === 'delegaciones'}
        delegations={delegations}
        groupedDelegations={groupedDelegations}
        loadingDelegations={loadingDelegations}
        users={users}
        teams={teams}
        showDelegationModal={showDelegationModal}
        setShowDelegationModal={setShowDelegationModal}
        savingDelegation={savingDelegation}
        delegationForm={delegationForm}
        setDelegationForm={setDelegationForm}
        delegationModalSearch={delegationModalSearch}
        setDelegationModalSearch={setDelegationModalSearch}
        delegationModalTeamFilter={delegationModalTeamFilter}
        setDelegationModalTeamFilter={setDelegationModalTeamFilter}
        delegationToDelete={delegationToDelete}
        setDelegationToDelete={setDelegationToDelete}
        showDeleteDelegationModal={showDeleteDelegationModal}
        setShowDeleteDelegationModal={setShowDeleteDelegationModal}
        delegateToRevokeAll={delegateToRevokeAll}
        setDelegateToRevokeAll={setDelegateToRevokeAll}
        showRevokeAllModal={showRevokeAllModal}
        setShowRevokeAllModal={setShowRevokeAllModal}
        onOpenNewDelegation={handleOpenNewDelegation}
        onSaveDelegation={handleSaveDelegation}
        onConfirmDeleteDelegation={handleConfirmDeleteDelegation}
        onConfirmRevokeAllDelegations={handleConfirmRevokeAllDelegations}
      />

      {/* MODAL USUARIO */}
      {showUserModal && (
        <div
          onClick={() => setShowUserModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-white/10 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-200/80 dark:border-white/[0.08]">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                {editingUserId ? 'Editar Usuario' : 'Nuevo Usuario'}
              </h3>
              <button
                type="button"
                onClick={() => setShowUserModal(false)}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500 disabled:opacity-60"
                  required
                />
                {editingUserId !== null && userForm.username === 'admin' ? (
                  <p className="text-[10px] text-slate-400 mt-1">
                    El usuario 'admin' es reservado para el Administrador Principal.
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Identificador con el que el usuario iniciará sesión en la plataforma.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  placeholder="ej: Juan Pérez García"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Teléfono / WhatsApp <span className="text-slate-400 dark:text-slate-500 font-normal">(Ej: +51 987654321)</span>
                </label>
                <input
                  type="tel"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  placeholder="+51 987654321"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500 font-mono text-sm"
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
                  placeholder={
                    editingUserId
                      ? 'Dejar en blanco para conservar la actual'
                      : 'Mínimo 8 caracteres (o vacío para autogenerar temporal)'
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500"
                />
                {editingUserId && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Escribe aquí solo si deseas cambiar o restablecer la clave del colaborador.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Rol</label>
                  <select
                    value={userForm.role}
                    onChange={(e) => setUserForm({ ...userForm, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500"
                  >
                    <option value="operador" className="bg-white dark:bg-[#1E222D]">
                      Operador
                    </option>
                    <option value="lider" className="bg-white dark:bg-[#1E222D]">
                      Líder de Equipo
                    </option>
                    <option value="admin" className="bg-white dark:bg-[#1E222D]">
                      Administrador
                    </option>
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500"
                  >
                    <option value="" className="bg-white dark:bg-[#1E222D]">
                      Sin equipo
                    </option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id} className="bg-white dark:bg-[#1E222D]">
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
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222D] rounded-lg font-semibold cursor-pointer transition-colors min-h-[38px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white font-semibold px-5 py-2 rounded-lg shadow-2xs cursor-pointer min-h-[38px]"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN PARA ELIMINAR O DESACTIVAR USUARIO */}
      {showDeleteUserModal && userToDelete && (
        <div
          onClick={() => {
            setShowDeleteUserModal(false);
            setUserToDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto bg-slate-950/70 backdrop-blur-xs animate-in fade-in select-none"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] rounded-2xl max-w-md w-full border border-rose-500/30 p-4 sm:p-6 shadow-2xl relative my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3.5 mb-4 text-rose-500">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Gestión de Colaborador</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  @{userToDelete.username} • {userToDelete.full_name}
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              <p>¿Qué acción deseas realizar con este usuario?</p>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/80 dark:border-white/[0.08] space-y-2.5">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-rose-600 dark:text-rose-400 shrink-0">• Eliminar definitivamente:</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Borra la cuenta del colaborador y sus registros asociados por completo de la base de datos. Esta acción no se puede deshacer.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-bold text-amber-600 dark:text-amber-400 shrink-0">• Solo Desactivar:</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    Bloquea el inicio de sesión sin borrar su historial ni sus datos previos. Podrás reactivarlo en cualquier momento.
                  </span>
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
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222D] cursor-pointer min-h-[38px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteUser(false)}
                disabled={deletingUser}
                className="w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 hover:bg-amber-100 dark:hover:bg-amber-500/20 border border-amber-300 dark:border-amber-500/30 cursor-pointer disabled:opacity-50 min-h-[38px]"
              >
                {Boolean(userToDelete.is_active) ? 'Solo Desactivar' : 'Reactivar Cuenta'}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmDeleteUser(true)}
                disabled={deletingUser}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50 min-h-[38px]"
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
