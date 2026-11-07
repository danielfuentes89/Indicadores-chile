/**
 * Acceso a los datos en tiempo de build (Node). El navegador carga las series con `seriesUrl`.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildCatalog } from '../../pipeline/catalog.ts';
import { loadRegistry } from '../../pipeline/config.ts';
import { Catalog, type SeriesStatus } from '../../pipeline/schema.ts';

const DATA_DIR = join(process.cwd(), 'public', 'data');

let cached: Promise<Catalog> | null = null;

/** Lee public/data/catalog.json; si aún no existe (repo recién clonado) lo arma desde el registro, sin datos. */
export function getCatalog(): Promise<Catalog> {
  cached ??= (async () => {
    try {
      return Catalog.parse(JSON.parse(await readFile(join(DATA_DIR, 'catalog.json'), 'utf8')));
    } catch {
      const registry = await loadRegistry();
      return buildCatalog(registry, new Map(), new Date().toISOString().slice(0, 10));
    }
  })();
  return cached;
}

export async function getStatus(): Promise<{ generatedAt: string; results: SeriesStatus[] } | null> {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, 'status.json'), 'utf8'));
  } catch {
    return null;
  }
}
