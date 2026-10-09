/** Stores only a public HTTPS manifest source, never map bytes or credentials. */
const STORAGE_PREFIX = 'markmap:region-update-source:';
const safeId = (id: string) => /^[a-z0-9][a-z0-9._-]{0,127}$/.test(id);

function safeManifestUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) ||
        url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/manifest.json') ||
        url.href.length > 1_000) return null;
    return url.href;
  } catch { return null; }
}

export function rememberRegionSource(regionId: string, manifestUrl: string): boolean {
  if (!safeId(regionId)) return false;
  const url = safeManifestUrl(manifestUrl);
  if (!url) return false;
  try { localStorage.setItem(STORAGE_PREFIX + regionId, url); return true; }
  catch { return false; }
}

export function getRegionSourceUrl(regionId: string): string | null {
  if (!safeId(regionId)) return null;
  try { return safeManifestUrl(localStorage.getItem(STORAGE_PREFIX + regionId) ?? ''); }
  catch { return null; }
}

export function forgetRegionSource(regionId: string): void {
  if (!safeId(regionId)) return;
  try { localStorage.removeItem(STORAGE_PREFIX + regionId); }
  catch { /* Browser may block localStorage; removal is best effort. */ }
}
