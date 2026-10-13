/** Precomputed contour lines stored locally. No DEM is fabricated. */
export const MAX_CONTOUR_BYTES = 4 * 1024 * 1024;
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
export function validateRegionalContours(raw, bounds) {
  const fail = () => { throw new Error('Curvas de nível regionais inválidas'); };
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.contours) || raw.contours.length > 5_000 ||
      !finite(raw.interval) || raw.interval <= 0 || !finite(raw.majorInterval) || raw.majorInterval < raw.interval) fail();
  let vertices = 0;
  for (const entry of raw.contours) {
    if (!entry || !finite(entry.elevation) || Math.abs(entry.elevation) > 12_000 ||
      !Array.isArray(entry.geometry) || entry.geometry.length < 2 || entry.geometry.length > 10_000) fail();
    vertices += entry.geometry.length;
    if (vertices > 50_000) fail();
    for (const point of entry.geometry) {
      if (!Array.isArray(point) || point.length !== 2 || !point.every(finite) ||
        point[0] < bounds[0] || point[0] > bounds[2] ||
        point[1] < bounds[1] || point[1] > bounds[3]) fail();
    }
  }
  return raw;
}
export function contoursToGeoJSON(contours) {
  return { type: 'FeatureCollection', features: contours.contours.map((entry) => ({
    type: 'Feature', geometry: { type: 'LineString', coordinates: entry.geometry },
    properties: { elevation: entry.elevation, major: entry.elevation % contours.majorInterval === 0 },
  })) };
}
