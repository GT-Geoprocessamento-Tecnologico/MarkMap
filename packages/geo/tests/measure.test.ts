import { describe, expect, it } from 'vitest';

import { createFeature } from '../src/geojson.js';
import type { GeoJsonPolygon } from '../src/geojson.js';
import { centroidOf, measureAreaSquareMeters, measureLengthMeters } from '../src/measure.js';

const squareKilometerSide: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-48.0, -16.0],
      [-47.991, -16.0],
      [-47.991, -15.991],
      [-48.0, -15.991],
      [-48.0, -16.0],
    ],
  ],
};

describe('measure helpers', () => {
  it('measures polygon area in square meters', () => {
    const area = measureAreaSquareMeters(createFeature(squareKilometerSide, {}));
    expect(area).toBeGreaterThan(500_000);
    expect(area).toBeLessThan(2_000_000);
  });

  it('returns zero area for non-polygons', () => {
    expect(
      measureAreaSquareMeters(createFeature({ type: 'Point', coordinates: [0, 0] }, {})),
    ).toBe(0);
  });

  it('measures line length in meters', () => {
    const length = measureLengthMeters(
      createFeature(
        {
          type: 'LineString',
          coordinates: [
            [-48.0, -16.0],
            [-47.991, -16.0],
          ],
        },
        {},
      ),
    );
    expect(length).toBeGreaterThan(500);
    expect(length).toBeLessThan(2000);
  });

  it('returns zero length for non-lines', () => {
    expect(
      measureLengthMeters(createFeature({ type: 'Point', coordinates: [0, 0] }, {})),
    ).toBe(0);
  });

  it('computes a centroid inside the polygon bbox', () => {
    const centroid = centroidOf(createFeature(squareKilometerSide, {}));
    expect(centroid).not.toBeNull();
    if (centroid === null) {
      return;
    }
    expect(centroid[0]).toBeGreaterThan(-48.0);
    expect(centroid[0]).toBeLessThan(-47.991);
    expect(centroid[1]).toBeGreaterThan(-16.0);
    expect(centroid[1]).toBeLessThan(-15.991);
  });
});
