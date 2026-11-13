import React from 'react';
import {
  UserCheck,
  UserPlus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
  Search,
  AlertCircle,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Team, User, UserDelegation } from '../../types';

interface GroupedDelegation {
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

interface DelegationsSectionProps {
  isActiveTab: boolean;
  delegations: UserDelegation[];
  groupedDelegations: GroupedDelegation[];
  loadingDelegations: boolean;
  users: User[];
  teams: Team[];
  showDelegationModal: boolean;
  setShowDelegationModal: (open: boolean) => void;
  savingDelegation: boolean;
  delegationForm: {
    delegate_user_id: number | '';
    target_user_ids: number[];
    motivo: string;
  };
  setDelegationForm: React.Dispatch<
    React.SetStateAction<{
      delegate_user_id: number | '';
      target_user_ids: number[];
      motivo: string;
    }>
  >;
  delegationModalSearch: string;
  setDelegationModalSearch: (v: string) => void;
  delegationModalTeamFilter: number | 'all';
  setDelegationModalTeamFilter: (v: number | 'all') => void;
  delegationToDelete: UserDelegation | null;
  setDelegationToDelete: (v: UserDelegation | null) => void;
  showDeleteDelegationModal: boolean;
  setShowDeleteDelegationModal: (open: boolean) => void;
  delegateToRevokeAll: { id: number; name: string } | null;
  setDelegateToRevokeAll: (v: { id: number; name: string } | null) => void;
  showRevokeAllModal: boolean;
  setShowRevokeAllModal: (open: boolean) => void;
  onOpenNewDelegation: (preselectedDelegateId?: number) => void;
  onSaveDelegation: (e: React.FormEvent) => void;
  onConfirmDeleteDelegation: () => void;
  onConfirmRevokeAllDelegations: () => void;
}

export const DelegationsSection: React.FC<DelegationsSectionProps> = ({
  isActiveTab,
  delegations,
  groupedDelegations,
  loadingDelegations,
  users,
  teams,
  showDelegationModal,
  setShowDelegationModal,
  savingDelegation,
  delegationForm,
  setDelegationForm,
  delegationModalSearch,
  setDelegationModalSearch,
  delegationModalTeamFilter,
  setDelegationModalTeamFilter,
  delegationToDelete,
  setDelegationToDelete,
  showDeleteDelegationModal,
  setShowDeleteDelegationModal,
  delegateToRevokeAll,
  setDelegateToRevokeAll,
  showRevokeAllModal,
  setShowRevokeAllModal,
  onOpenNewDelegation,
  onSaveDelegation,
  onConfirmDeleteDelegation,
  onConfirmRevokeAllDelegations,
}) => {
  return (
    <>
      {isActiveTab && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#161922] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-4 sm:p-6 shadow-xs overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 dark:border-white/[0.08]">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                  <UserCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>Asignaciones de Usuarios de Apoyo</span>
                  {delegations.length > 0 && (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200/80 dark:border-sky-500/25">
                      {groupedDelegations.length} {groupedDelegations.length === 1 ? 'usuario' : 'usuarios'} con{' '}
                      {delegations.length} {delegations.length === 1 ? 'asignación' : 'asignaciones'}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Designa colaboradores autorizados para registrar y actualizar actividades en nombre de 1 o más compañeros. Las horas se atribuirán al titular.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenNewDelegation()}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto shrink-0 min-h-[38px]"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Asignar Nuevo Apoyo</span>
              </button>
            </div>

            {loadingDelegations ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                <span className="text-xs">Cargando delegaciones activas...</span>
              </div>
            ) : groupedDelegations.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#1A1E29]">
                <div className="w-12 h-12 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center mx-auto mb-3 border border-sky-200/80 dark:border-sky-500/25">
                  <UserCheck className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No hay usuarios de apoyo designados</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-4 leading-relaxed">
                  Puedes autorizar a un colaborador (ej. asistente, coordinador o compañero) para que registre actividades de forma asistida en la bitácora de uno o más miembros de la empresa.
                </p>
                <button
                  type="button"
                  onClick={() => onOpenNewDelegation()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors cursor-pointer min-h-[38px]"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Asignar Primer Usuario de Apoyo</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-white/[0.08] text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                      <th className="pb-3 px-3">Colaborador de Apoyo (Digitador)</th>
                      <th className="pb-3 px-3">Colaboradores a su Cargo ({delegations.length})</th>
                      <th className="pb-3 px-3">Motivo / Alcance</th>
                      <th className="pb-3 px-3">Asignado por</th>
                      <th className="pb-3 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                    {groupedDelegations.map((group) => (
                      <tr key={group.delegate_user_id} className="hover:bg-slate-50/80 dark:hover:bg-[#1A1E29] transition-colors">
                        {/* Usuario Apoyo */}
                        <td className="py-3.5 px-3 align-top">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-sky-500/10 border border-sky-500/25 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {group.delegate_name ? group.delegate_name.charAt(0).toUpperCase() : 'A'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 dark:text-slate-200">{group.delegate_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">@{group.delegate_username}</div>
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 border border-sky-200/80 dark:border-sky-500/20 px-2 py-0.5 rounded-md">
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
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-500/25"
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
                                  className="w-5 h-5 rounded hover:bg-amber-500/25 flex items-center justify-center text-amber-700 dark:text-amber-200 cursor-pointer ml-0.5"
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
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 font-medium">
                            <ShieldCheck className="w-3 h-3 text-sky-500" />
                            <span>{group.motivo || 'Apoyo general'}</span>
                          </span>
                        </td>

                        {/* Asignado Por */}
                        <td className="py-3.5 px-3 align-top text-slate-500 dark:text-slate-400">
                          <div className="font-medium text-slate-700 dark:text-slate-300">
                            {group.assigned_by_name || 'Administrador'}
                          </div>
                          <div className="text-[10px] text-slate-400 tabular-nums">
                            {group.created_at ? group.created_at.split(' ')[0] : 'Activo'}
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-3 align-top text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenNewDelegation(group.delegate_user_id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors cursor-pointer min-h-[36px]"
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
                              className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                              title="Revocar todas las asignaciones de este usuario"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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

      {/* MODAL ASIGNAR USUARIOS DE APOYO */}
      {showDelegationModal && (
        <div
          onClick={() => setShowDelegationModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200/90 dark:border-white/10 my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-200/80 dark:border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-200/80 dark:border-sky-500/25">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm sm:text-base">
                    Asignar Usuario de Apoyo
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Autorización para registrar actividades de uno o más colaboradores
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDelegationModal(false)}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSaveDelegation} className="space-y-4 text-xs">
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
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500"
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
                <p className="text-[10px] text-slate-400 mt-1">
                  Este usuario tendrá la opción en su cabecera para alternar a "Modo Apoyo".
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    2. ¿A quiénes brindará apoyo? (Selecciona 1 o más colaboradores)
                  </label>
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                      delegationForm.target_user_ids.length > 0
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                        : 'text-slate-400 bg-slate-100 dark:bg-white/5'
                    }`}
                  >
                    {delegationForm.target_user_ids.length} seleccionado(s)
                  </span>
                </div>

                <div className="space-y-2 mb-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={delegationModalSearch}
                      onChange={(e) => setDelegationModalSearch(e.target.value)}
                      placeholder="Buscar colaboradores por nombre..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:border-sky-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-thin">
                    <button
                      type="button"
                      onClick={() => setDelegationModalTeamFilter('all')}
                      className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer ${
                        delegationModalTeamFilter === 'all'
                          ? 'bg-sky-600 text-white font-semibold'
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
                        className={`px-2.5 py-1 rounded-lg transition-colors shrink-0 cursor-pointer ${
                          delegationModalTeamFilter === t.id
                            ? 'bg-sky-600 text-white font-semibold'
                            : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >
                        {t.nombre}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        const selectable = users
                          .filter((u) => Boolean(u.is_active) && u.id !== Number(delegationForm.delegate_user_id))
                          .filter((u) => delegationModalTeamFilter === 'all' || u.team_id === delegationModalTeamFilter)
                          .filter(
                            (u) =>
                              !delegationModalSearch.trim() ||
                              u.full_name.toLowerCase().includes(delegationModalSearch.toLowerCase())
                          );
                        const allIds = Array.from(
                          new Set([...delegationForm.target_user_ids, ...selectable.map((u) => u.id)])
                        );
                        setDelegationForm({ ...delegationForm, target_user_ids: allIds });
                      }}
                      className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer font-semibold"
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

                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-[#1A1E29] p-2 space-y-1">
                  {users
                    .filter((u) => Boolean(u.is_active) && u.id !== Number(delegationForm.delegate_user_id))
                    .filter((u) => delegationModalTeamFilter === 'all' || u.team_id === delegationModalTeamFilter)
                    .filter(
                      (u) =>
                        !delegationModalSearch.trim() ||
                        u.full_name.toLowerCase().includes(delegationModalSearch.toLowerCase()) ||
                        (u.team_name && u.team_name.toLowerCase().includes(delegationModalSearch.toLowerCase()))
                    )
                    .map((u) => {
                      const isChecked = delegationForm.target_user_ids.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
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
                              className="rounded border-slate-300 dark:border-white/[0.08] text-sky-600 focus:ring-sky-500"
                            />
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">{u.full_name}</div>
                              <div className="text-[10px] text-slate-400 truncate">
                                @{u.username} • {u.team_name || 'Sin equipo'}
                              </div>
                            </div>
                          </div>
                          {isChecked && (
                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md shrink-0">
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

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  3. Motivo o Justificación
                </label>
                <input
                  type="text"
                  value={delegationForm.motivo}
                  onChange={(e) => setDelegationForm({ ...delegationForm, motivo: e.target.value })}
                  placeholder="ej: Asistente administrativo, cobertura de campo, apoyo de escuadrón"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500"
                />
              </div>

              <div className="p-3 bg-sky-50/70 dark:bg-sky-500/10 border border-sky-200/80 dark:border-sky-500/20 rounded-xl text-[11px] text-sky-900 dark:text-sky-200 flex items-start gap-2 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Control de Seguridad:</strong> El usuario de apoyo podrá alternar entre cualquiera de estos colaboradores desde su cabecera y registrar tareas con trazabilidad completa. El cierre formal de jornada está protegido y reservado al titular.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDelegationModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222D] cursor-pointer min-h-[38px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingDelegation}
                  className="bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white font-semibold px-5 py-2 rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 min-h-[38px]"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {savingDelegation ? 'Guardando...' : `Guardar Asignaciones (${delegationForm.target_user_ids.length})`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR REVOCAR APOYO INDIVIDUAL */}
      {showDeleteDelegationModal && delegationToDelete && (
        <div
          onClick={() => {
            setShowDeleteDelegationModal(false);
            setDelegationToDelete(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] rounded-2xl max-w-sm w-full border border-rose-500/30 p-4 sm:p-6 shadow-2xl relative my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3.5 mb-4 text-rose-500">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Revocar Asignación</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Confirmación de baja de permiso</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              ¿Estás seguro de quitar el apoyo a <strong>{delegationToDelete.target_name}</strong> por parte de{' '}
              <strong>{delegationToDelete.delegate_name}</strong>? El usuario ya no podrá ingresar actividades en nombre de este colaborador.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteDelegationModal(false);
                  setDelegationToDelete(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222D] cursor-pointer min-h-[38px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirmDeleteDelegation}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer min-h-[38px]"
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
        <div
          onClick={() => {
            setShowRevokeAllModal(false);
            setDelegateToRevokeAll(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto animate-in fade-in"
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#161922] rounded-2xl max-w-sm w-full border border-rose-500/30 p-4 sm:p-6 shadow-2xl relative my-auto max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center gap-3.5 mb-4 text-rose-500">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-500" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Revocar Todo el Apoyo</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Eliminar todas las asignaciones</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
              ¿Estás seguro de revocar <strong>todas las asignaciones de apoyo</strong> de{' '}
              <strong>{delegateToRevokeAll.name}</strong>? Este colaborador ya no tendrá acceso a la bitácora de ningún compañero.
            </p>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRevokeAllModal(false);
                  setDelegateToRevokeAll(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222D] cursor-pointer min-h-[38px]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onConfirmRevokeAllDelegations}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer min-h-[38px]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Revocar Todo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
