import { useEffect, useMemo, useState } from 'preact/hooks';
import type { AreaSpec, CatalogEntry } from '../../pipeline/schema.ts';
import { t, type Lang, type UiKey } from '../i18n/ui.ts';
import { decodeState, encodeState, MAX_CARDS, readStored, writeStored, type DashCard, type DashState } from '../lib/dashboard-state.ts';
import type { Freq } from '../lib/series.ts';
import { pageUrl } from '../lib/urls.ts';
import { DEFAULT_PERIOD } from '../lib/view.ts';
import SeriesPanel from './SeriesPanel.tsx';

interface Props {
  indicators: CatalogEntry[];
  areas: AreaSpec[];
  lang: Lang;
  base: string;
}

const HASH_KEY = 'd';

function newCard(entry: CatalogEntry, view: DashCard['view'] = 'line'): DashCard {
  return { id: entry.id, view, period: DEFAULT_PERIOD[entry.frequency as Freq], transform: 'level', compare: entry.hasCompare };
}

function preset(indicators: CatalogEntry[], area: string): DashState {
  const featured = indicators.filter((i) => i.area === area && i.featured && i.last);
  return { v: 1, cards: featured.map((e, i) => newCard(e, i < 2 ? 'kpi' : 'line')) };
}

export default function Dashboard({ indicators, areas, lang, base }: Props) {
  const byId = useMemo(() => new Map(indicators.map((i) => [i.id, i])), [indicators]);
  const known = useMemo(() => new Set(indicators.map((i) => i.id)), [indicators]);
  const [state, setState] = useState<DashState | null>(null);
  const [shared, setShared] = useState(false);
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState('');
  const [copied, setCopied] = useState(false);

  // Carga inicial: enlace compartido > guardado en el navegador > plantilla económica.
  useEffect(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    const fromUrl = params.get(HASH_KEY);
    if (fromUrl !== null) {
      setState(decodeState(fromUrl, known));
      setShared(true);
      return;
    }
    setState(readStored(known) ?? preset(indicators, 'economia'));
  }, []);

  const update = (next: DashState) => {
    setState(next);
    if (!shared) writeStored(next);
  };

  if (!state) return <p class="muted">{t(lang, 'serie.loading')}</p>;

  const cards = state.cards;
  const setCard = (i: number, c: DashCard) => update({ ...state, cards: cards.map((x, j) => (j === i ? c : x)) });
  const move = (i: number, d: -1 | 1) => {
    const next = cards.slice();
    [next[i], next[i + d]] = [next[i + d], next[i]];
    update({ ...state, cards: next });
  };
  const remove = (i: number) => update({ ...state, cards: cards.filter((_, j) => j !== i) });
  const add = (id: string) => {
    const entry = byId.get(id);
    if (!entry || cards.length >= MAX_CARDS) return;
    update({ ...state, cards: [...cards, newCard(entry)] });
    setPick('');
    setQuery('');
  };

  const share = async () => {
    const url = `${location.origin}${location.pathname}#${HASH_KEY}=${encodeURIComponent(encodeState(state))}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      prompt(t(lang, 'dash.share'), url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveShared = () => {
    writeStored(state);
    setShared(false);
    history.replaceState(null, '', location.pathname);
  };

  const q = query.trim().toLowerCase();
  const matches = indicators.filter((i) => !q || `${i.name[lang]} ${i.short?.[lang] ?? ''} ${i.id}`.toLowerCase().includes(q));

  return (
    <div>
      {shared && (
        <p class="notice">
          {t(lang, 'dash.shared')}{' '}
          <button type="button" class="btn" onClick={saveShared}>
            {t(lang, 'dash.saveShared')}
          </button>
        </p>
      )}

      <div class="dash-toolbar card">
        <div class="dash-add">
          <label class="sr-only" for="dash-search">{t(lang, 'dash.search')}</label>
          <input id="dash-search" type="search" placeholder={t(lang, 'dash.search')} value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} />
          <label class="sr-only" for="dash-pick">{t(lang, 'dash.choose')}</label>
          <select id="dash-pick" value={pick} onChange={(e) => setPick((e.target as HTMLSelectElement).value)}>
            <option value="">{t(lang, 'dash.choose')}</option>
            {areas
              .filter((a) => a.status === 'active')
              .map((a) => {
                const opts = matches.filter((m) => m.area === a.id);
                return opts.length ? (
                  <optgroup label={a.name[lang]}>
                    {opts.map((o) => (
                      <option value={o.id} disabled={!o.last}>
                        {o.name[lang]}
                        {!o.last ? ` (${t(lang, 'card.noData').toLowerCase()})` : ''}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
          </select>
          <button type="button" class="btn primary" disabled={!pick || cards.length >= MAX_CARDS} onClick={() => add(pick)}>
            + {t(lang, 'dash.add')}
          </button>
        </div>
        <div class="dash-actions">
          <span class="muted small">{t(lang, 'dash.presets')}:</span>
          {(['economia', 'global'] as const).map((a) => (
            <button type="button" class="btn" onClick={() => update(preset(indicators, a))}>
              {t(lang, `dash.preset.${a}` as UiKey)}
            </button>
          ))}
          <button type="button" class="btn" onClick={share} disabled={!cards.length}>
            {copied ? `✓ ${t(lang, 'dash.copied')}` : t(lang, 'dash.share')}
          </button>
          <button type="button" class="btn" onClick={() => update({ v: 1, cards: [] })} disabled={!cards.length}>
            {t(lang, 'dash.clear')}
          </button>
        </div>
      </div>

      {!cards.length && <p class="notice">{t(lang, 'dash.empty')}</p>}

      <div class="dash-grid">
        {cards.map((c, i) => {
          const entry = byId.get(c.id)!;
          return (
            <section class={`card dash-card ${c.view === 'kpi' ? 'is-kpi' : ''}`} key={`${c.id}-${i}`} aria-label={entry.name[lang]}>
              <header class="dash-card-head">
                <h2>
                  <a href={pageUrl(lang, `serie/${entry.id}`, base)} title={t(lang, 'dash.details')}>
                    {entry.name[lang]}
                  </a>
                </h2>
                <div class="dash-card-tools">
                  <button type="button" class="btn icon" aria-label={t(lang, 'dash.up')} title={t(lang, 'dash.up')} disabled={i === 0} onClick={() => move(i, -1)}>
                    ↑
                  </button>
                  <button type="button" class="btn icon" aria-label={t(lang, 'dash.down')} title={t(lang, 'dash.down')} disabled={i === cards.length - 1} onClick={() => move(i, 1)}>
                    ↓
                  </button>
                  <button type="button" class="btn icon" aria-label={t(lang, 'dash.remove')} title={t(lang, 'dash.remove')} onClick={() => remove(i)}>
                    ✕
                  </button>
                </div>
              </header>
              <SeriesPanel
                entry={entry}
                lang={lang}
                base={base}
                config={c}
                views={['kpi', 'line', 'bar']}
                height={240}
                onChange={(cfg) => setCard(i, { ...cfg, id: c.id })}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
