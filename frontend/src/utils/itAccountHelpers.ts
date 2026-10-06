/**
 * Utilidades para la generación corporativa de correos y contraseñas
 * según las políticas y directivas de Marketing Alterno Perú y entidades asociadas.
 */

export interface ParsedColaboradorName {
  primerNombre: string;
  segundoNombre: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  inicialNombre: string;
  fullNameClean: string;
}

export type CorporateEntity = 'marketing_alterno' | 'solopromo' | 'hp';

/**
 * Normaliza y descompone el nombre completo del colaborador
 * Limpia tildes, diéresis, caracteres especiales y números.
 */
export function parseColaboradorName(fullName: string): ParsedColaboradorName {
  if (!fullName) {
    return {
      primerNombre: '',
      segundoNombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      inicialNombre: '',
      fullNameClean: '',
    };
  }

  // Normalizar tildes y caracteres especiales
  const clean = fullName
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // á->a, é->e, etc.
    .replace(/[^a-zA-Z\s]/g, '')
    .toLowerCase();

  const tokens = clean.split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return {
      primerNombre: '',
      segundoNombre: '',
      apellidoPaterno: '',
      apellidoMaterno: '',
      inicialNombre: '',
      fullNameClean: '',
    };
  }

  const primerNombre = tokens[0];
  const inicialNombre = primerNombre.charAt(0);

  let segundoNombre = '';
  let apellidoPaterno = '';
  let apellidoMaterno = '';

  if (tokens.length === 1) {
    apellidoPaterno = '';
  } else if (tokens.length === 2) {
    // "Luis Cordova" -> Nombre: Luis, Apellido: Cordova
    apellidoPaterno = tokens[1];
  } else if (tokens.length === 3) {
    // "Carlos Mendoza Vargas" -> Nombre: Carlos, Ap. Paterno: Mendoza, Ap. Materno: Vargas
    apellidoPaterno = tokens[1];
    apellidoMaterno = tokens[2];
  } else {
    // 4 o más tokens: "Luis David Cordova Lopez"
    // Dos nombres + dos apellidos (estándar en Perú)
    segundoNombre = tokens[1];
    apellidoPaterno = tokens[2];
    apellidoMaterno = tokens.slice(3).join('');
  }

  return {
    primerNombre,
    segundoNombre,
    apellidoPaterno,
    apellidoMaterno,
    inicialNombre,
    fullNameClean: clean,
  };
}

/**
 * Detecta la entidad corporativa según la empresa o marca seleccionada
 */
export function detectCorporateEntity(empresaNombre?: string, marcaNombre?: string): CorporateEntity {
  const combined = `${empresaNombre || ''} ${marcaNombre || ''}`.toLowerCase();
  if (combined.includes('soporte promocional') || combined.includes('solopromo')) {
    return 'solopromo';
  }
  if (combined.includes('hp') || combined.includes('hewlett')) {
    return 'hp';
  }
  return 'marketing_alterno';
}

/**
 * 1. Formatos de Correo Electrónico Corporativo
 * El correo se construye según la entidad destino, utilizando siempre minúsculas:
 *
 * - Marketing Alterno:
 *   Estructura: [Inicial Nombre][Apellido Paterno]@marketing-alterno.com
 *   Ejemplo: lcordova@marketing-alterno.com
 *
 * - Soporte Promocional:
 *   Estructura: [Primer Nombre].[Apellido Paterno]@solopromo.net
 *   Ejemplo: luis.cordova@solopromo.net
 *
 * - HP:
 *   Estructura: [Inicial Nombre][Apellido Paterno].hp@marketing-alterno.com
 *   Ejemplo: lcordova.hp@marketing-alterno.com
 */
export function generateCorporateEmail(fullName: string, entity: CorporateEntity): string {
  const parsed = parseColaboradorName(fullName);
  if (!parsed.primerNombre) return '';

  const ini = parsed.inicialNombre;
  const nom = parsed.primerNombre;
  // Si no se proporcionó apellido aún, usar el nombre como fallback temporal
  const ape = parsed.apellidoPaterno || nom;

  switch (entity) {
    case 'solopromo':
      return `${nom}.${ape}@solopromo.net`;
    case 'hp':
      return `${ini}${ape}.hp@marketing-alterno.com`;
    case 'marketing_alterno':
    default:
      return `${ini}${ape}@marketing-alterno.com`;
  }
}

