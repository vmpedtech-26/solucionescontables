import { describe, it, expect } from 'vitest';
import {
  resumenRetenciones, coeficienteUnificado, validarJurisdicciones, calcularConvenioMultilateral,
  amortizacionAnualTotal, coeficienteReexpresion,
  calcularLiquidacion, calcularGanancias, GANANCIAS_ESCALA, GANANCIAS_DEDUCCION_MENSUAL, DETRACCION_PATRONAL_MENSUAL
} from '../src/domain/fiscal.js';

describe('resumenRetenciones', () => {
  const rets = [
    { monto: 100, conciliado: true, certDisponible: true },
    { monto: 50, conciliado: false, certDisponible: false },
    { monto: 25, conciliado: true, certDisponible: false }
  ];
  it('separa conciliadas, cuenta puente y sin certificado', () => {
    expect(resumenRetenciones(rets)).toEqual({ total: 175, conciliadas: 125, puente: 50, sinCertificado: 75 });
  });
  it('lista vacía -> todo en cero', () => {
    expect(resumenRetenciones([])).toEqual({ total: 0, conciliadas: 0, puente: 0, sinCertificado: 0 });
  });
});

describe('Convenio Multilateral (IIBB)', () => {
  const jur = [
    { provincia: 'Neuquén', pctIngresos: 45, pctGastos: 50, alicuotaIIBB: 4.0 },
    { provincia: 'Río Negro', pctIngresos: 35, pctGastos: 30, alicuotaIIBB: 3.5 },
    { provincia: 'La Pampa', pctIngresos: 20, pctGastos: 20, alicuotaIIBB: 3.0 }
  ];
  it('el Coeficiente Unificado es el promedio simple de ingresos y gastos', () => {
    expect(coeficienteUnificado(jur[0])).toBeCloseTo(0.475, 10);
    expect(coeficienteUnificado(jur[1])).toBeCloseTo(0.325, 10);
    expect(coeficienteUnificado(jur[2])).toBeCloseTo(0.2, 10);
  });
  it('los coeficientes de todas las jurisdicciones suman 1', () => {
    expect(jur.reduce((s, j) => s + coeficienteUnificado(j), 0)).toBeCloseTo(1, 10);
  });
  it('reparte la base por coeficiente, aplica cada alícuota y acredita SIRCREB', () => {
    const r = calcularConvenioMultilateral({ ventasPeriodo: 1_000_000, jurisdicciones: jur, sircrebConciliado: 10_000 });
    expect(r.filas.map(f => f.impuesto)).toEqual([
      expect.closeTo(1_000_000 * 0.475 * 0.04, 6),
      expect.closeTo(1_000_000 * 0.325 * 0.035, 6),
      expect.closeTo(1_000_000 * 0.2 * 0.03, 6)
    ]);
    expect(r.totalIIBB).toBeCloseTo(19_000 + 11_375 + 6_000, 6);
    expect(r.saldo).toBeCloseTo(36_375 - 10_000, 6);
    expect(r.filas.map(f => f.sircreb)).toEqual([expect.closeTo(4_750, 6), expect.closeTo(3_250, 6), expect.closeTo(2_000, 6)]);
    expect(r.filas.reduce((s, f) => s + f.sircreb, 0)).toBeCloseTo(10_000, 6);
  });
  it('si el SIRCREB supera el impuesto el saldo es a favor (negativo)', () => {
    const r = calcularConvenioMultilateral({ ventasPeriodo: 100_000, jurisdicciones: jur, sircrebConciliado: 50_000 });
    expect(r.saldo).toBeLessThan(0);
  });
  it('sin ventas no hay impuesto', () => {
    expect(calcularConvenioMultilateral({ ventasPeriodo: 0, jurisdicciones: jur, sircrebConciliado: 0 }).totalIIBB).toBe(0);
  });
  it('validarJurisdicciones exige que ingresos y gastos sumen 100%', () => {
    expect(validarJurisdicciones(jur).ok).toBe(true);
    expect(validarJurisdicciones([{ pctIngresos: 60, pctGastos: 50 }, { pctIngresos: 30, pctGastos: 50 }]).ok).toBe(false);
  });
});

describe('RT 54: bienes de uso y reexpresión', () => {
  it('amortización anual lineal = valor / vida útil', () => {
    expect(amortizacionAnualTotal([{ valor: 500_000, vidaUtil: 5 }, { valor: 1_000_000, vidaUtil: 10 }])).toBe(200_000);
    expect(amortizacionAnualTotal([])).toBe(0);
  });
  const indices = { '2026-01': 1543.5, '2025-12': 1500 };
  it('coeficiente = índice de cierre / índice de origen', () => {
    expect(coeficienteReexpresion({ concepto: 'Rodado', origen: '2026-01' }, indices, 1684.96)).toBeCloseTo(1684.96 / 1543.5, 10);
  });
  it('los bienes de cambio no se reexpresan (coeficiente 1)', () => {
    expect(coeficienteReexpresion({ concepto: 'Bienes de cambio', origen: '2026-01' }, indices, 1684.96)).toBe(1);
  });
  it('si falta el índice del mes de origen usa la base 1500', () => {
    expect(coeficienteReexpresion({ concepto: 'Equipo', origen: '1999-01' }, indices, 3000)).toBe(2);
  });
});

