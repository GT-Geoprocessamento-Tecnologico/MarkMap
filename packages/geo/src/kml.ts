import type { GpxImport, Track, TrackPoint, Waypoint } from "./gpx-types.js";

export function parseKml(xml: string): GpxImport {
  if (!xml.trim().startsWith("<")) throw new Error("Invalid KML: not XML");

  const tracks: Track[] = [];
  const waypoints: Waypoint[] = [];

  const pmMatches = xml.matchAll(/<Placemark>([\s\S]*?)<\/Placemark>/g);
  let pmIndex = 0;
  for (const pmMatch of pmMatches) {
    const body = pmMatch[1]!;
    const name = extractTag(body, "name") ?? `Place ${pmIndex + 1}`;
    const description = extractTag(body, "description");

    const pointMatch = body.match(/<Point>[\s\S]*?<coordinates>([^<]*)<\/coordinates>[\s\S]*?<\/Point>/);
    if (pointMatch) {
      const coords = pointMatch[1]!.trim();
      const [lonStr, latStr] = coords.split(",");
      const lon = parseFloat(lonStr!);
      const lat = parseFloat(latStr!);
      if (!Number.isNaN(lon) && !Number.isNaN(lat) &&
          lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        waypoints.push({
          id: crypto.randomUUID(),
          name,
          description,
          latitude: lat,
          longitude: lon,
          elevation: null,
        });
      }
    }

    const lineMatch = body.match(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>[\s\S]*?<\/LineString>/);
    if (lineMatch) {
      const coordsText = lineMatch[1]!.trim();
      const points: TrackPoint[] = [];
      for (const pair of coordsText.split(/\s+/)) {
        const [lonStr, latStr] = pair.split(",");
        const lon = parseFloat(lonStr!);
        const lat = parseFloat(latStr!);
        if (Number.isNaN(lon) || Number.isNaN(lat)) continue;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
        points.push({ latitude: lat, longitude: lon, elevation: null, timestamp: null });
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

    pmIndex++;
  }

  return { tracks, waypoints, routes: [] };
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  if (!match) return null;
  const text = match[1]!.trim();
  return text.length > 0 ? text : null;
}
