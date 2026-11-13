import { useEffect, useRef } from 'react';

let activeModalCount = 0;
let savedBodyOverflow = '';
const modalStack: Array<() => void> = [];

let globalKeyListenerAttached = false;

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getTopmostDialog(): HTMLElement | null {
  const dialogs = Array.from(
    document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]')
  ).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
  });
  return dialogs.length > 0 ? dialogs[dialogs.length - 1] : null;
}

function handleGlobalKeyDown(e: KeyboardEvent) {
  if (modalStack.length === 0) return;

  if (e.key === 'Escape') {
    // Solo cerrar el modal superior de la pila
    const topClose = modalStack[modalStack.length - 1];
    if (topClose) {
      e.stopPropagation();
      topClose();
    }
    return;
  }

  if (e.key === 'Tab') {
    const dialog = getTopmostDialog();
    if (!dialog) return;

    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && !el.hasAttribute('disabled');
      }
    );

    if (focusables.length === 0) {
      e.preventDefault();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (!active || !dialog.contains(active)) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus({ preventScroll: true });
      return;
    }

    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  }
}

/**
 * Estandariza el comportamiento UX y de accesibilidad de cualquier modal o drawer:
 * - Bloquea el scroll del fondo (`document.body.style.overflow = 'hidden'`) soportando modales anidados.
 * - Cierra únicamente el modal superior al presionar `Escape`.
 * - Atrapa el foco de teclado (`Tab` / `Shift+Tab`) dentro del diálogo activo superior (`role="dialog"`).
 * - Restaura el foco al elemento disparador al cerrarse.
 */
export function useModalBehavior(isOpen: boolean, onClose?: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused =
      typeof document !== 'undefined' && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    if (activeModalCount === 0) {
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    activeModalCount += 1;

    const handler = () => {
      onCloseRef.current?.();
    };
    modalStack.push(handler);

    if (!globalKeyListenerAttached) {
      window.addEventListener('keydown', handleGlobalKeyDown);
      globalKeyListenerAttached = true;
    }

    return () => {
      const idx = modalStack.lastIndexOf(handler);
      if (idx !== -1) {
        modalStack.splice(idx, 1);
      }
      activeModalCount = Math.max(0, activeModalCount - 1);
      if (activeModalCount === 0) {
        document.body.style.overflow = savedBodyOverflow;
        if (globalKeyListenerAttached) {
          window.removeEventListener('keydown', handleGlobalKeyDown);
          globalKeyListenerAttached = false;
        }
      }

      if (previouslyFocused && document.contains(previouslyFocused)) {
        try {
          previouslyFocused.focus({ preventScroll: true });
        } catch {
          /* ignore focus errors on detached/disabled nodes */
        }
      }
    };
  }, [isOpen]);
}
