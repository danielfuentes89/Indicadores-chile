import { mergeObservations, normalize, yoy } from '../src/lib/series.ts';
import type { Frequency, IndicatorSpec, Provider, SeriesFile, SeriesStatus, SourceId } from './schema.ts';
import type { Env, HttpClient, Source } from './types.ts';

export interface FetchOptions {
  /** Ignora los datos guardados y descarga toda la historia. */
  full?: boolean;
  /** Fecha "hoy" en Chile (ISO). */
  today: string;
  env: Env;
  http: HttpClient;
  sources: Record<SourceId, Source>;
}

export interface IndicatorOutcome {
  status: SeriesStatus;
  /** Archivo a escribir; `null` si no hubo datos nuevos válidos (se conserva el existente). */
  file: SeriesFile | null;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Cuánto retroceder desde la última fecha guardada en una actualización incremental:
 * cubre revisiones de la fuente y, si se calcula la variación anual, la base de comparación.
 */
export function lookbackDays(freq: Frequency, derive?: Provider['derive']): number {
  const revision = { D: 31, M: 400, Q: 3 * 366, A: 5 * 366 }[freq];
  return revision + (derive === 'yoy' ? 400 : 0);
}

const sameProvider = (file: SeriesFile | null, p: Provider) =>
  !!file && file.source === p.source && file.code === p.code && file.derive === p.derive;

export async function fetchIndicator(spec: IndicatorSpec, existing: SeriesFile | null, opts: FetchOptions): Promise<IndicatorOutcome> {
  const attempts: SeriesStatus['attempts'] = [];
  // Algunas series se publican por adelantado (la UF hasta el día 9 del mes siguiente).
  const to = addDays(opts.today, 45);

  for (const provider of spec.providers) {
    const source = opts.sources[provider.source];
    const missing = source.missingConfig(opts.env);
    if (missing) {
      attempts.push({ source: provider.source, error: `omitida: ${missing}` });
      continue;
    }

    const incremental = !opts.full && source.incremental && sameProvider(existing, provider) && existing!.observations.length > 0;
    const lastDate = incremental ? existing!.observations[existing!.observations.length - 1][0] : null;
    const from = lastDate ? addDays(lastDate, -lookbackDays(spec.frequency, provider.derive)) : spec.start;

    try {
      const result = await source.fetch({ spec, provider, from, to, env: opts.env, http: opts.http });
      let observations = normalize(result.observations);
      if (provider.derive === 'yoy') observations = yoy(observations, spec.frequency);
      if (!observations.length) throw new Error(`sin observaciones entre ${from} y ${to}`);

      const merged = incremental ? mergeObservations(existing!.observations, observations) : observations;

      // Protección: una descarga completa mucho más corta que lo guardado suele ser una respuesta truncada.
      if (!incremental && sameProvider(existing, provider) && merged.length < existing!.observations.length * 0.5) {
        throw new Error(`respuesta sospechosamente corta (${merged.length} obs. vs ${existing!.observations.length} guardadas)`);
      }

      const file: SeriesFile = {
        id: spec.id,
        source: provider.source,
        code: provider.code,
        derive: provider.derive,
        fetchedAt: new Date().toISOString(),
        observations: merged,
        compare: result.compare
          ? Object.fromEntries(Object.entries(result.compare).map(([k, v]) => [k, normalize(v)]))
          : incremental
            ? existing!.compare
            : undefined,
        projectionFrom: result.projectionFrom,
      };
      return {
        file,
        status: {
          id: spec.id,
          ok: true,
          source: provider.source,
          attempts,
          lastDate: merged[merged.length - 1][0],
          count: merged.length,
        },
      };
    } catch (err) {
      attempts.push({ source: provider.source, error: (err as Error).message });
    }
  }

  return {
    file: null,
    status: {
      id: spec.id,
      ok: false,
      source: existing?.source,
      attempts,
      lastDate: existing?.observations.at(-1)?.[0],
      count: existing?.observations.length,
    },
  };
}
