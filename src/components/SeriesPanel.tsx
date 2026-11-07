import { useEffect, useMemo, useState } from 'preact/hooks';
import type { CatalogEntry, SeriesFile } from '../../pipeline/schema.ts';
import { t, type Lang, type UiKey } from '../i18n/ui.ts';
import type { CardView, DashCard } from '../lib/dashboard-state.ts';
import { changeKind, formatDate, formatNumber } from '../lib/format.ts';
import { toCsv, type Freq } from '../lib/series.ts';
import { buildView, decimalsFor, downloadText, loadSeries, PERIODS_BY_FREQ, toRows, transformsFor } from '../lib/view.ts';
import Chart from './Chart.tsx';

export type PanelConfig = Omit<DashCard, 'id'>;

interface Props {
  entry: CatalogEntry;
  lang: Lang;
  base: string;
  config: PanelConfig;
  onChange: (c: PanelConfig) => void;
  views?: CardView[];
  showTable?: boolean;
  height?: number;
}

function Seg<T extends string>(props: { label: string; value: T; options: T[]; labelOf: (v: T) => string; onChange: (v: T) => void }) {
  return (
    <div class="seg" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button type="button" aria-pressed={o === props.value} onClick={() => props.onChange(o)}>
          {props.labelOf(o)}
        </button>
      ))}
    </div>
  );
}

export default function SeriesPanel({ entry, lang, base, config, onChange, views = ['line', 'bar'], showTable = false, height }: Props) {
  const [file, setFile] = useState<SeriesFile | null>(null);
  const [error, setError] = useState(false);
  const freq = entry.frequency as Freq;

  useEffect(() => {
    let alive = true;
    setError(false);
    loadSeries(entry.id, base)
      .then((f) => alive && setFile(f))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [entry.id, base]);

  const transforms = transformsFor(entry);
  const periods = PERIODS_BY_FREQ[freq];
  const transform = transforms.includes(config.transform) ? config.transform : 'level';
  const period = periods.includes(config.period) ? config.period : periods[periods.length - 1];
  const decimals = decimalsFor(entry, transform);

  const series = useMemo(
    () => (file ? buildView(entry, file, { transform, period, compare: config.compare, lang }) : []),
    [file, entry, transform, period, config.compare, lang],
  );
  const set = (patch: Partial<PanelConfig>) => onChange({ ...config, transform, period, ...patch });

  const controls = (
    <div class="controls">
      {views.length > 1 && (
        <Seg label={t(lang, 'ctrl.view')} value={config.view} options={views} labelOf={(v) => t(lang, `view.${v}` as UiKey)} onChange={(view) => set({ view })} />
      )}
      {config.view !== 'kpi' && (
        <Seg label={t(lang, 'ctrl.period')} value={period} options={periods} labelOf={(p) => t(lang, `period.${p}` as UiKey)} onChange={(p) => set({ period: p })} />
      )}
      {transforms.length > 1 && (
        <label>
          {t(lang, 'ctrl.transform')}
          <select value={transform} onChange={(e) => set({ transform: (e.target as HTMLSelectElement).value as PanelConfig['transform'] })}>
            {transforms.map((tr) => (
              <option value={tr}>{t(lang, `transform.${tr}` as UiKey)}</option>
            ))}
          </select>
        </label>
      )}
      {entry.hasCompare && config.view !== 'kpi' && (
        <label>
          <input type="checkbox" checked={config.compare} onChange={(e) => set({ compare: (e.target as HTMLInputElement).checked })} />
          {t(lang, 'ctrl.compare')}
        </label>
      )}
    </div>
  );

  if (error) return <div>{controls}<p class="notice">{t(lang, 'serie.error')}</p></div>;
  if (!file) return <div>{controls}<p class="muted small" style={{ minHeight: `${height ?? 320}px` }}>{t(lang, 'serie.loading')}</p></div>;

  const chile = series[0]?.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const observed = chile.filter(([d]) => d <= today && (!file.projectionFrom || d.slice(0, 4) < file.projectionFrom));
  const last = observed.at(-1);
  const prev = observed.at(-2);
  const unitLabel = transform === 'level' ? entry.unit[lang] : transform === 'base100' ? t(lang, 'transform.base100') : transform === 'change' ? entry.unit[lang] : '%';

  let body;
  if (config.view === 'kpi') {
    const kind = transform === 'level' ? changeKind(entry.unit.es) : 'diff';
    const delta = last && prev ? (kind === 'diff' ? last[1] - prev[1] : ((last[1] - prev[1]) / Math.abs(prev[1] || 1)) * 100) : null;
    body = (
      <div class="kpi-big">
        <div class="kpi-big-value">
          {last ? formatNumber(last[1], lang, decimals) : '—'} <span class="muted small">{unitLabel}</span>
        </div>
        {last && <div class="muted small">{formatDate(last[0], freq, lang)}</div>}
        {delta !== null && (
          <div class="small">
            <span aria-hidden="true">{delta > 0 ? '▲' : delta < 0 ? '▼' : '■'}</span> {delta > 0 ? '+' : ''}
            {formatNumber(delta, lang, Math.max(decimals, 1))}
            {kind === 'pct' ? '%' : ''} <span class="muted">{t(lang, 'card.vsPrev')}</span>
          </div>
        )}
      </div>
    );
  } else {
    body = (
      <Chart
        series={series.map((s) => ({ name: s.name, data: s.data, slot: s.slot }))}
        freq={freq}
        lang={lang}
        decimals={decimals}
        kind={config.view}
        height={height}
        projectionFrom={file.projectionFrom}
        projectionLabel={t(lang, 'serie.projection')}
        ariaLabel={`${entry.name[lang]} – ${unitLabel}${last ? ` – ${formatNumber(last[1], lang, decimals)} (${formatDate(last[0], freq, lang)})` : ''}`}
      />
    );
  }

  const rows = showTable ? toRows(series) : [];
  const columns = ['date', ...series.map((s) => s.key)];

  return (
    <div>
      {controls}
      {body}
      {showTable && (
        <details class="table-block">
          <summary>{t(lang, 'serie.table')}</summary>
          <div class="table-actions">
            <button type="button" class="btn" onClick={() => downloadText(`${entry.id}-${transform}-${period}.csv`, toCsv(rows, columns))}>
              {t(lang, 'serie.download')}
            </button>
          </div>
          <div class="table-scroll">
            <table class="data">
              <thead>
                <tr>
                  <th scope="col">{t(lang, 'serie.date')}</th>
                  {series.map((s) => (
                    <th scope="col" class="num">{s.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .slice()
                  .reverse()
                  .map((r) => (
                    <tr>
                      <td>{formatDate(r.date, freq, lang)}</td>
                      {series.map((s) => (
                        <td class="num">{r[s.key] === null ? '—' : formatNumber(r[s.key] as number, lang, decimals)}</td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
