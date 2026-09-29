import { describe, expect, it, vi } from 'vitest';

import { createGeoNexoMap } from '../src/controller.js';
import type { MinimalMap } from '../src/controller.js';
import { createBasemapRegistry } from '../src/providers.js';

function createFakeMap(): MinimalMap & {
  styles: string[];
  sources: Map<string, object>;
  layersAdded: object[];
  layoutCalls: Array<{ layerId: string; value: unknown }>;
  handlers: Map<string, (event: unknown) => void>;
  fitBoundsCalls: number;
  removed: boolean;
} {
  const fake: MinimalMap & {
    styles: string[];
    sources: Map<string, object>;
    layersAdded: object[];
    layoutCalls: Array<{ layerId: string; value: unknown }>;
    handlers: Map<string, (event: unknown) => void>;
    fitBoundsCalls: number;
    removed: boolean;
  } = {
    styles: [],
    sources: new Map(),
    layersAdded: [],
    layoutCalls: [],
    handlers: new Map(),
    fitBoundsCalls: 0,
    removed: false,
    setStyle(style: string | object): void {
      if (typeof style === 'string') {
        fake.styles.push(style);
      } else {
        fake.styles.push('inline-fallback-style');
      }
    },
    addSource(id: string, source: object): void {
      fake.sources.set(id, source);
    },
    removeSource(id: string): void {
      fake.sources.delete(id);
    },
    getSource(id: string): unknown {
      return fake.sources.get(id);
    },
    addLayer(layer: object): void {
      fake.layersAdded.push(layer);
    },
    removeLayer(_id: string): void {
      fake.layersAdded = fake.layersAdded.filter(
        (layer) => (layer as Record<string, unknown>)['id'] !== _id,
      );
    },
    getLayer(id: string): unknown {
      const found = fake.layersAdded.find(
        (layer) => (layer as Record<string, unknown>)['id'] === id,
      );
      return found === undefined ? undefined : found;
    },
    setLayoutProperty(layerId: string, _name: string, value: unknown): void {
      fake.layoutCalls.push({ layerId, value });
    },
    fitBounds(): void {
      fake.fitBoundsCalls += 1;
    },
    on(event: string, handler: (event: unknown) => void): void {
      fake.handlers.set(event, handler);
    },
    off(event: string): void {
      fake.handlers.delete(event);
    },
    remove(): void {
      fake.removed = true;
    },
  };
  return fake;
}

describe('map controller', () => {
  it('boots with the configured basemap', () => {
    const fake = createFakeMap();
    const controller = createGeoNexoMap({ map: fake, registry: createBasemapRegistry() });
    expect(controller.getStatus()).toBe('ready');
    expect(fake.styles[0]).toContain('tiles.openfreemap.org');
    expect(controller.getBasemap()?.id).toBe('openfreemap-liberty');
  });

  it('switches basemap and rejects unknown ids', () => {
    const fake = createFakeMap();
    const controller = createGeoNexoMap({ map: fake, registry: createBasemapRegistry() });
    expect(controller.setBasemap('openfreemap-bright')).toBe(true);
    expect(controller.getBasemap()?.id).toBe('openfreemap-bright');
    expect(controller.setBasemap('missing')).toBe(false);
  });

  it('falls back to a local style when the basemap fails', () => {
    const fake = createFakeMap();
    const onStatusChange = vi.fn();
    const controller = createGeoNexoMap({
      map: fake,
      registry: createBasemapRegistry(),
      onStatusChange,
    });
    fake.handlers.get('error')?.({ error: { message: 'Failed to fetch style' } });
    expect(controller.isFallbackActive()).toBe(true);
    expect(fake.styles[fake.styles.length - 1]).toBe('inline-fallback-style');
    expect(onStatusChange).toHaveBeenCalledWith('fallback');
  });

  it('adds sources/layers and toggles visibility', () => {
    const fake = createFakeMap();
    const controller = createGeoNexoMap({ map: fake, registry: createBasemapRegistry() });
    controller.addGeoJsonSource('src-a', { type: 'FeatureCollection', features: [] });
    expect(fake.sources.has('src-a')).toBe(true);
    controller.addLayer({ id: 'layer-a', sourceId: 'src-a', visible: true, kind: 'geojson' });
    expect(controller.setLayerVisibility('layer-a', false)).toBe(true);
    expect(fake.layoutCalls).toContainEqual({ layerId: 'layer-a', value: 'none' });
    expect(controller.setLayerVisibility('missing', false)).toBe(false);
  });

  it('fits bounds, selects features and destroys cleanly', () => {
    const fake = createFakeMap();
    const onSelectFeature = vi.fn();
    const controller = createGeoNexoMap({
      map: fake,
      registry: createBasemapRegistry(),
      onSelectFeature,
    });
    controller.fitBounds([-48, -16, -47, -15]);
    expect(fake.fitBoundsCalls).toBe(1);
    controller.selectFeature({
      type: 'Feature',
      id: 'f1',
      geometry: { type: 'Point', coordinates: [-47.93, -15.78] },
      properties: {},
    });
    expect(controller.getSelectedId()).toBe('f1');
    expect(onSelectFeature).toHaveBeenCalledTimes(1);
    controller.selectFeature(null);
    expect(controller.getSelectedId()).toBeNull();
    controller.destroy();
    expect(fake.removed).toBe(true);
  });
});
