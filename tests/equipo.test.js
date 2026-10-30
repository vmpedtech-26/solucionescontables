// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISOS, validarInvitacion, puedeModificar, vencida, linkEquipo, nuevoCodigo } from '../src/domain/equipo.js';

// Base falsa: cada from(tabla) arma una consulta encadenable y registra lo que se escribe
const escrituras = [];
const tablas = {};
function consulta(tabla) {
  const q = { tabla, op: 'select', filtros: [], campos: null };
  const resultado = () => {
    if (q.op === 'select') return { data: tablas[tabla] || [], error: null };
    escrituras.push({ tabla, op: q.op, campos: q.campos, filtros: q.filtros });
    return { data: [{ user_id: 'x' }], error: null };
  };
  const api = {
    select: () => api, order: () => api,
    eq: (c, v) => { q.filtros.push([c, v]); return api; },
    in: (c, v) => { q.filtros.push([c, v]); return api; },
    insert: (campos) => { q.op = 'insert'; q.campos = campos; return api; },
    update: (campos) => { q.op = 'update'; q.campos = campos; return api; },
    delete: () => { q.op = 'delete'; return api; },
    then: (ok, mal) => Promise.resolve(resultado()).then(ok, mal)
  };
  return api;
}
vi.mock('../src/db/supabase.js', () => ({
  isSupabaseConfigured: true,
  supabase: { from: (t) => consulta(t), auth: { getUser: async () => ({ data: { user: { id: 'u-titular' } } }) } },
  getEstudioId: async () => 'u-titular',
  getRolEquipo: async () => 'titular'
}));
vi.mock('../src/db/mockdb.js', () => ({
  getEstudioAsync: async () => ({ id: 'u-titular', email: 'titular@estudio.com' }),
  getCompaniesAsync: async () => [{ id: 'co-1', razon_social: 'Panadería SA', cuit: '30-1' }, { id: 'co-2', razon_social: 'Taller SRL', cuit: '30-2' }]
}));
const { renderEquipo, initEquipo } = await import('../src/views/equipo.js');
const esperar = async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); };

describe('Reglas del equipo', () => {
  it('solo titular y administrador gestionan equipo y certificado; el asistente no crea empresas', () => {
    expect(PERMISOS.gestionarEquipo('titular')).toBe(true);
    expect(PERMISOS.gestionarEquipo('administrador')).toBe(true);
    expect(PERMISOS.gestionarEquipo('contador')).toBe(false);
    expect(PERMISOS.certificadoArca('asistente')).toBe(false);
    expect(PERMISOS.crearEmpresa('contador')).toBe(true);
    expect(PERMISOS.crearEmpresa('asistente')).toBe(false);
    expect(PERMISOS.verTodasLasEmpresas('asistente')).toBe(false);
    expect(PERMISOS.crearEmpresa('cualquiera')).toBe(false);
  });

  it('valida la invitación: rol, email y duplicados', () => {
    expect(validarInvitacion({ email: '', rol: 'contador' })).toBeNull();
    expect(validarInvitacion({ email: 'a@b.com', rol: 'titular' })).toMatch(/rol/);
    expect(validarInvitacion({ email: 'no-es-mail', rol: 'contador' })).toMatch(/email/);
    expect(validarInvitacion({ email: 'Ana@B.com', rol: 'asistente' }, [{ email: 'ana@b.com' }])).toMatch(/ya está/);
    expect(validarInvitacion({ email: 'ana@b.com', rol: 'asistente' }, [], [{ email: 'ANA@b.com' }])).toMatch(/pendiente/);
  });

  it('nadie modifica al titular ni a sí mismo; solo los administradores modifican', () => {
    const ana = { user_id: 'u-ana', rol: 'contador' };
    expect(puedeModificar('titular', 'u-t', ana)).toBe(true);
    expect(puedeModificar('administrador', 'u-adm', ana)).toBe(true);
    expect(puedeModificar('contador', 'u-c', ana)).toBe(false);
    expect(puedeModificar('administrador', 'u-adm', { user_id: 'u-adm', rol: 'administrador' })).toBe(false);
    expect(puedeModificar('administrador', 'u-adm', { user_id: 'u-t', rol: 'titular' })).toBe(false);
  });

  it('códigos de 16 hex, link de registro y vencimiento', () => {
    expect(nuevoCodigo()).toMatch(/^[0-9A-F]{16}$/);
    expect(linkEquipo('ABC', 'https://x.site/')).toBe('https://x.site/#/registro-equipo?codigo=ABC');
    expect(vencida({ expira_en: '2026-01-01T00:00:00Z' }, new Date('2026-02-01'))).toBe(true);
    expect(vencida({ expira_en: '2026-03-01T00:00:00Z' }, new Date('2026-02-01'))).toBe(false);
  });
});

