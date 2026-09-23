import { Bitacora, User, EstadoActividad, Team, DashboardStats, Actividad, Evidencia, SystemSettings } from '../types';

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

  async deleteUser(userId: number): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
    });
    return res.ok;
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
  async getBitacoras(fecha?: string, colaborador?: string, team_id?: number, requesting_user_id?: number): Promise<Bitacora[]> {
    try {
      const params = new URLSearchParams();
      if (fecha) params.append('fecha', fecha);
      if (colaborador) params.append('colaborador', colaborador);
      if (team_id) params.append('team_id', String(team_id));
      if (requesting_user_id) params.append('requesting_user_id', String(requesting_user_id));
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
      }
    } catch (e) {
      console.warn('Error saving to server, saving locally', e);
    }
    this.saveToLocalStorage(bitacora);
    return { bitacora, message: 'Guardado localmente' };
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
  async getDashboardStats(teamId?: number, fecha?: string, requestingUserId?: number): Promise<DashboardStats> {
    const params = new URLSearchParams();
    if (teamId) params.append('team_id', String(teamId));
    if (fecha) params.append('fecha', fecha);
    if (requestingUserId) params.append('requesting_user_id', String(requestingUserId));
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
