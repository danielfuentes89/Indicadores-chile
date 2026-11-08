import { describe, expect, it } from 'vitest';
import { isStale } from '../catalog.ts';

describe('isStale', () => {
  const today = '2026-11-08';

  it('no marca el último trimestre publicado mientras se espera el siguiente', () => {
    expect(isStale('2026-04-01', 'Q', today)).toBe(false);
  });

  it('marca un trimestre atrasado', () => {
    expect(isStale('2025-10-01', 'Q', today)).toBe(true);
  });

  it('marca una serie mensual detenida hace meses', () => {
    expect(isStale('2025-12-01', 'M', today)).toBe(true);
    expect(isStale('2026-09-01', 'M', today)).toBe(false);
  });

  it('sin datos no hay alerta', () => {
    expect(isStale(undefined, 'D', today)).toBe(false);
  });
});