describe('Pantalla de equipo', () => {
  beforeEach(() => {
    escrituras.length = 0;
    tablas.estudio_miembros = [
      { user_id: 'u-ana', email: 'ana@estudio.com', nombre: 'Ana Pérez', rol: 'asistente', activo: true, created_at: '2026-10-01' },
      { user_id: 'u-leo', email: 'leo@estudio.com', nombre: null, rol: 'contador', activo: false, created_at: '2026-10-02' }
    ];
    tablas.invitaciones_equipo = [{ codigo: 'AAAABBBBCCCCDDDD', email: null, rol: 'contador', expira_en: '2099-01-01', created_at: '2026-10-20' }];
    tablas.empresa_asignaciones = [{ empresa_id: 'co-1', user_id: 'u-ana' }];
    window.confirm = () => true;
    Object.assign(navigator, { clipboard: { writeText: vi.fn(async () => {}) } });
  });

  const montar = async () => {
    document.body.innerHTML = `<div id="view-root">${await renderEquipo()}</div>`;
    const app = { showToast: vi.fn() };
    await initEquipo(app);
    await esperar();
    return app;
  };

  it('lista titular, miembros, empresas del asistente e invitaciones', async () => {
    await montar();
    const texto = document.getElementById('eq-miembros').textContent;
    expect(texto).toContain('titular@estudio.com');
    expect(texto).toContain('Ana Pérez');
    expect(texto).toContain('Empresas: Panadería SA');
    expect(texto).toContain('sin acceso');
    expect(document.getElementById('eq-invitaciones').textContent).toContain('Cualquier persona con el link');
  });

  it('invitar crea el código con estudio, rol y email, y copia el link', async () => {
    await montar();
    document.getElementById('eq-email').value = 'nueva@estudio.com';
    document.getElementById('eq-rol').value = 'asistente';
    document.getElementById('eq-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await esperar();
    const alta = escrituras.find((e) => e.tabla === 'invitaciones_equipo' && e.op === 'insert');
    expect(alta.campos).toMatchObject({ estudio_id: 'u-titular', email: 'nueva@estudio.com', rol: 'asistente' });
    expect(alta.campos.codigo).toMatch(/^[0-9A-F]{16}$/);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining(`#/registro-equipo?codigo=${alta.campos.codigo}`));
  });

  it('no invita a alguien que ya está en el equipo', async () => {
    const app = await montar();
    document.getElementById('eq-email').value = 'ANA@estudio.com';
    document.getElementById('eq-form').dispatchEvent(new Event('submit', { cancelable: true }));
    await esperar();
    expect(escrituras.some((e) => e.tabla === 'invitaciones_equipo')).toBe(false);
    expect(app.showToast).toHaveBeenCalledWith(expect.stringMatching(/ya está/), 'error');
  });

  it('cambia el rol, reactiva y asigna empresas al asistente', async () => {
    await montar();
    const sel = document.querySelector('.eq-rol-miembro[data-id="u-leo"]');
    sel.value = 'administrador';
    sel.dispatchEvent(new Event('change'));
    await esperar();
    expect(escrituras).toContainEqual(expect.objectContaining({ tabla: 'estudio_miembros', op: 'update', campos: { rol: 'administrador' }, filtros: [['user_id', 'u-leo']] }));

    document.querySelector('.eq-activo[data-id="u-leo"]').click();
    await esperar();
    expect(escrituras).toContainEqual(expect.objectContaining({ tabla: 'estudio_miembros', op: 'update', campos: { activo: true } }));

    document.querySelector('.eq-asignar[data-id="u-ana"]').click();
    const [c1, c2] = document.querySelectorAll('#eq-asig-lista input');
    expect(c1.checked).toBe(true);
    c1.checked = false; c2.checked = true;
    document.getElementById('eq-asig-guardar').click();
    await esperar();
    expect(escrituras).toContainEqual(expect.objectContaining({ tabla: 'empresa_asignaciones', op: 'insert', campos: [{ empresa_id: 'co-2', user_id: 'u-ana' }] }));
    expect(escrituras).toContainEqual(expect.objectContaining({ tabla: 'empresa_asignaciones', op: 'delete', filtros: [['user_id', 'u-ana'], ['empresa_id', ['co-1']]] }));
  });
});
