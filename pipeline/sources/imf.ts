import type { Observation } from '../schema.ts';
import { SourceError, type FetchContext, type FetchResult, type Source } from '../types.ts';

/**
 * FMI – DataMapper API (World Economic Outlook). Sin credenciales.
 * La API responde todos los países por indicador, así que basta una llamada por indicador.
 * Incluye proyecciones: se marcan desde el año en curso.
 */
export const IMF_ENDPOINT = 'https://www.imf.org/external/datamapper/api/v1';

interface ImfResponse {
  values?: Record<string, Record<string, Record<string, number | null>>>;
}

export function parseImf(body: unknown, code: string): Map<string, Observation[]> {
  const res = body as ImfResponse;
  const byCountry = res?.values?.[code];
  if (!byCountry) throw new SourceError(`FMI: indicador ${code} sin datos`);
  const out = new Map<string, Observation[]>();
  for (const [country, years] of Object.entries(byCountry)) {
    const obs: Observation[] = [];
    for (const [year, value] of Object.entries(years ?? {})) {
      if (typeof value === 'number' && Number.isFinite(value) && /^\d{4}$/.test(year)) obs.push([`${year}-01-01`, value]);
    }
    obs.sort((a, b) => a[0].localeCompare(b[0]));
    out.set(country, obs);
  }
  return out;
}

export const imf: Source = {
  id: 'imf',
  incremental: false,
  missingConfig: () => null,
  async fetch(ctx: FetchContext): Promise<FetchResult> {
    const code = ctx.provider.code;
    const byCountry = parseImf(await ctx.http.getJson(`${IMF_ENDPOINT}/${encodeURIComponent(code)}`), code);
    // Se conservan las proyecciones (años futuros), por eso no se recorta por `to`.
    const inRange = (obs: Observation[]) => obs.filter(([d]) => d >= ctx.from);
    const compare: Record<string, Observation[]> = {};
    for (const c of ctx.spec.compare ?? []) {
      const obs = byCountry.get(c.code);
      if (obs?.length) compare[c.code] = inRange(obs);
    }
    return {
      observations: inRange(byCountry.get('CHL') ?? []),
      compare: Object.keys(compare).length ? compare : undefined,
      projectionFrom: ctx.to.slice(0, 4),
    };
  },
};
