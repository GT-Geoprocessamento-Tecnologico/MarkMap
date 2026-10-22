/**
 * Bounded, OFFLINE preparation of station/line data from an unpacked GTFS Schedule feed.
 * The feed is supplied by an authorized publisher and accompanied by source metadata;
 * this does NOT compute timetables, live arrivals, fares, service calendars or geometry.
 */
import { readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { validateRegionalTransit, MAX_TRANSIT_LINES, MAX_TRANSIT_STATIONS } from '../packages/maps/src/content/region-content.mjs';

const MAX_FILE_BYTES = {
  'stops.txt': 5 * 1024 * 1024,
  'routes.txt': 1 * 1024 * 1024,
  'trips.txt': 8 * 1024 * 1024,
  'stop_times.txt': 24 * 1024 * 1024,
  'agency.txt': 1 * 1024 * 1024,
};
const MAX_ROWS = { 'stops.txt': 30_000, 'routes.txt': 3_000, 'trips.txt': 120_000, 'stop_times.txt': 250_000, 'agency.txt': 100 };
const MODES = { '0': 'tram', '1': 'metro', '2': 'train', '3': 'bus', '4': 'ferry' };
const safeId = (id) => typeof id === 'string' && id.length > 0 && id.length <= 128;
const validName = (s, max = 180) => typeof s === 'string' && s.trim().length > 0 && s.length <= max;

export function parseBoundedGtfsCsv(input, maxRows = 100_000) {
  if (typeof input !== 'string' || input.length > 24 * 1024 * 1024 || !Number.isSafeInteger(maxRows) || maxRows < 1) throw new Error('GTFS CSV fora do limite');
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows = [];
  let row = [], cell = '', quote = false, closedQuote = false, pos = 0;
  const saveCell = () => { row.push(cell); cell = ''; closedQuote = false; };
  const saveRow = () => {
    saveCell();
    if (row.length === 1 && row[0] === '') { row = []; return; }
    rows.push(row); row = [];
    if (rows.length > maxRows + 1) throw new Error('GTFS CSV contém linhas demais');
  };
  while (pos < text.length) {
    const c = text[pos++];
    if (c === '\0') throw new Error('GTFS CSV contém byte nulo');
    if (quote) {
      if (c === '"' && text[pos] === '"') { cell += '"'; pos++; }
      else if (c === '"') { quote = false; closedQuote = true; }
      else cell += c;
    } else if (c === '"') {
      if (cell.length || closedQuote) throw new Error('GTFS CSV com aspas fora de posição');
      quote = true;
    } else if (c === ',') saveCell();
    else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[pos] === '\n') pos++;
      saveRow();
    } else {
      if (closedQuote) throw new Error('GTFS CSV possui texto após aspas');
      cell += c;
    }
    if (cell.length > 10_000) throw new Error('GTFS CSV contém campo muito longo');
  }
  if (quote) throw new Error('GTFS CSV com aspas incompletas');
  if (row.length || cell.length) saveRow();
  if (!rows.length) throw new Error('GTFS CSV vazio');
  const [header, ...data] = rows;
  if (header.length > 100 || new Set(header).size !== header.length || header.some(col => !col.trim())) throw new Error('Cabeçalho GTFS inválido');
  return data.map(cells => {
    if (cells.length !== header.length) throw new Error('GTFS CSV com coluna ausente ou extra');
    return Object.fromEntries(header.map((key, index) => [key, cells[index]]));
  });
}

async function readGtfs(directory, file, required = true) {
  const path = join(directory, file);
  let size;
  try { size = (await stat(path)).size; }
  catch { if (!required) return []; throw new Error(`GTFS: arquivo obrigatório ausente: ${file}`); }
  if (size > MAX_FILE_BYTES[file] || size < 5) throw new Error(`GTFS: ${file} excede limite ou está vazio`);
  return parseBoundedGtfsCsv(await readFile(path, 'utf8'), MAX_ROWS[file]);
}

