import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/supabase.js', () => ({ isSupabaseConfigured: true, supabase: null }));
vi.mock('../src/db/mockdb.js', () => ({
  getActiveCompany: () => ({ id: 'co-x', razon_social: 'Cliente Real SRL', cuit: '20-12345678-6', condicion_iva: 'Monotributo - Cat C' }),
  getCompanies: () => [{ id: 'co-x', razon_social: 'Cliente Real SRL', cuit: '20-12345678-6', condicion_iva: 'Responsable Inscripto' }],
  getTransactions: () => ({
    ventas: [
      { id: 'v1', fecha: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-03`, cliente: 'A', cuit: '30-12345678-9', tipo_comprobante: 'Factura A', numero: '0001-1', neto: 1000, iva: 210, total: 1210 },
      { id: 'v2', fecha: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-04`, cliente: 'B', cuit: '30-12345678-9', tipo_comprobante: 'Factura A', numero: '0001-1', neto: 1000, iva: 210, total: 1210 }
    ],
    compras: []
  })
}));

const { renderDashboardHome } = await import('../src/views/dashboard_home.js');
const { getActivePeriod, periodLabel, periodOptions } = await import('../src/utils.js');

describe('dashboard en modo real', () => {
  beforeEach(() => { localStorage.clear(); });

  it('no muestra enlace ARCA simulado ni variaciones inventadas', () => {
    const html = renderDashboardHome();
    expect(html).toContain('Enlace con ARCA: no conectado');
    expect(html).not.toContain('Conectado de forma segura');
    expect(html).not.toContain('42ms');
    expect(html).not.toContain('+14.2%');
    expect(html).not.toContain('Estudio Contable Comahue');
  });

  it('arranca en el mes corriente y no en mayo 2026', () => {
    const d = new Date();
    const esperado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    expect(getActivePeriod()).toBe(esperado);
    expect(periodOptions()[0]).toBe(esperado);
    expect(periodLabel('2026-10')).toBe('Octubre 2026');
  });

  it('detecta comprobantes repetidos con controles reales', () => {
    const html = renderDashboardHome();
    expect(html).toContain('repetido');
  });

  it('usa el tope real de la categoría del monotributista', () => {
    const html = renderDashboardHome();
    expect(html).toContain('Control de Categoría C');
    expect(html).toContain('24.670.494');
  });

  it('marca las fechas de vencimiento como orientativas', () => {
    expect(renderDashboardHome()).toContain('orientativas');
  });
});
