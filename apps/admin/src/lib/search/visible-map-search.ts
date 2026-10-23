// Desenvolvido por MtsFerreira. Search only names already decoded from local map tiles.
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  buildLocalMapSearchRecords,
  type LocalSearchRecord,
} from "./local-map-search";

export const MAX_VISIBLE_MAP_RECORDS = 2_000;
const MAX_SCANNED_FEATURES = 20_000;
const LAYERS = ["places", "pois", "roads", "water"] as const;
const categories = {
  places: "lugar",
  pois: "ponto de interesse",
  roads: "via",
  water: "rio ou lago",
};
export type SearchableMap = Pick<
  MapLibreMap,
  "getStyle" | "querySourceFeatures" | "getBounds"
>;

function position(value: unknown, depth = 0): [number, number] | null {
  if (!Array.isArray(value) || depth > 7) return null;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    const [lon, lat] = value;
    return Number.isFinite(lon) &&
      Number.isFinite(lat) &&
      Math.abs(lon) <= 180 &&
      Math.abs(lat) <= 90
      ? [lon, lat]
      : null;
  }
  // A vertex on the geometry, rather than a fabricated address or polygon centroid.
  return position(value[Math.floor(value.length / 2)], depth + 1);
}

/** Source queries include cached tile edges; restrict result positions to the displayed area. */
export function collectVisibleMapSearch(
  map: SearchableMap,
  regionId: string,
  regionLabel = "",
): LocalSearchRecord[] {
  if (!regionId) return [];
  const style = map.getStyle();
  const bounds = map.getBounds();
  const sourceIds = Object.entries(style.sources ?? {})
    .filter(
      ([, source]) =>
        source.type === "vector" &&
        typeof source.url === "string" &&
        (source.url.startsWith("pmtiles://geonexo-offline:") ||
          source.url.startsWith("pmtiles://markmap-offline:")),
    )
    .slice(0, 4)
    .map(([id]) => id);
  const records: LocalSearchRecord[] = [];
  const seen = new Set<string>();
  let scanned = 0;
  for (const sourceId of sourceIds) {
    for (const layer of LAYERS) {
      const features = map.querySourceFeatures(sourceId, {
        sourceLayer: layer,
        filter: [
          "any",
          ["has", "name"],
          ["has", "name:pt"],
          ["has", "addr:postcode"],
          ["has", "postcode"],
          ["has", "postal_code"],
          ["has", "postalcode"],
          ["has", "cep"],
        ],
      });
      for (const feature of features) {
        if (
          ++scanned > MAX_SCANNED_FEATURES ||
          records.length >= MAX_VISIBLE_MAP_RECORDS
        )
          return records;
        const properties = feature.properties ?? {};
        const name = [properties["name:pt"], properties.name].find(
          (value) =>
            typeof value === "string" &&
            value.trim().length > 0 &&
            value.length <= 220,
        );
        if (typeof name !== "string") continue;
        const coordinates = position(
          (feature.geometry as { coordinates?: unknown } | null)?.coordinates,
        );
        if (!coordinates || !bounds.contains(coordinates)) continue;
        const record = buildLocalMapSearchRecords([
          {
            geometry: { type: "Point", coordinates },
            properties: { ...properties, name, city: regionLabel },
          },
        ])[0];
        if (!record) continue;
        const key = `${sourceId}:${layer}:${record.normalized}`;
        if (seen.has(key)) continue;
        seen.add(key);
        records.push({
          ...record,
          id: `map:${regionId}:${key}`,
          category: categories[layer],
          type: layer,
        });
      }
    }
  }
  return records;
}
