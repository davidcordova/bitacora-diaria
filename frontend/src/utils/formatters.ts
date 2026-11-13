import { Bitacora, Actividad } from '../types';

export const formatDuration = (totalMinutes: number): string => {
  if (!totalMinutes || totalMinutes <= 0) return '0 min';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes} min`;
  }
  if (minutes === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${minutes} min`;
};

export const formatHoursClean = (totalMinutes: number): string => {
  if (!totalMinutes || totalMinutes <= 0) return '0h 0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

export const isDiaLaborable = (fechaStr?: string): boolean => {
  if (!fechaStr) {
    const day = new Date().getDay();
    return day >= 1 && day <= 5;
  }
  try {
    const [y, m, d] = fechaStr.split('-').map(Number);
    if (!y || !m || !d) return true;
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    return day >= 1 && day <= 5;
  } catch {
    return true;
  }
};

/**
 * Calcula la hora fin a partir de una hora inicio (HH:MM) y duración en minutos.
 * De lunes a viernes excluye el refrigerio de 1h (1:00 PM a 2:00 PM) para reflejar la jornada real.
 */
export const calculateHoraFin = (
  horaInicio: string,
  duracionMin: number,
  fechaStr?: string,
  aplicarRefrigerio = true
): string => {
  if (!horaInicio) return '';
  const [hStr, mStr] = horaInicio.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return '';
  
  const dur = Math.max(0, duracionMin || 0);
  const startMin = h * 60 + m;
  
  let endMin = startMin;
  const esLaborable = isDiaLaborable(fechaStr);
  
  if (aplicarRefrigerio && esLaborable && dur > 0) {
    const LUNCH_START = 13 * 60; // 13:00 (780 min)
    const LUNCH_END = 14 * 60;   // 14:00 (840 min)
    
    if (startMin < LUNCH_START) {
      const availBefore = LUNCH_START - startMin;
      if (dur <= availBefore) {
        endMin = startMin + dur;
      } else {
        const rem = dur - availBefore;
        endMin = LUNCH_END + rem;
      }
    } else if (startMin < LUNCH_END) {
      endMin = LUNCH_END + dur;
    } else {
      endMin = startMin + dur;
    }
  } else {
    endMin = startMin + dur;
  }
  
  const finalH = Math.floor(endMin / 60) % 24;
  const finalM = endMin % 60;
  return `${String(finalH).padStart(2, '0')}:${String(finalM).padStart(2, '0')}`;
};

/**
 * Calcula los minutos transcurridos efectivos entre hora inicio y hora fin (HH:MM).
 * De lunes a viernes descuenta automáticamente los minutos de refrigerio (1:00 PM a 2:00 PM).
 */
export const calculateDuracionMin = (
  horaInicio: string,
  horaFin: string,
  fechaStr?: string,
  aplicarRefrigerio = true
): number => {
  if (!horaInicio || !horaFin) return 0;
  const [h1Str, m1Str] = horaInicio.split(':');
  const [h2Str, m2Str] = horaFin.split(':');
  const h1 = parseInt(h1Str, 10);
  const m1 = parseInt(m1Str, 10);
  const h2 = parseInt(h2Str, 10);
  const m2 = parseInt(m2Str, 10);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  
  const s = h1 * 60 + m1;
  let e = h2 * 60 + m2;
  if (e < s) {
    e += 24 * 60; // Cruce de medianoche
  }
  const total = e - s;
  
  const esLaborable = isDiaLaborable(fechaStr);
  if (aplicarRefrigerio && esLaborable && total > 0) {
    const LUNCH_START = 13 * 60; // 780
    const LUNCH_END = 14 * 60;   // 840
    
    const overlapStart = Math.max(s, LUNCH_START);
    const overlapEnd = Math.min(e, LUNCH_END);
    const overlap = Math.max(0, overlapEnd - overlapStart);
    
    return Math.max(0, total - overlap);
  }
  
  return total;
};

/**
 * Retorna cuántos minutos de refrigerio (1:00 PM a 2:00 PM) solapa la tarea.
 */
export const getRefrigerioMinutos = (
  horaInicio: string,
  horaFin: string,
  fechaStr?: string
): number => {
  if (!horaInicio || !horaFin) return 0;
  if (!isDiaLaborable(fechaStr)) return 0;
  const [h1Str, m1Str] = horaInicio.split(':');
  const [h2Str, m2Str] = horaFin.split(':');
  const h1 = parseInt(h1Str, 10);
  const m1 = parseInt(m1Str, 10);
  const h2 = parseInt(h2Str, 10);
  const m2 = parseInt(m2Str, 10);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  
  const s = h1 * 60 + m1;
  let e = h2 * 60 + m2;
  if (e < s) e += 24 * 60;
  
  const overlapStart = Math.max(s, 13 * 60);
  const overlapEnd = Math.min(e, 14 * 60);
  return Math.max(0, overlapEnd - overlapStart);
};

const parseHhMmToMin = (hhmm?: string): number | null => {
  if (!hhmm) return null;
  const parts = String(hhmm).trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
};

const subtractInterval = (
  intervals: Array<[number, number]>,
  subStart: number,
  subEnd: number
): Array<[number, number]> => {
  if (subEnd <= subStart) return intervals;
  const out: Array<[number, number]> = [];
  for (const [a, b] of intervals) {
    if (subEnd <= a || subStart >= b) {
      out.push([a, b]);
    } else {
      if (a < subStart) out.push([a, subStart]);
      if (subEnd < b) out.push([subEnd, b]);
    }
  }
  return out;
};

const baseWorkingIntervals = (
  startMin: number | null,
  endMin: number | null,
  fechaStr?: string
): Array<[number, number]> => {
  if (startMin === null || endMin === null) return [];
  let e = endMin;
  if (e < startMin) e += 24 * 60;
  if (e <= startMin) return [];
  let base: Array<[number, number]> = [[startMin, e]];
  if (isDiaLaborable(fechaStr)) {
    const lunchS = 13 * 60;
    const lunchE = 14 * 60;
    if (startMin < lunchS || e > lunchE) {
      base = subtractInterval(base, lunchS, lunchE);
    }
  }
  return base;
};

const intervalsEqual = (a: Array<[number, number]>, b: Array<[number, number]>): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i][0] !== b[i][0] || a[i][1] !== b[i][1]) return false;
  }
  return true;
};