/**
 * 2. Criterios para la Generación de Contraseñas Corporativas (para Correo/Zimbra)
 * Longitud: 8 a 12 caracteres.
 * Estructura:
 * - Inicio: Primera letra del primer nombre en Mayúscula. (ej. 'L')
 * - Cuerpo: Nombre del colaborador donde las vocales se reemplazan por números visualmente similares:
 *     a / A -> 4
 *     e / E -> 3
 *     i / I -> 1
 *     o / O -> 0
 *     u / U -> v o 8 (o se conserva 'u' si el nombre ya tiene leet como en "Lu1s")
 * - Cierre: Combinación aleatoria de números y al menos un carácter especial (@, #, $, !)
 *   para completar de 8 a 12 caracteres finales.
 * Ejemplo oficial: "Lu1s2026@"
 */
export function generateCorporatePassword(fullName: string, customYear?: number): string {
  const parsed = parseColaboradorName(fullName);
  const rawName = parsed.primerNombre || 'User';

  const firstLetter = rawName.charAt(0).toUpperCase();
  const restOfName = rawName.slice(1).toLowerCase();

  // Reemplazo visual leet de vocales
  let leetRest = '';
  for (let i = 0; i < restOfName.length; i++) {
    const ch = restOfName[i];
    if (ch === 'a') leetRest += '4';
    else if (ch === 'e') leetRest += '3';
    else if (ch === 'i') leetRest += '1';
    else if (ch === 'o') leetRest += '0';
    else if (ch === 'u') {
      // Si la palabra ya tiene reemplazos vocálicos (como 'i' en 'luis'), conservar 'u' (Lu1s)
      // Si no tiene otras vocales (ej: "Ruth"), usar '8' (R8th)
      const hasOtherVowels = /[aeio]/.test(restOfName);
      leetRest += hasOtherVowels ? 'u' : '8';
    } else {
      leetRest += ch;
    }
  }

  const base = firstLetter + leetRest;

  // Caracteres especiales permitidos según directiva: @, #, $, !
  const specials = ['@', '#', '$', '!'];
  const special = specials[Math.floor(Math.random() * specials.length)];

  const currentYear = customYear || new Date().getFullYear(); // ej. 2026

  // Asegurar que la longitud total esté estrictamente entre 8 y 12 caracteres
  // Base + Digits + Special
  let digits = '';
  if (base.length <= 5) {
    // Lu1s (4 chars) + 2026 (4 chars) + @ (1 char) = 9 chars
    digits = Math.random() > 0.35 ? String(currentYear) : String(Math.floor(1000 + Math.random() * 9000));
  } else if (base.length === 6) {
    // C4rl0s (6 chars) + 2026 (4 chars) + @ (1 char) = 11 chars
    digits = Math.random() > 0.4 ? String(currentYear) : String(Math.floor(1000 + Math.random() * 9000));
  } else if (base.length === 7) {
    // 7 + 2 + 1 = 10 chars
    digits = String(currentYear).slice(-2);
  } else {
    // Base >= 8 chars: 2 dígitos
    digits = String(currentYear).slice(-2);
  }

  let finalPassword = `${base}${digits}${special}`;

  // Garantía estricta de límites 8 <= length <= 12
  if (finalPassword.length < 8) {
    const pad = String(Math.floor(1000 + Math.random() * 9000));
    finalPassword = `${base}${pad}${special}`.slice(0, 12);
  } else if (finalPassword.length > 12) {
    const allowedBase = 12 - digits.length - 1;
    finalPassword = `${base.slice(0, Math.max(3, allowedBase))}${digits}${special}`;
  }

  return finalPassword;
}

/**
 * Generador de contraseñas de alta seguridad para plataformas generales (Active Directory, Odoo, NAS, etc.)
 */
export function generateStrongPlatformPassword(length = 14): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += chars[array[i] % chars.length];
  }
  return pass;
}

/**
 * Determina si una plataforma corresponde al servicio de correo electrónico (Zimbra, Mail, etc.)
 */
export function isMailPlatform(plataformaName: string): boolean {
  return /zimbra|correo|mail|email/i.test(plataformaName || '');
}
