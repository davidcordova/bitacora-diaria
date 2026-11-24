import { ChecklistItemNota, ColorAcentoNota, TipoNota, VisibilidadNota } from '../../types';

export const TIPOS_NOTA_CONFIG: Record<
  TipoNota,
  { label: string; shortLabel: string; placeholder: string; defaultContent: string }
> = {
  apunte: {
    label: 'Apunte libre',
    shortLabel: 'Apunte',
    placeholder: 'Anota ideas, acuerdos o contexto...',
    defaultContent: '',
  },
  checklist: {
    label: 'Checklist accionable',
    shortLabel: 'Checklist',
    placeholder: 'Describe el objetivo de esta lista de tareas...',
    defaultContent: '',
  },
  reunion: {
    label: 'Minuta de reunión',
    shortLabel: 'Minuta',
    placeholder: 'Resume participantes, temas tratados y acuerdos...',
    defaultContent:
      '<p><strong>Participantes:</strong> </p><p><strong>Temas tratados:</strong></p><ul><li></li></ul><p><strong>Acuerdos clave:</strong></p><ul><li></li></ul>',
  },
  tecnica: {
    label: 'Nota técnica / Snippet',
    shortLabel: 'Técnica',
    placeholder: 'Documenta comandos, rutas, consultas o configuraciones...',
    defaultContent:
      '<p><strong>Contexto técnico:</strong></p><pre><code># Pega aquí comandos o configuración</code></pre>',
  },
};

export const ACCENT_COLORS: Record<
  ColorAcentoNota,
  { label: string; border: string; dot: string; badge: string }
> = {
  slate: {
    label: 'Neutro',
    border: 'border-l-slate-400 dark:border-l-slate-500',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 dark:bg-white/[0.06] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-white/10',
  },
  sky: {
    label: 'Azul',
    border: 'border-l-sky-500',
    dot: 'bg-sky-500',
    badge: 'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-500/25',
  },
  emerald: {
    label: 'Verde',
    border: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25',
  },
  amber: {
    label: 'Ámbar',
    border: 'border-l-amber-500',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/25',
  },
  rose: {
    label: 'Urgente',
    border: 'border-l-rose-500',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/25',
  },
};

export const VISIBILIDAD_LABELS: Record<VisibilidadNota, { label: string; desc: string }> = {
  personal: { label: 'Personal', desc: 'Solo visible para ti' },
  compartida: { label: 'Compartida', desc: 'Visible para compañeros elegidos' },
  equipo: { label: 'Equipo', desc: 'Visible para tu equipo y líder' },
};

export function getChecklistProgress(items?: ChecklistItemNota[] | null) {
  const list = Array.isArray(items) ? items : [];
  const total = list.length;
  const done = list.filter((i) => i.completado).length;
  return { total, done, percent: total > 0 ? Math.round((done / total) * 100) : 0 };
}

/** Convierte líneas de texto plano en ítems iniciales de checklist. */
export function parseChecklistLines(rawText: string): ChecklistItemNota[] {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((texto, idx) => ({
      id: `chk-${Date.now()}-${idx}`,
      texto,
      completado: false,
      actividad_id: null,
    }));
}

/** Convierte texto plano multilínea de nota rápida en HTML seguro de párrafo. */
export function formatQuickNotaHtml(rawText: string): string {
  const trimmed = rawText.trim();
  if (!trimmed) return '';
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${escaped.replace(/\n/g, '<br />')}</p>`;
}

export function buildPrefillFromNota(
  nota: {
    id: number;
    titulo: string;
    contenido?: string;
    para_cliente?: string;
    tipo_nota?: TipoNota;
    evidencias?: any[];
  },
  checklistItem?: ChecklistItemNota
) {
  if (checklistItem) {
    return {
      notaId: nota.id,
      notaTitulo: nota.titulo,
      checklistItemId: checklistItem.id,
      descripcion: `${checklistItem.texto} (de nota: ${nota.titulo})`,
      paraCliente: nota.para_cliente || '',
      tipoTrabajo: nota.tipo_nota === 'tecnica' ? 'Desarrollo' : 'Gestión / Coordinación',
      evidencias: [],
      estadoInicial: 'en_proceso' as const,
    };
  }
  const cleanBody = (nota.contenido || '').trim();
  const desc = cleanBody
    ? `<p><strong>${nota.titulo}</strong></p>${cleanBody}`
    : nota.titulo;
  return {
    notaId: nota.id,
    notaTitulo: nota.titulo,
    checklistItemId: null,
    descripcion: desc,
    paraCliente: nota.para_cliente || '',
    tipoTrabajo: nota.tipo_nota === 'tecnica' ? 'Desarrollo' : 'Gestión / Coordinación',
    evidencias: nota.evidencias || [],
    estadoInicial: 'en_proceso' as const,
  };
}