const hasHigherPriority = (
  grossJ: number,
  baseJ: Array<[number, number]>,
  idxJ: number,
  grossI: number,
  baseI: Array<[number, number]>,
  idxI: number
): boolean => {
  if (grossJ !== grossI) return grossJ < grossI;
  if (baseJ[0][0] !== baseI[0][0]) return baseJ[0][0] > baseI[0][0];
  if (baseJ[baseJ.length - 1][1] !== baseI[baseI.length - 1][1]) {
    return baseJ[baseJ.length - 1][1] > baseI[baseI.length - 1][1];
  }
  return idxJ > idxI;
};

/**
 * Recalcula las duraciones netas recursivas de todas las actividades activas de una jornada,
 * descontando automáticamente de las tareas largas el tiempo ocupado por tareas internas más específicas
 * (soportando cualquier profundidad de anidamiento) sin alterar `hora_inicio` ni `hora_fin`.
 */
export const recalculateActivitiesNetDurations = (
  actividades: Actividad[],
  fechaStr?: string
): Actividad[] => {
  if (!actividades || actividades.length === 0) return actividades;

  const parsed = actividades.map((act, idx) => {
    if (act.is_deleted) {
      return { idx, horaFin: act.hora_fin || '', base: [] as Array<[number, number]>, gross: act.duracion_min || 0, isTimed: false };
    }
    const hIni = (act.hora_inicio || '').trim();
    let hFin = (act.hora_fin || '').trim();
    const curDur = Math.max(0, Number(act.duracion_min) || 0);

    if (!hIni) {
      return { idx, horaFin: '', base: [] as Array<[number, number]>, gross: curDur, isTimed: false };
    }
    if (!hFin && curDur > 0) {
      hFin = calculateHoraFin(hIni, curDur, fechaStr);
    }
    const sMin = parseHhMmToMin(hIni);
    const eMin = hFin ? parseHhMmToMin(hFin) : null;
    if (sMin === null || eMin === null) {
      return { idx, horaFin: hFin, base: [] as Array<[number, number]>, gross: curDur, isTimed: false };
    }
    const base = baseWorkingIntervals(sMin, eMin, fechaStr);
    const gross = base.reduce((acc, [a, b]) => acc + (b - a), 0);
    return { idx, horaFin: hFin, base, gross, isTimed: true };
  });

  return actividades.map((act, idx) => {
    const item = parsed[idx];
    if (act.is_deleted || !item.isTimed || item.base.length === 0) {
      const dur = item.isTimed ? 0 : Math.max(0, Number(act.duracion_min) || 0);
      return {
        ...act,
        hora_fin: item.horaFin,
        duracion_min: dur,
        duracion_bruta_min: dur,
        minutos_descontados: 0,
      };
    }

    let eff = [...item.base];
    for (const other of parsed) {
      if (other.idx === item.idx || !other.isTimed || other.base.length === 0) continue;
      if (intervalsEqual(other.base, item.base)) continue;
      if (hasHigherPriority(other.gross, other.base, other.idx, item.gross, item.base, item.idx)) {
        for (const [sj, ej] of other.base) {
          eff = subtractInterval(eff, sj, ej);
        }
        if (eff.length === 0) break;
      }
    }

    const netMin = Math.max(0, eff.reduce((acc, [a, b]) => acc + (b - a), 0));
    const discounted = Math.max(0, item.gross - netMin);
    return {
      ...act,
      hora_fin: item.horaFin,
      duracion_min: netMin,
      duracion_bruta_min: item.gross,
      minutos_descontados: discounted,
    };
  });
};

