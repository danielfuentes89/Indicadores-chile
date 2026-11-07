import type { Lang } from '../i18n/ui.ts';

/** Une la base del sitio (p. ej. "/Indicadores-chile/") con una ruta relativa. */
export function withBase(path: string, base: string = import.meta.env.BASE_URL): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${b}${path.replace(/^\//, '')}`;
}

export const seriesUrl = (id: string, base?: string) => withBase(`data/series/${id}.json`, base);
export const pageUrl = (lang: Lang, path = '', base?: string) => withBase(`${lang}/${path ? `${path.replace(/^\/|\/$/g, '')}/` : ''}`, base);
