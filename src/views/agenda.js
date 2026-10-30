/* -------------------------------------------------------------
   Agenda del estudio: vencimientos de ARCA de todas las empresas
   (por terminacion de CUIT) y tareas del equipo con responsable,
   estado y recurrencia. Exporta a Google Calendar / Outlook (.ics).
   ------------------------------------------------------------- */
import { getCompaniesAsync, updateEmpresaFieldsAsync } from '../db/mockdb.js';
import { supabase, isSupabaseConfigured } from '../db/supabase.js';
import { listarTareas, crearTarea, actualizarTarea, borrarTarea, cambiarEstado, tareaDeVencimiento, responsables, faltaTabla } from '../db/tareas.js';
import { OBLIGACIONES, obligacionesDe, vencimientosDelMes, generarICS, iso } from '../domain/vencimientos.js';
import { sanitizeInput as esc } from '../utils.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ESTADOS = { pendiente: 'Pendiente', en_curso: 'En curso', hecha: 'Hecha' };
const RECURRENCIAS = { '': 'No se repite', mensual: 'Todos los meses', bimestral: 'Cada 2 meses', trimestral: 'Cada 3 meses', semestral: 'Cada 6 meses', anual: 'Todos los años' };
const pad = (n) => String(n).padStart(2, '0');
const diaCorto = (f) => { const [y, m, d] = f.split('-').map(Number); return new Date(y, m - 1, d, 12).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }); };

let mesVista = null; // { y, m } que se conserva al volver a la pantalla

/**
 * Une vencimientos calculados con las tareas guardadas: un vencimiento
 * marcado tiene su tarea (estado, responsable y fecha corregida).
 */
export function itemsAgenda(vencimientos, tareas, hoy = iso(new Date())) {
  const usadas = new Set();
  const items = vencimientos.map((v) => {
    const t = tareas.find((x) => x.empresa_id === v.empresa_id && x.origen === v.origen);
    if (t) usadas.add(t.id);
    return { clave: `v:${v.empresa_id}:${v.origen}`, tipo: 'vencimiento', titulo: v.nombre, sub: v.periodo, detalle: v.detalle,
      empresa_id: v.empresa_id, empresa: v.empresa, fecha: t?.vence || v.fecha, fechaCalculada: v.fecha,
      estado: t?.estado || 'pendiente', asignado_a: t?.asignado_a || null, tarea: t || null, venc: v };
  });
  for (const t of tareas) {
    if (usadas.has(t.id)) continue;
    items.push({ clave: `t:${t.id}`, tipo: 'tarea', titulo: t.titulo, sub: RECURRENCIAS[t.recurrencia || ''] && t.recurrencia ? RECURRENCIAS[t.recurrencia] : '',
      detalle: t.detalle || '', empresa_id: t.empresa_id || null, empresa: null, fecha: t.vence, estado: t.estado,
      asignado_a: t.asignado_a || null, tarea: t, venc: null });
  }
  for (const i of items) i.atrasada = i.estado !== 'hecha' && i.fecha < hoy;
  return items.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.empresa || '').localeCompare(b.empresa || ''));
}

export function filtrarItems(items, f, miId) {
  return items.filter((i) => (!f.empresa || i.empresa_id === f.empresa)
    && (!f.responsable || (f.responsable === 'mias' ? i.asignado_a === miId : f.responsable === 'sin' ? !i.asignado_a : i.asignado_a === f.responsable))
    && (!f.estado || (f.estado === 'abiertas' ? i.estado !== 'hecha' : i.estado === f.estado))
    && (!f.tipo || i.tipo === f.tipo));
}

