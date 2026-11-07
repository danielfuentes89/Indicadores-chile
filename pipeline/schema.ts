import { z } from 'zod';

// `.strict()` detecta errores típicos de YAML, como comas sin comillas que crean claves extra.
export const Localized = z.object({ es: z.string().min(1), en: z.string().min(1) }).strict();
export type Localized = z.infer<typeof Localized>;

/** D = diaria, M = mensual, Q = trimestral, A = anual */
export const Frequency = z.enum(['D', 'M', 'Q', 'A']);
export type Frequency = z.infer<typeof Frequency>;

export const SourceId = z.enum(['bcch', 'cmf', 'mindicador', 'worldbank', 'imf']);
export type SourceId = z.infer<typeof SourceId>;

/** Transformaciones que el pipeline puede aplicar a la serie de un proveedor antes de guardarla. */
export const Derive = z.enum(['yoy']);
export type Derive = z.infer<typeof Derive>;

export const Provider = z.object({
  source: SourceId,
  /** Código de la serie en la fuente (p. ej. F073.TCO.PRE.Z.D en la BDE, NY.GDP.PCAP.PP.CD en el Banco Mundial). */
  code: z.string().min(1),
  derive: Derive.optional(),
  /** Parámetros extra propios de la fuente (p. ej. `source: "3"` para indicadores de gobernanza del Banco Mundial). */
  params: z.record(z.string()).optional(),
});
export type Provider = z.infer<typeof Provider>;

export const CompareSpec = z.object({
  /** Código del agregado en la fuente (OED, LCN, WEOWORLD, ADVEC, …). */
  code: z.string().min(1),
  label: Localized,
});
export type CompareSpec = z.infer<typeof CompareSpec>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha ISO YYYY-MM-DD');

export const IndicatorSpec = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id en minúsculas, números y guiones'),
  area: z.string(),
  name: Localized,
  short: Localized.optional(),
  description: Localized,
  unit: Localized,
  decimals: z.number().int().min(0).max(6).default(2),
  frequency: Frequency,
  featured: z.boolean().default(false),
  /** Primera fecha a descargar en una carga completa. */
  start: isoDate.default('2000-01-01'),
  /** Proveedores en orden de preferencia: el primero configurado y exitoso gana. */
  providers: z.array(Provider).min(1),
  compare: z.array(CompareSpec).optional(),
  notes: Localized.optional(),
});
export type IndicatorSpec = z.infer<typeof IndicatorSpec>;

export const AreaSpec = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: Localized,
  description: Localized,
  status: z.enum(['active', 'planned']).default('active'),
});
export type AreaSpec = z.infer<typeof AreaSpec>;

export const SourceSpec = z.object({
  name: Localized,
  url: z.string().url(),
  license: Localized,
  auth: z.enum(['none', 'apikey']),
  official: z.boolean(),
});
export type SourceSpec = z.infer<typeof SourceSpec>;

export const Registry = z
  .object({
    areas: z.array(AreaSpec).min(1),
    sources: z.record(SourceId, SourceSpec),
    indicators: z.array(IndicatorSpec).min(1),
  })
  .superRefine((reg, ctx) => {
    const areaIds = new Set(reg.areas.map((a) => a.id));
    const seen = new Set<string>();
    reg.indicators.forEach((ind, i) => {
      if (seen.has(ind.id)) {
        ctx.addIssue({ code: 'custom', path: ['indicators', i, 'id'], message: `id duplicado: ${ind.id}` });
      }
      seen.add(ind.id);
      if (!areaIds.has(ind.area)) {
        ctx.addIssue({ code: 'custom', path: ['indicators', i, 'area'], message: `área desconocida: ${ind.area}` });
      }
      ind.providers.forEach((p, j) => {
        if (!reg.sources[p.source]) {
          ctx.addIssue({
            code: 'custom',
            path: ['indicators', i, 'providers', j, 'source'],
            message: `fuente sin metadatos en "sources": ${p.source}`,
          });
        }
      });
    });
  });
export type Registry = z.infer<typeof Registry>;

/** Una observación: [fecha ISO, valor]. */
export const Observation = z.tuple([isoDate, z.number().finite()]);
export type Observation = z.infer<typeof Observation>;

export const SeriesFile = z.object({
  id: z.string(),
  source: SourceId,
  code: z.string(),
  derive: Derive.optional(),
  fetchedAt: z.string(),
  observations: z.array(Observation),
  compare: z.record(z.array(Observation)).optional(),
  /** Desde este año los valores son proyecciones (FMI WEO). */
  projectionFrom: z.string().optional(),
});
export type SeriesFile = z.infer<typeof SeriesFile>;

export const SeriesStatus = z.object({
  id: z.string(),
  ok: z.boolean(),
  source: SourceId.optional(),
  /** Fuentes intentadas y el motivo por el que se descartaron. */
  attempts: z.array(z.object({ source: SourceId, error: z.string() })),
  lastDate: isoDate.optional(),
  count: z.number().int().optional(),
});
export type SeriesStatus = z.infer<typeof SeriesStatus>;

export const CatalogEntry = IndicatorSpec.omit({ providers: true, start: true }).extend({
  source: SourceId.optional(),
  code: z.string().optional(),
  derive: Derive.optional(),
  updatedAt: z.string().optional(),
  last: Observation.optional(),
  previous: Observation.optional(),
  /** Últimas observaciones para el sparkline de las tarjetas. */
  spark: z.array(z.number()).optional(),
  hasCompare: z.boolean().default(false),
  projectionFrom: z.string().optional(),
  /** La fuente no ha publicado datos recientes para la frecuencia del indicador. */
  stale: z.boolean().default(false),
});
export type CatalogEntry = z.infer<typeof CatalogEntry>;

export const Catalog = z.object({
  generatedAt: z.string(),
  areas: z.array(AreaSpec),
  sources: z.record(SourceId, SourceSpec),
  indicators: z.array(CatalogEntry),
});
export type Catalog = z.infer<typeof Catalog>;
