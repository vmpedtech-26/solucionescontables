import { describe, it, expect } from 'vitest';
import { saldo, cuentaCorriente, cargosImpagos, antiguedad, diasDeuda, abonosPendientes, aumentar, resumenMes, proximoRecibo, validarMovimiento, parseImporte } from '../src/domain/honorarios.js';
import { htmlRecibo } from '../src/views/honorarios.js';

const movs = [
  { id: '1', empresa_id: 'co-1', tipo: 'cargo', fecha: '2026-07-01', vence: '2026-07-10', concepto: 'Abono 07', importe: 100000, origen: 'abono', periodo: '2026-07' },
  { id: '2', empresa_id: 'co-1', tipo: 'cargo', fecha: '2026-08-01', vence: '2026-08-10', concepto: 'Abono 08', importe: 100000, origen: 'abono', periodo: '2026-08' },
  { id: '3', empresa_id: 'co-1', tipo: 'cobro', fecha: '2026-08-15', concepto: 'Pago', importe: 120000, medio: 'transferencia', recibo: 7 },
  { id: '4', empresa_id: 'co-1', tipo: 'cargo', fecha: '2026-10-01', vence: '2026-10-10', concepto: 'Abono 10', importe: 110000, origen: 'abono', periodo: '2026-10' },
  { id: '5', empresa_id: 'co-1', tipo: 'bonificacion', fecha: '2026-10-05', concepto: 'Descuento', importe: 10000 }
];

describe('Honorarios: cuenta corriente y deuda', () => {
  it('saldo y saldo acumulado', () => {
    expect(saldo(movs)).toBe(180000);
    expect(cuentaCorriente(movs).map((m) => m.saldo)).toEqual([100000, 200000, 80000, 190000, 180000]);
  });

  it('aplica cobros y bonificaciones a la deuda más vieja', () => {
    const impagos = cargosImpagos(movs);
    expect(impagos.map((c) => [c.id, c.pendiente])).toEqual([['2', 70000], ['4', 110000]]);
    expect(antiguedad(movs, '2026-10-30')).toEqual({ d30: 110000, d60: 0, d90: 70000, mas90: 0 });
    expect(diasDeuda(movs, '2026-10-30')).toBe(81);
    expect(diasDeuda([...movs, { tipo: 'cobro', fecha: '2026-10-30', importe: 180000 }], '2026-10-30')).toBe(0);
  });

  it('saldo a favor cuando el cliente pagó de más', () => {
    const m = [{ tipo: 'cargo', fecha: '2026-10-01', importe: 100 }, { tipo: 'cobro', fecha: '2026-10-02', importe: 150 }];
    expect(saldo(m)).toBe(-50);
    expect(cargosImpagos(m)).toEqual([]);
  });

  it('genera los abonos del mes una sola vez y respeta el día de vencimiento', () => {
    const abonos = [
      { empresa_id: 'co-1', importe: 110000, dia_vencimiento: 31, concepto: 'Honorarios' },
      { empresa_id: 'co-2', importe: 50000, dia_vencimiento: 10 },
      { empresa_id: 'co-3', importe: 0 },
      { empresa_id: 'co-4', importe: 9000, activo: false }
    ];
    const nuevos = abonosPendientes(abonos, movs, '2026-11');
    expect(nuevos).toHaveLength(2);
    expect(nuevos[0]).toMatchObject({ empresa_id: 'co-1', vence: '2026-11-30', concepto: 'Honorarios · 11/2026', importe: 110000, origen: 'abono', periodo: '2026-11' });
    expect(nuevos[1].concepto).toBe('Honorarios profesionales · 11/2026');
    expect(abonosPendientes(abonos, movs, '2026-10').map((n) => n.empresa_id)).toEqual(['co-2']); // co-1 ya tiene octubre
  });

  it('aumentos, resumen del mes y numeración de recibos', () => {
    expect(aumentar(110000, 8.5)).toBe(119350);
    expect(resumenMes(movs, '2026-10')).toEqual({ cargado: 110000, cobrado: 0, bonificado: 10000 });
    expect(proximoRecibo(movs)).toBe(8);
    expect(proximoRecibo([])).toBe(1);
  });

  it('valida movimientos e interpreta importes escritos a mano', () => {
    const ok = { tipo: 'cobro', empresa_id: 'co-1', fecha: '2026-10-30', importe: 10, concepto: 'Pago', medio: 'efectivo' };
    expect(validarMovimiento(ok)).toBeNull();
    expect(validarMovimiento({ ...ok, importe: 0 })).toMatch(/mayor a cero/);
    expect(validarMovimiento({ ...ok, medio: 'bitcoin' })).toMatch(/Medio/);
    expect(validarMovimiento({ ...ok, tipo: 'regalo' })).toMatch(/Tipo/);
    expect(validarMovimiento({ ...ok, concepto: '  ' })).toMatch(/concepto/);
    expect(parseImporte('150.000,50')).toBe(150000.5);
    expect(parseImporte('$ 150.000')).toBe(150000);
    expect(parseImporte('150000.5')).toBe(150000.5);
    expect(parseImporte('1.5')).toBe(1.5);
    expect(Number.isNaN(parseImporte('abc'))).toBe(true);
  });

  it('el recibo escapa los datos del cliente', () => {
    const html = htmlRecibo({ razon_social: 'Estudio <b>X</b>' }, { razon_social: '<script>alert(1)</script>', cuit: '30-1' },
      { recibo: 8, fecha: '2026-10-30', importe: 1500.5, concepto: 'Honorarios', medio: 'transferencia' });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('N° 00000008');
    expect(html).toContain('$ 1.500,50');
    expect(html).toContain('Transferencia');
  });
});
