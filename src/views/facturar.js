/* -------------------------------------------------------------
   Emision de factura electronica (WSFEv1) a traves de la Edge Function "arca".
   La usan el estudio (empresa activa) y el cliente final (su empresa).
   ------------------------------------------------------------- */
import { supabase, isSupabaseConfigured, getCachedRole } from '../db/supabase.js';
import { getActiveCompanyAsync, getClienteFinalAsync, getTransactionsAsync, updateEmpresaFieldsAsync } from '../db/mockdb.js';
import { arca, AMBIENTE_LABEL } from '../arca.js';
import { abrirComprobante, CODIGOS_TIPO } from '../domain/comprobante.js';
import { sanitizeInput as esc, validarCUIT, renderComingSoon } from '../utils.js';

const CONDICIONES = [[5, 'Consumidor Final'], [1, 'IVA Responsable Inscripto'], [6, 'Responsable Monotributo'], [4, 'IVA Sujeto Exento'], [15, 'IVA No Alcanzado'], [13, 'Monotributista Social']];
const pesos = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function empresaParaFacturar() {
  if ((await getCachedRole()) === 'cliente') {
    const cli = await getClienteFinalAsync();
    if (!cli) return null;
    const { data } = await supabase.from('empresas').select('*').eq('id', cli.empresa_id).single();
    return data || null;
  }
  return await getActiveCompanyAsync();
}

