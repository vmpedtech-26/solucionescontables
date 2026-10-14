import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/supabase.js', () => ({ isSupabaseConfigured: true, supabase: {}, getCachedRole: async () => 'estudio', SUPABASE_URL: 'x', SUPABASE_KEY: 'y' }));
vi.mock('../src/db/mockdb.js', () => {
  const emp = { id: 'co-1', razon_social: 'Cliente SRL', cuit: '20-12345678-6', condicion_iva: 'Responsable Inscripto', delegation_active: false };
  return {
    getCompaniesAsync: async () => [emp],
    getActiveCompanyAsync: async () => emp,
    getEstudioAsync: async () => ({ id: 'e1', razon_social: 'Estudio', arca_model_type: 'hybrid', arca_cert_uploaded: false }),
    updateEstudioFieldsAsync: async () => {},
    updateEmpresaFieldsAsync: async () => {}
  };
});
const { renderConfiguracion } = await import('../src/views/configuracion.js');

describe('Configuración con cuenta real', () => {
  it('no muestra bloques simulados ni el cambio de base de datos', async () => {
    const html = await renderConfiguracion();
    expect(html).toContain('Conexión con ARCA');
    expect(html).toContain('¿Cómo factura el estudio por un cliente?');
    expect(html).toContain('Mis datos y privacidad');
    expect(html).not.toContain('Modelo de Vinculación ARCA');
    expect(html).not.toContain('Supabase Sync');
    expect(html).not.toContain('Robots RPA');
    expect(html).not.toContain('Control de CUITs Delegados');
  });
});
