export interface TrackPoint {
  latitude: number;
  longitude: number;
  elevation?: number | null;
  timestamp?: Date | null;
}

export type KmlScalar = string | number | boolean | null;
export type KmlProperties = Record<string, KmlScalar>;

export interface Segment {
  id: string;
  points: TrackPoint[];
}

export interface Track {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  properties?: KmlProperties;
  segments: Segment[];
}

export interface Waypoint {
  id: string;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  elevation?: number | null;
  properties?: KmlProperties;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  elevation?: number | null;
}

export interface Route {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  points: RoutePoint[];
}

export interface KmlPolygon {
  id: string;
  name: string;
  description?: string | null;
  rings: TrackPoint[][];
  properties?: KmlProperties;
}

export interface GpxImport {
  tracks: Track[];
  waypoints: Waypoint[];
  routes: Route[];
  polygons?: KmlPolygon[];
}
