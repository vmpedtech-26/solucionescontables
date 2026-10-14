import { describe, it, expect } from 'vitest';
import { parseMisComprobantes, detectarColumnas, parseMonto, separarCampos, normalizarTipo } from '../src/domain/mis-comprobantes.js';

// Encabezados reconstruidos de los formatos de ARCA. Validar con un archivo real.
const CLASICO = 'Fecha;Tipo;Punto de Venta;Número Desde;Número Hasta;Cód. Autorización;Tipo Doc. Receptor;Nro. Doc. Receptor;Denominación Receptor;Tipo Cambio;Moneda;Imp. Neto Gravado;Imp. Neto No Gravado;Imp. Op. Exentas;IVA;Imp. Total';
const NUEVO = 'Fecha de Emisión;Tipo de Comprobante;Punto de Venta;Número Desde;Número Hasta;Cód. Autorización;Tipo Doc. Emisor;Nro. Doc. Emisor;Denominación Emisor;Tipo Cambio;Moneda;Neto Grav. IVA 0%;IVA 2,5%;Neto Grav. IVA 2,5%;IVA 5%;Neto Grav. IVA 5%;IVA 10,5%;Neto Grav. IVA 10,5%;IVA 21%;Neto Grav. IVA 21%;IVA 27%;Neto Grav. IVA 27%;Neto Gravado Total;Neto No Gravado;Op. Exentas;Otros Tributos;Total IVA;Imp. Total';

describe('Detección de columnas', () => {
  it('formato clásico: el CUIT sale de "Nro. Doc.", no de "Tipo Doc."', () => {
    const c = detectarColumnas(CLASICO.split(';'));
    expect(c.docNro).toBe(7);
    expect(c.netoGravado).toBe(11);
    expect(c.iva).toBe(14);
    expect(c.total).toBe(15);
  });
  it('formato por alícuota: usa los totales, no la primera columna con "IVA"', () => {
    const c = detectarColumnas(NUEVO.split(';'));
    expect(c.docNro).toBe(7);
    expect(c.netoGravado).toBe(22);
    expect(c.iva).toBe(26);
    expect(c.total).toBe(27);
  });
});

describe('Lectura de archivos', () => {
  it('ventas (clásico) con Factura A, Factura B a DNI y fila de totales', () => {
    const txt = [
      'Mis Comprobantes Emitidos - CUIT 20123456786',
      CLASICO,
      '05/10/2026;1 - Factura A;3;851;851;76123456789012;80;30719283719;METALURGICA ANDINA SA;1,000000;$;100000,00;0,00;0,00;21000,00;121000,00',
      '06/10/2026;6 - Factura B;3;152;152;76123456789013;96;28765432;PEREZ JUAN;1,000000;$;10000,00;0,00;0,00;2100,00;12100,00',
      'Totales;;;;;;;;;;;110000,00;0,00;0,00;23100,00;133100,00'
    ].join('\n');
    const r = parseMisComprobantes(txt, 'emitidos.csv');
    expect(r.tipo).toBe('ventas');
    expect(r.registros).toHaveLength(2);
    expect(r.registros[0]).toMatchObject({ fecha: '2026-10-05', tipo_comprobante: 'Factura A', numero: '00003-00000851', cuit: '30-71928371-9', neto: 100000, iva: 21000, total: 121000, cliente: 'METALURGICA ANDINA SA' });
    expect(r.registros[1]).toMatchObject({ tipo_comprobante: 'Factura B', cuit: '28765432' });
  });

  it('compras (por alícuota) suma neto e IVA y detecta que son recibidos', () => {
    const fila = ['10/10/2026', '1', '94', '293812', '293812', '7600', '80', '30664422995', 'PAPELERA "DEL VALLE"; SRL',
      '1', 'PES', '0', '0', '0', '0', '0', '105', '1000', '210', '1000', '0', '0', '2000', '0', '0', '0', '315', '2315'];
    const txt = NUEVO + '\n' + fila.map((v) => (/[;"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(';');
    const r = parseMisComprobantes(txt, 'recibidos.csv');
    expect(r.tipo).toBe('compras');
    expect(r.registros[0]).toMatchObject({ neto: 2000, iva: 315, total: 2315, proveedor: 'PAPELERA "DEL VALLE"; SRL', cuit: '30-66442299-5', tipo_comprobante: 'Factura A' });
  });

  it('no inventa IVA y convierte moneda extranjera', () => {
    const txt = [
      CLASICO,
      '01/10/2026;11 - Factura C;2;10;10;76;80;20358492014;GOMEZ;1;$;0;0;0;0;5000',
      '02/10/2026;1 - Factura A;2;11;11;76;80;30719283719;EXPORT SA;1000,50;DOL;100;0;0;21;121',
      '03/10/2026;1 - Factura A;2;12;12;76;80;30719283719;EXPORT SA;;USD;100;0;0;21;121'
    ].join('\n');
    const r = parseMisComprobantes(txt, 'emitidos.csv');
    expect(r.registros[0]).toMatchObject({ neto: 5000, iva: 0, total: 5000 });
    expect(r.registros[1]).toMatchObject({ neto: 100050, iva: 21010.5, total: 121060.5 });
    expect(r.registros).toHaveLength(2);
    expect(r.avisos.join(' ')).toMatch(/sin tipo de cambio/);
  });

  it('rechaza archivos que no son de Mis Comprobantes', () => {
    expect(() => parseMisComprobantes('hola;mundo\n1;2')).toThrow(/encabezados/);
  });
});

describe('Utilidades', () => {
  it('montos en distintos formatos', () => {
    expect(parseMonto('1.234,56')).toBe(1234.56);
    expect(parseMonto('1234,56')).toBe(1234.56);
    expect(parseMonto('1234.56')).toBe(1234.56);
    expect(parseMonto('$ -1.500')).toBe(-1500);
    expect(parseMonto('')).toBe(0);
  });
  it('campos con comillas y tipos de comprobante', () => {
    expect(separarCampos('a;"b;c";d', ';')).toEqual(['a', 'b;c', 'd']);
    expect(normalizarTipo('8 - Nota de Crédito B')).toBe('Nota de Crédito B');
    expect(normalizarTipo('11')).toBe('Factura C');
    expect(normalizarTipo('Factura A')).toBe('Factura A');
  });
});
