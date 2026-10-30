/* -------------------------------------------------------------
   Honorarios: Supabase con cuenta real, localStorage en la demo.
   ------------------------------------------------------------- */
import { supabase, isSupabaseConfigured, getEstudioId, traerTodas } from './supabase.js';

const real = () => isSupabaseConfigured && supabase;
const leer = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
const escribir = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const K_ABONOS = 'vmp_hon_abonos';
const K_MOVS = 'vmp_hon_movs';

export async function listarAbonos() {
  if (!real()) return leer(K_ABONOS);
  const { data, error } = await traerTodas((d, h) => supabase.from('honorarios_abonos').select('*').order('empresa_id').range(d, h));
  if (error) throw error;
  return data;
}

export async function guardarAbono(abono) {
  if (!real()) {
    escribir(K_ABONOS, [...leer(K_ABONOS).filter((a) => a.empresa_id !== abono.empresa_id), abono]);
    return;
  }
  const estudio_id = await getEstudioId();
  const { error } = await supabase.from('honorarios_abonos')
    .upsert({ ...abono, estudio_id, updated_at: new Date().toISOString() }, { onConflict: 'empresa_id' });
  if (error) throw error;
}

export async function listarMovimientos() {
  if (!real()) return leer(K_MOVS);
  const { data, error } = await traerTodas((d, h) => supabase.from('honorarios_movimientos').select('*').order('fecha').order('id').range(d, h));
  if (error) throw error;
  return data;
}

/** Inserta movimientos. Los cargos de abono ya generados se ignoran (no duplica). */
export async function crearMovimientos(lista) {
  if (!lista.length) return [];
  if (!real()) {
    const actuales = leer(K_MOVS);
    const nuevos = lista
      .filter((m) => !(m.origen === 'abono' && actuales.some((x) => x.origen === 'abono' && x.empresa_id === m.empresa_id && x.periodo === m.periodo)))
      .map((m) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...m }));
    escribir(K_MOVS, [...actuales, ...nuevos]);
    return nuevos;
  }
  const estudio_id = await getEstudioId();
  const filas = lista.map((m) => ({ ...m, estudio_id }));
  const { data, error } = await supabase.from('honorarios_movimientos')
    .upsert(filas, { onConflict: 'empresa_id,origen,periodo', ignoreDuplicates: true }).select();
  if (error) throw error;
  return data || [];
}

export async function borrarMovimiento(id) {
  if (!real()) { escribir(K_MOVS, leer(K_MOVS).filter((m) => m.id !== id)); return; }
  const { data, error } = await supabase.from('honorarios_movimientos').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('No tenés permiso para borrar este movimiento.');
}
