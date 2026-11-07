import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { SeriesFile } from './schema.ts';

export class Store {
  constructor(readonly root: string) {}

  seriesPath(id: string) {
    return join(this.root, 'series', `${id}.json`);
  }

  async readSeries(id: string): Promise<SeriesFile | null> {
    try {
      const parsed = SeriesFile.safeParse(JSON.parse(await readFile(this.seriesPath(id), 'utf8')));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async writeSeries(file: SeriesFile) {
    await this.writeText(this.seriesPath(file.id), formatSeries(SeriesFile.parse(file)));
  }

  async writeJson(path: string, data: unknown) {
    await this.writeText(path, JSON.stringify(data, null, 1) + '\n');
  }

  /** Escritura atómica: evita dejar JSON truncado si el proceso se interrumpe. */
  async writeText(path: string, text: string) {
    await mkdir(dirname(path), { recursive: true });
    const tmp = `${path}.tmp`;
    await writeFile(tmp, text);
    await rename(tmp, path);
  }
}

/**
 * JSON con una observación por línea: los diffs de git muestran solo los datos nuevos o revisados.
 */
export function formatSeries(file: SeriesFile): string {
  const obsBlock = (obs: SeriesFile['observations']) =>
    obs.length ? `[\n${obs.map((o) => `  ${JSON.stringify(o)}`).join(',\n')}\n ]` : '[]';
  const { observations, compare, ...meta } = file;
  const lines = Object.entries(meta)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  if (compare) {
    const entries = Object.entries(compare).map(([k, obs]) => `  ${JSON.stringify(k)}: ${obsBlock(obs).replace(/\n/g, '\n ')}`);
    lines.push(` "compare": {\n${entries.join(',\n')}\n }`);
  }
  lines.push(` "observations": ${obsBlock(observations)}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}
