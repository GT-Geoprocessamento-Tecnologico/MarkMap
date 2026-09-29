import type {
  AttributionControlOptions,
  Map as MapLibreMap,
  MapOptions,
} from 'maplibre-gl';
import type { BBox } from '@geonexo/geo';
import type { BasemapDefinition } from './types.js';

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
  geolocate: any; // GeolocateControl instance
}

/** Cria instância MapLibre + controles. Retorna map E geolocate juntos. */
import { Map as MLMap, NavigationControl, ScaleControl, GeolocateControl } from 'maplibre-gl';

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

  const locationControl = new GeolocateControl({
    positionOptions: {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    },
    trackUserLocation: true,
    showUserHeading: true,
  } as any);

  map.addControl(locationControl, 'top-right');

  locationControl.on('geolocate', (e: any) => {
    console.info('GPS obtido:', e.coords?.latitude, e.coords?.longitude);
  });
  locationControl.on('error', (e: any) => {
    console.warn('Erro GPS (código', e?.error?.code, '):', e?.error?.message);
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
