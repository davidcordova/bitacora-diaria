import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';

import { Sidebar } from './components/Sidebar';
import { ActividadesLista } from './components/ActividadesLista';
import { CierreJornada } from './components/CierreJornada';
import { ResumenPreview } from './components/ResumenPreview';
import { KanbanBoard } from './components/KanbanBoard';
import { HistorialView } from './components/HistorialView';
import { SummaryDrawer } from './components/SummaryDrawer';
import { DashboardView } from './components/DashboardView';
import { TeamSupervisionView } from './components/TeamSupervisionView';
import { UserManagementView } from './components/UserManagementView';
import { BuzonView } from './components/BuzonView';
import { VaultView } from './components/VaultView';
import { ManualView } from './components/ManualView';
import { LoginModal } from './components/LoginModal';
import { LoginPage } from './components/LoginPage';
import { WhatsAppShareModal } from './components/WhatsAppShareModal';
import { UserProfileModal } from './components/UserProfileModal';
import { BottomNav } from './components/BottomNav';
import { HelpGuideModal } from './components/HelpGuideModal';
import { PapeleraModal } from './components/PapeleraModal';
import { NotificationsModal } from './components/NotificationsModal';
import { ErrorReportModal } from './components/ErrorReportModal';
import { TopHeader } from './components/TopHeader';
import { ToastContainer, ToastMessage, ToastType } from './components/Toast';
import { Bitacora, Actividad, EstadoActividad, ViewMode, User, Team, SystemSettings, SystemNotification } from './types';
import { defaultBitacora } from './utils/initialData';
import { api, getAuthToken } from './services/api';
import { getTodayLocalDateStr } from './utils/formatters';

const getDraftKey = (userId?: number, dateStr?: string) => `bitacora_draft_${userId || 'user'}_${dateStr || 'today'}`;

// Firma canónica normalizada de la bitácora:
// Compara únicamente los datos editados por el usuario, omitiendo timestamps (updated_at, created_at)
// y metadatos volátiles para evitar bucles infinitos de auto-guardado continuo.
const getBitacoraSignature = (b?: Partial<Bitacora> | null, defaultColab?: string, defaultUid?: number): string => {
  if (!b) return '';
  const uid = b.user_id || defaultUid || 0;
  const colab = (b.colaborador || defaultColab || '').trim().toLowerCase();
  const fecha = (b.fecha || '').trim();
  const hora_inicio = (b.hora_inicio || '').trim();
  const pendientes = (b.pendientes || '').trim();
  const necesita_apoyo = (b.necesita_apoyo || 'No').trim();
  const apoyo_detalle = (b.apoyo_detalle || '').trim();
  const prioridad_siguiente = (b.prioridad_siguiente || '').trim();
  const estado = (b.estado || 'generada').trim();

  const acts = (b.actividades || [])
    .filter((a) => !a.is_deleted)
    .map((a, idx) => ({
      id: a.id || null,
      orden: typeof a.orden === 'number' ? a.orden : idx,
      hora_inicio: (a.hora_inicio || '').trim(),
      duracion_min: Number(a.duracion_min || 0),
      tipo_trabajo: (a.tipo_trabajo || '').trim(),
      descripcion: (a.descripcion || '').trim(),
      para_cliente: (a.para_cliente || '').trim(),
      estado: (a.estado || 'en_proceso').trim(),
      comentarios: (a.comentarios || '').trim(),
      parent_task_id: a.parent_task_id ? Number(a.parent_task_id) : null,
      tipo_vinculo: (a.tipo_vinculo || 'continuacion').trim(),
      shared_uuid: (a.shared_uuid || '').trim(),
      shared_with: Array.isArray(a.shared_with) ? [...a.shared_with].sort() : [],
      evidencias_count: Array.isArray(a.evidencias) ? a.evidencias.length : 0,
    }));

  return JSON.stringify({
    uid,
    colab,
    fecha,
    hora_inicio,
    pendientes,
    necesita_apoyo,
    apoyo_detalle,
    prioridad_siguiente,
    estado,
    acts,
  });
};

// ID numérico = actividad ya persistida en el servidor. Los IDs `act-...` son temporales (creadas en el cliente).
const isPersistedId = (id: unknown): boolean =>
  id !== undefined && id !== null && /^\d+$/.test(String(id));

const SYNC_HEADER_FIELDS = ['hora_inicio', 'area', 'pendientes', 'necesita_apoyo', 'apoyo_detalle', 'prioridad_siguiente', 'estado'] as const;

const actContentSig = (a: Actividad): string =>
  JSON.stringify([
    (a.hora_inicio || '').trim(),
    Number(a.duracion_min || 0),
    (a.tipo_trabajo || '').trim(),
    (a.descripcion || '').trim(),
    (a.para_cliente || '').trim(),
    a.estado || '',
    (a.comentarios || '').trim(),
    a.parent_task_id ? Number(a.parent_task_id) : null,
    a.tipo_vinculo || '',
    Array.isArray(a.evidencias) ? a.evidencias.length : 0,
    Array.isArray(a.shared_with) ? [...a.shared_with].sort() : [],
  ]);

/**
 * Integra la respuesta del servidor a un guardado SIN perder lo que el usuario editó mientras
 * la petición estaba en vuelo:
 *  - Actividades no tocadas desde el envío -> versión del servidor (IDs reales, timestamps).
 *  - Actividades editadas durante el vuelo -> se conservan las ediciones locales sobre el ID real.
 *  - Actividades nuevas creadas durante el vuelo -> se conservan.
 *  - Actividades que sólo existen en el servidor (compartidas, apoyo, arrastre) -> se agregan.
 * Si el usuario cambió de fecha o de titular entretanto, la respuesta se ignora.
 */
const mergeSavedBitacora = (
  prev: Bitacora,
  sent: Bitacora,
  server: Bitacora,
  pendingDeleted?: Set<string>
): { bitacora: Bitacora; clean: boolean } => {
  if (!server || prev.fecha !== sent.fecha || server.fecha !== sent.fecha) return { bitacora: prev, clean: false };
  if (prev.user_id && sent.user_id && String(prev.user_id) !== String(sent.user_id)) return { bitacora: prev, clean: false };

  const srvActs = (server.actividades || []).filter((a) => !pendingDeleted?.has(String(a.id)));
  const srvById = new Map<string, Actividad>();
  const srvByUid = new Map<string, Actividad>();
  srvActs.forEach((a) => {
    srvById.set(String(a.id), a);
    if (a.client_uid) srvByUid.set(String(a.client_uid), a);
  });
  const sentRefs = new Set<Actividad>(sent.actividades || []);
  const sentKeys = new Set<string>();
  (sent.actividades || []).forEach((a) => {
    if (a.id !== undefined && a.id !== null) sentKeys.add(String(a.id));
    if (a.client_uid) sentKeys.add(String(a.client_uid));
  });

  let clean = true;
  const used = new Set<Actividad>();
  const out: Actividad[] = [];
  for (const local of prev.actividades || []) {
    const srv =
      (isPersistedId(local.id) ? srvById.get(String(local.id)) : undefined) ||
      (local.client_uid ? srvByUid.get(String(local.client_uid)) : undefined) ||
      (!isPersistedId(local.id) && local.id ? srvByUid.get(String(local.id)) : undefined);
    if (srv && !used.has(srv)) {
      used.add(srv);
      if (sentRefs.has(local)) {
        out.push(srv);
      } else {
        clean = false;
        out.push({ ...srv, ...local, id: srv.id, client_uid: srv.client_uid || local.client_uid, updated_at: srv.updated_at });
      }
      continue;
    }
    if (sentRefs.has(local)) {
      // Enviada pero el servidor ya no la devuelve (eliminada en otro dispositivo o por el titular)
      continue;
    }
    if (isPersistedId(local.id)) {
      // Persistida pero ausente en el servidor: fue eliminada; no resucitarla
      continue;
    }
    clean = false;
    out.push(local); // creada mientras el guardado estaba en vuelo
  }
  for (const s of srvActs) {
    if (used.has(s)) continue;
    // Si correspondía a algo enviado que el usuario quitó durante el vuelo, no reinsertarla
    if (sentKeys.has(String(s.id)) || (s.client_uid && sentKeys.has(String(s.client_uid)))) continue;
    out.push(s);
  }

  const merged: any = { ...prev, id: server.id ?? prev.id, tiempo_total_min: server.tiempo_total_min ?? prev.tiempo_total_min };
  for (const f of SYNC_HEADER_FIELDS) {
    if ((prev as any)[f] === (sent as any)[f]) {
      merged[f] = (server as any)[f] ?? (prev as any)[f];
    } else {
      clean = false;
    }
  }
  merged.actividades = out;
  return { bitacora: merged as Bitacora, clean };
};

