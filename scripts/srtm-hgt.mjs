/** Offline SRTM .hgt raster to bounded regional-dem v1.
 * HGT rows are north-to-south, signed 16-bit BIG-ENDIAN; output rows are south-to-north.
 * Only user-provided, explicitly licensed DEM tiles are processed.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { REGIONAL_DEM_NODATA, validateRegionalDem } from '../packages/maps/src/elevation/regional-dem.mjs';

const HGT_RE = /^([NS])(\d{2})([EW])(\d{3})\.hgt$/i;
const TILE_SIZES = new Map([[1201, 1201 * 1201 * 2], [3601, 3601 * 3601 * 2]]);
const MAX_TILES = 4;

function tileKey(filename) {
  const m = HGT_RE.exec(filename);
  if (!m) return null;
  const lat = Number(m[2]) * (m[1].toUpperCase() === 'S' ? -1 : 1);
  const lon = Number(m[4]) * (m[3].toUpperCase() === 'W' ? -1 : 1);
  if (lat < -90 || lat >= 90 || lon < -180 || lon >= 180) return null;
  return { lon, lat };
}

function altitude(tile, lon, lat) {
  const col = (lon - tile.lon) * (tile.side - 1);
  const row = (tile.lat + 1 - lat) * (tile.side - 1);
  if (col < 0 || row < 0 || col > tile.side - 1 || row > tile.side - 1) return null;
  const x0 = Math.floor(col), y0 = Math.floor(row);
  const x1 = Math.min(tile.side - 1, x0 + 1), y1 = Math.min(tile.side - 1, y0 + 1);
  const pixel = (x, y) => tile.data.readInt16BE(2 * (y * tile.side + x));
  const a = pixel(x0, y0), b = pixel(x1, y0), c = pixel(x0, y1), d = pixel(x1, y1);
  if ([a, b, c, d].includes(REGIONAL_DEM_NODATA)) return null;
  const dx = col - x0, dy = row - y0;
  return Math.round((a * (1 - dx) + b * dx) * (1 - dy) + (c * (1 - dx) + d * dx) * dy);
}

/** Throws for malformed/insufficient source data. Never fills holes with sea-level zero. */
export async function buildRegionalDemFromHgt({ directory, regionId, bounds, attribution, license, sourceUrl, width = 192, height = 192 }) {
  if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite) ||
      !(bounds[0] < bounds[2] && bounds[1] < bounds[3]) ||
      !Number.isInteger(width) || width < 2 || width > 256 ||
      !Number.isInteger(height) || height < 2 || height > 256) throw new Error('SRTM: limites ou tamanho da grade inválidos');
  if (!attribution || !license || !sourceUrl) throw new Error('SRTM: atribuição, licença e URL de origem são obrigatórias');
  const filenames = (await readdir(directory)).filter(name => HGT_RE.test(name)).sort();
  if (!filenames.length || filenames.length > MAX_TILES) throw new Error('SRTM: informe de 1 a 4 arquivos .hgt');
  const tiles = [];
  const keys = new Set();
  for (const name of filenames) {
    const key = tileKey(name);
    if (!key || keys.has(`${key.lon}:${key.lat}`)) throw new Error('SRTM: quadrícula inválida ou duplicada');
    keys.add(`${key.lon}:${key.lat}`);
    const data = await readFile(join(directory, name));
    const side = [...TILE_SIZES].find(([, bytes]) => bytes === data.byteLength)?.[0];
    if (!side) throw new Error(`SRTM: dimensões inválidas em ${name}; esperado 1201/3601 amostras`);
    tiles.push({ ...key, side, data });
  }
  const values = [];
  let actual = 0;
  for (let y = 0; y < height; y++) {
    const lat = bounds[1] + y / (height - 1) * (bounds[3] - bounds[1]);
    for (let x = 0; x < width; x++) {
      const lon = bounds[0] + x / (width - 1) * (bounds[2] - bounds[0]);
      const tile = tiles.find(t => lon >= t.lon && lon <= t.lon + 1 && lat >= t.lat && lat <= t.lat + 1);
      const value = tile ? altitude(tile, lon, lat) : null;
      if (value !== null) actual++;
      values.push(value === null ? REGIONAL_DEM_NODATA : value);
    }
  }
  if (!actual) throw new Error('SRTM: nenhuma elevação disponível na região');
  const midLat = (bounds[1] + bounds[3]) / 2 * Math.PI / 180;
  const xMeters = (bounds[2] - bounds[0]) * 111_320 * Math.cos(midLat) / (width - 1);
  const yMeters = (bounds[3] - bounds[1]) * 111_320 / (height - 1);
  const grid = {
    schemaVersion: 1, regionId,
    metadata: {
      source: 'srtm', verticalDatum: 'EGM96', attribution, license, sourceUrl,
      resolutionMeters: Math.max(xMeters, yMeters), noDataValue: REGIONAL_DEM_NODATA,
      dataType: 'int16', width, height, bounds,
    },
    values,
  };
  return validateRegionalDem(grid, regionId, bounds);
}
