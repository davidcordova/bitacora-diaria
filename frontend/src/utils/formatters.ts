import { Bitacora, Actividad } from '../types';

export const formatDuration = (totalMinutes: number): string => {
  if (!totalMinutes || totalMinutes <= 0) return '0 min (0 h 0 min)';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  return `${totalMinutes} min (${hours} h ${minutes > 0 ? `${minutes} min` : ''})`.trim();
};

export const formatDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export const formatDateLong = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const monthNames = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    return `${dayNames[date.getDay()]}, ${d} de ${monthNames[date.getMonth()]} de ${y}`;
  } catch {
    return dateStr;
  }
};

export const getTodayLocalDateStr = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const shiftDateByDays = (dateStr: string, days: number): string => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + days);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
};

export const getYesterdayLocalDateStr = (): string => {
  return shiftDateByDays(getTodayLocalDateStr(), -1);
};

export const getEstadoBadgeInfo = (estado: string) => {
  switch (estado) {
    case 'completada':
      return {
        label: 'Completada',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60',
        dot: 'bg-emerald-500',
        icon: '✓',
      };
    case 'en_proceso':
      return {
        label: 'En proceso',
        bg: 'bg-sky-50 dark:bg-[#00F0FF]/15 text-sky-700 dark:text-[#00F0FF] border-sky-200 dark:border-[#00F0FF]/30',
        dot: 'bg-[#00F0FF]',
        icon: '⏳',
      };
    case 'en_revision':
      return {
        label: 'En revisión',
        bg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60',
        dot: 'bg-amber-500',
        icon: '👁',
      };
    case 'pendiente':
    default:
      return {
        label: 'Por iniciar',
        bg: 'bg-slate-100 dark:bg-[#1A1C29] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#252636]',
        dot: 'bg-slate-400',
        icon: '📋',
      };
  }
};

export interface TimeInStatusInfo {
  label: string;
  isStalled: boolean;
  hours: number;
  days: number;
  tooltip: string;
}

export const getTimeInStatusInfo = (
  updatedAt?: string,
  createdAt?: string,
  estado?: string
): TimeInStatusInfo => {
  const dateStr = updatedAt || createdAt;
  if (!dateStr) {
    return {
      label: 'Reciente',
      isStalled: false,
      hours: 0,
      days: 0,
      tooltip: 'Actividad recién creada en esta jornada',
    };
  }

  // Parse date - handles SQLite 'YYYY-MM-DD HH:MM:SS' or ISO string
  const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const timestamp = new Date(normalized).getTime();
  if (isNaN(timestamp)) {
    return {
      label: 'Reciente',
      isStalled: false,
      hours: 0,
      days: 0,
      tooltip: 'Actividad registrada recientemente',
    };
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const days = Math.floor(hours / 24);

  let label = '';
  if (days >= 2) {
    label = `${days} días en este estado`;
  } else if (days === 1) {
    label = `1 día en este estado`;
  } else if (hours >= 1) {
    label = `${hours}h en este estado`;
  } else if (totalMinutes > 0) {
    label = `${totalMinutes}m en este estado`;
  } else {
    label = 'Reciente';
  }

  // Se considera estancada si no está completada y lleva >= 24h en proceso/revisión o >= 48h pendiente
  const isStalled =
    estado !== 'completada' &&
    ((estado === 'en_proceso' && hours >= 24) ||
      (estado === 'en_revision' && hours >= 24) ||
      (estado === 'pendiente' && hours >= 48));

  const tooltip = isStalled
    ? `⚠️ Alerta: Lleva ${label} sin avance. Requiere priorización.`
    : `Tiempo transcurrido en el estado actual: ${label}`;

  return { label, isStalled, hours, days, tooltip };
};

export const stripHtml = (html?: string): string => {
  if (!html) return '';
  // Convert common block elements and breaks to newlines before stripping
  const withLineBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/div>/gi, '\n');
  
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('div');
    tmp.innerHTML = withLineBreaks;
    return (tmp.textContent || tmp.innerText || '').trim();
  }
  return withLineBreaks.replace(/<[^>]+>/g, '').trim();
};

export const generateSummaryText = (bitacora: Bitacora): string => {
  const totalMin = bitacora.actividades.reduce(
    (acc, cur) => acc + (Number(cur.duracion_min) || 0),
    0
  );
  const duracionTexto = formatDuration(totalMin);
  const fechaFormateada = formatDateDisplay(bitacora.fecha);

  let text = `BITÁCORA DIARIA DE ACTIVIDADES\n`;
  text += `📅 Fecha: ${fechaFormateada}\n`;
  text += `👤 Colaborador: ${bitacora.colaborador}\n`;
  text += `🏢 Área: ${bitacora.area}\n`;
  if (bitacora.hora_inicio) {
    text += `⏰ Hora de inicio: ${bitacora.hora_inicio}\n`;
  }
  text += `\nACTIVIDADES\n`;

  bitacora.actividades.forEach((act, idx) => {
    const estadoInfo = getEstadoBadgeInfo(act.estado);
    text += `${idx + 1}. ${act.hora_inicio || '--:--'} | ${act.duracion_min || 0} min ${
      act.tipo_trabajo ? `[${act.tipo_trabajo}]` : ''
    }\n`;
    text += `   ${stripHtml(act.descripcion)}\n`;
    if (act.para_cliente) {
      text += `   Para: ${act.para_cliente} | Estado: ${estadoInfo.label}\n`;
    } else {
      text += `   Estado: ${estadoInfo.label}\n`;
    }
    if (act.evidencias && act.evidencias.length > 0) {
      text += `   📎 Evidencias (${act.evidencias.length}): ${act.evidencias.map((e) => e.nombre).join(', ')}\n`;
    }
  });

  text += `\n⏱️ Tiempo total de actividades: ${duracionTexto}\n\n`;
  text += `CIERRE DE JORNADA\n`;
  text += `📌 Pendientes: ${bitacora.pendientes || 'Ninguno'}\n`;
  text += `🤝 Requiere apoyo: ${bitacora.necesita_apoyo}${
    bitacora.necesita_apoyo === 'Si' && bitacora.apoyo_detalle
      ? ` (${bitacora.apoyo_detalle})`
      : ''
  }\n`;
  text += `🚀 Prioridad siguiente día: ${
    bitacora.prioridad_siguiente || 'Continuar con tareas programadas'
  }\n`;

  return text;
};

export const exportActivitiesToCSV = (
  activities: Actividad[],
  filenamePrefix = 'actividades_equipo'
) => {
  const headers = [
    'ID',
    'Colaborador',
    'Hora Inicio',
    'Duracion (min)',
    'Tipo de Trabajo',
    'Descripcion',
    'Cliente / Para',
    'Estado',
    'Evidencias (Cant)',
    'Tiempo Acumulado (min)',
    'Ultima Actualizacion',
  ];

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = activities.map((act) => [
    escapeCSV(act.id || ''),
    escapeCSV(act.colaborador || 'No especificado'),
    escapeCSV(act.hora_inicio || ''),
    escapeCSV(act.duracion_min || 0),
    escapeCSV(act.tipo_trabajo || ''),
    escapeCSV(stripHtml(act.descripcion) || ''),
    escapeCSV(act.para_cliente || ''),
    escapeCSV(getEstadoBadgeInfo(act.estado).label),
    escapeCSV(act.evidencias ? act.evidencias.length : 0),
    escapeCSV(act.tiempo_acumulado_min || act.duracion_min || 0),
    escapeCSV(act.updated_at || act.created_at || ''),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
