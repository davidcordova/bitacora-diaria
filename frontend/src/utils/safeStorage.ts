/**
 * Persistencia defensiva en `localStorage`:
 * - Evita excepciones no controladas (`QuotaExceededError`) en sesiones prolongadas.
 * - Purga borradores antiguos (`bitacora_draft_*` > 14 días) automáticamente si falta espacio.
 */

const DRAFT_PREFIX = 'bitacora_draft_';
const DRAFT_RETENTION_DAYS = 14;

export function pruneOldBitacoraDrafts(retentionDays = DRAFT_RETENTION_DAYS): number {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - retentionDays);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(
      cutoff.getDate()
    ).padStart(2, '0')}`;

    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(DRAFT_PREFIX)) continue;
      const match = k.match(/(\d{4}-\d{2}-\d{2})$/);
      if (match && match[1] < cutoffStr) {
        toRemove.push(k);
      }
    }
    toRemove.forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
    return toRemove.length;
  } catch {
    return 0;
  }
}

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    // Reintentar tras purgar borradores antiguos y caché pesada de historial
    pruneOldBitacoraDrafts(7);
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      try {
        localStorage.removeItem('bitacoras_history');
        localStorage.setItem(key, value);
        return true;
      } catch {
        return false;
      }
    }
  }
}

export function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
