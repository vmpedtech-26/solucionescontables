import { describe, it, expect } from 'vitest';
import { fechaVencimiento, feriados, pascua, iso, obligacionesDe, vencimientosDelMes, siguienteFecha, generarICS } from '../src/domain/vencimientos.js';
import { itemsAgenda, filtrarItems } from '../src/views/agenda.js';

const cuit = (d) => `30-71234567-${d}`;

describe('Cronograma de ARCA por terminación de CUIT', () => {
  it('reproduce el cronograma oficial de octubre 2026', () => {
    const iva = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => fechaVencimiento('iva', cuit(d), 2026, 10));
    expect(iva).toEqual(['2026-10-19', '2026-10-19', '2026-10-20', '2026-10-20', '2026-10-21', '2026-10-21', '2026-10-22', '2026-10-22', '2026-10-23', '2026-10-23']);
    // Empleadores: el 12 es feriado, el grupo 4-6 pasa al 13
    expect([0, 4, 7].map((d) => fechaVencimiento('empleadores', cuit(d), 2026, 10))).toEqual(['2026-10-09', '2026-10-13', '2026-10-14']);
    expect([3, 6, 9].map((d) => fechaVencimiento('autonomos', cuit(d), 2026, 10))).toEqual(['2026-10-05', '2026-10-06', '2026-10-07']);
    expect([0, 5, 8].map((d) => fechaVencimiento('anticipos_ph', cuit(d), 2026, 10))).toEqual(['2026-10-13', '2026-10-14', '2026-10-15']);
    expect(fechaVencimiento('monotributo', cuit(9), 2026, 10)).toBe('2026-10-20');
  });

  it('corre por fin de semana y feriado', () => {
    // 20/06/2026 es sábado y feriado: el monotributo pasa al lunes 22
    expect(fechaVencimiento('monotributo', cuit(1), 2026, 6)).toBe('2026-06-22');
    // Diciembre 2026: 7 (puente) y 8 (feriado) → empleadores 0-3 el 9
    expect(fechaVencimiento('empleadores', cuit(0), 2026, 12)).toBe('2026-12-09');
  });

  it('feriados móviles: Pascua, Carnaval y Viernes Santo', () => {
    expect(iso(pascua(2026))).toBe('2026-04-05');
    expect(iso(pascua(2027))).toBe('2027-03-28');
    const f = feriados(2027);
    expect(f.has('2027-03-26')).toBe(true); // Viernes Santo
    expect(f.has('2027-02-08') && f.has('2027-02-09')).toBe(true); // Carnaval
  });

  it('anticipos de personas humanas solo en agosto, octubre, diciembre, febrero y abril', () => {
    expect(fechaVencimiento('anticipos_ph', cuit(0), 2026, 9)).toBeNull();
    const v = vencimientosDelMes([{ id: 'a', razon_social: 'Ana', cuit: '27-12345678-0', tipo: 'Unipersonal', condicion_iva: 'Responsable Inscripto' }], 2027, 2);
    expect(v.find((x) => x.obligacion === 'anticipos_ph').periodo).toBe('Anticipo 4 · período 2026');
  });

  it('obligaciones según perfil o las elegidas por el estudio', () => {
    expect(obligacionesDe({ cuit: '30-1', tipo: 'SRL', condicion_iva: 'Responsable Inscripto' })).toEqual(['iva', 'anticipos_soc']);
    expect(obligacionesDe({ cuit: '20-1', tipo: 'Unipersonal', condicion_iva: 'Monotributo - Cat C' })).toEqual(['monotributo']);
    expect(obligacionesDe({ cuit: '20-1', tipo: 'Unipersonal', condicion_iva: 'Responsable Inscripto' })).toEqual(['iva', 'autonomos', 'anticipos_ph']);
    expect(obligacionesDe({ obligaciones: ['iva', 'empleadores', 'inventada'] })).toEqual(['iva', 'empleadores']);
  });

  it('recurrencia ajusta fin de mes', () => {
    expect(siguienteFecha('2026-01-31', 'mensual')).toBe('2026-02-28');
    expect(siguienteFecha('2026-11-15', 'trimestral')).toBe('2027-02-15');
    expect(siguienteFecha('2026-03-10', 'anual')).toBe('2027-03-10');
    expect(siguienteFecha('2026-03-10', null)).toBeNull();
  });

  it('genera un .ics válido con texto escapado', () => {
    const ics = generarICS([{ uid: 'v:co-1', fecha: '2026-10-31', titulo: 'IVA; Panadería, SA', descripcion: 'a\nb' }], new Date('2026-10-01T00:00:00Z'));
    expect(ics).toContain('DTSTART;VALUE=DATE:20261031');
    expect(ics).toContain('DTEND;VALUE=DATE:20261101');
    expect(ics).toContain('SUMMARY:IVA\\; Panadería\\, SA');
    expect(ics).toContain('DESCRIPTION:a\\nb');
    expect(ics.split('\r\n').filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1);
  });
});

describe('Agenda: vencimientos + tareas', () => {
  const empresas = [{ id: 'co-1', razon_social: 'Panadería SA', cuit: cuit(4), tipo: 'SA', condicion_iva: 'Responsable Inscripto' }];
  const vencs = vencimientosDelMes(empresas, 2026, 10);

  it('un vencimiento marcado toma estado, responsable y fecha corregida de su tarea', () => {
    const tareas = [
      { id: 't1', empresa_id: 'co-1', origen: 'venc:iva:2026-10', estado: 'hecha', asignado_a: 'u-ana', vence: '2026-10-26' },
      { id: 't2', empresa_id: null, titulo: 'Cierre de balance', vence: '2026-10-05', estado: 'pendiente', recurrencia: 'anual' }
    ];
    const items = itemsAgenda(vencs, tareas, '2026-10-15');
    const iva = items.find((i) => i.venc?.obligacion === 'iva');
    expect(iva).toMatchObject({ estado: 'hecha', asignado_a: 'u-ana', fecha: '2026-10-26', fechaCalculada: '2026-10-21', atrasada: false });
    const anticipo = items.find((i) => i.venc?.obligacion === 'anticipos_soc');
    expect(anticipo.atrasada).toBe(true); // 14/10, sin marcar
    const general = items.find((i) => i.tipo === 'tarea');
    expect(general).toMatchObject({ titulo: 'Cierre de balance', atrasada: true, sub: 'Todos los años' });
    expect(items).toHaveLength(3); // t1 no se duplica como tarea suelta
  });

  it('filtra por responsable, estado y tipo', () => {
    const items = itemsAgenda(vencs, [{ id: 't1', empresa_id: 'co-1', origen: 'venc:iva:2026-10', estado: 'hecha', asignado_a: 'u-ana', vence: '2026-10-21' }], '2026-10-01');
    expect(filtrarItems(items, { responsable: 'mias' }, 'u-ana')).toHaveLength(1);
    expect(filtrarItems(items, { responsable: 'sin' }, 'u-ana')).toHaveLength(1);
    expect(filtrarItems(items, { estado: 'abiertas' })).toHaveLength(1);
    expect(filtrarItems(items, { tipo: 'tarea' })).toHaveLength(0);
  });
});
