/* -------------------------------------------------------------
   Dominio fiscal: calculos puros (sin DOM, sin red, sin localStorage) para
   poder probarlos con tests. Las vistas solo los invocan y los muestran.
   ------------------------------------------------------------- */

// Tabla oficial ARCA vigente desde 1/08/2026 (topes y cuotas del Régimen Simplificado)
// Categorías I, J y K están reservadas por ley a venta de cosas muebles: un
// prestador de servicios que las supera queda directamente EXCLUIDO del régimen,
// no puede "subir" a esas categorías (por eso cuotaServicios: 0 en esas tres).
export const MONOTRIBUTO_CATEGORIAS_2026 = {
  'A': { maxIngresos: 12009410, superficie: 30, energia: 3330, alquileres: 2792886, cuotaServicios: 5586, cuotaBienes: 5586 },
  'B': { maxIngresos: 17595183, superficie: 45, energia: 5000, alquileres: 2792886, cuotaServicios: 10613, cuotaBienes: 10613 },
  'C': { maxIngresos: 24670494, superficie: 60, energia: 6700, alquileres: 3816944, cuotaServicios: 18247, cuotaBienes: 16757 },
  'D': { maxIngresos: 30628651, superficie: 85, energia: 10000, alquileres: 3816944, cuotaServicios: 29791, cuotaBienes: 27743 },
  'E': { maxIngresos: 36028231, superficie: 110, energia: 13000, alquileres: 4841003, cuotaServicios: 55858, cuotaBienes: 44314 },
  'F': { maxIngresos: 45151659, superficie: 150, energia: 16500, alquileres: 4841003, cuotaServicios: 78573, cuotaBienes: 57720 },
  'G': { maxIngresos: 53995799, superficie: 200, energia: 20000, alquileres: 5771965, cuotaServicios: 142996, cuotaBienes: 71498 },
  'H': { maxIngresos: 81924660, superficie: 200, energia: 20000, alquileres: 8378658, cuotaServicios: 409623, cuotaBienes: 204812 },
  'I': { maxIngresos: 91699762, superficie: 200, energia: 20000, alquileres: 8378658, cuotaServicios: 0, cuotaBienes: 325837 },
  'J': { maxIngresos: 105012519, superficie: 200, energia: 20000, alquileres: 8378658, cuotaServicios: 0, cuotaBienes: 391004 },
  'K': { maxIngresos: 126610839, superficie: 200, energia: 20000, alquileres: 8378658, cuotaServicios: 0, cuotaBienes: 456171 }
};

const round2 = (n) => Math.round(n * 100) / 100;

/** Suma de ventas de los ultimos 365 dias (ventana movil de 12 meses). */
export function ventasMoviles12Meses(ventas, hoy = new Date()) {
  const corte = new Date(hoy);
  corte.setDate(corte.getDate() - 365);
  return ventas.reduce((s, v) => (new Date(v.fecha) >= corte ? s + v.total : s), 0);
}

/** Letra de categoria desde "Monotributo - Cat H" (default H si no se puede leer). */
export function letraCategoria(condicionIva) {
  const m = condicionIva.match(/Cat\s+([A-K])/i);
  return m ? m[1].toUpperCase() : 'H';
}

/** Porcentaje consumido del tope de la categoria y de la exclusion (tope de la K). */
export function consumoMonotributo(ventasMoviles, letra) {
  const cat = MONOTRIBUTO_CATEGORIAS_2026[letra] || MONOTRIBUTO_CATEGORIAS_2026['H'];
  const topeExclusion = MONOTRIBUTO_CATEGORIAS_2026['K'].maxIngresos;
  return {
    topeCategoria: cat.maxIngresos,
    topeExclusion,
    percentCategory: (ventasMoviles / cat.maxIngresos) * 100,
    percentExclusion: (ventasMoviles / topeExclusion) * 100
  };
}

/**
 * Categoria sugerida: la primera (A..K) cuyos topes de ingresos, energia,
 * alquileres y superficie cubren los parametros; 'EXCLUIDO' si ninguna.
 */
export function categoriaMonotributoRecomendada({ ingresos, energia, alquileres, superficie }) {
  for (const letra of Object.keys(MONOTRIBUTO_CATEGORIAS_2026)) {
    const c = MONOTRIBUTO_CATEGORIAS_2026[letra];
    if (ingresos <= c.maxIngresos && energia <= c.energia && alquileres <= c.alquileres && superficie <= c.superficie) {
      return letra;
    }
  }
  return 'EXCLUIDO';
}

/**
 * Liquidacion de IVA para Responsable Inscripto.
 * - Credito fiscal con prorrateo por ventas exentas (Art. 13 Ley de IVA).
 * - excluirCredito(compra) permite descartar comprobantes puntuales (p. ej. el
 *   demo del sandbox); sin ese parametro se computa todo el credito.
 */
