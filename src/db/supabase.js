/* -------------------------------------------------------------
   VMP Studio Contable - Supabase Integration Client
   ------------------------------------------------------------- */

// Load credentials dynamically from localStorage or Vite environment variables
// Si el despliegue trae su propio backend, localStorage no puede reemplazarlo:
// de lo contrario un script inyectado podria redirigir los inicios de sesion.
const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseUrl = envUrl || localStorage.getItem('vmp_supabase_url') || '';
const supabaseKey = envUrl ? envKey : (localStorage.getItem('vmp_supabase_anon_key') || '');

export const isSupabaseConfigured = supabaseUrl !== '' && supabaseKey !== '';
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_KEY = supabaseKey;

export const supabase = isSupabaseConfigured && window.supabase
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;

if (isSupabaseConfigured) {
  console.log("Supabase client initialized successfully!");
} else {
  console.log("Supabase credentials not configured. Falling back to local sandbox (localStorage).");
}

// -------------------------------------------------------------
// Caché de sesión — evita pegarle a auth.getSession() en cada cambio de
// hash (el router consulta esto en cada navegación a #/studio/*). Se
// mantiene al día vía onAuthStateChange en vez de re-consultar siempre.
// -------------------------------------------------------------
let cachedSession = null;
let sessionReady = false;

export async function getCachedSession() {
  if (!isSupabaseConfigured || !supabase) return null;
  if (!sessionReady) {
    const { data } = await supabase.auth.getSession();
    cachedSession = data.session;
    sessionReady = true;
  }
  return cachedSession;
}

// -------------------------------------------------------------
// Caché de rol — 'estudio' (existe fila en estudios), 'cliente' (existe
// fila en clientes_finales) o null (sesión real sin vínculo). Igual que
// cachedSession, evita una consulta extra en cada navegación de #/studio/*.
// -------------------------------------------------------------
let cachedRole = null;
let cachedStudioName = '';
let cachedEstudioId = null;
let cachedRolEquipo = null; // 'titular' | 'administrador' | 'contador' | 'asistente'
let roleReady = false;

// Tabla inexistente (migracion del equipo todavia no aplicada): no es un error de red
const faltaTabla = (e) => e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST200');

export async function getCachedRole() {
  if (!isSupabaseConfigured || !supabase) return null;
  if (roleReady) return cachedRole;

  const session = await getCachedSession();
  if (!session) return null;

  // Un error de red no es "sin rol": se informa aparte y no se cachea,
  // para no cerrar la sesion por un corte momentaneo.
  const { data: estudio, error: e1 } = await supabase.from('estudios').select('id,razon_social').eq('id', session.user.id).maybeSingle();
  if (e1) return 'sin_conexion';
  if (estudio) {
    cachedRole = 'estudio';
    cachedStudioName = estudio.razon_social || '';
    cachedEstudioId = estudio.id;
    cachedRolEquipo = 'titular';
  } else {
    // Miembro del equipo de un estudio: trabaja como "estudio" con su rol
    const { data: miembro, error: e3 } = await supabase.from('estudio_miembros')
      .select('estudio_id, rol, estudios(razon_social)').eq('user_id', session.user.id).eq('activo', true).maybeSingle();
    if (e3 && !faltaTabla(e3)) return 'sin_conexion';
    if (miembro) {
      cachedRole = 'estudio';
      cachedEstudioId = miembro.estudio_id;
      cachedRolEquipo = miembro.rol;
      cachedStudioName = miembro.estudios?.razon_social || '';
    } else {
      const { data: cliente, error: e2 } = await supabase.from('clientes_finales').select('id').eq('id', session.user.id).maybeSingle();
      if (e2) return 'sin_conexion';
      cachedRole = cliente ? 'cliente' : null;
    }
  }
  roleReady = true;
  return cachedRole;
}

export function getCachedStudioName() {
  return cachedStudioName;
}

/** Id del estudio con el que trabaja el usuario (titular o miembro del equipo). */
export async function getEstudioId() {
  await getCachedRole();
  return cachedEstudioId;
}

/** Rol dentro del estudio: titular, administrador, contador o asistente. */
export async function getRolEquipo() {
  await getCachedRole();
  return cachedRolEquipo;
}

/** Version sincronica para el layout (ya resuelta por el router). */
export function getCachedRolEquipo() {
  return cachedRolEquipo;
}

/** Titular o administrador: gestiona equipo, certificado y borrado de empresas. */
export async function esAdminEstudio() {
  return ['titular', 'administrador'].includes(await getRolEquipo());
}

if (isSupabaseConfigured && supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedSession = session;
    sessionReady = true;
    cachedRole = null;
    cachedStudioName = '';
    cachedEstudioId = null;
    cachedRolEquipo = null;
    roleReady = false;
  });
}
