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
      // Asegurar que todos los enlaces tengan target="_blank" y rel="noopener noreferrer"
      return raw.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"([^>]*)>/gi, (match, url, rest) => {
        const hasTarget = /target=/i.test(rest);
        const hasRel = /rel=/i.test(rest);
        let updated = rest;
        if (!hasTarget) updated += ' target="_blank"';
        if (!hasRel) updated += ' rel="noopener noreferrer"';
        return `<a href="${url}"${updated} class="text-cyan-600 dark:text-[#00F0FF] font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity">`;
      });
    }

    // Si es texto plano, autovincular URLs http/https y preservar saltos de línea
    const urlPattern = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
    const withLinks = raw.replace(
      urlPattern,
      (url) =>
        `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-cyan-600 dark:text-[#00F0FF] font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity inline-flex items-center gap-0.5">${url}</a>`
    );

    // Convertir saltos de línea a <br />
    return withLinks.replace(/\n/g, '<br />');
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

  return (
    <div
      style={clampStyle}
      className={`prose prose-sm dark:prose-invert max-w-none text-xs sm:text-sm font-medium leading-relaxed text-slate-800 dark:text-slate-200 break-words [&_p]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_li]:my-0.5 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:my-1.5 [&_h3]:text-slate-900 dark:[&_h3]:text-white [&_strong]:text-slate-950 dark:[&_strong]:text-white [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:bg-slate-100 dark:[&_code]:bg-white/10 [&_code]:text-cyan-600 dark:[&_code]:text-[#00F0FF] [&_code]:font-mono [&_code]:text-[11px] [&_img]:max-h-48 [&_img]:rounded-xl [&_img]:border [&_img]:border-slate-200 dark:[&_img]:border-white/10 [&_img]:my-2 ${className}`}
      dangerouslySetInnerHTML={{ __html: processedHtml }}
    />
  );
};
