import React, { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';

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
      // Sanitizar scripts básicos y manejadores inline peligrosos
      let sanitized = raw
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/\son\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '')
        .replace(/href\s*=\s*(['"])javascript:[^'"]*\1/gi, 'href="#"');

      // Asegurar que todos los enlaces tengan target="_blank", rel y clases estilizadas sin duplicar atributos
      return sanitized.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
        let cleanAttrs = attrs;
        if (!/target=/i.test(cleanAttrs)) cleanAttrs += ' target="_blank"';
        if (!/rel=/i.test(cleanAttrs)) cleanAttrs += ' rel="noopener noreferrer"';
        
        const linkClass = 'text-cyan-600 dark:text-[#00F0FF] font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity';
        if (/class="/i.test(cleanAttrs)) {
          cleanAttrs = cleanAttrs.replace(/class="([^"]*)"/i, (_m: string, c: string) => `class="${c} ${linkClass}"`);
        } else if (/class='/i.test(cleanAttrs)) {
          cleanAttrs = cleanAttrs.replace(/class='([^']*)'/i, (_m: string, c: string) => `class='${c} ${linkClass}'`);
        } else {
          cleanAttrs += ` class="${linkClass}"`;
        }
        return `<a${cleanAttrs}>`;
      });
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
    return parts
      .map((part) => (part.startsWith('<pre') ? part : part.replace(/\n/g, '<br />')))
      .join('');
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
