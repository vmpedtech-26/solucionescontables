import { describe, it, expect } from 'vitest';
import { urlQR, htmlComprobante } from '../src/domain/comprobante.js';

const emisor = { razon_social: 'Cliente <Real> SRL', cuit: '20-12345678-6', condicion_iva: 'Responsable Inscripto', domicilio: 'Av. Argentina 100, Neuquén', inicio_actividades: '2020-01-01' };
const cbte = { tipo: 'Factura B', numero: '00003-00000151', fecha: '2026-10-08', cae: '76123456789012', caeVto: '2026-10-18', concepto: 1, neto: 1000, iva: 210, alicuota: 21, total: 1210 };

describe('QR de comprobante (RG 4892)', () => {
  it('codifica el JSON con tipos numéricos', () => {
    const url = urlQR({ fecha: '2026-10-08', cuitEmisor: '20-12345678-6', ptoVta: '00003', tipoCmp: 6, nroCmp: '00000151', importe: 1210, docTipo: 99, docNro: '0', cae: '76123456789012' });
    expect(url.startsWith('https://www.afip.gob.ar/fe/qr/?p=')).toBe(true);
    const json = JSON.parse(Buffer.from(url.split('?p=')[1], 'base64').toString('utf8'));
    expect(json).toEqual({ ver: 1, fecha: '2026-10-08', cuit: 20123456786, ptoVta: 3, tipoCmp: 6, nroCmp: 151, importe: 1210, moneda: 'PES', ctz: 1, tipoDocRec: 99, nroDocRec: 0, tipoCodAut: 'E', codAut: 76123456789012 });
  });
});

describe('Comprobante imprimible', () => {
  it('muestra letra, código, CAE, IVA discriminado y escapa HTML', () => {
    const html = htmlComprobante({ emisor, cbte, receptor: { nombre: 'Consumidor Final', docTipo: 99, docNro: '0' }, detalle: 'Servicio' });
    expect(html).toContain('COD. 006');
    expect(html).toContain('76123456789012');
    expect(html).toContain('IVA 21%');
    expect(html).toContain('<svg');
    expect(html).not.toContain('<Real>');
    expect(html).not.toContain('SIN VALIDEZ FISCAL');
  });
  it('Factura C no discrimina IVA y homologación lleva leyenda', () => {
    const html = htmlComprobante({ emisor, cbte: { ...cbte, tipo: 'Factura C', iva: 0, total: 1000, homologacion: true }, receptor: { docTipo: 99 }, detalle: '' });
    expect(html).toContain('COD. 011');
    expect(html).not.toContain('IVA 21%');
    expect(html).toContain('SIN VALIDEZ FISCAL');
  });
});
