// Desenvolvido por MtsFerreira. Search only names already decoded from local map tiles.
import type { Map as MapLibreMap } from 'maplibre-gl';
import { normalizePostalCode } from '@markmap/maps/search';
import type { LocalSearchRecord } from './local-map-search';

export const MAX_VISIBLE_MAP_RECORDS = 2_000;
const MAX_SCANNED_FEATURES = 20_000;
const LAYERS = ['places', 'pois', 'roads', 'water'] as const;
const categories = { places: 'lugar', pois: 'ponto de interesse', roads: 'via', water: 'rio ou lago' };
export type SearchableMap = Pick<MapLibreMap, 'getStyle' | 'querySourceFeatures' | 'getBounds'>;

const QUERY_FILTER = [
  'any',
  ['has', 'name'],
  ['has', 'name:pt'],
  ['has', 'addr:postcode'],
  ['has', 'postcode'],
  ['has', 'postal_code'],
  ['has', 'postalcode'],
  ['has', 'cep'],
];

function position(value: unknown, depth = 0): [number, number] | null {
  if (!Array.isArray(value) || depth > 7) return null;
  if (typeof value[0] === 'number' && typeof value[1] === 'number') {
    const [lon, lat] = value;
    return Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90
      ? [lon, lat] : null;
  }
  // A vertex on the geometry, rather than a fabricated address or polygon centroid.
  return position(value[Math.floor(value.length / 2)], depth + 1);
}

const isValidName = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 220;

function explicitPostalCodes(properties: Record<string, unknown>): string[] {
  const values = ['addr:postcode', 'postcode', 'postal_code', 'postalcode', 'cep']
    .map((key) => properties[key])
    .filter((value): value is string => typeof value === 'string');
  const normalizedList = values.map(normalizePostalCode).filter((v): v is string => v !== null);
  return [...new Set(normalizedList)];
}

/** Source queries include cached tile edges; restrict result positions to the displayed area. */
export function collectVisibleMapSearch(
  map: SearchableMap, regionId: string, regionLabel = '',
): LocalSearchRecord[] {
  if (!regionId) return [];
  const style = map.getStyle();
  const bounds = map.getBounds();
  const sourceIds = Object.entries(style.sources ?? {}).filter(([, source]) =>
    source.type === 'vector' && typeof source.url === 'string' &&
    (source.url.startsWith('pmtiles://geonexo-offline:') || source.url.startsWith('pmtiles://markmap-offline:')),
  ).slice(0, 4).map(([id]) => id);
  const records: LocalSearchRecord[] = [];
  const seen = new Set<string>();
  let scanned = 0;
  for (const sourceId of sourceIds) {
    for (const layer of LAYERS) {
      const features = map.querySourceFeatures(sourceId, {
        sourceLayer: layer, filter: QUERY_FILTER,
      });
      for (const feature of features) {
        if (++scanned > MAX_SCANNED_FEATURES || records.length >= MAX_VISIBLE_MAP_RECORDS) return records;
        const properties = (feature.properties ?? {}) as Record<string, unknown>;
        let name = properties['name:pt'];
        if (!isValidName(name)) name = properties.name;
        if (!isValidName(name)) continue;

        const street = properties['addr:street'] ?? properties.street;
        const number = properties['addr:housenumber'] ?? properties.housenumber;
        const city = regionLabel || properties['addr:city'] || properties.city;
        const addressParts: string[] = [];
        if (typeof street === 'string' && street.trim()) addressParts.push(street.trim());
        if (typeof number === 'string' && number.trim()) addressParts.push(number.trim());
        if (typeof city === 'string' && city.trim()) addressParts.push(city.trim());
        const address = addressParts.join(', ');

        const title = (typeof name === 'string' && name.trim()) ||
          (typeof properties.title === 'string' && properties.title.trim()) ||
          (typeof properties.ref === 'string' && properties.ref.trim()) ||
          (typeof properties.label === 'string' && properties.label.trim());

        const labelParts: string[] = [];
        if (title) labelParts.push(title);
        if (address) labelParts.push(address);
        const label = labelParts.join(' · ');
        if (!label) continue;

        const normalized = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .toLowerCase().replace(/[ºª]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
        if (!normalized) continue;

        const key = `${sourceId}:${layer}:${normalized}`;
        if (seen.has(key)) continue;

        const coordinates = position((feature.geometry as { coordinates?: unknown } | null)?.coordinates);
        if (!coordinates || !bounds.contains(coordinates)) continue;

        seen.add(key);

        const postalCodes = explicitPostalCodes(properties);
        records.push({
          id: `map:${regionId}:${key}`,
          name: label.slice(0, 200),
          normalized,
          type: layer,
          category: categories[layer],
          lon: coordinates[0],
          lat: coordinates[1],
          ...(postalCodes.length ? { postalCodes } : {}),
        });
      }
    }
  }
  return records;
}
