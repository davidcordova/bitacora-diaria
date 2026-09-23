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
  colaborador: 'Juan Pérez García',
  area: 'Sistemas',
  pendientes: 'Ajustes finales en el módulo de reportes. Esperar respuesta del proveedor.',
  necesita_apoyo: 'Si',
  apoyo_detalle: 'Validación de acceso a servidor de pruebas.',
  prioridad_siguiente: 'Continuar con la implementación del módulo de reportes y revisar incidencias pendientes.',
  actividades: [
    {
      id: 'act-1',
      orden: 0,
      hora_inicio: '08:15',
      duracion_min: 45,
      tipo_trabajo: 'Soporte técnico',
      descripcion: 'Resolución de incidencia de impresora en área administrativa.',
      para_cliente: 'Administración',
      estado: 'completada',
    },
    {
      id: 'act-2',
      orden: 1,
      hora_inicio: '09:30',
      duracion_min: 60,
      tipo_trabajo: 'Desarrollo',
      descripcion: 'Corrección de error en módulo de reportes (Odoo).',
      para_cliente: 'Cliente XYZ',
      estado: 'en_proceso',
    },
    {
      id: 'act-3',
      orden: 2,
      hora_inicio: '11:15',
      duracion_min: 30,
      tipo_trabajo: 'Mantenimiento',
      descripcion: 'Actualización de drivers en equipos de diseño.',
      para_cliente: 'N/A',
      estado: 'completada',
    },
    {
      id: 'act-4',
      orden: 3,
      hora_inicio: '14:00',
      duracion_min: 75,
      tipo_trabajo: 'Desarrollo',
      descripcion: 'Implementación de nueva funcionalidad en la web interna.',
      para_cliente: 'Proyecto Interno',
      estado: 'en_revision',
    },
    {
      id: 'act-5',
      orden: 4,
      hora_inicio: '16:00',
      duracion_min: 20,
      tipo_trabajo: 'Soporte técnico',
      descripcion: 'Atención a usuario por acceso a VPN.',
      para_cliente: 'RR.HH.',
      estado: 'completada',
    },
  ],
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
