import type { Catalog, CatalogEntry, Frequency, Observation, Registry, SeriesFile } from './schema.ts';

const SPARK_POINTS: Record<Frequency, number> = { D: 90, M: 36, Q: 20, A: 20 };

/** Días sin un dato nuevo a partir de los cuales se advierte que la serie puede estar desactualizada. */
export const STALE_AFTER_DAYS: Record<Frequency, number> = { D: 10, M: 100, Q: 200, A: 5 * 366 };

export function isStale(lastDate: string | undefined, freq: Frequency, today: string): boolean {
  if (!lastDate) return false;
  return (Date.parse(today) - Date.parse(lastDate)) / 86_400_000 > STALE_AFTER_DAYS[freq];
}

/** Observaciones "publicadas" a la fecha: excluye valores futuros (UF adelantada) y proyecciones del FMI. */
export function observedUntil(file: SeriesFile, today: string): Observation[] {
  return file.observations.filter(
    ([d]) => d <= today && (!file.projectionFrom || d.slice(0, 4) < file.projectionFrom),
  );
}

export function buildCatalog(registry: Registry, files: Map<string, SeriesFile | null>, today: string): Catalog {
  const indicators: CatalogEntry[] = registry.indicators.map((spec) => {
    const { providers: _p, start: _s, ...meta } = spec;
    const file = files.get(spec.id) ?? null;
    if (!file) return { ...meta, hasCompare: false, stale: false };
    const observed = observedUntil(file, today);
    return {
      ...meta,
      source: file.source,
      code: file.code,
      derive: file.derive,
      updatedAt: file.fetchedAt,
      last: observed.at(-1),
      previous: observed.at(-2),
      spark: observed.slice(-SPARK_POINTS[spec.frequency]).map(([, v]) => v),
      hasCompare: !!file.compare && Object.keys(file.compare).length > 0,
      projectionFrom: file.projectionFrom,
      stale: isStale(observed.at(-1)?.[0], spec.frequency, today),
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    areas: registry.areas,
    sources: registry.sources,
    indicators,
  };
}
