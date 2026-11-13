export const TIPO_SERVICIOS_PRESET = [
  'Todos',
  'Correo Corporativo',
  'ERP / Finanzas',
  'Storage / Servidor',
  'Cloud / Tenant',
  'Comunicaciones',
  'Base de Datos',
  'Seguridad & Redes',
  'General',
];

export const CATEGORIAS_QUICKLINKS = [
  'Todas',
  'General',
  'Herramientas',
  'Comunicaciones',
  'Sistemas',
  'Marketing',
  'Diseño',
  'Operaciones',
];

export const generateVaultPassword = (
  length = 14,
  includeSpecial = true,
  includeNumbers = true
): string => {
  let pool = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (includeNumbers) pool += '0123456789';
  if (includeSpecial) pool += '!@#$%&*';

  const array = new Uint32Array(length);
  window.crypto.getRandomValues(array);
  let pass = '';
  for (let i = 0; i < length; i++) {
    pass += pool[array[i] % pool.length];
  }
  return pass;
};
