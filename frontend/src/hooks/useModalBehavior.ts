import { useEffect, useRef } from 'react';

let activeModalCount = 0;
let savedBodyOverflow = '';
const modalStack: Array<() => void> = [];

let globalKeyListenerAttached = false;

function handleGlobalEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && modalStack.length > 0) {
    // Solo cerrar el modal superior de la pila
    const topClose = modalStack[modalStack.length - 1];
    if (topClose) {
      e.stopPropagation();
      topClose();
    }
  }
}

/**
 * Estandariza el comportamiento UX y de accesibilidad de cualquier modal o drawer:
 * - Bloquea el scroll del fondo (`document.body.style.overflow = 'hidden'`) soportando modales anidados.
 * - Cierra únicamente el modal superior al presionar `Escape`.
 */
export function useModalBehavior(isOpen: boolean, onClose?: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

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
      window.addEventListener('keydown', handleGlobalEscape);
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
          window.removeEventListener('keydown', handleGlobalEscape);
          globalKeyListenerAttached = false;
        }
      }
    };
  }, [isOpen]);
}

