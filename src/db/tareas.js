/* -------------------------------------------------------------
   Tareas del estudio: Supabase con cuenta real, localStorage en la demo.
   ------------------------------------------------------------- */
import { supabase, isSupabaseConfigured, getEstudioId, traerTodas } from './supabase.js';
import { siguienteFecha } from '../domain/vencimientos.js';

const CLAVE_LOCAL = 'vmp_tareas';
const real = () => isSupabaseConfigured && supabase;
export const faltaTabla = (e) => !!e && ['42P01', 'PGRST205', 'PGRST200'].includes(e.code);

const leerLocal = () => { try { return JSON.parse(localStorage.getItem(CLAVE_LOCAL)) || []; } catch (e) { return []; } };
const guardarLocal = (lista) => localStorage.setItem(CLAVE_LOCAL, JSON.stringify(lista));

/** Tareas con vencimiento entre dos fechas (inclusive) y las pendientes atrasadas. */
export async function listarTareas(desde, hasta) {
  if (!real()) {
    return leerLocal().filter((t) => (t.vence >= desde && t.vence <= hasta) || (t.estado !== 'hecha' && t.vence < desde));
  }
  const { data, error } = await traerTodas((d, h) => supabase.from('tareas').select('*')
    .or(`and(vence.gte.${desde},vence.lte.${hasta}),and(estado.neq.hecha,vence.lt.${desde})`)
    .order('vence').order('id').range(d, h));
  if (error) throw error;
  return data;
}

export async function crearTarea(t) {
  if (!real()) {
    const nueva = { id: crypto.randomUUID(), estado: 'pendiente', created_at: new Date().toISOString(), ...t };
    guardarLocal([...leerLocal(), nueva]);
    return nueva;
  }
  const estudio_id = await getEstudioId();
  const { data, error } = await supabase.from('tareas').insert({ ...t, estudio_id }).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarTarea(id, campos) {
  if (!real()) {
    guardarLocal(leerLocal().map((t) => (t.id === id ? { ...t, ...campos } : t)));
    return;
  }
  const { data, error } = await supabase.from('tareas').update(campos).eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('No tenés permiso para cambiar esta tarea.');
}

export async function borrarTarea(id) {
  if (!real()) { guardarLocal(leerLocal().filter((t) => t.id !== id)); return; }
  const { data, error } = await supabase.from('tareas').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('No tenés permiso para borrar esta tarea.');
}

/**
 * Cambia el estado de una tarea. Al completar una recurrente, crea la
 * siguiente (sin origen: el vencimiento calculado del mes que viene ya
 * aparece solo en la agenda).
 */
export async function cambiarEstado(tarea, estado) {
  const campos = { estado, completada_en: estado === 'hecha' ? new Date().toISOString() : null };
  await actualizarTarea(tarea.id, campos);
  if (estado === 'hecha' && tarea.estado !== 'hecha' && tarea.recurrencia) {
    const vence = siguienteFecha(tarea.vence, tarea.recurrencia);
    return crearTarea({ titulo: tarea.titulo, detalle: tarea.detalle || null, empresa_id: tarea.empresa_id || null,
      asignado_a: tarea.asignado_a || null, recurrencia: tarea.recurrencia, vence });
  }
  return null;
}

/** Tarea que sigue a un vencimiento calculado: la existente o una nueva. */
export async function tareaDeVencimiento(venc, existentes, campos) {
  const previa = existentes.find((t) => t.empresa_id === venc.empresa_id && t.origen === venc.origen);
  if (previa) { await actualizarTarea(previa.id, campos); return { ...previa, ...campos }; }
  return crearTarea({ titulo: `${venc.nombre} · ${venc.periodo}`, empresa_id: venc.empresa_id, vence: venc.fecha, origen: venc.origen, ...campos });
}

/** Personas a las que se puede asignar trabajo: titular y miembros activos. */
export async function responsables() {
  if (!real()) return [];
  const estudioId = await getEstudioId();
  const [{ data: estudio }, { data: miembros, error }] = await Promise.all([
    supabase.from('estudios').select('id, email, razon_social').eq('id', estudioId).maybeSingle(),
    supabase.from('estudio_miembros').select('user_id, email, nombre, rol, activo').eq('estudio_id', estudioId)
  ]);
  const lista = estudio ? [{ id: estudio.id, nombre: estudio.email || 'Titular', rol: 'titular' }] : [];
  if (!error) (miembros || []).filter((m) => m.activo).forEach((m) => lista.push({ id: m.user_id, nombre: m.nombre || m.email, rol: m.rol }));
  return lista;
}
