import type { Layer } from "@geonexo/contracts";
import { listFeatures } from "../../lib/api-client";

export interface ProjectMapFeature extends GeoJSON.Feature {
  layerId: string;
}

export async function loadProjectFeatures(
  layers: readonly Layer[],
  signal: AbortSignal,
  cap = 10_000,
) {
  const features: ProjectMapFeature[] = [];
  for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
    const layer = layers[layerIndex]!;
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      signal.throwIfAborted();
      const page = await listFeatures(layer.id, {
        limit: Math.min(1000, cap - features.length),
        cursor,
        signal,
      });
      signal.throwIfAborted();
      for (const feature of page.items) {
        if (features.length >= cap) break;
        features.push({
          type: "Feature",
          id: feature.id,
          geometry: feature.geometry as GeoJSON.Geometry,
          properties: feature.properties,
          layerId: layer.id,
        });
      }
      cursor = page.nextCursor ?? undefined;
      if (features.length >= cap)
        return {
          features,
          truncated:
            Boolean(cursor) ||
            layerIndex < layers.length - 1 ||
            page.items.length > cap,
        };
      if (cursor) {
        if (seen.has(cursor))
          throw new Error(
            "A API repetiu o cursor das feições. Tente atualizar o mapa.",
          );
        seen.add(cursor);
      }
    } while (cursor);
  }
  return { features, truncated: false };
}

export function featureBounds(
  features: readonly GeoJSON.Feature[],
): [[number, number], [number, number]] | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const stack: unknown[] = features.map(
    (feature) =>
      (feature.geometry as { coordinates?: unknown } | null)?.coordinates,
  );
  while (stack.length) {
    const item = stack.pop();
    if (!Array.isArray(item)) continue;
    if (typeof item[0] === "number" && typeof item[1] === "number") {
      if (!Number.isFinite(item[0]) || !Number.isFinite(item[1])) continue;
      minX = Math.min(minX, item[0]);
      minY = Math.min(minY, item[1]);
      maxX = Math.max(maxX, item[0]);
      maxY = Math.max(maxY, item[1]);
    } else for (const child of item) stack.push(child);
  }
  return minX === Infinity
    ? null
    : [
        [minX, minY],
        [maxX, maxY],
      ];
}

export function matchesFeature(
  feature: GeoJSON.Feature,
  text: string,
  type: string,
): boolean {
  const geometryType = feature.geometry?.type ?? "";
  return (
    (type === "todos" ||
      geometryType === type ||
      (type === "Multi" && geometryType.startsWith("Multi"))) &&
    (!text ||
      JSON.stringify(feature.properties ?? {})
        .toLowerCase()
        .includes(text.toLowerCase()))
  );
}
