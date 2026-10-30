/* -------------------------------------------------------------
   Honorarios del estudio: abonos, cuenta corriente y antiguedad.
   Movimientos: cargo (el cliente debe), cobro y bonificacion (bajan
   la deuda). Importes siempre positivos; el signo lo da el tipo.
   ------------------------------------------------------------- */

export const TIPOS_MOV = { cargo: 'Cargo', cobro: 'Cobro', bonificacion: 'Bonificación' };
export const MEDIOS = { transferencia: 'Transferencia', efectivo: 'Efectivo', cheque: 'Cheque', echeq: 'eCheq', tarjeta: 'Tarjeta', otro: 'Otro' };

const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const signoMov = (m) => (m.tipo === 'cargo' ? 1 : -1);

const ordenar = (movs) => [...movs].sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.created_at || '').localeCompare(b.created_at || ''));

/** Saldo a cobrar (positivo = el cliente debe; negativo = saldo a favor del cliente). */
export const saldo = (movs) => r2(movs.reduce((s, m) => s + signoMov(m) * Number(m.importe || 0), 0));

/** Cuenta corriente con saldo acumulado, en orden de fecha. */
export function cuentaCorriente(movs) {
  let acum = 0;
  return ordenar(movs).map((m) => { acum = r2(acum + signoMov(m) * Number(m.importe || 0)); return { ...m, saldo: acum }; });
}

const dias = (desde, hasta) => Math.floor((Date.parse(hasta) - Date.parse(desde)) / 864e5);

/**
 * Cargos impagos aplicando cobros y bonificaciones a la deuda mas vieja
 * (FIFO). Devuelve cada cargo con lo que falta cobrar.
 */
export function cargosImpagos(movs) {
  const lista = ordenar(movs);
  let credito = lista.filter((m) => m.tipo !== 'cargo').reduce((s, m) => s + Number(m.importe || 0), 0);
  const impagos = [];
  for (const c of lista.filter((m) => m.tipo === 'cargo')) {
    const aplicado = Math.min(credito, Number(c.importe));
    credito = r2(credito - aplicado);
    const pendiente = r2(Number(c.importe) - aplicado);
    if (pendiente > 0) impagos.push({ ...c, pendiente });
  }
  return impagos;
}

/** Deuda por antiguedad: 0-30, 31-60, 61-90 y mas de 90 dias desde el cargo. */
export function antiguedad(movs, hoy) {
  const t = { d30: 0, d60: 0, d90: 0, mas90: 0 };
  for (const c of cargosImpagos(movs)) {
    const d = dias(c.vence || c.fecha, hoy);
    const k = d <= 30 ? 'd30' : d <= 60 ? 'd60' : d <= 90 ? 'd90' : 'mas90';
    t[k] = r2(t[k] + c.pendiente);
  }
  return t;
}

/** Dias de la deuda mas vieja sin cobrar (0 si no debe nada). */
export function diasDeuda(movs, hoy) {
  const [primero] = cargosImpagos(movs);
  return primero ? Math.max(0, dias(primero.vence || primero.fecha, hoy)) : 0;
}

/**
 * Cargos del abono que faltan generar para un periodo AAAA-MM. Idempotente:
 * no repite un abono ya cargado ese mes.
 */
export function abonosPendientes(abonos, movs, periodo) {
  const ya = new Set(movs.filter((m) => m.tipo === 'cargo' && m.origen === 'abono' && m.periodo === periodo).map((m) => m.empresa_id));
  const [y, mm] = periodo.split('-').map(Number);
  const ultimo = new Date(y, mm, 0).getDate();
  const pad = (n) => String(n).padStart(2, '0');
  return abonos.filter((a) => a.activo !== false && Number(a.importe) > 0 && !ya.has(a.empresa_id)).map((a) => ({
    empresa_id: a.empresa_id, tipo: 'cargo', origen: 'abono', periodo,
    fecha: `${periodo}-01`,
    vence: `${periodo}-${pad(Math.min(Math.max(Number(a.dia_vencimiento) || 10, 1), ultimo))}`,
    concepto: `${a.concepto || 'Honorarios profesionales'} · ${periodo.slice(5)}/${periodo.slice(0, 4)}`,
    importe: r2(a.importe)
  }));
}

/** Nuevo importe de un abono tras un aumento porcentual, redondeado a pesos. */
export const aumentar = (importe, porcentaje) => Math.round(Number(importe) * (1 + Number(porcentaje) / 100));

/** Totales del mes: lo cargado, lo cobrado y lo bonificado en el periodo AAAA-MM. */
export function resumenMes(movs, periodo) {
  const delMes = movs.filter((m) => (m.fecha || '').startsWith(periodo));
  const suma = (tipo) => r2(delMes.filter((m) => m.tipo === tipo).reduce((s, m) => s + Number(m.importe || 0), 0));
  return { cargado: suma('cargo'), cobrado: suma('cobro'), bonificado: suma('bonificacion') };
}

/** Proximo numero de recibo del estudio. */
export const proximoRecibo = (movs) => movs.reduce((max, m) => Math.max(max, Number(m.recibo) || 0), 0) + 1;

/** Valida un movimiento antes de guardarlo. Devuelve el error o null. */
export function validarMovimiento(m) {
  if (!TIPOS_MOV[m.tipo]) return 'Tipo de movimiento inválido.';
  if (!m.empresa_id) return 'Elegí el cliente.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.fecha || '')) return 'Fecha inválida.';
  if (!(Number(m.importe) > 0)) return 'El importe tiene que ser mayor a cero.';
  if (Number(m.importe) > 1e11) return 'El importe es demasiado grande.';
  if (m.tipo === 'cobro' && m.medio && !MEDIOS[m.medio]) return 'Medio de pago inválido.';
  if (!String(m.concepto || '').trim()) return 'Escribí un concepto.';
  return null;
}

/** Importe escrito a mano: "150.000,50", "150000.5" o "150000" → numero. */
export function parseImporte(texto) {
  let s = String(texto ?? '').trim().replace(/[$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN;
}
