/**
 * Descarga los indicadores definidos en config/indicators.yaml y genera:
 *   public/data/series/<id>.json   una serie por indicador
 *   public/data/catalog.json       metadatos + último valor de cada indicador (lo usa el sitio)
 *   public/data/status.json        resultado de la última ejecución por indicador
 *   pipeline-report.md             resumen legible (lo usa el workflow para abrir un issue si algo falla)
 *
 * Uso: npm run fetch -- [--only id1,id2] [--area economia] [--source bcch] [--full] [--dry-run] [--catalog-only] [--out dir]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildCatalog } from './catalog.ts';
import { loadRegistry } from './config.ts';
import { fetchIndicator } from './fetch-indicator.ts';
import { createHttpClient } from './http.ts';
import type { SeriesFile, SeriesStatus } from './schema.ts';
import { SOURCES } from './sources/index.ts';
import { Store } from './store.ts';

export function chileToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago' }).format(now);
}

async function readJsonSafe<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

function renderReport(results: SeriesStatus[], today: string): string {
  const failed = results.filter((r) => !r.ok);
  const fallback = results.filter((r) => r.ok && r.attempts.some((a) => !a.error.startsWith('omitida')));
  const lines = [`# Actualización de datos – ${today}`, '', `- Correctos: ${results.length - failed.length}/${results.length}`];
  if (failed.length) {
    lines.push('', '## Indicadores sin actualizar', '', '| Indicador | Último dato guardado | Errores |', '|---|---|---|');
    for (const r of failed) {
      lines.push(`| \`${r.id}\` | ${r.lastDate ?? '—'} | ${r.attempts.map((a) => `**${a.source}**: ${a.error}`).join('<br>')} |`);
    }
  }
  if (fallback.length) {
    lines.push('', '## Actualizados con una fuente de respaldo', '', '| Indicador | Fuente usada | Fallas previas |', '|---|---|---|');
    for (const r of fallback) {
      lines.push(`| \`${r.id}\` | ${r.source} | ${r.attempts.map((a) => `**${a.source}**: ${a.error}`).join('<br>')} |`);
    }
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const { values } = parseArgs({
    options: {
      only: { type: 'string' },
      area: { type: 'string' },
      source: { type: 'string' },
      full: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'catalog-only': { type: 'boolean', default: false },
      out: { type: 'string', default: fileURLToPath(new URL('../public/data', import.meta.url)) },
    },
  });

  const registry = await loadRegistry();
  const store = new Store(values.out!);
  const today = chileToday();
  const http = createHttpClient();
  const only = values.only?.split(',').map((s) => s.trim());

  const selected = registry.indicators.filter(
    (s) =>
      (!only || only.includes(s.id)) &&
      (!values.area || s.area === values.area) &&
      (!values.source || s.providers.some((p) => p.source === values.source)),
  );
  if (!selected.length) throw new Error('Ningún indicador coincide con los filtros.');

  if (values['catalog-only']) {
    const stored = new Map<string, SeriesFile | null>();
    for (const spec of registry.indicators) stored.set(spec.id, await store.readSeries(spec.id));
    await store.writeJson(`${values.out}/catalog.json`, buildCatalog(registry, stored, today));
    console.log('catalog.json regenerado a partir de los datos guardados.');
    return;
  }

  console.log(`Hoy (Chile): ${today}. Indicadores a actualizar: ${selected.length}`);
  const results: SeriesStatus[] = [];
  const files = new Map<string, SeriesFile | null>();
  for (const spec of registry.indicators) files.set(spec.id, await store.readSeries(spec.id));

  for (const spec of selected) {
    const { file, status } = await fetchIndicator(spec, files.get(spec.id) ?? null, {
      full: values.full,
      today,
      env: process.env,
      http,
      sources: SOURCES,
    });
    results.push(status);
    const tag = status.ok ? `ok   ${status.source?.padEnd(10)} ${status.count} obs. hasta ${status.lastDate}` : 'FALLÓ';
    console.log(`${status.ok ? '✔' : '✖'} ${spec.id.padEnd(24)} ${tag}`);
    for (const a of status.attempts) console.log(`    · ${a.source}: ${a.error}`);
    if (file) {
      files.set(spec.id, file);
      if (!values['dry-run']) await store.writeSeries(file);
    }
  }

  const report = renderReport(results, today);
  if (!values['dry-run']) {
    await store.writeJson(`${values.out}/catalog.json`, buildCatalog(registry, files, today));
    // En ejecuciones parciales (--only, --area) se conservan los estados de los demás indicadores.
    const previous = await readJsonSafe<{ results?: SeriesStatus[] }>(`${values.out}/status.json`);
    const fetched = new Set(results.map((r) => r.id));
    const mergedStatus = registry.indicators
      .map((s) => (fetched.has(s.id) ? results.find((r) => r.id === s.id) : previous?.results?.find((r) => r.id === s.id)))
      .filter((r): r is SeriesStatus => !!r);
    await store.writeJson(`${values.out}/status.json`, { generatedAt: new Date().toISOString(), today, results: mergedStatus });
    await writeFile('pipeline-report.md', report);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} indicadores actualizados.`);
  // Solo se marca error si nada funcionó; las fallas parciales se informan en el reporte.
  if (failed === results.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
