import { describe, expect, it } from 'vitest';
import { base100, diff, filterPeriod, mergeObservations, pctChange, toCsv, yoy, type Obs } from './series.ts';

describe('transformaciones de series', () => {
  it('yoy mensual compara con el mismo mes del año anterior', () => {
    const obs: Obs[] = [['2025-01-01', 100], ['2025-02-01', 200], ['2026-01-01', 110], ['2026-02-01', 190]];
    expect(yoy(obs, 'M')).toEqual([['2026-01-01', 10], ['2026-02-01', -5]]);
  });

  it('yoy diario usa el último día hábil disponible', () => {
    const obs: Obs[] = [['2025-03-07', 100], ['2026-03-09', 120]]; // 2025-03-09 fue domingo
    expect(yoy(obs, 'D')).toEqual([['2026-03-09', 20]]);
  });

  it('variación, diferencia y base 100', () => {
    const obs: Obs[] = [['2026-01-01', 4], ['2026-02-01', 5]];
    expect(pctChange(obs)).toEqual([['2026-02-01', 25]]);
    expect(diff(obs)).toEqual([['2026-02-01', 1]]);
    expect(base100(obs)).toEqual([['2026-01-01', 100], ['2026-02-01', 125]]);
  });

  it('filtra por período relativo a la última observación', () => {
    const obs: Obs[] = [['2020-01-01', 1], ['2025-06-01', 2], ['2026-01-01', 3]];
    expect(filterPeriod(obs, '1Y')).toEqual([['2025-06-01', 2], ['2026-01-01', 3]]);
    expect(filterPeriod(obs, 'MAX')).toHaveLength(3);
  });

  it('mezcla series priorizando los datos nuevos', () => {
    expect(mergeObservations([['2026-01-01', 1], ['2026-01-02', 2]], [['2026-01-02', 3], ['2026-01-03', 4]])).toEqual([
      ['2026-01-01', 1], ['2026-01-02', 3], ['2026-01-03', 4],
    ]);
  });

  it('escapa CSV', () => {
    expect(toCsv([{ date: '2026-01-01', v: 'a,b' }], ['date', 'v'])).toBe('date,v\n2026-01-01,"a,b"');
  });
});
