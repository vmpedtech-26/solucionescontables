/* -------------------------------------------------------------
   Vencimientos nacionales de ARCA por terminacion de CUIT.

   ARCA fija cada obligacion en un dia base del mes y escalona los
   grupos de terminacion en dias habiles consecutivos a partir de ese
   dia (si cae en fin de semana o feriado, corre al siguiente habil).
   Verificado contra el cronograma oficial de octubre 2026:
     IVA 18 → 19/20/21/22/23 · Empleadores 9 → 9/13/14 (12 feriado)
     Autonomos 5 → 5/6/7 · Anticipos 13 → 13/14/15 · Monotributo 20.
   ARCA publica el cronograma mes a mes: el estudio puede corregir una
   fecha puntual desde la agenda (queda guardada en la tarea).
   ------------------------------------------------------------- */

const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fechaLocal = (y, m, d) => new Date(y, m - 1, d, 12); // mediodia: sin saltos por horario de verano

/** Domingo de Pascua (algoritmo gregoriano anonimo). */
export function pascua(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return fechaLocal(y, mes, dia);
}

// Inamovibles (ley 27.399)
const INAMOVIBLES = ['01-01', '03-24', '04-02', '05-01', '05-25', '06-20', '07-09', '12-08', '12-25'];
// Trasladables en su fecha nominal: se usan si el año no tiene su tabla
const TRASLADABLES_NOMINAL = ['06-17', '08-17', '10-12', '11-20'];
// Fechas efectivas de trasladables y dias no laborables con fines turisticos
const POR_ANIO = {
  2026: ['03-23', '06-15', '07-10', '08-17', '10-12', '11-23', '12-07']
};

const cacheFeriados = {};
export function feriados(y) {
  if (cacheFeriados[y]) return cacheFeriados[y];
  const p = pascua(y);
  const desdePascua = (dias) => iso(new Date(p.getFullYear(), p.getMonth(), p.getDate() + dias, 12));
  const set = new Set([
    ...INAMOVIBLES.map((md) => `${y}-${md}`),
    ...(POR_ANIO[y] || TRASLADABLES_NOMINAL).map((md) => `${y}-${md}`),
    desdePascua(-48), desdePascua(-47), // Carnaval
    desdePascua(-2) // Viernes Santo
  ]);
  cacheFeriados[y] = set;
  return set;
}

export const esHabil = (d) => d.getDay() !== 0 && d.getDay() !== 6 && !feriados(d.getFullYear()).has(iso(d));

/** El dia habil n (0 = el primero) contando desde la fecha dada inclusive. */
export function habilNumero(desde, n = 0) {
  const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate(), 12);
  let vistos = -1;
  for (;;) {
    if (esHabil(d)) { vistos += 1; if (vistos === n) return d; }
    d.setDate(d.getDate() + 1);
  }
}

export const ultimoDigito = (cuit) => Number(String(cuit || '').replace(/\D/g, '').slice(-1)) || 0;
const esPersonaHumana = (e) => ['Unipersonal', 'Sucesion Indivisa'].includes(e.tipo) || /^(20|23|24|27)/.test(String(e.cuit || '').replace(/\D/g, ''));
const esMonotributo = (e) => /monotributo/i.test(e.condicion_iva || '');
const esRI = (e) => /inscripto/i.test(e.condicion_iva || '');

