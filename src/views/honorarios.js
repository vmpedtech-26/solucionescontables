/* -------------------------------------------------------------
   Honorarios y cobranzas: abono mensual por cliente, generacion de
   cargos del mes, cobros con recibo, cuenta corriente y deuda por
   antiguedad. No disponible para asistentes.
   ------------------------------------------------------------- */
import { getCompaniesAsync, getEstudioAsync } from '../db/mockdb.js';
import { getRolEquipo, isSupabaseConfigured } from '../db/supabase.js';
import { listarAbonos, guardarAbono, listarMovimientos, crearMovimientos, borrarMovimiento } from '../db/honorarios.js';
import { TIPOS_MOV, MEDIOS, saldo, cuentaCorriente, antiguedad, diasDeuda, abonosPendientes, aumentar, resumenMes, proximoRecibo, validarMovimiento, parseImporte } from '../domain/honorarios.js';
import { iso } from '../domain/vencimientos.js';
import { sanitizeInput as esc, fmt, fmtDate } from '../utils.js';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pesos = (n) => `$ ${fmt(Number(n) || 0)}`;
const faltaTabla = (e) => !!e && ['42P01', 'PGRST205', 'PGRST200'].includes(e.code);
const periodoActual = () => iso(new Date()).slice(0, 7);
const nombrePeriodo = (p) => `${MESES[Number(p.slice(5)) - 1]} ${p.slice(0, 4)}`;

export async function renderHonorarios() {
  if (isSupabaseConfigured && (await getRolEquipo()) === 'asistente') {
    return `<div class="view-header"><div><h1 class="view-title">Honorarios y cobranzas</h1></div></div>
      <div class="card"><div class="card-body" style="color:var(--text-secondary);font-size:13px;">Esta sección es solo para el titular, administradores y contadores del estudio.</div></div>`;
  }
  const p = periodoActual();
  return `
  <div class="view-header" style="flex-wrap:wrap;gap:12px;">
    <div>
      <h1 class="view-title">Honorarios y cobranzas</h1>
      <p class="view-subtitle">Abonos de cada cliente, cuenta corriente, cobros con recibo y deuda por antigüedad.</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-outline btn-sm" id="hon-aumento"><i data-lucide="trending-up"></i> Aumentar abonos</button>
      <button class="btn btn-outline btn-sm" id="hon-csv"><i data-lucide="download"></i> Exportar saldos</button>
      <button class="btn btn-primary btn-sm" id="hon-generar"><i data-lucide="file-plus-2"></i> Generar abonos de ${nombrePeriodo(p)}</button>
    </div>
  </div>
  <div id="hon-aviso"></div>
  <div id="hon-resumen" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px;"></div>
  <div class="card" style="margin-bottom:16px;"><div class="card-body" id="hon-antiguedad" style="padding:14px 20px;"></div></div>
  <div class="card">
    <div class="card-header"><h3><i data-lucide="wallet"></i> Clientes</h3>
      <input class="form-input" id="hon-buscar" placeholder="Buscar cliente o CUIT" style="max-width:220px;padding:6px 10px;font-size:12.5px;">
    </div>
    <div class="card-body p-0" style="overflow-x:auto;">
      <table class="table" style="font-size:13px;min-width:720px;">
        <thead><tr><th>Cliente</th><th class="text-right">Abono mensual</th><th class="text-right">Saldo</th><th>Deuda más vieja</th><th>Último cobro</th><th class="text-right">Acciones</th></tr></thead>
        <tbody id="hon-filas"><tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-secondary);">Cargando…</td></tr></tbody>
      </table>
    </div>
  </div>`;
}

