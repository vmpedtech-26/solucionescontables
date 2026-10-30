/* -------------------------------------------------------------
   Accesos al portal de una empresa (solo estudio, cuenta real):
   clientes con acceso (quitar), invitaciones pendientes (copiar/anular),
   nueva invitacion y permiso para facturar desde el portal.
   ------------------------------------------------------------- */
import { supabase, getEstudioId } from '../db/supabase.js';
import { sanitizeInput as esc } from '../utils.js';

const fecha = (iso) => (iso ? new Date(iso).toLocaleDateString('es-AR') : '—');
const linkInvitacion = (codigo) => `${window.location.origin}${window.location.pathname}#/registro-cliente?invite=${codigo}`;

export async function crearInvitacion(empresaId) {
  const { data: { user } } = await supabase.auth.getUser();
  const estudioId = (await getEstudioId()) || user.id;
  // 16 caracteres hex (64 bits): no se puede adivinar probando codigos
  const codigo = crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase();
  const { error } = await supabase.from('invitaciones_clientes').insert({ codigo, empresa_id: empresaId, estudio_id: estudioId });
  if (error) throw error;
  return linkInvitacion(codigo);
}

async function copiar(texto, mainApp, ok) {
  try {
    await navigator.clipboard.writeText(texto);
    mainApp.showToast(ok, 'success');
  } catch (e) {
    window.prompt('Copiá el link:', texto);
  }
}

