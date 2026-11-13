import { Bitacora, Actividad } from '../types';

export const getDraftKey = (userId?: number, dateStr?: string) =>
  `bitacora_draft_${userId || 'user'}_${dateStr || 'today'}`;

/**
 * Firma canónica normalizada de la bitácora:
 * Compara únicamente los datos editados por el usuario, omitiendo timestamps volátiles
 * (updated_at, created_at) para evitar bucles infinitos de auto-guardado continuo.
 */
export const getBitacoraSignature = (
  b?: Partial<Bitacora> | null,
  defaultColab?: string,
  defaultUid?: number
): string => {
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
      hora_fin: (a.hora_fin || '').trim(),
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

// ID numérico = actividad ya persistida en el servidor. Los IDs `act-...` son temporales.
export const isPersistedId = (id: unknown): boolean =>
  id !== undefined && id !== null && /^\d+$/.test(String(id));

const SYNC_HEADER_FIELDS = [
  'hora_inicio',
  'area',
  'pendientes',
  'necesita_apoyo',
  'apoyo_detalle',
  'prioridad_siguiente',
  'estado',
] as const;

export const actContentSig = (a: Actividad): string =>
  JSON.stringify([
    (a.hora_inicio || '').trim(),
    (a.hora_fin || '').trim(),
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
 * la petición estaba en vuelo.
 */
export const mergeSavedBitacora = (
  prev: Bitacora,
  sent: Bitacora,
  server: Bitacora,
  pendingDeleted?: Set<string>
): { bitacora: Bitacora; clean: boolean } => {
  if (!server || prev.fecha !== sent.fecha || server.fecha !== sent.fecha) {
    return { bitacora: prev, clean: false };
  }
  if (prev.user_id && sent.user_id && String(prev.user_id) !== String(sent.user_id)) {
    return { bitacora: prev, clean: false };
  }

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
        out.push({
          ...srv,
          ...local,
          id: srv.id,
          client_uid: srv.client_uid || local.client_uid,
          updated_at: srv.updated_at,
        });
      }
      continue;
    }
    if (sentRefs.has(local)) {
      continue;
    }
    if (isPersistedId(local.id)) {
      continue;
    }
    clean = false;
    out.push(local);
  }
  for (const s of srvActs) {
    if (used.has(s)) continue;
    if (sentKeys.has(String(s.id)) || (s.client_uid && sentKeys.has(String(s.client_uid)))) continue;
    out.push(s);
  }

  const merged: any = {
    ...prev,
    id: server.id ?? prev.id,
    tiempo_total_min: server.tiempo_total_min ?? prev.tiempo_total_min,
  };
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
 * Reconcilia un borrador local con la versión fresca del servidor.
 * El servidor es la fuente de verdad; del borrador solo se rescata lo que aún no llegó al servidor.
 */
export const reconcileDraftWithServer = (
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
      l &&
      !l.is_deleted &&
      l.updated_at &&
      s.updated_at &&
      String(l.updated_at) === String(s.updated_at) &&
      actContentSig(l) !== actContentSig(s)
    ) {
      changed = true;
      return { ...s, ...l, id: s.id, updated_at: s.updated_at };
    }
    return s;
  });
  const srvUids = new Set(srvActs.filter((a) => a.client_uid).map((a) => String(a.client_uid)));
  const legacyDescs = new Set(
    srvActs
      .filter((a) => !a.client_uid)
      .map((a) => (a.descripcion || '').trim().toLowerCase())
      .filter(Boolean)
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

export const isClosedEstado = (e?: string) =>
  e === 'generada' || e === 'cerrada' || e === 'cerrada_sistema';

/**
 * Obtiene el borrador local más confiable con aislamiento estricto por usuario y fecha.
 * Prioriza la clave determinista `bitacora_draft_${userId}_${dateStr}` sobre respaldos heredados.
 */
export const getBestLocalDraft = (
  userId?: number,
  dateStr?: string,
  userName?: string
): Bitacora | null => {
  const isValidCandidate = (b: any): b is Bitacora => {
    if (!b || b.fecha !== dateStr || !Array.isArray(b.actividades)) return false;
    if (userId) {
      if (b.user_id && b.user_id !== userId) return false;
      if (
        userName &&
        b.colaborador &&
        b.colaborador.toLowerCase() !== userName.toLowerCase() &&
        b.user_id !== userId
      ) {
        return false;
      }
    }
    return true;
  };

  // 1. Clave primaria canónica por usuario y fecha
  if (userId && dateStr) {
    try {
      const str = localStorage.getItem(getDraftKey(userId, dateStr));
      if (str) {
        const parsed = JSON.parse(str);
        if (isValidCandidate(parsed)) {
          return parsed;
        }
      }
    } catch (e) {}
  }

  // 2. Respaldo en active_bitacora si coincide exactamente con el usuario y fecha
  try {
    const str = localStorage.getItem('active_bitacora');
    if (str) {
      const parsed = JSON.parse(str);
      if (isValidCandidate(parsed)) {
        return parsed;
      }
    }
  } catch (e) {}

  return null;
};

