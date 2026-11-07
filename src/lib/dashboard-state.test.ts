import { describe, expect, it } from 'vitest';
import { decodeState, encodeState, sanitize } from './dashboard-state.ts';

const known = new Set(['uf', 'dolar-observado']);

describe('estado del dashboard', () => {
  it('ida y vuelta por la URL', () => {
    const state = { v: 1 as const, cards: [{ id: 'uf', view: 'kpi' as const, period: '5Y' as const, transform: 'yoy' as const, compare: false }] };
    expect(decodeState(encodeState(state), known)).toEqual(state);
  });

  it('descarta indicadores desconocidos y valores inválidos', () => {
    expect(decodeState('hack~x~y~z~1|uf~pie~99Y~sqrt~1', known)).toEqual({
      v: 1,
      cards: [{ id: 'uf', view: 'line', period: 'MAX', transform: 'level', compare: true }],
    });
    expect(sanitize('basura', known)).toEqual({ v: 1, cards: [] });
  });
});
