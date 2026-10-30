import { describe, it, expect } from 'vitest';
import { leerTabla, autoMapear, convertirEmpresa, convertirComprobante, parseFecha, normalizarCondicionIva, inferirTipo, partirComprobante, tipoDesde, claveComprobante } from '../src/domain/migrador.js';

describe('Migrador: lectura y mapeo', () => {
  it('encuentra el encabezado aunque haya títulos arriba y detecta el separador', () => {
    const csv = 'Estudio X - Listado de clientes\r\nEmitido el 30/10/2026\r\nCódigo;Razón Social;C.U.I.T.;Condición IVA;Domicilio\r\n001;"Panadería; La Espiga SRL";30-71234567-1;Responsable Inscripto;San Martín 123\r\n\r\n002;Juan Pérez;20123456786;Monotributo Cat. C;Belgrano 9\r\n';
    const t = leerTabla(csv);
    expect(t.separador).toBe(';');
    expect(t.encabezados).toEqual(['Código', 'Razón Social', 'C.U.I.T.', 'Condición IVA', 'Domicilio']);
    expect(t.filas).toHaveLength(2);
    expect(t.filas[0][1]).toBe('Panadería; La Espiga SRL');
    const m = autoMapear(t.encabezados, 'empresas');
    expect(m).toMatchObject({ razon_social: 1, cuit: 2, condicion_iva: 3, domicilio: 4, tipo: -1 });
  });

  it('mapea un subdiario de IVA estilo Tango', () => {
    const enc = ['Fecha', 'Tipo', 'Comprobante', 'Razón social', 'CUIT', 'Neto Gravado', 'IVA 21%', 'Exento', 'Total'];
    expect(autoMapear(enc, 'comprobantes')).toMatchObject({ fecha: 0, tipo_comprobante: 1, comprobante: 2, nombre: 3, cuit: 4, neto: 5, iva: 6, exento: 7, total: 8 });
  });
});

describe('Migrador: conversión de clientes', () => {
  const mapa = { razon_social: 0, cuit: 1, condicion_iva: 2, categoria: -1, tipo: -1, inicio_actividades: 3, domicilio: -1, iibb: -1, actividad: -1 };

  it('normaliza condición, tipo y fecha', () => {
    const r = convertirEmpresa(['Metalúrgica Sur S.A.', '30712345671', 'IVA Responsable Inscripto', '01/03/2015'], mapa);
    expect(r.errores).toEqual([]);
    expect(r.valor).toMatchObject({ razon_social: 'Metalúrgica Sur S.A.', cuit: '30-71234567-1', condicion_iva: 'Responsable Inscripto', tipo: 'SA', inicio_actividades: '2015-03-01' });
  });

  it('rechaza CUIT inválido y avisa monotributo sin categoría', () => {
    expect(convertirEmpresa(['X', '30-71234567-2', 'RI', ''], mapa).errores[0]).toMatch(/CUIT inválido/);
    const r = convertirEmpresa(['Ana Gómez', '27-12345678-0', 'Monotributista', ''], mapa);
    expect(r.valor).toMatchObject({ condicion_iva: 'Monotributo - Cat A', tipo: 'Unipersonal' });
    expect(r.avisos.join()).toMatch(/sin categoría/);
  });

  it('reconoce variantes de condición y tipo', () => {
    expect(normalizarCondicionIva('Responsable Monotributo', 'F')).toBe('Monotributo - Cat F');
    expect(normalizarCondicionIva('MONOTRIBUTO CAT. H')).toBe('Monotributo - Cat H');
    expect(normalizarCondicionIva('IVA Exento')).toBe('Exento');
    expect(normalizarCondicionIva('RI')).toBe('Responsable Inscripto');
    expect(normalizarCondicionIva('Consumidor final')).toBeNull();
    expect(inferirTipo('', 'Agro S.A.S.', '30-1')).toBe('SAS');
    expect(inferirTipo('', 'Transporte S. R. L.', '30-1')).toBe('SRL');
    expect(inferirTipo('', 'Sucesión de Pérez', '30-1')).toBe('Sucesion Indivisa');
    expect(inferirTipo('', 'Distribuidora Norte', '30-1')).toBeNull();
  });
});

describe('Migrador: conversión de comprobantes', () => {
  it('fechas en varios formatos', () => {
    expect(parseFecha('5/1/2026')).toBe('2026-01-05');
    expect(parseFecha('05-01-26')).toBe('2026-01-05');
    expect(parseFecha('2026-01-05')).toBe('2026-01-05');
    expect(parseFecha('46027')).toBe('2026-01-05'); // serie de Excel
    expect(parseFecha('31/02/2026')).toBeNull();
    expect(parseFecha('')).toBeNull();
  });

  it('parte el comprobante y arma el tipo', () => {
    expect(partirComprobante('A 0003-00001234')).toEqual({ letra: 'A', pv: 3, nro: 1234 });
    expect(partirComprobante('FC B 0001 00000077')).toEqual({ letra: 'B', pv: 1, nro: 77 });
    expect(tipoDesde('FC', 'A')).toBe('Factura A');
    expect(tipoDesde('NC B', '')).toBe('Nota de Crédito B');
    expect(tipoDesde('11', '')).toBe('Factura C');
    expect(tipoDesde('', 'C')).toBe('Factura C');
  });

  it('convierte una fila de Tango y detecta inconsistencias', () => {
    const mapa = { fecha: 0, tipo_comprobante: 1, letra: -1, pv: -1, numero: -1, comprobante: 2, nombre: 3, cuit: 4, neto: 5, iva: 6, exento: -1, total: 7 };
    const r = convertirComprobante(['15/10/2026', 'FC', 'A 0003-00001234', 'Cliente SA', '30712345671', '1.000,00', '210,00', '1.210,00'], mapa);
    expect(r.errores).toEqual([]);
    expect(r.avisos).toEqual([]);
    expect(r.valor).toMatchObject({ fecha: '2026-10-15', tipo_comprobante: 'Factura A', numero: '00003-00001234', cuit: '30-71234567-1', neto: 1000, iva: 210, total: 1210 });
    const mal = convertirComprobante(['15/10/2026', 'FC', 'A 0003-00001235', 'X', '30712345671', '1.000,00', '210,00', '1.500,00'], mapa);
    expect(mal.avisos.join()).toMatch(/no coincide/);
  });

  it('importes negativos se toman como nota de crédito', () => {
    const mapa = { fecha: 0, tipo_comprobante: 1, comprobante: 2, total: 3, neto: 4, iva: 5 };
    const r = convertirComprobante(['01/10/2026', 'Factura B', 'B 0001-00000009', '-121', '-100', '-21'], mapa);
    expect(r.valor).toMatchObject({ tipo_comprobante: 'Nota de Crédito B', total: 121, neto: 100, iva: 21 });
  });

  it('sin neto ni IVA toma el total como neto y avisa', () => {
    const r = convertirComprobante(['01/10/2026', '11', '0002-00000005', '5000'], { fecha: 0, tipo_comprobante: 1, comprobante: 2, total: 3 });
    expect(r.valor).toMatchObject({ tipo_comprobante: 'Factura C', neto: 5000, iva: 0, numero: '00002-00000005' });
    expect(r.avisos.join()).toMatch(/total como neto/);
  });

  it('la clave de duplicados ignora el formato del CUIT', () => {
    expect(claveComprobante({ cuit: '30-71234567-1', tipo_comprobante: '1', numero: '00003-00001234' }))
      .toBe(claveComprobante({ cuit: '30712345671', tipo_comprobante: 'Factura A', numero: '00003-00001234' }));
  });
});
