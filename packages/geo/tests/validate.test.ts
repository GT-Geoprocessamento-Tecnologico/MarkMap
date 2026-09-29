import { describe, expect, it } from 'vitest';

import { isValidLatitude, isValidLongitude, isValidPosition, validateGeometryLight } from '../src/validate.js';

describe('coordinate ranges', () => {
  it('accepts valid lng/lat', () => {
    expect(isValidLongitude(-47.93)).toBe(true);
    expect(isValidLatitude(-15.78)).toBe(true);
    expect(isValidPosition([-47.93, -15.78])).toBe(true);
    expect(isValidPosition([-47.93, -15.78, 100])).toBe(true);
  });

  it('rejects out-of-range coordinates', () => {
    expect(isValidLongitude(181)).toBe(false);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidPosition([200, 0])).toBe(false);
    expect(isValidPosition([0, -100])).toBe(false);
    expect(isValidPosition([1, 2, 3, 4])).toBe(false);
    expect(isValidPosition(['a', 'b'])).toBe(false);
  });
});

describe('validateGeometryLight', () => {
  it('accepts point, line and polygon', () => {
    expect(validateGeometryLight({ type: 'Point', coordinates: [-47.93, -15.78] })).toEqual({
      ok: true,
    });
    expect(
      validateGeometryLight({
        type: 'LineString',
        coordinates: [
          [-47.93, -15.78],
          [-47.94, -15.79],
        ],
      }),
    ).toEqual({ ok: true });
    expect(
      validateGeometryLight({
        type: 'Polygon',
        coordinates: [
          [
            [-48, -16],
            [-47, -16],
            [-47, -15],
            [-48, -16],
          ],
        ],
      }),
    ).toEqual({ ok: true });
  });

  it('rejects polygon with hole fixtures only when malformed', () => {
    expect(
      validateGeometryLight({
        type: 'Polygon',
        coordinates: [
          [
            [-48, -16],
            [-47, -16],
            [-47, -15],
            [-48, -15],
            [-48, -16],
          ],
          [
            [-47.8, -15.8],
            [-47.6, -15.8],
            [-47.6, -15.6],
            [-47.8, -15.8],
          ],
        ],
      }),
    ).toEqual({ ok: true });
  });

  it('rejects empty, unclosed and out-of-range geometries', () => {
    expect(validateGeometryLight({ type: 'Point', coordinates: [] }).ok).toBe(false);
    expect(
      validateGeometryLight({
        type: 'Polygon',
        coordinates: [
          [
            [-48, -16],
            [-47, -16],
            [-47, -15],
          ],
        ],
      }).ok,
    ).toBe(false);
    expect(
      validateGeometryLight({
        type: 'Point',
        coordinates: [500, 500],
      }).ok,
    ).toBe(false);
    expect(validateGeometryLight({ type: 'Circle', coordinates: [0, 0] }).ok).toBe(false);
    expect(validateGeometryLight(null).ok).toBe(false);
  });
});
