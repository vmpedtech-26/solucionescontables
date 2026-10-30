import { describe, it, expect } from 'vitest';
import { normalizar, cuitValido, tipoDesde, bloqueArchivo, ESQUEMA } from '../supabase/functions/leer-comprobante/lectura.js';

const EMPRESA = '20-27458921-4';
const base = {
  es_comprobante: true, tipo_codigo: 1, letra: 'A', descripcion_tipo: 'FACTURA', punto_venta: 3, numero: 1234, fecha: '2026-10-15',
  emisor_cuit: '30712345671', emisor_razon_social: 'Proveedora SA', receptor_cuit: '20274589214', receptor_razon_social: 'Cliente',
  moneda: 'PES', tipo_cambio: 1, alicuotas: [{ alicuota: 21, base: 1000, iva: 210 }, { alicuota: 10.5, base: 200, iva: 21 }],
  neto_gravado: 1200, exento: 50, no_gravado: 0, percepciones_y_otros: 30, total: 1511, cae: '76123456789012', cae_vencimiento: '2026-10-25', observaciones: ''
};

describe('lectura de comprobantes con IA', () => {
  it('valida el digito verificador del CUIT', () => {
    expect(cuitValido('20-27458921-4')).toBe(true);
    expect(cuitValido('30712345671')).toBe(true);
    expect(cuitValido('30712345673')).toBe(false);
    expect(cuitValido('123')).toBe(false);
  });

  it('arma una compra con alicuotas, exento y percepciones', () => {
    const r = normalizar(base, EMPRESA);
    expect(r.ok).toBe(true);
    expect(r.libro).toBe('compras');
    expect(r.advertencias).toEqual([]);
    expect(r.comprobante).toMatchObject({
      fecha: '2026-10-15', tipo_comprobante: 'Factura A', numero: '00003-00001234', cuit: '30-71234567-1', contraparte: 'Proveedora SA',
      neto: 1200, iva: 231, total: 1511, importe_exento: 50, otros_tributos: 30, cae: '76123456789012'
    });
    expect(r.comprobante.alicuotas).toEqual([{ alicuota: 21, base: 1000, importe: 210 }, { alicuota: 10.5, base: 200, importe: 21 }]);
  });

  it('detecta una venta cuando el emisor es la empresa', () => {
    const r = normalizar({ ...base, emisor_cuit: '20274589214', receptor_cuit: '30712345671', receptor_razon_social: 'Comprador SRL' }, EMPRESA);
    expect(r.libro).toBe('ventas');
    expect(r.comprobante.contraparte).toBe('Comprador SRL');
    expect(r.comprobante.cuit).toBe('30-71234567-1');
  });

  it('advierte totales que no cierran, CUIT invalido y comprobante a nombre de otro', () => {
    const r = normalizar({ ...base, total: 2000, emisor_cuit: '30712345673', receptor_cuit: '20111111112' }, EMPRESA);
    const txt = r.advertencias.join(' | ');
    expect(txt).toMatch(/no coincide con el total/);
    expect(txt).toMatch(/dígito verificador/);
    expect(txt).toMatch(/no está a nombre de esta empresa/);
  });

  it('advierte IVA mal calculado y moneda extranjera', () => {
    const r = normalizar({ ...base, alicuotas: [{ alicuota: 21, base: 1000, iva: 150 }], moneda: 'DOL', tipo_cambio: 1000, total: 1230 }, EMPRESA);
    expect(r.advertencias.join(' ')).toMatch(/IVA 21% \(150\) no coincide/);
    expect(r.advertencias.join(' ')).toMatch(/DOL/);
  });

  it('en facturas B y C no discrimina IVA', () => {
    const r = normalizar({ ...base, tipo_codigo: 11, letra: 'C', alicuotas: [], neto_gravado: 0, exento: 0, percepciones_y_otros: 0, total: 5000 }, EMPRESA);
    expect(r.comprobante).toMatchObject({ tipo_comprobante: 'Factura C', neto: 5000, iva: 0, alicuotas: [] });
  });

  it('infiere el tipo sin codigo y rechaza lo que no es comprobante', () => {
    expect(tipoDesde({ tipo_codigo: 0, letra: 'b', descripcion_tipo: 'Nota de Crédito' })).toBe('Nota de Crédito B');
    expect(tipoDesde({ tipo_codigo: 0, letra: '', descripcion_tipo: 'Recibo' })).toBe('Recibo');
    const r = normalizar({ ...base, es_comprobante: false, observaciones: 'Es una foto de un perro.' });
    expect(r).toEqual({ ok: false, advertencias: ['Es una foto de un perro.'] });
  });

  it('descarta fechas invalidas', () => {
    const r = normalizar({ ...base, fecha: '2026-02-30', cae_vencimiento: '' }, EMPRESA);
    expect(r.comprobante.fecha).toBe('');
    expect(r.advertencias).toContain('No se leyó una fecha válida.');
  });

  it('arma el bloque correcto para PDF e imagen y el esquema exige todos los campos', () => {
    expect(bloqueArchivo('application/pdf', 'x').type).toBe('document');
    expect(bloqueArchivo('image/png', 'x')).toEqual({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'x' } });
    expect(ESQUEMA.required.sort()).toEqual(Object.keys(ESQUEMA.properties).sort());
  });
});
