import { PERIODS, TRANSFORMS, type Period, type Transform } from './series.ts';

export type CardView = 'kpi' | 'line' | 'bar';
export const VIEWS: CardView[] = ['kpi', 'line', 'bar'];

export interface DashCard {
  id: string;
  view: CardView;
  period: Period;
  transform: Transform;
  compare: boolean;
}

export interface DashState {
  v: 1;
  cards: DashCard[];
}

export const STORAGE_KEY = 'indicadores-chile:dashboard:v1';
export const MAX_CARDS = 24;

const empty = (): DashState => ({ v: 1, cards: [] });

/** Valida un estado de origen no confiable (URL o localStorage) contra los indicadores existentes. */
export function sanitize(raw: unknown, knownIds: Set<string>): DashState {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as DashState).cards)) return empty();
  const cards: DashCard[] = [];
  for (const c of (raw as DashState).cards) {
    if (!c || typeof c !== 'object' || !knownIds.has(c.id)) continue;
    cards.push({
      id: c.id,
      view: VIEWS.includes(c.view) ? c.view : 'line',
      period: PERIODS.includes(c.period) ? c.period : 'MAX',
      transform: TRANSFORMS.includes(c.transform) ? c.transform : 'level',
      compare: c.compare === true,
    });
    if (cards.length >= MAX_CARDS) break;
  }
  return { v: 1, cards };
}

// Formato compacto en la URL: id~vista~período~transformación~comparar, separados por "|".
export function encodeState(state: DashState): string {
  return state.cards.map((c) => [c.id, c.view, c.period, c.transform, c.compare ? 1 : 0].join('~')).join('|');
}

export function decodeState(s: string, knownIds: Set<string>): DashState {
  const cards = s
    .split('|')
    .filter(Boolean)
    .map((part) => {
      const [id, view, period, transform, compare] = part.split('~');
      return { id, view, period, transform, compare: compare === '1' };
    });
  return sanitize({ v: 1, cards }, knownIds);
}

export function readStored(knownIds: Set<string>): DashState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw), knownIds) : null;
  } catch {
    return null;
  }
}

export function writeStored(state: DashState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Navegación privada o almacenamiento bloqueado: el dashboard sigue funcionando en memoria.
  }
}
