import React, { useState, useEffect } from 'react';
import {
  Paperclip,
  Download,
  Trash2,
  X,
  FileText,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Evidencia } from '../types';

interface EvidenceViewerModalProps {
  isOpen: boolean;
  evidencias: Evidencia[];
  initialIndex?: number;
  onClose: () => void;
  onDelete?: (evidenciaId: string) => void;
}

export const EvidenceViewerModal: React.FC<EvidenceViewerModalProps> = ({
  isOpen,
  evidencias,
  initialIndex = 0,
  onClose,
  onDelete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIndex, evidencias.length]);

  if (!isOpen || evidencias.length === 0) return null;

  const current = evidencias[currentIndex] || evidencias[0];
  const isImage = current.tipo?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(current.nombre);
  const isPdf = current.tipo?.includes('pdf') || current.nombre.toLowerCase().endsWith('.pdf');

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : evidencias.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < evidencias.length - 1 ? prev + 1 : 0));
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
      id="evidence-modal-backdrop"
    >
      <div
        className="relative max-w-4xl w-full bg-[#13141F] border border-[#252636] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#161722] border-b border-[#252636]">
          <div className="flex items-center gap-3 min-w-0">
            <span className="p-2 rounded-xl bg-[#00F0FF]/15 text-[#00F0FF] border border-[#00F0FF]/30 flex items-center justify-center">
              <Paperclip className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate max-w-md" title={current.nombre}>
                {current.nombre}
              </h3>
              <p className="text-xs text-slate-400 flex items-center gap-2">
                <span>{formatSize(current.tamano)}</span>
                {evidencias.length > 1 && (
                  <>
                    <span>•</span>
                    <span className="font-bold text-[#00F0FF]">
                      {currentIndex + 1} de {evidencias.length}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={current.url}
              download={current.nombre}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-300 bg-[#161722] hover:bg-[#1C1D2A] hover:text-[#00F0FF] border border-[#252636] transition flex items-center gap-1.5"
              title="Descargar o abrir en pestaña nueva"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar</span>
            </a>
            {onDelete && current.id && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`¿Eliminar evidencia "${current.nombre}"?`)) {
                    onDelete(current.id!);
                    if (evidencias.length <= 1) {
                      onClose();
                    } else if (currentIndex >= evidencias.length - 1) {
                      setCurrentIndex((prev) => prev - 1);
                    }
                  }
                }}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-rose-300 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer"
                title="Eliminar evidencia"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-[#1C1D2A] transition cursor-pointer"
              title="Cerrar (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body / Preview */}
        <div className="relative flex-1 bg-black/60 flex items-center justify-center p-4 min-h-[340px] max-h-[68vh] overflow-auto select-none">
          {isImage ? (
            <img
              src={current.url}
              alt={current.nombre}
              className="max-w-full max-h-[64vh] object-contain rounded-xl shadow-lg border border-[#252636]"
            />
          ) : isPdf ? (
            <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center">
              <iframe
                src={`${current.url}#toolbar=0`}
                title={current.nombre}
                className="w-full h-[55vh] rounded-xl border border-[#252636] bg-white"
              />
            </div>
          ) : (
            <div className="text-center p-8 bg-[#161722] rounded-2xl border border-[#252636] max-w-sm">
              <div className="mb-3 flex justify-center text-slate-400">
                <FileText className="w-12 h-12" />
              </div>
              <p className="text-white font-medium text-sm mb-1">{current.nombre}</p>
              <p className="text-xs text-slate-400 mb-4">{formatSize(current.tamano)} • Documento</p>
              <a
                href={current.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#00F0FF] to-[#00A3BF] hover:brightness-110 text-slate-950 rounded-full text-xs font-bold shadow-lg shadow-[#00F0FF]/20 transition"
              >
                Abrir Archivo
              </a>
            </div>
          )}

          {/* Navigation Arrows for multi-evidence */}
          {evidencias.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-[#161722]/80 hover:bg-[#1C1D2A] text-white shadow-xl border border-[#252636] transition cursor-pointer"
                title="Anterior (Flecha izquierda)"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-[#161722]/80 hover:bg-[#1C1D2A] text-white shadow-xl border border-[#252636] transition cursor-pointer"
                title="Siguiente (Flecha derecha)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}
        </div>

        {/* Modal Thumbnails Strip (if > 1) */}
        {evidencias.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-[#161722] border-t border-[#252636] overflow-x-auto">
            {evidencias.map((ev, idx) => {
              const evIsImg = ev.tipo?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(ev.nombre);
              const isActive = idx === currentIndex;
              return (
                <button
                  key={ev.id || idx}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`relative flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden border-2 transition cursor-pointer ${
                    isActive ? 'border-[#00F0FF] ring-2 ring-[#00F0FF]/30 scale-105' : 'border-[#252636] opacity-60 hover:opacity-100'
                  }`}
                >
                  {evIsImg ? (
                    <img src={ev.url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-[#13141F] flex items-center justify-center text-slate-400">
                      <FileText className="w-4 h-4" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
