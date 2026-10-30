/* -------------------------------------------------------------
   Equipo del estudio: miembros y roles, invitaciones por link y
   empresas asignadas a cada asistente. Solo con cuenta real.
   ------------------------------------------------------------- */
import { supabase, isSupabaseConfigured, getEstudioId, getRolEquipo } from '../db/supabase.js';
import { getCompaniesAsync, getEstudioAsync } from '../db/mockdb.js';
import { sanitizeInput as esc } from '../utils.js';
import { ROLES, ROLES_INVITABLES, esAdmin, nuevoCodigo, linkEquipo, validarInvitacion, puedeModificar, vencida } from '../domain/equipo.js';

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '—');
const faltaTabla = (e) => e && ['42P01', 'PGRST205', 'PGRST200'].includes(e.code);

export async function renderEquipo() {
  if (!isSupabaseConfigured) {
    return `
    <div class="view-header"><div><h1 class="view-title">Equipo del estudio</h1>
      <p class="view-subtitle">Usuarios, roles y empresas asignadas.</p></div></div>
    <div class="card"><div class="card-body" style="padding:32px;text-align:center;color:var(--text-secondary);">El equipo se gestiona con una cuenta real del estudio.</div></div>`;
  }
  const admin = esAdmin(await getRolEquipo());
  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Equipo del estudio</h1>
      <p class="view-subtitle">Quién trabaja en el estudio, con qué rol y en qué empresas.</p>
    </div>
  </div>

  <div id="eq-aviso"></div>

  <div class="card" style="margin-bottom:20px;">
    <div class="card-header"><h3><i data-lucide="users-round"></i> Miembros</h3></div>
    <div class="card-body" id="eq-miembros" style="font-size:13px;color:var(--text-secondary);padding-top:6px;">Cargando…</div>
  </div>

  ${admin ? `
  <div class="card" style="margin-bottom:20px;">
    <div class="card-header"><h3><i data-lucide="user-plus"></i> Invitar a alguien</h3></div>
    <div class="card-body">
    <form id="eq-form" style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;">
      <div class="form-group" style="margin:0;flex:2 1 220px;">
        <label class="form-label" for="eq-email">Email (opcional)</label>
        <input class="form-input" type="email" id="eq-email" placeholder="persona@estudio.com" maxlength="160">
      </div>
      <div class="form-group" style="margin:0;flex:1 1 150px;">
        <label class="form-label" for="eq-rol">Rol</label>
        <select class="form-select" id="eq-rol">
          ${ROLES_INVITABLES.map((r) => `<option value="${r}" ${r === 'contador' ? 'selected' : ''}>${ROLES[r].nombre}</option>`).join('')}
        </select>
      </div>
      <button type="submit" class="btn btn-primary"><i data-lucide="user-plus"></i> Generar link</button>
    </form>
    <p id="eq-rol-detalle" style="font-size:12px;color:var(--text-secondary);margin:10px 0 0;"></p>
    <p style="font-size:12px;color:var(--text-secondary);margin:6px 0 0;">Con email, solo esa persona puede usar el link. El link vence a los 14 días y sirve una sola vez.</p>
    </div>
  </div>

  <div class="card">
    <div class="card-header"><h3><i data-lucide="link"></i> Invitaciones pendientes</h3></div>
    <div class="card-body" id="eq-invitaciones" style="font-size:13px;color:var(--text-secondary);padding-top:6px;">Cargando…</div>
  </div>` : `
  <div class="card"><div class="card-body" style="font-size:13px;color:var(--text-secondary);">
    Solo el titular o un administrador pueden invitar personas y cambiar roles.
  </div></div>`}`;
}

export async function initEquipo(mainApp) {
  if (!isSupabaseConfigured || !supabase) return;
  const root = document.getElementById('view-root');
  const $ = (s) => root.querySelector(s);
  const [estudioId, miRol, { data: { user } }] = await Promise.all([getEstudioId(), getRolEquipo(), supabase.auth.getUser()]);
  const admin = esAdmin(miRol);
  let miembros = [];
  let invitaciones = [];

  const rolSel = $('#eq-rol');
  const detalle = () => { if (rolSel) $('#eq-rol-detalle').textContent = ROLES[rolSel.value].detalle; };
  rolSel?.addEventListener('change', detalle);
  detalle();

  const fila = (izq, der) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 0;border-bottom:1px solid var(--border-color);">${izq}<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">${der}</div></div>`;

  const copiar = async (texto) => {
    try { await navigator.clipboard.writeText(texto); mainApp.showToast('Link copiado. Mandalo por WhatsApp o email.', 'success'); }
    catch (e) { window.prompt('Copiá el link:', texto); }
  };

  const cargar = async () => {
    const [estudio, empresas, rM, rI, rA] = await Promise.all([
      getEstudioAsync(),
      getCompaniesAsync(),
      supabase.from('estudio_miembros').select('user_id, email, nombre, rol, activo, created_at').eq('estudio_id', estudioId).order('created_at'),
      admin ? supabase.from('invitaciones_equipo').select('codigo, email, rol, expira_en, created_at').eq('estudio_id', estudioId).eq('usado', false).order('created_at', { ascending: false }) : { data: [] },
      supabase.from('empresa_asignaciones').select('empresa_id, user_id')
    ]);

    if (faltaTabla(rM.error)) {
      $('#eq-aviso').innerHTML = `<div class="card" style="border-left:4px solid #f59e0b;margin-bottom:20px;"><div class="card-body" style="font-size:13px;">
        La base de datos todavía no tiene las tablas del equipo. Hay que aplicar la migración <code>2026-11-01-equipo-estudio.sql</code>.</div></div>`;
      $('#eq-miembros').textContent = 'Sin datos.';
      if ($('#eq-invitaciones')) $('#eq-invitaciones').textContent = 'Sin datos.';
      root.querySelector('#eq-form button[type=submit]')?.setAttribute('disabled', '');
      return;
    }
    miembros = rM.data || [];
    invitaciones = rI.data || [];
    const asignaciones = rA.data || [];
    const nombreEmpresa = Object.fromEntries((empresas || []).map((e) => [e.id, e.razon_social]));

    const titular = fila(
      `<span><strong style="color:var(--text-primary);">${esc(estudio?.email || 'Titular')}</strong>${estudio?.id === user.id ? ' <small>(vos)</small>' : ''}<br><small>${esc(ROLES.titular.detalle)}</small></span>`,
      `<span class="badge-status active">Titular</span>`);

    const filas = miembros.map((m) => {
      const editable = puedeModificar(miRol, user.id, m);
      const asign = asignaciones.filter((a) => a.user_id === m.user_id).map((a) => nombreEmpresa[a.empresa_id]).filter(Boolean);
      const izq = `<span style="min-width:0;"><strong style="color:var(--text-primary);">${esc(m.nombre || m.email)}</strong>${m.user_id === user.id ? ' <small>(vos)</small>' : ''}
        ${m.nombre ? `<br><small>${esc(m.email || '')}</small>` : ''}
        <br><small>desde ${fecha(m.created_at)}${m.activo ? '' : ' · <strong style="color:#ef4444;">sin acceso</strong>'}</small>
        ${m.rol === 'asistente' ? `<br><small>Empresas: ${asign.length ? esc(asign.join(', ')) : 'ninguna asignada'}</small>` : ''}</span>`;
      const der = editable
        ? `<select class="form-select eq-rol-miembro" data-id="${esc(m.user_id)}" aria-label="Rol de ${esc(m.email || '')}" style="width:auto;padding:4px 8px;font-size:12px;">
             ${ROLES_INVITABLES.map((r) => `<option value="${r}" ${r === m.rol ? 'selected' : ''}>${ROLES[r].nombre}</option>`).join('')}
           </select>
           ${m.rol === 'asistente' ? `<button class="btn btn-outline btn-xs eq-asignar" data-id="${esc(m.user_id)}">Empresas</button>` : ''}
           <button class="btn btn-outline btn-xs eq-activo" data-id="${esc(m.user_id)}" data-activo="${m.activo}">${m.activo ? 'Suspender' : 'Reactivar'}</button>
           <button class="btn btn-outline btn-xs eq-quitar" data-id="${esc(m.user_id)}" data-email="${esc(m.email || '')}" style="color:#ef4444;border-color:rgba(239,68,68,0.3);">Quitar</button>`
        : `<span class="badge-status ${m.activo ? 'pending' : 'inactive'}">${esc(ROLES[m.rol]?.nombre || m.rol)}</span>`;
      return fila(izq, der);
    }).join('');
    $('#eq-miembros').innerHTML = titular + (filas || `<p style="margin:12px 0 0;">Todavía no sumaste a nadie. ${admin ? 'Generá un link de invitación abajo.' : ''}</p>`);

    if ($('#eq-invitaciones')) {
      $('#eq-invitaciones').innerHTML = invitaciones.length ? invitaciones.map((i) => fila(
        `<span><strong style="color:var(--text-primary);">${esc(i.email || 'Cualquier persona con el link')}</strong> · ${esc(ROLES[i.rol]?.nombre || i.rol)}
          <br><small>creada el ${fecha(i.created_at)} · ${vencida(i) ? '<strong style="color:#ef4444;">vencida</strong>' : `vence el ${fecha(i.expira_en)}`}</small></span>`,
        `${vencida(i) ? '' : `<button class="btn btn-outline btn-xs eq-copiar" data-codigo="${esc(i.codigo)}">Copiar link</button>`}
         <button class="btn btn-outline btn-xs eq-anular" data-codigo="${esc(i.codigo)}">${vencida(i) ? 'Borrar' : 'Anular'}</button>`)).join('')
        : 'No hay invitaciones pendientes.';
    }
    if (window.lucide) window.lucide.createIcons({ root });
    enlazar(empresas || [], asignaciones);
  };

  // Escrituras: con RLS, una fila sin permiso no da error pero no cambia nada
  const actualizarMiembro = async (id, campos) => {
    const { data, error } = await supabase.from('estudio_miembros').update(campos).eq('user_id', id).select('user_id');
    if (error || !data?.length) throw new Error(error?.message || 'No tenés permiso para cambiar a esta persona.');
  };

  const enlazar = (empresas, asignaciones) => {
    root.querySelectorAll('.eq-rol-miembro').forEach((sel) => sel.addEventListener('change', async () => {
      try { await actualizarMiembro(sel.dataset.id, { rol: sel.value }); mainApp.showToast(`Rol cambiado a ${ROLES[sel.value].nombre}.`, 'success'); }
      catch (e) { mainApp.showToast(e.message, 'error'); }
      await cargar();
    }));
    root.querySelectorAll('.eq-activo').forEach((b) => b.addEventListener('click', async () => {
      const activar = b.dataset.activo !== 'true';
      if (!activar && !window.confirm('Esta persona no va a poder entrar al estudio hasta que la reactives. ¿Continuar?')) return;
      try { await actualizarMiembro(b.dataset.id, { activo: activar }); mainApp.showToast(activar ? 'Acceso reactivado.' : 'Acceso suspendido.', 'success'); }
      catch (e) { mainApp.showToast(e.message, 'error'); }
      await cargar();
    }));
    root.querySelectorAll('.eq-quitar').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm(`${b.dataset.email || 'Esta persona'} deja de pertenecer al estudio. Lo que cargó se conserva. ¿Continuar?`)) return;
      const { data, error } = await supabase.from('estudio_miembros').delete().eq('user_id', b.dataset.id).select('user_id');
      if (error || !data?.length) mainApp.showToast(error?.message || 'No se pudo quitar.', 'error');
      else mainApp.showToast('Persona quitada del equipo.', 'success');
      await cargar();
    }));
    root.querySelectorAll('.eq-asignar').forEach((b) => b.addEventListener('click', () => abrirAsignaciones(b.dataset.id, empresas, asignaciones)));
    root.querySelectorAll('.eq-copiar').forEach((b) => b.addEventListener('click', () => copiar(linkEquipo(b.dataset.codigo))));
    root.querySelectorAll('.eq-anular').forEach((b) => b.addEventListener('click', async () => {
      const { error } = await supabase.from('invitaciones_equipo').delete().eq('codigo', b.dataset.codigo);
      mainApp.showToast(error ? `No se pudo anular: ${error.message}` : 'Invitación anulada.', error ? 'error' : 'success');
      await cargar();
    }));
  };

  const abrirAsignaciones = (userId, empresas, asignaciones) => {
    const m = miembros.find((x) => x.user_id === userId);
    const actuales = new Set(asignaciones.filter((a) => a.user_id === userId).map((a) => a.empresa_id));
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    modal.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="eq-asig-titulo" style="background:#fff;border-radius:16px;padding:24px;max-width:480px;width:100%;max-height:85vh;overflow:auto;">
        <h3 id="eq-asig-titulo" style="margin:0 0 4px;font-size:17px;">Empresas de ${esc(m?.nombre || m?.email || 'asistente')}</h3>
        <p style="margin:0 0 14px;font-size:12.5px;color:var(--text-secondary);">Solo va a ver y cargar datos de las empresas marcadas.</p>
        <input class="form-input" id="eq-asig-buscar" placeholder="Buscar empresa o CUIT" style="margin-bottom:10px;">
        <div id="eq-asig-lista">${empresas.map((e) => `
          <label data-texto="${esc(`${e.razon_social} ${e.cuit}`.toLowerCase())}" style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-color);font-size:13px;cursor:pointer;">
            <input type="checkbox" value="${esc(e.id)}" ${actuales.has(e.id) ? 'checked' : ''}>
            <span>${esc(e.razon_social)} <small style="color:var(--text-secondary);">${esc(e.cuit)}</small></span>
          </label>`).join('') || '<p style="font-size:13px;">El estudio todavía no tiene empresas.</p>'}</div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
          <button class="btn btn-outline btn-sm" id="eq-asig-cancelar">Cancelar</button>
          <button class="btn btn-primary btn-sm" id="eq-asig-guardar">Guardar</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    const cerrar = () => modal.remove();
    modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });
    modal.querySelector('#eq-asig-cancelar').addEventListener('click', cerrar);
    modal.querySelector('#eq-asig-buscar').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      modal.querySelectorAll('#eq-asig-lista label').forEach((l) => { l.style.display = l.dataset.texto.includes(q) ? 'flex' : 'none'; });
    });
    modal.querySelector('#eq-asig-guardar').addEventListener('click', async (ev) => {
      ev.currentTarget.disabled = true;
      const marcadas = new Set([...modal.querySelectorAll('#eq-asig-lista input:checked')].map((i) => i.value));
      const altas = [...marcadas].filter((id) => !actuales.has(id)).map((empresa_id) => ({ empresa_id, user_id: userId }));
      const bajas = [...actuales].filter((id) => !marcadas.has(id));
      const errores = [];
      if (altas.length) { const { error } = await supabase.from('empresa_asignaciones').insert(altas); if (error) errores.push(error.message); }
      if (bajas.length) { const { error } = await supabase.from('empresa_asignaciones').delete().eq('user_id', userId).in('empresa_id', bajas); if (error) errores.push(error.message); }
      mainApp.showToast(errores.length ? `No se pudo guardar: ${errores[0]}` : 'Empresas asignadas.', errores.length ? 'error' : 'success');
      cerrar();
      await cargar();
    });
  };

  $('#eq-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#eq-email').value.trim().toLowerCase();
    const rol = $('#eq-rol').value;
    const error = validarInvitacion({ email, rol }, miembros, invitaciones.filter((i) => !vencida(i)));
    if (error) { mainApp.showToast(error, 'error'); return; }
    const codigo = nuevoCodigo();
    const { error: e1 } = await supabase.from('invitaciones_equipo').insert({ codigo, estudio_id: estudioId, email: email || null, rol });
    if (e1) { mainApp.showToast(`No se pudo crear la invitación: ${e1.message}`, 'error'); return; }
    e.target.reset();
    detalle();
    await copiar(linkEquipo(codigo));
    await cargar();
  });

  await cargar();
}