export function calcularIvaRI({ ventas, compras, retPercSaldo = 0, saldoFavor = 0, excluirCredito = null }) {
  const debFiscal = ventas.reduce((s, v) => s + v.iva, 0);
  const creditoHabilitado = compras.reduce((s, c) => (excluirCredito && excluirCredito(c) ? s : s + c.iva), 0);
  const totalNeto = ventas.reduce((s, v) => s + v.neto, 0);
  const totalExento = ventas.filter(v => v.exento).reduce((s, v) => s + v.neto, 0);
  const prorrateoGravado = totalNeto > 0 ? (1 - totalExento / totalNeto) : 1;
  const credFiscal = round2(creditoHabilitado * prorrateoGravado);
  return {
    debFiscal, creditoHabilitado, prorrateoGravado, credFiscal,
    saldoNeto: debFiscal - credFiscal - retPercSaldo - saldoFavor
  };
}

/** Cruce del debito fiscal del libro contra el calculado por actividad (CLAE). */
export function consistenciaCLAE(totalNetoVentas, actividades, debFiscal) {
  const rows = actividades.map(a => ({
    ...a,
    neto: totalNetoVentas * a.pct,
    df: totalNetoVentas * a.pct * a.alicuota / 100
  }));
  const totalActividadDF = rows.reduce((s, r) => s + r.df, 0);
  const diff = Math.abs(totalActividadDF - debFiscal);
  return { rows, totalActividadDF, diff, ok: diff < 1, exacta: diff < 0.01 };
}


// ---------------------------------------------------------------
// Retenciones y percepciones / Convenio Multilateral (IIBB)
// ---------------------------------------------------------------

/** Totales de la grilla de retenciones: total, conciliadas, cuenta puente y sin certificado. */
export function resumenRetenciones(rets) {
  return {
    total: rets.reduce((s, r) => s + r.monto, 0),
    conciliadas: rets.filter(r => r.conciliado).reduce((s, r) => s + r.monto, 0),
    puente: rets.filter(r => !r.conciliado).reduce((s, r) => s + r.monto, 0),
    sinCertificado: rets.filter(r => !r.certDisponible).reduce((s, r) => s + r.monto, 0)
  };
}

/** Coeficiente Unificado de una jurisdiccion: 50% ingresos + 50% gastos (RG CM 03/04). */
export function coeficienteUnificado(j) {
  return (j.pctIngresos + j.pctGastos) / 200;
}

/** Los porcentajes de ingresos y de gastos deben repartirse al 100% entre jurisdicciones. */
export function validarJurisdicciones(jurisdicciones) {
  const sumaIngresos = jurisdicciones.reduce((s, j) => s + j.pctIngresos, 0);
  const sumaGastos = jurisdicciones.reduce((s, j) => s + j.pctGastos, 0);
  return { sumaIngresos, sumaGastos, ok: Math.abs(sumaIngresos - 100) < 0.005 && Math.abs(sumaGastos - 100) < 0.005 };
}

/**
 * IIBB por Convenio Multilateral: la base del periodo (ventas netas) se reparte
 * por Coeficiente Unificado y se aplica la alicuota de cada jurisdiccion; el
 * SIRCREB conciliado se acredita con el mismo coeficiente.
 */
export function calcularConvenioMultilateral({ ventasPeriodo, jurisdicciones, sircrebConciliado }) {
  const filas = jurisdicciones.map(j => {
    const coef = coeficienteUnificado(j);
    const base = ventasPeriodo * coef;
    const impuesto = base * (j.alicuotaIIBB / 100);
    return { ...j, coef, base, impuesto, sircreb: sircrebConciliado * coef };
  });
  const totalIIBB = filas.reduce((s, f) => s + f.impuesto, 0);
  return { filas, totalVentas: ventasPeriodo, totalIIBB, totalSircreb: sircrebConciliado, saldo: totalIIBB - sircrebConciliado };
}


// ---------------------------------------------------------------
// RT 54 - bienes de uso y ajuste por inflacion
// ---------------------------------------------------------------

/** Amortizacion anual lineal total (valor / vida util, sin valor residual). */
export function amortizacionAnualTotal(activos) {
  return activos.reduce((s, a) => s + a.valor / a.vidaUtil, 0);
}

/**
 * Coeficiente de reexpresion = indice de cierre / indice del mes de origen.
 * Los bienes de cambio se miden al costo de ultima compra (coeficiente 1).
 * Si falta el indice del mes de origen se usa 1500 (base dic/2025).
 */
export function coeficienteReexpresion({ concepto, origen }, indices, valorCierre) {
  if (concepto.toLowerCase().includes('cambio')) return 1;
  return valorCierre / (indices[origen] || 1500.0);
}


