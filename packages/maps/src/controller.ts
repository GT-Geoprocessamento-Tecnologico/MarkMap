import type { BBox, GeoNexoFeature, GeoNexoFeatureCollection } from '@markmap/geo';
import { createFallbackStyle, shouldFallbackOnError } from './fallback.js';
import { createLayerStore, layerVisibilityLayoutValue } from './layers.js';
import type { LayerStore } from './layers.js';
import type { BasemapRegistry } from './providers.js';
import type {
  BasemapDefinition,
  FitBoundsOptions,
  LayerEntry,
  MapStatus,
} from './types.js';

/**
 * Minimal surface of MapLibre GL used by the controller. Kept as an
 * interface (instead of importing maplibre-gl) so unit tests inject a fake
 * and pages never touch `map.addLayer` directly.
 */
export interface MinimalMap {
  setStyle(style: string | object): void;
  addSource(id: string, source: object): void;
  removeSource(id: string): void;
  getSource(id: string): unknown;
  addLayer(layer: object): void;
  removeLayer(id: string): void;
  getLayer(id: string): unknown;
  setLayoutProperty(layerId: string, name: string, value: unknown): void;
  fitBounds(bounds: [[number, number], [number, number]], options?: object): void;
  on(event: string, handler: (event: unknown) => void): void;
  off(event: string, handler: (event: unknown) => void): void;
  remove(): void;
}

export interface GeoNexoMapOptions {
  map: MinimalMap;
  registry: BasemapRegistry;
  initialBasemapId?: string;
  onStatusChange?: (status: MapStatus) => void;
  onSelectFeature?: (feature: GeoNexoFeature | null) => void;
}

export type MarkMapMapOptions = GeoNexoMapOptions;

export interface GeoNexoMap {
  readonly layers: LayerStore;
  getStatus(): MapStatus;
  getBasemap(): BasemapDefinition | null;
  setBasemap(id: string): boolean;
  isFallbackActive(): boolean;
  addGeoJsonSource(sourceId: string, data: GeoNexoFeatureCollection): void;
  removeSource(sourceId: string): void;
  addLayer(entry: LayerEntry, paint?: Record<string, unknown>): void;
  removeLayer(layerId: string): void;
  setLayerVisibility(layerId: string, visible: boolean): boolean;
  fitBounds(bbox: BBox, options?: FitBoundsOptions): void;
  selectFeature(feature: GeoNexoFeature | null): void;
  getSelectedId(): string | null;
  getSelectedFeature(): GeoNexoFeature | null;
  destroy(): void;
}

export type MarkMap = GeoNexoMap;
export type MarkMapMap = GeoNexoMap;

/**
 * Create the map controller: owns basemap state, layer bookkeeping,
 * selection state and style-failure fallback. Draw modes live in the draw
 * adapter; measurement/CRS helpers live in @markmap/geo.
 */
export function createGeoNexoMap(options: GeoNexoMapOptions): GeoNexoMap {
  const layers = createLayerStore();
  const { map, registry } = options;
  let status: MapStatus = 'initializing';
  let fallbackActive = false;
  let selected: GeoNexoFeature | null = null;
  let destroyed = false;

  function emit(next: MapStatus): void {
    status = next;
    options.onStatusChange?.(next);
  }

  function applyStyleUrl(styleUrl: string): void {
    map.setStyle(styleUrl);
  }

  const requestedInitial = options.initialBasemapId;
  const initial =
    (requestedInitial !== undefined ? registry.get(requestedInitial) : registry.getActive()) ??
    registry.getActive();
  if (initial !== null) {
    registry.setActiveId(initial.id);
    applyStyleUrl(initial.styleUrl);
  }
  emit('ready');

  function handleMapError(event: unknown): void {
    if (destroyed || fallbackActive) {
      return;
    }
    if (shouldFallbackOnError(event)) {
      fallbackActive = true;
      map.setStyle(createFallbackStyle() as unknown as object);
      emit('fallback');
    } else {
      emit('style-error');
    }
  }

  map.on('error', handleMapError);

  return {
    layers,

    getStatus(): MapStatus {
      return status;
    },

    getBasemap(): BasemapDefinition | null {
      return fallbackActive ? null : registry.getActive();
    },

    setBasemap(id: string): boolean {
      if (destroyed) {
        return false;
      }
      const definition = registry.get(id);
      if (definition === null) {
        return false;
      }
      registry.setActiveId(id);
      fallbackActive = false;
      applyStyleUrl(definition.styleUrl);
      emit('ready');
      return true;
    },

    isFallbackActive(): boolean {
      return fallbackActive;
    },

    addGeoJsonSource(sourceId: string, data: GeoNexoFeatureCollection): void {
      if (destroyed || sourceId.length === 0) {
        return;
      }
      if (map.getSource(sourceId) !== undefined) {
        map.removeSource(sourceId);
      }
      map.addSource(sourceId, {
        type: 'geojson',
        data: { ...data, features: [...data.features] },
      });
    },

    removeSource(sourceId: string): void {
      if (destroyed) {
        return;
      }
      if (map.getSource(sourceId) !== undefined) {
        map.removeSource(sourceId);
      }
    },

    addLayer(entry: LayerEntry, paint?: Record<string, unknown>): void {
      if (destroyed) {
        return;
      }
      layers.add(entry);
      if (map.getLayer(entry.id) !== undefined) {
        map.removeLayer(entry.id);
      }
      const layer: Record<string, unknown> = {
        id: entry.id,
        source: entry.sourceId,
        layout: { visibility: layerVisibilityLayoutValue(entry.visible) },
      };
      if (entry.kind === 'vector-tile') {
        layer['source-layer'] = entry.id;
      }
      if (paint !== undefined) {
        layer['paint'] = paint;
      }
      map.addLayer(layer);
    },

    removeLayer(layerId: string): void {
      if (destroyed) {
        return;
      }
      layers.remove(layerId);
      if (map.getLayer(layerId) !== undefined) {
        map.removeLayer(layerId);
      }
    },

    setLayerVisibility(layerId: string, visible: boolean): boolean {
      if (destroyed) {
        return false;
      }
      const tracked = layers.setVisibility(layerId, visible);
      if (!tracked) {
        return false;
      }
      if (map.getLayer(layerId) !== undefined) {
        map.setLayoutProperty(layerId, 'visibility', layerVisibilityLayoutValue(visible));
      }
      return true;
    },

    fitBounds(bbox: BBox, fitOptions?: FitBoundsOptions): void {
      if (destroyed) {
        return;
      }
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        {
          padding: fitOptions?.padding ?? 32,
          maxZoom: fitOptions?.maxZoom,
        },
      );
    },

    selectFeature(feature: GeoNexoFeature | null): void {
      if (destroyed) {
        return;
      }
      selected = feature === null ? null : { ...feature };
      options.onSelectFeature?.(selected === null ? null : { ...selected });
    },

    getSelectedId(): string | null {
      if (selected === null || selected.id === undefined) {
        return null;
      }
      return selected.id;
    },

    getSelectedFeature(): GeoNexoFeature | null {
      return selected === null ? null : { ...selected };
    },

    destroy(): void {
      if (destroyed) {
        return;
      }
      destroyed = true;
      map.off('error', handleMapError);
      map.remove();
    },
  };
}

export const createMarkMap = createGeoNexoMap;
export const createMarkMapMap = createGeoNexoMap;
