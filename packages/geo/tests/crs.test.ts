import { describe, expect, it } from 'vitest';

import {
  EPSG_SIRGAS2000,
  EPSG_WGS84,
  SRID_CANONICAL,
  isSupportedEpsg,
  sirgas2000ToWgs84,
  toCanonical,
  transformPosition,
  wgs84ToSirgas2000,
} from '../src/crs.js';

describe('crs constants', () => {
  it('uses SIRGAS 2000 as canonical storage SRID', () => {
    expect(SRID_CANONICAL).toBe(4674);
    expect(SRID_CANONICAL).toBe(EPSG_SIRGAS2000);
    expect(EPSG_WGS84).toBe(4326);
  });

  it('supports only WGS84 and SIRGAS 2000', () => {
    expect(isSupportedEpsg(4326)).toBe(true);
    expect(isSupportedEpsg(4674)).toBe(true);
    expect(isSupportedEpsg(3857)).toBe(false);
  });
});

describe('transformPosition', () => {
  it('returns the same position for identical CRS', () => {
    expect(transformPosition([-47.93, -15.78], 4326, 4326)).toEqual([-47.93, -15.78]);
  });

  it('round-trips between WGS84 and SIRGAS 2000', () => {
    const original: readonly number[] = [-47.9292, -15.7801];
    const toSirgas = wgs84ToSirgas2000(original);
    expect(toSirgas).not.toBeNull();
    if (toSirgas === null) {
      return;
    }
    const back = sirgas2000ToWgs84(toSirgas);
    expect(back).not.toBeNull();
    if (back === null) {
      return;
    }
    expect(back[0]).toBeCloseTo(original[0] ?? 0, 6);
    expect(back[1]).toBeCloseTo(original[1] ?? 0, 6);
  });

  it('normalizes to canonical SRID', () => {
    const canonical = toCanonical([-47.93, -15.78], 4326);
    expect(canonical).not.toBeNull();
  });

  it('rejects non-finite input', () => {
    expect(transformPosition([Number.NaN, 0], 4326, 4674)).toBeNull();
    expect(transformPosition([0], 4326, 4674)).toBeNull();
    expect(transformPosition([], 4326, 4674)).toBeNull();
  });
});
