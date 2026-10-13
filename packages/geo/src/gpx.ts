import type { GpxImport, Segment, Track, TrackPoint, Waypoint, Route, RoutePoint } from "./gpx-types.js";

export function parseGpx(xml: string): GpxImport {
  if (!xml.trim().startsWith("<")) throw new Error("Invalid GPX: not XML");

  const tracks: Track[] = [];
  const waypoints: Waypoint[] = [];
  const routes: Route[] = [];

  const trkMatches = xml.matchAll(/<trk>([\s\S]*?)<\/trk>/g);
  let trkIndex = 0;
  for (const trkMatch of trkMatches) {
    const trkBody = trkMatch[1]!;
    const name = extractTag(trkBody, "name") ?? `Track ${trkIndex + 1}`;
    const description = extractTag(trkBody, "desc");

    const segments: Segment[] = [];
    const segMatches = trkBody.matchAll(/<trkseg>([\s\S]*?)<\/trkseg>/g);
    for (const segMatch of segMatches) {
      const segBody = segMatch[1]!;
      const points: TrackPoint[] = [];
      const ptMatches = segBody.matchAll(/<trkpt\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/trkpt\s*>)/g);
      for (const ptMatch of ptMatches) {
        const attrs = ptMatch[1] ?? '';
        const lat = Number(attrs.match(/(?:^|\s)lat="([^"]+)"/)?.[1]);
        const lon = Number(attrs.match(/(?:^|\s)lon="([^"]+)"/)?.[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

        const inner = ptMatch[2] ?? "";
        const eleText = extractTag(inner, "ele");
        const timeText = extractTag(inner, "time");

        points.push({
          latitude: lat,
          longitude: lon,
          elevation: eleText ? parseFloat(eleText) : null,
          timestamp: timeText ? new Date(timeText) : null,
        });
      }
      if (points.length > 0) {
        segments.push({ id: crypto.randomUUID(), points });
      }
    }

    if (segments.length > 0) {
      tracks.push({ id: crypto.randomUUID(), name, description, segments });
    }
    trkIndex++;
  }

  const wptMatches = xml.matchAll(/<wpt\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/wpt\s*>)/g);
  let wptIndex = 0;
  for (const wptMatch of wptMatches) {
    const attrs = wptMatch[1] ?? '';
    const lat = Number(attrs.match(/(?:^|\s)lat="([^"]+)"/)?.[1]);
    const lon = Number(attrs.match(/(?:^|\s)lon="([^"]+)"/)?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;

    const inner = wptMatch[2] ?? "";
    const eleText = extractTag(inner, "ele");
    waypoints.push({
      id: crypto.randomUUID(),
      name: extractTag(inner, "name") ?? `Waypoint ${wptIndex + 1}`,
      description: extractTag(inner, "desc"),
      latitude: lat,
      longitude: lon,
      elevation: eleText ? parseFloat(eleText) : null,
    });
    wptIndex++;
  }

  const rteMatches = xml.matchAll(/<rte>([\s\S]*?)<\/rte>/g);
  let rteIndex = 0;
  for (const rteMatch of rteMatches) {
    const rteBody = rteMatch[1]!;
    const name = extractTag(rteBody, "name") ?? `Route ${rteIndex + 1}`;
    const description = extractTag(rteBody, "desc");

    const points: RoutePoint[] = [];
    const ptMatches = rteBody.matchAll(/<rtept\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/rtept\s*>)/g);
    for (const ptMatch of ptMatches) {
      const attrs = ptMatch[1] ?? '';
      const latText = attrs.match(/(?:^|\s)lat="([^"]+)"/)?.[1];
      const lonText = attrs.match(/(?:^|\s)lon="([^"]+)"/)?.[1];
      if (!latText || !lonText) continue;
      const lat = Number(latText);
      const lon = Number(lonText);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
      const elevationText = extractTag(ptMatch[2] ?? '', 'ele');
      const elevation = elevationText === null ? null : Number(elevationText);
      points.push({ latitude: lat, longitude: lon,
        elevation: elevation !== null && Number.isFinite(elevation) ? elevation : null });
    }

    if (points.length > 0) {
      routes.push({ id: crypto.randomUUID(), name, description, points });
    }
    rteIndex++;
  }

  return { tracks, waypoints, routes };
}

function extractTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  if (!match) return null;
  const text = match[1]!.trim();
  return text.length > 0 ? text : null;
}
