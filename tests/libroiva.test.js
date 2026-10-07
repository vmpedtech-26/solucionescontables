import { describe, it, expect } from 'vitest';
import { ventasComprobantes, ventasAlicuotas, comprasComprobantes, comprasAlicuotas, codigoComprobante, codigoAlicuota } from '../src/domain/libroiva.js';

const venta = { fecha: '2026-10-05', tipo_comprobante: 'Factura A', numero: '0003-00000850', cliente: 'Metalúrgica Andina S.A.', cuit: '30-71928371-2', neto: 1000, iva: 210, total: 1210 };
const compra = { fecha: '2026-10-06', tipo_comprobante: 'Factura A', numero: '0094-00293812', proveedor: 'Papelería del Valle', cuit: '30-66442299-5', neto: 380, iva: 79.8, total: 459.8 };
const lineas = (s) => s.split('\r\n').filter(Boolean);

describe('Libro IVA Digital RG 4597 - longitudes de registro', () => {
  it('ventas comprobantes = 266', () => { expect(lineas(ventasComprobantes([venta]))[0].length).toBe(266); });
  it('ventas alicuotas = 62', () => { expect(lineas(ventasAlicuotas([venta]))[0].length).toBe(62); });
  it('compras comprobantes = 325', () => { expect(lineas(comprasComprobantes([compra]))[0].length).toBe(325); });
  it('compras alicuotas = 84', () => { expect(lineas(comprasAlicuotas([compra]))[0].length).toBe(84); });
  it('los registros exentos y de consumidor final mantienen la longitud', () => {
    const ex = { ...venta, iva: 0, exento: true, total: 1000, cuit: '' };
    expect(lineas(ventasComprobantes([ex]))[0].length).toBe(266);
    expect(ventasAlicuotas([ex])).toBe('');
  });
});

describe('Libro IVA Digital - contenido', () => {
  it('codifica fecha, tipo, punto de venta, importes en centavos', () => {
    const l = lineas(ventasComprobantes([venta]))[0];
    expect(l.slice(0, 8)).toBe('20261005');
    expect(l.slice(8, 11)).toBe('001');
    expect(l.slice(11, 16)).toBe('00003');
    expect(l.slice(16, 36)).toBe('00000000000000000850');
    expect(l.slice(56, 58)).toBe('80');
    expect(l.slice(58, 78)).toBe('00000000030719283712');
    expect(l.slice(78, 108)).toBe('METALURGICA ANDINA S.A.'.padEnd(30, ' '));
    expect(l.slice(108, 123)).toBe('000000000121000');
  });
  it('alicuotas: neto, codigo e IVA liquidado', () => {
    const l = lineas(ventasAlicuotas([venta]))[0];
    expect(l.slice(0, 3)).toBe('001');
    expect(l.slice(3, 8)).toBe('00003');
    expect(l.slice(28, 43)).toBe('000000000100000');
    expect(l.slice(43, 47)).toBe('0005');
    expect(l.slice(47, 62)).toBe('000000000021000');
  });
  it('codigos de comprobante', () => {
    expect(codigoComprobante('Factura B')).toBe('006');
    expect(codigoComprobante('Nota de Crédito A')).toBe('003');
    expect(codigoComprobante('Nota de Débito B')).toBe('007');
    expect(codigoComprobante('Factura A - Retención')).toBe('001');
    expect(codigoComprobante('Factura M')).toBe('051');
    expect(codigoComprobante('Factura E (Export.)')).toBe('019');
  });
  it('codigos de alicuota', () => {
    expect(codigoAlicuota(1000, 210)).toBe('0005');
    expect(codigoAlicuota(1000, 105)).toBe('0004');
    expect(codigoAlicuota(1000, 270)).toBe('0006');
    expect(codigoAlicuota(1000, 0)).toBe('0003');
  });
  it('compra sin IVA va como no gravada y sin registro de alicuota', () => {
    const c = { ...compra, iva: 0, neto: 100, total: 100, tipo_comprobante: 'Factura C' };
    const l = lineas(comprasComprobantes([c]))[0];
    expect(l.length).toBe(325);
    expect(comprasAlicuotas([c])).toBe('');
  });
});
