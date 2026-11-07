import type { HttpClient } from './types.ts';

export interface HttpOptions {
  timeoutMs?: number;
  retries?: number;
  /** Pausa mínima entre solicitudes al mismo host, para no sobrecargar las APIs públicas. */
  minIntervalMs?: number;
  userAgent?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Quita credenciales de una URL antes de mostrarla en logs o reportes. */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const key of ['pass', 'apikey', 'user', 'token']) {
      if (u.searchParams.has(key)) u.searchParams.set(key, '***');
    }
    return u.toString();
  } catch {
    return url;
  }
}

export function createHttpClient(opts: HttpOptions = {}): HttpClient {
  const timeoutMs = opts.timeoutMs ?? 45_000;
  const retries = opts.retries ?? 3;
  const minIntervalMs = opts.minIntervalMs ?? 250;
  const userAgent = opts.userAgent ?? 'indicadores-chile-bot/0.1 (+https://github.com/danielfuentes89/Indicadores-chile)';
  const lastCall = new Map<string, number>();

  async function throttle(host: string) {
    const wait = (lastCall.get(host) ?? 0) + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall.set(host, Date.now());
  }

  return {
    async getJson(url: string) {
      const host = new URL(url).host;
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1));
        await throttle(host);
        try {
          const res = await fetch(url, {
            headers: { accept: 'application/json', 'user-agent': userAgent },
            signal: AbortSignal.timeout(timeoutMs),
          });
          const text = await res.text();
          if (res.status >= 500 || res.status === 429) {
            lastError = new Error(`HTTP ${res.status} en ${redactUrl(url)}`);
            continue;
          }
          if (!res.ok) {
            // Algunas APIs (CMF) informan errores como JSON con código 4xx: se incluye el cuerpo.
            throw new Error(`HTTP ${res.status} en ${redactUrl(url)}: ${text.slice(0, 200).replace(/\s+/g, ' ')}`);
          }
          try {
            return JSON.parse(text);
          } catch {
            throw new Error(`Respuesta no es JSON (${redactUrl(url)}): ${text.slice(0, 120)}`);
          }
        } catch (err) {
          const e = err as Error;
          const transient = e.name === 'TimeoutError' || e.name === 'AbortError' || /fetch failed|ECONNRESET|ETIMEDOUT/i.test(e.message);
          if (!transient) throw err;
          lastError = new Error(`${e.name === 'TimeoutError' ? 'Tiempo de espera agotado' : e.message} en ${redactUrl(url)}`);
        }
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    },
  };
}
