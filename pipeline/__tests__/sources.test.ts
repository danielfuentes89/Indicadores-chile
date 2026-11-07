import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildBcchUrl, parseBcch } from '../sources/bcch.ts';
import { buildCmfUrl, parseChileanNumber, parseCmf } from '../sources/cmf.ts';
import { parseImf } from '../sources/imf.ts';
import { parseMindicador, parseMindicadorDate } from '../sources/mindicador.ts';
import { buildWorldBankUrl, parseWorldBank } from '../sources/worldbank.ts';

const fixture = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));

describe('Banco Central (BDE)', () => {
  it('arma la URL de GetSeries con credenciales', () => {
    const url = new URL(buildBcchUrl({ BCCH_USER: 'a@b.cl', BCCH_PASS: 'x' }, 'F073.TCO.PRE.Z.D', '2026-01-01', '2026-01-31'));
    expect(url.searchParams.get('function')).toBe('GetSeries');
    expect(url.searchParams.get('timeseries')).toBe('F073.TCO.PRE.Z.D');
    expect(url.searchParams.get('firstdate')).toBe('2026-01-01');
    expect(url.searchParams.get('user')).toBe('a@b.cl');
  });

  it('convierte observaciones y descarta valores no disponibles', () => {
    const body = {
      Codigo: 0,
      Descripcion: 'Success',
      Series: {
        seriesId: 'F073.TCO.PRE.Z.D',
        Obs: [
          { indexDateString: '02-01-2026', value: '950.12', statusCode: 'OK' },
          { indexDateString: '03-01-2026', value: 'NaN', statusCode: 'ND' },
          { indexDateString: '05-01-2026', value: '951.5', statusCode: 'OK' },
        ],
      },
    };
    expect(parseBcch(body, 'F073.TCO.PRE.Z.D')).toEqual([
      ['2026-01-02', 950.12],
      ['2026-01-05', 951.5],
    ]);
  });

  it('informa el error de credenciales (respuesta real de la API)', () => {
    const body = { Codigo: -5, Descripcion: 'Invalid username or password', Series: { seriesId: null, Obs: null }, SeriesInfos: [] };
    expect(() => parseBcch(body, 'X')).toThrow(/-5: Invalid username or password/);
  });
});

describe('CMF', () => {
  it('interpreta números con formato chileno', () => {
    expect(parseChileanNumber('41.284,83')).toBe(41284.83);
    expect(parseChileanNumber('-0,2')).toBe(-0.2);
  });

  it('toma el primer arreglo de la respuesta', () => {
    expect(parseCmf({ UFs: [{ Valor: '41.284,83', Fecha: '2026-11-07' }] })).toEqual([['2026-11-07', 41284.83]]);
  });

  it('informa el error de API key (respuesta real de la API)', () => {
    expect(() => parseCmf({ CodigoHTTP: 421, CodigoError: 91, Mensaje: 'API key no valida' })).toThrow(/API key no valida/);
  });

  it('arma la URL de período', () => {
    expect(buildCmfUrl('k', 'dolar', '2025-03-10', '2026-01-02')).toContain('/dolar/periodo/2025/03/2026/01?apikey=k&formato=json');
  });
});

describe('mindicador.cl', () => {
  it('convierte la medianoche chilena (UTC-3 y UTC-4) al día correcto', () => {
    expect(parseMindicadorDate('2025-12-30T03:00:00.000Z')).toBe('2025-12-30');
    expect(parseMindicadorDate('2026-09-01T04:00:00.000Z')).toBe('2026-09-01');
  });

  it('parsea una respuesta real', () => {
    const obs = parseMindicador(fixture('mindicador-uf-2026.json'));
    expect(obs.length).toBe(5);
    for (const [d, v] of obs) {
      expect(d).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(v).toBeGreaterThan(30000);
    }
  });
});

describe('Banco Mundial', () => {
  it('agrupa por país y agregado', () => {
    const byCountry = parseWorldBank(fixture('wb-le.json'));
    expect([...byCountry.keys()].sort()).toEqual(['CHL', 'LCN', 'OED']);
    const chl = byCountry.get('CHL')!;
    expect(chl[0][0] < chl[chl.length - 1][0]).toBe(true);
    expect(chl.find(([d]) => d === '2024-01-01')?.[1]).toBeCloseTo(81.359, 3);
  });

  it('propaga mensajes de error de la API', () => {
    expect(() => parseWorldBank(fixture('wb-error.json'))).toThrow(/not found/);
  });

  it('agrega parámetros extra (WGI usa source=3)', () => {
    const url = buildWorldBankUrl('GOV_WGI_CC.EST', ['CHL'], 1996, 2026, { source: '3' });
    expect(url).toContain('/country/CHL/indicator/GOV_WGI_CC.EST');
    expect(url).toContain('source=3');
  });
});

describe('FMI', () => {
  it('parsea por país en orden cronológico', () => {
    const byCountry = parseImf(fixture('imf-debt.json'), 'GGXWDG_NGDP');
    const chl = byCountry.get('CHL')!;
    expect(chl[0][0]).toBe('2020-01-01');
    expect(byCountry.has('ADVEC')).toBe(true);
  });
});