/**
 * Simula el impacto de solapamiento para el modal de creación/edición antes de guardar.
 */
export const previewCandidateOverlap = (
  horaInicio: string,
  horaFin: string,
  existingActividades: Actividad[],
  editingId?: number | string,
  fechaStr?: string
): {
  grossMin: number;
  netMin: number;
  subtractedFromSelf: number;
  subtractedFromContainers: number;
} => {
  const sMin = parseHhMmToMin(horaInicio);
  const eMin = parseHhMmToMin(horaFin);
  if (sMin === null || eMin === null) {
    return { grossMin: 0, netMin: 0, subtractedFromSelf: 0, subtractedFromContainers: 0 };
  }
  const baseCand = baseWorkingIntervals(sMin, eMin, fechaStr);
  const grossCand = baseCand.reduce((acc, [a, b]) => acc + (b - a), 0);
  if (grossCand <= 0) {
    return { grossMin: 0, netMin: 0, subtractedFromSelf: 0, subtractedFromContainers: 0 };
  }

  const others = (existingActividades || []).filter(
    (a) => !a.is_deleted && (editingId === undefined || String(a.id) !== String(editingId))
  );
  const beforeSim = recalculateActivitiesNetDurations(others, fechaStr);
  const candidateAct: Actividad = {
    id: '__candidate__',
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    duracion_min: grossCand,
    tipo_trabajo: '',
    descripcion: '',
    para_cliente: '',
    estado: 'en_proceso',
  };
  const afterSim = recalculateActivitiesNetDurations([...others, candidateAct], fechaStr);
  const candResult = afterSim[afterSim.length - 1];

  let subtractedFromContainers = 0;
  for (let i = 0; i < others.length; i++) {
    const diff = Math.max(0, (beforeSim[i].duracion_min || 0) - (afterSim[i].duracion_min || 0));
    subtractedFromContainers += diff;
  }

  return {
    grossMin: grossCand,
    netMin: candResult.duracion_min,
    subtractedFromSelf: candResult.minutos_descontados || 0,
    subtractedFromContainers,
  };
};

/**
 * Retorna la hora actual en zona horaria de Perú (America/Lima) formateada en HH:MM.
 */
export const getCurrentTimeStr = (): string => {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Lima',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const hh = parts.find((p) => p.type === 'hour')?.value;
    const mm = parts.find((p) => p.type === 'minute')?.value;
    if (hh && mm) return `${hh === '24' ? '00' : hh}:${mm}`;
  } catch {
    // Fallback al reloj local si Intl no soporta la zona
  }
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
};

/**
 * Retorna la hora actual en zona horaria de Perú redondeada hacia abajo al múltiplo de minutos indicado.
 */
export const getCurrentRoundedTimeStr = (stepMinutes = 5): string => {
  const current = getCurrentTimeStr();
  const [hStr, mStr] = current.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return '08:30';
  const roundedM = Math.floor(m / stepMinutes) * stepMinutes;
  return `${String(h).padStart(2, '0')}:${String(roundedM).padStart(2, '0')}`;
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
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    const d = parts.find((p) => p.type === 'day')?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback al reloj local
  }
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
        bg: 'bg-emerald-50/80 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20',
        dot: 'bg-emerald-500',
        icon: '✓',
      };
    case 'en_proceso':
      return {
        label: 'En proceso',
        bg: 'bg-sky-50/80 dark:bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-200/80 dark:border-sky-500/20',
        dot: 'bg-sky-500 dark:bg-sky-400',
        icon: '⏳',
      };
    case 'en_revision':
      return {
        label: 'En revisión',
        bg: 'bg-amber-50/80 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-500/20',
        dot: 'bg-amber-500',
        icon: '👁',
      };
    case 'pendiente':
    default:
      return {
        label: 'Por iniciar',
        bg: 'bg-slate-100/80 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-slate-700/70',
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

  // Parse date - handles SQLite 'YYYY-MM-DD HH:MM:SS' (America/Lima UTC-5) or ISO string
  let normalized = dateStr;
  if (!dateStr.includes('T')) {
    normalized = dateStr.replace(' ', 'T') + '-05:00';
  } else if (!dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.slice(10).includes('-')) {
    normalized = dateStr + '-05:00';
  }
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
  
  if (typeof DOMParser !== 'undefined') {
    // DOMParser crea un documento inerte: no carga imágenes ni ejecuta onerror/onload
    const doc = new DOMParser().parseFromString(withLineBreaks, 'text/html');
    return (doc.body.textContent || '').trim();
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

export { copyToClipboard } from './clipboard';

