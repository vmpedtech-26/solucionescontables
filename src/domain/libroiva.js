/* -------------------------------------------------------------
   Libro IVA Digital (RG 4597): archivos de ancho fijo de ventas y compras.
   Longitudes de registro: ventas comprobantes 266, ventas alicuotas 62,
   compras comprobantes 325, compras alicuotas 84. Montos en centavos sin
   separador; las notas de credito se informan con importes positivos.
   El resultado debe validarse con el importador de ARCA antes de presentar.
   ------------------------------------------------------------- */

const CRLF = '\r\n';

const num = (v, len) => String(Math.round(Math.abs(Number(v) || 0) * 100)).padStart(len, '0').slice(-len);
const zeros = (len) => '0'.repeat(len);
const txt = (s, len) => String(s ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\x20-\x7E]/g, ' ')
  .toUpperCase().padEnd(len, ' ').slice(0, len);

const FAMILIAS = {
  A: { F: '001', D: '002', C: '003' },
  B: { F: '006', D: '007', C: '008' },
  C: { F: '011', D: '012', C: '013' },
  E: { F: '019', D: '020', C: '021' },
  M: { F: '051', D: '052', C: '053' }
};

const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

// Codigos explicitos (tabla de comprobantes de ARCA) para los tipos que no siguen
// el patron Factura/Nota de Debito/Nota de Credito + letra.
const CODIGOS_EXPLICITOS = {
  'recibo a': '004', 'recibo b': '009', 'recibo c': '015', 'recibo m': '054',
  'factura de credito electronica a': '201', 'nota de debito electronica a': '202', 'nota de credito electronica a': '203',
  'factura de credito electronica b': '206', 'nota de debito electronica b': '207', 'nota de credito electronica b': '208',
  'factura de credito electronica c': '211', 'nota de debito electronica c': '212', 'nota de credito electronica c': '213',
  'tique factura a': '081', 'tique factura b': '082', 'tique': '083', 'tique factura c': '111'
};

/** Codigo de tipo de comprobante ARCA (3 digitos) a partir del texto de la app. */
export function codigoComprobante(tipo) {
  const t = norm(tipo);
  const numerico = /^(\d{1,3})(?:\s*-|$)/.exec(t); // "201 - Factura de Credito..." o "11"
  if (numerico) return numerico[1].padStart(3, '0');
  if (CODIGOS_EXPLICITOS[t]) return CODIGOS_EXPLICITOS[t];
  if (t.includes('liq. primaria') || t.includes('liquidacion primaria')) return '033';
  const familia = /nota de debito/.test(t) ? 'D' : /nota de credito/.test(t) ? 'C' : 'F';
  const letra = (/(?:factura|nota de debito|nota de credito)\s+([abcem])\b/.exec(t) || [])[1];
  return (FAMILIAS[(letra || 'a').toUpperCase()] || FAMILIAS.A)[familia];
}

/** Codigo de alicuota (4 digitos) segun la relacion IVA/neto. */
export function codigoAlicuota(neto, iva) {
  if (!(iva > 0) || !(neto > 0)) return '0003';
  const r = iva / neto;
  const tabla = [[0.105, '0004'], [0.21, '0005'], [0.27, '0006'], [0.05, '0008'], [0.025, '0009']];
  let mejor = tabla[1];
  for (const t of tabla) if (Math.abs(r - t[0]) < Math.abs(r - mejor[0])) mejor = t;
  return mejor[1];
}

function partesNumero(numero) {
  const [pv = '0', nro = '0'] = String(numero || '').split('-');
  return { pv: pv.replace(/\D/g, '').padStart(5, '0').slice(-5), nro: nro.replace(/\D/g, '').padStart(20, '0').slice(-20) };
}

function identificacion(cuit) {
  const d = String(cuit || '').replace(/\D/g, '');
  if (d.length === 11 && !/^0+$/.test(d)) return { tipo: '80', id: d.padStart(20, '0') };
  if (d.length >= 7 && d.length <= 8 && !/^0+$/.test(d)) return { tipo: '96', id: d.padStart(20, '0') };
  return { tipo: '99', id: zeros(20) };
}

const fechaCompacta = (f) => String(f || '').slice(0, 10).replace(/-/g, '');
const esExento = (t) => t.exento === true;
const sinIva = (t) => !(t.iva > 0);
const CODIGO_POR_TASA = { 0: '0003', 10.5: '0004', 21: '0005', 27: '0006', 5: '0008', 2.5: '0009' };

