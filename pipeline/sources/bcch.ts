import type { Observation } from '../schema.ts';
import { SourceError, type Env, type FetchContext, type FetchResult, type Source } from '../types.ts';

/**
 * Banco Central de Chile – Base de Datos Estadísticos (BDE), servicio REST SieteRestWS.
 * Requiere una cuenta BDE con la API habilitada. Autenticación:
 *   - recomendada: API Key Token (BDE → Mi Cuenta → "Apikey Token", vigencia de un año) en el parámetro `token`;
 *   - antigua: correo y contraseña de la BDE en `user` y `pass`.
 * La API entrega una serie por llamada.
 */
export const BCCH_ENDPOINT = 'https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx';

interface BcchObs {
  indexDateString: string;
  value: string | number;
  statusCode?: string;
}
interface BcchResponse {
  Codigo: number;
  Descripcion: string;
  Series?: { seriesId: string | null; Obs: BcchObs[] | null };
}

export function buildBcchUrl(env: Env, code: string, from: string, to: string): string {
  const u = new URL(BCCH_ENDPOINT);
  if (env.BCCH_TOKEN) {
    u.searchParams.set('token', env.BCCH_TOKEN);
  } else {
    u.searchParams.set('user', env.BCCH_USER ?? '');
    u.searchParams.set('pass', env.BCCH_PASS ?? '');
  }
  u.searchParams.set('function', 'GetSeries');
  u.searchParams.set('timeseries', code);
  u.searchParams.set('firstdate', from);
  u.searchParams.set('lastdate', to);
  return u.toString();
}

/** "31-12-2024" → "2024-12-31" */
function parseBcchDate(s: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
  if (!m) throw new SourceError(`Fecha BDE inesperada: ${s}`);
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function parseBcch(body: unknown, code: string): Observation[] {
  const res = body as BcchResponse;
  if (typeof res?.Codigo !== 'number') throw new SourceError('Respuesta BDE sin campo Codigo');
  if (res.Codigo !== 0) {
    // -5: credenciales inválidas (o token vencido); -50: serie inexistente, etc.
    throw new SourceError(`BDE ${res.Codigo}: ${res.Descripcion} (serie ${code})`);
  }
  const out: Observation[] = [];
  for (const o of res.Series?.Obs ?? []) {
    if (o.statusCode && o.statusCode !== 'OK') continue;
    const value = typeof o.value === 'number' ? o.value : Number(String(o.value).replace(',', '.'));
    if (!Number.isFinite(value)) continue;
    out.push([parseBcchDate(o.indexDateString), value]);
  }
  return out;
}

export const bcch: Source = {
  id: 'bcch',
  incremental: true,
  missingConfig: (env) =>
    env.BCCH_TOKEN || (env.BCCH_USER && env.BCCH_PASS) ? null : 'falta BCCH_TOKEN (o BCCH_USER y BCCH_PASS)',
  async fetch(ctx: FetchContext): Promise<FetchResult> {
    const body = await ctx.http.getJson(buildBcchUrl(ctx.env, ctx.provider.code, ctx.from, ctx.to));
    return { observations: parseBcch(body, ctx.provider.code) };
  },
};
