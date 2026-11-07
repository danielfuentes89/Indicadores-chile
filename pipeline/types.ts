import type { IndicatorSpec, Observation, Provider, SourceId } from './schema.ts';

export type Env = Record<string, string | undefined>;

export interface HttpClient {
  getJson(url: string, opts?: { label?: string }): Promise<unknown>;
}

export interface FetchContext {
  spec: IndicatorSpec;
  provider: Provider;
  /** Fecha ISO desde la cual pedir datos (incluida). */
  from: string;
  /** Fecha ISO hasta la cual pedir datos (incluida). */
  to: string;
  env: Env;
  http: HttpClient;
}

export interface FetchResult {
  observations: Observation[];
  compare?: Record<string, Observation[]>;
  projectionFrom?: string;
}

export interface Source {
  id: SourceId;
  /** Devuelve un mensaje si faltan credenciales; `null` si la fuente está lista. */
  missingConfig(env: Env): string | null;
  /**
   * `true` si la fuente acepta rangos de fechas y conviene pedir solo lo nuevo.
   * Las fuentes anuales (Banco Mundial, FMI) siempre se descargan completas porque
   * revisan años anteriores y son pocas observaciones.
   */
  incremental: boolean;
  fetch(ctx: FetchContext): Promise<FetchResult>;
}

export class SourceError extends Error {
  constructor(
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'SourceError';
  }
}
