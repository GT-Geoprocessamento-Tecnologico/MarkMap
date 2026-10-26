import type { Route } from "@markmap/contracts";
import type { MeasurePoint } from "./types.js";

export function haversineMeters(a: MeasurePoint, b: MeasurePoint): number {
  const R = 6371000;
  const r = (v: number) => (v * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLng = r(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
}

export function routeAsGeoJSON(route: Route | null): GeoJSON.FeatureCollection {
  if (!route || route.geometry.length < 2)
    return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: route.geometry },
      },
    ],
  };
}
