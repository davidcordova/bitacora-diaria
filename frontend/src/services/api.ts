import { Bitacora, User, EstadoActividad, Team, DashboardStats, Actividad, Evidencia, SystemSettings, ActividadPapelera, LiveFeedActividad, Sugerencia, ActividadReferencia } from '../types';

const API_BASE = '/api';

export const api = {
  // ================= EVIDENCIAS =================
  async uploadFile(file: File): Promise<Evidencia> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al subir archivo' }));
      throw new Error(err.error || 'Error al subir archivo');
    }
    const data = await res.json();
    return {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      nombre: data.nombre,
      url: data.url,
      tipo: data.tipo,
      tamano: data.tamano,
      created_at: new Date().toISOString(),
    };
  },

  async uploadBase64(base64: string, nombre?: string): Promise<Evidencia> {
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, nombre }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al subir captura' }));
      throw new Error(err.error || 'Error al subir captura');
    }
    const data = await res.json();
    return {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      nombre: data.nombre,
      url: data.url,
      tipo: data.tipo,
      tamano: data.tamano,
      created_at: new Date().toISOString(),
    };
  },
  // ================= AUTH =================
  async login(username: string, password: string):Promise<{ user: User; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error en la autenticación' }));
      throw new Error(err.error || 'Credenciales inválidas');
    }
    return await res.json();
  },

  // ================= USERS =================
  async getUsers(): Promise<User[]> {
    try {
      const res = await fetch(`${API_BASE}/users`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API users error, using fallback', e);
    }
    return [
      { id: 1, username: 'admin', full_name: 'Administrador Principal', role: 'admin' },
      { id: 2, username: 'juan', full_name: 'Juan Pérez García', role: 'lider', team_name: 'Equipo de Sistemas e Infraestructura', is_leader: true },
      { id: 3, username: 'maria', full_name: 'María López', role: 'operador', team_name: 'Equipo de Sistemas e Infraestructura' },
    ];
  },

  async getAllAdminUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/admin/users`);
    if (!res.ok) throw new Error('Error al cargar usuarios');
    return await res.json();
  },

  async createUser(userData: Partial<User> & { password?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al crear usuario' }));
      throw new Error(err.error || 'Error al crear usuario');
    }
    return await res.json();
  },

  async updateUser(userId: number, userData: Partial<User> & { password?: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al actualizar usuario' }));
      throw new Error(err.error || 'Error al actualizar usuario');
    }
    return await res.json();
  },

  async deleteUser(userId: number, permanent = false): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/users/${userId}${permanent ? '?permanent=true' : ''}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al eliminar o desactivar usuario' }));
      throw new Error(err.error || 'Error al eliminar usuario');
    }
    return await res.json();
  },

  async changePassword(data: { user_id: number; current_password?: string; new_password: string }): Promise<any> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al cambiar contraseña' }));
      throw new Error(err.error || 'Error al cambiar contraseña');
    }
    return await res.json();
  },

  async updateProfile(data: {
    user_id: number;
    full_name: string;
    email?: string;
    phone?: string;
    current_password?: string;
    new_password?: string;
  }): Promise<{ success: boolean; message: string; user: User }> {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al actualizar perfil' }));
      throw new Error(err.error || 'Error al actualizar perfil');
    }
    return await res.json();
  },

  // ================= TEAMS =================
  async getTeams(): Promise<Team[]> {
    const res = await fetch(`${API_BASE}/admin/teams`);
    if (!res.ok) throw new Error('Error al cargar equipos');
    return await res.json();
  },

  async createTeam(teamData: { nombre: string; descripcion?: string; lider_id?: number | null }): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/teams`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al crear equipo' }));
      throw new Error(err.error || 'Error al crear equipo');
    }
    return await res.json();
  },

  async updateTeam(teamId: number, teamData: Partial<Team> & { member_ids?: number[] }): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/teams/${teamId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamData),
    });
    return await res.json();
  },

  async deleteTeam(teamId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/teams/${teamId}`, {
      method: 'DELETE',
    });
    return res.ok;
  },

  // ================= BITACORAS =================
  async getBitacoras(fecha?: string, colaborador?: string, team_id?: number, requesting_user_id?: number, user_id?: number): Promise<Bitacora[]> {
    try {
      const params = new URLSearchParams();
      if (fecha) params.append('fecha', fecha);
      if (colaborador) params.append('colaborador', colaborador);
      if (team_id) params.append('team_id', String(team_id));
      if (requesting_user_id) params.append('requesting_user_id', String(requesting_user_id));
      if (user_id) params.append('user_id', String(user_id));
      const res = await fetch(`${API_BASE}/bitacoras?${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API bitacoras fetch error', e);
    }
    const local = localStorage.getItem('bitacoras_history');
    return local ? JSON.parse(local) : [];
  },

  async saveBitacora(bitacora: Bitacora): Promise<{ bitacora: Bitacora; message: string }> {
    try {
      const res = await fetch(`${API_BASE}/bitacoras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bitacora),
      });
      if (res.ok) {
        const data = await res.json();
        this.saveToLocalStorage(data.bitacora);
        return data;
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error || `Error ${res.status} al guardar en el servidor`;
        console.warn('API error saving bitacora:', errMsg);
        this.saveToLocalStorage(bitacora);
        throw new Error(errMsg);
      }
    } catch (e) {
      console.warn('Error saving to server, saving locally', e);
      this.saveToLocalStorage(bitacora);
      throw e;
    }
  },

  async updateActividadEstado(actId: number | string, nuevoEstado: EstadoActividad): Promise<boolean> {
    if (typeof actId === 'number') {
      try {
        const res = await fetch(`${API_BASE}/actividades/${actId}/estado`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ estado: nuevoEstado }),
        });
        return res.ok;
      } catch (e) {
        console.warn('API patch actividad error', e);
      }
    }
    return true;
  },

  async updateActividadDetalle(actId: number | string, actData: Partial<Actividad>): Promise<boolean> {
    if (typeof actId === 'number') {
      try {
        const res = await fetch(`${API_BASE}/actividades/${actId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(actData),
        });
        return res.ok;
      } catch (e) {
        console.warn('API update actividad detalle error', e);
      }
    }
    return true;
  },

  async getActividadesPendientes(colaborador?: string, userId?: number): Promise<Actividad[]> {
    try {
      const params = new URLSearchParams();
      if (colaborador) params.append('colaborador', colaborador);
      if (userId) params.append('user_id', String(userId));
      const res = await fetch(`${API_BASE}/actividades/pendientes?${params.toString()}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('API get actividades pendientes error', e);
    }
    return [];
  },

  async importarActividadesPendientes(
    colaborador: string,
    userId?: number,
    targetFecha?: string
  ): Promise<{ success: boolean; count: number; pendientes: Actividad[]; actividades: Actividad[] }> {
    const res = await fetch(`${API_BASE}/actividades/importar-pendientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        colaborador,
        user_id: userId,
        target_fecha: targetFecha || new Date().toISOString().slice(0, 10),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al importar actividades pendientes' }));
      throw new Error(err.error || 'Error al importar actividades');
    }
    const data = await res.json();
    const list = data.pendientes || data.actividades || [];
    return {
      success: true,
      count: data.count ?? list.length,
      pendientes: list,
      actividades: list,
    };
  },

  async triggerRollover(targetFecha?: string): Promise<any> {
    const res = await fetch(`${API_BASE}/cron/rollover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_fecha: targetFecha }),
    });
    if (!res.ok) throw new Error('Error al ejecutar rollover nocturno');
    return await res.json();
  },

  async deleteBitacora(id: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/bitacoras/${id}`, { method: 'DELETE' });
      return res.ok;
    } catch (e) {
      console.warn('API delete error', e);
      return false;
    }
  },

  // ================= DASHBOARD =================
  async getDashboardStats(teamId?: number, fecha?: string, requestingUserId?: number, userId?: number): Promise<DashboardStats> {
    const params = new URLSearchParams();
    if (teamId) params.append('team_id', String(teamId));
    if (fecha) params.append('fecha', fecha);
    if (requestingUserId) params.append('requesting_user_id', String(requestingUserId));
    if (userId) params.append('user_id', String(userId));
    const res = await fetch(`${API_BASE}/dashboard/stats?${params.toString()}`);
    if (!res.ok) throw new Error('Error al cargar estadísticas del dashboard');
    return await res.json();
  },

  // ================= SYSTEM SETTINGS =================
  async getSettings(): Promise<SystemSettings> {
    try {
      const res = await fetch(`${API_BASE}/settings`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API settings error', e);
    }
    return {
      hora_inicio_default: '08:30',
      system_title: 'Bitácora Diaria de Actividades | Marketing Alterno Perú',
      logo_url: '',
      favicon_url: '',
      login_bg_url: '',
      login_bg_type: 'gradient',
      login_heading: 'Bitácora Oficial',
      login_subheading: 'Marketing Alterno Perú',
    };
  },

  async updateSettings(settings: Partial<SystemSettings>): Promise<SystemSettings> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!res.ok) throw new Error('Error al guardar configuración');
    return await res.json();
  },

  async cleanProductionData(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/clean-production-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al purgar datos' }));
      throw new Error(err.error || 'Error al purgar datos');
    }
    return await res.json();
  },

  async seedDemoData(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/seed-demo-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al cargar datos demo' }));
      throw new Error(err.error || 'Error al cargar datos demo');
    }
    return await res.json();
  },

  // ================= PAPELERA DE RECICLAJE (RETENCIÓN 15 DÍAS) =================
  async getPapelera(userId?: number, requestingUserId?: number): Promise<{ items: ActividadPapelera[]; total: number }> {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId.toString());
    if (requestingUserId) params.append('requesting_user_id', requestingUserId.toString());
    const res = await fetch(`${API_BASE}/papelera?${params.toString()}`);
    if (!res.ok) throw new Error('Error al cargar la papelera');
    return await res.json();
  },

  async restaurarActividad(
    actId: number | string,
    targetData?: { target_bitacora_id?: number; target_fecha?: string; target_user_id?: number }
  ): Promise<{ success: boolean; message: string; actividad: Actividad; bitacora_id: number; bitacora_fecha?: string }> {
    const res = await fetch(`${API_BASE}/papelera/restaurar/${actId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targetData || {}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al restaurar actividad' }));
      throw new Error(err.error || 'Error al restaurar actividad');
    }
    return await res.json();
  },

  async eliminarDefinitivoActividad(actId: number | string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/papelera/eliminar/${actId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al eliminar actividad definitivamente' }));
      throw new Error(err.error || 'Error al eliminar actividad definitivamente');
    }
    return await res.json();
  },

  async vaciarPapelera(userId?: number, role?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/papelera/vaciar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al vaciar papelera' }));
      throw new Error(err.error || 'Error al vaciar papelera');
    }
    return await res.json();
  },

  async softDeleteActividad(actId: number | string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/actividades/${actId}/eliminar`, {
      method: 'POST',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al mover a papelera' }));
      throw new Error(err.error || 'Error al mover a papelera');
    }
    return await res.json();
  },

  // ================= FEED DE EQUIPO EN VIVO =================
  async getEquipoActividadesEnVivo(fecha?: string, requestingUserId?: number, teamId?: number | string): Promise<{ success: boolean; fecha: string; total: number; actividades: LiveFeedActividad[] }> {
    const params = new URLSearchParams();
    if (fecha) params.append('fecha', fecha);
    if (requestingUserId) params.append('requesting_user_id', requestingUserId.toString());
    if (teamId && teamId !== 'all') params.append('team_id', teamId.toString());
    const res = await fetch(`${API_BASE}/equipo/actividades-en-vivo?${params.toString()}`);
    if (!res.ok) throw new Error('Error al cargar feed de actividades en vivo');
    return await res.json();
  },

  // ================= ACTIVIDADES REFERENCIAS / VÍNCULOS =================
  async getActividadesReferencias(userId?: number, colaborador?: string, q?: string): Promise<ActividadReferencia[]> {
    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId.toString());
    if (colaborador) params.append('colaborador', colaborador);
    if (q) params.append('q', q);
    const res = await fetch(`${API_BASE}/actividades/referencias?${params.toString()}`);
    if (!res.ok) throw new Error('Error al buscar referencias de actividades');
    return await res.json();
  },

  // ================= BUZÓN DE SUGERENCIAS =================
  async getSugerencias(params?: {
    categoria?: string;
    estado?: string;
    user_id?: number;
    requesting_user_id?: number;
    mine?: boolean;
    sort?: 'reciente' | 'popular';
  }): Promise<Sugerencia[]> {
    const searchParams = new URLSearchParams();
    if (params?.categoria) searchParams.append('categoria', params.categoria);
    if (params?.estado) searchParams.append('estado', params.estado);
    if (params?.user_id) searchParams.append('user_id', params.user_id.toString());
    if (params?.requesting_user_id) searchParams.append('requesting_user_id', params.requesting_user_id.toString());
    if (params?.mine) searchParams.append('mine', 'true');
    if (params?.sort) searchParams.append('sort', params.sort);

    const res = await fetch(`${API_BASE}/sugerencias?${searchParams.toString()}`);
    if (!res.ok) throw new Error('Error al cargar buzón de sugerencias');
    return await res.json();
  },

  async createSugerencia(data: {
    user_id?: number;
    colaborador?: string;
    es_anonimo?: boolean;
    categoria?: string;
    titulo: string;
    descripcion: string;
    impacto?: string;
  }): Promise<{ message: string; sugerencia: Sugerencia }> {
    const res = await fetch(`${API_BASE}/sugerencias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al enviar sugerencia' }));
      throw new Error(err.error || 'Error al enviar sugerencia');
    }
    return await res.json();
  },

  async votarSugerencia(sugId: number, userId: number): Promise<{ success: boolean; message: string; voted: boolean; votos: number }> {
    const res = await fetch(`${API_BASE}/sugerencias/${sugId}/votar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al votar' }));
      throw new Error(err.error || 'Error al votar');
    }
    return await res.json();
  },

  async updateSugerenciaStatus(sugId: number, data: {
    estado: string;
    respuesta_admin?: string;
    respondido_por?: string;
  }): Promise<{ success: boolean; message: string; sugerencia: Sugerencia }> {
    const res = await fetch(`${API_BASE}/sugerencias/${sugId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al actualizar sugerencia' }));
      throw new Error(err.error || 'Error al actualizar sugerencia');
    }
    return await res.json();
  },

  async deleteSugerencia(sugId: number, userId: number, role?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/sugerencias/${sugId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al eliminar sugerencia' }));
      throw new Error(err.error || 'Error al eliminar sugerencia');
    }
    return await res.json();
  },

  saveToLocalStorage(bitacora: Bitacora) {
    try {
      const existingStr = localStorage.getItem('bitacoras_history');
      let list: Bitacora[] = existingStr ? JSON.parse(existingStr) : [];
      list = list.filter((b) => !(b.fecha === bitacora.fecha && b.colaborador === bitacora.colaborador));
      list.unshift(bitacora);
      localStorage.setItem('bitacoras_history', JSON.stringify(list.slice(0, 50)));
    } catch (e) {
      console.error('LocalStorage error', e);
    }
  },
};
