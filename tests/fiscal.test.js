import { describe, it, expect } from 'vitest';
import {
  MONOTRIBUTO_CATEGORIAS_2026, ventasMoviles12Meses, letraCategoria, consumoMonotributo,
  categoriaMonotributoRecomendada, calcularIvaRI, consistenciaCLAE
} from '../src/domain/fiscal.js';

describe('calcularIvaRI', () => {
  it('saldo = débito − crédito', () => {
    const r = calcularIvaRI({ ventas: [{ iva: 210, neto: 1000 }], compras: [{ iva: 105 }] });
    expect(r.debFiscal).toBe(210);
    expect(r.credFiscal).toBe(105);
    expect(r.saldoNeto).toBe(105);
  });
  it('sin ventas el prorrateo es 1 y todo el crédito se computa', () => {
    const r = calcularIvaRI({ ventas: [], compras: [{ iva: 50 }, { iva: 25 }] });
    expect(r.prorrateoGravado).toBe(1);
    expect(r.credFiscal).toBe(75);
    expect(r.saldoNeto).toBe(-75);
  });
  it('prorratea el crédito por ventas exentas (Art. 13)', () => {
    const ventas = [{ neto: 750, iva: 157.5 }, { neto: 250, iva: 0, exento: true }];
    const r = calcularIvaRI({ ventas, compras: [{ iva: 100 }] });
    expect(r.prorrateoGravado).toBeCloseTo(0.75, 10);
    expect(r.credFiscal).toBe(75);
    expect(r.debFiscal).toBe(157.5);
  });
  it('si todas las ventas son exentas el crédito computable es 0', () => {
    const r = calcularIvaRI({ ventas: [{ neto: 500, iva: 0, exento: true }], compras: [{ iva: 100 }] });
    expect(r.credFiscal).toBe(0);
  });
  it('redondea el crédito fiscal a 2 decimales', () => {
    const ventas = [{ neto: 200, iva: 42 }, { neto: 100, iva: 0, exento: true }]; // prorrateo 2/3
    const r = calcularIvaRI({ ventas, compras: [{ iva: 100.01 }] });
    expect(r.credFiscal).toBe(66.67);
  });
  it('retenciones/percepciones y saldo a favor se restan del saldo', () => {
    const r = calcularIvaRI({ ventas: [{ iva: 1000, neto: 4762 }], compras: [{ iva: 400 }], retPercSaldo: 100, saldoFavor: 50 });
    expect(r.saldoNeto).toBe(1000 - 400 - 100 - 50);
  });
  it('un saldo a favor del contribuyente da resultado negativo', () => {
    const r = calcularIvaRI({ ventas: [{ iva: 100, neto: 476 }], compras: [{ iva: 300 }] });
    expect(r.saldoNeto).toBe(-200);
  });
  it('excluirCredito descarta comprobantes puntuales; sin predicado se computa todo', () => {
    const compras = [{ iva: 100, cuit: '30-11111111-9' }, { iva: 50, cuit: '30-22222222-1' }];
    const sin = calcularIvaRI({ ventas: [], compras });
    const con = calcularIvaRI({ ventas: [], compras, excluirCredito: (c) => c.cuit.endsWith('9') });
    expect(sin.credFiscal).toBe(150);
    expect(con.credFiscal).toBe(50);
  });
});

