/** Stores only a public HTTPS manifest source, never map bytes or credentials. */
import { normalizePublicRegionManifestUrl } from './region-install-draft.mjs';
const STORAGE_PREFIX = 'markmap:region-update-source:';
const safeId = (id: string) => /^[a-z0-9][a-z0-9._-]{0,127}$/.test(id);

export function rememberRegionSource(regionId: string, manifestUrl: string): boolean {
  if (!safeId(regionId)) return false;
  const url = normalizePublicRegionManifestUrl(manifestUrl);
  if (!url) return false;
  try { localStorage.setItem(STORAGE_PREFIX + regionId, url); return true; }
  catch { return false; }
}

export function getRegionSourceUrl(regionId: string): string | null {
  if (!safeId(regionId)) return null;
  try { return normalizePublicRegionManifestUrl(localStorage.getItem(STORAGE_PREFIX + regionId) ?? ''); }
  catch { return null; }
}

export function forgetRegionSource(regionId: string): void {
  if (!safeId(regionId)) return;
  try { localStorage.removeItem(STORAGE_PREFIX + regionId); }
  catch { /* Browser may block localStorage; removal is best effort. */ }
}