export async function renderAgenda() {
  const hoy = new Date();
  if (!mesVista) mesVista = { y: hoy.getFullYear(), m: hoy.getMonth() + 1 };
  return `
  <div class="view-header" style="flex-wrap:wrap;gap:12px;">
    <div>
      <h1 class="view-title">Agenda del estudio</h1>
      <p class="view-subtitle">Vencimientos de ARCA de cada cliente según su CUIT y las tareas del equipo.</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-outline btn-sm" id="ag-obligaciones"><i data-lucide="list-checks"></i> Obligaciones por cliente</button>
      <button class="btn btn-outline btn-sm" id="ag-ics"><i data-lucide="calendar-plus"></i> Llevar a mi calendario</button>
      <button class="btn btn-primary btn-sm" id="ag-nueva"><i data-lucide="plus"></i> Nueva tarea</button>
    </div>
  </div>

  <div id="ag-aviso"></div>

  <div class="card" style="margin-bottom:16px;">
    <div class="card-body" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:8px;">
        <button class="btn-icon-sm" id="ag-prev" aria-label="Mes anterior"><i data-lucide="chevron-left"></i></button>
        <strong id="ag-mes" style="min-width:150px;text-align:center;font-size:15px;text-transform:capitalize;"></strong>
        <button class="btn-icon-sm" id="ag-next" aria-label="Mes siguiente"><i data-lucide="chevron-right"></i></button>
        <button class="btn btn-outline btn-xs" id="ag-hoy">Hoy</button>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <select class="form-select" id="ag-f-empresa" aria-label="Cliente" style="width:auto;font-size:12.5px;"><option value="">Todos los clientes</option></select>
        <select class="form-select" id="ag-f-responsable" aria-label="Responsable" style="width:auto;font-size:12.5px;">
          <option value="">Todo el equipo</option><option value="mias">Asignadas a mí</option><option value="sin">Sin responsable</option>
        </select>
        <select class="form-select" id="ag-f-estado" aria-label="Estado" style="width:auto;font-size:12.5px;">
          <option value="abiertas">Sin terminar</option><option value="">Todas</option><option value="hecha">Hechas</option>
        </select>
        <select class="form-select" id="ag-f-tipo" aria-label="Tipo" style="width:auto;font-size:12.5px;">
          <option value="">Vencimientos y tareas</option><option value="vencimiento">Solo vencimientos</option><option value="tarea">Solo tareas</option>
        </select>
      </div>
    </div>
  </div>

  <div id="ag-resumen" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;"></div>

  <div class="card">
    <div class="card-body" id="ag-lista" style="padding-top:4px;font-size:13px;color:var(--text-secondary);">Cargando…</div>
  </div>
  <p style="font-size:11.5px;color:var(--text-secondary);margin:12px 2px 0;line-height:1.5;">
    Fechas calculadas con el cronograma de ARCA (día base y terminación de CUIT, corridas por fines de semana y feriados).
    ARCA puede prorrogar un vencimiento: si cambia, corregí la fecha desde el ítem. Ingresos Brutos, tasas municipales y otras
    obligaciones provinciales se cargan como tareas que se repiten.
  </p>`;
}