describe('Escala de Ganancias (Art. 94 LIG)', () => {
  it('cada tramo arranca donde terminó el anterior (continuidad de la escala)', () => {
    for (let i = 0; i < GANANCIAS_ESCALA.length - 1; i++) {
      const t = GANANCIAS_ESCALA[i], sig = GANANCIAS_ESCALA[i + 1];
      const alFinalDelTramo = t.fijo + (t.hasta - t.exceso) * t.pct;
      expect(sig.fijo).toBeCloseTo(alFinalDelTramo, 0);
      expect(sig.exceso).toBe(t.hasta);
    }
  });
  it('alícuotas crecientes y último tramo abierto', () => {
    const pcts = GANANCIAS_ESCALA.map(t => t.pct);
    expect([...pcts].sort((a, b) => a - b)).toEqual(pcts);
    expect(GANANCIAS_ESCALA.at(-1).hasta).toBe(Infinity);
  });
  it('excedente 0 o negativo no tributa', () => {
    expect(calcularGanancias(0)).toBe(0);
    expect(calcularGanancias(-5000)).toBe(0);
  });
  it('primer tramo 5% y último tramo 35%', () => {
    expect(calcularGanancias(100_000)).toBeCloseTo(5_000, 6);
    expect(calcularGanancias(6_000_000)).toBeCloseTo(1_325_716.55 + (6_000_000 - 5_488_995.09) * 0.35, 4);
  });
});

describe('calcularLiquidacion (sueldos)', () => {
  it('sueldo bajo: aportes 17% (11+3+3), sin Ganancias, neto = bruto − aportes', () => {
    const r = calcularLiquidacion(1_000_000, false);
    expect(r.jub).toBeCloseTo(110_000, 6);
    expect(r.pami).toBeCloseTo(30_000, 6);
    expect(r.os).toBeCloseTo(30_000, 6);
    expect(r.sec).toBe(0);
    expect(r.ganancias).toBe(0);
    expect(r.totalDeduc).toBeCloseTo(170_000, 6);
    expect(r.neto).toBeCloseTo(830_000, 6);
  });
  it('el aporte sindical suma 2% cuando corresponde', () => {
    const r = calcularLiquidacion(1_000_000, true);
    expect(r.sec).toBeCloseTo(20_000, 6);
    expect(r.neto).toBeCloseTo(810_000, 6);
  });
  it('contribuciones patronales sobre la base menos la detracción (Dto. 814/2001)', () => {
    const r = calcularLiquidacion(1_000_000, false);
    const base = 1_000_000 - DETRACCION_PATRONAL_MENSUAL;
    expect(r.basePatronal).toBeCloseTo(base, 6);
    expect(r.pJub).toBeCloseTo(base * 0.1017, 6);
    expect(r.pOs).toBeCloseTo(base * 0.06, 6);
    expect(r.pOtros).toBeCloseTo(base * 0.07, 6);
    expect(r.totalPatr).toBeCloseTo(base * (0.1017 + 0.06 + 0.07), 6);
  });
  it('la base patronal nunca es negativa', () => {
    expect(calcularLiquidacion(5_000, false).basePatronal).toBe(0);
    expect(calcularLiquidacion(0, false).totalPatr).toBe(0);
  });
  it('sueldo alto: Ganancias = escala sobre (bruto − aportes − deducciones)', () => {
    const bruto = 6_000_000;
    const sujeta = bruto - bruto * 0.17;
    const excedente = sujeta - GANANCIAS_DEDUCCION_MENSUAL;
    const esperado = 242_148.26 + (excedente - 1_626_368.92) * 0.23; // tramo 1.626.368,92 – 2.439.553,37
    const r = calcularLiquidacion(bruto, false);
    expect(r.ganancias).toBeCloseTo(esperado, 4);
    expect(r.neto).toBeCloseTo(bruto - bruto * 0.17 - esperado, 4);
  });
  it('cargas de familia reducen Ganancias', () => {
    const sinCargas = calcularLiquidacion(6_000_000, false).ganancias;
    const conCargas = calcularLiquidacion(6_000_000, false, { conyuge: true, hijos: 2 }).ganancias;
    const excedente = 6_000_000 * 0.83 - (GANANCIAS_DEDUCCION_MENSUAL + 472_258 + 2 * 238_161);
    expect(conCargas).toBeCloseTo(87_643.21 + (excedente - 813_184.46) * 0.19, 4);
    expect(conCargas).toBeLessThan(sinCargas);
  });
  it('el neto nunca supera al bruto y las deducciones son consistentes', () => {
    for (const b of [1, 300_000, 2_500_000, 9_000_000]) {
      const r = calcularLiquidacion(b, true, { conyuge: true, hijos: 1 });
      expect(r.neto).toBeLessThanOrEqual(b);
      expect(r.totalDeduc).toBeCloseTo(r.jub + r.pami + r.os + r.sec + r.ganancias, 6);
      expect(r.neto + r.totalDeduc).toBeCloseTo(b, 6);
    }
  });
});
