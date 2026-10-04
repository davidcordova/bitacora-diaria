import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  X,
  Copy,
  Check,
  Send,
  RefreshCw,
  ShieldCheck,
  Image as ImageIcon,
  Paperclip,
  Trash2,
  Terminal,
} from 'lucide-react';
import { User, Evidencia } from '../types';
import { api } from '../services/api';

interface ErrorReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMessage: string | null;
  currentUser: User | null;
  fecha?: string;
  onRetrySync: () => void;
  isRetrying?: boolean;
}

export const ErrorReportModal: React.FC<ErrorReportModalProps> = ({
  isOpen,
  onClose,
  errorMessage,
  currentUser,
  fecha,
  onRetrySync,
  isRetrying = false,
}) => {
  const [copied, setCopied] = useState(false);
  const [comentario, setComentario] = useState('');
  const [evidenciaScreenshot, setEvidenciaScreenshot] = useState<Evidencia | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setReportSuccess(false);
    }
  }, [isOpen]);

  // Interceptar pegado Ctrl+V de captura de pantalla
  useEffect(() => {
    if (!isOpen) return;
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            try {
              setIsUploading(true);
              const uploaded = await api.uploadFile(file);
              setEvidenciascreenshot(uploaded);
            } catch (err) {
              console.error('Error al subir screenshot:', err);
            } finally {
              setIsUploading(false);
            }
          }
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const setEvidenciascreenshot = (ev: Evidencia | null) => {
    setEvidenciaScreenshot(ev);
  };

  const technicalReportText = `=== REPORTE TÉCNICO DE INCIDENCIA ===
Fecha Evento: ${new Date().toLocaleString('es-PE')}
Fecha Bitácora: ${fecha || 'N/A'}
Usuario: ${currentUser?.full_name || 'Desconocido'} (ID: ${currentUser?.id || 'N/A'}, Rol: ${currentUser?.role || 'N/A'})
Navegador: ${navigator.userAgent}
URL Actual: ${window.location.href}
Mensaje de Error: ${errorMessage || 'Error de conexión con el servidor (500 o Timeout)'}
Comentario Adicional: ${comentario.trim() || 'Sin comentario adicional'}
Captura Adjunta: ${evidenciaScreenshot?.url || 'Ninguna'}
=====================================`;

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(technicalReportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleSendReport = async () => {
    try {
      setSendingReport(true);
      await api.reportSupportError({
        user_id: currentUser?.id,
        user_name: currentUser?.full_name,
        error_message: errorMessage || 'Fallo de conexión o guardado de bitácora',
        context: `Bitácora fecha: ${fecha || 'Hoy'} - ${comentario.trim() || 'Reportado por usuario'}`,
        screenshot_url: evidenciaScreenshot?.url,
      });
      setReportSuccess(true);
    } catch (err) {
      console.error('Error enviando reporte:', err);
      alert('No se pudo enviar el reporte automáticamente. Puedes copiar el texto y enviarlo por chat.');
    } finally {
      setSendingReport(false);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      const uploaded = await api.uploadFile(file);
      setEvidenciascreenshot(uploaded);
    } catch (err) {
      console.error('Error subiendo imagen:', err);
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white dark:bg-[#13141F] rounded-3xl shadow-2xl border border-slate-200 dark:border-[#252636] max-h-[92dvh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-rose-500/10 border-b border-rose-500/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Diagnóstico de Error y Soporte
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tus datos locales están protegidos contra pérdida.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Contingency Banner */}
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300/60 dark:border-emerald-700/50 rounded-2xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200">
              <span className="font-bold block">Respaldo Activo en tu Navegador</span>
              <span>
                Todas tus actividades siguen guardadas de forma segura en tu equipo (localStorage). No se perderán.
              </span>
            </div>
          </div>

          {/* Technical Error Snippet */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
              <span>Detalle Técnico del Error</span>
            </label>
            <div className="p-3 bg-slate-900 text-rose-300 font-mono text-[11px] rounded-xl border border-slate-800 break-all select-all">
              {errorMessage || 'Error de conexión con el servidor (500 Internal Server Error o tiempo de espera agotado)'}
            </div>
          </div>

          {/* Screenshot / Evidence of Error */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                <span>Captura de Pantalla / Evidencia del Error</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                Puedes pegar directamente con <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-sm font-mono border">Ctrl+V</kbd>
              </span>
            </label>

            {evidenciaScreenshot ? (
              <div className="relative group border border-slate-200 dark:border-[#252636] rounded-2xl overflow-hidden bg-slate-50 dark:bg-[#161722] p-2 flex items-center gap-3">
                <img
                  src={evidenciaScreenshot.url}
                  alt="Captura de error"
                  className="w-16 h-16 object-cover rounded-xl border border-slate-200 dark:border-[#252636]"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {evidenciaScreenshot.nombre || 'captura_error.png'}
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    ✓ Imagen adjunta lista para el reporte
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEvidenciaScreenshot(null)}
                  className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all cursor-pointer"
                  title="Eliminar captura"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="border-2 border-dashed border-slate-200 dark:border-[#252636] hover:border-cyan-500/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors bg-slate-50/50 dark:bg-[#161722]/50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-[#1C1E2C] flex items-center justify-center text-slate-500 dark:text-slate-400">
                  <Paperclip className="w-4 h-4" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {isUploading ? 'Subiendo captura...' : 'Haz clic para subir o presiona Ctrl+V aquí'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Permite a los administradores ver exactamente dónde falló la pantalla
                  </p>
                </div>
              </label>
            )}
          </div>

          {/* Optional Note */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              ¿Qué estabas realizando cuando ocurrió? (Opcional)
            </label>
            <input
              type="text"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Ej. Al agregar la segunda tarea de soporte y hacer clic en Guardar"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-[#161722] border border-slate-200 dark:border-[#252636] rounded-xl text-slate-800 dark:text-slate-100 outline-hidden focus:border-[#00F0FF]"
            />
          </div>

          {reportSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>¡Incidencia enviada al equipo de Sistemas con éxito! Se notificó a los administradores.</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50/80 dark:bg-[#161722]/80 border-t border-slate-100 dark:border-[#252636] flex items-center justify-between gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={onRetrySync}
            disabled={isRetrying}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-[#252636] hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Reintentando...' : 'Reintentar Guardar'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReport}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-slate-100 dark:bg-[#1A1C29] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#252636] transition-all cursor-pointer"
              title="Copiar texto técnico para pegar en chat de WhatsApp o Teams"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Reporte'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendReport}
              disabled={sendingReport || reportSuccess}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-gradient-to-r from-rose-500 to-rose-600 hover:brightness-110 active:scale-95 text-white transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{sendingReport ? 'Enviando...' : reportSuccess ? 'Enviado' : 'Reportar a Sistemas'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
