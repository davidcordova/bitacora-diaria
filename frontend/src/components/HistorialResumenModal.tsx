import React, { useState } from 'react';
import {
  X,
  Calendar,
  User as UserIcon,
  Clock,
  Building2,
  CheckCircle2,
  Timer,
  Eye,
  ListTodo,
  Users,
  Paperclip,
  ExternalLink,
  Copy,
  Check,
  Share2,
  Printer,
  FileEdit,
  AlertTriangle,
  Target,
  FileText,
} from 'lucide-react';
import { Bitacora, Actividad, EstadoActividad, Evidencia, User, Team } from '../types';
import { formatDateLong, formatDateDisplay, formatDuration, stripHtml } from '../utils/formatters';
import { EvidenceViewerModal } from './EvidenceViewerModal';
import { WhatsAppShareModal } from './WhatsAppShareModal';
import { RichHtmlRenderer } from './RichHtmlRenderer';

interface HistorialResumenModalProps {
  isOpen: boolean;
  onClose: () => void;
  bitacora: Bitacora | null;
  onLoadInEditor?: (bitacora: Bitacora) => void;
  currentUser?: User | null;
  users?: User[];
  teams?: Team[];
}

export const HistorialResumenModal: React.FC<HistorialResumenModalProps> = ({
  isOpen,
  onClose,
  bitacora,
  onLoadInEditor,
  currentUser = null,
  users = [],
  teams = [],
}) => {
  const [copied, setCopied] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);

  // Evidence viewer lightbox
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerEvidencias, setViewerEvidencias] = useState<Evidencia[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  if (!isOpen || !bitacora) return null;

  const totalMinutos = bitacora.actividades.reduce(
    (sum, a) => sum + (Number(a.duracion_min) || 0),
    0
  );

  const handleCopySummary = () => {
    let text = `📋 BITÁCORA DIARIA DE ACTIVIDADES\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `📅 Fecha: ${formatDateLong(bitacora.fecha)}\n`;
    text += `👤 Colaborador: ${bitacora.colaborador}\n`;
    text += `🏢 Área / Equipo: ${bitacora.area}\n`;
    text += `⏰ Hora de Inicio: ${bitacora.hora_inicio || '08:00'}\n`;
    text += `⏱️ Tiempo Total: ${totalMinutos} min (${formatDuration(totalMinutos)})\n\n`;

    text += `📌 ACTIVIDADES DEL DÍA (${bitacora.actividades.length}):\n`;
    bitacora.actividades.forEach((act, idx) => {
      text += `\n${idx + 1}. [${act.hora_inicio || '--:--'}] (${act.duracion_min} min) - ${act.estado.toUpperCase()}\n`;
      if (act.tipo_trabajo) text += `   Tipo: ${act.tipo_trabajo}\n`;
      if (act.para_cliente) text += `   Para / Cliente: ${act.para_cliente}\n`;
      text += `   Descripción: ${stripHtml(act.descripcion)}\n`;
      if (act.shared_with_names && act.shared_with_names.length > 0) {
        text += `   👥 Tarea compartida con: ${act.shared_with_names.join(', ')}\n`;
      }
      if (act.evidencias && act.evidencias.length > 0) {
        text += `   📎 Evidencias adjuntas: ${act.evidencias.length} archivo(s)\n`;
      }
    });

    text += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `🏁 CIERRE DE JORNADA:\n`;
    text += `• Pendientes para mañana: ${bitacora.pendientes || 'Ninguno'}\n`;
    text += `• ¿Necesita apoyo?: ${bitacora.necesita_apoyo || 'No'}\n`;
    if (bitacora.necesita_apoyo === 'Si' && bitacora.apoyo_detalle) {
      text += `  Detalle de apoyo: ${bitacora.apoyo_detalle}\n`;
    }
    if (bitacora.prioridad_siguiente) {
      text += `• Prioridad siguiente día: ${bitacora.prioridad_siguiente}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenEvidenceViewer = (evList: Evidencia[], idx: number) => {
    setViewerEvidencias(evList);
    setViewerIndex(idx);
    setViewerOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (estado: EstadoActividad) => {
    switch (estado) {
      case 'completada':
        return {
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          label: 'Completada',
          icon: CheckCircle2,
        };
      case 'en_proceso':
        return {
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
          label: 'En proceso',
          icon: Timer,
        };
      case 'en_revision':
        return {
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
          label: 'En revisión',
          icon: Eye,
        };
      case 'pendiente':
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          label: 'Por iniciar',
          icon: ListTodo,
        };
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="relative w-full max-w-3xl bg-white dark:bg-[#13141F] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#252636] overflow-hidden my-6 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-[#161722] border-b border-slate-200 dark:border-[#252636] shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] text-slate-950 font-black shadow-sm shadow-[#00F0FF]/20">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                    Resumen Detallado de Bitácora
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30">
                    {formatDateDisplay(bitacora.fecha)}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 uppercase tracking-wider">
                    {bitacora.estado || 'Generada'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Inspección completa de actividades, tiempos, evidencias y cierre de jornada.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#161722] rounded-lg transition-colors cursor-pointer"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body - Scrollable */}
          <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
            {/* Meta Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-[#161722] rounded-2xl border border-slate-200/80 dark:border-[#252636]">
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Colaborador
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                  <UserIcon className="w-3.5 h-3.5 text-[#00F0FF] shrink-0" />
                  <span className="truncate">{bitacora.colaborador}</span>
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Área / Equipo
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span className="truncate">{bitacora.area}</span>
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Hora de Inicio
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                  <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                  <span>{bitacora.hora_inicio || '08:00'}</span>
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Tiempo Total
                </span>
                <div className="flex items-center gap-1.5 mt-1 font-extrabold text-xs sm:text-sm text-[#00A3BF] dark:text-[#00F0FF]">
                  <Timer className="w-3.5 h-3.5 text-[#00F0FF] shrink-0" />
                  <span>{totalMinutos} min ({formatDuration(totalMinutos)})</span>
                </div>
              </div>
            </div>

            {/* Activities Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Actividades Realizadas</span>
                  <span className="px-2 py-0.5 rounded-full bg-mint-50 dark:bg-mint-950/40 text-[#00A88B] dark:text-[#00C9A7] text-xs font-bold border border-emerald-200 dark:border-emerald-800/60">
                    {bitacora.actividades.length}
                  </span>
                </h4>
              </div>

              {bitacora.actividades.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                  No se registraron actividades en esta bitácora.
                </div>
              ) : (
                <div className="space-y-3">
                  {bitacora.actividades.map((act, idx) => {
                    const st = getStatusBadge(act.estado);
                    const StatusIcon = st.icon;
                    const sharedNames = act.shared_with_names || [];
                    const hasShared = (act.shared_with && act.shared_with.length > 0) || sharedNames.length > 0;

                    return (
                      <div
                        key={act.id || idx}
                        className="bg-white dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] p-4 shadow-2xs hover:border-[#00F0FF]/40 dark:hover:border-[#00F0FF]/40 transition-colors"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">#{idx + 1}</span>

                            <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#1A1C29] px-2.5 py-0.5 rounded-md border border-slate-200/60 dark:border-[#252636]">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{act.hora_inicio || '--:--'}</span>
                            </span>

                            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#00A3BF] dark:text-[#00F0FF] bg-cyan-50 dark:bg-[#00F0FF]/15 border border-[#00F0FF]/30 px-2 py-0.5 rounded-md">
                              <Timer className="w-3 h-3" />
                              <span>{act.duracion_min} min</span>
                            </span>

                            {act.tipo_trabajo && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1A1C29] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#252636]">
                                {act.tipo_trabajo}
                              </span>
                            )}

                            <span
                              className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border ${st.bg}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              <span>{st.label}</span>
                            </span>

                            {/* Shared task indicator */}
                            {hasShared && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 px-2.5 py-0.5 rounded-md">
                                <Users className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                <span>
                                  Compartida con: {sharedNames.length > 0 ? sharedNames.join(', ') : `${act.shared_with?.length} colab.`}
                                </span>
                              </span>
                            )}
                          </div>

                          {act.para_cliente && (
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#1A1C29] px-2 py-0.5 rounded border border-slate-200 dark:border-[#252636]">
                              Para: {act.para_cliente}
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <div className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                          <RichHtmlRenderer content={act.descripcion} />
                        </div>

                        {/* Evidences */}
                        {act.evidencias && act.evidencias.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-[#252636] flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Paperclip className="w-3 h-3 text-slate-400" />
                              <span>Evidencias ({act.evidencias.length}):</span>
                            </span>

                            {act.evidencias.map((ev, evIdx) => (
                              <button
                                key={ev.id || evIdx}
                                type="button"
                                onClick={() => handleOpenEvidenceViewer(act.evidencias || [], evIdx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-[#13141F] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] hover:text-[#00F0FF] dark:hover:text-[#00F0FF] rounded-lg border border-slate-200 dark:border-[#252636] transition-colors cursor-pointer"
                              >
                                <span className="truncate max-w-[150px]">{ev.nombre}</span>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cierre de Jornada */}
            <div className="p-4 bg-slate-50 dark:bg-[#161722] rounded-2xl border border-slate-200 dark:border-[#252636] space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Cierre de Jornada y Compromisos
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 bg-white dark:bg-[#13141F] rounded-xl border border-slate-200 dark:border-[#252636]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    <ListTodo className="w-3.5 h-3.5 text-[#00F0FF]" />
                    <span>Pendientes</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {bitacora.pendientes || 'Sin pendientes reportados.'}
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-[#13141F] rounded-xl border border-slate-200 dark:border-[#252636]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    <AlertTriangle
                      className={`w-3.5 h-3.5 ${
                        bitacora.necesita_apoyo === 'Si' ? 'text-amber-500' : 'text-slate-400'
                      }`}
                    />
                    <span>¿Requiere Apoyo?</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        bitacora.necesita_apoyo === 'Si'
                          ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                          : 'bg-slate-100 dark:bg-[#1C1D2A] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {bitacora.necesita_apoyo || 'No'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {bitacora.necesita_apoyo === 'Si' && bitacora.apoyo_detalle
                      ? bitacora.apoyo_detalle
                      : 'No se requiere apoyo extraordinario.'}
                  </p>
                </div>

                <div className="p-3 bg-white dark:bg-[#13141F] rounded-xl border border-slate-200 dark:border-[#252636]">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 mb-1">
                    <Target className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Prioridad Siguiente Día</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {bitacora.prioridad_siguiente || 'No especificada.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 bg-slate-50 dark:bg-[#161722] border-t border-slate-200 dark:border-[#252636] shrink-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#00F0FF] dark:hover:text-[#00F0FF] bg-white dark:bg-[#13141F] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] border border-slate-200 dark:border-[#252636] hover:border-[#00F0FF]/40 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span>Copiar Resumen</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setWhatsAppModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 bg-emerald-50 dark:bg-[#13141F] hover:bg-emerald-100 dark:hover:bg-[#1C1D2A] border border-emerald-200 dark:border-emerald-800/60 rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                <Share2 className="w-4 h-4 text-emerald-500" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#00F0FF] dark:hover:text-[#00F0FF] bg-white dark:bg-[#13141F] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] border border-slate-200 dark:border-[#252636] rounded-xl transition-all cursor-pointer shadow-2xs"
              >
                <Printer className="w-4 h-4 text-slate-400" />
                <span>Imprimir</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {onLoadInEditor && (
                <button
                  type="button"
                  onClick={() => {
                    onLoadInEditor(bitacora);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 rounded-xl transition-all cursor-pointer shadow-sm shadow-[#00F0FF]/20"
                >
                  <FileEdit className="w-4 h-4" />
                  <span>Cargar en Editor</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-[#1C1D2A] rounded-xl transition-colors cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Share Modal */}
      <WhatsAppShareModal
        isOpen={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        bitacora={bitacora}
        currentUser={currentUser}
        users={users}
        teams={teams}
      />

      {/* Evidence Viewer Lightbox */}
      <EvidenceViewerModal
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
        evidencias={viewerEvidencias}
        initialIndex={viewerIndex}
      />
    </>
  );
};
