import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { Registry } from './schema.ts';

export const REGISTRY_PATH = fileURLToPath(new URL('../config/indicators.yaml', import.meta.url));

export async function loadRegistry(path = REGISTRY_PATH): Promise<Registry> {
  const raw = parse(await readFile(path, 'utf8'));
  const result = Registry.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`config/indicators.yaml no es válido:\n${issues}`);
  }
  return result.data;
}