export async function abrirAccesosPortal(empresa, mainApp) {
  const modal = document.createElement('div');
  modal.className = 'vmp-modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:26px;max-width:560px;width:100%;max-height:90vh;overflow:auto;box-shadow:0 25px 50px -12px rgba(15,23,42,0.35);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div><h3 style="margin:0;font-size:18px;">Portal de ${esc(empresa.razon_social)}</h3>
        <p style="margin:4px 0 0;font-size:12.5px;color:var(--text-secondary);">Quién puede entrar al portal de esta empresa y qué puede hacer.</p></div>
        <button class="btn-icon-sm" id="acc-cerrar" aria-label="Cerrar"><i data-lucide="x"></i></button>
      </div>
      <label style="display:flex;gap:10px;align-items:flex-start;margin:18px 0;padding:14px;border:1px solid var(--border-color);border-radius:10px;cursor:pointer;">
        <input type="checkbox" id="acc-facturar" ${empresa.cliente_puede_facturar ? 'checked' : ''} style="margin-top:3px;">
        <span style="font-size:13px;line-height:1.45;"><strong>Permitir que el cliente emita facturas desde el portal</strong><br>
        <span style="color:var(--text-secondary);">Usa el certificado de ARCA de tu estudio. Si está apagado, el cliente solo envía comprobantes.</span></span>
      </label>
      <h4 style="font-size:13px;margin:0 0 8px;">Clientes con acceso</h4>
      <div id="acc-clientes" style="font-size:13px;color:var(--text-secondary);">Cargando…</div>
      <h4 style="font-size:13px;margin:18px 0 8px;">Invitaciones pendientes</h4>
      <div id="acc-invitaciones" style="font-size:13px;color:var(--text-secondary);">Cargando…</div>
      <button class="btn btn-primary btn-sm" id="acc-nueva" style="margin-top:16px;"><i data-lucide="user-plus"></i> Generar nueva invitación</button>
    </div>`;
  document.body.appendChild(modal);
  if (window.lucide) window.lucide.createIcons({ root: modal });

  const $ = (s) => modal.querySelector(s);
  const cerrar = () => { modal.remove(); mainApp.router(); };
  $('#acc-cerrar').addEventListener('click', cerrar);
  modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });

  const fila = (izq, der) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border-color);">${izq}<div style="display:flex;gap:6px;">${der}</div></div>`;

  const cargar = async () => {
    const [{ data: clientes, error: e1 }, { data: invs, error: e2 }] = await Promise.all([
      supabase.from('clientes_finales').select('id, email, created_at').eq('empresa_id', empresa.id).order('created_at'),
      supabase.from('invitaciones_clientes').select('codigo, created_at, usado').eq('empresa_id', empresa.id).eq('usado', false).order('created_at', { ascending: false })
    ]);
    $('#acc-clientes').innerHTML = e1 ? 'No se pudo cargar.' : (clientes.length
      ? clientes.map((c) => fila(`<span><strong style="color:var(--text-primary);">${esc(c.email)}</strong><br><small>desde ${fecha(c.created_at)}</small></span>`,
        `<button class="btn btn-outline btn-xs acc-quitar" data-id="${esc(c.id)}" data-email="${esc(c.email)}" style="color:#ef4444;border-color:rgba(239,68,68,0.3);">Quitar acceso</button>`)).join('')
      : 'Todavía ningún cliente aceptó una invitación.');
    $('#acc-invitaciones').innerHTML = e2 ? 'No se pudo cargar.' : (invs.length
      ? invs.map((i) => fila(`<span class="font-mono" style="color:var(--text-primary);">${esc(i.codigo)}<br><small style="font-family:var(--font-primary);">creada el ${fecha(i.created_at)}</small></span>`,
        `<button class="btn btn-outline btn-xs acc-copiar" data-codigo="${esc(i.codigo)}">Copiar link</button><button class="btn btn-outline btn-xs acc-anular" data-codigo="${esc(i.codigo)}">Anular</button>`)).join('')
      : 'No hay invitaciones pendientes.');

    modal.querySelectorAll('.acc-quitar').forEach((b) => b.addEventListener('click', async () => {
      if (!window.confirm(`${b.dataset.email} ya no va a poder entrar al portal de ${empresa.razon_social}. Los comprobantes que envió se conservan. ¿Continuar?`)) return;
      // .select() devuelve las filas borradas: sin permiso, Supabase no da error pero borra 0
      const { data, error } = await supabase.from('clientes_finales').delete().eq('id', b.dataset.id).select('id');
      if (error || !data?.length) { mainApp.showToast('No se pudo quitar el acceso. Probá de nuevo más tarde.', 'error'); return; }
      mainApp.showToast('Acceso quitado.', 'success');
      cargar();
    }));
    modal.querySelectorAll('.acc-copiar').forEach((b) => b.addEventListener('click', () => copiar(linkInvitacion(b.dataset.codigo), mainApp, 'Link copiado.')));
    modal.querySelectorAll('.acc-anular').forEach((b) => b.addEventListener('click', async () => {
      const { data, error } = await supabase.from('invitaciones_clientes').delete().eq('codigo', b.dataset.codigo).select('codigo');
      if (error || !data?.length) { mainApp.showToast('No se pudo anular la invitación.', 'error'); return; }
      mainApp.showToast('Invitación anulada: el link ya no sirve.', 'success');
      cargar();
    }));
  };

  $('#acc-facturar').addEventListener('change', async (e) => {
    const valor = e.target.checked;
    const { data, error } = await supabase.from('empresas').update({ cliente_puede_facturar: valor }).eq('id', empresa.id).select('id');
    if (error || !data?.length) {
      e.target.checked = !valor;
      mainApp.showToast('No se pudo guardar el permiso.', 'error');
      return;
    }
    empresa.cliente_puede_facturar = valor;
    mainApp.showToast(valor ? 'El cliente ya puede facturar desde su portal.' : 'El cliente ya no puede facturar desde su portal.', 'success');
  });

  $('#acc-nueva').addEventListener('click', async () => {
    try {
      const link = await crearInvitacion(empresa.id);
      await copiar(link, mainApp, 'Invitación creada y link copiado. Mandáselo a tu cliente.');
      cargar();
    } catch (err) {
      mainApp.showToast(`No se pudo crear la invitación: ${err.message || err}`, 'error');
    }
  });

  cargar();
}
