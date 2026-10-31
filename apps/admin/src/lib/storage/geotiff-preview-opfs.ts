/** Optional cache for *derived* PNG previews. IndexedDB retains authoritative originals. */
import type { GeoTiffInputLimits } from '@markmap/maps';

const DIRECTORY = 'markmap-geotiff-derived-previews-v1';
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const MAX_PREVIEW_BYTES = 12 * 1024 * 1024;
const MAX_METADATA_BYTES = 4 * 1024;
const MAX_ENTRIES = 6;
const PNG_MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];

type Coordinates = [[number, number], [number, number], [number, number], [number, number]];
export type CachedGeoTiffPreview = { image: Blob; width: number; height: number; coordinates: Coordinates };
type Metadata = Omit<CachedGeoTiffPreview, 'image'> & { version: 3; storedAt: number; sha256: string; metadataSha256: string };

function validKey(key: string): boolean { return /^[a-f0-9]{64}$/.test(key); }
async function sha256Hex(image: Blob): Promise<string> {
  const bytes = await image.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
/** Catches accidental/torn metadata edits, not malicious edits by a writer with OPFS access. */
async function metadataSha256(key: string, meta: Omit<Metadata, 'metadataSha256'>): Promise<string> {
  return sha256Hex(new Blob([JSON.stringify([
    key, meta.version, meta.width, meta.height, meta.coordinates, meta.sha256, meta.storedAt,
  ])]));
}
function validCoordinates(value: unknown): value is Coordinates {
  return Array.isArray(value) && value.length === 4 && value.every((pair) =>
    Array.isArray(pair) && pair.length === 2 && pair.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    pair[0] >= -180 && pair[0] <= 180 && pair[1] >= -90 && pair[1] <= 90);
}

async function directory(create: boolean): Promise<FileSystemDirectoryHandle | null> {
  const manager = typeof navigator === 'undefined' ? undefined : navigator.storage;
  if (typeof manager?.getDirectory !== 'function') return null;
  try { return await (await manager.getDirectory()).getDirectoryHandle(DIRECTORY, { create }); }
  catch { return null; }
}

export async function geoTiffPreviewCacheKey(original: Blob): Promise<string | null> {
  if (original.size < 8 || original.size > MAX_INPUT_BYTES || typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    const hash = await crypto.subtle.digest('SHA-256', await original.arrayBuffer());
    return [...new Uint8Array(hash)].map((n) => n.toString(16).padStart(2, '0')).join('');
  } catch { return null; }
}

export async function readGeoTiffPreviewCache(key: string, limits: GeoTiffInputLimits = {}): Promise<CachedGeoTiffPreview | null> {
  if (!validKey(key)) return null;
  try {
    const dir = await directory(false);
    if (!dir) return null;
    const metaFile = await (await dir.getFileHandle(`${key}.json`)).getFile();
    if (metaFile.size < 32 || metaFile.size > MAX_METADATA_BYTES) return null;
    const meta = JSON.parse(await metaFile.text()) as Partial<Metadata>;
    if (meta.version !== 3 || !validKey(meta.sha256 ?? '') || !validKey(meta.metadataSha256 ?? '') ||
        !Number.isSafeInteger(meta.storedAt) || !meta.storedAt || meta.storedAt < 1 ||
        !Number.isSafeInteger(meta.width) || !Number.isSafeInteger(meta.height) ||
        !meta.width || !meta.height || meta.width <= 0 || meta.height <= 0 ||
        meta.width * meta.height > (limits.maxPreviewPixels ?? limits.maxPixels ?? 100_000_000) ||
        (limits.maxPreviewDimension !== undefined &&
          (meta.width > limits.maxPreviewDimension || meta.height > limits.maxPreviewDimension)) ||
        !validCoordinates(meta.coordinates)) return null;
    if (await metadataSha256(key, meta as Metadata) !== meta.metadataSha256) return null;
    const image = await (await dir.getFileHandle(`${key}.png`)).getFile();
    if (image.size < 8 || image.size > MAX_PREVIEW_BYTES) return null;
    const header = new DataView(await image.slice(0, 24).arrayBuffer());
    if (header.byteLength < 24 || !PNG_MAGIC.every((v, i) => header.getUint8(i) === v) ||
        header.getUint32(16) !== meta.width || header.getUint32(20) !== meta.height) return null;
    // Header checks alone do not detect truncated or corrupted PNG payloads.
    if (await sha256Hex(image) !== meta.sha256) return null;
    return { image: new Blob([image], { type: 'image/png' }), width: meta.width, height: meta.height, coordinates: meta.coordinates };
  } catch { return null; }
}

export async function writeGeoTiffPreviewCache(key: string, image: Blob, preview: Omit<CachedGeoTiffPreview, 'image'>): Promise<void> {
  if (!validKey(key) || image.size < 24 || image.size > MAX_PREVIEW_BYTES ||
      !validCoordinates(preview.coordinates) || !Number.isSafeInteger(preview.width) || !Number.isSafeInteger(preview.height) ||
      preview.width <= 0 || preview.height <= 0) return;
  try {
    const manager = typeof navigator === 'undefined' ? undefined : navigator.storage;
    const space = await manager?.estimate?.();
    // A derived image must never consume the reserve for offline domain writes.
    if (!Number.isFinite(space?.quota) || !Number.isFinite(space?.usage) ||
        (space!.quota! - space!.usage!) < 64 * 1024 * 1024 + image.size * 2) return;
    const dir = await directory(true);
    if (!dir) return;
    // Never delete an original or any unrelated OPFS data. Stop caching at the cap.
    const iterator = (dir as FileSystemDirectoryHandle & { keys?: () => AsyncIterable<string> }).keys;
    if (!iterator) return;
    let entries = 0;
    for await (const name of iterator.call(dir)) if (name.endsWith('.json')) entries++;
    const existing = await dir.getFileHandle(`${key}.json`).then(() => true, () => false);
    if (!existing && entries >= MAX_ENTRIES) return;
    const sha256 = await sha256Hex(image);
    const markerPayload: Omit<Metadata, 'metadataSha256'> = {
      version: 3, width: preview.width, height: preview.height,
      coordinates: preview.coordinates, storedAt: Date.now(), sha256,
    };
    const integrity = await metadataSha256(key, markerPayload);
    const output = await (await dir.getFileHandle(`${key}.png`, { create: true })).createWritable();
    await output.write(image);
    await output.close();
    // Metadata is written last so readers never use a partially staged PNG.
    const marker = await (await dir.getFileHandle(`${key}.json`, { create: true })).createWritable();
    await marker.write(JSON.stringify({ ...markerPayload, metadataSha256: integrity }));
    await marker.close();
  } catch { /* OPFS is best effort and never a source of domain data. */ }
}
