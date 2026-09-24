import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Heading,
  Code,
  Link as LinkIcon,
  Paperclip,
  Image as ImageIcon,
  Eraser,
  Code2,
  Eye,
  Loader2,
  Check,
  X,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { Evidencia } from '../types';

interface HtmlEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onAttachEvidence?: (evidencia: Evidencia) => void;
  className?: string;
  minHeight?: string;
}

export const HtmlEditor: React.FC<HtmlEditorProps> = ({
  value,
  onChange,
  placeholder = 'Describe lo realizado en esta actividad...',
  onAttachEvidence,
  className = '',
  minHeight = '130px',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [isRawHtml, setIsRawHtml] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  // Mantener sincronizado el editor con el valor entrante si cambia externamente
  useEffect(() => {
    if (editorRef.current && !isRawHtml) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
  }, [value, isRawHtml]);

  // Manejar cambios en el contenido
  const handleContentChange = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      // Normalizar vacío si sólo contiene <br> o <p><br></p>
      if (html === '<br>' || html === '<p><br></p>' || html.trim() === '') {
        onChange('');
      } else {
        onChange(html);
      }
    }
  };

  // Comandos de formato usando document.execCommand
  const executeCmd = (command: string, val: string | undefined = undefined) => {
    if (isRawHtml) return;
    document.execCommand(command, false, val);
    if (editorRef.current) {
      editorRef.current.focus();
    }
    handleContentChange();
  };

  // Guardar selección para modal de enlace
  const handleOpenLinkModal = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      setSavedRange(range);
      const selectedText = sel.toString().trim();
      setLinkText(selectedText);
      setLinkUrl('');
    } else {
      setSavedRange(null);
      setLinkText('');
      setLinkUrl('');
    }
    setShowLinkModal(true);
  };

  const handleApplyLink = () => {
    if (!linkUrl.trim()) {
      setShowLinkModal(false);
      return;
    }

    let urlToInsert = linkUrl.trim();
    if (!/^https?:\/\//i.test(urlToInsert) && !/^mailto:/i.test(urlToInsert)) {
      urlToInsert = 'https://' + urlToInsert;
    }

    const textToInsert = linkText.trim() || urlToInsert;

    if (editorRef.current) {
      editorRef.current.focus();

      // Restaurar selección previa
      if (savedRange) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(savedRange);
        }
      }

      // Crear enlace HTML seguro
      const linkHtml = `<a href="${urlToInsert}" target="_blank" rel="noopener noreferrer" class="text-cyan-600 dark:text-[#00F0FF] underline font-semibold hover:opacity-80">${textToInsert}</a> `;
      document.execCommand('insertHTML', false, linkHtml);
      handleContentChange();
    }

    setShowLinkModal(false);
    setLinkUrl('');
    setLinkText('');
    setSavedRange(null);
  };

  // Manejo de carga de archivos (imágenes o adjuntos)
  const processUploadFile = async (file: File, isImageOnly = false) => {
    setIsUploading(true);
    try {
      const evidencia = await api.uploadFile(file);

      // Notificar al componente padre para que se agregue a la lista de evidencias
      if (onAttachEvidence) {
        onAttachEvidence(evidencia);
      }

      // Insertar visualmente en el editor
      if (editorRef.current && !isRawHtml) {
        editorRef.current.focus();
        if (file.type.startsWith('image/')) {
          const imgHtml = `<p><img src="${evidencia.url}" alt="${evidencia.nombre}" class="max-h-56 rounded-xl my-2 border border-slate-200 dark:border-white/10 shadow-xs inline-block" /></p><br/>`;
          document.execCommand('insertHTML', false, imgHtml);
        } else {
          const linkHtml = `<p><a href="${evidencia.url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 my-1 bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-cyan-300 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-white/15 transition-all">📎 ${evidencia.nombre}</a></p><br/>`;
          document.execCommand('insertHTML', false, linkHtml);
        }
        handleContentChange();
      }
    } catch (e: any) {
      console.error('Error al subir archivo en HtmlEditor:', e);
      alert(`No se pudo subir el archivo: ${e.message || 'Error de conexión'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Pegado de imágenes con Ctrl+V
  const handlePaste = (e: React.ClipboardEvent) => {
    if (isRawHtml) return;

    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const renamedFile = new File([file], `captura-${timestamp}.png`, { type: file.type });
            processUploadFile(renamedFile, true);
            return;
          }
        }
      }
    }
  };

  // Drag and drop de archivos
  const handleDrop = (e: React.DragEvent) => {
    if (isRawHtml) return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      e.preventDefault();
      for (let i = 0; i < files.length; i++) {
        processUploadFile(files[i]);
      }
    }
  };

  // Atajos de teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isRawHtml) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        executeCmd('bold');
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        executeCmd('italic');
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        executeCmd('underline');
      } else if (e.key === 'k' || e.key === 'K') {
        e.preventDefault();
        handleOpenLinkModal();
      }
    }
  };

  // Cálculo de conteo de palabras y caracteres
  const charCount = value ? value.replace(/<[^>]*>/g, '').length : 0;
  const wordCount = value
    ? value
        .replace(/<[^>]*>/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean).length
    : 0;

  return (
    <div className={`flex flex-col rounded-2xl border border-slate-200 dark:border-[#252636] bg-slate-50 dark:bg-[#161722] overflow-hidden focus-within:border-[#00F0FF] focus-within:ring-1 focus-within:ring-[#00F0FF]/30 transition-all ${className}`}>
      {/* Barra de herramientas superior */}
      <div className="flex flex-wrap items-center justify-between gap-1 p-2 bg-slate-100/90 dark:bg-[#1A1C29] border-b border-slate-200/80 dark:border-[#252636] text-slate-700 dark:text-slate-300">
        {/* Herramientas de formato */}
        <div className="flex items-center gap-0.5 flex-wrap">
          <button
            type="button"
            onClick={() => executeCmd('bold')}
            disabled={isRawHtml}
            title="Negrita (Ctrl+B)"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCmd('italic')}
            disabled={isRawHtml}
            title="Cursiva (Ctrl+I)"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCmd('underline')}
            disabled={isRawHtml}
            title="Subrayado (Ctrl+U)"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCmd('strikeThrough')}
            disabled={isRawHtml}
            title="Tachado"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-slate-300 dark:bg-white/10 mx-1" />

          <button
            type="button"
            onClick={() => executeCmd('formatBlock', '<h3>')}
            disabled={isRawHtml}
            title="Título / Encabezado"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <Heading className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCmd('insertUnorderedList')}
            disabled={isRawHtml}
            title="Lista con viñetas"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCmd('insertOrderedList')}
            disabled={isRawHtml}
            title="Lista numerada"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCmd('formatBlock', '<pre>')}
            disabled={isRawHtml}
            title="Bloque de código"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <Code className="w-4 h-4" />
          </button>

          <span className="w-px h-4 bg-slate-300 dark:bg-white/10 mx-1" />

          {/* Enlace */}
          <button
            type="button"
            onClick={handleOpenLinkModal}
            disabled={isRawHtml}
            title="Insertar enlace (Ctrl+K)"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-cyan-600 dark:text-[#00F0FF] disabled:opacity-30 cursor-pointer transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
          </button>

          {/* Adjuntar Imagen */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={isRawHtml || isUploading}
            title="Adjuntar Imagen (también puedes pegar con Ctrl+V)"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-[#00F0FF]" /> : <ImageIcon className="w-4 h-4" />}
          </button>

          {/* Adjuntar Archivo */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRawHtml || isUploading}
            title="Adjuntar Documento o Archivo"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Limpiar formato */}
          <button
            type="button"
            onClick={() => executeCmd('removeFormat')}
            disabled={isRawHtml}
            title="Limpiar formato"
            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 disabled:opacity-30 cursor-pointer transition-colors"
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Interruptor de modo: Visual / Código HTML */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsRawHtml(!isRawHtml)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
              isRawHtml
                ? 'bg-[#00F0FF]/20 text-[#00A3BF] dark:text-[#00F0FF] border border-[#00F0FF]/40'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'
            }`}
            title={isRawHtml ? 'Cambiar a modo visual WYSIWYG' : 'Ver y editar código HTML'}
          >
            {isRawHtml ? (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Visual</span>
              </>
            ) : (
              <>
                <Code2 className="w-3.5 h-3.5" />
                <span>HTML</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Inputs ocultos para adjuntos */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processUploadFile(file);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processUploadFile(file, true);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Popover / Modal inline de inserción de enlaces */}
      {showLinkModal && (
        <div className="p-3 bg-white dark:bg-[#1A1C29] border-b border-slate-200 dark:border-[#252636] flex flex-col sm:flex-row items-center gap-2 animate-in fade-in duration-150">
          <div className="flex-1 w-full flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-[#00F0FF] shrink-0" />
            <input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://ejemplo.com o link de tarea..."
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#13141F] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-[#252636] focus:border-[#00F0FF] outline-hidden"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyLink();
                } else if (e.key === 'Escape') {
                  setShowLinkModal(false);
                }
              }}
            />
          </div>
          <div className="flex-1 w-full flex items-center gap-2">
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="Texto visible (opcional)"
              className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#13141F] text-slate-800 dark:text-slate-100 rounded-lg border border-slate-200 dark:border-[#252636] focus:border-[#00F0FF] outline-hidden"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyLink();
                } else if (e.key === 'Escape') {
                  setShowLinkModal(false);
                }
              }}
            />
          </div>
          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={handleApplyLink}
              className="px-3 py-1.5 bg-[#00F0FF] hover:bg-[#00D4E0] text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Insertar</span>
            </button>
            <button
              type="button"
              onClick={() => setShowLinkModal(false)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Área del editor */}
      <div className="relative flex-1 p-3 text-slate-800 dark:text-slate-100" style={{ minHeight }}>
        {isRawHtml ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Introduce código HTML directo..."
            style={{ minHeight }}
            className="w-full h-full font-mono text-xs bg-transparent outline-hidden resize-y text-slate-800 dark:text-slate-200"
          />
        ) : (
          <>
            <div
              ref={editorRef}
              contentEditable
              onInput={handleContentChange}
              onPaste={handlePaste}
              onDrop={handleDrop}
              onKeyDown={handleKeyDown}
              role="textbox"
              aria-multiline="true"
              style={{ minHeight: `calc(${minHeight} - 20px)` }}
              className="w-full outline-hidden text-xs sm:text-sm font-medium leading-relaxed prose prose-sm dark:prose-invert max-w-none break-words [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-1 [&_h3]:text-slate-900 dark:[&_h3]:text-white [&_strong]:text-slate-950 dark:[&_strong]:text-white [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-slate-200/80 dark:[&_code]:bg-white/10 [&_code]:text-cyan-600 dark:[&_code]:text-[#00F0FF] [&_code]:font-mono [&_code]:text-[11px] [&_img]:max-h-48 [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 dark:[&_img]:border-white/10 [&_img]:my-2"
            />
            {(!value || value === '<p><br></p>' || value === '<br>' || value.trim() === '') && (
              <div
                onClick={() => editorRef.current?.focus()}
                className="absolute top-3 left-3 text-slate-400 dark:text-slate-500 text-xs sm:text-sm pointer-events-none select-none italic"
              >
                {placeholder}
              </div>
            )}
          </>
        )}
      </div>

      {/* Barra de pie de página: Contador e indicaciones */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100/50 dark:bg-[#1A1C29]/50 border-t border-slate-200/60 dark:border-[#252636] text-[10px] text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-2">
          <span>Pega capturas con <strong>Ctrl+V</strong></span>
          <span>•</span>
          <span>Arrastra y suelta archivos</span>
        </span>
        <div className="flex items-center gap-2 font-mono">
          <span>{wordCount} palabras</span>
          <span>•</span>
          <span>{charCount} caracteres</span>
        </div>
      </div>
    </div>
  );
};
