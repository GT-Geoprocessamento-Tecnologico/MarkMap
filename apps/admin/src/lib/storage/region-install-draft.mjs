/**
 * A12: Store only a public, sanitized manifest URL in sessionStorage.
 * No downloaded bytes, access tokens or personal data are persisted here.
 */
const DRAFT_KEY = "markmap:region-install-draft";

export function normalizePublicRegionManifestUrl(value) {
  if (typeof value !== "string" || value.length > 1000) return null;
  try {
    const url = new URL(value.trim());
    if (
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && url.hostname === "localhost")) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.endsWith("/manifest.json") ||
      url.href.length > 1000
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

function selectedStore(storage) {
  try {
    return storage === undefined ? globalThis.sessionStorage : storage;
  } catch {
    return null;
  }
}

export function getRegionInstallDraftUrl(storage) {
  try {
    return normalizePublicRegionManifestUrl(
      selectedStore(storage)?.getItem(DRAFT_KEY) ?? "",
    );
  } catch {
    return null;
  }
}

/** Invalid/empty input removes any previous draft; only valid public URLs persist. */
export function rememberRegionInstallDraftUrl(value, storage) {
  const url = normalizePublicRegionManifestUrl(value);
  try {
    if (url) selectedStore(storage)?.setItem(DRAFT_KEY, url);
    else selectedStore(storage)?.removeItem(DRAFT_KEY);
    return Boolean(url);
  } catch {
    return false;
  }
}

export function clearRegionInstallDraftUrl(storage) {
  try {
    selectedStore(storage)?.removeItem(DRAFT_KEY);
  } catch {
    /* Session storage may be disabled; app remains usable offline. */
  }
}
