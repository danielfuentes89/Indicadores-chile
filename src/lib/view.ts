import type { CatalogEntry, SeriesFile } from '../../pipeline/schema.ts';
import type { Lang } from '../i18n/ui.ts';
import { applyTransform, filterPeriod, type Freq, type Obs, type Period, type Transform } from './series.ts';
import { seriesUrl } from './urls.ts';

export const PERIODS_BY_FREQ: Record<Freq, Period[]> = {
  D: ['1M', '6M', '1Y', '5Y', '10Y', 'MAX'],
  M: ['1Y', '5Y', '10Y', 'MAX'],
  Q: ['5Y', '10Y', 'MAX'],
  A: ['10Y', 'MAX'],
};
export const DEFAULT_PERIOD: Record<Freq, Period> = { D: '1Y', M: '5Y', Q: '10Y', A: 'MAX' };

/** Las tasas ya están en %: no tiene sentido calcular su variación porcentual. */
export function transformsFor(entry: Pick<CatalogEntry, 'unit'>): Transform[] {
  return entry.unit.es.includes('%') || entry.unit.es.includes('puntaje') ? ['level', 'change'] : ['level', 'change', 'pct', 'yoy', 'base100'];
}

export function decimalsFor(entry: Pick<CatalogEntry, 'decimals'>, t: Transform): number {
  return t === 'level' ? entry.decimals : t === 'change' ? Math.max(entry.decimals, 1) : 1;
}

const cache = new Map<string, Promise<SeriesFile>>();

export function loadSeries(id: string, base: string): Promise<SeriesFile> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(seriesUrl(id, base)).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<SeriesFile>;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export interface ViewSeries {
  key: string;
  name: string;
  slot: 1 | 2 | 3 | 4;
  data: Obs[];
}

/**
 * Prepara Chile + agregados de comparación con la misma transformación y período.
 * La transformación se aplica sobre la serie completa y luego se recorta, para que el
 * primer punto del período tenga su base de comparación.
 */
export function buildView(
  entry: CatalogEntry,
  file: SeriesFile,
  opts: { transform: Transform; period: Period; compare: boolean; lang: Lang },
): ViewSeries[] {
  const freq = entry.frequency as Freq;
  const end = file.observations.at(-1)?.[0];
  const shape = (obs: Obs[]) =>
    opts.transform === 'base100'
      ? // En "base 100" el inicio del período es el punto de partida.
        applyTransform(filterPeriod(obs, opts.period, end), 'base100', freq)
      : filterPeriod(applyTransform(obs, opts.transform, freq), opts.period, end);

  const out: ViewSeries[] = [{ key: 'CHL', name: 'Chile', slot: 1, data: shape(file.observations as Obs[]) }];
  if (opts.compare && file.compare) {
    (entry.compare ?? []).forEach((c, i) => {
      const obs = file.compare?.[c.code] as Obs[] | undefined;
      if (!obs?.length) return;
      out.push({ key: c.code, name: c.label[opts.lang], slot: Math.min(i + 2, 4) as 2 | 3 | 4, data: shape(obs) });
    });
  }
  return out;
}

/** Filas para tabla/CSV: una fila por fecha, una columna por serie. */
export function toRows(series: ViewSeries[]): { date: string; [k: string]: string | number | null }[] {
  const dates = new Set<string>();
  const maps = series.map((s) => new Map(s.data));
  for (const s of series) for (const [d] of s.data) dates.add(d);
  return [...dates].sort().map((date) => {
    const row: { date: string; [k: string]: string | number | null } = { date };
    series.forEach((s, i) => (row[s.key] = maps[i].get(date) ?? null));
    return row;
  });
}

export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
