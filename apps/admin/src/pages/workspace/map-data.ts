import type { Layer } from "@markmap/contracts";
import { listLocalFeatures } from "../../lib/hooks/features";

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
    signal.throwIfAborted();
    const localFeatures = await listLocalFeatures(layer.id);
    signal.throwIfAborted();
    for (const feature of localFeatures) {
      if (features.length >= cap) break;
      features.push({
        type: "Feature",
        id: feature.id,
        geometry: feature.geometry as GeoJSON.Geometry,
        properties: feature.properties,
        layerId: layer.id,
      });
    }
    if (features.length >= cap)
      return {
        features,
        truncated:
          localFeatures.length > cap ||
          layerIndex < layers.length - 1,
      };
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
  filterTextLower?: string,
): boolean {
  const geometryType = feature.geometry?.type ?? "";
  if (
    type !== "todos" &&
    geometryType !== type &&
    !(type === "Multi" && geometryType.startsWith("Multi"))
  ) {
    return false;
  }

  if (!text) return true;

  const searchLower = filterTextLower ?? text.toLowerCase();

  const props = feature.properties;
  if (!props) return false;

  for (const key in props) {
    if (key.toLowerCase().includes(searchLower)) return true;
    const val = props[key];
    if (val == null) continue;
    if (typeof val === 'string' && val.toLowerCase().includes(searchLower)) return true;
    if ((typeof val === 'number' || typeof val === 'boolean') && String(val).includes(searchLower)) return true;
    if (typeof val === 'object' && JSON.stringify(val).toLowerCase().includes(searchLower)) return true;
  }
  return false;
}

export function hasPolygonGeometry(
  features: readonly GeoJSON.Feature[],
): boolean {
  return features.some(
    (feature) =>
      feature.geometry?.type === "Polygon" ||
      feature.geometry?.type === "MultiPolygon",
  );
}

export function hasPointGeometry(
  features: readonly GeoJSON.Feature[],
): boolean {
  return features.some(
    (feature) =>
      feature.geometry?.type === "Point" ||
      feature.geometry?.type === "MultiPoint",
  );
}

export function shouldDisplayDatasetPoints(
  features: readonly GeoJSON.Feature[],
  userPreference?: boolean,
): boolean {
  if (userPreference !== undefined) return userPreference;
  return !hasPolygonGeometry(features);
}

export function filterDatasetFeatures(
  features: readonly GeoJSON.Feature[],
  options: {
    showPoints: boolean;
    filterText?: string;
    filterType?: string;
  },
): GeoJSON.Feature[] {
  const { showPoints, filterText = "", filterType = "todos" } = options;
  const filterTextLower = filterText.toLowerCase();
  return features.filter((feature) => {
    if (
      !showPoints &&
      (feature.geometry?.type === "Point" ||
        feature.geometry?.type === "MultiPoint")
    ) {
      return false;
    }
    return matchesFeature(feature, filterText, filterType, filterTextLower);
  });
}
