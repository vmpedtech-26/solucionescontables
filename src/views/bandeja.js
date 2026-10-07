/* -------------------------------------------------------------
   Bandeja de comprobantes de clientes: el estudio revisa lo que sus clientes
   cargan desde el Portal, lo pasa al Libro de Compras o lo rechaza.
   ------------------------------------------------------------- */
import { supabase, isSupabaseConfigured } from '../db/supabase.js';
import { addTransactionAsync } from '../db/mockdb.js';
import { sanitizeInput as esc, validarCUIT, renderComingSoon } from '../utils.js';

export const TIPOS_COMPROBANTE = ['Factura A', 'Factura B', 'Factura C', 'Factura M', 'Nota de Crédito A', 'Nota de Crédito B', 'Nota de Débito A', 'Nota de Débito B'];

const fmtMonto = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (f) => String(f || '').split('-').reverse().join('/');

async function cargarComprobantes() {
  const { data, error } = await supabase
    .from('comprobantes_digitales')
    .select('*, empresas(razon_social, cuit)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return data || [];
}

export async function renderBandeja() {
  if (!isSupabaseConfigured || !supabase) {
    return renderComingSoon('Bandeja de clientes', 'La bandeja recibe los comprobantes que tus clientes cargan desde su portal. Requiere una cuenta real: no está disponible en la demo.');
  }
  let lista = [];
  let errorCarga = false;
  try { lista = await cargarComprobantes(); } catch (e) { console.error('Bandeja:', e); errorCarga = true; }

  const pendientes = lista.filter((t) => t.estado === 'Recibido');
  const resueltos = lista.filter((t) => t.estado !== 'Recibido');

  const fila = (t, conAcciones) => `
    <tr data-id="${esc(t.id)}">
      <td class="font-mono text-sm">${esc(fmtFecha(t.fecha))}</td>
      <td style="font-weight:600;">${esc(t.empresas?.razon_social || '—')}</td>
      <td>
        ${esc(t.proveedor || t.detalle)}
        ${t.cuit ? `<br><span class="font-mono" style="font-size:11px;color:var(--text-secondary);">CUIT ${esc(t.cuit)}</span>` : ''}
        ${t.tipo_comprobante || t.numero ? `<br><span style="font-size:11px;color:var(--text-secondary);">${esc(t.tipo_comprobante || '')} ${esc(t.numero || '')}</span>` : ''}
      </td>
      <td class="font-mono text-right" style="font-weight:600;">${esc(fmtMonto(t.monto))}</td>
      <td class="text-center">
        ${t.archivo && t.archivo.includes('/') ? `<button class="btn btn-outline btn-sm bandeja-ver" data-path="${esc(t.archivo)}"><i data-lucide="paperclip"></i> Ver</button>` : '<span class="text-muted" style="font-size:11px;">sin archivo</span>'}
      </td>
      <td class="text-right">
        ${conAcciones ? `
          <button class="btn btn-primary btn-sm bandeja-aprobar" data-id="${esc(t.id)}">Cargar al libro</button>
          <button class="btn btn-outline btn-sm bandeja-rechazar" data-id="${esc(t.id)}" style="color:#ef4444;border-color:rgba(239,68,68,0.3);">Rechazar</button>
        ` : `<span class="badge-status ${t.estado === 'Rechazado' ? 'inactive' : 'active'}" style="font-size:10px;">${esc(t.estado)}</span>${t.nota_estudio ? `<br><span style="font-size:10.5px;color:var(--text-secondary);">${esc(t.nota_estudio)}</span>` : ''}`}
      </td>
    </tr>`;

  const tabla = (items, conAcciones, vacio) => items.length === 0
    ? `<p class="text-secondary" style="padding: 24px; text-align:center; font-size:13px;">${vacio}</p>`
    : `<div class="table-responsive"><table class="table"><thead><tr>
        <th>Fecha</th><th>Empresa</th><th>Detalle</th><th class="text-right">Monto</th><th class="text-center">Archivo</th><th class="text-right">${conAcciones ? 'Acciones' : 'Estado'}</th>
      </tr></thead><tbody>${items.map((t) => fila(t, conAcciones)).join('')}</tbody></table></div>`;

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Bandeja de clientes</h1>
      <p class="view-subtitle">Comprobantes que tus clientes cargaron desde su portal. Revisalos y pasalos al Libro de Compras.</p>
    </div>
    <span class="badge" style="margin:0;">${pendientes.length} pendiente${pendientes.length === 1 ? '' : 's'}</span>
  </div>
  ${errorCarga ? '<div class="card"><div class="card-body" style="color:#b91c1c;">No se pudo cargar la bandeja. Reintentá en unos segundos.</div></div>' : ''}
  <div class="card" style="margin-bottom:24px;">
    <div class="card-header"><h3><i data-lucide="inbox"></i> Pendientes de revisión</h3></div>
    <div class="card-body p-0">${tabla(pendientes, true, 'No hay comprobantes pendientes. Cuando un cliente cargue uno, va a aparecer acá.')}</div>
  </div>
  <div class="card">
    <div class="card-header"><h3><i data-lucide="check-circle"></i> Ya resueltos</h3></div>
    <div class="card-body p-0">${tabla(resueltos, false, 'Todavía no resolviste ningún comprobante.')}</div>
  </div>`;
}

function abrirModalAprobar(t, mainApp) {
  const hoy = new Date().toISOString().slice(0, 10);
  const modal = document.createElement('div');
  modal.className = 'vmp-modal-overlay';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  const input = 'width:100%;border:1px solid var(--border-color);border-radius:6px;padding:9px 10px;font-size:13px;box-sizing:border-box;';
  const label = 'display:block;font-size:11px;font-weight:700;color:var(--text-secondary);margin:10px 0 4px;text-transform:uppercase;';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:24px;max-width:480px;width:100%;max-height:92vh;overflow:auto;">
      <h3 style="margin:0 0 4px;">Cargar al Libro de Compras</h3>
      <p style="margin:0 0 8px;font-size:12px;color:var(--text-secondary);">${esc(t.empresas?.razon_social || '')} · el cliente informó ${esc(fmtMonto(t.monto))}. Completá los datos fiscales del comprobante.</p>
      <form id="bandeja-form">
        <label style="${label}">Fecha del comprobante *</label>
        <input type="date" id="b-fecha" required value="${esc(t.fecha || hoy)}" style="${input}">
        <label style="${label}">Proveedor *</label>
        <input type="text" id="b-prov" required maxlength="160" value="${esc(t.proveedor || '')}" style="${input}">
        <label style="${label}">CUIT del proveedor *</label>
        <input type="text" id="b-cuit" required maxlength="13" value="${esc(t.cuit || '')}" placeholder="30-12345678-9" style="${input}">
        <div id="b-cuit-fb" style="font-size:11px;margin-top:3px;"></div>
        <label style="${label}">Tipo de comprobante *</label>
        <select id="b-tipo" style="${input}background:#fff;">${TIPOS_COMPROBANTE.map((x) => `<option ${x === t.tipo_comprobante ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>
        <label style="${label}">Número (PPPP-NNNNNNNN) *</label>
        <input type="text" id="b-num" required maxlength="20" value="${esc(t.numero || '')}" placeholder="0001-00001234" style="${input}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div><label style="${label}">Total *</label><input type="number" id="b-total" step="0.01" min="0" required value="${esc(Number(t.monto || 0).toFixed(2))}" style="${input}"></div>
          <div><label style="${label}">Alícuota IVA</label>
            <select id="b-ali" style="${input}background:#fff;"><option value="21">21%</option><option value="10.5">10,5%</option><option value="27">27%</option><option value="0">Sin IVA (B/C/exento)</option></select></div>
        </div>
        <div id="b-resumen" style="margin-top:10px;font-size:12px;color:var(--text-secondary);"></div>
        <div style="display:flex;gap:10px;margin-top:16px;">
          <button type="button" id="b-cancel" class="btn btn-outline" style="flex:1;">Cancelar</button>
          <button type="submit" class="btn btn-primary" style="flex:1;">Cargar al libro</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);

  const $ = (id) => modal.querySelector(id);
  const cerrar = () => modal.remove();
  $('#b-cancel').addEventListener('click', cerrar);

  const calc = () => {
    const total = parseFloat($('#b-total').value) || 0;
    const ali = parseFloat($('#b-ali').value) || 0;
    const neto = ali > 0 ? total / (1 + ali / 100) : total;
    return { total, neto: Math.round(neto * 100) / 100, iva: Math.round((total - neto) * 100) / 100 };
  };
  const refrescar = () => {
    const c = calc();
    $('#b-resumen').textContent = `Neto ${fmtMonto(c.neto)} · IVA ${fmtMonto(c.iva)} · Total ${fmtMonto(c.total)}`;
    const cuit = $('#b-cuit').value.replace(/\D/g, '');
    $('#b-cuit-fb').innerHTML = cuit.length === 11 && !validarCUIT(cuit) ? '<span style="color:#b45309;">⚠ El dígito verificador no coincide: revisá el CUIT.</span>' : '';
  };
  ['#b-total', '#b-ali', '#b-cuit'].forEach((s) => $(s).addEventListener('input', refrescar));
  refrescar();

  $('#bandeja-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const numero = $('#b-num').value.trim();
    if (!/^\d{1,5}-\d{1,8}$/.test(numero)) { mainApp.showToast('El número debe tener el formato 0001-00001234.', 'error'); return; }
    const cuit = $('#b-cuit').value.trim();
    if (!validarCUIT(cuit)) { mainApp.showToast('El CUIT del proveedor no es válido (dígito verificador).', 'error'); return; }
    const c = calc();
    try {
      await addTransactionAsync(t.empresa_id, 'compras', {
        fecha: $('#b-fecha').value,
        proveedor: $('#b-prov').value.trim(),
        cuit,
        tipo_comprobante: $('#b-tipo').value,
        numero,
        neto: c.neto, iva: c.iva, total: c.total,
        es_activo: !!t.es_activo,
        categoria: t.categoria || 'General'
      });
      const { error } = await supabase.from('comprobantes_digitales').update({ estado: 'Procesado' }).eq('id', t.id);
      if (error) throw error;
      mainApp.showToast('Comprobante cargado al Libro de Compras.', 'success');
      cerrar();
      mainApp.router();
    } catch (err) {
      console.error('Bandeja aprobar:', err);
      mainApp.showToast('No se pudo cargar el comprobante. Verificá que no esté repetido.', 'error');
    }
  });
}

