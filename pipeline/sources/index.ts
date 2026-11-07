import type { SourceId } from '../schema.ts';
import type { Source } from '../types.ts';
import { bcch } from './bcch.ts';
import { cmf } from './cmf.ts';
import { imf } from './imf.ts';
import { mindicador } from './mindicador.ts';
import { worldbank } from './worldbank.ts';

export const SOURCES: Record<SourceId, Source> = { bcch, cmf, mindicador, worldbank, imf };