export async function renderFacturar() {
  if (!isSupabaseConfigured || !supabase) {
    return renderComingSoon('Factura electrónica', 'La emisión de facturas con CAE de ARCA requiere una cuenta real: no está disponible en la demo.');
  }
  const emp = await empresaParaFacturar();
  if (!emp || !emp.id) {
    return '<div class="card"><div class="card-body">Primero cargá una empresa en <a href="#/studio/empresas">Mis Clientes</a>.</div></div>';
  }
  const esEstudio = (await getCachedRole()) === 'estudio';
  const esMono = String(emp.condicion_iva).toLowerCase().includes('monotributo');
  const inp = 'width:100%;border:1px solid var(--border-color);border-radius:6px;padding:8px 10px;font-size:13px;box-sizing:border-box;background:#fff;';
  const lab = 'display:block;font-size:11px;font-weight:700;color:var(--text-secondary);margin:10px 0 4px;text-transform:uppercase;';
  const hoy = new Date().toISOString().slice(0, 10);
  const tipos = esMono ? ['Factura C'] : ['Factura B', 'Factura A'];

  let emitidas = [];
  if (esEstudio) {
    const txs = await getTransactionsAsync(emp.id).catch(() => ({ ventas: [] }));
    emitidas = (txs.ventas || []).filter((v) => v.cae).slice(0, 10);
  }

  return `
  <div class="view-header">
    <div>
      <h1 class="view-title">Factura electrónica</h1>
      <p class="view-subtitle">${esc(emp.razon_social)} · CUIT ${esc(emp.cuit)} · ${esc(emp.condicion_iva)}</p>
    </div>
    <span class="badge" id="fac-ambiente" style="margin:0;">Verificando conexión…</span>
  </div>

  ${esEstudio && !emp.domicilio ? `
  <div class="card" style="margin-bottom:16px;border-color:rgba(245,158,11,0.4);">
    <div class="card-body" style="font-size:12.5px;">
      <strong>Faltan datos del emisor para imprimir la factura.</strong>
      <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:10px;align-items:end;margin-top:8px;">
        <div><label style="${lab}">Domicilio comercial</label><input id="fac-dom" style="${inp}" maxlength="200" placeholder="Calle 123, Ciudad, Provincia"></div>
        <div><label style="${lab}">N° Ingresos Brutos</label><input id="fac-iibb" style="${inp}" maxlength="30"></div>
        <button class="btn btn-outline btn-sm" id="fac-guardar-emisor">Guardar</button>
      </div>
    </div>
  </div>` : ''}

  <div style="display:grid;grid-template-columns:1.2fr 0.8fr;gap:24px;align-items:start;" class="form-grid">
    <div class="card">
      <div class="card-body">
        <form id="fac-form">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div><label style="${lab}">Punto de venta *</label><select id="fac-pv" style="${inp}"><option value="">Cargando…</option></select></div>
            <div><label style="${lab}">Comprobante *</label><select id="fac-tipo" style="${inp}">${tipos.map((t) => `<option value="${CODIGOS_TIPO[t]}">${t}</option>`).join('')}</select></div>
            <div><label style="${lab}">Concepto *</label><select id="fac-concepto" style="${inp}"><option value="1">Productos</option><option value="2">Servicios</option><option value="3">Productos y servicios</option></select></div>
          </div>
          <div id="fac-serv" style="display:none;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div><label style="${lab}">Servicio desde</label><input type="date" id="fac-sdesde" style="${inp}"></div>
            <div><label style="${lab}">Servicio hasta</label><input type="date" id="fac-shasta" style="${inp}"></div>
            <div><label style="${lab}">Vto. de pago</label><input type="date" id="fac-vto" style="${inp}"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label style="${lab}">Receptor</label><select id="fac-doctipo" style="${inp}"><option value="99">Consumidor Final (sin identificar)</option><option value="80">CUIT</option><option value="96">DNI</option></select></div>
            <div><label style="${lab}">N° de documento</label><input id="fac-docnro" style="${inp}" disabled placeholder="—" maxlength="13"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div><label style="${lab}">Nombre / razón social</label><input id="fac-nombre" style="${inp}" maxlength="160" placeholder="Consumidor Final"></div>
            <div><label style="${lab}">Condición IVA del receptor *</label><select id="fac-condrec" style="${inp}">${CONDICIONES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>
          </div>
          <label style="${lab}">Detalle *</label>
          <input id="fac-detalle" style="${inp}" maxlength="200" required placeholder="Ej: Honorarios profesionales octubre">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
            <div><label style="${lab}">Fecha *</label><input type="date" id="fac-fecha" style="${inp}" value="${hoy}" required></div>
            <div><label style="${lab}">${esMono ? 'Importe total' : 'Importe neto'} *</label><input type="number" id="fac-neto" step="0.01" min="0.01" style="${inp}" required></div>
            <div><label style="${lab}">Alícuota IVA</label><select id="fac-ali" style="${inp}" ${esMono ? 'disabled' : ''}>${esMono ? '<option value="0">No corresponde</option>' : '<option value="21">21%</option><option value="10.5">10,5%</option><option value="27">27%</option><option value="5">5%</option><option value="2.5">2,5%</option><option value="0">0%</option>'}</select></div>
          </div>
          <div id="fac-totales" style="margin-top:12px;font-size:13px;"></div>
          <button type="submit" class="btn btn-primary" id="fac-emitir" style="margin-top:14px;width:100%;" disabled><i data-lucide="zap"></i> Emitir y obtener CAE</button>
        </form>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px;">
      <details class="card" id="fac-guia-pv" style="padding:14px 18px;font-size:12.5px;line-height:1.55;">
        <summary style="cursor:pointer;font-weight:700;color:var(--color-primary);">¿Cómo creo un punto de venta?</summary>
        <p style="margin:10px 0 6px;color:var(--text-secondary);">Para emitir desde el sistema hace falta un punto de venta de tipo <strong>Web Services</strong>. Los de "Factura en línea" (los que se usan desde la web de ARCA) no sirven. Es gratis y queda activo al instante:</p>
        <ol style="padding-left:18px;margin:0;color:var(--text-secondary);">
          <li>Entrá a <strong>arca.gob.ar</strong> con la Clave Fiscal de ${esc(emp.razon_social)}.</li>
          <li>Abrí <strong>Administración de puntos de venta y domicilios</strong> y elegí la empresa.</li>
          <li>Tocá <strong>Agregar</strong> y elegí el sistema <strong>${esMono ? 'Factura Electrónica – Monotributo – Web Services' : 'RECE para aplicativo y web services'}</strong>.</li>
          <li>Poné un número que no esté usado (por ejemplo 2, si el 1 es de Factura en línea) y el domicilio.</li>
          <li>Volvé a esta pantalla: el punto de venta nuevo aparece en el selector.</li>
        </ol>
        ${esEstudio ? '<p style="margin:8px 0 0;color:var(--text-secondary);"><strong>Si factura el estudio en nombre del cliente:</strong> el cliente también tiene que delegar el servicio <em>Facturación Electrónica</em> al CUIT del estudio (Administrador de Relaciones de Clave Fiscal → Nueva Relación).</p>' : ''}
      </details>
      <div class="card"><div class="card-body" id="fac-resultado" style="font-size:12.5px;color:var(--text-secondary);">El comprobante se autoriza en ARCA y se obtiene el CAE al instante. En producción, la factura se registra sola en el Libro IVA Ventas.</div></div>
      ${esEstudio ? `<div class="card"><div class="card-header"><h3>Últimas emitidas (producción)</h3></div><div class="card-body p-0">
        ${emitidas.length ? `<table class="table" style="font-size:12px;"><tbody>${emitidas.map((v) => `<tr><td>${esc(v.tipo_comprobante)} ${esc(v.numero)}<br><span class="text-muted">${esc(v.cliente || '')}</span></td><td class="r font-mono">${esc(pesos(v.total))}</td><td><button class="btn btn-outline btn-xs fac-reimprimir" data-id="${esc(v.id)}">Imprimir</button></td></tr>`).join('')}</tbody></table>` : '<p class="text-secondary" style="padding:16px;font-size:12px;">Todavía no hay facturas emitidas en producción.</p>'}
      </div></div>` : ''}
    </div>
  </div>`;
}

