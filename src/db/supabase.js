/* -------------------------------------------------------------
   VMP Studio Contable - Supabase Integration Client
   ------------------------------------------------------------- */

// Load credentials dynamically from localStorage or Vite environment variables
const supabaseUrl = localStorage.getItem('vmp_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = localStorage.getItem('vmp_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = supabaseUrl !== '' && supabaseKey !== '';

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
let roleReady = false;

export async function getCachedRole() {
  if (!isSupabaseConfigured || !supabase) return null;
  if (roleReady) return cachedRole;

  const session = await getCachedSession();
  if (!session) return null;

  const { data: estudio } = await supabase.from('estudios').select('id,razon_social').eq('id', session.user.id).maybeSingle();
  if (estudio) {
    cachedRole = 'estudio';
    cachedStudioName = estudio.razon_social || '';
  } else {
    const { data: cliente } = await supabase.from('clientes_finales').select('id').eq('id', session.user.id).maybeSingle();
    cachedRole = cliente ? 'cliente' : null;
  }
  roleReady = true;
  return cachedRole;
}

export function getCachedStudioName() {
  return cachedStudioName;
}

if (isSupabaseConfigured && supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedSession = session;
    sessionReady = true;
    cachedRole = null;
    cachedStudioName = '';
    roleReady = false;
  });
}
