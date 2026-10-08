import { describe, it, expect, vi } from 'vitest';

let condicion = 'Monotributo - Cat C';
vi.mock('../src/db/supabase.js', () => ({ isSupabaseConfigured: true, supabase: {}, getCachedRole: async () => 'estudio', SUPABASE_URL: 'x', SUPABASE_KEY: 'y' }));
vi.mock('../src/db/mockdb.js', () => ({
  getActiveCompanyAsync: async () => ({ id: 'co-1', razon_social: 'Cliente Real SRL', cuit: '20-12345678-6', condicion_iva: condicion, domicilio: 'X' }),
  getClienteFinalAsync: async () => null,
  getTransactionsAsync: async () => ({ ventas: [], compras: [] }),
  updateEmpresaFieldsAsync: async () => {}
}));
const { renderFacturar } = await import('../src/views/facturar.js');

describe('Guía de punto de venta', () => {
  it('monotributista: sistema Monotributo Web Services y solo Factura C', async () => {
    condicion = 'Monotributo - Cat C';
    const html = await renderFacturar();
    expect(html).toContain('¿Cómo creo un punto de venta?');
    expect(html).toContain('Factura Electrónica – Monotributo – Web Services');
    expect(html).toContain('>Factura C<');
    expect(html).not.toContain('>Factura A<');
  });
  it('responsable inscripto: RECE y facturas A/B, con aviso de delegación', async () => {
    condicion = 'Responsable Inscripto';
    const html = await renderFacturar();
    expect(html).toContain('RECE para aplicativo y web services');
    expect(html).toContain('>Factura A<');
    expect(html).toContain('delegar el servicio');
  });
});
