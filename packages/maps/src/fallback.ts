/**
 * Basemap failure fallback. When the external style (OpenFreeMap) cannot
 * load, the map swaps to a local blank style so the workspace stays usable
 * and drawing/selection keep working offline.
 */

export const FALLBACK_BACKGROUND_COLOR = '#e9ede8';

export interface FallbackStyle {
  version: 8;
  name: string;
  sources: Record<string, never>;
  layers: Array<{
    id: string;
    type: 'background';
    paint: { 'background-color': string };
  }>;
}

/** Minimal local style used when the remote basemap fails. */
export function createFallbackStyle(color: string = FALLBACK_BACKGROUND_COLOR): FallbackStyle {
  return {
    version: 8,
    name: 'MarkMap fallback (offline)',
    sources: {},
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': color },
      },
    ],
  };
}

export interface MapErrorLike {
  error?: { message?: unknown; status?: unknown } | unknown;
  sourceId?: unknown;
}

/**
 * Heuristic: treat style/source load failures as fallback candidates while
 * ignoring plain tile 404 noise. Defensive by design — unknown shapes
 * return false instead of throwing.
 */
export function shouldFallbackOnError(event: unknown): boolean {
  if (typeof event !== 'object' || event === null) {
    return false;
  }
  const record = event as Record<string, unknown> & MapErrorLike;
  if (typeof record['sourceId'] === 'string' && record['sourceId'].length > 0) {
    return false;
  }
  const error = record['error'];
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const message = (error as Record<string, unknown>)['message'];
  const status = (error as Record<string, unknown>)['status'];
  if (typeof status === 'number' && Number.isFinite(status)) {
    return status === 0 || status >= 500;
  }
  if (typeof message === 'string') {
    const lowered = message.toLowerCase();
    return (
      lowered.includes('style') ||
      lowered.includes('failed to fetch') ||
      lowered.includes('networkerror') ||
      lowered.includes('network error') ||
      lowered.includes('offline')
    );
  }
  return false;
}
