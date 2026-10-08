/* -------------------------------------------------------------
   Representacion impresa de comprobantes electronicos con el codigo QR que
   exige ARCA (RG 4892): https://www.afip.gob.ar/fe/qr/?p=<JSON en base64>
   ------------------------------------------------------------- */
import qrcode from 'qrcode-generator';
import { sanitizeInput as esc } from '../utils.js';

export const CODIGOS_TIPO = { 'Factura A': 1, 'Factura B': 6, 'Factura C': 11, 'Nota de Crédito A': 3, 'Nota de Crédito B': 8, 'Nota de Crédito C': 13 };

const base64Utf8 = (s) => (typeof btoa === 'function'
  ? btoa(unescape(encodeURIComponent(s)))
  : Buffer.from(s, 'utf8').toString('base64'));

/** URL del QR. c: { fecha, cuitEmisor, ptoVta, tipoCmp, nroCmp, importe, docTipo, docNro, cae } */
export function urlQR(c) {
  const datos = {
    ver: 1,
    fecha: String(c.fecha).slice(0, 10),
    cuit: Number(String(c.cuitEmisor).replace(/\D/g, '')),
    ptoVta: Number(c.ptoVta),
    tipoCmp: Number(c.tipoCmp),
    nroCmp: Number(c.nroCmp),
    importe: Math.round(Number(c.importe) * 100) / 100,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: Number(c.docTipo),
    nroDocRec: Number(String(c.docNro || '0').replace(/\D/g, '') || 0),
    tipoCodAut: 'E',
    codAut: Number(c.cae)
  };
  return `https://www.afip.gob.ar/fe/qr/?p=${base64Utf8(JSON.stringify(datos))}`;
}

export function qrSvg(texto) {
  const qr = qrcode(0, 'M');
  qr.addData(texto);
  qr.make();
  return qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true });
}

const pesos = (n) => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fechaAr = (iso) => String(iso || '').slice(0, 10).split('-').reverse().join('/');

/**
 * HTML completo (documento) listo para imprimir.
 * emisor: { razon_social, cuit, condicion_iva, domicilio, iibb, inicio_actividades }
 * cbte:   { tipo, numero 'PPPPP-NNNNNNNN', fecha, cae, caeVto, concepto, servDesde, servHasta, vtoPago,
 *           neto, iva, alicuota, total, homologacion }
 * receptor: { nombre, docTipo, docNro, condicionIva, domicilio }
 * detalle: texto del concepto facturado
 */
