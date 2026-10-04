import { Bitacora, User, EstadoActividad, Team, DashboardStats, Actividad, Evidencia, SystemSettings, ActividadPapelera, LiveFeedActividad, Sugerencia, ActividadReferencia, SystemNotification, QuickLink, ItEmpresa, ItMarca, ItCredential, ItCredentialPermission, ItPlatformUser, ItPlataforma, ItCargo, UserDelegation } from '../types';

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
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem('cached_users', JSON.stringify(data));
        }
        return data;
      }
    } catch (e) {
      console.warn('API users error, using fallback', e);
    }
    const cached = localStorage.getItem('cached_users');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return [
      { id: 1, username: 'admin', full_name: 'Administrador Principal', role: 'admin' },
      { id: 2, username: 'juan', full_name: 'Juan Pérez García', role: 'lider', team_name: 'Equipo de Sistemas e Infraestructura', is_leader: true },
      { id: 3, username: 'maria', full_name: 'María López', role: 'operador', team_name: 'Equipo de Sistemas e Infraestructura' },
    ];
  },

  async getAllAdminUsers(): Promise<User[]> {
    try {
      const res = await fetch(`${API_BASE}/admin/users`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem('cached_admin_users', JSON.stringify(data));
        }
        return data;
      }
    } catch (e) {
      console.warn('API getAllAdminUsers error:', e);
    }
    const cached = localStorage.getItem('cached_admin_users');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    try {
      return await this.getUsers();
    } catch {}
    return [];
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
    try {
      const res = await fetch(`${API_BASE}/admin/teams`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          localStorage.setItem('cached_teams', JSON.stringify(data));
        }
        return data;
      }
    } catch (e) {
      console.warn('API getTeams error:', e);
    }
    const cached = localStorage.getItem('cached_teams');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    return [];
  },

  async createTeam(teamData: { nombre: string; descripcion?: string; lider_id?: number | null; member_ids?: number[] }): Promise<any> {
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

  async saveBitacora(bitacora: Bitacora, requesting_user_id?: number): Promise<{ bitacora: Bitacora; message: string }> {
    // 1. Respaldo preventivo inmediato en cliente ante cualquier falla de red o corte
    this.saveToLocalStorage(bitacora);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      const payload = requesting_user_id ? { ...bitacora, requesting_user_id } : bitacora;
      const res = await fetch(`${API_BASE}/bitacoras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        this.saveToLocalStorage(data.bitacora);
        return data;
      } else {
        const errJson = await res.json().catch(() => ({}));
        const errMsg = errJson.error || `Error ${res.status} al guardar en el servidor`;
        console.warn('API error saving bitacora:', errMsg);
        throw new Error(errMsg);
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.warn('Error saving to server, data preserved locally', e);
      if (e.name === 'AbortError') {
        throw new Error('El servidor tardó en responder. Tu bitácora ha sido respaldada localmente en tu equipo y se sincronizará automáticamente.');
      }
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

  async getActividadById(id: number): Promise<Actividad & { bitacora_fecha?: string; colaborador?: string }> {
    const res = await fetch(`${API_BASE}/actividades/${id}`);
    if (!res.ok) throw new Error(`Error al obtener actividad #${id}`);
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

  // ================= NOTIFICACIONES =================
  async getNotifications(userId: number): Promise<SystemNotification[]> {
    try {
      const res = await fetch(`${API_BASE}/notifications?user_id=${userId}`);
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('API notifications fetch error', e);
    }
    return [];
  },

  async markNotificationRead(notifId: number | string): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/notifications/${notifId}/read`, { method: 'PATCH' });
      return res.ok;
    } catch {
      return false;
    }
  },

  async markAllNotificationsRead(userId: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/notifications/read-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async clearNotifications(userId: number): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/notifications?user_id=${userId}`, { method: 'DELETE' });
      return res.ok;
    } catch {
      return false;
    }
  },

  // ================= ACCESOS DIRECTOS (QUICK LINKS) =================
  async getQuickLinks(params?: { user_id?: number; categoria?: string; search?: string }): Promise<QuickLink[]> {
    const q = new URLSearchParams();
    if (params?.user_id) q.set('user_id', String(params.user_id));
    if (params?.categoria) q.set('categoria', params.categoria);
    if (params?.search) q.set('search', params.search);
    const res = await fetch(`${API_BASE}/quick-links?${q.toString()}`);
    if (!res.ok) throw new Error('Error al obtener accesos directos');
    return res.json();
  },

  async createQuickLink(link: Partial<QuickLink>): Promise<QuickLink> {
    const res = await fetch(`${API_BASE}/quick-links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(link),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al crear acceso directo' }));
      throw new Error(err.error || 'Error al crear acceso directo');
    }
    return res.json();
  },

  async updateQuickLink(id: number, link: Partial<QuickLink> & { user_id?: number }): Promise<QuickLink> {
    const res = await fetch(`${API_BASE}/quick-links/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(link),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al actualizar acceso directo' }));
      throw new Error(err.error || 'Error al actualizar acceso directo');
    }
    return res.json();
  },

  async deleteQuickLink(id: number, userId?: number): Promise<boolean> {
    const q = userId ? `?user_id=${userId}` : '';
    const res = await fetch(`${API_BASE}/quick-links/${id}${q}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al eliminar acceso directo' }));
      throw new Error(err.error || 'Error al eliminar acceso directo');
    }
    return true;
  },

  // ================= BÓVEDA IT (MULTI-EMPRESA / CREDENCIALES) =================
  async getItEmpresas(): Promise<ItEmpresa[]> {
    const res = await fetch(`${API_BASE}/it-vault/empresas`);
    if (!res.ok) throw new Error('Error al obtener empresas');
    return res.json();
  },

  async createItEmpresa(empresa: { nombre: string; color?: string }): Promise<ItEmpresa> {
    const res = await fetch(`${API_BASE}/it-vault/empresas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(empresa),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al crear empresa' }));
      throw new Error(err.error || 'Error al crear empresa');
    }
    return res.json();
  },

  async createItMarca(marca: { empresa_id: number; nombre: string }): Promise<ItMarca> {
    const res = await fetch(`${API_BASE}/it-vault/marcas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(marca),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al crear marca' }));
      throw new Error(err.error || 'Error al crear marca');
    }
    return res.json();
  },

  async getItCredentials(params?: { user_id?: number; empresa_id?: number; marca_id?: number; tipo_servicio?: string; search?: string }): Promise<ItCredential[]> {
    const q = new URLSearchParams();
    if (params?.user_id) q.set('user_id', String(params.user_id));
    if (params?.empresa_id) q.set('empresa_id', String(params.empresa_id));
    if (params?.marca_id) q.set('marca_id', String(params.marca_id));
    if (params?.tipo_servicio) q.set('tipo_servicio', params.tipo_servicio);
    if (params?.search) q.set('search', params.search);
    const res = await fetch(`${API_BASE}/it-vault/credentials?${q.toString()}`);
    if (!res.ok) throw new Error('Error al obtener credenciales de la bóveda');
    return res.json();
  },

  async createItCredential(cred: Partial<ItCredential> & { created_by: number; permissions?: any[] }): Promise<{ id: number; success: boolean }> {
    const res = await fetch(`${API_BASE}/it-vault/credentials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cred),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al registrar credencial' }));
      throw new Error(err.error || 'Error al registrar credencial');
    }
    return res.json();
  },

  async updateItCredential(id: number, cred: Partial<ItCredential> & { updated_by?: number }): Promise<boolean> {
    const res = await fetch(`${API_BASE}/it-vault/credentials/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cred),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al actualizar credencial' }));
      throw new Error(err.error || 'Error al actualizar credencial');
    }
    return true;
  },

  async deleteItCredential(id: number, userId?: number): Promise<boolean> {
    const q = userId ? `?user_id=${userId}` : '';
    const res = await fetch(`${API_BASE}/it-vault/credentials/${id}${q}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al eliminar credencial' }));
      throw new Error(err.error || 'Error al eliminar credencial');
    }
    return true;
  },

  async auditItCredential(id: number, userId: number, action: 'view_password' | 'copy_password'): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/it-vault/credentials/${id}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, action }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getItCredentialPermissions(credId: number): Promise<ItCredentialPermission[]> {
    const res = await fetch(`${API_BASE}/it-vault/credentials/${credId}/permissions`);
    if (!res.ok) throw new Error('Error al obtener permisos de credencial');
    return res.json();
  },

  async updateItCredentialPermissions(credId: number, assignedBy: number, permissions: { user_id: number; can_view: boolean; can_edit: boolean }[]): Promise<boolean> {
    const res = await fetch(`${API_BASE}/it-vault/credentials/${credId}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigned_by: assignedBy, permissions }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al actualizar permisos' }));
      throw new Error(err.error || 'Error al actualizar permisos');
    }
    return true;
  },

  // ================= DIRECTORIO DE USUARIOS POR PLATAFORMA =================
  async getItPlatformUsers(params?: { empresa_id?: number; marca_id?: number; plataforma?: string; search?: string; estado?: string }): Promise<ItPlatformUser[]> {
    const q = new URLSearchParams();
    if (params?.empresa_id) q.set('empresa_id', String(params.empresa_id));
    if (params?.marca_id) q.set('marca_id', String(params.marca_id));
    if (params?.plataforma) q.set('plataforma', params.plataforma);
    if (params?.search) q.set('search', params.search);
    if (params?.estado) q.set('estado', params.estado);
    const res = await fetch(`${API_BASE}/it-vault/platform-users?${q.toString()}`);
    if (!res.ok) throw new Error('Error al obtener directorio de usuarios');
    return res.json();
  },

  async createItPlatformUser(user: Partial<ItPlatformUser>): Promise<ItPlatformUser> {
    const res = await fetch(`${API_BASE}/it-vault/platform-users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al registrar usuario en la plataforma' }));
      throw new Error(err.error || 'Error al registrar usuario en la plataforma');
    }
    return res.json();
  },

  async updateItPlatformUser(id: number, user: Partial<ItPlatformUser>): Promise<ItPlatformUser> {
    const res = await fetch(`${API_BASE}/it-vault/platform-users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al actualizar usuario' }));
      throw new Error(err.error || 'Error al actualizar usuario');
    }
    return res.json();
  },

  async resetItPlatformUserPassword(id: number, resetBy?: number, newPassword?: string): Promise<{ success: boolean; new_password: string; ultimo_reseteo: string; share_message: string }> {
    const res = await fetch(`${API_BASE}/it-vault/platform-users/${id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset_by: resetBy, new_password: newPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al resetear contraseña' }));
      throw new Error(err.error || 'Error al resetear contraseña');
    }
    return res.json();
  },

  async deleteItPlatformUser(id: number): Promise<boolean> {
    const res = await fetch(`${API_BASE}/it-vault/platform-users/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al eliminar usuario' }));
      throw new Error(err.error || 'Error al eliminar usuario');
    }
    return true;
  },

  async downloadItPlatformUsersTemplate(): Promise<void> {
    const res = await fetch(`${API_BASE}/it-vault/platform-users/template`);
    if (!res.ok) throw new Error('Error al descargar plantilla de cuentas');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Plantilla_Cuentas_Plataforma.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async exportItPlatformUsers(params?: { empresa_id?: number; marca_id?: number; plataforma?: string; search?: string; estado?: string; include_passwords?: boolean }): Promise<void> {
    const q = new URLSearchParams();
    if (params?.empresa_id) q.set('empresa_id', String(params.empresa_id));
    if (params?.marca_id) q.set('marca_id', String(params.marca_id));
    if (params?.plataforma) q.set('plataforma', params.plataforma);
    if (params?.search) q.set('search', params.search);
    if (params?.estado) q.set('estado', params.estado);
    if (params?.include_passwords) q.set('include_passwords', '1');
    const res = await fetch(`${API_BASE}/it-vault/platform-users/export?${q.toString()}`);
    if (!res.ok) throw new Error('Error al exportar cuentas de usuarios');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Cuentas_Plataformas_Export.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  async previewItPlatformUsersImport(file: File): Promise<{
    success: boolean;
    filename: string;
    total_filas: number;
    ready_count: number;
    update_count: number;
    invalid_count: number;
    rows: any[];
  }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/it-vault/platform-users/import/preview`, {
      method: 'POST',
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al previsualizar archivo' }));
      throw new Error(err.error || 'Error al previsualizar archivo');
    }
    return res.json();
  },

  async importItPlatformUsers(options: {
    file?: File;
    rows?: any[];
    modo?: 'crear_o_actualizar' | 'solo_nuevos';
    created_by?: number;
  }): Promise<{
    success: boolean;
    total_procesados: number;
    creados: number;
    actualizados: number;
    omitidos: number;
    errores: string[];
    mensaje: string;
  }> {
    let res: Response;
    if (options.rows && options.rows.length > 0) {
      res = await fetch(`${API_BASE}/it-vault/platform-users/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: options.rows,
          modo: options.modo || 'crear_o_actualizar',
          created_by: options.created_by,
        }),
      });
    } else if (options.file) {
      const formData = new FormData();
      formData.append('file', options.file);
      formData.append('modo', options.modo || 'crear_o_actualizar');
      if (options.created_by) formData.append('created_by', String(options.created_by));
      res = await fetch(`${API_BASE}/it-vault/platform-users/import`, {
        method: 'POST',
        body: formData,
      });
    } else {
      throw new Error('Debe proporcionar un archivo o filas para importar');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al importar cuentas' }));
      throw new Error(err.error || 'Error al importar cuentas');
    }
    return res.json();
  },

  // ================= GESTIÓN DE CATÁLOGOS TI =================
  async getItPlataformas(): Promise<ItPlataforma[]> {
    const res = await fetch(`${API_BASE}/it-vault/plataformas`);
    if (!res.ok) throw new Error('Error al obtener plataformas');
    return res.json();
  },

  async createItPlataforma(p: { nombre: string; tipo_servicio?: string; color?: string }): Promise<ItPlataforma> {
    const res = await fetch(`${API_BASE}/it-vault/plataformas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(p),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al registrar plataforma' }));
      throw new Error(err.error || 'Error al registrar plataforma');
    }
    return res.json();
  },

  async deleteItPlataforma(id: number): Promise<boolean> {
    const res = await fetch(`${API_BASE}/it-vault/plataformas/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar plataforma');
    return true;
  },

  async getItCargos(): Promise<ItCargo[]> {
    const res = await fetch(`${API_BASE}/it-vault/cargos`);
    if (!res.ok) throw new Error('Error al obtener cargos');
    return res.json();
  },

  async createItCargo(c: { nombre: string; area?: string }): Promise<ItCargo> {
    const res = await fetch(`${API_BASE}/it-vault/cargos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al registrar cargo' }));
      throw new Error(err.error || 'Error al registrar cargo');
    }
    return res.json();
  },

  async deleteItCargo(id: number): Promise<boolean> {
    const res = await fetch(`${API_BASE}/it-vault/cargos/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar cargo');
    return true;
  },

  async deleteItEmpresa(id: number): Promise<boolean> {
    const res = await fetch(`${API_BASE}/it-vault/empresas/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar empresa');
    return true;
  },

  async deleteItMarca(id: number): Promise<boolean> {
    const res = await fetch(`${API_BASE}/it-vault/marcas/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar marca');
    return true;
  },

  // ================= SEGURIDAD DE BÓVEDA TI (PIN / DESBLOQUEO) =================
  async getVaultPinStatus(userId: number): Promise<{ has_pin: boolean }> {
    const res = await fetch(`${API_BASE}/it-vault/pin-status?user_id=${userId}`);
    if (!res.ok) return { has_pin: false };
    return res.json();
  },

  async setVaultPin(userId: number, currentPassword: string, newPin: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/it-vault/set-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, current_password: currentPassword, new_pin: newPin }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al configurar PIN' }));
      throw new Error(err.error || 'Error al configurar PIN');
    }
    return res.json();
  },

  async verifyVaultUnlock(userId: number, creds: { password?: string; pin?: string }): Promise<{ success: boolean; expires_in: number; message: string }> {
    const res = await fetch(`${API_BASE}/it-vault/verify-unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, ...creds }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Credenciales inválidas' }));
      throw new Error(err.error || 'Credenciales inválidas');
    }
    return res.json();
  },

  // ================= DELEGACIONES Y USUARIOS DE APOYO =================
  async getDelegations(): Promise<UserDelegation[]> {
    try {
      const res = await fetch(`${API_BASE}/admin/delegations`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Error fetching delegations:', e);
    }
    return [];
  },

  async createDelegation(data: {
    delegate_user_id: number;
    target_user_id?: number;
    target_user_ids?: number[];
    motivo?: string;
    assigned_by: number;
  }): Promise<{ message: string; count?: number; id?: number }> {
    const res = await fetch(`${API_BASE}/admin/delegations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al asignar usuario de apoyo' }));
      throw new Error(err.error || 'Error al asignar usuario de apoyo');
    }
    return await res.json();
  },

  async deleteDelegation(delegationId: number): Promise<boolean> {
    const res = await fetch(`${API_BASE}/admin/delegations/${delegationId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al revocar apoyo' }));
      throw new Error(err.error || 'Error al revocar apoyo');
    }
    return true;
  },

  async deleteDelegationsByDelegate(delegateUserId: number): Promise<boolean> {
    const res = await fetch(`${API_BASE}/admin/delegations/by-delegate/${delegateUserId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al revocar asignaciones de apoyo' }));
      throw new Error(err.error || 'Error al revocar asignaciones de apoyo');
    }
    return true;
  },

  async getMyDelegatedTargets(userId: number): Promise<User[]> {
    try {
      const res = await fetch(`${API_BASE}/delegations/my-targets?user_id=${userId}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('Error fetching delegated targets:', e);
    }
    return [];
  },

  async reportSupportError(data: {
    user_id?: number;
    user_name?: string;
    error_message: string;
    context?: string;
    screenshot_url?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/support/report-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error al enviar reporte' }));
      throw new Error(err.error || 'Error al enviar reporte');
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
