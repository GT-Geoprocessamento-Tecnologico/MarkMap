import type {
  AttributionControlOptions,
  Map as MapLibreMap,
  MapOptions,
} from 'maplibre-gl';
import type { BBox } from '@geonexo/geo';
import type { BasemapDefinition } from './types.js';

/**
 * MapLibre GL bootstrap. Isolated in its own module so unit tests never
 * import `maplibre-gl` (DOM/WebGL) and the controller stays injectable.
 *
 * Official example pattern: new maplibregl.Map({ container, style, ... }).
 * License: maplibre-gl-js is BSD-3-Clause (permissive, approved for reuse).
 */

export interface CreateMapArgs {
  container: string | HTMLElement;
  basemap: BasemapDefinition;
  center?: [number, number];
  zoom?: number;
  /**
   * MapLibre v4 accepts `false` (disable) or options; omitting the key
   * keeps the default control.
   */
  attributionControl?: false | AttributionControlOptions;
}

/** Create a live MapLibre instance. Call only in the browser. */
export async function createMapLibreMap(args: CreateMapArgs): Promise<MapLibreMap> {
  const maplibregl = await import('maplibre-gl');
  const options: MapOptions = {
    container: args.container,
    style: args.basemap.styleUrl,
    center: args.center ?? [-47.9292, -15.7801],
    zoom: args.zoom ?? 4,
  };
  if (args.attributionControl !== undefined) {
    options.attributionControl = args.attributionControl;
  }
  const map = new maplibregl.Map(options);
  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
  return map;
}

/** Convert a GeoNexo bbox to a MapLibre fitBounds argument. */
export function toFitBounds(bbox: BBox): [[number, number], [number, number]] {
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ];
}
