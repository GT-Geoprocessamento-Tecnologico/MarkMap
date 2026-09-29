import { describe, expect, it } from 'vitest';

import {
  bboxCenter,
  bboxContains,
  bboxIntersects,
  bboxToPolygon,
  computeBbox,
  parseBboxParam,
} from '../src/bbox.js';

describe('parseBboxParam', () => {
  it('parses a valid bbox query value', () => {
    expect(parseBboxParam('-48,-16,-47,-15')).toEqual([-48, -16, -47, -15]);
  });

  it('rejects malformed values', () => {
    expect(parseBboxParam('-48,-16,-47')).toBeNull();
    expect(parseBboxParam('a,b,c,d')).toBeNull();
    expect(parseBboxParam('-47,-15,-48,-16')).toBeNull();
    expect(parseBboxParam('-200,-16,-47,-15')).toBeNull();
    expect(parseBboxParam(42)).toBeNull();
    expect(parseBboxParam(undefined)).toBeNull();
  });
});

describe('computeBbox', () => {
  it('computes the bbox of a polygon', () => {
    expect(
      computeBbox({
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
    ).toEqual([-48, -16, -47, -15]);
  });

  it('computes the bbox of a feature and a collection', () => {
    expect(
      computeBbox({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-47.93, -15.78] },
        properties: {},
      }),
    ).toEqual([-47.93, -15.78, -47.93, -15.78]);

    expect(
      computeBbox({
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [-48, -16] }, properties: {} },
          { type: 'Feature', geometry: { type: 'Point', coordinates: [-47, -15] }, properties: {} },
        ],
      }),
    ).toEqual([-48, -16, -47, -15]);
  });

  it('returns null when no finite position exists', () => {
    expect(computeBbox({ type: 'Point', coordinates: ['a', 'b'] })).toBeNull();
    expect(computeBbox(null)).toBeNull();
  });
});

describe('bbox helpers', () => {
  it('detects intersection, containment and center', () => {
    expect(
      bboxIntersects([-48, -16, -47, -15], [-47.5, -15.5, -46, -14]),
    ).toBe(true);
    expect(bboxIntersects([-48, -16, -47, -15], [-46, -14, -45, -13])).toBe(false);
    expect(bboxContains([-48, -16, -47, -15], -47.5, -15.5)).toBe(true);
    expect(bboxContains([-48, -16, -47, -15], -46, -14)).toBe(false);
    expect(bboxCenter([-48, -16, -47, -15])).toEqual([-47.5, -15.5]);
  });

  it('renders a closed polygon ring', () => {
    const polygon = bboxToPolygon([-48, -16, -47, -15]);
    expect(polygon.type).toBe('Polygon');
    const ring = polygon.coordinates[0];
    expect(ring?.length).toBe(5);
    expect(ring?.[0]).toEqual(ring?.[4]);
  });
});
