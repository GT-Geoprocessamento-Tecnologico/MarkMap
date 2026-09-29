import {
  createFeature,
  geometryTypeOf,
  isFeature,
  normalizeProperties,
  validateGeometryLight,
} from '@geonexo/geo';
import type { GeoNexoFeature } from '@geonexo/geo';
import type { DrawChangeEvent, DrawChangeType } from './types.js';

/**
 * Pure mapping between Terra Draw snapshots and the stable GeoJSON payload
 * consumed by the admin. All validation/normalization lives here so the
 * adapter class stays thin and every branch is unit-testable without a
 * browser, MapLibre or Terra Draw instance.
 */

let fallbackCounter = 0;

function nextFallbackId(): string {
  fallbackCounter += 1;
  return `draw-${Date.now().toString(36)}-${fallbackCounter}`;
}

function stableId(raw: unknown): string {
  if (typeof raw === 'string' && raw.length > 0) {
    return raw;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(raw);
  }
  return nextFallbackId();
}

/**
 * Convert one Terra Draw snapshot entry into a GeoNexo feature.
 * Returns null for empty/invalid geometries instead of throwing, so a
 * single corrupt snapshot entry never breaks the whole change event.
 */
export function toGeoNexoFeature(input: unknown): GeoNexoFeature | null {
  if (!isFeature(input)) {
    return null;
  }
  if (input.geometry === null) {
    return null;
  }
  if (geometryTypeOf(input.geometry) === null) {
    return null;
  }
  const validation = validateGeometryLight(input.geometry);
  if (!validation.ok) {
    return null;
  }
  const record = input as unknown as Record<string, unknown>;
  const rawId = record['id'];
  const feature = createFeature(input.geometry, normalizeProperties(input.properties));
  feature.id = stableId(rawId);
  return feature;
}

/** Map a whole snapshot array, dropping invalid entries. */
export function snapshotToFeatures(snapshot: unknown): GeoNexoFeature[] {
  if (!Array.isArray(snapshot)) {
    return [];
  }
  const out: GeoNexoFeature[] = [];
  for (const item of snapshot) {
    const feature = toGeoNexoFeature(item);
    if (feature !== null) {
      out.push(feature);
    }
  }
  return out;
}

export interface TerraChangeInput {
  type: DrawChangeType;
  /** Ids reported by the draw engine for this change. */
  ids: readonly string[];
  /** Current full snapshot after the change. */
  snapshot: unknown;
}

/**
 * Build the stable change event for a draw engine notification.
 * `delete` carries ids only (features are gone); create/update carry the
 * matching snapshot features when available, falling back to ids.
 */
export function mapTerraDrawChange(input: TerraChangeInput): DrawChangeEvent {
  const features = snapshotToFeatures(input.snapshot);
  if (input.type === 'delete') {
    return { type: 'delete', features: [], ids: [...input.ids] };
  }
  const wanted = new Set(input.ids);
  const matched = features.filter(
    (feature) => feature.id !== undefined && wanted.has(feature.id),
  );
  const resolved = matched.length > 0 ? matched : features;
  return {
    type: input.type,
    features: resolved,
    ids: resolved
      .map((feature) => feature.id)
      .filter((id): id is string => typeof id === 'string'),
  };
}

/** Reset the fallback id counter (tests only). */
export function resetFallbackIdCounterForTests(): void {
  fallbackCounter = 0;
}
