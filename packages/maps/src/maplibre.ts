import type {
  AttributionControlOptions,
  GeolocateControl,
  Map as MapLibreMap,
  MapOptions,
} from 'maplibre-gl';
import type { BBox } from '@geonexo/geo';
import type { BasemapDefinition } from './types.js';
import {
  GeolocateControl as MapLibreGeolocateControl,
  Map as MLMap,
  NavigationControl,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl';
import mapLibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre's ESM build does not discover its worker automatically in Vite.
// Pin the worker emitted by Vite so production builds do not fall back to a
// missing relative URL.
setWorkerUrl(mapLibreWorkerUrl);

type LegacyGeolocateOptions = ConstructorParameters<
  typeof MapLibreGeolocateControl
>[0];

export interface CreateMapArgs {
  container: string | HTMLElement;
  basemap: BasemapDefinition;
  center?: [number, number];
  zoom?: number;
  attributionControl?: false | AttributionControlOptions;
  trackUserLocation?: boolean;
}

/** Retorno estendido: mapa + referência ao GeolocateControl */
export interface MapWithControls {
  map: MapLibreMap;
  geolocate: GeolocateControl;
}

/** Cria instância MapLibre + controles. Retorna map E geolocate juntos. */
export async function createMapLibreMap(args: CreateMapArgs): Promise<MapWithControls> {
  const options: MapOptions = {
    container: args.container,
    style: args.basemap.styleUrl,
    center: args.center ?? [-47.9292, -15.7801],
    zoom: args.zoom ?? 4,
  };
  if (args.attributionControl !== undefined) {
    options.attributionControl = args.attributionControl;
  }

  const map = new MLMap(options);
  map.addControl(new NavigationControl({ showCompass: true }), 'top-right');
  map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

  // Preserve the ... comment removed
  const locationOptions: LegacyGeolocateOptions = {
    positionOptions: {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
    trackUserLocation: args.trackUserLocation ?? true,
  };
  const locationControl = new MapLibreGeolocateControl({
    ...locationOptions,
    trackUserLocation: locationOptions.trackUserLocation ?? true,
  });

  map.addControl(locationControl, 'top-right');

  locationControl.on('error', (event) => {
    console.warn('Erro GPS (código', event.code, '):', event.message);
  });

  return { map, geolocate: locationControl };
}

/** Converte BBox GeoNexo para argumento fitBounds do MapLibre. */
export function toFitBounds(bbox: BBox): [[number, number], [number, number]] {
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ];
}
