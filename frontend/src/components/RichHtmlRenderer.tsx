import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

const LINK_CLASS =
  'text-cyan-600 dark:text-[#00F0FF] font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity';

// Lista blanca estricta: solo formato de texto, listas, enlaces, imágenes y código.
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'mark', 'small', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'span', 'div',
    'a', 'img', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target', 'rel', 'width', 'height', 'colspan', 'rowspan'],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|data:image\/(?:png|jpe?g|gif|webp);base64,|\/|#)/i,
};

let hooksInstalled = false;
const ensureHooks = () => {
  if (hooksInstalled) return;
  hooksInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
      const existing = node.getAttribute('class') || '';
      if (!existing.includes('underline')) node.setAttribute('class', `${existing} ${LINK_CLASS}`.trim());
    }
  });
};

export const sanitizeHtml = (html: string): string => {
  ensureHooks();
  return DOMPurify.sanitize(html, PURIFY_CONFIG) as unknown as string;
};

interface RichHtmlRendererProps {
  content?: string | null;
  className?: string;
  clampLines?: number;
  fallbackText?: string;
}

/**
 * Renderiza descripciones con soporte tanto para HTML enriquecido (WYSIWYG)
 * como para texto plano con URLs autovínculadas y saltos de línea.
 */
export const RichHtmlRenderer: React.FC<RichHtmlRendererProps> = ({
  content,
  className = '',
  clampLines,
  fallbackText = 'Sin descripción',
}) => {
  const processedHtml = useMemo(() => {
    if (!content || !content.trim()) return null;

    const raw = content.trim();
    // Detectar si ya contiene etiquetas HTML
    const hasHtmlTags = /<[a-z][\s\S]*>/i.test(raw);

    if (hasHtmlTags) {
      // DOMPurify elimina scripts, manejadores on*, iframes, javascript: URIs, SVG, etc.
      return sanitizeHtml(raw);
    }

    // Si es texto plano, soportar bloques de código markdown, backticks inline, tickets y URLs
    let parsed = raw;

    // 1. Bloques de código multilínea ```código```
    parsed = parsed.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, (_match, codeContent) => {
      const escaped = codeContent
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<pre class="my-2 p-2.5 bg-slate-900 dark:bg-black/80 text-emerald-400 dark:text-emerald-300 rounded-xl font-mono text-xs overflow-x-auto border border-slate-800 dark:border-white/10 shadow-xs leading-relaxed"><code>${escaped.trim()}</code></pre>`;
    });

    // 2. Código inline `comando`
    parsed = parsed.replace(/`([^`\n]+)`/g, (_match, inlineCode) => {
      const escaped = inlineCode
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return `<code class="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-cyan-700 dark:text-[#00F0FF] font-mono text-[11px] font-semibold border border-slate-200/60 dark:border-white/10">${escaped}</code>`;
    });

    // 3. Autovincular URLs http/https
    const urlPattern = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
    parsed = parsed.replace(
      urlPattern,
      (url) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-cyan-600 dark:text-[#00F0FF] font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity inline-flex items-center gap-0.5">${url}</a>`
    );

    // Convertir saltos de línea a <br /> preservando los bloques <pre>
    const parts = parsed.split(/(<pre[\s\S]*?<\/pre>)/gi);
    return sanitizeHtml(
      parts.map((part) => (part.startsWith('<pre') ? part : part.replace(/\n/g, '<br />'))).join('')
    );
  }, [content]);

  if (!processedHtml) {
    return (
      <span className="text-slate-400 dark:text-slate-500 italic text-xs">
        {fallbackText}
      </span>
    );
  }

  const clampStyle = clampLines
    ? {
        display: '-webkit-box',
        WebkitLineClamp: clampLines,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden',
      }
    : undefined;

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target && target.tagName === 'IMG') {
      const src = (target as HTMLImageElement).src;
      if (src) {
        window.open(src, '_blank', 'noopener,noreferrer');
      }
    }
  };

  return (
    <div
      style={clampStyle}
      onClick={handleImageClick}
      className={`prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200 break-words [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-1.5 [&_h3]:text-slate-900 dark:[&_h3]:text-white [&_strong]:text-slate-950 dark:[&_strong]:text-white [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-slate-100 dark:[&_code]:bg-white/10 [&_code]:text-cyan-600 dark:[&_code]:text-[#00F0FF] [&_code]:font-mono [&_code]:text-[11px] [&_img]:max-h-56 [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 dark:[&_img]:border-white/10 [&_img]:my-2 [&_img]:cursor-pointer hover:[&_img]:opacity-90 [&_img]:transition-opacity ${className}`}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
};