/** Files must already be extracted safely. No ZIP parsing or remote download. */
export async function buildRegionalTransitFromGtfs({ directory, regionId, bounds, attribution, license, version = 'gtfs-v1', generatedAt = new Date().toISOString() }) {
  if (!safeId(regionId) || !validName(attribution, 300) || !validName(license, 100) || !validName(version, 64) ||
      !Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)) throw new Error('GTFS: origem, licença ou região inválidas');
  const [stops, routes, trips, stopTimes, agencies] = await Promise.all([
    readGtfs(directory, 'stops.txt'), readGtfs(directory, 'routes.txt'), readGtfs(directory, 'trips.txt'),
    readGtfs(directory, 'stop_times.txt'), readGtfs(directory, 'agency.txt', false),
  ]);
  const agencyNames = new Map(agencies.filter(a => safeId(a.agency_id) && validName(a.agency_name)).map(a => [a.agency_id, a.agency_name]));
  const defaultAgency = agencies.length === 1 && validName(agencies[0].agency_name) ? agencies[0].agency_name : null;
  const stopMap = new Map();
  for (const stop of stops) {
    if (!safeId(stop.stop_id) || !validName(stop.stop_name)) continue;
    if (!stop.stop_lon?.trim() || !stop.stop_lat?.trim()) continue;
    const lon = Number(stop.stop_lon), lat = Number(stop.stop_lat);
    const locType = stop.location_type ?? '0';
    if (!['', '0', '1'].includes(locType) || !Number.isFinite(lon) || !Number.isFinite(lat) ||
        lon < bounds[0] || lon > bounds[2] || lat < bounds[1] || lat > bounds[3]) continue;
    if (stopMap.has(stop.stop_id)) throw new Error('GTFS: stop_id repetido');
    stopMap.set(stop.stop_id, { id: stop.stop_id, name: stop.stop_name, lon, lat,
      locType, parent: stop.parent_station, wheelchair: stop.wheelchair_boarding });
  }
  const routeMap = new Map();
  for (const route of routes) {
    if (!safeId(route.route_id) || !Object.prototype.hasOwnProperty.call(MODES, route.route_type)) continue;
    const name = route.route_short_name || route.route_long_name;
    if (!validName(name)) continue;
    if (routeMap.has(route.route_id)) throw new Error('GTFS: route_id repetido');
    const color = /^[0-9a-fA-F]{6}$/.test(route.route_color ?? '') ? `#${route.route_color}` : '#2586a3';
    const operator = agencyNames.get(route.agency_id) ?? defaultAgency;
    routeMap.set(route.route_id, { id: route.route_id, name, color, mode: MODES[route.route_type],
      ...(operator ? { operator } : {}) });
  }
  const tripToRoute = new Map();
  for (const trip of trips) {
    if (safeId(trip.trip_id) && routeMap.has(trip.route_id)) {
      if (tripToRoute.has(trip.trip_id)) throw new Error('GTFS: trip_id repetido');
      tripToRoute.set(trip.trip_id, trip.route_id);
    }
  }
  const routeStops = new Map();
  for (const stopTime of stopTimes) {
    const routeId = tripToRoute.get(stopTime.trip_id);
    if (!routeId) continue;
    const stop = stopMap.get(stopTime.stop_id);
    if (!stop) continue;
    const parent = stop.parent && stopMap.get(stop.parent);
    const id = parent?.locType === '1' ? parent.id : stop.id;
    let assigned = routeStops.get(routeId);
    if (!assigned) { assigned = new Set(); routeStops.set(routeId, assigned); }
    assigned.add(id);
    if (assigned.size > MAX_TRANSIT_STATIONS) throw new Error('GTFS: linha com paradas demais');
  }
  const stationToLines = new Map();
  const lines = [];
  for (const route of routeMap.values()) {
    const ids = routeStops.get(route.id);
    if (!ids?.size) continue;
    if (lines.length >= MAX_TRANSIT_LINES) throw new Error('GTFS: limite regional de linhas excedido');
    const stationIds = [...ids];
    lines.push({ ...route, stationIds });
    for (const id of stationIds) {
      const refs = stationToLines.get(id) ?? new Set();
      refs.add(route.id);
      if (refs.size > 50) throw new Error('GTFS: estação com linhas demais');
      stationToLines.set(id, refs);
    }
  }
  if (!lines.length) throw new Error('GTFS: nenhuma linha com paradas válidas na região');
  if (stationToLines.size > MAX_TRANSIT_STATIONS) throw new Error('GTFS: estações regionais demais');
  const stations = [...stationToLines.entries()].map(([id, refs]) => {
    const station = stopMap.get(id);
    const wheelchair = station.wheelchair === '1' ? 'yes' : station.wheelchair === '2' ? 'no' : undefined;
    return { id, name: station.name, lon: station.lon, lat: station.lat,
      lines: [...refs], ...(wheelchair ? { wheelchair } : {}) };
  });
  const data = { regionId, version, generatedAt, attribution, license, stations, lines };
  return validateRegionalTransit(data, regionId, bounds);
}