// ---------------------------------------------------------------
// Sueldos: aportes, Ganancias 4ta categoria y contribuciones patronales
// (movido tal cual desde la vista de Sueldos; ver los comentarios de cada
// constante para la fuente y el periodo de vigencia)
// ---------------------------------------------------------------
// Deducción mensual (MNI + deducción especial) para Ganancias 4ta categoría,
// empleado soltero sin cargas de familia — período jul-dic 2026 (ARCA, se
// actualiza semestralmente por inflación; verificar contra la tabla vigente).
export const GANANCIAS_DEDUCCION_MENSUAL = 2909508;
// Deducciones mensuales por cargas de familia (Art. 30 LIG), mismo período.
const GANANCIAS_DEDUCCION_CONYUGE = 472258;
const GANANCIAS_DEDUCCION_POR_HIJO = 238161;

// Detracción de la base imponible de contribuciones patronales (Decreto
// 814/2001, Art. 4) vigente 2026 — general para LCT, trabajo agrario y
// construcción. No incluye el adicional de $10.000 para "pequeños
// empleadores" (≤25 trabajadores): ese beneficio se aplica una sola vez
// sobre la base total de TODA la nómina, no por empleado, y este
// simulador liquida un empleado a la vez sin conocer el resto de la planta.
export const DETRACCION_PATRONAL_MENSUAL = 7003.68;

// Escala progresiva mensual del Art. 94 LIG (escala anual jul-dic 2026 / 12,
// ya que la retención real usa un método de acumulado anual que requeriría
// historial mes a mes por empleado — inviable en un simulador de un solo mes).
export const GANANCIAS_ESCALA = [
  { hasta: 180707.66, fijo: 0, pct: 0.05, exceso: 0 },
  { hasta: 361415.31, fijo: 9035.38, pct: 0.09, exceso: 180707.66 },
  { hasta: 542122.97, fijo: 25299.07, pct: 0.12, exceso: 361415.31 },
  { hasta: 813184.46, fijo: 46983.99, pct: 0.15, exceso: 542122.97 },
  { hasta: 1626368.92, fijo: 87643.21, pct: 0.19, exceso: 813184.46 },
  { hasta: 2439553.37, fijo: 242148.26, pct: 0.23, exceso: 1626368.92 },
  { hasta: 3659330.06, fijo: 429180.69, pct: 0.27, exceso: 2439553.37 },
  { hasta: 5488995.09, fijo: 758520.39, pct: 0.31, exceso: 3659330.06 },
  { hasta: Infinity, fijo: 1325716.55, pct: 0.35, exceso: 5488995.09 }
];

export const calcularGanancias = (excedente) => {
  if (excedente <= 0) return 0;
  const tramo = GANANCIAS_ESCALA.find(t => excedente <= t.hasta);
  return tramo.fijo + (excedente - tramo.exceso) * tramo.pct;
};

// Función para realizar cálculos impositivos de liquidación
export const calcularLiquidacion = (brutoVal, isSec, conCargas) => {
  const { conyuge = false, hijos = 0 } = conCargas || {};
  const jub = brutoVal * 0.11;
  const pami = brutoVal * 0.03;
  const os = brutoVal * 0.03;
  const sec = isSec ? brutoVal * 0.02 : 0;

  // Ganancias 4ta categoría: MNI + deducción especial + cargas de familia,
  // sobre el excedente se aplica la escala progresiva completa del Art. 94.
  const deduccionFamilia = (conyuge ? GANANCIAS_DEDUCCION_CONYUGE : 0) + (hijos * GANANCIAS_DEDUCCION_POR_HIJO);
  const deduccionTotal = GANANCIAS_DEDUCCION_MENSUAL + deduccionFamilia;
  const gananciaNetaSujeta = brutoVal - jub - pami - os;
  const excedenteGanancias = Math.max(0, gananciaNetaSujeta - deduccionTotal);
  const ganancias = calcularGanancias(excedenteGanancias);

  const totalDeduc = jub + pami + os + sec + ganancias;
  const neto = brutoVal - totalDeduc;

  // Contribuciones patronales — Decreto 814/2001, Art. 4: se detrae un monto
  // fijo por empleado de la base imponible ANTES de aplicar las alícuotas
  // (LCT, trabajo agrario y construcción; monto vigente 2026 según Art. 22).
  const basePatronal = Math.max(0, brutoVal - DETRACCION_PATRONAL_MENSUAL);
  const pJub = basePatronal * 0.1017;
  const pOs = basePatronal * 0.06;
  const pOtros = basePatronal * 0.07;
  const totalPatr = pJub + pOs + pOtros;

  return {
    bruto: brutoVal,
    jub,
    pami,
    os,
    sec,
    ganancias,
    totalDeduc,
    neto,
    basePatronal,
    pJub,
    pOs,
    pOtros,
    totalPatr
  };
};
