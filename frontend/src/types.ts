export type EstadoActividad = 'completada' | 'en_proceso' | 'en_revision' | 'pendiente';
export type UserRole = 'admin' | 'lider' | 'analista' | 'operador';

export interface Evidencia {
  id?: string;
  nombre: string;
  url: string;
  tipo?: string;
  tamano?: number;
  created_at?: string;
}

export interface Actividad {
  id?: number | string;
  bitacora_id?: number;
  orden?: number;
  hora_inicio: string;
  duracion_min: number;
  tipo_trabajo: string;
  descripcion: string;
  para_cliente: string;
  estado: EstadoActividad;
  evidencias?: Evidencia[];
  parent_task_id?: number | null;
  is_rollover?: boolean;
  updated_at?: string;
  created_at?: string;
  tiempo_acumulado_min?: number;
  colaborador?: string;
  colaborador_id?: number;
  colaborador_phone?: string;
  shared_with?: number[];
  shared_with_names?: string[];
  shared_uuid?: string;
}

export interface Bitacora {
  id?: number;
  user_id?: number;
  fecha: string;
  hora_inicio: string;
  colaborador: string;
  area: string;
  pendientes: string;
  necesita_apoyo: 'Si' | 'No';
  apoyo_detalle: string;
  prioridad_siguiente: string;
  tiempo_total_min?: number;
  resumen_texto?: string;
  estado?: string;
  created_at?: string;
  team_id?: number;
  team_name?: string;
  actividades: Actividad[];
}

export interface User {
  id: number;
  username: string;
  email?: string;
  phone?: string;
  full_name: string;
  role: UserRole;
  team_id?: number | null;
  team_name?: string | null;
  is_active?: boolean | number;
  is_leader?: boolean;
}

export interface Team {
  id: number;
  nombre: string;
  descripcion?: string;
  lider_id?: number | null;
  lider_nombre?: string;
  lider_username?: string;
  members?: User[];
  members_count?: number;
}

export interface DashboardStats {
  resumen: {
    total_bitacoras: number;
    total_minutos: number;
    total_colaboradores: number;
  };
  por_estado: {
    estado: string;
    cantidad: number;
    minutos: number;
  }[];
  por_tipo: {
    tipo: string;
    cantidad: number;
    minutos: number;
  }[];
  por_colaborador: {
    colaborador: string;
    user_id?: number;
    team_name?: string;
    bitacoras_count: number;
    total_minutos: number;
    total_actividades: number;
    actividades_completadas: number;
  }[];
  alertas_apoyo: {
    id: number;
    fecha: string;
    colaborador: string;
    apoyo_detalle: string;
    pendientes: string;
    team_name?: string;
  }[];
  tendencia_diaria?: {
    fecha: string;
    actividades: number;
    minutos: number;
    completadas: number;
  }[];
  distribucion_horaria?: {
    franja: string;
    cantidad: number;
    minutos: number;
  }[];
  kpis_adicionales?: {
    promedio_minutos_jornada: number;
    eficiencia: number;
    ratio_planificado: number;
    total_actividades: number;
    actividades_completadas: number;
  };
}

export type ViewMode = 'lista' | 'kanban' | 'historial' | 'equipo' | 'dashboard' | 'gestion';

export interface SystemSettings {
  hora_inicio_default?: string;
  system_title?: string;
  logo_url?: string;
  favicon_url?: string;
  login_bg_url?: string;
  login_bg_type?: 'gradient' | 'image';
  login_heading?: string;
  login_subheading?: string;
  system_mode?: 'production' | 'demo';
  show_demo_logins?: 'true' | 'false';
}

