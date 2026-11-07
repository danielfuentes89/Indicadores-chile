import type { Lang } from '../i18n/ui.ts';
import type { Freq } from './series.ts';

const locale = (lang: Lang) => (lang === 'es' ? 'es-CL' : 'en-US');

export function formatNumber(v: number | null | undefined, lang: Lang, decimals = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat(locale(lang), { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);
}

/** Formato compacto para ejes (1,2 mil / 1.2K). */
export function formatCompact(v: number, lang: Lang): string {
  return new Intl.NumberFormat(locale(lang), { notation: Math.abs(v) >= 10_000 ? 'compact' : 'standard', maximumFractionDigits: 2 }).format(v);
}

const MONTHS: Record<Lang, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** Fecha según la frecuencia: "6 nov 2026", "sep 2026", "T3 2026" / "Q3 2026", "2025". */
export function formatDate(iso: string, freq: Freq, lang: Lang): string {
  const y = iso.slice(0, 4);
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  switch (freq) {
    case 'A':
      return y;
    case 'Q':
      return `${lang === 'es' ? 'T' : 'Q'}${Math.ceil(m / 3)} ${y}`;
    case 'M':
      return `${MONTHS[lang][m - 1]} ${y}`;
    default:
      return lang === 'es' ? `${d} ${MONTHS.es[m - 1]} ${y}` : `${MONTHS.en[m - 1]} ${d}, ${y}`;
  }
}

export function formatDateTime(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Santiago' }).format(new Date(iso));
}

/**
 * Para tasas y puntajes la variación se expresa como diferencia (puntos);
 * para precios y montos, como porcentaje.
 */
export function changeKind(unitEs: string): 'diff' | 'pct' {
  return /%|puntaje|puntos|años/.test(unitEs) ? 'diff' : 'pct';
}