/**
 * Reconcilia un borrador local con la versión fresca del servidor (al iniciar, cambiar de fecha o de titular).
 * El servidor es la base; del borrador sólo se rescata lo que realmente no llegó al servidor:
 *  - Actividades nuevas (ID temporal) no registradas aún.
 *  - Ediciones offline sobre actividades cuya versión en el servidor no cambió desde entonces.
 *  - Campos de cierre que en el servidor están vacíos.
 * Nunca resucita actividades eliminadas ni pisa cambios más recientes hechos desde otro dispositivo.
 */
const reconcileDraftWithServer = (
  server: Bitacora,
  draft: Bitacora | null
): { bitacora: Bitacora; hasLocalChanges: boolean } => {
  if (!draft || draft.fecha !== server.fecha) return { bitacora: server, hasLocalChanges: false };
  let changed = false;
  const draftById = new Map<string, Actividad>();
  (draft.actividades || []).forEach((a) => {
    if (isPersistedId(a.id)) draftById.set(String(a.id), a);
  });
  const srvActs = server.actividades || [];
  const acts = srvActs.map((s) => {
    const l = draftById.get(String(s.id));
    if (
      l && !l.is_deleted && l.updated_at && s.updated_at &&
      String(l.updated_at) === String(s.updated_at) &&
      actContentSig(l) !== actContentSig(s)
    ) {
      changed = true;
      return { ...s, ...l, id: s.id, updated_at: s.updated_at };
    }
    return s;
  });
  const srvUids = new Set(srvActs.filter((a) => a.client_uid).map((a) => String(a.client_uid)));
  // Compatibilidad con borradores antiguos (antes de client_uid): evitar duplicar por descripción
  const legacyDescs = new Set(
    srvActs.filter((a) => !a.client_uid).map((a) => (a.descripcion || '').trim().toLowerCase()).filter(Boolean)
  );
  const unsynced = (draft.actividades || []).filter((a) => {
    if (a.is_deleted || isPersistedId(a.id)) return false;
    const uid = String(a.client_uid || a.id || '');
    if (uid && srvUids.has(uid)) return false;
    const desc = (a.descripcion || '').trim().toLowerCase();
    if (desc && legacyDescs.has(desc)) return false;
    return true;
  });
  if (unsynced.length > 0) changed = true;
  const merged: any = { ...server, actividades: [...acts, ...unsynced] };
  for (const f of ['pendientes', 'apoyo_detalle', 'prioridad_siguiente'] as const) {
    if (!(merged[f] || '').trim() && ((draft as any)[f] || '').trim()) {
      merged[f] = (draft as any)[f];
      changed = true;
    }
  }
  return { bitacora: merged as Bitacora, hasLocalChanges: changed };
};

const isClosedEstado = (e?: string) => e === 'generada' || e === 'cerrada' || e === 'cerrada_sistema';

// Busca el borrador local más completo (evita que datos incompletos del servidor pisen el trabajo local)
// Aislamiento estricto por usuario: NUNCA mezclar o retornar borradores pertenecientes a otro usuario
const getBestLocalDraft = (userId?: number, dateStr?: string, userName?: string): Bitacora | null => {
  const candidates: Bitacora[] = [];
  
  const isValidCandidate = (b: any): b is Bitacora => {
    if (!b || b.fecha !== dateStr || !Array.isArray(b.actividades)) return false;
    // Si se especificó userId, el borrador debe pertenecer a este usuario
    if (userId) {
      if (b.user_id && b.user_id !== userId) return false;
      if (userName && b.colaborador && b.colaborador.toLowerCase() !== userName.toLowerCase() && b.user_id !== userId) return false;
    }
    return true;
  };

  if (userId) {
    try {
      const str = localStorage.getItem(getDraftKey(userId, dateStr));
      if (str) {
        const parsed = JSON.parse(str);
        if (isValidCandidate(parsed)) {
          candidates.push(parsed);
        }
      }
    } catch (e) {}
  }

  try {
    const str = localStorage.getItem('active_bitacora');
    if (str) {
      const parsed = JSON.parse(str);
      if (isValidCandidate(parsed)) {
        candidates.push(parsed);
      }
    }
  } catch (e) {}

  try {
    const str = localStorage.getItem('bitacoras_history');
    if (str) {
      const list: Bitacora[] = JSON.parse(str);
      if (Array.isArray(list)) {
        const match = list.find(b => isValidCandidate(b));
        if (match) {
          candidates.push(match);
        }
      }
    }
  } catch (e) {}

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('bitacora_recovery_backup_')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(key) || '');
          if (isValidCandidate(parsed)) {
            candidates.push(parsed);
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const countA = (a.actividades || []).filter(act => !act.is_deleted).length;
    const countB = (b.actividades || []).filter(act => !act.is_deleted).length;
    return countB - countA;
  });

  return candidates[0];
};

