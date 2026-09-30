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
>[0] & {
  /** Preserved from the previous configuration; MapLibre v6 omits it publicly. */
  showUserHeading?: boolean;
};

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

  // Preserve the previous heading request. This does not prove that MapLibre v6
  // renders a heading indicator because the public v6 type omits this option.
  const locationOptions: LegacyGeolocateOptions = {
    positionOptions: {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
    trackUserLocation: true,
    showUserHeading: true,
  };
  const locationControl = new MapLibreGeolocateControl(locationOptions);

  map.addControl(locationControl, 'top-right');

  locationControl.on('geolocate', (event) => {
    console.info('GPS obtido:', event.coords.latitude, event.coords.longitude);
  });
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
