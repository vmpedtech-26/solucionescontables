// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

const llamadas = [];
const factura = { id: 'v-cae-1', tipo_comprobante: 'Factura A', numero: '00003-00000851', fecha: '2026-10-05', cliente: 'METALURGICA SA',
  cuit: '30-71928371-9', neto: 2000, iva: 315, total: 2315, cae: '761', alicuotas: [{ alicuota: 21, neto: 1000, iva: 210 }, { alicuota: 10.5, neto: 1000, iva: 105 }] };
vi.mock('../src/db/supabase.js', () => ({ isSupabaseConfigured: true, supabase: {}, getCachedRole: async () => 'estudio', SUPABASE_URL: 'x', SUPABASE_KEY: 'y' }));
vi.mock('../src/db/mockdb.js', () => ({
  getActiveCompanyAsync: async () => ({ id: 'co-1', razon_social: 'Estudio SRL', cuit: '20-12345678-6', condicion_iva: 'Responsable Inscripto', domicilio: 'X' }),
  getClienteFinalAsync: async () => null,
  getTransactionsAsync: async () => ({ ventas: [factura], compras: [] }),
  updateEmpresaFieldsAsync: async () => {}
}));
vi.mock('../src/arca.js', () => ({
  AMBIENTE_LABEL: { homologacion: 'Homologación', produccion: 'Producción' },
  arca: async (accion, datos) => {
    llamadas.push([accion, datos]);
    if (accion === 'puntos_venta') return { ambiente: 'homologacion', puntos: [{ numero: 3, tipo: 'RECE', bloqueado: false, baja: null }] };
    return { resultado: 'A', cae: '999', caeVto: '2026-11-10', observaciones: [], errores: [], numero: '00003-00000012', tipo: 'Nota de Crédito A', neto: 2000, iva: 315, total: 2315, ambiente: 'homologacion' };
  }
}));
vi.mock('../src/domain/comprobante.js', async (orig) => ({ ...(await orig()), abrirComprobante: () => true }));
const { renderFacturar, initFacturar } = await import('../src/views/facturar.js');
const esperar = () => new Promise((r) => setTimeout(r, 0));

describe('Nota de crédito desde la pantalla de facturación', () => {
  beforeEach(() => { llamadas.length = 0; window.confirm = () => true; });

  it('elegir la factura original completa asociado, receptor y las dos alícuotas', async () => {
    document.body.innerHTML = await renderFacturar();
    await initFacturar({ showToast: vi.fn(), router: vi.fn() });
    const $ = (id) => document.getElementById(id);
    $('fac-tipo').value = '3'; $('fac-tipo').dispatchEvent(new Event('change'));
    expect($('fac-asoc').style.display).toBe('block');
    $('fac-asoc-lista').value = 'v-cae-1'; $('fac-asoc-lista').dispatchEvent(new Event('change'));
    await esperar(); await esperar();
    expect($('fac-asoc-pv').value).toBe('3');
    expect($('fac-asoc-nro').value).toBe('851');
    expect(document.querySelectorAll('.fac-item')).toHaveLength(2);
    expect($('fac-totales').textContent).toContain('Total $ 2.315,00');
    $('fac-detalle').value = 'Anulación';
    $('fac-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await esperar(); await esperar();
    const [accion, datos] = llamadas.find((l) => l[0] === 'emitir');
    expect(accion).toBe('emitir');
    expect(datos.cbteTipo).toBe(3);
    expect(datos.cbtesAsoc).toEqual([{ tipo: 1, ptoVta: 3, nro: 851, fecha: '2026-10-05' }]);
    expect(datos.items).toEqual([{ neto: 1000, alicuota: 21 }, { neto: 1000, alicuota: 10.5 }]);
    expect($('fac-resultado').textContent).toContain('Autorizada');
  });
});
