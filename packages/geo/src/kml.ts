import type { GpxImport, KmlPolygon, Track, TrackPoint, Waypoint } from "./gpx-types.js";

export function parseKml(xml: string): GpxImport {
  if (!xml.trim().startsWith("<")) throw new Error("Invalid KML: not XML");

  const tracks: Track[] = [];
  const waypoints: Waypoint[] = [];
  const polygons: KmlPolygon[] = [];

  const pmMatches = xml.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g);
  let pmIndex = 0;
  for (const pmMatch of pmMatches) {
    const body = pmMatch[1]!;
    const name = extractTag(body, "name") ?? `Place ${pmIndex + 1}`;
    const description = extractTag(body, "description");

    const pointMatch = body.match(/<Point>[\s\S]*?<coordinates>([^<]*)<\/coordinates>[\s\S]*?<\/Point>/);
    if (pointMatch) {
      const coords = pointMatch[1]!.trim();
      const [lonStr, latStr, eleStr] = coords.split(",");
      const lon = parseFloat(lonStr!);
      const lat = parseFloat(latStr!);
      const elevation = eleStr === undefined ? null : Number(eleStr);
      if (!Number.isNaN(lon) && !Number.isNaN(lat) &&
          lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        waypoints.push({
          id: crypto.randomUUID(),
          name,
          description,
          latitude: lat,
          longitude: lon,
          elevation: elevation !== null && Number.isFinite(elevation) ? elevation : null,
        });
      }
    }

    const lineMatch = body.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/);
    if (lineMatch) {
      const coordsText = lineMatch[1]!.trim();
      const points: TrackPoint[] = [];
      for (const pair of coordsText.split(/\s+/)) {
        const [lonStr, latStr, eleStr] = pair.split(",");
        const lon = parseFloat(lonStr!);
        const lat = parseFloat(latStr!);
        const elevation = eleStr === undefined ? null : Number(eleStr);
        if (Number.isNaN(lon) || Number.isNaN(lat)) continue;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
        points.push({ latitude: lat, longitude: lon,
          elevation: elevation !== null && Number.isFinite(elevation) ? elevation : null,
          timestamp: null });
      }

      if (points.length > 0) {
        tracks.push({
          id: crypto.randomUUID(),
          name,
          description,
          segments: [{ id: crypto.randomUUID(), points }],
        });
      }
    }

    for (const polygonMatch of body.matchAll(/<Polygon\b[^>]*>([\s\S]*?)<\/Polygon>/g)) {
      const polygonBody = polygonMatch[1] ?? '';
      const outer = polygonBody.match(/<outerBoundaryIs\b[^>]*>[\s\S]*?<LinearRing\b[^>]*>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
      if (!outer) continue;
      const exterior = parseRing(outer[1]!);
      if (!exterior) continue;
      const rings: TrackPoint[][] = [exterior];
      for (const inner of polygonBody.matchAll(/<innerBoundaryIs\b[^>]*>[\s\S]*?<LinearRing\b[^>]*>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/innerBoundaryIs>/g)) {
        const ring = parseRing(inner[1]!);
        if (ring) rings.push(ring);
      }
      polygons.push({ id: crypto.randomUUID(), name, description, rings });
    }
    pmIndex++;
  }

  return { tracks, waypoints, routes: [], polygons };
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  if (!match) return null;
  const text = match[1]!.trim();
  return text.length > 0 ? text : null;
}

function parseRing(coordinates: string): TrackPoint[] | null {
  const points: TrackPoint[] = [];
  for (const part of coordinates.trim().split(/\s+/)) {
    const [lonText, latText, elevationText] = part.split(',');
    const longitude = Number(lonText), latitude = Number(latText);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90)
      return null;
    const rawEle = elevationText === undefined ? null : Number(elevationText);
    points.push({longitude, latitude, elevation: rawEle !== null && Number.isFinite(rawEle) ? rawEle : null });
  }
  if (points.length < 3) return null;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (first.longitude !== last.longitude || first.latitude !== last.latitude) points.push({...first});
  return points.length >= 4 ? points : null;
}
