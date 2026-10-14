import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/supabase.js', () => ({ isSupabaseConfigured: true, supabase: {}, getCachedRole: async () => 'estudio' }));
vi.mock('../src/db/mockdb.js', () => {
  const vacia = { id: '', razon_social: 'Sin empresa seleccionada', cuit: '-', condicion_iva: 'Responsable Inscripto' };
  return {
    getActiveCompany: () => vacia,
    getActiveCompanyAsync: async () => vacia,
    getCompanies: () => [],
    getTransactions: () => ({ ventas: [], compras: [] }),
    addTransaction: () => {},
    addTransactionAsync: async () => {},
    getClienteFinalAsync: async () => null
  };
});

const { renderDashboardHome } = await import('../src/views/dashboard_home.js');
const { renderIVA } = await import('../src/views/iva.js');
const { renderImportacion } = await import('../src/views/importacion.js');
const { renderPortalCliente } = await import('../src/views/portal_cliente.js');

describe('Estudio nuevo sin empresas', () => {
  it('el dashboard muestra la bienvenida con los tres pasos', () => {
    const html = renderDashboardHome();
    expect(html).toContain('¡Bienvenido a Soluciones Contables!');
    expect(html).toContain('Cargá tu primera empresa');
    expect(html).toContain('Conectá ARCA');
    expect(html).not.toContain('Sin empresa seleccionada');
  });
  it('Libro IVA, importación y portal piden cargar una empresa primero', async () => {
    expect(renderIVA()).toContain('Para usar el Libro IVA primero cargá una empresa');
    expect(renderImportacion()).toContain('importación de comprobantes');
    expect(await renderPortalCliente()).toContain('Portal del Cliente primero cargá una empresa');
  });
});
