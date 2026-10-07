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

/** Codigo de tipo de comprobante ARCA (3 digitos) a partir del texto de la app. */
export function codigoComprobante(tipo) {
  const t = String(tipo || '').toLowerCase();
  if (t.includes('liq. primaria') || t.includes('liquidación primaria')) return '033';
  const familia = /nota de d[eé]bito/.test(t) ? 'D' : /nota de cr[eé]dito/.test(t) ? 'C' : 'F';
  const letra = (/(?:factura|nota de d[eé]bito|nota de cr[eé]dito)\s+([abcem])\b/.exec(t) || [])[1];
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

/** Ventas - Comprobantes (266 caracteres por registro). */
export function ventasComprobantes(ventas) {
  return ventas.map((v) => {
    const { pv, nro } = partesNumero(v.numero);
    const id = identificacion(v.cuit);
    const exento = esExento(v) && sinIva(v);
    const conAlicuota = !exento;
    return [
      fechaCompacta(v.fecha), codigoComprobante(v.tipo_comprobante), pv, nro, nro,
      id.tipo, id.id, txt(v.cliente || (id.tipo === '99' ? 'CONSUMIDOR FINAL' : ''), 30),
      num(v.total, 15),
      zeros(15),                       // no integran el neto gravado
      zeros(15),                       // percepcion a no categorizados
      exento ? num(v.total, 15) : zeros(15), // exentas
      zeros(15), zeros(15), zeros(15), zeros(15), // percep. nac., IIBB, municipales, internos
      'PES', '0001000000',
      conAlicuota ? '1' : '0',
      exento ? 'E' : '0',
      zeros(15),                       // otros tributos
      zeros(8)                         // vencimiento de pago
    ].join('') + CRLF;
  }).join('');
}

/** Ventas - Alicuotas (62 caracteres por registro). Las operaciones exentas no llevan alicuota. */
export function ventasAlicuotas(ventas) {
  return ventas.filter((v) => !(esExento(v) && sinIva(v))).map((v) => {
    const { pv, nro } = partesNumero(v.numero);
    return [codigoComprobante(v.tipo_comprobante), pv, nro, num(v.neto, 15), codigoAlicuota(v.neto, v.iva), num(v.iva, 15)].join('') + CRLF;
  }).join('');
}

/** Compras - Comprobantes (325 caracteres por registro). */
export function comprasComprobantes(compras) {
  return compras.map((c) => {
    const { pv, nro } = partesNumero(c.numero);
    const id = identificacion(c.cuit);
    const conIva = c.iva > 0;
    return [
      fechaCompacta(c.fecha), codigoComprobante(c.tipo_comprobante), pv, nro,
      ' '.repeat(16),                  // despacho de importacion
      id.tipo, id.id, txt(c.proveedor, 30),
      num(c.total, 15),
      conIva ? zeros(15) : num(c.total, 15), // no integran el neto gravado
      zeros(15),                       // exentas
      zeros(15), zeros(15), zeros(15), zeros(15), zeros(15), // percep. IVA, nac., IIBB, municipales, internos
      'PES', '0001000000',
      conIva ? '1' : '0',
      conIva ? '0' : 'N',
      num(c.iva, 15),                  // credito fiscal computable
      zeros(15),                       // otros tributos
      zeros(11), ' '.repeat(30), zeros(15) // CUIT emisor/corredor, denominacion, IVA comision
    ].join('') + CRLF;
  }).join('');
}

/** Compras - Alicuotas (84 caracteres por registro). */
export function comprasAlicuotas(compras) {
  return compras.filter((c) => c.iva > 0).map((c) => {
    const { pv, nro } = partesNumero(c.numero);
    const id = identificacion(c.cuit);
    return [codigoComprobante(c.tipo_comprobante), pv, nro, id.tipo, id.id, num(c.neto, 15), codigoAlicuota(c.neto, c.iva), num(c.iva, 15)].join('') + CRLF;
  }).join('');
}