export async function initFacturar(mainApp) {
  if (window.lucide) window.lucide.createIcons();
  const form = document.getElementById('fac-form');
  if (!form) return;
  const emp = await empresaParaFacturar();
  const $ = (id) => document.getElementById(id);
  let ambiente = null;

  $('fac-guardar-emisor')?.addEventListener('click', async () => {
    try {
      await updateEmpresaFieldsAsync(emp.id, { domicilio: $('fac-dom').value.trim() || null, iibb: $('fac-iibb').value.trim() || null });
      mainApp.showToast('Datos del emisor guardados.', 'success');
      mainApp.router();
    } catch (e) { mainApp.showToast('No se pudieron guardar los datos.', 'error'); }
  });

  // Puntos de venta habilitados para web services
  try {
    const r = await arca('puntos_venta', { empresa_id: emp.id });
    ambiente = r.ambiente;
    const badge = $('fac-ambiente');
    badge.textContent = AMBIENTE_LABEL[ambiente];
    if (ambiente === 'homologacion') { badge.style.background = '#fef3c7'; badge.style.color = '#92400e'; }
    const activos = r.puntos.filter((p) => !p.bloqueado && !p.baja);
    $('fac-pv').innerHTML = activos.length
      ? activos.map((p) => `<option value="${p.numero}">${String(p.numero).padStart(5, '0')} · ${esc(p.tipo)}</option>`).join('')
      : `<option value="1">00001 (homologación)</option>`;
    if (!activos.length && ambiente === 'produccion') {
      $('fac-pv').innerHTML = '';
      $('fac-resultado').innerHTML = '<span style="color:#b91c1c;">La empresa no tiene puntos de venta para Web Services. Abajo te explicamos cómo crearlo en ARCA.</span>';
      $('fac-guia-pv').open = true;
    } else $('fac-emitir').disabled = false;
  } catch (e) {
    $('fac-ambiente').textContent = 'Sin conexión con ARCA';
    $('fac-pv').innerHTML = '';
    $('fac-resultado').innerHTML = `<span style="color:#b91c1c;">${esc(e.message)}</span>`;
  }

  const calc = () => {
    const tipo = Number($('fac-tipo').value);
    const esC = tipo === 11;
    const neto = Math.round((parseFloat($('fac-neto').value) || 0) * 100) / 100;
    const ali = esC ? 0 : parseFloat($('fac-ali').value) || 0;
    const iva = Math.round(neto * ali) / 100;
    return { esC, neto, ali, iva, total: Math.round((neto + iva) * 100) / 100 };
  };
  const refrescar = () => {
    const c = calc();
    $('fac-totales').innerHTML = c.esC ? `Total: <b>${pesos(c.total)}</b>` : `Neto ${pesos(c.neto)} · IVA ${pesos(c.iva)} · <b>Total ${pesos(c.total)}</b>`;
    const dt = $('fac-doctipo').value;
    $('fac-docnro').disabled = dt === '99';
    if (dt === '99') $('fac-docnro').value = '';
    $('fac-serv').style.display = $('fac-concepto').value === '1' ? 'none' : 'grid';
    // Factura A solo a responsables inscriptos
    if ($('fac-tipo').value === '1') { $('fac-doctipo').value = '80'; $('fac-condrec').value = '1'; $('fac-docnro').disabled = false; }
  };
  ['fac-neto', 'fac-ali', 'fac-tipo', 'fac-doctipo', 'fac-concepto'].forEach((id) => $(id)?.addEventListener('input', refrescar));
  ['fac-tipo', 'fac-doctipo', 'fac-concepto'].forEach((id) => $(id)?.addEventListener('change', refrescar));
  refrescar();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const c = calc();
    const docTipo = Number($('fac-doctipo').value);
    const docNro = $('fac-docnro').value.replace(/\D/g, '');
    if (docTipo === 80 && !validarCUIT(docNro)) { mainApp.showToast('El CUIT del receptor no es válido.', 'error'); return; }
    if (docTipo === 96 && !/^\d{7,8}$/.test(docNro)) { mainApp.showToast('El DNI debe tener 7 u 8 dígitos.', 'error'); return; }
    const tipoTxt = $('fac-tipo').selectedOptions[0].textContent;
    const ok = window.confirm(`${ambiente === 'produccion' ? '⚠ PRODUCCIÓN: se emite un comprobante con validez fiscal.\n\n' : 'Homologación (prueba sin validez fiscal).\n\n'}${tipoTxt} por ${pesos(c.total)} a ${$('fac-nombre').value || 'Consumidor Final'}.\n¿Emitir?`);
    if (!ok) return;
    const datos = {
      empresa_id: emp.id, pto_vta: Number($('fac-pv').value), cbteTipo: Number($('fac-tipo').value), concepto: Number($('fac-concepto').value),
      docTipo, docNro: docNro || '0', condicionIvaReceptor: Number($('fac-condrec').value), fecha: $('fac-fecha').value,
      neto: c.neto, alicuota: c.ali, receptor_nombre: $('fac-nombre').value.trim(),
      servDesde: $('fac-sdesde').value, servHasta: $('fac-shasta').value, vtoPago: $('fac-vto').value
    };
    const btn = $('fac-emitir');
    btn.disabled = true; btn.textContent = 'Solicitando CAE a ARCA…';
    try {
      const r = await arca('emitir', datos);
      const out = $('fac-resultado');
      if (r.resultado === 'A') {
        out.innerHTML = `<div style="color:#15803d;font-size:14px;font-weight:700;">✓ Autorizada</div>
          <p>${esc(r.tipo)} <b>${esc(r.numero)}</b> · ${esc(pesos(r.total))}</p>
          <p>CAE <b class="font-mono">${esc(r.cae)}</b> · vence ${esc(String(r.caeVto).split('-').reverse().join('/'))}</p>
          ${r.observaciones.length ? `<p style="color:#b45309;">Observaciones: ${esc(r.observaciones.join(' | '))}</p>` : ''}
          ${r.ambiente === 'produccion' ? `<p>${r.registrado ? 'Registrada en el Libro IVA Ventas.' : '<span style="color:#b91c1c;">No se pudo registrar en el Libro IVA: cargala a mano.</span>'}</p>` : ''}
          <button class="btn btn-primary btn-sm" id="fac-imprimir"><i data-lucide="printer"></i> Imprimir comprobante</button>`;
        if (window.lucide) window.lucide.createIcons({ root: out });
        const imprimir = () => abrirComprobante({
          emisor: emp,
          cbte: { tipo: r.tipo, numero: r.numero, fecha: datos.fecha, cae: r.cae, caeVto: r.caeVto, concepto: datos.concepto,
            servDesde: datos.servDesde, servHasta: datos.servHasta, vtoPago: datos.vtoPago, neto: r.neto, iva: r.iva,
            alicuota: datos.alicuota, total: r.total, homologacion: r.ambiente === 'homologacion' },
          receptor: { nombre: datos.receptor_nombre, docTipo, docNro, condicionIva: $('fac-condrec').selectedOptions[0].textContent },
          detalle: $('fac-detalle').value
        }) || mainApp.showToast('Habilitá las ventanas emergentes para imprimir.', 'info');
        $('fac-imprimir').addEventListener('click', imprimir);
        imprimir();
        form.reset();
        $('fac-fecha').value = new Date().toISOString().slice(0, 10);
        refrescar();
      } else {
        out.innerHTML = `<div style="color:#b91c1c;font-weight:700;">✗ Rechazada por ARCA</div><p>${esc([...r.errores, ...r.observaciones].join(' | ') || 'Sin detalle')}</p>`;
      }
    } catch (err) {
      mainApp.showToast(err.message, 'error');
      $('fac-resultado').innerHTML = `<span style="color:#b91c1c;">${esc(err.message)}</span>`;
    } finally {
      btn.disabled = false; btn.innerHTML = '<i data-lucide="zap"></i> Emitir y obtener CAE';
      if (window.lucide) window.lucide.createIcons({ root: btn });
    }
  });

  document.querySelectorAll('.fac-reimprimir').forEach((b) => b.addEventListener('click', async () => {
    const txs = await getTransactionsAsync(emp.id);
    const v = txs.ventas.find((x) => x.id === b.dataset.id);
    if (!v) return;
    const cuit = String(v.cuit || '').replace(/\D/g, '');
    const neto = Number(v.neto), iva = Number(v.iva);
    abrirComprobante({
      emisor: emp,
      cbte: { tipo: v.tipo_comprobante, numero: v.numero, fecha: v.fecha, cae: v.cae, caeVto: v.cae_vto, concepto: 1,
        neto, iva, alicuota: neto > 0 ? Math.round((iva / neto) * 1000) / 10 : 0, total: Number(v.total) },
      receptor: { nombre: v.cliente, docTipo: cuit.length === 11 ? 80 : 99, docNro: cuit || '0', condicionIva: '' },
      detalle: ''
    });
  }));
}
