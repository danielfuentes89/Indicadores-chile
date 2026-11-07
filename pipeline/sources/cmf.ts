import type { Observation } from '../schema.ts';
import { SourceError, type FetchContext, type FetchResult, type Source } from '../types.ts';

/**
 * CMF Chile – API "recursos_api" (ex SBIF). Requiere API key gratuita.
 * Recursos: dolar, euro, uf, utm, ipc. Valores con formato chileno ("38.123,45").
 */
export const CMF_ENDPOINT = 'https://api.cmfchile.cl/api-sbifv3/recursos_api';

export function buildCmfUrl(apiKey: string, resource: string, from: string, to: string): string {
  const [fy, fm] = from.split('-');
  const [ty, tm] = to.split('-');
  const u = new URL(`${CMF_ENDPOINT}/${resource}/periodo/${fy}/${fm}/${ty}/${tm}`);
  u.searchParams.set('apikey', apiKey);
  u.searchParams.set('formato', 'json');
  return u.toString();
}

/** "38.123,45" → 38123.45 */
export function parseChileanNumber(s: string | number): number {
  if (typeof s === 'number') return s;
  return Number(s.trim().replace(/\./g, '').replace(',', '.').replace('%', ''));
}

export function parseCmf(body: unknown): Observation[] {
  if (!body || typeof body !== 'object') throw new SourceError('Respuesta CMF vacía');
  const obj = body as Record<string, unknown>;
  if ('CodigoError' in obj) throw new SourceError(`CMF ${obj.CodigoError}: ${obj.Mensaje}`);
  // La raíz es { "Dolares": [...] }, { "UFs": [...] }, { "IPCs": [...] }…: se toma el primer arreglo.
  const rows = Object.values(obj).find(Array.isArray) as { Valor: string; Fecha: string }[] | undefined;
  if (!rows) throw new SourceError('Respuesta CMF sin arreglo de datos');
  const out: Observation[] = [];
  for (const r of rows) {
    const value = parseChileanNumber(r.Valor);
    if (!Number.isFinite(value) || !/^\d{4}-\d{2}-\d{2}$/.test(r.Fecha)) continue;
    out.push([r.Fecha, value]);
  }
  return out;
}

export const cmf: Source = {
  id: 'cmf',
  incremental: true,
  missingConfig: (env) => (env.CMF_API_KEY ? null : 'falta CMF_API_KEY'),
  async fetch(ctx: FetchContext): Promise<FetchResult> {
    const body = await ctx.http.getJson(buildCmfUrl(ctx.env.CMF_API_KEY!, ctx.provider.code, ctx.from, ctx.to));
    const observations = parseCmf(body).filter(([d]) => d >= ctx.from && d <= ctx.to);
    return { observations };
  },
};
