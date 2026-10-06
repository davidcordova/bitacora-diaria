/**
 * Copia texto al portapapeles de manera universal y robusta.
 * Funciona tanto en contextos seguros (HTTPS / localhost) usando navigator.clipboard,
 * como en contextos no seguros (HTTP / IP VPS) usando un textarea oculto y document.execCommand('copy').
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
    console.warn('navigator.clipboard.writeText falló, usando fallback execCommand:', err);
  }

  // 2. Fallback universal usando document.execCommand('copy') con textarea temporal
  try {
    if (typeof document === 'undefined') return false;

    const textArea = document.createElement('textarea');
    textArea.value = text;

    // Evitar scroll visual y posicionar fuera de pantalla
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');

    document.body.appendChild(textArea);

    // En iOS / Safari es necesario deseleccionar y seleccionar específicamente
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, text.length);

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Error crítico al copiar al portapapeles con execCommand:', err);
    return false;
  }
}
