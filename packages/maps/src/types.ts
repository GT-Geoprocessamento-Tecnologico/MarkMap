import type { BBox, GeoNexoFeature } from '@geonexo/geo';

/**
 * Public types of @geonexo/maps. Pages consume only these plus the factory
 * functions; Terra Draw and MapLibre internals never leak to the admin.
 */

/** A switchable basemap style. Never hardcoded in pages. */
export interface BasemapDefinition {
  id: string;
  label: string;
  styleUrl: string;
  attribution: string;
}

export type DrawModeId = 'select' | 'point' | 'linestring' | 'polygon';

export type DrawChangeType = 'create' | 'update' | 'delete';

/** Stable GeoJSON payload emitted for every draw change. */
export interface DrawChangeEvent {
  type: DrawChangeType;
  features: GeoNexoFeature[];
  ids: string[];
}

export type DrawChangeHandler = (event: DrawChangeEvent) => void;

export type MapStatus =
  | 'initializing'
  | 'ready'
  | 'style-error'
  | 'source-error'
  | 'fallback'
  | 'webgl-unsupported';

export interface LayerEntry {
  /** MapLibre layer id. */
  id: string;
  /** MapLibre source id backing this layer. */
  sourceId: string;
  visible: boolean;
  /** Small/medium datasets use GeoJSON; large ones must migrate to tiles. */
  kind: 'geojson' | 'vector-tile';
}

export interface FitBoundsOptions {
  padding?: number;
  maxZoom?: number;
}

export type { BBox, GeoNexoFeature };
