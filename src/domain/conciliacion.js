/* -------------------------------------------------------------
   Conciliacion bancaria: lee el extracto (CSV de cualquier banco),
   clasifica los movimientos impositivos y cruza creditos con ventas y
   debitos con compras por importe, fecha y CUIT.
   ------------------------------------------------------------- */
import { separarCampos, parseMonto } from './mis-comprobantes.js';
import { parseFecha } from './migrador.js';

const norm = (t) => String(t ?? '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const COLUMNAS = {
  fecha: [/^fecha( (de )?(operacion|movimiento|mov|valor))?$/, /^fecha/],
  descripcion: [/^(descripcion|concepto|detalle|movimiento|referencia)/, /leyenda/],
  debito: [/^debitos?$/, /^debe$/, /^egresos?$/, /^importe debito/, /^debito/],
  credito: [/^creditos?$/, /^haber$/, /^ingresos?$/, /^importe credito/, /^credito/],
  importe: [/^importe$/, /^monto$/, /^importe \$|^importe en pesos/, /^valor$/],
  saldo: [/^saldo/]
};

/** Lee el extracto. Acepta columnas Debito/Credito separadas o un Importe con signo. */
export function leerExtracto(texto) {
  const lineas = String(texto ?? '').split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) throw new Error('El archivo está vacío.');
  const muestra = lineas.slice(0, 30);
  const sep = [';', '\t', ','].reduce((mejor, ch) => {
    const n = (s) => muestra.reduce((t, l) => t + separarCampos(l, s).length, 0);
    return n(ch) > n(mejor) ? ch : mejor;
  }, ';');
  const iHeader = muestra.findIndex((l) => { const c = separarCampos(l, sep).map(norm); return c.some((x) => /^fecha/.test(x)) && c.some((x) => /debit|credit|importe|monto|debe|haber/.test(x)); });
  if (iHeader === -1) throw new Error('No encontramos la fila de títulos (Fecha, Débito/Crédito o Importe).');
  const enc = separarCampos(lineas[iHeader], sep).map(norm);
  const col = {};
  const usadas = new Set();
  for (const [k, regs] of Object.entries(COLUMNAS)) {
    col[k] = -1;
    for (const r of regs) { const i = enc.findIndex((x, j) => !usadas.has(j) && r.test(x)); if (i !== -1) { col[k] = i; usadas.add(i); break; } }
  }
  if (col.fecha < 0 || (col.importe < 0 && col.debito < 0 && col.credito < 0)) throw new Error('Faltan columnas: se necesita Fecha y Débito/Crédito o Importe.');

  const movimientos = [];
  lineas.slice(iHeader + 1).forEach((l, n) => {
    const c = separarCampos(l, sep).map((x) => x.replace(/^["']|["']$/g, ''));
    const fecha = parseFecha(c[col.fecha]);
    if (!fecha) return; // subtotales, saldo inicial, pie
    let importe = col.importe >= 0 ? parseMonto(c[col.importe]) : 0;
    if (col.credito >= 0 || col.debito >= 0) importe = Math.abs(parseMonto(c[col.credito])) - Math.abs(parseMonto(c[col.debito]));
    if (!importe) return;
    movimientos.push({ id: `b${n}`, fecha, descripcion: (c[col.descripcion] || '').trim(), importe: r2(importe), saldo: col.saldo >= 0 ? parseMonto(c[col.saldo]) : null });
  });
  if (!movimientos.length) throw new Error('El extracto no tiene movimientos con fecha e importe.');
  return movimientos;
}

export const CLASES = {
  ley25413: { nombre: 'Impuesto a los débitos y créditos (Ley 25.413)', ayuda: 'El 33% es pago a cuenta de Ganancias (régimen general).' },
  sircreb: { nombre: 'Retenciones de Ingresos Brutos (SIRCREB)', ayuda: 'Pago a cuenta de Ingresos Brutos.' },
  percepcion_iva: { nombre: 'Percepciones de IVA', ayuda: 'Se computan en la declaración jurada de IVA.' },
  iva_bancario: { nombre: 'IVA sobre gastos bancarios', ayuda: 'Crédito fiscal si el resumen está a nombre de un responsable inscripto.' },
  gastos: { nombre: 'Comisiones y gastos bancarios', ayuda: 'Gasto deducible.' },
  intereses: { nombre: 'Intereses', ayuda: 'Cobrados o pagados.' },
  operativo: { nombre: 'Cobros y pagos', ayuda: 'Se cruzan con ventas y compras.' }
};

const REGLAS = [
  ['ley25413', /25\.?413|imp(uesto)?\.? ?(ley|s\/|sobre)? ?(deb|cred)|deb(ito)?s? y cred|idcb|imp\.? cheque|impuesto al cheque/],
  ['sircreb', /sircreb|ret(encion)?\.? ?(de )?(iibb|ing(resos)? ?brutos)|iibb|ingresos brutos|reg(imen)? recaud/],
  ['percepcion_iva', /perc(epcion)?\.? ?(de )?iva|rg ?2408|rg ?(3337|140)/],
  ['iva_bancario', /^iva\b|\biva (21|10|basico|tasa)|i\.v\.a|iva s\/|iva sobre/],
  ['intereses', /interes/],
  ['gastos', /comision|com\.|mantenimiento|mant\.? cta|gasto|cargo (por|de)|servicio (de )?cuenta|paquete|chequera|seguro|cuota (de )?servicio/]
];

export function clasificar(mov) {
  const d = norm(mov.descripcion);
  for (const [clase, r] of REGLAS) if (r.test(d)) return clase;
  return 'operativo';
}

const dias = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const digitos = (s) => String(s || '').replace(/\D/g, '');

/**
 * Cruza movimientos operativos con comprobantes. Un credito busca una venta
 * y un debito una compra del mismo total (tolerancia $1), emitida hasta 90
 * dias antes del movimiento. Si el CUIT aparece en la descripcion, gana.
 */
export function conciliar(movimientos, ventas, compras, { tolerancia = 1, ventana = 90 } = {}) {
  const usados = new Set();
  const signo = (t) => (/nota de cr[eé]dito/i.test(t.tipo_comprobante || '') ? -1 : 1);
  const resultado = movimientos.map((m) => ({ ...m, clase: clasificar(m), match: null }));
  // Primero los que mencionan el CUIT, despues el resto; dentro, por fecha
  const candidatos = (m) => {
    const lista = m.importe > 0 ? ventas : compras;
    return lista.filter((t) => !usados.has(t.id)
      && Math.abs(signo(t) * Number(t.total) - Math.abs(m.importe)) <= tolerancia
      && dias(t.fecha, m.fecha) >= -5 && dias(t.fecha, m.fecha) <= ventana);
  };
  const operativos = resultado.filter((m) => m.clase === 'operativo').sort((a, b) => a.fecha.localeCompare(b.fecha));
  for (const pasada of ['cuit', 'importe']) {
    for (const m of operativos) {
      if (m.match) continue;
      const desc = digitos(m.descripcion);
      const opciones = candidatos(m).filter((t) => pasada === 'importe' || (digitos(t.cuit).length === 11 && desc.includes(digitos(t.cuit))));
      if (!opciones.length) continue;
      opciones.sort((a, b) => Math.abs(dias(a.fecha, m.fecha)) - Math.abs(dias(b.fecha, m.fecha)));
      m.match = { id: opciones[0].id, tipo: m.importe > 0 ? 'ventas' : 'compras', comprobante: `${opciones[0].tipo_comprobante} ${opciones[0].numero}`,
        contraparte: opciones[0].cliente || opciones[0].proveedor || '', por: pasada };
      usados.add(opciones[0].id);
    }
  }
  return resultado;
}

/** Totales por clase y lo que queda sin conciliar. */
export function resumenConciliacion(movs) {
  const porClase = {};
  for (const k of Object.keys(CLASES)) porClase[k] = 0;
  for (const m of movs) porClase[m.clase] = r2(porClase[m.clase] + -m.importe); // impuestos: debitos positivos
  const operativos = movs.filter((m) => m.clase === 'operativo');
  const creditos = operativos.filter((m) => m.importe > 0);
  const debitos = operativos.filter((m) => m.importe < 0);
  return {
    porClase,
    ley25413Computable: r2(Math.max(0, porClase.ley25413) * 0.33),
    creditos: { total: r2(creditos.reduce((s, m) => s + m.importe, 0)), conciliados: creditos.filter((m) => m.match).length, cantidad: creditos.length },
    debitos: { total: r2(debitos.reduce((s, m) => s - m.importe, 0)), conciliados: debitos.filter((m) => m.match).length, cantidad: debitos.length },
    sinConciliar: operativos.filter((m) => !m.match)
  };
}

/** Comprobantes del periodo que no aparecen en el banco (cobros o pagos pendientes). */
export function comprobantesSinMovimiento(movs, ventas, compras, desde, hasta) {
  const usados = new Set(movs.filter((m) => m.match).map((m) => m.match.id));
  const enRango = (t) => t.fecha >= desde && t.fecha <= hasta && !usados.has(t.id);
  return { ventas: ventas.filter(enRango), compras: compras.filter(enRango) };
}
