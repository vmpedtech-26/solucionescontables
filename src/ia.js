/* -------------------------------------------------------------
   Cliente de la Edge Function "leer-comprobante": la IA lee la foto o el
   PDF que el cliente subio y devuelve los datos fiscales para revisar.
   ------------------------------------------------------------- */
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_KEY } from './db/supabase.js';

export const iaDisponible = () => isSupabaseConfigured && !!supabase;

/** path: ruta del archivo en el bucket "comprobantes" (<empresa_id>/<archivo>). */
export async function leerComprobante(path) {
  if (!iaDisponible()) throw new Error('La lectura con IA requiere una cuenta real (no está disponible en la demo).');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Tu sesión venció. Volvé a ingresar.');
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/leer-comprobante`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
  } catch (e) {
    throw new Error('No se pudo contactar al servidor. Revisá tu conexión.');
  }
  if (r.status === 404) throw new Error('La lectura con IA todavía no está instalada en el servidor.');
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.error) throw new Error(json.error || `Error ${r.status} al leer el comprobante.`);
  return json.data;
}
