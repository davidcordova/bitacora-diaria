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
  hora_fin?: string;
  duracion_min: number;
  tipo_trabajo: string;
  descripcion: string;
  para_cliente: string;
  estado: EstadoActividad;
  evidencias?: Evidencia[];
  parent_task_id?: number | null;
  parent_task_desc?: string;
  parent_task_estado?: string;
  tipo_vinculo?: 'continuacion' | 'bloqueado_por' | 'subtarea' | 'relacionada' | string;
  comentarios?: string;
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
  created_by_user_id?: number | null;
  created_by_name?: string;
  updated_by_user_id?: number | null;
  updated_by_name?: string;
  is_deleted?: number;
  deleted_at?: string;
}

export interface ActividadReferencia {
  id: number;
  orden: number;
  hora_inicio: string;
  duracion_min: number;
  tipo_trabajo: string;
  descripcion: string;
  para_cliente: string;
  estado: EstadoActividad;
  bitacora_fecha: string;
  colaborador: string;
}

export interface ActividadPapelera extends Actividad {
  bitacora_fecha?: string;
  bitacora_colaborador?: string;
  bitacora_user_id?: number;
  team_name?: string;
  dias_restantes: number;
  expira_en?: string;
}

export interface LiveFeedActividad extends Actividad {
  bitacora_fecha: string;
  colaborador: string;
  user_id?: number;
  area?: string;
  necesita_apoyo?: string;
  apoyo_detalle?: string;
  team_id?: number;
  team_name?: string;
  avatar?: string;
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
  por_cliente?: {
    cliente: string;
    cantidad: number;
    minutos: number;
  }[];
  jornadas_recientes?: {
    id: number;
    fecha: string;
    tiempo_total_min: number;
    necesita_apoyo?: string;
    apoyo_detalle?: string;
    total_actividades: number;
    actividades_completadas: number;
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

export type ViewMode = 'lista' | 'kanban' | 'historial' | 'equipo' | 'dashboard' | 'gestion' | 'buzon' | 'vault' | 'manual';

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

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'info' | 'success' | 'warning' | 'alert' | 'error';
  category?: 'actividad' | 'sistema' | 'sincronizacion' | 'seguridad';
}

export type CategoriaSugerencia = 'mejora_proceso' | 'herramienta_it' | 'bienestar_equipo' | 'innovacion' | 'comunicacion' | 'sistema' | 'error_bug' | 'otro';
export type ImpactoSugerencia = 'bajo' | 'medio' | 'alto' | 'estrategico';
export type EstadoSugerencia = 'pendiente' | 'en_revision' | 'planificada' | 'implementada' | 'descartada';

export interface Sugerencia {
  id: number;
  user_id?: number | null;
  colaborador?: string;
  es_anonimo: boolean | number;
  categoria: CategoriaSugerencia;
  titulo: string;
  descripcion: string;
  impacto: ImpactoSugerencia;
  estado: EstadoSugerencia;
  evidencias?: Evidencia[];
  respuesta_admin?: string;
  respondido_por?: string;
  respondido_at?: string;
  votos: number;
  user_has_voted?: boolean | number;
  created_at: string;
  updated_at?: string;
}

export interface QuickLink {
  id: number;
  user_id: number;
  titulo: string;
  url: string;
  categoria?: string;
  descripcion?: string;
  icono?: string;
  color?: string;
  usuario?: string;
  password?: string;
  visibilidad: 'personal' | 'equipo' | 'global';
  team_id?: number | null;
  team_name?: string | null;
  author_name?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ItMarca {
  id: number;
  empresa_id: number;
  nombre: string;
  created_at?: string;
}

export interface ItEmpresa {
  id: number;
  nombre: string;
  color?: string;
  created_at?: string;
  marcas?: ItMarca[];
}

export interface ItCredential {
  id: number;
  empresa_id: number;
  empresa_nombre?: string;
  empresa_color?: string;
  marca_id?: number | null;
  marca_nombre?: string | null;
  plataforma: string;
  tipo_servicio: string;
  url_acceso?: string;
  usuario_login: string;
  password_secret: string;
  notas?: string;
  tipo_cuenta?: 'master' | 'admin' | 'operativa' | 'consulta' | string;
  is_active?: number;
  created_by: number;
  author_name?: string;
  can_view?: boolean;
  can_edit?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ItCredentialPermission {
  user_id: number;
  full_name: string;
  username: string;
  role: string;
  can_view: boolean | number;
  can_edit: boolean | number;
}

export interface ItPlatformUser {
  id: number;
  empresa_id: number;
  empresa_nombre?: string;
  empresa_color?: string;
  marca_id?: number | null;
  marca_nombre?: string | null;
  plataforma: string;
  colaborador_nombre: string;
  colaborador_cargo?: string;
  colaborador_email?: string;
  colaborador_telefono?: string;
  usuario_login: string;
  password_actual: string;
  password_anterior?: string;
  estado: 'activo' | 'suspendido' | 'por_crear' | 'baja';
  ultimo_reseteo?: string;
  notas?: string;
  created_by?: number;
  created_by_name?: string;
  updated_by?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ItPlataforma {
  id: number;
  nombre: string;
  tipo_servicio?: string;
  color?: string;
  created_at?: string;
}

export interface ItCargo {
  id: number;
  nombre: string;
  area?: string;
  created_at?: string;
}

export interface UserDelegation {
  id: number;
  delegate_user_id: number;
  delegate_name?: string;
  delegate_username?: string;
  target_user_id: number;
  target_name?: string;
  target_username?: string;
  team_id?: number | null;
  team_name?: string | null;
  tipo_alcance?: 'colaborador' | 'equipo' | 'global';
  motivo?: string;
  is_active: number | boolean;
  assigned_by: number;
  assigned_by_name?: string;
  created_at?: string;
  updated_at?: string;
}
