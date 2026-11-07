import { describe, expect, it } from 'vitest';
import { fetchIndicator, type FetchOptions } from '../fetch-indicator.ts';
import { IndicatorSpec, type SeriesFile, type SourceId } from '../schema.ts';
import type { Source } from '../types.ts';

function fakeSource(id: SourceId, impl: Partial<Source> = {}): Source {
  return {
    id,
    incremental: true,
    missingConfig: () => null,
    fetch: async () => ({ observations: [] }),
    ...impl,
  };
}

const spec = IndicatorSpec.parse({
  id: 'dolar',
  area: 'economia',
  name: { es: 'Dólar', en: 'Dollar' },
  description: { es: 'd', en: 'd' },
  unit: { es: 'pesos', en: 'pesos' },
  frequency: 'D',
  start: '2026-01-01',
  providers: [
    { source: 'bcch', code: 'F073' },
    { source: 'mindicador', code: 'dolar' },
  ],
});

function options(sources: Partial<Record<SourceId, Source>>, extra: Partial<FetchOptions> = {}): FetchOptions {
  const all = Object.fromEntries(
    (['bcch', 'cmf', 'mindicador', 'worldbank', 'imf'] as SourceId[]).map((id) => [id, sources[id] ?? fakeSource(id)]),
  ) as Record<SourceId, Source>;
  return { today: '2026-03-01', env: {}, http: { getJson: async () => ({}) }, sources: all, ...extra };
}

describe('fetchIndicator', () => {
  it('usa el respaldo cuando faltan credenciales del proveedor principal', async () => {
    const out = await fetchIndicator(
      spec,
      null,
      options({
        bcch: fakeSource('bcch', { missingConfig: () => 'faltan credenciales' }),
        mindicador: fakeSource('mindicador', { fetch: async () => ({ observations: [['2026-01-02', 900]] }) }),
      }),
    );
    expect(out.status.ok).toBe(true);
    expect(out.file?.source).toBe('mindicador');
    expect(out.status.attempts[0]).toEqual({ source: 'bcch', error: 'omitida: faltan credenciales' });
  });

  it('usa el respaldo cuando el principal falla y lo informa', async () => {
    const out = await fetchIndicator(
      spec,
      null,
      options({
        bcch: fakeSource('bcch', { fetch: async () => { throw new Error('BDE -5'); } }),
        mindicador: fakeSource('mindicador', { fetch: async () => ({ observations: [['2026-01-02', 900]] }) }),
      }),
    );
    expect(out.file?.source).toBe('mindicador');
    expect(out.status.attempts).toEqual([{ source: 'bcch', error: 'BDE -5' }]);
  });

  it('conserva el archivo existente si todas las fuentes fallan', async () => {
    const fail = async () => { throw new Error('caída'); };
    const out = await fetchIndicator(spec, null, options({ bcch: fakeSource('bcch', { fetch: fail }), mindicador: fakeSource('mindicador', { fetch: fail }) }));
    expect(out.file).toBeNull();
    expect(out.status.ok).toBe(false);
  });

  it('actualiza de forma incremental desde la última fecha menos la ventana de revisión', async () => {
    const existing: SeriesFile = {
      id: 'dolar', source: 'bcch', code: 'F073', fetchedAt: 'x',
      observations: [['2026-01-02', 900], ['2026-02-20', 910]],
    };
    let askedFrom = '';
    const out = await fetchIndicator(
      spec,
      existing,
      options({
        bcch: fakeSource('bcch', {
          fetch: async (ctx) => {
            askedFrom = ctx.from;
            return { observations: [['2026-02-20', 911], ['2026-02-23', 915]] };
          },
        }),
      }),
    );
    expect(askedFrom).toBe('2026-01-20');
    expect(out.file?.observations).toEqual([['2026-01-02', 900], ['2026-02-20', 911], ['2026-02-23', 915]]);
  });

  it('descarga la historia completa al cambiar de proveedor', async () => {
    const existing: SeriesFile = { id: 'dolar', source: 'mindicador', code: 'dolar', fetchedAt: 'x', observations: [['2026-01-05', 1]] };
    let askedFrom = '';
    const out = await fetchIndicator(
      spec,
      existing,
      options({ bcch: fakeSource('bcch', { fetch: async (ctx) => { askedFrom = ctx.from; return { observations: [['2026-01-02', 900]] }; } }) }),
    );
    expect(askedFrom).toBe('2026-01-01');
    expect(out.file?.observations).toEqual([['2026-01-02', 900]]);
  });

  it('calcula la variación anual cuando el proveedor lo pide', async () => {
    const monthly = IndicatorSpec.parse({ ...spec, frequency: 'M', providers: [{ source: 'bcch', code: 'IMC', derive: 'yoy' }] });
    const out = await fetchIndicator(
      monthly,
      null,
      options({ bcch: fakeSource('bcch', { fetch: async () => ({ observations: [['2025-01-01', 100], ['2026-01-01', 103]] }) }) }),
    );
    expect(out.file?.observations).toEqual([['2026-01-01', 3]]);
    expect(out.file?.derive).toBe('yoy');
  });
});
