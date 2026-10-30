import { describe, it, expect } from 'vitest';
import { leerExtracto, clasificar, conciliar, resumenConciliacion, comprobantesSinMovimiento } from '../src/domain/conciliacion.js';

const extracto = [
  'Banco Ejemplo - Cuenta Corriente 123/4',
  'Fecha;Descripción;Débito;Crédito;Saldo',
  '01/10/2026;Saldo anterior;;;100.000,00',
  '05/10/2026;TRANSF RECIBIDA CUIT 30712345671;;1.210,00;101.210,00',
  '05/10/2026;IMP. LEY 25413 S/CRED;7,26;;101.202,74',
  '06/10/2026;PERCEPCION IVA RG 2408;36,30;;101.166,44',
  '07/10/2026;RET. IIBB SIRCREB;24,20;;101.142,24',
  '10/10/2026;COMISION MANTENIMIENTO CTA;5.000,00;;96.142,24',
  '10/10/2026;IVA 21% S/COMISION;1.050,00;;95.092,24',
  '12/10/2026;PAGO PROVEEDOR TRANSF;"60.500,00";;34.592,24',
  '15/10/2026;DEPOSITO EFECTIVO;;9.999,00;44.591,24',
  'Total;;;;'
].join('\n');

const ventas = [
  { id: 'v1', fecha: '2026-10-01', tipo_comprobante: 'Factura A', numero: '00003-00000010', cliente: 'Cliente SA', cuit: '30-71234567-1', total: 1210 },
  { id: 'v2', fecha: '2026-10-02', tipo_comprobante: 'Factura A', numero: '00003-00000011', cliente: 'Otro SRL', cuit: '30-70000000-0', total: 1210 },
  { id: 'v3', fecha: '2026-10-20', tipo_comprobante: 'Factura B', numero: '00003-00000012', cliente: 'Consumidor', cuit: '', total: 500 }
];
const compras = [{ id: 'c1', fecha: '2026-10-08', tipo_comprobante: 'Factura A', numero: '00001-00000099', proveedor: 'Insumos SA', cuit: '30-71111111-1', total: 60500 }];

describe('Conciliación bancaria', () => {
  it('lee el extracto con débito y crédito separados e ignora saldo y totales', () => {
    const m = leerExtracto(extracto);
    expect(m).toHaveLength(8);
    expect(m[0]).toMatchObject({ fecha: '2026-10-05', importe: 1210 });
    expect(m[1].importe).toBe(-7.26);
    expect(m[6].importe).toBe(-60500);
  });

  it('lee un extracto con importe con signo', () => {
    const m = leerExtracto('Fecha,Concepto,Importe\n2026-10-01,Transferencia,"-1,500.50"\n2026-10-02,Deposito,2000');
    expect(m.map((x) => x.importe)).toEqual([-1500.5, 2000]);
  });

  it('clasifica impuestos y gastos bancarios', () => {
    expect(clasificar({ descripcion: 'IMP. LEY 25413 S/DEB' })).toBe('ley25413');
    expect(clasificar({ descripcion: 'Impuesto Deb y Cred' })).toBe('ley25413');
    expect(clasificar({ descripcion: 'RET IIBB SIRCREB' })).toBe('sircreb');
    expect(clasificar({ descripcion: 'PERCEPCION IVA RG 2408' })).toBe('percepcion_iva');
    expect(clasificar({ descripcion: 'IVA 21% S/COMISION' })).toBe('iva_bancario');
    expect(clasificar({ descripcion: 'COMISION MANTENIMIENTO' })).toBe('gastos');
    expect(clasificar({ descripcion: 'TRANSFERENCIA RECIBIDA' })).toBe('operativo');
  });

  it('concilia priorizando el CUIT de la descripción y deja lo que no cierra', () => {
    const r = conciliar(leerExtracto(extracto), ventas, compras);
    const cobro = r.find((m) => m.importe === 1210);
    expect(cobro.match).toMatchObject({ id: 'v1', por: 'cuit' }); // no v2, aunque tenga el mismo total
    expect(r.find((m) => m.importe === -60500).match).toMatchObject({ id: 'c1', tipo: 'compras', por: 'importe' });
    expect(r.find((m) => m.importe === 9999).match).toBeNull();

    const res = resumenConciliacion(r);
    expect(res.porClase).toMatchObject({ ley25413: 7.26, percepcion_iva: 36.3, sircreb: 24.2, gastos: 5000, iva_bancario: 1050 });
    expect(res.ley25413Computable).toBe(2.4);
    expect(res.creditos).toEqual({ total: 11209, conciliados: 1, cantidad: 2 });
    expect(res.sinConciliar).toHaveLength(1);

    const p = comprobantesSinMovimiento(r, ventas, compras, '2026-10-01', '2026-10-31');
    expect(p.ventas.map((t) => t.id)).toEqual(['v2', 'v3']);
    expect(p.compras).toEqual([]);
  });

  it('no concilia comprobantes muy viejos ni posteriores al movimiento', () => {
    const r = conciliar([{ id: 'b', fecha: '2026-10-05', descripcion: 'TRANSF', importe: 500 }],
      [{ id: 'x', fecha: '2026-05-01', tipo_comprobante: 'Factura B', numero: '1', total: 500 }, { id: 'y', fecha: '2026-10-20', tipo_comprobante: 'Factura B', numero: '2', total: 500 }], []);
    expect(r[0].match).toBeNull();
  });

  it('avisa si faltan columnas', () => {
    expect(() => leerExtracto('Fecha;Detalle\n01/10/2026;algo')).toThrow(/títulos|columnas/);
  });
});