export function htmlComprobante({ emisor, cbte, receptor, detalle }) {
  const letra = (cbte.tipo.match(/\b([ABC])$/) || [])[1] || '';
  const codigo = CODIGOS_TIPO[cbte.tipo];
  const [pv, nro] = String(cbte.numero).split('-');
  const esC = letra === 'C';
  const docLabel = { 80: 'CUIT', 96: 'DNI', 99: 'Consumidor Final' }[Number(receptor.docTipo)] || 'Doc.';
  const qr = urlQR({ fecha: cbte.fecha, cuitEmisor: emisor.cuit, ptoVta: pv, tipoCmp: codigo, nroCmp: nro, importe: cbte.total,
    docTipo: receptor.docTipo, docNro: receptor.docNro, cae: cbte.cae });
  const filasImportes = esC
    ? `<tr><td>Importe total</td><td class="r"><b>${pesos(cbte.total)}</b></td></tr>`
    : `<tr><td>Importe neto gravado</td><td class="r">${pesos(cbte.neto)}</td></tr>
       <tr><td>IVA ${esc(String(cbte.alicuota).replace('.', ','))}%</td><td class="r">${pesos(cbte.iva)}</td></tr>
       <tr><td><b>Importe total</b></td><td class="r"><b>${pesos(cbte.total)}</b></td></tr>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(cbte.tipo)} ${esc(cbte.numero)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;margin:24px;}
  .box{border:1px solid #111;padding:10px;} .grid{display:grid;grid-template-columns:1fr 70px 1fr;}
  .letra{border:1px solid #111;text-align:center;font-size:30px;font-weight:bold;height:56px;line-height:44px;}
  .letra small{display:block;font-size:9px;line-height:10px;} h1{font-size:16px;margin:0 0 6px;} p{margin:2px 0;}
  table{width:100%;border-collapse:collapse;margin-top:8px;} td,th{border:1px solid #999;padding:5px;text-align:left;} .r{text-align:right;}
  .pie{display:flex;gap:16px;align-items:center;margin-top:12px;} .pie svg{width:120px;height:120px;}
  .homo{background:#fef3c7;border:1px solid #f59e0b;padding:6px;text-align:center;font-weight:bold;margin-bottom:8px;}
  @media print{.noprint{display:none;} body{margin:8mm;}}
</style></head><body>
${cbte.homologacion ? '<div class="homo">COMPROBANTE DE PRUEBA (HOMOLOGACIÓN) — SIN VALIDEZ FISCAL</div>' : ''}
<div class="box grid">
  <div><h1>${esc(emisor.razon_social)}</h1>
    <p>${esc(emisor.domicilio || 'Domicilio: completar en Mis Clientes')}</p>
    <p>Condición frente al IVA: <b>${esc(emisor.condicion_iva)}</b></p></div>
  <div class="letra">${esc(letra)}<small>COD. ${String(codigo).padStart(3, '0')}</small></div>
  <div style="padding-left:12px;"><h1>${esc(cbte.tipo.replace(/ [ABC]$/, '').toUpperCase())}</h1>
    <p>Punto de venta: <b>${esc(pv)}</b> &nbsp; Comp. Nro: <b>${esc(nro)}</b></p>
    <p>Fecha de emisión: <b>${fechaAr(cbte.fecha)}</b></p>
    <p>CUIT: ${esc(emisor.cuit)} · IIBB: ${esc(emisor.iibb || '—')}</p>
    <p>Inicio de actividades: ${fechaAr(emisor.inicio_actividades)}</p></div>
</div>
${cbte.concepto !== 1 && cbte.servDesde ? `<div class="box" style="border-top:0;">Período facturado: ${fechaAr(cbte.servDesde)} al ${fechaAr(cbte.servHasta)} · Vto. de pago: ${fechaAr(cbte.vtoPago)}</div>` : ''}
<div class="box" style="border-top:0;">
  <p>${docLabel}${Number(receptor.docTipo) !== 99 ? ': <b>' + esc(receptor.docNro) + '</b>' : ''} · Apellido y nombre / Razón social: <b>${esc(receptor.nombre || 'Consumidor Final')}</b></p>
  <p>Condición frente al IVA: ${esc(receptor.condicionIva || 'Consumidor Final')}${receptor.domicilio ? ' · Domicilio: ' + esc(receptor.domicilio) : ''}</p>
</div>
<table><thead><tr><th>Detalle</th><th class="r">Subtotal</th></tr></thead>
<tbody><tr><td>${esc(detalle || 'Según detalle')}</td><td class="r">${pesos(esC ? cbte.total : cbte.neto)}</td></tr></tbody></table>
<table style="width:50%;margin-left:50%;">${filasImportes}</table>
<div class="pie">${qrSvg(qr)}<div><p>CAE N°: <b>${esc(cbte.cae)}</b></p><p>Fecha de vto. de CAE: <b>${fechaAr(cbte.caeVto)}</b></p>
<p style="font-size:10px;color:#555;">Comprobante autorizado por ARCA. Verificá el código QR en afip.gob.ar/fe/qr</p></div></div>
<p class="noprint" style="margin-top:16px;"><button onclick="window.print()">Imprimir / Guardar PDF</button></p>
</body></html>`;
}

/** Abre el comprobante en una ventana nueva lista para imprimir. */
export function abrirComprobante(datos) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.open();
  w.document.write(htmlComprobante(datos));
  w.document.close();
  return true;
}
