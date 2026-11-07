/**
 * Utilidades puras sobre series de tiempo, compartidas entre el pipeline y el sitio.
 * Una observación es [fecha ISO YYYY-MM-DD, valor].
 */
export type Obs = [string, number];
export type Freq = 'D' | 'M' | 'Q' | 'A';

export type Transform = 'level' | 'change' | 'pct' | 'yoy' | 'base100';
export const TRANSFORMS: Transform[] = ['level', 'change', 'pct', 'yoy', 'base100'];

export type Period = '1M' | '6M' | '1Y' | '5Y' | '10Y' | 'MAX';
export const PERIODS: Period[] = ['1M', '6M', '1Y', '5Y', '10Y', 'MAX'];

const round = (v: number, d = 6) => Math.round(v * 10 ** d) / 10 ** d;

function shiftYears(iso: string, years: number): string {
  const y = Number(iso.slice(0, 4)) + years;
  return `${String(y).padStart(4, '0')}${iso.slice(4)}`;
}

/**
 * Variación porcentual respecto del mismo período del año anterior.
 * Para series diarias usa la última observación disponible en o antes de la misma fecha un año atrás.
 */
export function yoy(obs: Obs[], freq: Freq): Obs[] {
  if (freq === 'D') {
    const out: Obs[] = [];
    let j = 0;
    for (const [date, value] of obs) {
      const target = shiftYears(date, -1);
      while (j + 1 < obs.length && obs[j + 1][0] <= target) j++;
      const base = obs[j];
      // Se acepta la última observación hasta 10 días antes (fines de semana y feriados).
      const gapDays = base ? (Date.parse(target) - Date.parse(base[0])) / 86_400_000 : Infinity;
      if (base && gapDays >= 0 && gapDays <= 10 && base[1] !== 0) {
        out.push([date, round(((value / base[1]) - 1) * 100)]);
      }
    }
    return out;
  }
  const byKey = new Map(obs.map(([d, v]) => [d.slice(0, 7), v]));
  const out: Obs[] = [];
  for (const [date, value] of obs) {
    const prev = byKey.get(shiftYears(date, -1).slice(0, 7));
    if (prev !== undefined && prev !== 0) out.push([date, round((value / prev - 1) * 100)]);
  }
  return out;
}

/** Variación porcentual respecto de la observación anterior. */
export function pctChange(obs: Obs[]): Obs[] {
  const out: Obs[] = [];
  for (let i = 1; i < obs.length; i++) {
    const prev = obs[i - 1][1];
    if (prev !== 0) out.push([obs[i][0], round((obs[i][1] / prev - 1) * 100)]);
  }
  return out;
}

/** Diferencia absoluta respecto de la observación anterior (útil para tasas: puntos porcentuales). */
export function diff(obs: Obs[]): Obs[] {
  const out: Obs[] = [];
  for (let i = 1; i < obs.length; i++) out.push([obs[i][0], round(obs[i][1] - obs[i - 1][1])]);
  return out;
}

/** Re-escala la serie para que su primera observación valga 100. */
export function base100(obs: Obs[]): Obs[] {
  const first = obs.find(([, v]) => v !== 0);
  if (!first) return [];
  return obs.map(([d, v]) => [d, round((v / first[1]) * 100)]);
}

export function applyTransform(obs: Obs[], t: Transform, freq: Freq): Obs[] {
  switch (t) {
    case 'change':
      return diff(obs);
    case 'pct':
      return pctChange(obs);
    case 'yoy':
      return yoy(obs, freq);
    case 'base100':
      return base100(obs);
    default:
      return obs;
  }
}

/** Fecha ISO de inicio de un período relativo a `end`. */
export function periodStart(end: string, p: Period): string | null {
  if (p === 'MAX') return null;
  const d = new Date(`${end}T00:00:00Z`);
  const months = { '1M': 1, '6M': 6, '1Y': 12, '5Y': 60, '10Y': 120 }[p];
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function filterPeriod(obs: Obs[], p: Period, end?: string): Obs[] {
  if (!obs.length) return obs;
  const start = periodStart(end ?? obs[obs.length - 1][0], p);
  return start ? obs.filter(([d]) => d >= start) : obs;
}

/** Une dos series ordenadas; en fechas repetidas gana `incoming`. */
export function mergeObservations(existing: Obs[], incoming: Obs[]): Obs[] {
  const map = new Map(existing);
  for (const [d, v] of incoming) map.set(d, v);
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
}

/** Ordena y elimina fechas duplicadas (gana la última). */
export function normalize(obs: Obs[]): Obs[] {
  return mergeObservations([], obs);
}

export function toCsv(rows: { date: string; [k: string]: string | number | null }[], columns: string[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map(esc).join(','), ...rows.map((r) => columns.map((c) => esc(r[c])).join(','))].join('\n');
}
