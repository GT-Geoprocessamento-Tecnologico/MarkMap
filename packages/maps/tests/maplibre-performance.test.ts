import { describe, expect, it } from 'vitest';
import { adaptiveMapBudget, readMapDeviceHints } from '../src/maplibre-performance.mjs';

describe('MapLibre device-adaptive budgets', () => {
  it('uses conservative settings when capability data is unavailable', () => {
    const budget = adaptiveMapBudget({});
    expect(budget.tier).toBe('constrained');
    expect(budget.workerCount).toBe(1);
    expect(budget.pixelRatio).toBeGreaterThanOrEqual(1);
  });

  it('limits render work on low-resource devices', () => {
    const budget = adaptiveMapBudget({ cores: 2, memoryGb: 1, devicePixelRatio: 4 });
    expect(budget.workerCount).toBe(1);
    expect(budget.pixelRatio).toBe(1.25);
    expect(budget.maxCanvasSize).toEqual([2048, 2048]);
  });

  it('uses available CPU/GPU while maintaining maximum bounds', () => {
    const budget = adaptiveMapBudget({ cores: 12, memoryGb: 16, devicePixelRatio: 3 });
    expect(budget.workerCount).toBe(3);
    expect(budget.pixelRatio).toBe(2);
    expect(budget.tileCacheZoomLevels).toBe(5);
  });

  it('respects reduced motion and absent browser-only APIs', () => {
    expect(adaptiveMapBudget({ cores: 8, memoryGb: 4, reducedMotion: true }).fadeDuration).toBe(0);
    expect(typeof readMapDeviceHints()).toBe('object');
  });

  it('ignores nonfinite and implausible capability values', () => {
    const budget = adaptiveMapBudget({ cores: NaN, memoryGb: Infinity, devicePixelRatio: Infinity });
    expect(budget.workerCount).toBe(1);
    expect(budget.pixelRatio).toBe(1);
  });
});
