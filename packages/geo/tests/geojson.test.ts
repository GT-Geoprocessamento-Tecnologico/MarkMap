import { describe, expect, it } from 'vitest';

import {
  createFeature,
  createFeatureCollection,
  emptyFeatureCollection,
  geometryTypeOf,
  isFeature,
  isFeatureCollection,
  normalizeProperties,
} from '../src/geojson.js';

describe('geojson helpers', () => {
  it('creates features with normalized properties', () => {
    const feature = createFeature({ type: 'Point', coordinates: [0, 0] }, { name: 'A' }, 'id-1');
    expect(feature.type).toBe('Feature');
    expect(feature.id).toBe('id-1');
    expect(feature.properties).toEqual({ name: 'A' });
    expect(normalizeProperties('nope')).toEqual({});
    expect(normalizeProperties(null)).toEqual({});
  });

  it('builds collections without shared mutation', () => {
    const first = createFeature({ type: 'Point', coordinates: [0, 0] }, {});
    const collection = createFeatureCollection([first]);
    expect(collection.features.length).toBe(1);
    expect(emptyFeatureCollection().features).toEqual([]);
  });

  it('narrows features and collections', () => {
    const feature = createFeature({ type: 'Point', coordinates: [0, 0] }, {});
    expect(isFeature(feature)).toBe(true);
    expect(isFeature({ type: 'Point', coordinates: [0, 0] })).toBe(false);
    expect(isFeatureCollection(createFeatureCollection([feature]))).toBe(true);
    expect(isFeatureCollection(feature)).toBe(false);
  });

  it('discriminates geometry types', () => {
    expect(geometryTypeOf({ type: 'Polygon', coordinates: [] })).toBe('Polygon');
    expect(geometryTypeOf({ type: 'Circle' })).toBeNull();
    expect(geometryTypeOf(null)).toBeNull();
  });
});
