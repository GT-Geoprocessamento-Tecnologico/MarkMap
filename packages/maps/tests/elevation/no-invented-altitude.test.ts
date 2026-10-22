import { describe, expect, it } from 'vitest';
import { computeElevationProfile } from '../../src/elevation/profile.js';
import type { DemMetadata } from '@markmap/contracts';

const metadata = { bounds: [0, 0, 1, 1], width: 2, height: 2, noDataValue: -9999 } as unknown as DemMetadata;

describe('no fabricated elevation', () => {
  it('keeps a legitimate sea-level sample at zero', () => {
    const profile = computeElevationProfile([[0, 0], [1, 1]], new Int16Array([0, 20, 40, 60]), metadata);
    expect(profile.points[0]?.elevation).toBe(0);
    expect(profile.points[1]?.elevation).toBe(60);
  });
  it('refuses missing DEM samples rather than reporting zero altitude', () => {
    expect(() => computeElevationProfile([[0, 0], [1.2, 1.2]], new Int16Array([0, 20, 40, 60]), metadata)).toThrow(/Sem dados de elevação/);
  });
});
