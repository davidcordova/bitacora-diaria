import React, { useState, useEffect } from 'react';
import {
  Trash2,
  RotateCcw,
  AlertTriangle,
  Clock,
  Calendar,
  User as UserIcon,
  Search,
  X,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { ActividadPapelera, User } from '../types';
import { api } from '../services/api';
import { formatDateDisplay, formatDuration, stripHtml } from '../utils/formatters';
import { RichHtmlRenderer } from './RichHtmlRenderer';

interface PapeleraModalProps {
  currentUser: User | null;
  isOpen: boolean;
  onClose: () => void;
  onActivityRestored?: (actividad: any, bitacoraFecha?: string) => void;
  currentBitacoraFecha?: string;
  currentBitacoraId?: number;
}

export const PapeleraModal: React.FC<PapeleraModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onActivityRestored,
  currentBitacoraFecha,
  currentBitacoraId,
}) => {
  const [items, setItems] = useState<ActividadPapelera[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<number | string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [confirmVaciar, setConfirmVaciar] = useState(false);

  const loadPapelera = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res = await api.getPapelera(currentUser.id, currentUser.id);
      setItems(res.items || []);
    } catch (err: any) {
      console.error('Error al cargar papelera:', err);
      setFeedbackMsg({ text: 'Error al conectar con la papelera.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPapelera();
      setFeedbackMsg(null);
      setConfirmVaciar(false);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const handleRestaurar = async (act: ActividadPapelera, restoreToToday = false) => {
    if (!act.id) return;
    setActionLoadingId(act.id);
    try {
      const targetPayload = restoreToToday && currentBitacoraFecha
        ? {
            target_fecha: currentBitacoraFecha,
            target_bitacora_id: currentBitacoraId,
            target_user_id: currentUser?.id,
          }
        : undefined;

      const res = await api.restaurarActividad(act.id, targetPayload);
      setItems((prev) => prev.filter((item) => item.id !== act.id));

      const restoredAct = res.actividad || {
        ...act,
        is_deleted: 0,
        deleted_at: undefined,
      };

      const restoredFecha = res.bitacora_fecha || (restoreToToday ? currentBitacoraFecha : act.bitacora_fecha);

      setFeedbackMsg({
        text: `"${stripHtml(act.descripcion).slice(0, 30)}..." restaurada con éxito${
          restoreToToday ? ' en tus actividades de hoy' : (restoredFecha ? ` en fecha ${restoredFecha}` : '')
        }.`,
        type: 'success',
      });

      if (onActivityRestored) {
        onActivityRestored(restoredAct, restoredFecha);
      }
    } catch (err: any) {
      setFeedbackMsg({
        text: err.message || 'Error al restaurar actividad.',
        type: 'error',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleEliminarDefinitivo = async (act: ActividadPapelera) => {
    if (!act.id) return;
    if (!window.confirm(`¿Estás seguro de eliminar permanentemente esta actividad? Esta acción no se puede deshacer.`)) {
      return;
    }
    setActionLoadingId(act.id);
    try {
      await api.eliminarDefinitivoActividad(act.id);
      setItems((prev) => prev.filter((item) => item.id !== act.id));
      setFeedbackMsg({
        text: 'Actividad eliminada permanentemente.',
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMsg({
        text: err.message || 'Error al eliminar.',
        type: 'error',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleVaciarPapelera = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      await api.vaciarPapelera(currentUser.id, currentUser.role);
      setItems([]);
      setConfirmVaciar(false);
      setFeedbackMsg({
        text: 'Se han purgado definitivamente todas las actividades en papelera.',
        type: 'success',
      });
    } catch (err: any) {
      setFeedbackMsg({
        text: err.message || 'Error al vaciar papelera.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase();
    return (
      item.descripcion.toLowerCase().includes(q) ||
      (item.colaborador && item.colaborador.toLowerCase().includes(q)) ||
      (item.bitacora_colaborador && item.bitacora_colaborador.toLowerCase().includes(q)) ||
      (item.para_cliente && item.para_cliente.toLowerCase().includes(q)) ||
      (item.tipo_trabajo && item.tipo_trabajo.toLowerCase().includes(q))
    );
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 dark:bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#13141F] rounded-3xl shadow-2xl border border-slate-200/90 dark:border-[#252636] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#252636] bg-slate-50/80 dark:bg-[#161722]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs border border-rose-200 dark:border-rose-900/40">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white">Papelera de Reciclaje</h2>
                <span className="px-2.5 py-0.5 text-xs font-extrabold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 rounded-full border border-rose-200 dark:border-rose-800/60">
                  {items.length} {items.length === 1 ? 'actividad' : 'actividades'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Retención automática por 15 días antes de la purga permanente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadPapelera}
              disabled={loading}
              title="Recargar papelera"
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="bg-amber-50/90 dark:bg-amber-950/30 border-b border-amber-200/80 dark:border-amber-800/40 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900 dark:text-amber-300">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Período de Gracia:</strong> Puedes restaurar cualquier actividad eliminada accidentalmente. Al cumplirse 15 días, el sistema la purgará automáticamente.
            </span>
          </div>
          {items.length > 0 && !confirmVaciar && (
            <button
              onClick={() => setConfirmVaciar(true)}
              className="shrink-0 ml-4 font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:underline cursor-pointer"
            >
              Vaciar Papelera
            </button>
          )}
        </div>

        {/* Confirm vaciar warning */}
        {confirmVaciar && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/40 px-6 py-3 flex items-center justify-between text-xs text-rose-900 dark:text-rose-300 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>¿Confirmas que deseas purgar de forma permanente todas las actividades de la papelera?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleVaciarPapelera}
                disabled={loading}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-full shadow-xs cursor-pointer disabled:opacity-50"
              >
                Sí, vaciar todo
              </button>
              <button
                onClick={() => setConfirmVaciar(false)}
                className="px-3.5 py-1.5 bg-white dark:bg-[#1A1C29] border border-slate-200 dark:border-[#252636] text-slate-700 dark:text-slate-300 font-semibold rounded-full hover:bg-slate-50 dark:hover:bg-[#202230] cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Feedback Message */}
        {feedbackMsg && (
          <div
            className={`px-6 py-2.5 text-xs flex items-center justify-between border-b ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/40'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 dark:border-[#252636] flex items-center gap-3 bg-slate-50/50 dark:bg-[#161722]/50">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar actividades por descripción, cliente, tipo o colaborador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-white dark:bg-[#161722] border border-slate-200/90 dark:border-[#252636] text-slate-800 dark:text-slate-200 rounded-xl focus:outline-hidden focus:border-[#00F0FF] focus:ring-1 focus:ring-[#00F0FF]/30 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {loading && items.length === 0 ? (
            <div className="py-16 text-center text-slate-400 dark:text-slate-500">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-slate-300 dark:text-slate-600" />
              <p className="text-sm">Consultando papelera de reciclaje...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-[#161722] text-slate-400 dark:text-slate-500 flex items-center justify-center mb-3">
                <Trash2 className="w-8 h-8 opacity-40" />
              </div>
              <h3 className="text-base font-bold text-slate-700 dark:text-slate-200">La papelera está vacía</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto mt-1">
                {searchQuery
                  ? 'No se encontraron actividades eliminadas que coincidan con la búsqueda.'
                  : 'No tienes actividades en la papelera. Las que elimines se mantendrán aquí durante 15 días con opción a ser restauradas.'}
              </p>
            </div>
          ) : (
            filteredItems.map((act) => {
              const dias = act.dias_restantes ?? 15;
              const isUrgent = dias <= 2;
              const isMedium = dias <= 6 && dias > 2;

              return (
                <div
                  key={act.id}
                  className="group relative bg-white dark:bg-[#161722] border border-slate-200/90 dark:border-[#252636] hover:border-slate-300 dark:hover:border-[#00F0FF]/40 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Días restantes Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                          isUrgent
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 animate-pulse'
                            : isMedium
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/60'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/60'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {dias === 0
                          ? 'Expira hoy'
                          : dias === 1
                          ? 'Expira en 1 día'
                          : `Expira en ${dias} días`}
                      </span>

                      {/* Fecha de la bitácora */}
                      {act.bitacora_fecha && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1A1C29] border border-slate-200/60 dark:border-[#252636] px-2 py-0.5 rounded-md font-semibold">
                          <Calendar className="w-3 h-3 text-[#00A3BF] dark:text-[#00F0FF]" />
                          {formatDateDisplay(act.bitacora_fecha)}
                        </span>
                      )}

                      {/* Colaborador */}
                      {(act.bitacora_colaborador || act.colaborador) && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#1A1C29] border border-slate-200/60 dark:border-[#252636] px-2 py-0.5 rounded-md font-semibold">
                          <UserIcon className="w-3 h-3 text-[#00A3BF] dark:text-[#00F0FF]" />
                          {act.bitacora_colaborador || act.colaborador}
                        </span>
                      )}

                      {/* Duración */}
                      {act.duracion_min > 0 && (
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-bold font-mono">
                          ⏱ {formatDuration(act.duracion_min)}
                        </span>
                      )}

                      {/* Para Cliente */}
                      {act.para_cliente && (
                        <span className="text-xs bg-[#00F0FF]/10 text-[#0090A0] dark:text-[#00F0FF] border border-[#00F0FF]/30 px-2 py-0.5 rounded-md font-semibold">
                          {act.para_cliente}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-medium text-slate-800 dark:text-slate-200 break-words leading-relaxed">
                      <RichHtmlRenderer content={act.descripcion} clampLines={2} />
                    </div>

                    <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-2">
                      <span>Tipo: <strong className="text-slate-600 dark:text-slate-300 font-semibold">{act.tipo_trabajo}</strong></span>
                      {act.deleted_at && (
                        <>
                          <span>•</span>
                          <span>Eliminado el: {act.deleted_at}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-[#252636]">
                    {currentBitacoraFecha && act.bitacora_fecha && act.bitacora_fecha !== currentBitacoraFecha ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => handleRestaurar(act, true)}
                          disabled={actionLoadingId === act.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-[#0090A0] dark:text-[#00F0FF] border border-[#00F0FF]/40 transition-colors cursor-pointer min-h-[36px]"
                          title="Restaurar y traer esta actividad a mis actividades de hoy"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${actionLoadingId === act.id ? 'animate-spin' : ''}`} />
                          <span>A mi día de hoy</span>
                        </button>

                        <button
                          onClick={() => handleRestaurar(act, false)}
                          disabled={actionLoadingId === act.id}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1A1C29] border border-slate-200 dark:border-[#252636] transition-colors cursor-pointer min-h-[36px]"
                          title={`Restaurar en la bitácora original del ${act.bitacora_fecha}`}
                        >
                          <span>En su fecha ({act.bitacora_fecha.slice(5)})</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleRestaurar(act, true)}
                        disabled={actionLoadingId === act.id}
                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer min-h-[38px]"
                        title="Restaurar actividad a tus actividades activas"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${actionLoadingId === act.id ? 'animate-spin' : ''}`} />
                        <span>Restaurar</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleEliminarDefinitivo(act)}
                      disabled={actionLoadingId === act.id}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors disabled:opacity-50 cursor-pointer min-w-[38px] min-h-[38px] flex items-center justify-center"
                      title="Eliminar definitivamente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 dark:border-[#252636] bg-slate-50/80 dark:bg-[#161722]/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <span>Las actividades restauradas volverán de inmediato a la bitácora correspondiente y sumarán sus minutos al total.</span>
          </div>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-white dark:bg-[#1A1C29] border border-slate-200 dark:border-[#252636] hover:bg-slate-100 dark:hover:bg-[#202230] text-slate-700 dark:text-slate-200 font-bold rounded-full shadow-2xs transition-colors cursor-pointer min-h-[38px]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