export function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  // Aviso para la pantalla de login (sesión expirada / actualización de seguridad)
  const [sessionNotice, setSessionNotice] = useState<string | null>(() =>
    localStorage.getItem('auth_user') && !getAuthToken()
      ? 'Actualizamos la seguridad del sistema. Inicia sesión nuevamente: tus borradores locales están a salvo.'
      : null
  );
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('auth_user');
    // Sin token de sesión válido no hay sesión: se exige iniciar sesión (los borradores se conservan)
    if (saved && !getAuthToken()) {
      localStorage.removeItem('auth_user');
      return null;
    }
    return saved ? JSON.parse(saved) : null;
  });

  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const lastSavedSignature = React.useRef<string>('');
  const isSwitchingDateRef = React.useRef<boolean>(false);
  // IDs de actividades eliminadas localmente cuya eliminación aún no se confirmó en el servidor
  const pendingDeletedIds = React.useRef<Set<string>>(new Set());
  const [syncNudge, setSyncNudge] = useState(0);

  const [bitacora, setBitacora] = useState<Bitacora>(() => {
    const todayStr = getTodayLocalDateStr();
    const savedUser = localStorage.getItem('auth_user') ? JSON.parse(localStorage.getItem('auth_user')!) : null;
    const userUid = savedUser?.id;

    const bestDraft = getBestLocalDraft(userUid, todayStr, savedUser?.full_name);
    if (bestDraft) {
      return bestDraft;
    }

    return {
      ...defaultBitacora,
      fecha: todayStr,
      colaborador: savedUser?.full_name || '',
      user_id: savedUser?.id,
      area: savedUser?.team_name || 'Sistemas',
      actividades: [],
    };
  });

  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [historial, setHistorial] = useState<Bitacora[]>([]);
  const [isGenerated, setIsGenerated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [userProfileModalOpen, setUserProfileModalOpen] = useState(false);
  const [papeleraModalOpen, setPapeleraModalOpen] = useState(false);
  const [papeleraCount, setPapeleraCount] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [delegatedTargets, setDelegatedTargets] = useState<User[]>([]);
  const [activeProxyUser, setActiveProxyUser] = useState<User | null>(null);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [errorReportModalOpen, setErrorReportModalOpen] = useState(false);
  const [lastSyncErrorMessage, setLastSyncErrorMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<SystemNotification[]>(() => {
    try {
      const saved = localStorage.getItem('system_notifications_history');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [
      {
        id: 'init-notif',
        title: 'Centro de Notificaciones Activo',
        message: 'Tus actividades guardadas, sincronizaciones y eventos aparecerán registrados aquí.',
        timestamp: new Date().toISOString(),
        read: false,
        type: 'info',
        category: 'sistema',
      },
    ];
  });

  const addNotification = useCallback(
    (
      title: string,
      message: string,
      type: SystemNotification['type'] = 'info',
      category?: SystemNotification['category']
    ) => {
      const newNotif: SystemNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        message,
        timestamp: new Date().toISOString(),
        read: false,
        type,
        category,
      };
      setNotifications((prev) => {
        const updated = [newNotif, ...prev.slice(0, 49)];
        localStorage.setItem('system_notifications_history', JSON.stringify(updated));
        return updated;
      });
    },
    []
  );

  const handleMarkNotificationAsRead = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      localStorage.setItem('system_notifications_history', JSON.stringify(updated));
      return updated;
    });
    const numId = parseInt(id, 10);
    if (!isNaN(numId)) {
      api.markNotificationRead(numId).catch(console.warn);
    }
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      localStorage.setItem('system_notifications_history', JSON.stringify(updated));
      return updated;
    });
    if (currentUser?.id) {
      api.markAllNotificationsRead(currentUser.id).catch(console.warn);
    }
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    localStorage.removeItem('system_notifications_history');
    if (currentUser?.id) {
      api.clearNotifications(currentUser.id).catch(console.warn);
    }
  };

  const handleRemoveNotification = (id: string) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      localStorage.setItem('system_notifications_history', JSON.stringify(updated));
      return updated;
    });
    const numId = parseInt(id, 10);
    if (!isNaN(numId)) {
      api.markNotificationRead(numId).catch(console.warn);
    }
  };

  const showToast = useCallback((type: ToastType, message: string, title?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev.slice(-2), { id, type, message, title }]);

    // Registrar en el Centro de Notificaciones de la campana
    const notifTitle =
      title ||
      (type === 'success' ? 'Operación exitosa' : type === 'error' ? 'Aviso del sistema' : 'Notificación');
    addNotification(notifTitle, message, type);
  }, [addNotification]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshPapeleraCount = async () => {
    if (!currentUser) return;
    try {
      const res = await api.getPapelera(currentUser.id, currentUser.id);
      setPapeleraCount(res.total || 0);
    } catch (e) {
      console.warn('Error loading papelera count:', e);
    }
  };


  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return false;
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('bitacora_theme');
    if (saved !== null) {
      return saved === 'dark';
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    localStorage.setItem('bitacora_theme', isDark ? 'dark' : 'light');
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  // Restrict views based on role
  const role = currentUser?.role || 'analista';
  const isAdmin = role === 'admin';
  const isLider = role === 'lider' || currentUser?.is_leader || isAdmin;

  useEffect(() => {
    // If analista tries to access admin-only view, redirect to lista
    if (!isAdmin && viewMode === 'gestion') {
      setViewMode('lista');
    }
  }, [role, viewMode, isAdmin]);

  // Sync user state
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('auth_user', JSON.stringify(currentUser));
      // Asignar colaborador y usuario si aún no están asignados en la bitácora activa
      setBitacora((prev) => {
        if (!prev.colaborador || prev.colaborador === '') {
          return {
            ...prev,
            colaborador: currentUser.full_name,
            user_id: currentUser.id,
            area: currentUser.team_name || prev.area || 'Sistemas',
          };
        }
        return prev;
      });
    } else {
      localStorage.removeItem('auth_user');
    }
  }, [currentUser]);

  // Única vía de guardado contra el servidor: envía, y fusiona la respuesta sin perder ediciones en vuelo
  const syncNow = async (sent: Bitacora, opts?: { mode?: 'replace' | 'merge' }) => {
    const deletedIds = Array.from(pendingDeletedIds.current);
    setAutoSaveStatus('saving');
    try {
      const res = await api.saveBitacora(sent, currentUser?.id, { mode: opts?.mode, deletedIds });
      deletedIds.forEach((id) => pendingDeletedIds.current.delete(id));
      if (res.bitacora) {
        setBitacora((prev) => {
          const m = mergeSavedBitacora(prev, sent, res.bitacora, pendingDeletedIds.current);
          if (m.clean) {
            lastSavedSignature.current = getBitacoraSignature(m.bitacora, m.bitacora.colaborador, m.bitacora.user_id);
          }
          return m.bitacora;
        });
      }
      setAutoSaveStatus('saved');
      setLastSavedTime(new Date());
      setLastSyncErrorMessage(null);
      return res;
    } catch (err: any) {
      // Permitir el reintento automático (el borrador local ya está a salvo)
      lastSavedSignature.current = '';
      setAutoSaveStatus('error');
      setLastSyncErrorMessage(err?.message || 'Error desconocido de sincronización en servidor');
      throw err;
    }
  };

  // Reintento automático tras un error de sincronización: cada 30 s y al recuperar la conexión
  useEffect(() => {
    if (autoSaveStatus !== 'error' || !currentUser?.id) return;
    const nudge = () => setSyncNudge((n) => n + 1);
    const interval = setInterval(nudge, 30000);
    window.addEventListener('online', nudge);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', nudge);
    };
  }, [autoSaveStatus, currentUser?.id]);

  // Auto-guardado local y sincronización debounced con el backend
  useEffect(() => {
    if (isSwitchingDateRef.current || !bitacora.fecha) return;

    // Solo auto-guardar si hay un usuario activamente logueado
    if (!currentUser || !currentUser.id) return;

    const effectiveUser = activeProxyUser || currentUser;
    const uid = effectiveUser.id;
    const colab = effectiveUser.full_name;

    // SEGURO CRÍTICO CONTRA CONTAMINACIÓN DE SESIONES:
    // Si la bitácora en memoria pertenece a otro usuario que no es el efectivo, jamás guardarla
    if (bitacora.user_id && bitacora.user_id !== uid) {
      return;
    }
    if (bitacora.colaborador && colab && bitacora.colaborador.toLowerCase() !== colab.toLowerCase() && bitacora.user_id !== uid) {
      return;
    }

    // Persistir siempre el borrador en localStorage de manera síncrona e instantánea (0ms de latencia)
    localStorage.setItem(getDraftKey(uid, bitacora.fecha), JSON.stringify(bitacora));
    if (!activeProxyUser) {
      localStorage.setItem('active_bitacora', JSON.stringify(bitacora));
    }

    const currentSignature = getBitacoraSignature(bitacora, colab, uid);

    if (currentSignature === lastSavedSignature.current) {
      return;
    }

    // Debounce de 600ms antes de llamar al servidor
    const timer = setTimeout(async () => {
      try {
        const payload: Bitacora = {
          ...bitacora,
          colaborador: colab,
          user_id: uid,
        };
        const result = await syncNow(payload);

        // Actualizar historial local silenciosamente solo si estamos en la bitácora personal
        if (!activeProxyUser && result?.bitacora) {
          setHistorial((prev) => {
            const idx = prev.findIndex((b) => b.id === result.bitacora.id || (b.fecha === payload.fecha && b.user_id === payload.user_id));
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = result.bitacora;
              return next;
            }
            return [result.bitacora, ...prev];
          });
        }
      } catch (err: any) {
        console.warn('Auto-save error:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [bitacora, currentUser, activeProxyUser, syncNudge]);

  // Carga inicial de datos con aislamiento estricto de usuario
  const loadInitialData = async (userOverride?: User | null) => {
    try {
      const activeUser = userOverride !== undefined
        ? userOverride
        : (currentUser || (localStorage.getItem('auth_user') ? JSON.parse(localStorage.getItem('auth_user')!) : null));

      if (!activeUser || !activeUser.id) return;

      const [uList, tList, hList, sysSettings, srvNotifs, myTargets] = await Promise.all([
        api.getUsers(),
        api.getTeams().catch(() => []),
        api.getBitacoras(undefined, undefined, undefined, activeUser.id),
        api.getSettings().catch(() => ({ hora_inicio_default: '08:30' })),
        api.getNotifications(activeUser.id).catch(() => []),
        api.getMyDelegatedTargets(activeUser.id).catch(() => []),
      ]);
      setUsers(uList);
      setTeams(tList);
      setHistorial(hList);
      setDelegatedTargets(myTargets);
      if (activeProxyUser && !myTargets.some((t: User) => t.id === activeProxyUser.id)) {
        setActiveProxyUser(null);
      }
      if (sysSettings) {
        setSystemSettings(sysSettings);
      }
      if (Array.isArray(srvNotifs) && srvNotifs.length > 0) {
        setNotifications((prev) => {
          const existingIds = new Set(prev.map((n) => n.id));
          const newFromSrv = srvNotifs.filter((n) => !existingIds.has(n.id));
          const merged = [...newFromSrv, ...prev].slice(0, 50);
          localStorage.setItem('system_notifications_history', JSON.stringify(merged));
          return merged;
        });
      }
      refreshPapeleraCount();

      const todayStr = getTodayLocalDateStr();
      const defaultStart = sysSettings?.hora_inicio_default || '08:30';

      if (activeUser) {
        // Sincronización en segundo plano de borradores de fechas anteriores que no llegaron al servidor
        // (corte de red, servidor caído). Solo se envían cambios reales y sin pisar datos más recientes.
        try {
          const draftPrefix = `bitacora_draft_${activeUser.id}_`;
          const draftKeys: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(draftPrefix)) draftKeys.push(k);
          }
          for (const k of draftKeys) {
            const dStr = k.replace(draftPrefix, '');
            if (!dStr || dStr === todayStr) continue;
            const pastDraft = getBestLocalDraft(activeUser.id, dStr, activeUser.full_name);
            if (!pastDraft || !Array.isArray(pastDraft.actividades) || pastDraft.actividades.length === 0) continue;
            const pastServer = hList.find(
              (b) =>
                (b.user_id === activeUser.id ||
                  (!b.user_id && (b.colaborador || '').toLowerCase() === activeUser.full_name.toLowerCase())) &&
                b.fecha === dStr
            );
            let toPush: Bitacora | null = null;
            let mode: 'replace' | 'merge' = 'replace';
            if (pastServer) {
              const r = reconcileDraftWithServer(pastServer, pastDraft);
              if (r.hasLocalChanges) toPush = r.bitacora;
            } else if (pastDraft.actividades.some((a) => !a.is_deleted && !isPersistedId(a.id))) {
              // No tenemos la versión del servidor a mano: envío seguro (solo agrega, nunca pisa)
              toPush = pastDraft;
              mode = 'merge';
            }
            if (!toPush) {
              if (pastServer) localStorage.setItem(k, JSON.stringify(pastServer));
              continue;
            }
            const payload: Bitacora = { ...toPush, user_id: activeUser.id, colaborador: activeUser.full_name };
            api.saveBitacora(payload, activeUser.id, { mode }).then((res) => {
              if (res?.bitacora) localStorage.setItem(k, JSON.stringify(res.bitacora));
              showToast('info', `Se sincronizaron cambios pendientes de tu bitácora del ${dStr}.`);
            }).catch(console.warn);
          }
        } catch (e) {
          console.warn('[SmartSync] Error verificando borradores previos:', e);
        }

        const todayMatch = hList.find(
          (b) =>
            (b.user_id === activeUser.id ||
              b.colaborador.toLowerCase() === activeUser.full_name.toLowerCase() ||
              (activeUser.username && b.colaborador.toLowerCase() === activeUser.username.toLowerCase())) &&
            b.fecha === todayStr
        );

        // Mejor borrador local para hoy del usuario activo
        const localDraft = getBestLocalDraft(activeUser.id, todayStr, activeUser.full_name);

        if (todayMatch) {
          // El servidor es la base; del borrador solo se rescata lo que no llegó al servidor
          const r = reconcileDraftWithServer(todayMatch, localDraft);
          setBitacora(r.bitacora);
          setIsGenerated(isClosedEstado(r.bitacora.estado));
          lastSavedSignature.current = getBitacoraSignature(r.bitacora, activeUser.full_name, activeUser.id);
          localStorage.setItem(getDraftKey(activeUser.id, todayStr), JSON.stringify(r.bitacora));
          if (r.hasLocalChanges) {
            syncNow({ ...r.bitacora, colaborador: activeUser.full_name, user_id: activeUser.id })
              .then(() => showToast('success', 'Se recuperaron y sincronizaron cambios locales que estaban pendientes.'))
              .catch(console.warn);
          }
        } else if (localDraft) {
          setBitacora(localDraft);
          setIsGenerated(isClosedEstado(localDraft.estado));
          lastSavedSignature.current = getBitacoraSignature(localDraft, activeUser.full_name, activeUser.id);
          if ((localDraft.actividades || []).some((a) => !a.is_deleted)) {
            syncNow({ ...localDraft, colaborador: activeUser.full_name, user_id: activeUser.id }, { mode: 'merge' })
              .catch(console.warn);
          }
        } else {
          // Inicializar bitácora limpia para el usuario activo sin residuos de sesiones anteriores
          setBitacora({
            ...defaultBitacora,
            fecha: todayStr,
            hora_inicio: defaultStart,
            colaborador: activeUser.full_name,
            user_id: activeUser.id,
            area: activeUser.team_name || 'Sistemas',
            actividades: [],
          });
          setIsGenerated(false);
          lastSavedSignature.current = '';
        }
      }
    } catch (e) {
      console.warn('Initial data load error:', e);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      loadInitialData(currentUser);
    }
  }, [currentUser?.id]);

  // Refrescar historial completo desde el servidor al entrar a la vista 'historial'
  useEffect(() => {
    if (viewMode === 'historial' && currentUser?.id) {
      api.getBitacoras(undefined, undefined, undefined, currentUser.id).then((fresh) => {
        if (Array.isArray(fresh) && fresh.length > 0) {
          setHistorial(fresh);
        }
      }).catch(console.warn);
    }
  }, [viewMode, currentUser?.id]);

  // Forzar sincronización completa con la nube a demanda
  const handleForceSyncCloud = async () => {
    if (!bitacora.colaborador || !bitacora.fecha) {
      showToast('error', 'No hay datos válidos para sincronizar');
      return;
    }
    const effectiveUser = activeProxyUser || currentUser;
    try {
      const payload: Bitacora = {
        ...bitacora,
        colaborador: effectiveUser?.full_name || bitacora.colaborador,
        user_id: effectiveUser?.id || bitacora.user_id,
      };
      const res = await syncNow(payload);
      const count = (res.bitacora?.actividades || bitacora.actividades).filter((a) => !a.is_deleted).length;
      showToast('success', `¡Bitácora sincronizada exitosamente con el servidor (${count} actividades guardadas en la nube)!`);
    } catch (err: any) {
      showToast('error', `Error al sincronizar con el servidor: ${err.message || 'Fallo de conexión'}`);
    }
  };

  // Sincronizar título de página y favicon con la configuración institucional
  useEffect(() => {
    if (systemSettings) {
      if (systemSettings.system_title) {
        document.title = systemSettings.system_title;
      }
      if (systemSettings.favicon_url) {
        const link = (document.querySelector("link[rel*='icon']") as HTMLLinkElement) || document.createElement('link');
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = systemSettings.favicon_url;
        document.getElementsByTagName('head')[0].appendChild(link);
      }
    }
  }, [systemSettings]);

  const handleFieldChange = (field: keyof Bitacora, value: any) => {
    setBitacora((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'colaborador' && currentUser?.role === 'admin') {
        const matched = users.find((u) => u.full_name.toLowerCase() === String(value).toLowerCase());
        if (matched) {
          updated.user_id = matched.id;
        }
      }
      return updated;
    });
  };

  const handleDateChange = async (newDate: string) => {
    if (!newDate || newDate === bitacora.fecha) return;
    isSwitchingDateRef.current = true;

    const effectiveUser = activeProxyUser || currentUser;
    const activeUid = effectiveUser?.id || bitacora.user_id;
    const activeName = effectiveUser?.full_name || bitacora.colaborador;
    const requestingUid = currentUser?.id;

    // 1. Guardar la bitácora del día actual de forma segura antes de cambiar de fecha (inmediato en local, no bloquea UI)
    if (bitacora.fecha && activeName) {
      const currentDraftKey = getDraftKey(activeUid, bitacora.fecha);
      localStorage.setItem(currentDraftKey, JSON.stringify(bitacora));

      if (bitacora.actividades.length > 0 || bitacora.pendientes || bitacora.prioridad_siguiente) {
        api.saveBitacora({
          ...bitacora,
          colaborador: activeName,
          user_id: activeUid,
        }, requestingUid).catch((e) => console.warn('Background save before date switch:', e));
      }
    }

    try {
      // 2. Consultar al backend por la bitácora de la nueva fecha
      const serverBitacoras = await api.getBitacoras(newDate, undefined, undefined, activeUid, requestingUid);
      const serverMatch = serverBitacoras.find(
        (b) =>
          (b.user_id === activeUid ||
            b.colaborador.toLowerCase() === activeName.toLowerCase() ||
            (effectiveUser?.username && b.colaborador.toLowerCase() === effectiveUser.username.toLowerCase())) &&
          b.fecha === newDate
      );

      // Obtener el borrador local para la nueva fecha
      const localDraft = getBestLocalDraft(activeUid, newDate, activeName);

      // REGLA 1: Si existe en el servidor, es la base; se rescata solo lo que el borrador no llegó a subir
      if (serverMatch) {
        const r = reconcileDraftWithServer(serverMatch, localDraft);
        setBitacora(r.bitacora);
        setIsGenerated(isClosedEstado(r.bitacora.estado));
        lastSavedSignature.current = getBitacoraSignature(r.bitacora, activeName, activeUid);
        setAutoSaveStatus('saved');
        setLastSavedTime(new Date());
        if (r.hasLocalChanges) {
          syncNow({ ...r.bitacora, colaborador: activeName, user_id: activeUid }).catch(console.warn);
        }
        return;
      }

      // REGLA 2: Si no existe en el backend, usar el borrador local y subirlo de forma segura
      if (localDraft) {
        setBitacora(localDraft);
        setIsGenerated(false);
        lastSavedSignature.current = getBitacoraSignature(localDraft, activeName, activeUid);
        if ((localDraft.actividades || []).some((a) => !a.is_deleted)) {
          syncNow({ ...localDraft, colaborador: activeName, user_id: activeUid }, { mode: 'merge' }).catch(console.warn);
        }
        return;
      }

      // 4. Si no hay nada, inicializar bitácora limpia vacía para esa fecha
      const cleanBitacora: Bitacora = {
        ...defaultBitacora,
        id: undefined,
        fecha: newDate,
        hora_inicio: systemSettings?.hora_inicio_default || bitacora.hora_inicio || '08:30',
        colaborador: activeName,
        user_id: activeUid,
        area: effectiveUser?.team_name || currentUser?.team_name || bitacora.area || 'Sistemas',
        actividades: [],
        pendientes: '',
        necesita_apoyo: 'No',
        apoyo_detalle: '',
        prioridad_siguiente: '',
      };
      setBitacora(cleanBitacora);
      setIsGenerated(false);
      lastSavedSignature.current = getBitacoraSignature(cleanBitacora, cleanBitacora.colaborador, cleanBitacora.user_id);
      setAutoSaveStatus('idle');
    } catch (e) {
      console.warn('Error fetching bitacora for date:', newDate, e);
    } finally {
      setTimeout(() => {
        isSwitchingDateRef.current = false;
      }, 50);
    }
  };

  // Auto-detectar cambio de día al volver a la pestaña (evita registrar tareas en el día de ayer por error)
  useEffect(() => {
    const handleFocusOrVisible = () => {
      if (document.visibilityState === 'visible' && currentUser?.id) {
        const todayStr = getTodayLocalDateStr();
        if (bitacora.fecha && bitacora.fecha < todayStr) {
          if (bitacora.actividades.length === 0 || bitacora.estado === 'cerrada' || bitacora.estado === 'cerrada_sistema') {
            console.log(`[SmartSync] Cambio de jornada detectado (activa: ${bitacora.fecha}, hoy: ${todayStr}). Cambiando a hoy.`);
            handleDateChange(todayStr);
          }
        }
      }
    };
    document.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);
    return () => {
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
    };
  }, [currentUser?.id, bitacora.fecha, bitacora.actividades.length, bitacora.estado]);

  const reloadActiveBitacora = async () => {
    refreshPapeleraCount();
    const effectiveUser = activeProxyUser || currentUser;
    const activeUid = effectiveUser?.id || bitacora.user_id;
    const activeName = effectiveUser?.full_name || bitacora.colaborador;
    try {
      const serverBitacoras = await api.getBitacoras(bitacora.fecha, undefined, undefined, activeUid, currentUser?.id);
      const serverMatch = serverBitacoras.find(
        (b) =>
          (b.user_id === activeUid ||
            b.colaborador.toLowerCase() === activeName.toLowerCase() ||
            (effectiveUser?.username && b.colaborador.toLowerCase() === effectiveUser.username.toLowerCase())) &&
          b.fecha === bitacora.fecha
      );
      if (serverMatch) {
        // Conservar ediciones locales aún no guardadas (no pisar con la versión del servidor)
        setBitacora((prev) => (prev.fecha === serverMatch.fecha ? reconcileDraftWithServer(serverMatch, prev).bitacora : prev));
        setIsGenerated(isClosedEstado(serverMatch.estado));
      }
    } catch (e) {
      console.warn('Error reloading bitacora:', e);
    }
  };

  // Alternar entre bitácora personal y Modo Apoyo
  const handleSelectProxyUser = async (targetUser: User | null) => {
    // 1. Guardar de inmediato cualquier cambio de la bitácora activa en memoria
    const currentEffective = activeProxyUser || currentUser;
    if (currentEffective && bitacora.fecha) {
      localStorage.setItem(getDraftKey(currentEffective.id, bitacora.fecha), JSON.stringify(bitacora));
      if (!activeProxyUser) {
        localStorage.setItem('active_bitacora', JSON.stringify(bitacora));
      }
      if (bitacora.actividades.length > 0) {
        api.saveBitacora({
          ...bitacora,
          colaborador: currentEffective.full_name,
          user_id: currentEffective.id,
        }, currentUser?.id).catch((e) => console.warn('Sync before switching proxy:', e));
      }
    }

    isSwitchingDateRef.current = true;
    setActiveProxyUser(targetUser);

    const newTarget = targetUser || currentUser;
    const targetDate = bitacora.fecha || getTodayLocalDateStr();

    if (!newTarget || !newTarget.id) {
      isSwitchingDateRef.current = false;
      return;
    }

    try {
      setAutoSaveStatus('saving');
      // Consultar servidor con requesting_user_id
      const serverBitacoras = await api.getBitacoras(targetDate, undefined, undefined, newTarget.id, currentUser?.id);
      const serverMatch = serverBitacoras.find(
        (b) => (b.user_id === newTarget.id || b.colaborador.toLowerCase() === newTarget.full_name.toLowerCase()) && b.fecha === targetDate
      );

      const localDraft = getBestLocalDraft(newTarget.id, targetDate, newTarget.full_name);

      let nextBitacora: Bitacora;
      let pushMode: 'replace' | 'merge' | null = null;

      if (serverMatch) {
        const r = reconcileDraftWithServer(serverMatch, localDraft);
        nextBitacora = r.bitacora;
        if (r.hasLocalChanges) pushMode = 'replace';
      } else if (localDraft) {
        nextBitacora = localDraft;
        if ((localDraft.actividades || []).some((a) => !a.is_deleted)) pushMode = 'merge';
      } else {
        nextBitacora = {
          ...defaultBitacora,
          fecha: targetDate,
          hora_inicio: systemSettings?.hora_inicio_default || '08:30',
          colaborador: newTarget.full_name,
          user_id: newTarget.id,
          area: newTarget.team_name || 'Sistemas',
          actividades: [],
          estado: 'borrador',
        };
      }

      setBitacora(nextBitacora);
      setIsGenerated(nextBitacora.estado === 'generada' || nextBitacora.estado === 'cerrada' || nextBitacora.estado === 'cerrada_sistema');
      lastSavedSignature.current = getBitacoraSignature(nextBitacora, newTarget.full_name, newTarget.id);
      setAutoSaveStatus('saved');
      if (pushMode) {
        syncNow({ ...nextBitacora, colaborador: newTarget.full_name, user_id: newTarget.id }, { mode: pushMode }).catch(console.warn);
      }

      if (targetUser) {
        showToast('info', `Modo Apoyo activado: registrando tareas para ${targetUser.full_name}`, '🤝 Modo Apoyo');
      } else {
        showToast('info', 'Has vuelto a tu bitácora personal', '👤 Mi Bitácora');
      }
    } catch (e) {
      console.warn('Error switching proxy target:', e);
      setAutoSaveStatus('error');
    } finally {
      setTimeout(() => {
        isSwitchingDateRef.current = false;
      }, 50);
    }
  };

  const handleUserUpdated = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('bitacora_user', JSON.stringify(updatedUser));
    if (bitacora.user_id === updatedUser.id) {
      setBitacora((prev) => ({ ...prev, colaborador: updatedUser.full_name }));
    }
    showToast('success', 'Perfil y datos actualizados correctamente', 'Perfil Guardado');
  };

  const handleActivityRestoredFromPapelera = (restoredAct: any, bitacoraFecha?: string) => {
    refreshPapeleraCount();
    if (restoredAct?.id !== undefined) pendingDeletedIds.current.delete(String(restoredAct.id));
    if (!bitacoraFecha || bitacoraFecha === bitacora.fecha) {
      setBitacora((prev) => {
        const exists = prev.actividades.some((a) => a.id === restoredAct.id);
        const nextActs = exists
          ? prev.actividades.map((a) => (a.id === restoredAct.id ? { ...restoredAct, is_deleted: 0 } : a))
          : [...prev.actividades, { ...restoredAct, is_deleted: 0 }];
        return {
          ...prev,
          actividades: nextActs,
        };
      });
      showToast('success', 'Actividad recuperada y añadida a tus actividades activas', 'Recuperada');
    } else {
      showToast('info', `Actividad recuperada en la bitácora del ${bitacoraFecha}`, 'Restaurada');
      reloadActiveBitacora();
    }
  };

  const handleAddActividad = (actData?: Actividad) => {
    const newAct: Actividad = {
      ...(actData || {}),
      id: actData?.id || `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orden: bitacora.actividades.length,
      hora_inicio: actData?.hora_inicio || bitacora.hora_inicio || '08:30',
      duracion_min: actData?.duracion_min !== undefined ? actData.duracion_min : 30,
      tipo_trabajo: actData?.tipo_trabajo || 'Desarrollo',
      descripcion: actData?.descripcion || '',
      para_cliente: actData?.para_cliente || '',
      estado: actData?.estado || 'completada',
    };
    setBitacora((prev) => ({
      ...prev,
      actividades: [...prev.actividades, newAct],
    }));
  };

  const handleAddActividadConEstado = (estado: EstadoActividad) => {
    const newAct: Actividad = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      orden: bitacora.actividades.length,
      hora_inicio: '',
      duracion_min: 30,
      tipo_trabajo: 'Desarrollo',
      descripcion: '',
      para_cliente: '',
      estado: estado,
    };
    setBitacora((prev) => ({
      ...prev,
      actividades: [...prev.actividades, newAct],
    }));
  };

  const handleUpdateActividad = (index: number, field: keyof Actividad, value: any) => {
    setBitacora((prev) => {
      const updated = [...prev.actividades];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return {
        ...prev,
        actividades: updated,
      };
    });
  };

  const handleUpdateActividadDetalle = async (index: number, updatedData: Partial<Actividad>) => {
    const current = bitacora.actividades[index];
    setBitacora((prev) => {
      const updated = [...prev.actividades];
      updated[index] = {
        ...updated[index],
        ...updatedData,
      };
      return {
        ...prev,
        actividades: updated,
      };
    });
    if (current && current.id && !String(current.id).startsWith('act-') && !isNaN(Number(current.id))) {
      await api.updateActividadDetalle(Number(current.id), updatedData);
      showToast('success', 'Detalle de actividad guardado');
    }
  };

  const handleUpdateEstado = async (index: number, nuevoEstado: EstadoActividad) => {
    const act = bitacora.actividades[index];
    handleUpdateActividad(index, 'estado', nuevoEstado);
    const label =
      nuevoEstado === 'completada'
        ? 'Completada'
        : nuevoEstado === 'en_revision'
        ? 'En Revisión'
        : 'En Proceso';
    showToast('info', `Tarea marcada como "${label}"`);
    if (act && act.id && !String(act.id).startsWith('act-') && !isNaN(Number(act.id))) {
      await api.updateActividadEstado(Number(act.id), nuevoEstado);
    }
  };

  const handleRemoveActividad = async (index: number) => {
    const act = bitacora.actividades[index];
    const persisted = !!act && isPersistedId(act.id);
    // Registrar la eliminación pendiente: viaja en el próximo guardado aunque falle la llamada directa
    if (persisted) pendingDeletedIds.current.add(String(act.id));
    setBitacora((prev) => ({
      ...prev,
      actividades: act
        ? prev.actividades.filter((a) => a !== act && !(act.id !== undefined && a.id === act.id))
        : prev.actividades.filter((_, i) => i !== index),
    }));
    showToast('info', 'Actividad movida a la papelera (retención 15 días)');
    if (persisted) {
      try {
        await api.softDeleteActividad(Number(act.id));
        pendingDeletedIds.current.delete(String(act.id));
        refreshPapeleraCount();
      } catch (e) {
        console.warn('Error soft-deleting act (se reintentará en el próximo guardado):', e);
      }
    }
  };

  const handleSyncWithBitacora = async () => {
    try {
      const effectiveUser = activeProxyUser || currentUser;
      const colab = bitacora.colaborador || effectiveUser?.full_name || 'Juan Pérez García';
      const uid = bitacora.user_id || effectiveUser?.id;
      const res = await api.importarActividadesPendientes(colab, uid, bitacora.fecha);
      if (res.actividades && res.actividades.length > 0) {
        setBitacora((prev) => {
          const existingIds = new Set(prev.actividades.map((a) => a.id));
          const toAdd = res.actividades.filter((a) => !existingIds.has(a.id));
          return {
            ...prev,
            actividades: [...prev.actividades, ...toAdd],
          };
        });
        showToast('success', `${res.count} tareas activas importadas para hoy`, 'Sincronización Exitosa');
      } else {
        showToast('info', 'No se encontraron tareas pendientes de días anteriores para importar');
      }
    } catch (e: any) {
      console.warn('Sync error', e);
      showToast('error', 'Error al sincronizar actividades pendientes');
    }
    setViewMode('lista');
  };

  const handleGenerateBitacora = async () => {
    // 0. En Modo Apoyo, el cierre formal de jornada está reservado al titular o al auto-cierre del sistema
    if (activeProxyUser) {
      showToast('error', `El cierre formal de jornada está reservado al colaborador titular (${activeProxyUser.full_name}) o al auto-cierre nocturno del sistema. Las tareas de apoyo ya están guardadas y respaldadas.`, 'Cierre no permitido');
      return;
    }

    // 1. Validar que existan actividades registradas en la jornada
    const activeActs = (bitacora.actividades || []).filter((a) => !a.is_deleted);
    if (activeActs.length === 0) {
      showToast('error', 'Debes registrar al menos una actividad antes de generar la bitácora del día', 'Sin actividades');
      return;
    }

    // 2. Si los campos de cierre están vacíos, autocompletar con texto estándar para no bloquear al usuario
    const pendientesText = bitacora.pendientes?.trim() || 'Sin tareas pendientes para otra fecha';
    const prioridadText = bitacora.prioridad_siguiente?.trim() || 'Continuar con el plan de actividades programado';


    setIsSaving(true);
    try {
      const payload: Bitacora = {
        ...bitacora,
        pendientes: pendientesText,
        prioridad_siguiente: prioridadText,
        user_id: bitacora.user_id || currentUser?.id,
        colaborador: bitacora.colaborador || currentUser?.full_name || '',
        estado: 'generada',
      };
      // El estado en memoria pasa a ser exactamente lo enviado (la respuesta se fusiona sin perder nada)
      setBitacora(payload);
      await syncNow(payload);
      setIsGenerated(true);

      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2563eb', '#38bdf8', '#10b981', '#f59e0b'],
        });
      } catch (e) {}

      showToast('success', '¡Bitácora guardada exitosamente en el servidor!', 'Jornada Registrada');

      const updatedHistory = await api.getBitacoras(undefined, undefined, undefined, currentUser?.id);
      setHistorial(updatedHistory);

      // Open WhatsApp Share Modal so user can send link immediately
      setWhatsAppModalOpen(true);

      // Desplegar panel lateral de resumen automáticamente al generar bitácora
      setMobileDrawerOpen(true);
    } catch (e: any) {
      console.error('Error generando bitacora', e);
      showToast('error', e.message || 'Error al guardar la bitácora en el servidor', 'Atención');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadBitacora = (selected: Bitacora) => {
    setBitacora(selected);
    setViewMode('lista');
    setIsGenerated(true);
    setAutoSaveStatus('saved');
    lastSavedSignature.current = getBitacoraSignature(selected, selected.colaborador, selected.user_id);
    showToast('info', `Cargada bitácora del ${selected.fecha}`);
  };

  const handleDeleteBitacora = async (id: number) => {
    if (window.confirm('¿Deseas eliminar este registro del historial?')) {
      await api.deleteBitacora(id);
      setHistorial((prev) => prev.filter((b) => b.id !== id));
      showToast('info', 'Registro eliminado del historial');
    }
  };

  const handleLoginSuccess = (user: User) => {
    // 1. Resetear firma y establecer usuario
    lastSavedSignature.current = '';
    
    // 2. Inicializar de inmediato la bitácora con los datos limpios del nuevo usuario
    const todayStr = getTodayLocalDateStr();
    setBitacora({
      ...defaultBitacora,
      fecha: todayStr,
      hora_inicio: systemSettings?.hora_inicio_default || '08:30',
      colaborador: user.full_name,
      user_id: user.id,
      area: user.team_name || 'Sistemas',
      actividades: [],
      estado: 'borrador',
    });
    setHistorial([]);
    
    // 3. Establecer usuario y cargar datos frescos desde el servidor
    setActiveProxyUser(null);
    setCurrentUser(user);
    loadInitialData(user);
    
    if (user.role === 'admin' || user.role === 'lider' || user.is_leader) {
      setViewMode('equipo');
    } else {
      setViewMode('lista');
    }
  };

  const handleLogout = () => {
    // 1. Limpiar usuario autenticado y token de sesión
    api.logout();
    pendingDeletedIds.current.clear();
    setActiveProxyUser(null);
    setDelegatedTargets([]);
    setCurrentUser(null);
    localStorage.removeItem('auth_user');
    
    // 2. Limpiar borradores globales para evitar sangrado o residuos hacia el siguiente usuario
    localStorage.removeItem('active_bitacora');
    localStorage.removeItem('bitacoras_history');
    
    // 3. Resetear memoria y estado completamente limpio
    setBitacora({
      ...defaultBitacora,
      fecha: getTodayLocalDateStr(),
      actividades: [],
      id: undefined,
      colaborador: '',
      user_id: undefined,
      pendientes: '',
      necesita_apoyo: 'No',
      apoyo_detalle: '',
      prioridad_siguiente: '',
      tiempo_total_min: 0,
      estado: 'borrador',
    });
    setHistorial([]);
    lastSavedSignature.current = '';
    setAutoSaveStatus('saved');
    setIsGenerated(false);
    setViewMode('lista');
  };

  // Sesión expirada, inválida o contraseña cambiada (401): volver al login conservando borradores locales
  useEffect(() => {
    const onExpired = () => {
      handleLogout();
      setSessionNotice('Tu sesión expiró o fue cerrada. Inicia sesión nuevamente: tus borradores locales están a salvo.');
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuando nadie está autenticado, renderizar la pantalla completa de Login
  if (!currentUser) {
    return (
      <>
        {sessionNotice && (
          <div
            role="status"
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md rounded-2xl border border-amber-300 dark:border-amber-800 bg-amber-50/95 dark:bg-amber-950/90 text-amber-900 dark:text-amber-100 px-4 py-3 text-sm shadow-lg backdrop-blur flex items-start gap-3"
          >
            <span className="flex-1 leading-snug">{sessionNotice}</span>
            <button
              type="button"
              id="session-notice-close"
              onClick={() => setSessionNotice(null)}
              className="font-bold opacity-70 hover:opacity-100 cursor-pointer"
              aria-label="Cerrar aviso"
            >
              ×
            </button>
          </div>
        )}
        <LoginPage
          onLoginSuccess={(u) => {
            setSessionNotice(null);
            handleLoginSuccess(u);
          }}
          systemSettings={systemSettings || undefined}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7F9] dark:bg-[#0B0F17] text-slate-800 dark:text-slate-100 flex flex-row font-sans transition-colors duration-250">
      {/* Collapsible Sidebar Navigation with Mobile Drawer */}
      <Sidebar
        currentView={viewMode}
        onViewChange={setViewMode}
        activitiesCount={bitacora.actividades.length}
        onOpenMobileSummary={() => setMobileDrawerOpen(true)}
        currentUser={currentUser}
        onOpenLogin={() => setLoginModalOpen(true)}
        onLogout={handleLogout}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        onOpenHelp={() => setHelpModalOpen(true)}
        systemSettings={systemSettings || undefined}
        isDark={isDark}
        onToggleTheme={toggleTheme}
        onOpenProfile={() => setUserProfileModalOpen(true)}
        onOpenPapelera={() => setPapeleraModalOpen(true)}
        papeleraCount={papeleraCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Header Bar */}
        <TopHeader
          currentView={viewMode}
          currentUser={currentUser}
          bitacoraFecha={bitacora.fecha}
          activitiesCount={bitacora.actividades.length}
          onOpenProfile={() => setUserProfileModalOpen(true)}
          autoSaveStatus={autoSaveStatus}
          onForceSyncCloud={handleForceSyncCloud}
          unreadNotificationsCount={notifications.filter((n) => !n.read).length}
          onOpenNotifications={() => setNotificationsModalOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
          delegatedTargets={delegatedTargets}
          activeProxyUser={activeProxyUser}
          onSelectProxyUser={handleSelectProxyUser}
          onOpenErrorReport={() => setErrorReportModalOpen(true)}
        />

        <main className="flex-1 w-full px-3 sm:px-6 py-4 sm:py-5 pb-24 md:pb-6">
          {/* VIEW 1: MI BITÁCORA */}
          {viewMode === 'lista' && (
            <div className="w-full max-w-[1700px] mx-auto space-y-6">
              {activeProxyUser && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                      🤝
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wider font-extrabold bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                          Modo Apoyo Activo
                        </span>
                        <span className="text-xs text-amber-700/80 dark:text-amber-400/80 hidden sm:inline">
                          Las actividades se registrarán en la bitácora de este colaborador
                        </span>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                        Registrando para:{' '}
                        <span className="text-amber-600 dark:text-amber-400 font-extrabold">
                          {activeProxyUser.full_name}
                        </span>
                        {activeProxyUser.team_name && (
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal ml-2">
                            ({activeProxyUser.team_name})
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                    {delegatedTargets.length > 1 && (
                      <div className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-600/40 shadow-xs">
                        <label htmlFor="proxy-target-select" className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          Cambiar a:
                        </label>
                        <select
                          id="proxy-target-select"
                          value={activeProxyUser.id}
                          onChange={(e) => {
                            const selectedId = Number(e.target.value);
                            const target = delegatedTargets.find((t) => t.id === selectedId);
                            if (target) handleSelectProxyUser(target);
                          }}
                          className="bg-transparent text-xs font-bold text-amber-700 dark:text-amber-300 focus:outline-hidden cursor-pointer"
                        >
                          {delegatedTargets.map((t) => (
                            <option key={t.id} value={t.id} className="text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800">
                              {t.full_name} {t.team_name ? `(${t.team_name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <button
                      onClick={() => handleSelectProxyUser(null)}
                      className="inline-flex items-center justify-center px-3.5 py-1.5 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl transition-all shadow-xs cursor-pointer"
                    >
                      Volver a mi bitácora
                    </button>
                  </div>
                </div>
              )}

              <ActividadesLista
                actividades={bitacora.actividades}
                onAddActividad={handleAddActividad}
                onUpdateActividad={handleUpdateActividad}
                onUpdateActividadDetalle={handleUpdateActividadDetalle}
                onUpdateEstado={handleUpdateEstado}
                onRemoveActividad={handleRemoveActividad}
                users={users}
                currentUser={currentUser}
                fecha={bitacora.fecha}
                onDateChange={handleDateChange}
                horaInicio={bitacora.hora_inicio}
                onHoraInicioChange={(val) => handleFieldChange('hora_inicio', val)}
                autoSaveStatus={autoSaveStatus}
                lastSavedTime={lastSavedTime}
                onForceSyncCloud={handleForceSyncCloud}
                onOpenErrorReport={() => setErrorReportModalOpen(true)}
              />

              <CierreJornada
                pendientes={bitacora.pendientes}
                necesitaApoyo={bitacora.necesita_apoyo}
                apoyoDetalle={bitacora.apoyo_detalle}
                prioridadSiguiente={bitacora.prioridad_siguiente}
                isSaving={isSaving}
                onChange={handleFieldChange}
                onSubmit={handleGenerateBitacora}
                isProxyMode={Boolean(activeProxyUser)}
                proxyUserName={activeProxyUser?.full_name}
              />
            </div>
          )}

          {/* VIEW 2: ACTIVIDADES (KANBAN) */}
          {viewMode === 'kanban' && (
            <KanbanBoard
              actividades={bitacora.actividades}
              onUpdateEstado={handleUpdateEstado}
              onUpdateActividadDetalle={handleUpdateActividadDetalle}
              onAddActividadConEstado={handleAddActividadConEstado}
              onRemoveActividad={handleRemoveActividad}
              onSyncWithBitacora={handleSyncWithBitacora}
              colaborador={bitacora.colaborador}
            />
          )}

          {/* VIEW 3: SEGUIMIENTO DE EQUIPO (Líderes y Admin) */}
          {viewMode === 'equipo' && isLider && (
            <TeamSupervisionView currentUser={currentUser} teams={teams} users={users} />
          )}

          {/* VIEW 4: DASHBOARD DE ANALÍTICA Y KPIS */}
          {viewMode === 'dashboard' && (
            <DashboardView currentUser={currentUser} teams={teams} />
          )}

          {/* VIEW 4: GESTIÓN DE USUARIOS Y EQUIPOS (Solo Admin) */}
          {viewMode === 'gestion' && isAdmin && (
            <UserManagementView
              teams={teams}
              onRefreshTeams={loadInitialData}
              systemSettings={systemSettings || undefined}
              onUpdateSettings={setSystemSettings}
              currentUser={currentUser}
            />
          )}

          {/* VIEW 5: HISTORIAL */}
          {viewMode === 'historial' && (
            <HistorialView
              historial={historial}
              users={users}
              currentUser={currentUser}
              onLoadBitacora={handleLoadBitacora}
              onDeleteBitacora={handleDeleteBitacora}
            />
          )}

          {/* VIEW 6: BUZÓN DE SUGERENCIAS */}
          {viewMode === 'buzon' && (
            <BuzonView
              currentUser={currentUser}
              onShowToast={(msg, type) => showToast(type || 'info', msg)}
            />
          )}

          {/* VIEW 7: ACCESOS DIRECTOS Y BÓVEDA IT */}
          {viewMode === 'vault' && (
            <VaultView
              currentUser={currentUser}
              onShowToast={(msg, type) => showToast(type || 'info', msg)}
            />
          )}

          {/* VIEW 8: MANUAL DE PROCESOS & OPERACIONES */}
          {viewMode === 'manual' && (
            <ManualView
              currentUser={currentUser}
              onNavigateToView={(v) => {
                setViewMode(v);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenHelpModal={() => setHelpModalOpen(true)}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (md:hidden) */}
      <BottomNav
        currentView={viewMode}
        onViewChange={(newView) => {
          setViewMode(newView);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        activitiesCount={bitacora.actividades.length}
        onOpenSummary={() => setMobileDrawerOpen(true)}
        onToggleMobileMenu={() => setMobileMenuOpen(true)}
        currentUser={currentUser}
      />

      {/* Floating Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 3-Step Visual Help & Onboarding Guide Modal */}
      <HelpGuideModal
        isOpen={helpModalOpen}
        onClose={() => setHelpModalOpen(false)}
      />

      {/* Panel Lateral Desplegable de Resumen (Slide-over para Desktop y Móvil) */}
      <SummaryDrawer
        isOpen={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        bitacora={bitacora}
        isGenerated={isGenerated}
        onOpenWhatsApp={() => setWhatsAppModalOpen(true)}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        systemSettings={systemSettings || undefined}
      />

      {/* WhatsApp Share Modal with leader, collaborator, or custom number options */}
      <WhatsAppShareModal
        isOpen={whatsAppModalOpen}
        onClose={() => setWhatsAppModalOpen(false)}
        bitacora={bitacora}
        currentUser={currentUser}
        users={users}
        teams={teams}
      />

      {/* Consolidated User Profile & Account Settings Modal */}
      <UserProfileModal
        isOpen={userProfileModalOpen}
        onClose={() => setUserProfileModalOpen(false)}
        currentUser={currentUser}
        teams={teams}
        onUserUpdated={handleUserUpdated}
      />

      {/* Papelera Modal with Smart Restoring */}
      <PapeleraModal
        isOpen={papeleraModalOpen}
        onClose={() => setPapeleraModalOpen(false)}
        currentUser={currentUser}
        onActivityRestored={handleActivityRestoredFromPapelera}
        currentBitacoraFecha={bitacora.fecha}
        currentBitacoraId={typeof bitacora.id === 'number' ? bitacora.id : undefined}
      />

      {/* Notifications Drawer / Modal */}
      <NotificationsModal
        isOpen={notificationsModalOpen}
        onClose={() => setNotificationsModalOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkNotificationAsRead}
        onMarkAllAsRead={handleMarkAllNotificationsAsRead}
        onClearAll={handleClearAllNotifications}
        onRemoveNotification={handleRemoveNotification}
      />

      {/* Modal de Diagnóstico y Reporte Técnico de Errores con Captura de Pantalla */}
      <ErrorReportModal
        isOpen={errorReportModalOpen}
        onClose={() => setErrorReportModalOpen(false)}
        errorMessage={lastSyncErrorMessage}
        currentUser={currentUser}
        onRetrySync={async () => {
          await handleForceSyncCloud();
          setErrorReportModalOpen(false);
        }}
      />
    </div>
  );
}

export default App;
