/* -------------------------------------------------------------
   Conciliacion bancaria de la empresa activa: extracto del banco
   contra ventas y compras cargadas, mas el resumen impositivo del
   extracto (Ley 25.413, SIRCREB, percepciones, gastos con IVA).
   El analisis vive en la sesion; se exporta a CSV.
   ------------------------------------------------------------- */
import { getActiveCompanyAsync, getTransactionsAsync } from '../db/mockdb.js';
import { leerExtracto, conciliar, resumenConciliacion, comprobantesSinMovimiento, CLASES } from '../domain/conciliacion.js';
import { sanitizeInput as esc, fmt, fmtDate, downloadFile } from '../utils.js';

let ultimo = null; // { empresaId, archivo, movimientos }

const pesos = (n) => `$ ${fmt(Number(n) || 0)}`;

export async function renderConciliacion() {
  const empresa = await getActiveCompanyAsync();
  return `
  <div class="view-header" style="flex-wrap:wrap;gap:12px;">
    <div>
      <h1 class="view-title">Conciliación bancaria</h1>
      <p class="view-subtitle">Extracto de ${esc(empresa?.razon_social || 'la empresa')} contra sus ventas y compras, con los impuestos que cobró el banco.</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <label class="btn btn-primary btn-sm" for="con-archivo" style="cursor:pointer;"><i data-lucide="upload"></i> Subir extracto (CSV)</label>
      <input type="file" id="con-archivo" accept=".csv,.txt,text/csv,text/plain" style="display:none;">
      <button class="btn btn-outline btn-sm" id="con-csv" disabled><i data-lucide="download"></i> Exportar</button>
    </div>
  </div>
  <div id="con-vacio" class="card"><div class="card-body" style="text-align:center;padding:36px;color:var(--text-secondary);font-size:13px;line-height:1.6;">
    Descargá el extracto desde el home banking en <strong>CSV o Excel</strong> (si es Excel, guardalo como CSV) y subilo acá.<br>
    Sirve cualquier banco: buscamos las columnas Fecha, Descripción y Débito/Crédito (o Importe con signo).
  </div></div>
  <div id="con-contenido" style="display:none;">
    <div id="con-resumen" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px;"></div>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><h3><i data-lucide="landmark"></i> Impuestos y gastos del extracto</h3></div>
      <div class="card-body p-0"><table class="table" style="font-size:13px;"><tbody id="con-impuestos"></tbody></table></div>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><h3><i data-lucide="git-compare"></i> Movimientos</h3>
        <select class="form-select" id="con-filtro" style="width:auto;font-size:12.5px;">
          <option value="sin">Sin conciliar</option><option value="con">Conciliados</option><option value="imp">Impuestos y gastos</option><option value="">Todos</option>
        </select></div>
      <div class="card-body p-0" style="overflow-x:auto;"><table class="table" style="font-size:12.5px;min-width:680px;">
        <thead><tr><th>Fecha</th><th>Descripción</th><th class="text-right">Importe</th><th>Conciliado con</th></tr></thead>
        <tbody id="con-movs"></tbody></table></div>
    </div>
    <div class="card">
      <div class="card-header"><h3><i data-lucide="file-question"></i> Comprobantes del período sin movimiento en el banco</h3></div>
      <div class="card-body" id="con-pendientes" style="font-size:12.5px;"></div>
    </div>
  </div>`;
}

