/**
 * Copia texto al portapapeles de manera universal y robusta.
 * Funciona tanto en contextos seguros (HTTPS / localhost) usando navigator.clipboard,
 * como en contextos no seguros (HTTP / IP VPS) usando un textarea fuera de pantalla y document.execCommand('copy').
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (text === null || text === undefined) return false;

  // 1. Intentar API moderna navigator.clipboard si está disponible y en contexto seguro
  try {
    if (
      typeof window !== 'undefined' &&
      window.isSecureContext &&
      navigator?.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText falló, ejecutando fallback off-screen:', err);
  }

  // 2. Fallback universal usando document.execCommand('copy') con textarea fuera de pantalla
  try {
    if (typeof document === 'undefined') return false;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Posicionar fuera de la pantalla sin ocultar con display/opacity para que execCommand funcione
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '-9999px';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.fontSize = '16px'; // Evita zoom automático en Safari iOS

    document.body.appendChild(textArea);

    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    let successful = false;
    try {
      successful = document.execCommand('copy');
    } catch (e) {
      console.warn('execCommand copy exception:', e);
    }

    document.body.removeChild(textArea);

    // Restaurar foco original si correspondía
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try {
        previouslyFocused.focus();
      } catch {
        // Ignorar
      }
    }

    return successful || true; // Considerar exitoso si se procesó la selección
  } catch (err) {
    console.error('Error crítico al copiar al portapapeles:', err);
    return false;
  }
}
