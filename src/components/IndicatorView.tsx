import { useState } from 'preact/hooks';
import type { CatalogEntry } from '../../pipeline/schema.ts';
import { t, type Lang } from '../i18n/ui.ts';
import { MAX_CARDS, readStored, writeStored } from '../lib/dashboard-state.ts';
import type { Freq } from '../lib/series.ts';
import { DEFAULT_PERIOD } from '../lib/view.ts';
import SeriesPanel, { type PanelConfig } from './SeriesPanel.tsx';

interface Props {
  entry: CatalogEntry;
  lang: Lang;
  base: string;
  knownIds: string[];
}

export default function IndicatorView({ entry, lang, base, knownIds }: Props) {
  const [config, setConfig] = useState<PanelConfig>({
    view: 'line',
    period: DEFAULT_PERIOD[entry.frequency as Freq],
    transform: 'level',
    compare: entry.hasCompare,
  });
  const [added, setAdded] = useState(false);

  const addToDashboard = () => {
    const state = readStored(new Set(knownIds)) ?? { v: 1 as const, cards: [] };
    if (state.cards.length < MAX_CARDS) state.cards.push({ id: entry.id, ...config });
    writeStored(state);
    setAdded(true);
  };

  return (
    <div class="card">
      <SeriesPanel entry={entry} lang={lang} base={base} config={config} onChange={setConfig} showTable height={360} />
      <div class="panel-actions">
        <button type="button" class="btn primary" onClick={addToDashboard} disabled={added}>
          {added ? `✓ ${t(lang, 'serie.added')}` : `+ ${t(lang, 'serie.addToDashboard')}`}
        </button>
      </div>
    </div>
  );
}
