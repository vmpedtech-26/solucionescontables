import { describe, it, expect, vi } from 'vitest';

vi.stubGlobal('window', {});
const { traerTodas } = await import('../src/db/supabase.js');

describe('traerTodas', () => {
  it('pagina hasta traer todas las filas', async () => {
    const total = Array.from({ length: 2500 }, (_, i) => i);
    const pedidos = [];
    const r = await traerTodas(async (d, h) => { pedidos.push([d, h]); return { data: total.slice(d, h + 1), error: null }; });
    expect(r.data).toHaveLength(2500);
    expect(pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('corta en una pagina exacta y propaga errores', async () => {
    const r = await traerTodas(async (d) => ({ data: d === 0 ? Array(1000).fill(1) : [], error: null }));
    expect(r.data).toHaveLength(1000);
    const e = await traerTodas(async () => ({ data: null, error: { code: '42P01' } }));
    expect(e).toEqual({ data: null, error: { code: '42P01' } });
  });
});