export async function initBandeja(mainApp) {
  if (window.lucide) window.lucide.createIcons();
  if (!isSupabaseConfigured || !supabase) return;

  const lista = await cargarComprobantes().catch(() => []);
  const porId = Object.fromEntries(lista.map((t) => [t.id, t]));

  document.querySelectorAll('.bandeja-ver').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { data, error } = await supabase.storage.from('comprobantes').createSignedUrl(btn.dataset.path, 120);
      if (error || !data?.signedUrl) { mainApp.showToast('No se pudo abrir el archivo.', 'error'); return; }
      window.open(data.signedUrl, '_blank', 'noopener');
    });
  });

  document.querySelectorAll('.bandeja-aprobar').forEach((btn) => {
    btn.addEventListener('click', () => { const t = porId[btn.dataset.id]; if (t) abrirModalAprobar(t, mainApp); });
  });

  document.querySelectorAll('.bandeja-rechazar').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const motivo = window.prompt('Motivo del rechazo (el cliente lo va a ver):', '');
      if (motivo === null) return;
      const { error } = await supabase.from('comprobantes_digitales')
        .update({ estado: 'Rechazado', nota_estudio: motivo.trim().slice(0, 300) || null }).eq('id', btn.dataset.id);
      if (error) { mainApp.showToast('No se pudo rechazar el comprobante.', 'error'); return; }
      mainApp.showToast('Comprobante rechazado.', 'info');
      mainApp.router();
    });
  });
}
