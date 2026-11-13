import React from 'react';
import { Edit2, Trash2, Star, Briefcase, X } from 'lucide-react';
import { Team, User } from '../../types';
import { EmptyState } from '../EmptyState';

interface TeamsSectionProps {
  isActiveTab: boolean;
  teams: Team[];
  users: User[];
  showTeamModal: boolean;
  setShowTeamModal: (open: boolean) => void;
  editingTeamId: number | null;
  teamForm: {
    nombre: string;
    descripcion: string;
    lider_id: number | '';
    member_ids: number[];
  };
  setTeamForm: React.Dispatch<
    React.SetStateAction<{
      nombre: string;
      descripcion: string;
      lider_id: number | '';
      member_ids: number[];
    }>
  >;
  onOpenNewTeam: () => void;
  onEditTeam: (t: Team) => void;
  onDeleteTeam: (id: number) => void;
  onSaveTeam: (e: React.FormEvent) => void;
}

export const TeamsSection: React.FC<TeamsSectionProps> = ({
  isActiveTab,
  teams,
  users,
  showTeamModal,
  setShowTeamModal,
  editingTeamId,
  teamForm,
  setTeamForm,
  onOpenNewTeam,
  onEditTeam,
  onDeleteTeam,
  onSaveTeam,
}) => {
  return (
    <>
      {isActiveTab &&
        (teams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((t) => (
              <div
                key={t.id}
                className="bg-white dark:bg-[#161922] rounded-2xl border border-slate-200/90 dark:border-white/[0.08] p-5 flex flex-col justify-between shadow-xs hover:border-slate-300 dark:hover:border-white/15 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">{t.nombre}</h3>
                    <div className="flex items-center gap-1.5 sm:gap-1">
                      <button
                        type="button"
                        onClick={() => onEditTeam(t)}
                        className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-slate-100 dark:hover:bg-[#1E222D] rounded-lg cursor-pointer transition-colors flex items-center justify-center"
                        title="Editar equipo"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTeam(t.id)}
                        className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg cursor-pointer transition-colors flex items-center justify-center"
                        title="Eliminar equipo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.descripcion || 'Sin descripción'}</p>

                  {/* Leader Badge */}
                  <div className="bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200/80 dark:border-amber-500/25 rounded-xl p-3 mb-3 flex items-center gap-2.5 text-xs">
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
                            className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-slate-50 dark:bg-[#1A1E29] border border-slate-200/60 dark:border-white/[0.08] text-slate-700 dark:text-slate-300"
                          >
                            <span className="font-medium truncate mr-2">{m.full_name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">@{m.username}</span>
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
            onAction={onOpenNewTeam}
          />
        ))}

      {/* MODAL EQUIPO */}
      {showTeamModal && (
        <div
          onClick={() => setShowTeamModal(false)}
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
                {editingTeamId ? 'Editar Equipo' : 'Nuevo Equipo'}
              </h3>
              <button
                type="button"
                onClick={() => setShowTeamModal(false)}
                className="min-w-[40px] min-h-[40px] sm:min-w-0 sm:min-h-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer flex items-center justify-center"
                title="Cerrar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSaveTeam} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nombre del Equipo</label>
                <input
                  type="text"
                  value={teamForm.nombre}
                  onChange={(e) => setTeamForm({ ...teamForm, nombre: e.target.value })}
                  placeholder="ej: Equipo de Soporte y Redes"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#1E222D] rounded-xl border border-slate-200 dark:border-white/[0.08] dark:text-slate-100 focus:outline-hidden focus:border-sky-500"
                >
                  <option value="" className="bg-white dark:bg-[#1E222D]">
                    Seleccionar líder...
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="bg-white dark:bg-[#1E222D]">
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
                      className="text-[10px] text-sky-600 dark:text-sky-400 hover:underline cursor-pointer font-bold"
                    >
                      Todos
                    </button>
                    <span className="text-slate-400">|</span>
                    <button
                      type="button"
                      onClick={() => setTeamForm((prev) => ({ ...prev, member_ids: [] }))}
                      className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer font-bold"
                    >
                      Ninguno
                    </button>
                  </div>
                </div>

                <div className="max-h-44 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-[#1A1E29] rounded-xl border border-slate-200 dark:border-white/[0.08]">
                  {users
                    .filter((u) => u.role !== 'admin')
                    .map((u) => {
                      const isChecked = teamForm.member_ids.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-[#1E222D] cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
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
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md shrink-0">
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
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#1E222D] rounded-lg font-semibold cursor-pointer transition-colors min-h-[38px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white font-semibold px-5 py-2 rounded-lg shadow-2xs cursor-pointer min-h-[38px]"
                >
                  Guardar Equipo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