export async function initHonorarios(mainApp) {
  const root = document.getElementById('view-root');
  const $ = (s) => root.querySelector(s);
  if (!$('#hon-filas')) return; // asistente
  let empresas = [];
  let abonos = [];
  let movs = [];
  let estudio = null;
  let busqueda = '';

  const errorTabla = (e) => (faltaTabla(e) ? 'Falta aplicar la migración 2026-11-03-honorarios.sql.' : e.message);

  const cargar = async () => {
    [empresas, estudio] = await Promise.all([getCompaniesAsync(), getEstudioAsync()]);
    try {
      [abonos, movs] = await Promise.all([listarAbonos(), listarMovimientos()]);
      $('#hon-aviso').innerHTML = '';
    } catch (e) {
      abonos = []; movs = [];
      $('#hon-aviso').innerHTML = `<div class="card" style="border-left:4px solid #f59e0b;margin-bottom:16px;"><div class="card-body" style="font-size:13px;">${esc(errorTabla(e))}</div></div>`;
    }
    pintar();
  };

  const movsDe = (id) => movs.filter((m) => m.empresa_id === id);
  const abonoDe = (id) => abonos.find((a) => a.empresa_id === id);

  const pintar = () => {
    const hoy = iso(new Date());
    const p = periodoActual();
    const r = resumenMes(movs, p);
    const saldos = empresas.map((e) => saldo(movsDe(e.id)));
    const aCobrar = saldos.filter((s) => s > 0).reduce((a, b) => a + b, 0);
    const ant = empresas.reduce((t, e) => { const a = antiguedad(movsDe(e.id), hoy); for (const k in t) t[k] += a[k]; return t; }, { d30: 0, d60: 0, d90: 0, mas90: 0 });
    const tarjeta = (v, txt, color) => `<div class="card"><div class="card-body" style="padding:14px 16px;"><div style="font-size:18px;font-weight:800;color:${color};white-space:nowrap;">${v}</div><div style="font-size:12px;color:var(--text-secondary);">${txt}</div></div></div>`;
    $('#hon-resumen').innerHTML = tarjeta(pesos(aCobrar), 'A cobrar', 'var(--text-primary)')
      + tarjeta(pesos(r.cargado), `Cargado en ${MESES[Number(p.slice(5)) - 1]}`, 'var(--color-accent)')
      + tarjeta(pesos(r.cobrado), `Cobrado en ${MESES[Number(p.slice(5)) - 1]}`, '#16a34a')
      + tarjeta(pesos(ant.d60 + ant.d90 + ant.mas90), 'Deuda de más de 30 días', '#dc2626');
    const total = ant.d30 + ant.d60 + ant.d90 + ant.mas90;
    const tramo = (v, txt, color) => `<div style="flex:${Math.max(v, total * 0.08) || 1};min-width:90px;"><div style="height:8px;border-radius:4px;background:${color};opacity:${v ? 1 : 0.25};"></div>
      <div style="font-size:11.5px;margin-top:6px;color:var(--text-secondary);">${txt}<br><strong style="color:var(--text-primary);">${pesos(v)}</strong></div></div>`;
    $('#hon-antiguedad').innerHTML = `<div style="font-size:12px;font-weight:700;margin-bottom:8px;">Deuda por antigüedad</div>
      <div style="display:flex;gap:8px;">${tramo(ant.d30, 'Hasta 30 días', '#0d9488')}${tramo(ant.d60, '31 a 60', '#d97706')}${tramo(ant.d90, '61 a 90', '#ea580c')}${tramo(ant.mas90, 'Más de 90', '#dc2626')}</div>`;

    const q = busqueda.toLowerCase();
    const visibles = empresas.filter((e) => !q || `${e.razon_social} ${e.cuit}`.toLowerCase().includes(q));
    $('#hon-filas').innerHTML = visibles.length ? visibles.map((e) => {
      const ms = movsDe(e.id);
      const s = saldo(ms);
      const a = abonoDe(e.id);
      const dd = diasDeuda(ms, hoy);
      const ultimo = [...ms].filter((m) => m.tipo === 'cobro').sort((x, y) => y.fecha.localeCompare(x.fecha))[0];
      return `<tr data-id="${esc(e.id)}">
        <td><strong>${esc(e.razon_social)}</strong><br><small style="color:var(--text-secondary);">${esc(e.cuit)}</small></td>
        <td class="text-right"><button class="btn btn-outline btn-xs hon-abono">${a && Number(a.importe) > 0 ? `${pesos(a.importe)}${a.activo === false ? ' (pausado)' : ''}` : 'Definir'}</button></td>
        <td class="text-right" style="font-weight:700;color:${s > 0 ? '#dc2626' : s < 0 ? '#16a34a' : 'inherit'};">${pesos(s)}${s < 0 ? '<br><small style="font-weight:500;">a favor</small>' : ''}</td>
        <td>${dd ? `<span style="color:${dd > 60 ? '#dc2626' : dd > 30 ? '#d97706' : 'inherit'};">${dd} días</span>` : '—'}</td>
        <td>${ultimo ? `${fmtDate(ultimo.fecha)}<br><small style="color:var(--text-secondary);">${pesos(ultimo.importe)}</small>` : '—'}</td>
        <td class="text-right" style="white-space:nowrap;">
          <button class="btn btn-primary btn-xs hon-mov" data-tipo="cobro">Cobro</button>
          <button class="btn btn-outline btn-xs hon-mov" data-tipo="cargo">Cargo</button>
          <button class="btn btn-outline btn-xs hon-cuenta">Cuenta</button>
        </td></tr>`;
    }).join('') : `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-secondary);">${empresas.length ? 'Sin resultados.' : 'Cargá tus clientes para llevar sus honorarios.'}</td></tr>`;

    root.querySelectorAll('#hon-filas tr[data-id]').forEach((tr) => {
      const e = empresas.find((x) => x.id === tr.dataset.id);
      tr.querySelector('.hon-abono').addEventListener('click', () => abrirAbono(e));
      tr.querySelectorAll('.hon-mov').forEach((b) => b.addEventListener('click', () => abrirMovimiento(e, b.dataset.tipo)));
      tr.querySelector('.hon-cuenta').addEventListener('click', () => abrirCuenta(e));
    });
  };

  const modal = (html, ancho = 460) => {
    const m = document.createElement('div');
    m.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
    m.innerHTML = `<div role="dialog" aria-modal="true" style="background:#fff;border-radius:16px;padding:24px;max-width:${ancho}px;width:100%;max-height:88vh;overflow:auto;">${html}</div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
    m.querySelectorAll('.hon-cancelar').forEach((b) => b.addEventListener('click', () => m.remove()));
    if (window.lucide) window.lucide.createIcons({ root: m });
    return m;
  };
  const campo = (id, label, input, flex = '1 1 160px') => `<div class="form-group" style="margin:0;flex:${flex};"><label class="form-label" for="${id}">${label}</label>${input}</div>`;
  const pie = (txt) => `<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px;"><button type="button" class="btn btn-outline btn-sm hon-cancelar">Cancelar</button><button type="submit" class="btn btn-primary btn-sm">${txt}</button></div>`;

  const abrirAbono = (e) => {
    const a = abonoDe(e.id) || { importe: 0, concepto: 'Honorarios profesionales', dia_vencimiento: 10, activo: true };
    const m = modal(`<h3 style="margin:0 0 4px;font-size:17px;">Abono de ${esc(e.razon_social)}</h3>
      <p style="margin:0 0 14px;font-size:12.5px;color:var(--text-secondary);">Se carga en la cuenta del cliente cada mes, al generar los abonos.</p>
      <form id="hon-f-abono" style="display:flex;flex-wrap:wrap;gap:12px;">
        ${campo('hon-a-importe', 'Importe mensual', `<input class="form-input" id="hon-a-importe" inputmode="decimal" required value="${Number(a.importe) ? fmt(Number(a.importe)) : ''}" placeholder="150.000,00">`)}
        ${campo('hon-a-dia', 'Vence el día', `<input class="form-input" type="number" id="hon-a-dia" min="1" max="31" required value="${Number(a.dia_vencimiento) || 10}">`, '0 1 110px')}
        ${campo('hon-a-concepto', 'Concepto', `<input class="form-input" id="hon-a-concepto" maxlength="200" value="${esc(a.concepto || '')}">`, '1 1 100%')}
        <label style="display:flex;gap:8px;align-items:center;font-size:13px;flex:1 1 100%;"><input type="checkbox" id="hon-a-activo" ${a.activo !== false ? 'checked' : ''}> Abono activo</label>
        <div style="flex:1 1 100%;">${pie('Guardar')}</div>
      </form>`);
    m.querySelector('#hon-f-abono').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const importe = parseImporte(m.querySelector('#hon-a-importe').value);
      if (!(importe >= 0)) { mainApp.showToast('Importe inválido.', 'error'); return; }
      try {
        await guardarAbono({ empresa_id: e.id, importe, dia_vencimiento: Number(m.querySelector('#hon-a-dia').value),
          concepto: m.querySelector('#hon-a-concepto').value.trim() || null, activo: m.querySelector('#hon-a-activo').checked });
        m.remove(); mainApp.showToast('Abono guardado.', 'success'); await cargar();
      } catch (err) { mainApp.showToast(errorTabla(err), 'error'); }
    });
  };

  const abrirMovimiento = (e, tipo) => {
    const s = saldo(movsDe(e.id));
    const m = modal(`<h3 style="margin:0 0 14px;font-size:17px;">${tipo === 'cobro' ? 'Registrar cobro' : 'Nuevo cargo o bonificación'} · ${esc(e.razon_social)}</h3>
      <form id="hon-f-mov" style="display:flex;flex-wrap:wrap;gap:12px;">
        ${tipo === 'cobro' ? '' : campo('hon-m-tipo', 'Tipo', `<select class="form-select" id="hon-m-tipo"><option value="cargo">Cargo (el cliente debe)</option><option value="bonificacion">Bonificación (resta deuda)</option></select>`, '1 1 100%')}
        ${campo('hon-m-fecha', 'Fecha', `<input class="form-input" type="date" id="hon-m-fecha" required value="${iso(new Date())}">`)}
        ${campo('hon-m-importe', 'Importe', `<input class="form-input" id="hon-m-importe" inputmode="decimal" required value="${tipo === 'cobro' && s > 0 ? fmt(s) : ''}">`)}
        ${campo('hon-m-concepto', 'Concepto', `<input class="form-input" id="hon-m-concepto" maxlength="300" required value="${tipo === 'cobro' ? 'Pago de honorarios' : ''}" placeholder="${tipo === 'cobro' ? '' : 'Ej.: Balance 2026, alta de empleado, trámite'}">`, '1 1 100%')}
        ${tipo === 'cobro' ? campo('hon-m-medio', 'Medio de pago', `<select class="form-select" id="hon-m-medio">${Object.entries(MEDIOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`) : ''}
        ${campo('hon-m-cbte', 'Factura asociada (opcional)', `<input class="form-input" id="hon-m-cbte" maxlength="60" placeholder="C 0003-00000123">`)}
        ${tipo === 'cobro' ? '<label style="display:flex;gap:8px;align-items:center;font-size:13px;flex:1 1 100%;"><input type="checkbox" id="hon-m-recibo" checked> Abrir el recibo para imprimir o enviar</label>' : ''}
        <div style="flex:1 1 100%;">${pie(tipo === 'cobro' ? 'Registrar cobro' : 'Guardar')}</div>
      </form>`);
    m.querySelector('#hon-f-mov').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const v = (id) => m.querySelector(id)?.value ?? '';
      const mov = { empresa_id: e.id, tipo: tipo === 'cobro' ? 'cobro' : v('#hon-m-tipo'), fecha: v('#hon-m-fecha'),
        importe: parseImporte(v('#hon-m-importe')), concepto: v('#hon-m-concepto').trim(),
        medio: tipo === 'cobro' ? v('#hon-m-medio') : null, comprobante: v('#hon-m-cbte').trim() || null };
      if (mov.tipo === 'cobro') mov.recibo = proximoRecibo(movs);
      const error = validarMovimiento(mov);
      if (error) { mainApp.showToast(error, 'error'); return; }
      try {
        const [creado] = await crearMovimientos([mov]);
        m.remove();
        mainApp.showToast(mov.tipo === 'cobro' ? `Cobro registrado. Recibo N° ${mov.recibo}.` : 'Movimiento guardado.', 'success');
        if (mov.tipo === 'cobro' && m.querySelector('#hon-m-recibo')?.checked) imprimir(htmlRecibo(estudio, e, creado || mov));
        await cargar();
      } catch (err) {
        mainApp.showToast(err.code === '23505' ? 'Otro usuario registró un recibo al mismo tiempo. Probá de nuevo.' : errorTabla(err), 'error');
        await cargar();
      }
    });
  };

  const abrirCuenta = (e) => {
    const cc = cuentaCorriente(movsDe(e.id));
    const m = modal(`<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
        <div><h3 style="margin:0;font-size:17px;">Cuenta corriente · ${esc(e.razon_social)}</h3>
        <p style="margin:4px 0 12px;font-size:12.5px;color:var(--text-secondary);">Saldo: <strong>${pesos(saldo(movsDe(e.id)))}</strong></p></div>
        <button class="btn btn-outline btn-sm" id="hon-cc-imprimir" ${cc.length ? '' : 'disabled'}><i data-lucide="printer"></i> Resumen</button>
      </div>
      <div style="overflow-x:auto;"><table class="table" style="font-size:12.5px;min-width:560px;">
        <thead><tr><th>Fecha</th><th>Concepto</th><th class="text-right">Debe</th><th class="text-right">Haber</th><th class="text-right">Saldo</th><th></th></tr></thead>
        <tbody>${cc.length ? cc.map((x) => `<tr data-id="${esc(x.id)}">
          <td>${fmtDate(x.fecha)}</td>
          <td>${esc(x.concepto)}${x.tipo !== 'cargo' ? ` <small style="color:var(--text-secondary);">· ${TIPOS_MOV[x.tipo]}${x.medio ? ` (${MEDIOS[x.medio] || ''})` : ''}${x.recibo ? ` · Recibo ${x.recibo}` : ''}</small>` : ''}${x.comprobante ? `<br><small style="color:var(--text-secondary);">Factura ${esc(x.comprobante)}</small>` : ''}</td>
          <td class="text-right">${x.tipo === 'cargo' ? pesos(x.importe) : ''}</td>
          <td class="text-right">${x.tipo !== 'cargo' ? pesos(x.importe) : ''}</td>
          <td class="text-right"><strong>${pesos(x.saldo)}</strong></td>
          <td style="white-space:nowrap;">${x.tipo === 'cobro' ? '<button class="btn btn-outline btn-xs hon-cc-recibo">Recibo</button>' : ''}
            <button class="btn-icon-sm hon-cc-borrar" aria-label="Borrar movimiento" title="Borrar"><i data-lucide="trash-2" style="width:13px;height:13px;color:#ef4444;"></i></button></td>
        </tr>`).join('') : '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-secondary);">Sin movimientos.</td></tr>'}</tbody>
      </table></div>
      <div style="display:flex;justify-content:flex-end;margin-top:12px;"><button class="btn btn-outline btn-sm hon-cancelar">Cerrar</button></div>`, 760);
    m.querySelector('#hon-cc-imprimir').addEventListener('click', () => imprimir(htmlResumen(estudio, e, cc)));
    m.querySelectorAll('tr[data-id]').forEach((tr) => {
      const x = cc.find((y) => y.id === tr.dataset.id);
      tr.querySelector('.hon-cc-recibo')?.addEventListener('click', () => imprimir(htmlRecibo(estudio, e, x)));
      tr.querySelector('.hon-cc-borrar').addEventListener('click', async () => {
        if (!window.confirm(`¿Borrar "${x.concepto}" por ${pesos(x.importe)}?`)) return;
        try { await borrarMovimiento(x.id); m.remove(); mainApp.showToast('Movimiento borrado.', 'success'); await cargar(); abrirCuenta(e); }
        catch (err) { mainApp.showToast(errorTabla(err), 'error'); }
      });
    });
  };

  const imprimir = (html) => {
    const w = window.open('', '_blank');
    if (!w) { mainApp.showToast('El navegador bloqueó la ventana. Permití ventanas emergentes para este sitio.', 'error'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  $('#hon-buscar').addEventListener('input', (ev) => { busqueda = ev.target.value.trim(); pintar(); });

  $('#hon-generar').addEventListener('click', async (ev) => {
    const p = periodoActual();
    const nuevos = abonosPendientes(abonos, movs, p);
    if (!nuevos.length) { mainApp.showToast(abonos.some((a) => Number(a.importe) > 0) ? `Los abonos de ${nombrePeriodo(p)} ya están generados.` : 'Definí el abono de cada cliente primero (columna "Abono mensual").', 'info'); return; }
    const total = nuevos.reduce((s, n) => s + n.importe, 0);
    if (!window.confirm(`Se cargan ${nuevos.length} abonos de ${nombrePeriodo(p)} por ${pesos(total)} en total. ¿Continuar?`)) return;
    const boton = ev.currentTarget;
    boton.disabled = true;
    try { const hechos = await crearMovimientos(nuevos); mainApp.showToast(`${hechos.length} abonos cargados.`, 'success'); }
    catch (err) { mainApp.showToast(errorTabla(err), 'error'); }
    boton.disabled = false;
    await cargar();
  });

  $('#hon-aumento').addEventListener('click', () => {
    const activos = abonos.filter((a) => Number(a.importe) > 0);
    if (!activos.length) { mainApp.showToast('Todavía no hay abonos definidos.', 'info'); return; }
    const m = modal(`<h3 style="margin:0 0 4px;font-size:17px;">Aumentar abonos</h3>
      <p style="margin:0 0 14px;font-size:12.5px;color:var(--text-secondary);">Aplica el porcentaje a los ${activos.length} abonos definidos (redondeado a pesos). Los cargos ya generados no cambian.</p>
      <form id="hon-f-aum" style="display:flex;flex-wrap:wrap;gap:12px;">
        ${campo('hon-aum-pct', 'Aumento (%)', '<input class="form-input" id="hon-aum-pct" inputmode="decimal" required placeholder="Ej.: 8,5">')}
        <div style="flex:1 1 100%;">${pie('Aplicar')}</div>
      </form>`);
    m.querySelector('#hon-f-aum').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const pct = parseImporte(m.querySelector('#hon-aum-pct').value);
      if (!(pct > 0 && pct <= 500)) { mainApp.showToast('Porcentaje inválido.', 'error'); return; }
      try {
        for (const a of activos) await guardarAbono({ empresa_id: a.empresa_id, importe: aumentar(a.importe, pct), concepto: a.concepto, dia_vencimiento: a.dia_vencimiento, activo: a.activo });
        m.remove(); mainApp.showToast(`Abonos aumentados ${fmt(pct, 1)}%.`, 'success'); await cargar();
      } catch (err) { mainApp.showToast(errorTabla(err), 'error'); await cargar(); }
    });
  });

  $('#hon-csv').addEventListener('click', () => {
    const hoy = iso(new Date());
    const celda = (v) => { const s = String(v ?? ''); return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; };
    const filas = [['Cliente', 'CUIT', 'Abono mensual', 'Saldo', 'Hasta 30 dias', '31 a 60', '61 a 90', 'Mas de 90']];
    for (const e of empresas) {
      const ms = movsDe(e.id); const a = antiguedad(ms, hoy);
      filas.push([e.razon_social, e.cuit, fmt(Number(abonoDe(e.id)?.importe) || 0), fmt(saldo(ms)), fmt(a.d30), fmt(a.d60), fmt(a.d90), fmt(a.mas90)]);
    }
    const csv = '﻿' + filas.map((f) => f.map((v) => `"${celda(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `saldos-honorarios-${hoy}.csv` });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  await cargar();
}

const estilosDoc = `body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#111;margin:32px;max-width:720px;}
  h1{font-size:20px;margin:0;} .muted{color:#555;font-size:12px;} table{width:100%;border-collapse:collapse;margin-top:16px;}
  th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left;} .r{text-align:right;} .box{border:1px solid #111;padding:16px;margin-top:18px;}
  .firma{margin-top:60px;width:240px;border-top:1px solid #111;text-align:center;padding-top:6px;font-size:12px;}
  @media print{button{display:none;}}`;

/** Recibo de cobro de honorarios (documento interno, no fiscal). */
export function htmlRecibo(estudio, empresa, mov) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibo ${esc(String(mov.recibo || ''))}</title><style>${estilosDoc}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;">
      <div><h1>${esc(estudio?.razon_social || 'Estudio contable')}</h1><div class="muted">${esc(estudio?.email || '')}</div></div>
      <div style="text-align:right;"><h1>RECIBO</h1><div>N° ${esc(String(mov.recibo || '').padStart(8, '0'))}</div><div>Fecha: ${fmtDate(mov.fecha)}</div></div>
    </div>
    <div class="box">
      <p>Recibimos de <strong>${esc(empresa.razon_social)}</strong> (CUIT ${esc(empresa.cuit)}) la suma de <strong>$ ${fmt(Number(mov.importe))}</strong>
      en concepto de ${esc(mov.concepto)}${mov.comprobante ? `, a cuenta de la factura ${esc(mov.comprobante)}` : ''}.</p>
      <p>Medio de pago: ${esc(MEDIOS[mov.medio] || 'No informado')}.</p>
    </div>
    <div class="firma">Firma y aclaración</div>
    <p class="muted" style="margin-top:24px;">Documento no válido como factura.</p>
    <button onclick="window.print()">Imprimir o guardar PDF</button>
  </body></html>`;
}

/** Resumen de cuenta corriente para enviar al cliente. */
export function htmlResumen(estudio, empresa, cc) {
  const s = cc.length ? cc[cc.length - 1].saldo : 0;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen de cuenta ${esc(empresa.razon_social)}</title><style>${estilosDoc}</style></head><body>
    <h1>${esc(estudio?.razon_social || 'Estudio contable')}</h1>
    <div class="muted">Resumen de cuenta de honorarios al ${fmtDate(iso(new Date()))}</div>
    <p style="margin-top:16px;"><strong>${esc(empresa.razon_social)}</strong> · CUIT ${esc(empresa.cuit)}</p>
    <table><thead><tr><th>Fecha</th><th>Concepto</th><th class="r">Debe</th><th class="r">Haber</th><th class="r">Saldo</th></tr></thead><tbody>
    ${cc.map((x) => `<tr><td>${fmtDate(x.fecha)}</td><td>${esc(x.concepto)}${x.recibo ? ` (Recibo ${x.recibo})` : ''}</td>
      <td class="r">${x.tipo === 'cargo' ? fmt(Number(x.importe)) : ''}</td><td class="r">${x.tipo !== 'cargo' ? fmt(Number(x.importe)) : ''}</td><td class="r">${fmt(x.saldo)}</td></tr>`).join('')}
    </tbody></table>
    <p style="margin-top:16px;font-size:15px;"><strong>${s >= 0 ? 'Saldo a pagar' : 'Saldo a favor'}: $ ${fmt(Math.abs(s))}</strong></p>
    <button onclick="window.print()">Imprimir o guardar PDF</button>
  </body></html>`;
}
