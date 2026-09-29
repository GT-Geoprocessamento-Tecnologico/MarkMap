import { describe, expect, it } from 'vitest';

import { createLayerStore, layerVisibilityLayoutValue } from '../src/layers.js';

describe('layer store', () => {
  it('adds, lists and removes layers', () => {
    const store = createLayerStore();
    store.add({ id: 'parcels', sourceId: 'src-parcels', visible: true, kind: 'geojson' });
    expect(store.list().length).toBe(1);
    expect(store.get('parcels')?.visible).toBe(true);
    expect(store.remove('parcels')).toBe(true);
    expect(store.get('parcels')).toBeNull();
  });

  it('controls visibility without touching the map', () => {
    const store = createLayerStore();
    store.add({ id: 'roads', sourceId: 'src-roads', visible: true, kind: 'geojson' });
    expect(store.setVisibility('roads', false)).toBe(true);
    expect(store.isVisible('roads')).toBe(false);
    expect(store.setVisibility('missing', false)).toBe(false);
  });

  it('maps visibility to MapLibre layout values', () => {
    expect(layerVisibilityLayoutValue(true)).toBe('visible');
    expect(layerVisibilityLayoutValue(false)).toBe('none');
  });
});
