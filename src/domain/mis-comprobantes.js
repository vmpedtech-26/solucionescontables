/* -------------------------------------------------------------
   Lectura de los archivos de "Mis Comprobantes" de ARCA (emitidos y
   recibidos), en CSV o TXT con separador ; , o tabulacion.

   Reconoce el formato clasico (Imp. Neto Gravado / IVA / Imp. Total) y el
   formato con columnas por alicuota (Neto Grav. IVA 21%, IVA 21%, ...).
   No inventa IVA: si el archivo no lo trae, lo informa como aviso.
   ------------------------------------------------------------- */

const norm = (t) => String(t ?? '')
  .replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\s+/g, ' ');

/** Separa una linea respetando comillas (un ; dentro de "..." no corta). */
export function separarCampos(linea, sep) {
  const out = [];
  let cur = '';
  let comillas = false;
  for (let i = 0; i < linea.length; i++) {
    const ch = linea[i];
    if (ch === '"') {
      if (comillas && linea[i + 1] === '"') { cur += '"'; i++; } else comillas = !comillas;
    } else if (ch === sep && !comillas) {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

/** "1.234,56" | "1234,56" | "1234.56" | "$ -1.234" -> numero */
export function parseMonto(v) {
  let s = String(v ?? '').replace(/^["']|["']$/g, '').trim();
  if (!s) return 0;
  const neg = /-/.test(s) || /^\(.*\)$/.test(s);
  s = s.replace(/[^0-9,.]/g, '');
  // Un solo punto seguido de exactamente 3 digitos es separador de miles (1.500)
  if (!s.includes(',') && /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace('.', '');
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  } else if ((s.match(/\./g) || []).length > 1) {
    s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round((neg ? -n : n) * 100) / 100;
}

const TIPOS = {
  1: 'Factura A', 2: 'Nota de Débito A', 3: 'Nota de Crédito A', 4: 'Recibo A',
  6: 'Factura B', 7: 'Nota de Débito B', 8: 'Nota de Crédito B', 9: 'Recibo B',
  11: 'Factura C', 12: 'Nota de Débito C', 13: 'Nota de Crédito C', 15: 'Recibo C',
  19: 'Factura E', 20: 'Nota de Débito E', 21: 'Nota de Crédito E',
  51: 'Factura M', 52: 'Nota de Débito M', 53: 'Nota de Crédito M',
  201: 'Factura de Crédito Electrónica A', 206: 'Factura de Crédito Electrónica B', 211: 'Factura de Crédito Electrónica C'
};

/** "1 - Factura A" | "1" | "Factura A" -> "Factura A" */
export function normalizarTipo(v) {
  const t = String(v ?? '').replace(/^["']|["']$/g, '').trim();
  const m = t.match(/^(\d{1,3})(?:\s*-\s*(.*))?$/);
  if (m) return m[2]?.trim() || TIPOS[Number(m[1])] || t;
  return t || 'Factura A';
}

/** Ubica las columnas por prioridad. Devuelve indices (o arrays para sumar). */
export function detectarColumnas(encabezados) {
  const c = encabezados.map(norm);
  const primero = (...regs) => {
    for (const r of regs) { const i = c.findIndex((x) => r.test(x)); if (i !== -1) return i; }
    return -1;
  };
  const todos = (r) => c.map((x, i) => (r.test(x) ? i : -1)).filter((i) => i !== -1);

  const netoPorAlicuota = todos(/^neto grav(\.|ado)? (iva )?\d/);
  const ivaPorAlicuota = todos(/^iva \d/);
  return {
    fecha: primero(/^fecha( de emision)?$/, /^fecha/),
    tipo: primero(/^tipo( de)? comprobante$/, /^tipo$/, /^tipo(?!.*(cambio|doc))/),
    pv: primero(/punto de venta/, /^pto\.? ?(de )?vta/, /^p\.? ?v\.?$/),
    numero: primero(/^(numero|nro\.?) desde$/, /^(numero|nro\.?)( de)? comprobante$/, /^numero$/),
    docNro: primero(/^(nro\.?|numero) doc/, /^cuit/, /c\.?u\.?i\.?t/),
    denominacion: primero(/^denominacion/, /razon social/, /^nombre/),
    moneda: primero(/^moneda/),
    tipoCambio: primero(/^tipo( de)? cambio/),
    netoGravado: primero(/^(imp\.? )?neto gravado total$/, /^(imp\.? )?neto gravado$/, /^neto grav\.?$/),
    netoPorAlicuota,
    iva: primero(/^total iva$/, /^(imp\.? )?iva$/),
    ivaPorAlicuota,
    total: primero(/^(imp\.? )?total$/, /^importe total$/),
    exentas: primero(/^(imp\.? )?(op\.?|operaciones) exentas$/),
    noGravado: primero(/^(imp\.? )?neto no gravado$/),
    otrosTributos: primero(/^(imp\.? )?otros tributos$/),
    emisor: c.some((x) => /emisor|proveedor|vendedor/.test(x)),
    receptor: c.some((x) => /receptor|cliente|comprador/.test(x))
  };
}

const formatoCuit = (d) => (d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : d);

/**
 * Lee el archivo completo.
 * @returns {{ tipo: 'ventas'|'compras', registros: object[], avisos: string[] }}
 */
export function parseMisComprobantes(texto, nombreArchivo = '') {
  const lineas = String(texto ?? '').split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lineas.length) throw new Error('El archivo está vacío.');

  const iHeader = lineas.slice(0, 20).findIndex((l) => /fecha/i.test(l) && /(tipo|total|n[uú]mero|nro)/i.test(l));
  if (iHeader === -1) throw new Error('No se encontró la fila de encabezados (con la columna "Fecha"). ¿Es un archivo de Mis Comprobantes?');

  const header = lineas[iHeader];
  const cuenta = (ch) => separarCampos(header, ch).length;
  const sep = [';', '\t', ','].reduce((mejor, ch) => (cuenta(ch) > cuenta(mejor) ? ch : mejor), ';');
  const enc = separarCampos(header, sep);
  const col = detectarColumnas(enc);
  if (col.fecha === -1 || col.total === -1) throw new Error('Faltan columnas obligatorias ("Fecha" o "Imp. Total").');

  const tipo = /recibid|compra/i.test(nombreArchivo) || (col.emisor && !col.receptor) ? 'compras' : 'ventas';
  const avisos = [];
  const registros = [];
  const sumar = (campos, idxs) => idxs.reduce((s, i) => s + parseMonto(campos[i]), 0);

  for (let n = iHeader + 1; n < lineas.length; n++) {
    const campos = separarCampos(lineas[n], sep);
    if (campos.length < enc.length / 2) continue;
    const fechaRaw = campos[col.fecha] || '';
    const f = fechaRaw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/) || fechaRaw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!f) continue; // filas de totales o subtitulos
    const fecha = f[1].length === 4 ? `${f[1]}-${f[2]}-${f[3]}` : `${f[3]}-${f[2].padStart(2, '0')}-${f[1].padStart(2, '0')}`;

    const pv = col.pv !== -1 ? (campos[col.pv] || '').replace(/\D/g, '') : '';
    const nro = col.numero !== -1 ? (campos[col.numero] || '').replace(/\D/g, '') : '';
    const numero = `${(pv || '1').padStart(5, '0')}-${(nro || '0').padStart(8, '0')}`;

    const doc = col.docNro !== -1 ? (campos[col.docNro] || '').replace(/\D/g, '').replace(/^0+$/, '') : '';
    let cuit = '';
    if (doc.length === 11 || (doc.length >= 7 && doc.length <= 8)) cuit = formatoCuit(doc);
    else if (doc) avisos.push(`Fila ${n + 1}: documento "${doc}" no es CUIT ni DNI; se cargó sin identificar.`);

    let cambio = 1;
    const moneda = col.moneda !== -1 ? norm(campos[col.moneda]) : '';
    if (moneda && !/^(\$|pes|ars|peso)/.test(moneda)) {
      cambio = col.tipoCambio !== -1 ? parseMonto(campos[col.tipoCambio]) : 0;
      if (!(cambio > 0)) { avisos.push(`Fila ${n + 1}: comprobante en ${moneda.toUpperCase()} sin tipo de cambio; se omitió.`); continue; }
    }

    const total = Math.round(parseMonto(campos[col.total]) * cambio * 100) / 100;
    let neto = col.netoGravado !== -1 ? parseMonto(campos[col.netoGravado]) : sumar(campos, col.netoPorAlicuota);
    let iva = col.iva !== -1 ? parseMonto(campos[col.iva]) : sumar(campos, col.ivaPorAlicuota);
    neto = Math.round(neto * cambio * 100) / 100;
    iva = Math.round(iva * cambio * 100) / 100;

    const tipoComprobante = normalizarTipo(col.tipo !== -1 ? campos[col.tipo] : '');
    const monto = (i) => (i !== -1 ? Math.round(parseMonto(campos[i]) * cambio * 100) / 100 : 0);
    const exentas = monto(col.exentas);
    const otros = monto(col.noGravado) + monto(col.otrosTributos);
    const alicuotasUsadas = col.netoPorAlicuota.filter((i) => parseMonto(campos[i]) !== 0).length;
    if (alicuotasUsadas > 1) avisos.push(`Fila ${n + 1}: ${tipoComprobante} ${numero} tiene ${alicuotasUsadas} alícuotas de IVA; se cargó como una sola. Revisalo antes de presentar el Libro IVA.`);
    let exento = false;
    if (neto === 0 && iva === 0 && exentas !== 0) {
      // Operacion exenta: va al Libro IVA con codigo E, sin alicuota
      neto = total;
      exento = true;
    } else if (neto !== 0 && (exentas !== 0 || otros !== 0)) {
      avisos.push(`Fila ${n + 1}: ${tipoComprobante} ${numero} incluye importes exentos, no gravados u otros tributos que no se desglosan; revisalo antes de presentar el Libro IVA.`);
    }
    if (!exento && neto === 0 && iva === 0 && total !== 0) {
      // Sin desglose (por ejemplo Factura C o B recibida): no se inventa IVA
      neto = total;
      if (!/\bC$|\bC\b/.test(tipoComprobante)) avisos.push(`Fila ${n + 1}: ${tipoComprobante} ${numero} sin IVA discriminado; se cargó el total como neto.`);
    }

    const registro = {
      fecha, tipo_comprobante: tipoComprobante, numero, cuit,
      neto: Math.abs(neto), iva: Math.abs(iva), total: Math.abs(total),
      es_activo: false, categoria: tipo === 'ventas' ? 'Venta' : 'General'
    };
    if (exento) registro.exento = true;
    const nombre = col.denominacion !== -1 ? campos[col.denominacion] : '';
    if (tipo === 'ventas') registro.cliente = nombre || (cuit ? '' : 'Consumidor Final');
    else registro.proveedor = nombre || 'Proveedor sin nombre';
    registros.push(registro);
  }
  if (!registros.length) throw new Error('No se encontraron comprobantes en el archivo.');
  return { tipo, registros, avisos };
}
