/* -------------------------------------------------------------
   Cliente de la Edge Function "arca". El navegador nunca habla directo con
   ARCA: la funcion firma con el certificado del estudio (clave en Vault).
   ------------------------------------------------------------- */
import { supabase, isSupabaseConfigured, SUPABASE_URL, SUPABASE_KEY } from './db/supabase.js';

export const arcaDisponible = () => isSupabaseConfigured && !!supabase;

export async function arca(accion, datos = {}) {
  if (!arcaDisponible()) throw new Error('La conexión con ARCA requiere una cuenta real (no está disponible en la demo).');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Tu sesión venció. Volvé a ingresar.');
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/functions/v1/arca`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, ...datos })
    });
  } catch (e) {
    throw new Error('No se pudo contactar al servidor. Revisá tu conexión.');
  }
  const json = await r.json().catch(() => ({}));
  if (!r.ok || json.error) throw new Error(json.error || `Error ${r.status} al operar con ARCA.`);
  return json.data;
}

export const AMBIENTE_LABEL = { homologacion: 'Homologación (pruebas, sin validez fiscal)', produccion: 'Producción' };
