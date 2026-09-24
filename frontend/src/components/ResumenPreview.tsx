import React, { useState } from 'react';
import {
  Lightbulb,
  FileText,
  Copy,
  Check,
  Clock,
  User,
  Building2,
  Calendar,
  Share2,
  Printer,
  CheckCircle2,
  Paperclip,
} from 'lucide-react';
import { Bitacora, Evidencia } from '../types';
import {
  formatDuration,
  formatDateDisplay,
  getEstadoBadgeInfo,
  generateSummaryText,
} from '../utils/formatters';
import { EvidenceViewerModal } from './EvidenceViewerModal';
import { RichHtmlRenderer } from './RichHtmlRenderer';

interface ResumenPreviewProps {
  bitacora: Bitacora;
  isGenerated: boolean;
  onPrint?: () => void;
  onOpenWhatsApp?: () => void;
}

export const ResumenPreview: React.FC<ResumenPreviewProps> = ({
  bitacora,
  isGenerated,
  onOpenWhatsApp,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedEvidencias, setSelectedEvidencias] = useState<Evidencia[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  const totalMinutos = bitacora.actividades.reduce(
    (sum, a) => sum + (Number(a.duracion_min) || 0),
    0
  );

  const handleCopy = async () => {
    const text = generateSummaryText(bitacora);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Error al copiar al portapapeles', e);
    }
  };

  const handleWhatsApp = () => {
    if (onOpenWhatsApp) {
      onOpenWhatsApp();
      return;
    }
    const text = generateSummaryText(bitacora);
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* 1. Tip Box */}
      <div className="bg-slate-50 dark:bg-[#161722] border border-slate-200/80 dark:border-[#252636] rounded-2xl p-4 flex items-start gap-3 shadow-2xs">
        <div className="p-2 rounded-xl bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30 shrink-0 mt-0.5">
          <Lightbulb className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Tip</div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
            Puedes registrar varias actividades en el mismo día. El sistema calculará el tiempo
            total automáticamente.
          </p>
        </div>
      </div>

      {/* 2. Main Preview Card */}
      <div className="saas-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-[#252636]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                Vista previa del resumen
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                Así se verá tu bitácora al generarse. Puedes copiarla y compartirla con tu jefe o equipo.
              </p>
            </div>
          </div>
        </div>

        {/* Formatted Preview Box */}
        <div className="rounded-2xl bg-slate-50/70 dark:bg-[#161722] border border-slate-200/80 dark:border-[#252636] p-4 font-sans text-xs text-slate-800 dark:text-slate-200 space-y-4">
          {/* Header Metadata */}
          <div>
            <div className="font-extrabold text-[13px] text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-2">
              BITÁCORA DIARIA DE ACTIVIDADES
            </div>
            <div className="space-y-1 text-slate-600 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Fecha:</span>
                <span>{formatDateDisplay(bitacora.fecha) || 'No especificada'}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Colaborador:</span>
                <span>{bitacora.colaborador || 'No especificado'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">Área:</span>
                <span>{bitacora.area || 'Sistemas'}</span>
              </div>
              {bitacora.hora_inicio && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Hora de inicio:</span>
                  <span>{bitacora.hora_inicio}</span>
                </div>
              )}
            </div>
          </div>

          {/* Activities List */}
          <div>
            <div className="font-bold text-[11px] text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2.5 pb-1 border-b border-slate-200 dark:border-[#252636]">
              ACTIVIDADES
            </div>
            {bitacora.actividades.length === 0 ? (
              <div className="text-slate-400 dark:text-slate-500 italic py-2">Sin actividades registradas</div>
            ) : (
              <div className="space-y-3">
                {bitacora.actividades.map((act, index) => {
                  const estadoBadge = getEstadoBadgeInfo(act.estado);
                  return (
                    <div key={index} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#00F0FF] to-[#00A3BF] text-slate-950 flex items-center justify-center text-[10px] font-extrabold shrink-0 mt-0.5 shadow-2xs">
                        {index + 1}
                      </span>
                      <div className="flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {act.hora_inicio || '--:--'}
                          </span>
                          <span className="text-slate-400 dark:text-slate-600">|</span>
                          <span className="text-slate-600 dark:text-slate-400">{act.duracion_min || 0} min</span>
                          {act.tipo_trabajo && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#1C1D2A] text-slate-700 dark:text-slate-300 text-[10px] font-semibold">
                              {act.tipo_trabajo}
                            </span>
                          )}
                          <span
                            className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-semibold border ${estadoBadge.bg}`}
                          >
                            {estadoBadge.label}
                          </span>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 font-normal leading-relaxed">
                          {act.descripcion ? (
                            <RichHtmlRenderer content={act.descripcion} />
                          ) : (
                            <span className="text-slate-400 italic">(Sin descripción)</span>
                          )}
                        </div>
                        {act.para_cliente && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Para: <span className="font-medium text-slate-700 dark:text-slate-300">{act.para_cliente}</span>
                          </div>
                        )}
                        {act.evidencias && act.evidencias.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 pt-1">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Evidencias:</span>
                            {act.evidencias.map((ev, evIdx) => (
                              <button
                                key={ev.id || evIdx}
                                type="button"
                                onClick={() => {
                                  setSelectedEvidencias(act.evidencias || []);
                                  setViewerIndex(evIdx);
                                  setViewerOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#00F0FF]/10 dark:bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 text-cyan-600 dark:text-[#00F0FF] text-[10px] font-semibold border border-[#00F0FF]/30 transition cursor-pointer"
                                title={`Ver ${ev.nombre}`}
                              >
                                <Paperclip className="w-3 h-3 text-[#00F0FF]" />
                                <span className="max-w-[120px] truncate">{ev.nombre}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Total Duration Block */}
          <div className="bg-white dark:bg-[#13141F] border border-slate-200/80 dark:border-[#252636] rounded-2xl p-3 flex items-center gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#00F0FF] to-[#00A3BF] text-slate-950 flex items-center justify-center shrink-0 shadow-2xs">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                Tiempo total de actividades
              </div>
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                {formatDuration(totalMinutos)}
              </div>
            </div>
          </div>

          {/* Cierre de Jornada Section */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-[#252636]">
            <div className="font-bold text-[11px] text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">
              Cierre de jornada
            </div>
            <div className="text-[11px]">
              <span className="font-bold text-slate-700 dark:text-slate-300">Pendientes: </span>
              <span className="text-slate-600 dark:text-slate-400">
                {bitacora.pendientes || 'Sin pendientes reportados'}
              </span>
            </div>
            <div className="text-[11px]">
              <span className="font-bold text-slate-700 dark:text-slate-300">Requiere apoyo: </span>
              <span className="text-slate-600 dark:text-slate-400">
                {bitacora.necesita_apoyo}
                {bitacora.necesita_apoyo === 'Si' && bitacora.apoyo_detalle && (
                  <span className="italic text-amber-700 dark:text-amber-400"> ({bitacora.apoyo_detalle})</span>
                )}
              </span>
            </div>
            <div className="text-[11px]">
              <span className="font-bold text-slate-700 dark:text-slate-300">Prioridad siguiente día: </span>
              <span className="text-slate-600 dark:text-slate-400">
                {bitacora.prioridad_siguiente || 'Continuar jornada estándar'}
              </span>
            </div>
          </div>
        </div>

        {/* Status / Success Banner if generated */}
        {isGenerated && (
          <div className="mt-4 p-3 bg-[#00F0FF]/10 border border-[#00F0FF]/30 rounded-2xl flex items-center gap-2.5 text-xs text-cyan-600 dark:text-[#00F0FF] animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-[#00F0FF] shrink-0" />
            <span>
              <strong>Bitácora generada correctamente.</strong> Puedes copiar el resumen o compartirlo.
            </span>
          </div>
        )}

        {/* Primary Action: Copiar Resumen */}
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 active:scale-98 text-slate-950 py-3 px-5 rounded-full text-xs sm:text-sm font-bold shadow-sm shadow-[#00F0FF]/20 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-slate-950" />
                <span>¡Resumen copiado al portapapeles!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-900" />
                <span>Copiar resumen</span>
              </>
            )}
          </button>

          {/* Secondary share buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex items-center justify-center gap-1.5 bg-white dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] text-slate-700 dark:text-slate-200 hover:text-emerald-500 dark:hover:text-emerald-400 border border-slate-200 dark:border-[#252636] py-2.5 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-1.5 bg-white dark:bg-[#161722] hover:bg-slate-100 dark:hover:bg-[#1C1D2A] text-slate-700 dark:text-slate-200 hover:text-[#00F0FF] dark:hover:text-[#00F0FF] border border-slate-200 dark:border-[#252636] py-2.5 px-3 rounded-full text-xs font-semibold transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Imprimir / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Evidence Viewer Lightbox Modal */}
      <EvidenceViewerModal
        isOpen={viewerOpen}
        evidencias={selectedEvidencias}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
      />
    </div>
  );
};
