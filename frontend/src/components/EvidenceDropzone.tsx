import React, { useState, useRef } from 'react';
import { Paperclip, Image as ImageIcon, FileText, Loader2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Evidencia } from '../types';
import { api } from '../services/api';
import { EvidenceViewerModal } from './EvidenceViewerModal';

interface EvidenceDropzoneProps {
  evidencias?: Evidencia[];
  onChange: (evidencias: Evidencia[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

export const EvidenceDropzone: React.FC<EvidenceDropzoneProps> = ({
  evidencias = [],
  onChange,
  disabled = false,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    if (disabled || files.length === 0) return;
    setIsUploading(true);
    const newEvidencias: Evidencia[] = [...evidencias];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const uploaded = await api.uploadFile(file);
        newEvidencias.push(uploaded);
      }
      onChange(newEvidencias);
      setIsExpanded(true); // Auto-expand to show new attachments
    } catch (err) {
      console.error('Error al subir archivos:', err);
      alert('Error al subir uno o más archivos adjuntos');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToUpload: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const ext = item.type.split('/')[1] || 'png';
          const namedFile = new File([file], `screenshot_${timestamp}.${ext}`, { type: item.type });
          filesToUpload.push(namedFile);
        }
      }
    }

    if (filesToUpload.length > 0) {
      e.preventDefault();
      await handleFiles(filesToUpload);
    }
  };

  const handleRemove = (evidenciaId?: string, index?: number) => {
    if (disabled) return;
    const updated = evidencias.filter((ev, idx) => (ev.id ? ev.id !== evidenciaId : idx !== index));
    onChange(updated);
  };

  const openPreview = (index: number) => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full space-y-1.5 select-none text-xs">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
        multiple
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
        disabled={disabled}
      />

      {/* 1. COMPACT ACCORDION BAR (Always clean & aligned) */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Toggle button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer shadow-2xs ${
              evidencias.length > 0
                ? 'bg-[#00F0FF]/15 dark:bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 dark:hover:bg-[#00F0FF]/25 text-cyan-600 dark:text-[#00F0FF] border border-[#00F0FF]/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-[#00F0FF] dark:hover:text-[#00F0FF] hover:bg-[#00F0FF]/10 dark:hover:bg-[#161722] border border-dashed border-slate-300 dark:border-[#252636] hover:border-[#00F0FF] bg-white dark:bg-[#161722]'
            }`}
            title={isExpanded ? 'Plegar área de evidencias' : 'Desplegar área para adjuntar evidencias'}
          >
            <Paperclip className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00F0FF]" />
            <span>
              {evidencias.length === 0
                ? 'Adjuntar evidencia (0)'
                : `${evidencias.length} ${evidencias.length === 1 ? 'evidencia' : 'evidencias'}`}
            </span>
            {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>

          {/* Mini chips shown even when collapsed for quick status */}
          {!isExpanded && evidencias.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {evidencias.slice(0, 3).map((ev, idx) => {
                const isImg = ev.tipo?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(ev.nombre);
                return (
                  <div
                    key={ev.id || idx}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white dark:bg-[#161722] border border-slate-200 dark:border-[#252636] text-slate-700 dark:text-slate-200 text-[10px] shadow-2xs hover:border-[#00F0FF]/40 transition"
                  >
                    <button
                      type="button"
                      onClick={() => openPreview(idx)}
                      className="flex items-center gap-1 hover:text-[#00F0FF] dark:hover:text-[#00F0FF] font-medium truncate max-w-[90px]"
                      title={`Ver ${ev.nombre}`}
                    >
                      {isImg ? <ImageIcon className="w-3 h-3 text-slate-400 shrink-0" /> : <FileText className="w-3 h-3 text-slate-400 shrink-0" />}
                      <span className="truncate">{ev.nombre}</span>
                    </button>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => handleRemove(ev.id, idx)}
                        className="text-slate-400 hover:text-rose-500 text-[10px] ml-0.5 cursor-pointer"
                        title="Quitar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
              {evidencias.length > 3 && (
                <span className="text-[10px] text-slate-400 font-medium">+{evidencias.length - 3} más</span>
              )}
            </div>
          )}
        </div>

        {/* Subtle shortcut indicator */}
        {!isExpanded && (
          <span className="text-[10px] text-slate-400 hidden sm:inline-block">
            Pega con <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-[#1C1D2A] border border-slate-200 dark:border-[#252636] rounded font-mono text-[9px] text-slate-600 dark:text-slate-400">Ctrl+V</kbd>
          </span>
        )}
      </div>

      {/* 2. EXPANDABLE ACCORDION TRAY (Clean, light/dark theme) */}
      {isExpanded && (
        <div className="mt-1.5 p-3.5 bg-slate-50/90 dark:bg-[#13141F] border border-slate-200/90 dark:border-[#252636] rounded-2xl space-y-2.5 shadow-2xs transition-all animate-fadeIn">
          {/* Header of Accordion */}
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70 dark:border-[#252636]">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200">
              <Paperclip className="w-3.5 h-3.5 text-cyan-600 dark:text-[#00F0FF]" />
              <span>Zona de Evidencias ({evidencias.length})</span>
            </div>
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 px-2.5 py-0.5 rounded-full hover:bg-slate-200/60 dark:hover:bg-[#1C1D2A] transition cursor-pointer"
            >
              <span>Plegar</span>
              <ChevronUp className="w-3 h-3" />
            </button>
          </div>

          {/* Interactive Dropzone Box */}
          {!disabled && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onPaste={handlePaste}
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-2xl p-4 text-center transition-all cursor-pointer outline-none ${
                isDragging
                  ? 'border-[#00F0FF] bg-[#00F0FF]/10 scale-[1.01]'
                  : 'border-slate-300 dark:border-[#252636] bg-white dark:bg-[#161722] hover:bg-[#00F0FF]/5 dark:hover:bg-[#1C1D2A] hover:border-[#00F0FF]/50'
              }`}
              title="Haz clic para seleccionar archivos, arrastra aquí o presiona Ctrl+V para pegar capturas"
            >
              <div className="flex flex-col items-center justify-center gap-1.5">
                <div className="w-9 h-9 rounded-full bg-[#00F0FF]/15 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/30 flex items-center justify-center text-sm shadow-2xs">
                  <Paperclip className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {isDragging ? '¡Suelta los archivos aquí!' : 'Arrastra archivos aquí o haz clic para examinar'}
                </p>
                <p className="text-[10px] text-slate-400">
                  Soporta capturas con <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-[#1C1D2A] border border-slate-200 dark:border-[#252636] rounded font-mono text-[9px] text-slate-600 dark:text-slate-400">Ctrl+V</kbd>, imágenes y documentos
                </p>
                {isUploading && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-cyan-600 dark:text-[#00F0FF] font-semibold animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo archivo...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Uploaded Evidences List in Expanded Tray */}
          {evidencias.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                Archivos adjuntos ({evidencias.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {evidencias.map((ev, idx) => {
                  const isImg = ev.tipo?.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(ev.nombre);
                  return (
                    <div
                      key={ev.id || idx}
                      className="flex items-center justify-between gap-2 p-2 px-2.5 bg-white dark:bg-[#161722] rounded-xl border border-slate-200 dark:border-[#252636] hover:border-[#00F0FF]/40 transition shadow-2xs"
                    >
                      <div
                        onClick={() => openPreview(idx)}
                        className="flex items-center gap-2 min-w-0 cursor-pointer flex-1"
                        title={`Ver ${ev.nombre}`}
                      >
                        {isImg ? (
                          <img
                            src={ev.url}
                            alt=""
                            className="w-6 h-6 rounded-md object-cover border border-slate-200 dark:border-[#252636] shrink-0"
                          />
                        ) : (
                          <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate hover:text-[#00F0FF] dark:hover:text-[#00F0FF]">
                            {ev.nombre}
                          </p>
                          <p className="text-[9px] text-slate-400 font-mono">
                            {formatSize(ev.tamano)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openPreview(idx)}
                          className="px-2.5 py-0.5 text-[10px] font-semibold text-cyan-600 dark:text-[#00F0FF] bg-[#00F0FF]/10 dark:bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 border border-[#00F0FF]/30 rounded-full transition cursor-pointer"
                        >
                          Ver
                        </button>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => handleRemove(ev.id, idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            title="Eliminar evidencia"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Viewer Lightbox Modal */}
      <EvidenceViewerModal
        isOpen={viewerOpen}
        evidencias={evidencias}
        initialIndex={viewerIndex}
        onClose={() => setViewerOpen(false)}
        onDelete={!disabled ? (id) => handleRemove(id) : undefined}
      />
    </div>
  );
};
