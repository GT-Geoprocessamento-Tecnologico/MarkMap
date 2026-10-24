import type { GpxImport, Waypoint, Track, Route, KmlPolygon } from "./gpx-types.js";

/** Canonical WGS84 output consumed by the existing GeoJSON dataset validator. */
export type TrackGeoJsonPosition = [number, number] | [number, number, number];
export interface TrackGeoJsonFeature {
  type: "Feature";
  id?: string;
  geometry:
    | { type: "Point"; coordinates: TrackGeoJsonPosition }
    | { type: "LineString"; coordinates: TrackGeoJsonPosition[] }
    | { type: "Polygon"; coordinates: TrackGeoJsonPosition[][] };
  properties: Record<string, string | number | boolean | null>;
}
export interface TrackGeoJsonCollection {
  type: "FeatureCollection";
  features: TrackGeoJsonFeature[];
}

function position(point: {
  latitude: number;
  longitude: number;
  elevation?: number | null;
}): TrackGeoJsonPosition {
  if (
    !Number.isFinite(point.latitude) ||
    !Number.isFinite(point.longitude) ||
    point.latitude < -90 ||
    point.latitude > 90 ||
    point.longitude < -180 ||
    point.longitude > 180
  )
    throw new Error("Coordenada inválida no arquivo de trilha.");
  return point.elevation != null && Number.isFinite(point.elevation)
    ? [point.longitude, point.latitude, point.elevation]
    : [point.longitude, point.latitude];
}

function description(
  name: string,
  detail: string | null | undefined,
  kind: string,
  segment?: number,
): Record<string, string | number | boolean | null> {
  return {
    name,
    description: detail ?? null,
    kind,
    ...(segment !== undefined ? { segment } : {}),
  };
}

function createLineOrPointFeature(
  points: { latitude: number; longitude: number; elevation?: number | null }[],
  properties: TrackGeoJsonFeature["properties"],
  id?: string,
): TrackGeoJsonFeature | null {
  if (points.length === 0) return null;
  const coords = points.map(position);
  const geometry: TrackGeoJsonFeature["geometry"] =
    coords.length === 1
      ? { type: "Point", coordinates: coords[0]! }
      : { type: "LineString", coordinates: coords };
  return {
    type: "Feature",
    ...(id ? { id } : {}),
    geometry,
    properties,
  };
}

function mapWaypoint(waypoint: Waypoint): TrackGeoJsonFeature {
  return {
    type: "Feature",
    id: waypoint.id,
    geometry: { type: "Point", coordinates: position(waypoint) },
    properties: {
      ...waypoint.properties,
      ...description(waypoint.name, waypoint.description, "waypoint"),
    },
  };
}

function mapTrack(track: Track): TrackGeoJsonFeature[] {
  const features: TrackGeoJsonFeature[] = [];
  track.segments.forEach((segment, i) => {
    const feature = createLineOrPointFeature(
      segment.points,
      {
        ...track.properties,
        ...description(track.name, track.description, "track", i + 1),
      },
      track.segments.length === 1 ? track.id : segment.id,
    );
    if (feature) features.push(feature);
  });
  return features;
}

function mapRoute(route: Route): TrackGeoJsonFeature | null {
  return createLineOrPointFeature(
    route.points,
    description(route.name, route.description, "route"),
  );
}

function mapPolygon(polygon: KmlPolygon): TrackGeoJsonFeature {
  return {
    type: "Feature",
    id: polygon.id,
    geometry: {
      type: "Polygon",
      coordinates: polygon.rings.map((ring) => ring.map(position)),
    },
    properties: {
      ...polygon.properties,
      ...description(polygon.name, polygon.description, "polygon"),
    },
  };
}

/** Does not mutate the source; timestamps remain in the original GPX file. */
export function tracksToGeoJSON(imported: GpxImport): TrackGeoJsonCollection {
  const features: TrackGeoJsonFeature[] = [];

  for (const waypoint of imported.waypoints) {
    features.push(mapWaypoint(waypoint));
  }

  for (const track of imported.tracks) {
    features.push(...mapTrack(track));
  }

  for (const route of imported.routes) {
    const feature = mapRoute(route);
    if (feature) features.push(feature);
  }

  for (const polygon of imported.polygons ?? []) {
    features.push(mapPolygon(polygon));
  }

  return { type: "FeatureCollection", features };
}
