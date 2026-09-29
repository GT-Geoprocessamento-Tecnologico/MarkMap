import { describe, expect, it } from 'vitest';

import { mapTerraDrawChange, snapshotToFeatures, toGeoNexoFeature } from '../src/draw-mapper.js';

const pointSnapshot = [
  {
    id: 'a1',
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-47.93, -15.78] },
    properties: { name: 'Ponto A' },
  },
];

describe('draw mapper', () => {
  it('converts a draw snapshot entry to stable GeoJSON', () => {
    const feature = toGeoNexoFeature(pointSnapshot[0]);
    expect(feature?.id).toBe('a1');
    expect(feature?.geometry?.type).toBe('Point');
    expect(feature?.properties).toEqual({ name: 'Ponto A' });
  });

  it('drops invalid entries instead of throwing', () => {
    expect(toGeoNexoFeature(null)).toBeNull();
    expect(toGeoNexoFeature({ type: 'Feature', geometry: null, properties: {} })).toBeNull();
    expect(
      toGeoNexoFeature({
        id: 'bad',
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [500, 500] },
        properties: {},
      }),
    ).toBeNull();
    expect(snapshotToFeatures('nope')).toEqual([]);
  });

  it('emits create/update with matched features', () => {
    const created = mapTerraDrawChange({ type: 'create', ids: ['a1'], snapshot: pointSnapshot });
    expect(created.type).toBe('create');
    expect(created.ids).toEqual(['a1']);
    expect(created.features.length).toBe(1);

    const updated = mapTerraDrawChange({ type: 'update', ids: ['a1'], snapshot: pointSnapshot });
    expect(updated.type).toBe('update');
    expect(updated.features[0]?.id).toBe('a1');
  });

  it('emits delete with ids only', () => {
    const deleted = mapTerraDrawChange({ type: 'delete', ids: ['a1'], snapshot: [] });
    expect(deleted.type).toBe('delete');
    expect(deleted.ids).toEqual(['a1']);
    expect(deleted.features).toEqual([]);
  });
});