export async function initAgenda(mainApp) {
  const root = document.getElementById('view-root');
  const $ = (s) => root.querySelector(s);
  const filtros = { empresa: '', responsable: '', estado: 'abiertas', tipo: '' };
  let empresas = [];
  let personas = [];
  let items = [];
  let tareas = [];
  let miId = null;
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getUser();
    miId = data?.user?.id || null;
  }

  const nombrePersona = (id) => personas.find((p) => p.id === id)?.nombre || '';
  const nombreEmpresa = (id) => empresas.find((e) => e.id === id)?.razon_social || '';

  const cargar = async () => {
    const { y, m } = mesVista;
    $('#ag-mes').textContent = `${MESES[m - 1]} ${y}`;
    const desde = `${y}-${pad(m)}-01`;
    const hasta = iso(new Date(y, m, 0, 12));
    const prev = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
    [empresas, personas] = await Promise.all([getCompaniesAsync(), responsables()]);
    try {
      tareas = await listarTareas(`${prev.y}-${pad(prev.m)}-01`, hasta);
      $('#ag-aviso').innerHTML = '';
    } catch (e) {
      tareas = [];
      $('#ag-aviso').innerHTML = `<div class="card" style="border-left:4px solid #f59e0b;margin-bottom:16px;"><div class="card-body" style="font-size:13px;">
        ${faltaTabla(e) ? 'La base de datos todavía no tiene la tabla de tareas: hay que aplicar la migración <code>2026-11-02-agenda-tareas.sql</code>. Los vencimientos se ven igual, pero no se pueden marcar.' : `No se pudieron leer las tareas: ${esc(e.message)}`}
      </div></div>`;
    }
    // Vencimientos del mes y los del mes anterior que quedaron sin terminar
    // Del mes anterior solo queda lo que no se termino (aparece como atrasado)
    const anteriores = vencimientosDelMes(empresas, prev.y, prev.m);
    const delMes = vencimientosDelMes(empresas, y, m);
    items = itemsAgenda([...anteriores, ...delMes], tareas)
      .filter((i) => (i.venc ? delMes.includes(i.venc) : i.fecha >= desde) || i.estado !== 'hecha');
    for (const i of items) if (!i.empresa && i.empresa_id) i.empresa = nombreEmpresa(i.empresa_id);

    const selEmp = $('#ag-f-empresa');
    selEmp.innerHTML = '<option value="">Todos los clientes</option>' + empresas.map((e) => `<option value="${esc(e.id)}">${esc(e.razon_social)}</option>`).join('');
    selEmp.value = filtros.empresa;
    const selResp = $('#ag-f-responsable');
    selResp.innerHTML = `<option value="">Todo el equipo</option>${miId ? '<option value="mias">Asignadas a mí</option>' : ''}<option value="sin">Sin responsable</option>`
      + personas.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join('');
    selResp.value = filtros.responsable;
    pintar();
  };

  const pintar = () => {
    const hoy = iso(new Date());
    const en7 = iso(new Date(Date.now() + 7 * 864e5));
    const abiertos = items.filter((i) => i.estado !== 'hecha');
    const tarjeta = (num, txt, color) => `<div class="card"><div class="card-body" style="padding:14px 16px;">
      <div style="font-size:22px;font-weight:800;color:${color};">${num}</div><div style="font-size:12px;color:var(--text-secondary);">${txt}</div></div></div>`;
    $('#ag-resumen').innerHTML = tarjeta(abiertos.filter((i) => i.atrasada).length, 'Atrasados', '#dc2626')
      + tarjeta(abiertos.filter((i) => i.fecha >= hoy && i.fecha <= en7).length, 'Vencen en 7 días', '#d97706')
      + tarjeta(abiertos.length, 'Sin terminar', 'var(--text-primary)')
      + tarjeta(items.filter((i) => i.estado === 'hecha').length, 'Hechos', '#16a34a');

    const visibles = filtrarItems(items, filtros, miId);
    if (!visibles.length) {
      $('#ag-lista').innerHTML = `<p style="padding:24px 0;text-align:center;">${empresas.length ? 'No hay nada con estos filtros.' : 'Cargá tus clientes para ver sus vencimientos.'}</p>`;
      return;
    }
    let ultimaFecha = '';
    $('#ag-lista').innerHTML = visibles.map((i) => {
      const cab = i.fecha !== ultimaFecha ? `<div style="padding:14px 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:${i.atrasada ? '#dc2626' : 'var(--text-secondary)'};">${diaCorto(i.fecha)}${i.fecha === hoy ? ' · hoy' : ''}</div>` : '';
      ultimaFecha = i.fecha;
      const corregida = i.tipo === 'vencimiento' && i.fecha !== i.fechaCalculada;
      return `${cab}
      <div class="ag-item" data-clave="${esc(i.clave)}" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:10px 12px;border:1px solid var(--border-color);border-left:4px solid ${i.estado === 'hecha' ? '#16a34a' : i.atrasada ? '#dc2626' : i.tipo === 'vencimiento' ? 'var(--color-accent)' : '#64748b'};border-radius:8px;margin-bottom:6px;background:#fff;">
        <div style="flex:1 1 240px;min-width:0;">
          <div style="font-weight:700;color:var(--text-primary);${i.estado === 'hecha' ? 'text-decoration:line-through;opacity:.6;' : ''}">${esc(i.titulo)}${i.sub ? ` <span style="font-weight:500;color:var(--text-secondary);">· ${esc(i.sub)}</span>` : ''}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${i.empresa ? esc(i.empresa) : 'General del estudio'}${i.atrasada ? ' · <strong style="color:#dc2626;">atrasado</strong>' : ''}${corregida ? ` · fecha corregida (ARCA: ${diaCorto(i.fechaCalculada)})` : ''}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
          ${personas.length ? `<select class="form-select ag-resp" aria-label="Responsable" style="width:auto;font-size:12px;padding:4px 8px;">
            <option value="">Sin responsable</option>${personas.map((p) => `<option value="${esc(p.id)}" ${p.id === i.asignado_a ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}
          </select>` : ''}
          <select class="form-select ag-estado" aria-label="Estado" style="width:auto;font-size:12px;padding:4px 8px;">
            ${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${k === i.estado ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <button class="btn btn-outline btn-xs ag-fecha" title="Cambiar fecha">Fecha</button>
          ${i.tipo === 'tarea' ? '<button class="btn btn-outline btn-xs ag-borrar" title="Borrar tarea" style="color:#ef4444;border-color:rgba(239,68,68,0.3);">Borrar</button>' : ''}
        </div>
      </div>`;
    }).join('');
    enlazarItems();
  };

  // Un vencimiento sin tarea se materializa la primera vez que se toca
  const guardar = async (item, campos, ok) => {
    try {
      if (item.tipo === 'vencimiento') await tareaDeVencimiento(item.venc, tareas, campos);
      else await actualizarTarea(item.tarea.id, campos);
      if (ok) mainApp.showToast(ok, 'success');
    } catch (e) { mainApp.showToast(faltaTabla(e) ? 'Falta aplicar la migración de tareas.' : e.message, 'error'); }
    await cargar();
  };

  const enlazarItems = () => {
    const porClave = Object.fromEntries(items.map((i) => [i.clave, i]));
    root.querySelectorAll('.ag-item').forEach((el) => {
      const item = porClave[el.dataset.clave];
      el.querySelector('.ag-resp')?.addEventListener('change', (e) => guardar(item, { asignado_a: e.target.value || null },
        e.target.value ? `Asignado a ${nombrePersona(e.target.value)}.` : 'Sin responsable.'));
      el.querySelector('.ag-estado').addEventListener('change', async (e) => {
        const estado = e.target.value;
        if (item.tipo === 'tarea') {
          try {
            const siguiente = await cambiarEstado(item.tarea, estado);
            mainApp.showToast(siguiente ? `Hecha. La próxima queda para el ${diaCorto(siguiente.vence)}.` : `Marcada como ${ESTADOS[estado].toLowerCase()}.`, 'success');
          } catch (err) { mainApp.showToast(err.message, 'error'); }
          await cargar();
        } else {
          await guardar(item, { estado, completada_en: estado === 'hecha' ? new Date().toISOString() : null }, `Marcado como ${ESTADOS[estado].toLowerCase()}.`);
        }
      });
      el.querySelector('.ag-fecha').addEventListener('click', () => {
        const nueva = window.prompt('Nueva fecha (AAAA-MM-DD):', item.fecha);
        if (!nueva) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(nueva) || Number.isNaN(Date.parse(nueva))) { mainApp.showToast('Fecha inválida. Usá el formato AAAA-MM-DD.', 'error'); return; }
        guardar(item, { vence: nueva }, 'Fecha actualizada.');
      });
      el.querySelector('.ag-borrar')?.addEventListener('click', async () => {
        if (!window.confirm(`¿Borrar la tarea "${item.titulo}"?`)) return;
        try { await borrarTarea(item.tarea.id); mainApp.showToast('Tarea borrada.', 'success'); }
        catch (e) { mainApp.showToast(e.message, 'error'); }
        await cargar();
      });
    });
  };

  const mover = (delta) => {
    let { y, m } = mesVista;
    m += delta;
    if (m < 1) { m = 12; y -= 1; } else if (m > 12) { m = 1; y += 1; }
    mesVista = { y, m };
    cargar();
  };
  $('#ag-prev').addEventListener('click', () => mover(-1));
  $('#ag-next').addEventListener('click', () => mover(1));
  $('#ag-hoy').addEventListener('click', () => { const h = new Date(); mesVista = { y: h.getFullYear(), m: h.getMonth() + 1 }; cargar(); });
  [['#ag-f-empresa', 'empresa'], ['#ag-f-responsable', 'responsable'], ['#ag-f-estado', 'estado'], ['#ag-f-tipo', 'tipo']].forEach(([sel, campo]) => {
    $(sel).addEventListener('change', (e) => { filtros[campo] = e.target.value; pintar(); });
  });

  $('#ag-ics').addEventListener('click', () => {
    const eventos = filtrarItems(items, filtros, miId).filter((i) => i.estado !== 'hecha').map((i) => ({
      uid: i.clave.replace(/[^a-zA-Z0-9:-]/g, ''),
      fecha: i.fecha,
      titulo: `${i.titulo}${i.empresa ? ` · ${i.empresa}` : ''}`,
      descripcion: [i.sub, i.detalle, i.asignado_a ? `Responsable: ${nombrePersona(i.asignado_a)}` : ''].filter(Boolean).join('\n')
    }));
    if (!eventos.length) { mainApp.showToast('No hay vencimientos sin terminar para exportar.', 'info'); return; }
    const url = URL.createObjectURL(new Blob([generarICS(eventos)], { type: 'text/calendar;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `agenda-${mesVista.y}-${pad(mesVista.m)}.ics` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    mainApp.showToast(`${eventos.length} eventos listos para importar en Google Calendar u Outlook.`, 'success');
  });

  $('#ag-nueva').addEventListener('click', () => abrirNuevaTarea());
  $('#ag-obligaciones').addEventListener('click', () => abrirObligaciones());

  const modal = (html) => {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    m.innerHTML = `<div role="dialog" aria-modal="true" style="background:#fff;border-radius:16px;padding:24px;max-width:640px;width:100%;max-height:88vh;overflow:auto;">${html}</div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
    m.querySelector('.ag-cancelar')?.addEventListener('click', () => m.remove());
    if (window.lucide) window.lucide.createIcons({ root: m });
    return m;
  };

  const abrirNuevaTarea = () => {
    const m = modal(`
      <h3 style="margin:0 0 14px;font-size:17px;">Nueva tarea</h3>
      <form id="ag-form" style="display:grid;gap:12px;">
        <div class="form-group" style="margin:0;"><label class="form-label" for="ag-t-titulo">Qué hay que hacer</label>
          <input class="form-input" id="ag-t-titulo" required maxlength="200" placeholder="Ej.: Presentar IIBB Convenio Multilateral (CM03)"></div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          <div class="form-group" style="margin:0;flex:1 1 200px;"><label class="form-label" for="ag-t-empresa">Cliente</label>
            <select class="form-select" id="ag-t-empresa"><option value="">General del estudio</option>${empresas.map((e) => `<option value="${esc(e.id)}" ${e.id === filtros.empresa ? 'selected' : ''}>${esc(e.razon_social)}</option>`).join('')}</select></div>
          <div class="form-group" style="margin:0;flex:1 1 140px;"><label class="form-label" for="ag-t-vence">Vence</label>
            <input class="form-input" type="date" id="ag-t-vence" required value="${iso(new Date())}"></div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;">
          ${personas.length ? `<div class="form-group" style="margin:0;flex:1 1 200px;"><label class="form-label" for="ag-t-resp">Responsable</label>
            <select class="form-select" id="ag-t-resp"><option value="">Sin responsable</option>${personas.map((p) => `<option value="${esc(p.id)}" ${p.id === miId ? 'selected' : ''}>${esc(p.nombre)}</option>`).join('')}</select></div>` : ''}
          <div class="form-group" style="margin:0;flex:1 1 160px;"><label class="form-label" for="ag-t-rec">Se repite</label>
            <select class="form-select" id="ag-t-rec">${Object.entries(RECURRENCIAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
        </div>
        <div class="form-group" style="margin:0;"><label class="form-label" for="ag-t-detalle">Notas (opcional)</label>
          <textarea class="form-input" id="ag-t-detalle" rows="3" maxlength="2000"></textarea></div>
        <div style="display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-outline btn-sm ag-cancelar">Cancelar</button>
          <button type="submit" class="btn btn-primary btn-sm">Crear tarea</button>
        </div>
      </form>`);
    m.querySelector('#ag-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = (id) => m.querySelector(id)?.value || '';
      try {
        await crearTarea({ titulo: v('#ag-t-titulo').trim(), empresa_id: v('#ag-t-empresa') || null, vence: v('#ag-t-vence'),
          asignado_a: v('#ag-t-resp') || null, recurrencia: v('#ag-t-rec') || null, detalle: v('#ag-t-detalle').trim() || null });
        m.remove();
        mainApp.showToast('Tarea creada.', 'success');
        const [y, mm] = v('#ag-t-vence').split('-').map(Number);
        mesVista = { y, m: mm };
        await cargar();
      } catch (err) { mainApp.showToast(faltaTabla(err) ? 'Falta aplicar la migración de tareas.' : err.message, 'error'); }
    });
  };

  const abrirObligaciones = () => {
    const m = modal(`
      <h3 style="margin:0 0 4px;font-size:17px;">Obligaciones por cliente</h3>
      <p style="margin:0 0 14px;font-size:12.5px;color:var(--text-secondary);">Viene marcado según la condición fiscal. Ajustalo: por ejemplo, tildá cargas sociales en los clientes con empleados.</p>
      <div style="overflow-x:auto;">
        <table class="table" style="font-size:12px;min-width:560px;">
          <thead><tr><th>Cliente</th>${OBLIGACIONES.map((o) => `<th style="text-align:center;" title="${esc(o.detalle)}">${esc(o.nombre)}</th>`).join('')}</tr></thead>
          <tbody>${empresas.map((e) => {
            const act = new Set(obligacionesDe(e));
            return `<tr data-id="${esc(e.id)}"><td><strong>${esc(e.razon_social)}</strong><br><small style="color:var(--text-secondary);">${esc(e.condicion_iva)}</small></td>
              ${OBLIGACIONES.map((o) => `<td style="text-align:center;"><input type="checkbox" value="${o.id}" ${act.has(o.id) ? 'checked' : ''} aria-label="${esc(o.nombre)} — ${esc(e.razon_social)}"></td>`).join('')}</tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
        <button class="btn btn-outline btn-sm ag-cancelar">Cancelar</button>
        <button class="btn btn-primary btn-sm" id="ag-obl-guardar">Guardar</button>
      </div>`);
    m.querySelector('#ag-obl-guardar').addEventListener('click', async (ev) => {
      ev.currentTarget.disabled = true;
      let errores = 0;
      for (const fila of m.querySelectorAll('tbody tr')) {
        const e = empresas.find((x) => x.id === fila.dataset.id);
        const elegidas = [...fila.querySelectorAll('input:checked')].map((i) => i.value);
        if (elegidas.join() === obligacionesDe(e).join()) continue;
        try { await updateEmpresaFieldsAsync(e.id, { obligaciones: elegidas }); } catch (err) { errores += 1; }
      }
      m.remove();
      mainApp.showToast(errores ? `No se pudieron guardar ${errores} clientes (¿falta la migración de agenda?).` : 'Obligaciones guardadas.', errores ? 'error' : 'success');
      await cargar();
    });
  };

  await cargar();
}
