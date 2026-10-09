export const MAX_CONTOUR_BYTES: number;
export interface RegionalContours {
  interval: number;
  majorInterval: number;
  contours: Array<{ elevation: number; geometry: Array<[number, number]> }>;
}
export function validateRegionalContours(raw: unknown, bounds: readonly [number, number, number, number]): RegionalContours;
export function contoursToGeoJSON(contours: RegionalContours): {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
    properties: { elevation: number; major: boolean };
  }>;
};
