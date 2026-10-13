import { IncrementalSha256 } from '../../../../../packages/maps/src/offline/incremental-sha256.mjs';

/** Canonical fingerprint of the complete Zod-parsed manifest shown in the UI. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') {
    const result = Object.create(null);
    for (const key of Object.keys(value).sort()) result[key] = canonical(value[key]);
    return result;
  }
  return value;
}

export function fingerprintRegionManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest))
    throw new TypeError('Expected parsed regional manifest');
  const json = JSON.stringify(canonical(manifest));
  if (typeof json !== 'string') throw new TypeError('Manifest cannot be serialized');
  const bytes = new TextEncoder().encode(json);
  if (bytes.byteLength > 128 * 1024) throw new RangeError('Manifest snapshot exceeds 128 KiB');
  return new IncrementalSha256().update(bytes).digestHex();
}

/**
 * Fail closed when the source, installed base or any manifest field changes
 * between the user's preview and the explicit Apply click.
 */
export function matchesRegionUpdatePreview(manifest, sourceUrl, installedVersion, expected, installedGeneration) {
  if (!expected || typeof expected.sourceUrl !== 'string' ||
      typeof expected.installedVersion !== 'string' ||
      typeof expected.manifestFingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(expected.manifestFingerprint)) return false;
  if (installedGeneration !== undefined && (typeof expected.installedGeneration !== 'string' ||
      expected.installedGeneration !== installedGeneration)) return false;
  return sourceUrl === expected.sourceUrl && installedVersion === expected.installedVersion &&
    fingerprintRegionManifest(manifest) === expected.manifestFingerprint;
}
