import type { Observation } from '../schema.ts';
import { SourceError, type FetchContext, type FetchResult, type Source } from '../types.ts';

/**
 * mindicador.cl: servicio sin credenciales que replica indicadores del Banco Central.
 * No es una fuente oficial, por eso se usa solo como respaldo. Entrega un año por llamada.
 */
export const MINDICADOR_ENDPOINT = 'https://mindicador.cl/api';

interface MindicadorResponse {
  codigo?: string;
  serie?: { fecha: string; valor: number }[];
}

/** Las fechas vienen como medianoche de Chile expresada en UTC ("2025-12-30T03:00:00.000Z"). */
export function parseMindicadorDate(s: string): string {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new SourceError(`Fecha mindicador inesperada: ${s}`);
  // Medianoche de Chile cae a las 03:00 o 04:00 UTC: se redondea a la medianoche UTC más cercana.
  return new Date(d.getTime() + 12 * 3600_000).toISOString().slice(0, 10);
}

export function parseMindicador(body: unknown): Observation[] {
  const res = body as MindicadorResponse;
  if (!res || !Array.isArray(res.serie)) throw new SourceError('Respuesta mindicador sin "serie"');
  return res.serie
    .filter((o) => typeof o.valor === 'number' && Number.isFinite(o.valor))
    .map((o) => [parseMindicadorDate(o.fecha), o.valor] as Observation);
}

export const mindicador: Source = {
  id: 'mindicador',
  incremental: true,
  missingConfig: () => null,
  async fetch(ctx: FetchContext): Promise<FetchResult> {
    const fromYear = Number(ctx.from.slice(0, 4));
    const toYear = Number(ctx.to.slice(0, 4));
    const all: Observation[] = [];
    for (let y = fromYear; y <= toYear; y++) {
      const body = await ctx.http.getJson(`${MINDICADOR_ENDPOINT}/${encodeURIComponent(ctx.provider.code)}/${y}`);
      all.push(...parseMindicador(body));
    }
    return { observations: all.filter(([d]) => d >= ctx.from && d <= ctx.to) };
  },
};
