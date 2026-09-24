import { Bitacora } from '../types';

export const getTodayDateString = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const defaultBitacora: Bitacora = {
  fecha: getTodayDateString(),
  hora_inicio: '08:30',
  colaborador: '',
  area: 'Sistemas',
  pendientes: '',
  necesita_apoyo: 'No',
  apoyo_detalle: '',
  prioridad_siguiente: '',
  actividades: [],
};

export const TIPOS_TRABAJO = [
  'Soporte técnico',
  'Desarrollo',
  'Mantenimiento',
  'Infraestructura / Redes',
  'Gestión / Coordinación',
  'Capacitación / Reunión',
  'Seguridad de la Información',
  'Otro',
];

export const AREAS = [
  'Sistemas',
  'Desarrollo TI',
  'Infraestructura y Soporte',
  'Marketing y Diseño',
  'Operaciones',
  'Administración',
];
