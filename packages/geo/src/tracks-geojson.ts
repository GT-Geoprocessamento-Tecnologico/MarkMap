import type { GpxImport, TrackPoint } from './gpx-types.js';

/** Canonical WGS84 output consumed by the existing GeoJSON dataset validator. */
export type TrackGeoJsonPosition = [number, number] | [number, number, number];
export interface TrackGeoJsonFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: TrackGeoJsonPosition } |
    { type: 'LineString'; coordinates: TrackGeoJsonPosition[] } |
    { type: 'Polygon'; coordinates: TrackGeoJsonPosition[][] };
  properties: Record<string, string | number | null>;
}
export interface TrackGeoJsonCollection { type: 'FeatureCollection'; features: TrackGeoJsonFeature[]; }

function position(point: { latitude: number; longitude: number; elevation?: number | null }): TrackGeoJsonPosition {
  if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
      point.latitude < -90 || point.latitude > 90 || point.longitude < -180 || point.longitude > 180)
    throw new Error('Coordenada inválida no arquivo de trilha.');
  return point.elevation != null && Number.isFinite(point.elevation)
    ? [point.longitude, point.latitude, point.elevation]
    : [point.longitude, point.latitude];
}

function description(name: string, detail: string | null | undefined, kind: string, segment?: number): Record<string, string | number | null> {
  return { name, description: detail ?? null, kind, ...(segment !== undefined ? { segment } : {}) };
}

/** Does not mutate the source; timestamps remain in the original GPX file. */
export function tracksToGeoJSON(imported: GpxImport): TrackGeoJsonCollection {
  const features: TrackGeoJsonFeature[] = [];
  const append = (points: TrackPoint[], properties: TrackGeoJsonFeature['properties']): void => {
    if (points.length === 0) return;
    const coords = points.map(position);
    const geometry: TrackGeoJsonFeature['geometry'] = coords.length === 1
      ? { type: 'Point', coordinates: coords[0]! }
      : { type: 'LineString', coordinates: coords };
    features.push({ type: 'Feature', geometry, properties });
  };
  for (const waypoint of imported.waypoints) {
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: position(waypoint) },
      properties: description(waypoint.name, waypoint.description, 'waypoint') });
  }
  for (const track of imported.tracks) {
    track.segments.forEach((segment, i) => append(segment.points,
      description(track.name, track.description, 'track', i + 1)));
  }
  for (const route of imported.routes) append(route.points, description(route.name, route.description, 'route'));
  for (const polygon of imported.polygons ?? []) {
    features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: polygon.rings.map((ring) => ring.map(position)) },
      properties: description(polygon.name, polygon.description, 'polygon') });
  }
  return { type: 'FeatureCollection', features };
}
