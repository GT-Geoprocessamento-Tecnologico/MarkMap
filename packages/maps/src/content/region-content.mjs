/**
 * Bounded, offline-only regional knowledge packages.
 * These datasets must be supplied by an authorized publisher with attribution.
 * HTML is not trusted: consumers render summaries with normal text nodes.
 */
export const MAX_WIKIPEDIA_BYTES = 2 * 1024 * 1024;
export const MAX_TRANSIT_BYTES = 2 * 1024 * 1024;
export const MAX_WIKIPEDIA_ARTICLES = 1000;
export const MAX_TRANSIT_STATIONS = 12000;
export const MAX_TRANSIT_LINES = 1000;

export class RegionContentError extends Error {
  constructor(message, code = 'INVALID_CONTENT') {
    super(message);
    this.name = 'RegionContentError';
    this.code = code;
  }
}

function invalid(message) { throw new RegionContentError(message); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function string(value, max, min = 1) { return typeof value === 'string' && value.trim().length >= min && value.length <= max; }
function safeHttps(value) {
  if (typeof value !== 'string' || value.length > 1024) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
function baseCheck(data, regionId) {
  if (!object(data) || data.regionId !== regionId || !string(data.version, 64) ||
      !string(data.attribution, 300) || !string(data.license, 100)) invalid('Metadados e licença regional inválidos');
  if (typeof data.generatedAt !== 'string' || !Number.isFinite(Date.parse(data.generatedAt))) invalid('Data de geração regional inválida');
}
function limitObjectSize(obj, maxBytes) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj)).byteLength;
  if (bytes > maxBytes) throw new RegionContentError('Dados regionais excedem o limite de tamanho', 'CONTENT_TOO_LARGE');
}

export function validateRegionalWikipedia(data, regionId) {
  baseCheck(data, regionId);
  if (!Array.isArray(data.articles) || data.articles.length > MAX_WIKIPEDIA_ARTICLES) invalid('Quantidade de artigos inválida');
  const ids = new Set();
  for (const a of data.articles) {
    if (!object(a) || !string(a.id, 128) || ids.has(a.id) ||
        !string(a.title, 180) || !string(a.summary, 3000, 0) ||
        !string(a.language, 10, 2) || !string(a.attribution, 300) || !string(a.license, 100) ||
        (a.url !== undefined && !safeHttps(a.url)) ||
        (a.wikidataId !== undefined && !string(a.wikidataId, 128)) ||
        (a.osmId !== undefined && !string(a.osmId, 128))) invalid('Artigo regional inválido ou duplicado');
    ids.add(a.id);
  }
  limitObjectSize(data, MAX_WIKIPEDIA_BYTES);
  return data;
}

export function validateRegionalTransit(data, regionId, bounds) {
  baseCheck(data, regionId);
  if (!Array.isArray(bounds) || bounds.length !== 4 || bounds.some(v => !Number.isFinite(v))) invalid('Bounds regionais inválidos');
  if (!Array.isArray(data.stations) || data.stations.length > MAX_TRANSIT_STATIONS ||
      !Array.isArray(data.lines) || data.lines.length > MAX_TRANSIT_LINES) invalid('Quantidade de estações/linhas inválida');
  const stations = new Map();
  const lines = new Map();
  for (const s of data.stations) {
    if (!object(s) || !string(s.id, 128) || !string(s.name, 180) || stations.has(s.id) ||
        !Number.isFinite(s.lon) || !Number.isFinite(s.lat) ||
        s.lon < bounds[0] || s.lon > bounds[2] || s.lat < bounds[1] || s.lat > bounds[3] ||
        !Array.isArray(s.lines) || s.lines.length > 50 || !s.lines.every(id => string(id, 128)) ||
        (s.operator !== undefined && !string(s.operator, 180)) ||
        (s.wheelchair !== undefined && !['yes','no','limited'].includes(s.wheelchair))) invalid('Estação regional inválida');
    stations.set(s.id, s);
  }
  for (const line of data.lines) {
    if (!object(line) || !string(line.id, 128) || !string(line.name, 180) || lines.has(line.id) ||
        !/^#[0-9a-fA-F]{6}$/.test(line.color) || !['metro','bus','tram','train','ferry'].includes(line.mode) ||
        (line.operator !== undefined && !string(line.operator, 180)) ||
        !Array.isArray(line.stationIds) || line.stationIds.length > MAX_TRANSIT_STATIONS ||
        line.stationIds.some(id => !stations.has(id))) invalid('Linha de transporte inválida');
    lines.set(line.id, line);
  }
  for (const station of stations.values()) {
    if (station.lines.some(id => !lines.has(id))) invalid('Estação referencia linha desconhecida');
  }
  limitObjectSize(data, MAX_TRANSIT_BYTES);
  return data;
}
