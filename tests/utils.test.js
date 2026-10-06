import { describe, it, expect } from 'vitest';
import {
  validarCUIT, cuitLastDigit, getVencimientos, categorizarRT54,
  RT54_COEF, RT54_BASE_MEDIANA, RT54_BASE_RESTANTE,
  sanitizeInput, sanitizeCSV, fmt, fmtDate
} from '../src/utils.js';

describe('validarCUIT (Módulo 11)', () => {
  it.each(['20-12345678-6', '30-99887766-7', '30-67890123-3', '30-44556677-9', '30-11223344-6', '30-55998877-0'])('acepta %s', (c) => {
    expect(validarCUIT(c)).toBe(true);
  });
  it.each(['20-12345678-9', '30-99887766-5', '30-71938495-2', '30-58472910-9'])('rechaza dígito verificador inválido %s', (c) => {
    expect(validarCUIT(c)).toBe(false);
  });
  it('acepta con o sin guiones/espacios', () => {
    expect(validarCUIT('20123456786')).toBe(true);
    expect(validarCUIT(' 20 12345678 6 ')).toBe(true);
  });
  it('rechaza largo distinto de 11 dígitos', () => {
    expect(validarCUIT('2012345678')).toBe(false);
    expect(validarCUIT('201234567860')).toBe(false);
    expect(validarCUIT('')).toBe(false);
  });
});

describe('cuitLastDigit', () => {
  it('devuelve la terminación con o sin guiones', () => {
    expect(cuitLastDigit('20-12345678-6')).toBe(6);
    expect(cuitLastDigit('30998877667')).toBe(7);
  });
});

describe('getVencimientos (calendario por terminación de CUIT)', () => {
  it.each([[0, 18], [1, 18], [2, 19], [3, 19], [4, 20], [5, 20], [6, 21], [7, 21], [8, 22], [9, 22]])(
    'IVA: terminación %i vence el día %i', (term, dia) => {
      expect(getVencimientos(`20-12345678-${term}`).iva.dia).toBe(dia);
    });
  it.each([[0, 5], [3, 5], [4, 6], [6, 6], [7, 7], [9, 7]])('Autónomos: terminación %i -> día %i', (term, dia) => {
    expect(getVencimientos(`20-12345678-${term}`).autonomos.dia).toBe(dia);
  });
  it.each([[0, 9], [3, 9], [4, 10], [6, 10], [7, 13], [9, 13]])('SUSS: terminación %i -> día %i', (term, dia) => {
    expect(getVencimientos(`20-12345678-${term}`).suss.dia).toBe(dia);
  });
  it('monotributo y casas particulares tienen vencimiento fijo', () => {
    const v = getVencimientos('20-12345678-6');
    expect(v.monotributo.dia).toBe(20);
    expect(v.casasParticulares.dia).toBe(10);
  });
});

describe('categorizarRT54 (umbrales reexpresados)', () => {
  const umbralMediana = RT54_BASE_MEDIANA * RT54_COEF;
  const umbralRestante = RT54_BASE_RESTANTE * RT54_COEF;
  it('0 y valores bajos son pequeña entidad', () => {
    expect(categorizarRT54(0)).toBe('pequena');
    expect(categorizarRT54(15_000_000)).toBe('pequena');
  });
  it('el umbral exacto de mediana todavía es pequeña; un peso más es mediana', () => {
    expect(categorizarRT54(umbralMediana)).toBe('pequena');
    expect(categorizarRT54(umbralMediana + 1)).toBe('mediana');
  });
  it('el umbral exacto de restante todavía es mediana; un peso más es restante', () => {
    expect(categorizarRT54(umbralRestante)).toBe('mediana');
    expect(categorizarRT54(umbralRestante + 1)).toBe('restante');
  });
});

describe('sanitizeInput (anti-XSS)', () => {
  it('escapa HTML, comillas y barras', () => {
    expect(sanitizeInput('<img src=x onerror="a()">')).toBe('&lt;img src=x onerror=&quot;a()&quot;&gt;');
    expect(sanitizeInput(`a&b'c/d`)).toBe('a&amp;b&#x27;c&#x2F;d');
  });
  it('null/undefined -> cadena vacía y números a texto', () => {
    expect(sanitizeInput(null)).toBe('');
    expect(sanitizeInput(undefined)).toBe('');
    expect(sanitizeInput(42)).toBe('42');
  });
  it('no deja pasar ningún "<" ni comillas dobles', () => {
    const out = sanitizeInput('"><svg onload=alert(1)>');
    expect(out).not.toMatch(/[<>"]/);
  });
});

describe('sanitizeCSV (inyección de fórmulas)', () => {
  it.each(['=SUM(A1)', '+cmd', '-1+1', '@SUM(A1)'])('neutraliza %s', (s) => {
    expect(sanitizeCSV(s).startsWith("'")).toBe(true);
  });
  it('deja intacto el texto normal y recorta espacios', () => {
    expect(sanitizeCSV('  Proveedor SA ')).toBe('Proveedor SA');
    expect(sanitizeCSV(null)).toBe('');
  });
});

describe('formato', () => {
  it('fmt usa formato es-AR con 2 decimales', () => {
    expect(fmt(1234.5)).toBe('1.234,50');
    expect(fmt(0)).toBe('0,00');
    expect(fmt(1234.567, 0)).toBe('1.235');
  });
  it('fmt tolera valores no numéricos', () => {
    expect(fmt(NaN)).toBe('0,00');
    expect(fmt('12')).toBe('0,00');
    expect(fmt(undefined)).toBe('0,00');
  });
  it('fmtDate pasa ISO a DD/MM/AAAA', () => {
    expect(fmtDate('2026-05-20')).toBe('20/05/2026');
    expect(fmtDate('')).toBe('');
  });
});
