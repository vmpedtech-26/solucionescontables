/* -------------------------------------------------------------
   Migrador: lee planillas exportadas de Tango, Bejerman, Holistor o
   Excel (guardadas como CSV), detecta las columnas y convierte cada
   fila en una empresa o un comprobante del sistema, con validacion.
   ------------------------------------------------------------- */
import { separarCampos, parseMonto, normalizarTipo } from './mis-comprobantes.js';
import { validarCUIT } from '../utils.js';

const norm = (t) => String(t ?? '').replace(/^﻿/, '').replace(/^["']|["']$/g, '').trim().toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();

export const CAMPOS = {
  empresas: [
    { id: 'razon_social', nombre: 'Razón social', requerido: true, sinonimos: [/^razon social/, /^denominacion/, /^nombre( y apellido)?$/, /^cliente$/, /^empresa$/, /^apellido y nombre/] },
    { id: 'cuit', nombre: 'CUIT', requerido: true, sinonimos: [/^c ?u ?i ?t/, /^nro doc/, /^numero de doc/, /^documento$/] },
    { id: 'condicion_iva', nombre: 'Condición frente al IVA', requerido: false, sinonimos: [/condicion.*iva/, /^cond iva/, /^situacion.*iva/, /^categoria iva/, /^iva$/, /^tipo de responsable/] },
    { id: 'categoria', nombre: 'Categoría de monotributo', requerido: false, sinonimos: [/^categoria( monotributo)?$/, /^cat$/] },
    { id: 'tipo', nombre: 'Tipo societario', requerido: false, sinonimos: [/tipo societario/, /^forma juridica/, /^tipo persona/, /^tipo$/] },
    { id: 'inicio_actividades', nombre: 'Inicio de actividades', requerido: false, sinonimos: [/inicio.*activ/, /^inicio$/, /^fecha (de )?(alta|inicio)/, /^alta$/] },
    { id: 'domicilio', nombre: 'Domicilio', requerido: false, sinonimos: [/^domicilio/, /^direccion/, /^calle/] },
    { id: 'iibb', nombre: 'Nº de Ingresos Brutos', requerido: false, sinonimos: [/ingresos brutos/, /^iibb/, /^nro ib/, /^n ?ib$/] },
    { id: 'actividad', nombre: 'Actividad', requerido: false, sinonimos: [/^actividad/, /^rubro/] }
  ],
  comprobantes: [
    { id: 'fecha', nombre: 'Fecha', requerido: true, sinonimos: [/^fecha( de)?( emision| comprobante| cbte)?$/, /^fecha/] },
    { id: 'tipo_comprobante', nombre: 'Tipo de comprobante', requerido: false, sinonimos: [/^tipo( de)? (comprobante|cbte|comp)/, /^tipo$/, /^t comp/, /^cod comp/] },
    { id: 'letra', nombre: 'Letra (A, B, C)', requerido: false, sinonimos: [/^letra$/, /^clase$/] },
    { id: 'pv', nombre: 'Punto de venta', requerido: false, sinonimos: [/punto de venta/, /^pto ?(de )?vta/, /^p ?v$/, /^sucursal$/, /^suc$/] },
    { id: 'numero', nombre: 'Número', requerido: false, sinonimos: [/^(numero|nro|n) ?(de )?(comprobante|cbte|comp)?$/, /^numero desde$/] },
    { id: 'comprobante', nombre: 'Comprobante completo (ej. A 0001-00001234)', requerido: false, sinonimos: [/^comprobante$/, /^cbte$/, /^n comprobante$/] },
    { id: 'cuit', nombre: 'CUIT del cliente / proveedor', requerido: false, sinonimos: [/^c ?u ?i ?t/, /^nro doc/, /^documento/, /^nro (de )?doc/] },
    { id: 'nombre', nombre: 'Cliente / proveedor', requerido: false, sinonimos: [/^razon social/, /^denominacion/, /^cliente$/, /^proveedor$/, /^nombre/] },
    { id: 'neto', nombre: 'Neto gravado', requerido: false, sinonimos: [/^(imp )?neto( gravado)?( total)?$/, /^gravado$/, /^subtotal$/] },
    { id: 'iva', nombre: 'IVA', requerido: false, sinonimos: [/^(total )?iva$/, /^iva (debito|credito)/, /^imp iva/, /^iva 21/] },
    { id: 'exento', nombre: 'Exento / no gravado', requerido: false, sinonimos: [/exent/, /no gravado/] },
    { id: 'total', nombre: 'Total', requerido: true, sinonimos: [/^(imp(orte)? )?total$/, /^total (comprobante|cbte)/, /^importe$/] }
  ]
};

/** Separa el archivo en encabezados y filas (separador ; , o tabulacion). */
export function leerTabla(texto) {
  const lineas = String(texto ?? '').split(/\r?\n/).filter((l) => l.trim());
  if (!lineas.length) throw new Error('El archivo está vacío.');
  const muestra = lineas.slice(0, 20);
  const sep = [';', '\t', ','].reduce((mejor, ch) => {
    const n = (s) => muestra.reduce((t, l) => t + separarCampos(l, s).length, 0);
    return n(ch) > n(mejor) ? ch : mejor;
  }, ';');
  const conocidas = Object.values(CAMPOS).flat().flatMap((c) => c.sinonimos);
  const puntaje = (l) => separarCampos(l, sep).filter((c) => conocidas.some((r) => r.test(norm(c)))).length;
  let iHeader = 0;
  muestra.forEach((l, i) => { if (puntaje(l) > puntaje(muestra[iHeader])) iHeader = i; });
  const encabezados = separarCampos(lineas[iHeader], sep).map((e) => e.replace(/^﻿/, '').replace(/^["']|["']$/g, ''));
  const filas = lineas.slice(iHeader + 1).map((l) => separarCampos(l, sep).map((c) => c.replace(/^["']|["']$/g, '')))
    .filter((f) => f.some((c) => c.trim()));
  return { encabezados, filas, separador: sep };
}

/** Propone a que columna va cada campo (indice o -1). Una columna se usa una sola vez. */
export function autoMapear(encabezados, destino) {
  const c = encabezados.map(norm);
  const usadas = new Set();
  const mapa = {};
  for (const campo of CAMPOS[destino]) {
    mapa[campo.id] = -1;
    for (const r of campo.sinonimos) {
      const i = c.findIndex((x, k) => !usadas.has(k) && r.test(x));
      if (i !== -1) { mapa[campo.id] = i; usadas.add(i); break; }
    }
  }
  return mapa;
}

const pad = (n, l) => String(n).padStart(l, '0');

/** dd/mm/aaaa, dd-mm-aa, aaaa-mm-dd o numero de serie de Excel → aaaa-mm-dd (o null). */
export function parseFecha(v) {
  const s = String(v ?? '').trim();
  let y, m, d;
  let r;
  if ((r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) [, y, m, d] = r;
  else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/))) { [, d, m, y] = r; if (y.length === 2) y = `20${y}`; }
  else if (/^\d{5}$/.test(s)) { // serie de Excel (dias desde 30/12/1899)
    const f = new Date(Date.UTC(1899, 11, 30) + Number(s) * 864e5);
    [y, m, d] = [f.getUTCFullYear(), f.getUTCMonth() + 1, f.getUTCDate()];
  } else return null;
  const f = new Date(Number(y), Number(m) - 1, Number(d));
  if (f.getFullYear() !== Number(y) || f.getMonth() !== Number(m) - 1 || f.getDate() !== Number(d)) return null;
  if (Number(y) < 1900 || Number(y) > 2100) return null;
  return `${y}-${pad(m, 2)}-${pad(d, 2)}`;
}

export const formatoCuit = (v) => {
  const d = String(v ?? '').replace(/\D/g, '');
  return d.length === 11 ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}` : d;
};

/** Texto libre de condicion de IVA → valor del sistema (o null). */
export function normalizarCondicionIva(v, categoria = '') {
  const s = norm(v);
  if (!s) return null;
  if (/monotrib|^mt$|^rm$|^m$|pequeno contribuyente/.test(s)) {
    const cat = (String(categoria).trim().toUpperCase().match(/^[A-K]$/) || s.toUpperCase().match(/\bCAT(?:EGORIA)?\.? ?([A-K])\b/) || [])[0];
    const letra = cat ? cat.slice(-1) : 'A';
    return `Monotributo - Cat ${letra}`;
  }
  if (/exent|^ex$|no alcanzad/.test(s)) return 'Exento';
  if (/inscript|^ri$|^r ?i$|responsable inscripto/.test(s)) return 'Responsable Inscripto';
  return null;
}

/** Tipo societario a partir del texto o de la razon social / CUIT. */
export function inferirTipo(tipo, razon, cuit) {
  const t = norm(tipo);
  const r = norm(razon).replace(/\s/g, '');
  if (/sucesion/.test(t) || /sucesion/.test(r)) return 'Sucesion Indivisa';
  if (/^sas$/.test(t) || /sas$/.test(r)) return 'SAS';
  if (/^srl$/.test(t) || /srl$/.test(r)) return 'SRL';
  if (/^sa$/.test(t) || /sa$/.test(r)) return 'SA';
  if (/unipersonal|persona humana|fisica/.test(t) || /^(20|23|24|27)/.test(String(cuit).replace(/\D/g, ''))) return 'Unipersonal';
  return null;
}

/** Fila → empresa. Devuelve { valor, errores, avisos }. */
export function convertirEmpresa(fila, mapa, defaults = {}) {
  const get = (k) => (mapa[k] >= 0 ? String(fila[mapa[k]] ?? '').trim() : '');
  const errores = [];
  const avisos = [];
  const razon = get('razon_social').slice(0, 200);
  if (!razon) errores.push('Falta la razón social');
  const cuit = formatoCuit(get('cuit'));
  if (!validarCUIT(cuit)) errores.push(`CUIT inválido (${get('cuit') || 'vacío'})`);
  let condicion = normalizarCondicionIva(get('condicion_iva'), get('categoria'));
  if (!condicion) {
    condicion = defaults.condicion_iva || 'Responsable Inscripto';
    if (get('condicion_iva')) avisos.push(`Condición "${get('condicion_iva')}" no reconocida: se usa ${condicion}`);
  } else if (/Cat A$/.test(condicion) && !get('categoria') && !/cat/i.test(get('condicion_iva'))) {
    avisos.push('Monotributo sin categoría: se carga A, revisala');
  }
  const tipo = inferirTipo(get('tipo'), razon, cuit) || defaults.tipo || 'SRL';
  const inicio = parseFecha(get('inicio_actividades')) || defaults.inicio_actividades || '2000-01-01';
  if (!get('inicio_actividades') && !defaults.inicio_actividades) avisos.push('Sin fecha de inicio de actividades');
  return {
    valor: { razon_social: razon, cuit, condicion_iva: condicion, tipo, inicio_actividades: inicio,
      domicilio: get('domicilio').slice(0, 200) || null, iibb: get('iibb').slice(0, 30) || null, actividad: get('actividad').slice(0, 200) },
    errores, avisos
  };
}

/** "A 0001-00001234", "FA A 0001 00001234", "0001-00001234" → { letra, pv, nro } */
export function partirComprobante(texto) {
  const s = String(texto ?? '').toUpperCase();
  const letra = (s.match(/(?:^|[^A-Z])([ABCEM])(?=[^A-Z]|$)/) || [])[1] || '';
  const nums = s.match(/\d+/g) || [];
  if (nums.length >= 2) return { letra, pv: Number(nums[nums.length - 2]), nro: Number(nums[nums.length - 1]) };
  if (nums.length === 1) return { letra, pv: 0, nro: Number(nums[0]) };
  return { letra, pv: 0, nro: 0 };
}

const ABREV = [[/^(fc|fa|fac|fact|factura)\b/, 'Factura'], [/^(nc|ncr|n ?cred|nota de credito|credito)\b/, 'Nota de Crédito'], [/^(nd|ndb|n ?deb|nota de debito|debito)\b/, 'Nota de Débito'], [/^(rc|rec|recibo)\b/, 'Recibo']];

/** Tipo de comprobante del sistema a partir del texto, codigo ARCA y letra. */
export function tipoDesde(texto, letra) {
  const t = String(texto ?? '').trim();
  if (/^\d{1,3}(\s*-.*)?$/.test(t)) return normalizarTipo(t); // codigo ARCA
  const n = norm(t);
  const l = (letra || (n.match(/\b([abcem])$/) || [])[1] || '').toUpperCase();
  for (const [r, nombre] of ABREV) if (r.test(n)) return l ? `${nombre} ${l}` : nombre;
  return t ? normalizarTipo(t) : (l ? `Factura ${l}` : 'Factura');
}

/** Fila → comprobante del Libro de IVA. Devuelve { valor, errores, avisos }. */
export function convertirComprobante(fila, mapa) {
  const get = (k) => (mapa[k] >= 0 ? String(fila[mapa[k]] ?? '').trim() : '');
  const errores = [];
  const avisos = [];
  const fecha = parseFecha(get('fecha'));
  if (!fecha) errores.push(`Fecha inválida (${get('fecha') || 'vacía'})`);

  const partes = partirComprobante(get('comprobante'));
  const letra = (get('letra') || partes.letra).toUpperCase().slice(0, 1);
  const pv = Number(get('pv').replace(/\D/g, '')) || partes.pv;
  const nro = Number(get('numero').replace(/\D/g, '')) || partes.nro;
  if (!nro) errores.push('Falta el número de comprobante');

  let tipo = tipoDesde(get('tipo_comprobante') || get('comprobante').replace(/[\d-]/g, ' ').trim(), letra);
  let total = parseMonto(get('total'));
  let neto = parseMonto(get('neto'));
  let iva = parseMonto(get('iva'));
  const exento = Math.abs(parseMonto(get('exento')));
  // Una nota de credito exportada con importes negativos
  if (total < 0 || neto < 0) {
    if (!/cr[eé]dito/i.test(tipo)) tipo = tipo.replace(/^(Factura|Comprobante)?\s*/, 'Nota de Crédito ').trim();
    total = Math.abs(total); neto = Math.abs(neto); iva = Math.abs(iva);
  }
  if (!total) errores.push('Total en cero o vacío');
  if (!get('neto') && !get('iva') && total) {
    neto = Math.round((total - exento) * 100) / 100;
    avisos.push('Sin columnas de neto e IVA: se toma el total como neto');
  }
  const r2 = (n) => Math.round(n * 100) / 100;
  if (total && Math.abs(r2(neto + iva + exento) - total) > 1) avisos.push(`Neto + IVA (${r2(neto + iva + exento)}) no coincide con el total (${total})`);

  const cuitTxt = get('cuit');
  const cuit = formatoCuit(cuitTxt);
  if (cuit.length === 13 && !validarCUIT(cuit)) avisos.push(`CUIT ${cuit} con dígito verificador inválido`);
  return {
    valor: { fecha, tipo_comprobante: tipo, numero: `${pad(pv || 1, 5)}-${pad(nro, 8)}`, cuit: cuit.replace(/[^0-9-]/g, '').slice(0, 13),
      nombre: get('nombre').slice(0, 200), neto: r2(neto), iva: r2(iva), total: r2(total), importe_exento: r2(exento), exento: exento > 0 && !neto },
    errores, avisos
  };
}

/** Clave para no cargar dos veces el mismo comprobante. */
export const claveComprobante = (t) => `${String(t.cuit || '').replace(/\D/g, '')}|${normalizarTipo(t.tipo_comprobante)}|${t.numero}`;