const mesAnterior = (y, m) => (m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`);
const G5 = [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]];
const G3 = [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9]];
const ANTICIPO_PH = { 8: 1, 10: 2, 12: 3, 2: 4, 4: 5 };

export const OBLIGACIONES = [
  {
    id: 'iva', nombre: 'IVA y Libro IVA Digital', detalle: 'Declaración jurada mensual (F.2002 / F.2051) y pago',
    porDefecto: esRI, dia: 18, grupos: G5, periodo: mesAnterior
  },
  {
    id: 'monotributo', nombre: 'Monotributo', detalle: 'Cuota mensual',
    porDefecto: esMonotributo, dia: 20, grupos: null, periodo: (y, m) => `${y}-${pad(m)}`
  },
  {
    id: 'empleadores', nombre: 'Cargas sociales (F.931)', detalle: 'Presentación y pago de la DDJJ de empleadores',
    porDefecto: () => false, dia: 9, grupos: G3, periodo: mesAnterior
  },
  {
    id: 'autonomos', nombre: 'Autónomos', detalle: 'Aporte mensual',
    porDefecto: (e) => esRI(e) && esPersonaHumana(e), dia: 5, grupos: G3, periodo: mesAnterior
  },
  {
    id: 'anticipos_ph', nombre: 'Anticipo Ganancias y Bienes Personales', detalle: 'Personas humanas: 5 anticipos (ago, oct, dic, feb, abr)',
    porDefecto: (e) => esRI(e) && esPersonaHumana(e), dia: 13, grupos: G3,
    meses: (m) => m in ANTICIPO_PH,
    periodo: (y, m) => `Anticipo ${ANTICIPO_PH[m]} · período ${m >= 8 ? y : y - 1}`
  },
  {
    id: 'anticipos_soc', nombre: 'Anticipo Ganancias sociedades', detalle: 'Anticipo mensual (desde el 6º mes posterior al cierre)',
    porDefecto: (e) => !esPersonaHumana(e) && !esMonotributo(e), dia: 13, grupos: G3,
    periodo: (y, m) => `${y}-${pad(m)}`
  }
];

const POR_ID = Object.fromEntries(OBLIGACIONES.map((o) => [o.id, o]));

/** Obligaciones de la empresa: las configuradas o, si no hay, las del perfil. */
export function obligacionesDe(empresa) {
  if (Array.isArray(empresa.obligaciones)) return empresa.obligaciones.filter((id) => POR_ID[id]);
  return OBLIGACIONES.filter((o) => o.porDefecto(empresa)).map((o) => o.id);
}

/** Fecha de vencimiento de una obligacion para un CUIT en un mes (o null si ese mes no vence). */
export function fechaVencimiento(obligacionId, cuit, y, m) {
  const o = POR_ID[obligacionId];
  if (!o || (o.meses && !o.meses(m))) return null;
  const base = fechaLocal(y, m, o.dia);
  if (!o.grupos) return iso(habilNumero(base, 0));
  const dig = ultimoDigito(cuit);
  return iso(habilNumero(base, o.grupos.findIndex((g) => g.includes(dig))));
}

export const origenVencimiento = (obligacionId, y, m) => `venc:${obligacionId}:${y}-${pad(m)}`;

/** Vencimientos del mes para una lista de empresas, ordenados por fecha. */
export function vencimientosDelMes(empresas, y, m) {
  const lista = [];
  for (const e of empresas) {
    for (const id of obligacionesDe(e)) {
      const fecha = fechaVencimiento(id, e.cuit, y, m);
      if (!fecha) continue;
      const o = POR_ID[id];
      lista.push({ empresa_id: e.id, empresa: e.razon_social, cuit: e.cuit, obligacion: id, nombre: o.nombre, detalle: o.detalle,
        periodo: o.periodo(y, m), fecha, origen: origenVencimiento(id, y, m) });
    }
  }
  return lista.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.empresa.localeCompare(b.empresa));
}

/** Siguiente fecha de una tarea recurrente (el dia se ajusta a fin de mes). */
export function siguienteFecha(fecha, recurrencia) {
  const meses = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 }[recurrencia];
  if (!meses) return null;
  const [y, m, d] = fecha.split('-').map(Number);
  const destino = new Date(y, m - 1 + meses, 1, 12);
  const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(d, ultimo));
  return iso(destino);
}

/** Calendario .ics (RFC 5545) para importar en Google Calendar / Outlook. */
export function generarICS(eventos, ahora = new Date()) {
  const escICS = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const sello = ahora.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Soluciones Contables//Agenda//ES', 'CALSCALE:GREGORIAN'];
  for (const ev of eventos) {
    const dia = ev.fecha.replace(/-/g, '');
    const fin = iso(new Date(Number(ev.fecha.slice(0, 4)), Number(ev.fecha.slice(5, 7)) - 1, Number(ev.fecha.slice(8, 10)) + 1, 12)).replace(/-/g, '');
    lineas.push('BEGIN:VEVENT', `UID:${escICS(ev.uid)}@solucionescontables.site`, `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${dia}`, `DTEND;VALUE=DATE:${fin}`, `SUMMARY:${escICS(ev.titulo)}`);
    if (ev.descripcion) lineas.push(`DESCRIPTION:${escICS(ev.descripcion)}`);
    lineas.push('END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.join('\r\n') + '\r\n';
}