describe('Monotributo', () => {
  it('letraCategoria lee la letra y usa H por defecto', () => {
    expect(letraCategoria('Monotributo - Cat D')).toBe('D');
    expect(letraCategoria('Monotributo - cat k')).toBe('K');
    expect(letraCategoria('Monotributo')).toBe('H');
  });

  it('ventasMoviles12Meses suma solo los últimos 365 días', () => {
    const hoy = new Date('2026-09-30T12:00:00Z');
    const ventas = [
      { fecha: '2026-09-01', total: 100 },
      { fecha: '2025-10-05', total: 200 },  // dentro de la ventana
      { fecha: '2025-09-20', total: 400 }   // fuera (más de 365 días)
    ];
    expect(ventasMoviles12Meses(ventas, hoy)).toBe(300);
  });

  it('consumoMonotributo calcula el porcentaje del tope y de la exclusión (tope K)', () => {
    const tope = MONOTRIBUTO_CATEGORIAS_2026.D.maxIngresos;
    const r = consumoMonotributo(tope / 2, 'D');
    expect(r.percentCategory).toBeCloseTo(50, 10);
    expect(r.topeExclusion).toBe(MONOTRIBUTO_CATEGORIAS_2026.K.maxIngresos);
    expect(r.percentExclusion).toBeCloseTo((tope / 2) / r.topeExclusion * 100, 10);
  });
  it('consumoMonotributo con letra desconocida usa la categoría H', () => {
    expect(consumoMonotributo(0, 'Z').topeCategoria).toBe(MONOTRIBUTO_CATEGORIAS_2026.H.maxIngresos);
  });

  describe('categoriaMonotributoRecomendada', () => {
    const base = { energia: 0, alquileres: 0, superficie: 0 };
    it('devuelve la primera categoría que cubre los ingresos', () => {
      expect(categoriaMonotributoRecomendada({ ...base, ingresos: 10_000_000 })).toBe('A');
      expect(categoriaMonotributoRecomendada({ ...base, ingresos: MONOTRIBUTO_CATEGORIAS_2026.A.maxIngresos })).toBe('A');
      expect(categoriaMonotributoRecomendada({ ...base, ingresos: MONOTRIBUTO_CATEGORIAS_2026.A.maxIngresos + 1 })).toBe('B');
    });
    it('el tope de la K todavía es K; un peso más es EXCLUIDO', () => {
      const k = MONOTRIBUTO_CATEGORIAS_2026.K.maxIngresos;
      expect(categoriaMonotributoRecomendada({ ...base, ingresos: k })).toBe('K');
      expect(categoriaMonotributoRecomendada({ ...base, ingresos: k + 1 })).toBe('EXCLUIDO');
    });
    it('energía, alquileres o superficie también suben de categoría', () => {
      expect(categoriaMonotributoRecomendada({ ...base, ingresos: 1_000_000, superficie: 100 })).toBe('E');
      expect(categoriaMonotributoRecomendada({ ...base, ingresos: 1_000_000, energia: 6_000 })).toBe('C');
      expect(categoriaMonotributoRecomendada({ ...base, ingresos: 1_000_000, alquileres: 3_000_000 })).toBe('C');
    });
    it('un parámetro por encima del tope de la K excluye aunque los ingresos sean bajos', () => {
      expect(categoriaMonotributoRecomendada({ ...base, ingresos: 1_000_000, energia: 25_000 })).toBe('EXCLUIDO');
      expect(categoriaMonotributoRecomendada({ ...base, ingresos: 1_000_000, superficie: 300 })).toBe('EXCLUIDO');
    });
  });

  it('la tabla de categorías es consistente (topes y cuotas crecientes, I–K sin cuota de servicios)', () => {
    const letras = Object.keys(MONOTRIBUTO_CATEGORIAS_2026);
    expect(letras.join('')).toBe('ABCDEFGHIJK');
    for (let i = 1; i < letras.length; i++) {
      const prev = MONOTRIBUTO_CATEGORIAS_2026[letras[i - 1]], cur = MONOTRIBUTO_CATEGORIAS_2026[letras[i]];
      expect(cur.maxIngresos).toBeGreaterThan(prev.maxIngresos);
      expect(cur.cuotaBienes).toBeGreaterThanOrEqual(prev.cuotaBienes);
      expect(cur.superficie).toBeGreaterThanOrEqual(prev.superficie);
    }
    for (const l of ['I', 'J', 'K']) expect(MONOTRIBUTO_CATEGORIAS_2026[l].cuotaServicios).toBe(0);
    for (const l of 'ABCDEFGH') expect(MONOTRIBUTO_CATEGORIAS_2026[l].cuotaServicios).toBeGreaterThan(0);
  });
});

describe('consistenciaCLAE', () => {
  const act21 = [{ codigo: '1', pct: 0.7, alicuota: 21 }, { codigo: '2', pct: 0.3, alicuota: 21 }];
  it('coincide exactamente cuando todo está a 21%', () => {
    const r = consistenciaCLAE(100_000, act21, 21_000);
    expect(r.totalActividadDF).toBeCloseTo(21_000, 6);
    expect(r.ok).toBe(true);
    expect(r.exacta).toBe(true);
  });
  it('detecta diferencia y distingue "ok" (< $1) de "exacta" (< $0,01)', () => {
    expect(consistenciaCLAE(100_000, act21, 21_000.5).ok).toBe(true);
    expect(consistenciaCLAE(100_000, act21, 21_000.5).exacta).toBe(false);
    expect(consistenciaCLAE(100_000, act21, 21_002).ok).toBe(false);
  });
  it('soporta alícuotas mixtas (10,5% y 21%)', () => {
    const mix = [{ pct: 0.7, alicuota: 10.5 }, { pct: 0.3, alicuota: 21 }];
    const r = consistenciaCLAE(1_000_000, mix, 135_500);
    expect(r.totalActividadDF).toBeCloseTo(136_500, 6);
    expect(r.ok).toBe(false);
  });
  it('sin ventas no hay diferencia', () => {
    expect(consistenciaCLAE(0, act21, 0).ok).toBe(true);
  });
});
