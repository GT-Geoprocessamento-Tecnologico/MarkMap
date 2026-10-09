/** Compact, south-to-north SRTM-derived regional DEM, entirely local after install.
 * Deliberately refuses unknown/void heights instead of converting them to 0m.
 */
export const MAX_REGIONAL_DEM_BYTES = 2 * 1024 * 1024;
export const MAX_REGIONAL_DEM_CELLS = 256 * 256;
export const REGIONAL_DEM_NODATA = -32768;

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const validBounds = (bounds) => Array.isArray(bounds) && bounds.length === 4 && bounds.every(finite) &&
  bounds[0] >= -180 && bounds[2] <= 180 && bounds[1] >= -90 && bounds[3] <= 90 &&
  bounds[0] < bounds[2] && bounds[1] < bounds[3];

export function validateRegionalDem(raw, regionId, expectedBounds) {
  const fail = (message) => { throw new Error(`DEM regional inválido: ${message}`); };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.schemaVersion !== 1 ||
      raw.regionId !== regionId || typeof regionId !== 'string') fail('identidade/versão não correspondem');
  const m = raw.metadata;
  if (!m || typeof m !== 'object' || !validBounds(m.bounds) ||
      (expectedBounds && (!validBounds(expectedBounds) || !m.bounds.every((v, i) => Math.abs(v - expectedBounds[i]) < 1e-7)))) fail('limites não correspondem ao mapa');
  if (!['srtm', 'copernicus-dem', 'alos-dem'].includes(m.source) ||
      !['EGM96', 'WGS84', 'EGM2008'].includes(m.verticalDatum) ||
      m.dataType !== 'int16' || m.noDataValue !== REGIONAL_DEM_NODATA ||
      !finite(m.resolutionMeters) || m.resolutionMeters <= 0 || m.resolutionMeters > 50_000 ||
      typeof m.license !== 'string' || !m.license.trim() || m.license.length > 300 ||
      typeof m.attribution !== 'string' || !m.attribution.trim() || m.attribution.length > 400 ||
      typeof m.sourceUrl !== 'string' || !/^https:\/\/[^/\s]+/.test(m.sourceUrl) || m.sourceUrl.length > 500 ||
      !Number.isInteger(m.width) || m.width < 2 || m.width > 256 ||
      !Number.isInteger(m.height) || m.height < 2 || m.height > 256) fail('metadados/licença ausentes ou inválidos');
  const length = m.width * m.height;
  if (length > MAX_REGIONAL_DEM_CELLS || !Array.isArray(raw.values) || raw.values.length !== length) fail('amostras incompatíveis');
  let available = 0;
  for (const value of raw.values) {
    if (!Number.isInteger(value) || (value !== REGIONAL_DEM_NODATA && (value < -12_000 || value > 12_000))) fail('amostra fora do domínio');
    if (value !== REGIONAL_DEM_NODATA) available++;
  }
  if (!available) fail('nenhuma altitude real disponível');
  return raw;
}

export function sampleRegionalDem(grid, lon, lat) {
  if (!finite(lon) || !finite(lat)) return null;
  const { metadata: m, values } = grid;
  const [left, bottom, right, top] = m.bounds;
  if (lon < left || lon > right || lat < bottom || lat > top) return null;
  const col = (lon - left) / (right - left) * (m.width - 1);
  const row = (lat - bottom) / (top - bottom) * (m.height - 1);
  const x0 = Math.floor(col), y0 = Math.floor(row);
  const x1 = Math.min(m.width - 1, x0 + 1), y1 = Math.min(m.height - 1, y0 + 1);
  const a = values[y0 * m.width + x0], b = values[y0 * m.width + x1];
  const c = values[y1 * m.width + x0], d = values[y1 * m.width + x1];
  if ([a, b, c, d].some(v => v === REGIONAL_DEM_NODATA || !finite(v))) return null;
  const dx = col - x0, dy = row - y0;
  return (a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy;
}

function metersBetween(a, b) {
  const k = Math.PI / 180;
  const dLat = (b[1] - a[1]) * k, dLon = (b[0] - a[0]) * k;
  const q = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * k) * Math.cos(b[1] * k) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(q)));
}

/** Sample a routed polyline by travelled distance; gaps remain null, never invented. */
export function computeRegionalElevationProfile(geometry, grid, maxSamples = 96) {
  if (!Array.isArray(geometry) || geometry.length < 2 || geometry.length > 40_000 ||
      !Number.isInteger(maxSamples) || maxSamples < 2 || maxSamples > 256) return null;
  const distances = [0];
  for (let i = 1; i < geometry.length; i++) {
    const p = geometry[i - 1], q = geometry[i];
    if (!Array.isArray(p) || !Array.isArray(q) || p.length !== 2 || q.length !== 2 ||
        !p.every(finite) || !q.every(finite)) return null;
    distances.push(distances[i - 1] + metersBetween(p, q));
  }
  const totalMeters = distances[distances.length - 1];
  if (!finite(totalMeters) || totalMeters <= 0) return null;
  const samples = [];
  let segment = 1, gainMeters = 0, lossMeters = 0, previous = null;
  let minMeters = Infinity, maxMeters = -Infinity, missing = 0;
  for (let i = 0; i < maxSamples; i++) {
    const d = (i / (maxSamples - 1)) * totalMeters;
    while (segment < distances.length - 1 && distances[segment] < d) segment++;
    const start = geometry[segment - 1], end = geometry[segment];
    const denom = distances[segment] - distances[segment - 1];
    const t = denom > 0 ? (d - distances[segment - 1]) / denom : 0;
    const lon = start[0] + t * (end[0] - start[0]);
    const lat = start[1] + t * (end[1] - start[1]);
    const elevation = sampleRegionalDem(grid, lon, lat);
    if (elevation === null) { missing++; previous = null; }
    else {
      minMeters = Math.min(minMeters, elevation); maxMeters = Math.max(maxMeters, elevation);
      if (previous !== null) {
        const change = elevation - previous;
        if (change > 0) gainMeters += change; else lossMeters -= change;
      }
      previous = elevation;
    }
    samples.push({ distanceMeters: d, elevationMeters: elevation });
  }
  return {
    samples, totalMeters, gainMeters, lossMeters,
    minElevationMeters: minMeters === Infinity ? null : minMeters,
    maxElevationMeters: maxMeters === -Infinity ? null : maxMeters,
    coveragePercent: Math.round(100 * (maxSamples - missing) / maxSamples),
    missingCount: missing,
  };
}
