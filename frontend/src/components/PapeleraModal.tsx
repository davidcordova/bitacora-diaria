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
  onActivityRestored?: () => void;
}

export const PapeleraModal: React.FC<PapeleraModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onActivityRestored,
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

  const handleRestaurar = async (act: ActividadPapelera) => {
    if (!act.id) return;
    setActionLoadingId(act.id);
    try {
      await api.restaurarActividad(act.id);
      setItems((prev) => prev.filter((item) => item.id !== act.id));
      setFeedbackMsg({
        text: `"${stripHtml(act.descripcion).slice(0, 35)}..." restaurada con éxito.`,
        type: 'success',
      });
      if (onActivityRestored) {
        onActivityRestored();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shadow-inner">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-800">Papelera de Reciclaje</h2>
                <span className="px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full border border-red-200">
                  {items.length} {items.length === 1 ? 'actividad' : 'actividades'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Retención automática por 15 días antes de la purga permanente.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadPapelera}
              disabled={loading}
              title="Recargar papelera"
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notice Banner */}
        <div className="bg-amber-50/90 border-b border-amber-200/80 px-6 py-2.5 flex items-center justify-between text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Período de Gracia:</strong> Puedes restaurar cualquier actividad eliminada accidentalmente. Al cumplirse 15 días, el sistema la purgará automáticamente.
            </span>
          </div>
          {items.length > 0 && !confirmVaciar && (
            <button
              onClick={() => setConfirmVaciar(true)}
              className="shrink-0 ml-4 font-semibold text-red-600 hover:text-red-700 hover:underline"
            >
              Vaciar Papelera
            </button>
          )}
        </div>

        {/* Confirm vaciar warning */}
        {confirmVaciar && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-3 flex items-center justify-between text-xs text-red-900 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>¿Confirmas que deseas purgar de forma permanente todas las actividades de la papelera?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleVaciarPapelera}
                disabled={loading}
                className="px-3 py-1 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-sm"
              >
                Sí, vaciar todo
              </button>
              <button
                onClick={() => setConfirmVaciar(false)}
                className="px-3 py-1 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
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
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar actividades por descripción, cliente, tipo o colaborador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {loading && items.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3 text-slate-300" />
              <p className="text-sm">Consultando papelera de reciclaje...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                <Trash2 className="w-8 h-8 opacity-40" />
              </div>
              <h3 className="text-base font-semibold text-slate-700">La papelera está vacía</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
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
                  className="group relative bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 shadow-sm hover:shadow transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Días restantes Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          isUrgent
                            ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                            : isMedium
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
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
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          <Calendar className="w-3 h-3" />
                          {formatDateDisplay(act.bitacora_fecha)}
                        </span>
                      )}

                      {/* Colaborador */}
                      {(act.bitacora_colaborador || act.colaborador) && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                          <UserIcon className="w-3 h-3" />
                          {act.bitacora_colaborador || act.colaborador}
                        </span>
                      )}

                      {/* Duración */}
                      {act.duracion_min > 0 && (
                        <span className="text-xs text-slate-500 font-mono">
                          ⏱ {formatDuration(act.duracion_min)}
                        </span>
                      )}

                      {/* Para Cliente */}
                      {act.para_cliente && (
                        <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200/60 px-2 py-0.5 rounded-md font-medium">
                          {act.para_cliente}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-medium text-slate-800 break-words">
                      <RichHtmlRenderer content={act.descripcion} clampLines={2} />
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>Tipo: <strong className="text-slate-600 font-normal">{act.tipo_trabajo}</strong></span>
                      {act.deleted_at && (
                        <>
                          <span>•</span>
                          <span>Eliminado el: {act.deleted_at}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <button
                      onClick={() => handleRestaurar(act)}
                      disabled={actionLoadingId === act.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-sm disabled:opacity-50"
                      title="Restaurar actividad a su bitácora original"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${actionLoadingId === act.id ? 'animate-spin' : ''}`} />
                      <span>Restaurar</span>
                    </button>
                    <button
                      onClick={() => handleEliminarDefinitivo(act)}
                      disabled={actionLoadingId === act.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors disabled:opacity-50"
                      title="Eliminar definitivamente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-slate-400" />
            <span>Las actividades restauradas volverán de inmediato a la bitácora correspondiente y sumarán sus minutos al total.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium rounded-lg shadow-sm transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
