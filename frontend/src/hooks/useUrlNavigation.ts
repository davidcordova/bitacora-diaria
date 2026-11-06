import { useEffect } from 'react';
import { ViewMode } from '../types';

const VALID_VIEWS: Set<ViewMode> = new Set([
  'lista',
  'kanban',
  'historial',
  'equipo',
  'dashboard',
  'gestion',
  'buzon',
  'vault',
  'manual',
]);

export function getInitialViewFromUrl(defaultView: ViewMode = 'lista'): ViewMode {
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view') as ViewMode | null;
    if (v && VALID_VIEWS.has(v)) {
      return v;
    }
  } catch (e) {}
  return defaultView;
}

export function getInitialDateFromUrl(defaultDate: string): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const f = params.get('fecha');
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) {
      return f;
    }
  } catch (e) {}
  return defaultDate;
}

interface UseUrlNavigationParams {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  fecha?: string;
  onDateChange?: (d: string) => void;
  enabled: boolean;
}

/**
 * Sincroniza la vista activa (`viewMode`) y la fecha de bitácora (`fecha`) con la URL
 * del navegador, soportando recarga con F5, enlaces compartibles y botones Atrás/Adelante.
 */
export function useUrlNavigation({
  viewMode,
  setViewMode,
  fecha,
  onDateChange,
  enabled,
}: UseUrlNavigationParams) {
  // Actualizar URL cuando cambian viewMode o fecha
  useEffect(() => {
    if (!enabled) return;
    try {
      const url = new URL(window.location.href);
      const currentViewParam = url.searchParams.get('view');
      const currentFechaParam = url.searchParams.get('fecha');

      let changed = false;
      if (currentViewParam !== viewMode) {
        url.searchParams.set('view', viewMode);
        changed = true;
      }
      if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) && currentFechaParam !== fecha) {
        url.searchParams.set('fecha', fecha);
        changed = true;
      }

      if (changed) {
        const nextSearch = url.searchParams.toString();
        const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
        // Si es la primera sincronización en carga inicial, usar replaceState; si es navegación de vista, pushState
        if (!currentViewParam) {
          window.history.replaceState({ view: viewMode, fecha }, '', nextUrl);
        } else {
          window.history.pushState({ view: viewMode, fecha }, '', nextUrl);
        }
      }
    } catch (e) {}
  }, [viewMode, fecha, enabled]);

  // Escuchar botón Atrás / Adelante del navegador
  useEffect(() => {
    if (!enabled) return;
    const handlePopState = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const v = params.get('view') as ViewMode | null;
        const f = params.get('fecha');
        if (v && VALID_VIEWS.has(v)) {
          setViewMode(v);
        }
        if (f && /^\d{4}-\d{2}-\d{2}$/.test(f) && onDateChange && f !== fecha) {
          onDateChange(f);
        }
      } catch (e) {}
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enabled, fecha, onDateChange, setViewMode]);
}

