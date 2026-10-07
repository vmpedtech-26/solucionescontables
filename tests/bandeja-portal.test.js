import { describe, it, expect, vi } from 'vitest';

const filas = [
  { id: 't-1', empresa_id: 'co-1', fecha: '2026-10-05', detalle: 'Factura A - Prov <b>X</b>', archivo: 'co-1/t-1.jpg', monto: '1210', estado: 'Recibido', proveedor: 'Prov <b>X</b>', cuit: '30-12345678-9', tipo_comprobante: 'Factura A', numero: '0001-00000010', empresas: { razon_social: 'Cliente Real SRL', cuit: '20-12345678-6' } },
  { id: 't-2', empresa_id: 'co-1', fecha: '2026-10-01', detalle: 'Ticket', archivo: 'sin archivo', monto: '500', estado: 'Rechazado', nota_estudio: 'Falta el CUIT', empresas: { razon_social: 'Cliente Real SRL' } }
];
const respuesta = () => { const p = Promise.resolve({ data: filas, error: null }); p.limit = () => Promise.resolve({ data: filas, error: null }); return p; };
const query = { select: () => query, order: respuesta, eq: () => query, single: () => Promise.resolve({ data: { id: 'co-1', razon_social: 'Cliente Real SRL', cuit: '20-12345678-6', condicion_iva: 'Responsable Inscripto' } }) };
vi.mock('../src/db/supabase.js', () => ({
  isSupabaseConfigured: true,
  getCachedRole: async () => 'cliente',
  supabase: { from: () => query, storage: { from: () => ({}) } }
}));
vi.mock('../src/db/mockdb.js', () => ({
  addTransactionAsync: async () => {},
  getActiveCompanyAsync: async () => ({ id: 'co-1', razon_social: 'Cliente Real SRL', cuit: '20-12345678-6', condicion_iva: 'Responsable Inscripto' }),
  getClienteFinalAsync: async () => ({ id: 'u1', empresa_id: 'co-1' })
}));

const { renderBandeja } = await import('../src/views/bandeja.js');
const { renderPortalCliente } = await import('../src/views/portal_cliente.js');

describe('Bandeja de clientes', () => {
  it('lista pendientes y resueltos, escapando HTML', async () => {
    const html = await renderBandeja();
    expect(html).toContain('1 pendiente');
    expect(html).toContain('Cargar al libro');
    expect(html).toContain('Falta el CUIT');
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('&lt;b&gt;X&lt;&#x2F;b&gt;');
  });
});

describe('Portal del cliente en modo real', () => {
  it('no muestra cupo OCR, Gemini ni facturador simulado', async () => {
    const html = await renderPortalCliente();
    expect(html).toContain('Enviar un comprobante');
    expect(html).not.toContain('ocr-quota-container');
    expect(html).not.toContain('gemini-status-card');
    expect(html).not.toContain('Emitir Factura Electrónica (ARCA Live)');
    expect(html).not.toContain('btn-simulate-ticket');
  });
  it('muestra el estado traducido de los comprobantes', async () => {
    const html = await renderPortalCliente();
    expect(html).toContain('En revisión');
    expect(html).toContain('Falta el CUIT');
  });
});
