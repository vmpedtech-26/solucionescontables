/* -------------------------------------------------------------
   Equipo del estudio: roles y reglas que la interfaz aplica antes
   de llamar al servidor (las politicas de la base son la fuente real).
   ------------------------------------------------------------- */

export const ROLES = {
  titular: { nombre: 'Titular', detalle: 'Dueño de la cuenta. Todo, incluido equipo y certificado de ARCA.' },
  administrador: { nombre: 'Administrador', detalle: 'Todo, incluido equipo, certificado de ARCA y borrar empresas.' },
  contador: { nombre: 'Contador', detalle: 'Todas las empresas del estudio. No gestiona el equipo ni el certificado.' },
  asistente: { nombre: 'Asistente', detalle: 'Solo las empresas que tenga asignadas. No crea ni borra empresas.' }
};

export const ROLES_INVITABLES = ['administrador', 'contador', 'asistente'];

export const esAdmin = (rol) => rol === 'titular' || rol === 'administrador';

export const PERMISOS = {
  gestionarEquipo: esAdmin,
  certificadoArca: esAdmin,
  borrarEmpresa: esAdmin,
  crearEmpresa: (rol) => !!ROLES[rol] && rol !== 'asistente',
  verTodasLasEmpresas: (rol) => !!ROLES[rol] && rol !== 'asistente'
};

/** 16 caracteres hex (64 bits): no se puede adivinar probando codigos. */
export function nuevoCodigo() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
}

export const linkEquipo = (codigo, base = `${window.location.origin}${window.location.pathname}`) =>
  `${base}#/registro-equipo?codigo=${encodeURIComponent(codigo)}`;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida una invitacion antes de crearla. Devuelve el texto del error o null. */
export function validarInvitacion({ email, rol }, miembros = [], invitaciones = []) {
  if (!ROLES_INVITABLES.includes(rol)) return 'Elegí un rol válido.';
  const e = (email || '').trim().toLowerCase();
  if (!e) return null; // sin email: cualquiera con el link puede usarla una vez
  if (!EMAIL.test(e)) return 'El email no es válido.';
  if (miembros.some((m) => (m.email || '').toLowerCase() === e)) return 'Esa persona ya está en el equipo.';
  if (invitaciones.some((i) => (i.email || '').toLowerCase() === e)) return 'Ya hay una invitación pendiente para ese email.';
  return null;
}

/**
 * Cambio de rol o baja de un miembro. Evita que el estudio se quede sin
 * nadie que lo administre: el titular siempre lo es, pero un administrador
 * no puede quitarse a si mismo el permiso.
 */
export function puedeModificar(miRol, miId, miembro) {
  if (!esAdmin(miRol)) return false;
  if (!miembro || miembro.rol === 'titular') return false;
  if (miembro.user_id === miId) return false;
  return true;
}

export const vencida = (inv, ahora = new Date()) => !!inv.expira_en && new Date(inv.expira_en) <= ahora;