/**
 * Renglones de alicuota del comprobante: los guardados (varias alicuotas) o
 * uno solo deducido de neto/IVA. Las operaciones exentas no llevan alicuota.
 */
export function alicuotasDe(t) {
  if (Array.isArray(t.alicuotas) && t.alicuotas.length) {
    return t.alicuotas
      .filter((a) => Number(a.neto) !== 0 || Number(a.iva) !== 0)
      .map((a) => ({ neto: Number(a.neto) || 0, iva: Number(a.iva) || 0, codigo: CODIGO_POR_TASA[Number(a.alicuota)] || codigoAlicuota(a.neto, a.iva) }));
  }
  if (esExento(t) && sinIva(t)) return [];
  return [{ neto: t.neto, iva: t.iva, codigo: codigoAlicuota(t.neto, t.iva) }];
}

/** Ventas - Comprobantes (266 caracteres por registro). */
export function ventasComprobantes(ventas) {
  return ventas.map((v) => {
    const { pv, nro } = partesNumero(v.numero);
    const id = identificacion(v.cuit);
    const alics = alicuotasDe(v);
    const soloExento = alics.length === 0;
    const exentas = soloExento ? (Number(v.importe_exento) || v.total) : (Number(v.importe_exento) || 0);
    return [
      fechaCompacta(v.fecha), codigoComprobante(v.tipo_comprobante), pv, nro, nro,
      id.tipo, id.id, txt(v.cliente || (id.tipo === '99' ? 'CONSUMIDOR FINAL' : ''), 30),
      num(v.total, 15),
      num(v.importe_no_gravado, 15),   // no integran el neto gravado
      zeros(15),                       // percepcion a no categorizados
      num(exentas, 15),                // exentas
      zeros(15), zeros(15), zeros(15), zeros(15), // percep. nac., IIBB, municipales, internos
      'PES', '0001000000',
      String(alics.length),
      soloExento ? 'E' : '0',
      num(v.otros_tributos, 15),       // otros tributos
      zeros(8)                         // vencimiento de pago
    ].join('') + CRLF;
  }).join('');
}

/** Ventas - Alicuotas (62 caracteres por registro): uno por alicuota. */
export function ventasAlicuotas(ventas) {
  return ventas.flatMap((v) => {
    const { pv, nro } = partesNumero(v.numero);
    return alicuotasDe(v).map((a) => [codigoComprobante(v.tipo_comprobante), pv, nro, num(a.neto, 15), a.codigo, num(a.iva, 15)].join('') + CRLF);
  }).join('');
}

/** Compras - Comprobantes (325 caracteres por registro). */
export function comprasComprobantes(compras) {
  return compras.map((c) => {
    const { pv, nro } = partesNumero(c.numero);
    const id = identificacion(c.cuit);
    const conIva = c.iva > 0;
    const alics = conIva ? alicuotasDe(c) : [];
    const noGravado = conIva ? (Number(c.importe_no_gravado) || 0) : c.total;
    return [
      fechaCompacta(c.fecha), codigoComprobante(c.tipo_comprobante), pv, nro,
      ' '.repeat(16),                  // despacho de importacion
      id.tipo, id.id, txt(c.proveedor, 30),
      num(c.total, 15),
      num(noGravado, 15),              // no integran el neto gravado
      num(c.importe_exento, 15),       // exentas
      zeros(15), zeros(15), zeros(15), zeros(15), zeros(15), // percep. IVA, nac., IIBB, municipales, internos
      'PES', '0001000000',
      String(alics.length),
      conIva ? '0' : 'N',
      num(c.iva, 15),                  // credito fiscal computable
      num(c.otros_tributos, 15),       // otros tributos
      zeros(11), ' '.repeat(30), zeros(15) // CUIT emisor/corredor, denominacion, IVA comision
    ].join('') + CRLF;
  }).join('');
}

/** Compras - Alicuotas (84 caracteres por registro): uno por alicuota. */
export function comprasAlicuotas(compras) {
  return compras.filter((c) => c.iva > 0).flatMap((c) => {
    const { pv, nro } = partesNumero(c.numero);
    const id = identificacion(c.cuit);
    return alicuotasDe(c).map((a) => [codigoComprobante(c.tipo_comprobante), pv, nro, id.tipo, id.id, num(a.neto, 15), a.codigo, num(a.iva, 15)].join('') + CRLF);
  }).join('');
}
