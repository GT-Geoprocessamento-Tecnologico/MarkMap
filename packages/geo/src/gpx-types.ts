export interface TrackPoint {
  latitude: number;
  longitude: number;
  elevation?: number | null;
  timestamp?: Date | null;
}

export interface Segment {
  id: string;
  points: TrackPoint[];
}

export interface Track {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  segments: Segment[];
}

export interface Waypoint {
  id: string;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  elevation?: number | null;
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

export interface GpxImport {
  tracks: Track[];
  waypoints: Waypoint[];
  routes: Route[];
}