export async function initConciliacion(mainApp) {
  const root = document.getElementById('view-root');
  const $ = (s) => root.querySelector(s);
  const empresa = await getActiveCompanyAsync();
  if (!empresa) return;
  const txs = await getTransactionsAsync(empresa.id);
  const ventas = txs?.ventas || [];
  const compras = txs?.compras || [];
  let movs = [];
  let filtro = 'sin';

  const pintar = () => {
    const r = resumenConciliacion(movs);
    $('#con-vacio').style.display = 'none';
    $('#con-contenido').style.display = 'block';
    $('#con-csv').disabled = false;
    const tarjeta = (v, txt, sub, color = 'var(--text-primary)') => `<div class="card"><div class="card-body" style="padding:14px 16px;">
      <div style="font-size:18px;font-weight:800;color:${color};white-space:nowrap;">${v}</div><div style="font-size:12px;color:var(--text-secondary);">${txt}</div>
      ${sub ? `<div style="font-size:11.5px;margin-top:4px;">${sub}</div>` : ''}</div></div>`;
    $('#con-resumen').innerHTML = tarjeta(pesos(r.creditos.total), 'Créditos (cobros)', `${r.creditos.conciliados} de ${r.creditos.cantidad} conciliados`, '#16a34a')
      + tarjeta(pesos(r.debitos.total), 'Débitos (pagos)', `${r.debitos.conciliados} de ${r.debitos.cantidad} conciliados`, '#dc2626')
      + tarjeta(r.sinConciliar.length, 'Movimientos sin conciliar', r.sinConciliar.length ? 'Revisalos abajo' : 'Todo conciliado', r.sinConciliar.length ? '#d97706' : '#16a34a')
      + tarjeta(pesos(r.ley25413Computable), 'Ley 25.413 computable', 'Pago a cuenta de Ganancias');

    $('#con-impuestos').innerHTML = Object.entries(CLASES).filter(([k]) => k !== 'operativo').map(([k, c]) => `<tr>
      <td><strong>${esc(c.nombre)}</strong><br><small style="color:var(--text-secondary);">${esc(c.ayuda)}</small></td>
      <td class="text-right" style="font-weight:700;">${pesos(r.porClase[k])}</td></tr>`).join('')
      + `<tr><td><strong>Ley 25.413 · parte computable (33%)</strong></td><td class="text-right" style="font-weight:700;color:var(--color-accent);">${pesos(r.ley25413Computable)}</td></tr>`;

    const visibles = movs.filter((m) => (filtro === 'sin' ? m.clase === 'operativo' && !m.match : filtro === 'con' ? !!m.match : filtro === 'imp' ? m.clase !== 'operativo' : true));
    $('#con-movs').innerHTML = visibles.length ? visibles.map((m) => `<tr>
      <td style="white-space:nowrap;">${fmtDate(m.fecha)}</td>
      <td>${esc(m.descripcion || '—')}${m.clase !== 'operativo' ? `<br><small style="color:var(--color-accent);">${esc(CLASES[m.clase].nombre)}</small>` : ''}</td>
      <td class="text-right" style="font-weight:600;color:${m.importe > 0 ? '#16a34a' : '#dc2626'};white-space:nowrap;">${pesos(m.importe)}</td>
      <td>${m.match ? `${esc(m.match.comprobante)}<br><small style="color:var(--text-secondary);">${esc(m.match.contraparte)}${m.match.por === 'cuit' ? ' · por CUIT' : ' · por importe'}</small>`
        : m.clase === 'operativo' ? `<small style="color:#b45309;">Sin comprobante con ese total. ¿Falta cargarlo, o es un cobro parcial?</small>` : '—'}</td></tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-secondary);">Nada para mostrar con este filtro.</td></tr>';

    const fechas = movs.map((m) => m.fecha).sort();
    const p = comprobantesSinMovimiento(movs, ventas, compras, fechas[0], fechas[fechas.length - 1]);
    const lista = (arr, titulo) => `<div style="margin-bottom:10px;"><strong>${titulo} (${arr.length})</strong>${arr.length ? `<ul style="margin:6px 0 0;padding-left:18px;line-height:1.6;">${arr.slice(0, 30).map((t) => `<li>${fmtDate(t.fecha)} · ${esc(t.tipo_comprobante)} ${esc(t.numero)} · ${esc(t.cliente || t.proveedor || '')} · ${pesos(t.total)}</li>`).join('')}${arr.length > 30 ? `<li>…y ${arr.length - 30} más</li>` : ''}</ul>` : ' — ninguna'}</div>`;
    $('#con-pendientes').innerHTML = `<p style="margin:0 0 10px;color:var(--text-secondary);">Entre el ${fmtDate(fechas[0])} y el ${fmtDate(fechas[fechas.length - 1])}. Pueden ser ventas a cobrar, pagos en efectivo o de otra cuenta.</p>`
      + lista(p.ventas, 'Ventas sin cobro en el banco') + lista(p.compras, 'Compras sin pago en el banco');
  };

  const procesar = async (archivo) => {
    if (!archivo) return;
    if (/\.xlsx?$/i.test(archivo.name)) { mainApp.showToast('Guardá el Excel como CSV y subí ese archivo.', 'error'); return; }
    try {
      const buf = await archivo.arrayBuffer();
      let texto;
      try { texto = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { texto = new TextDecoder('windows-1252').decode(buf); }
      movs = conciliar(leerExtracto(texto), ventas, compras);
      ultimo = { empresaId: empresa.id, archivo: archivo.name, movimientos: movs };
      const r = resumenConciliacion(movs);
      mainApp.showToast(`${movs.length} movimientos leídos. ${r.creditos.conciliados + r.debitos.conciliados} conciliados automáticamente.`, 'success');
      pintar();
    } catch (e) { mainApp.showToast(e.message, 'error'); }
  };

  $('#con-archivo').addEventListener('change', (e) => procesar(e.target.files[0]));
  $('#con-filtro').addEventListener('change', (e) => { filtro = e.target.value; pintar(); });
  $('#con-csv').addEventListener('click', () => {
    const celda = (v) => { const s = String(v ?? ''); return `"${(/^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`; };
    const filas = [['Fecha', 'Descripcion', 'Importe', 'Clasificacion', 'Comprobante', 'Contraparte']]
      .concat(movs.map((m) => [m.fecha, m.descripcion, fmt(m.importe), CLASES[m.clase].nombre, m.match?.comprobante || '', m.match?.contraparte || '']));
    downloadFile(`conciliacion-${String(empresa.cuit).replace(/\D/g, '')}.csv`, '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  });

  if (ultimo && ultimo.empresaId === empresa.id) { movs = conciliar(ultimo.movimientos, ventas, compras); pintar(); }
}
