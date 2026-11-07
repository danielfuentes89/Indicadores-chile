import type { Observation } from '../schema.ts';
import { SourceError, type FetchContext, type FetchResult, type Source } from '../types.ts';

/**
 * Banco Mundial – API v2. Sin credenciales.
 * Se pide Chile junto con los agregados de comparación en una sola llamada (CHL;OED;LCN).
 * Los indicadores de gobernanza (WGI) requieren `source=3`.
 */
export const WB_ENDPOINT = 'https://api.worldbank.org/v2';

interface WbRow {
  countryiso3code: string;
  date: string;
  value: number | null;
}

export function buildWorldBankUrl(code: string, countries: string[], fromYear: number, toYear: number, params?: Record<string, string>): string {
  const u = new URL(`${WB_ENDPOINT}/country/${countries.join(';')}/indicator/${encodeURIComponent(code)}`);
  u.searchParams.set('format', 'json');
  u.searchParams.set('per_page', '2000');
  u.searchParams.set('date', `${fromYear}:${toYear}`);
  for (const [k, v] of Object.entries(params ?? {})) u.searchParams.set(k, v);
  return u.toString();
}

/** Devuelve las observaciones agrupadas por código ISO3 del país o agregado. */
export function parseWorldBank(body: unknown): Map<string, Observation[]> {
  if (!Array.isArray(body)) throw new SourceError('Respuesta Banco Mundial inesperada');
  const [meta, rows] = body as [Record<string, unknown> & { message?: { value: string }[] }, WbRow[] | null];
  if (meta?.message) throw new SourceError(`Banco Mundial: ${meta.message.map((m) => m.value).join('; ')}`);
  if (typeof meta?.pages === 'number' && meta.pages > 1) {
    throw new SourceError('Banco Mundial devolvió más de una página; aumentar per_page');
  }
  const out = new Map<string, Observation[]>();
  for (const r of rows ?? []) {
    if (r.value === null || !Number.isFinite(r.value) || !/^\d{4}$/.test(r.date)) continue;
    const list = out.get(r.countryiso3code) ?? [];
    list.push([`${r.date}-01-01`, r.value]);
    out.set(r.countryiso3code, list);
  }
  for (const list of out.values()) list.sort((a, b) => a[0].localeCompare(b[0]));
  return out;
}

export const worldbank: Source = {
  id: 'worldbank',
  incremental: false,
  missingConfig: () => null,
  async fetch(ctx: FetchContext): Promise<FetchResult> {
    const compareCodes = (ctx.spec.compare ?? []).map((c) => c.code);
    const url = buildWorldBankUrl(
      ctx.provider.code,
      ['CHL', ...compareCodes],
      Number(ctx.from.slice(0, 4)),
      Number(ctx.to.slice(0, 4)),
      ctx.provider.params,
    );
    const byCountry = parseWorldBank(await ctx.http.getJson(url));
    const compare: Record<string, Observation[]> = {};
    for (const code of compareCodes) {
      const obs = byCountry.get(code);
      if (obs?.length) compare[code] = obs;
    }
    return {
      observations: byCountry.get('CHL') ?? [],
      compare: Object.keys(compare).length ? compare : undefined,
    };
  },
};
