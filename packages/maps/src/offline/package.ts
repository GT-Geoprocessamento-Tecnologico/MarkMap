import { validateRegionalWikipedia, validateRegionalTransit, MAX_WIKIPEDIA_BYTES, MAX_TRANSIT_BYTES } from '../content/region-content.mjs';
import { MAX_GRAPH_BYTES, validateRegionalGraph } from '../routing/graph-format.mjs';
import { MAX_CONTOUR_BYTES, validateRegionalContours } from '../elevation/contour-package.mjs';
import { MAX_REGIONAL_DEM_BYTES, validateRegionalDem } from '../elevation/regional-dem.mjs';
import { MAX_REGIONAL_SEARCH_BYTES, MAX_REGIONAL_SHARD_BYTES, MAX_REGIONAL_SEARCH_RECORDS, parseRegionalShard } from "../search/regional-shards.js";
import { IncrementalSha256, sha256Blob } from "./incremental-sha256.mjs";
// @ts-expect-error contracts emits runtime JS without declarations in this workspace
import { offlineMapPackageManifestSchema, type OfflineMapPackageManifest } from "../../../contracts/dist/src/offline-map.js";

export const OFFLINE_PACKAGE_DB = "GeoNexoOfflineMapPackages";
export const OFFLINE_PACKAGE_VERSION = 1;
export const OFFLINE_PACKAGE_QUOTA = 250 * 1024 * 1024;

export type PackageAsset = Uint8Array | ArrayBuffer | Blob;
export type PackageAssets = ReadonlyMap<string, PackageAsset>;
export type PackageState = "staged" | "active";
export interface StoredOfflinePackage {
  manifest: OfflineMapPackageManifest;
  state: PackageState;
  installedAt: string;
}

export const isSafePackagePath = (path: string): boolean =>
  path.length > 0 && !path.startsWith("/") && !path.endsWith("/") && !path.includes("\\") &&
  path.split("/").every((part) => part.length > 0 && part !== "." && part !== ".." && /^[A-Za-z0-9._@-]+$/.test(part));

export async function bytesOf(value: PackageAsset): Promise<Uint8Array> {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return new Uint8Array(await value.arrayBuffer());
}

export async function sha256(value: PackageAsset): Promise<string> {
  // Blob-backed archives are hashed in bounded slices. Never materialize a
  // second 250 MiB ArrayBuffer just to verify a map in the browser.
  if (value instanceof Blob) return sha256Blob(value);
  return new IncrementalSha256().update(await bytesOf(value)).digestHex();
}

function localRef(value: unknown, pmtiles = false): boolean {
  if (typeof value !== "string" || value.startsWith("//") || value.startsWith("/")) return false;
  if (pmtiles && value === "pmtiles://package.pmtiles") return true;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)) return false;
  return isSafePackagePath(value.replace(/\{(?:fontstack|range)\}/g, "placeholder"));
}

export async function validateOfflinePackage(manifestInput: unknown, assets: PackageAssets): Promise<{ ok: true; manifest: OfflineMapPackageManifest } | { ok: false; code: string; detail: string }> {
  const parsed = offlineMapPackageManifestSchema.safeParse(manifestInput);
  if (!parsed.success) return { ok: false, code: "invalid-manifest", detail: "manifest does not match the canonical contract" };
  const manifest = parsed.data;
  const refs = [manifest.style, ...manifest.glyphs, ...manifest.sprites, ...(manifest.searchShards ?? []), ...(manifest.routingGraph ? [manifest.routingGraph] : []), ...(manifest.contourLines ? [manifest.contourLines] : []),
    ...(manifest.wikipediaPack ? [manifest.wikipediaPack] : []), ...(manifest.transitPack ? [manifest.transitPack] : []),
    ...(manifest.demGrid ? [manifest.demGrid] : [])];
  let indexedRecords = 0;
  let searchBytes = 0;
  const paths = refs.map((r) => r.path);
  if (paths.some((p) => !isSafePackagePath(p)) || paths.includes("package.pmtiles") || new Set(paths).size !== paths.length)
    return { ok: false, code: "unsafe-path", detail: "asset paths must be unique and safe" };
  const total = manifest.archive.bytes + refs.reduce((n, r) => n + r.blob.bytes, 0);
  if (total > OFFLINE_PACKAGE_QUOTA) return { ok: false, code: "budget-exceeded", detail: "package exceeds the activation budget" };
  const archive = assets.get("package.pmtiles") ?? new Uint8Array();
  const archiveSize = archive instanceof Blob ? archive.size : archive.byteLength;
  if (archiveSize !== manifest.archive.bytes) return { ok: false, code: "size-mismatch", detail: "archive byte length does not match manifest" };
  if ((await sha256(archive)).toLowerCase() !== manifest.archive.sha256.toLowerCase()) return { ok: false, code: "checksum-mismatch", detail: "archive checksum does not match manifest" };
  const header = archive instanceof Blob
    ? new Uint8Array(await archive.slice(0, 127).arrayBuffer())
    : (await bytesOf(archive)).subarray(0, 127);
  if (header.byteLength < 127 || new TextDecoder().decode(header.subarray(0, 7)) !== "PMTiles" || header[7] !== 3)
    return { ok: false, code: "invalid-pmtiles-header", detail: "only PMTiles v3 archives are supported" };
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  for (let offset = 8; offset < 72; offset += 16) {
    const start = Number(view.getBigUint64(offset, true));
    const length = Number(view.getBigUint64(offset + 8, true));
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(length) || start < 127 || start + length > archiveSize)
      return { ok: false, code: "pmtiles-length-mismatch", detail: "PMTiles section exceeds archive bytes" };
  }
  for (const ref of refs) {
    const value = assets.get(ref.path);
    if (!value) return { ok: false, code: "missing-asset", detail: `missing asset: ${ref.path}` };
    const assetSize = value instanceof Blob ? value.size : value.byteLength;
    if (assetSize !== ref.blob.bytes) return { ok: false, code: "size-mismatch", detail: `asset size mismatch: ${ref.path}` };
    if ((await sha256(value)).toLowerCase() !== ref.blob.sha256.toLowerCase()) return { ok: false, code: "checksum-mismatch", detail: `asset checksum mismatch: ${ref.path}` };
    // Parse only bounded JSON assets. Binary PMTiles/glyphs/sprites stay as Blobs.
    const needsJson = ref.path === manifest.style.path || ref.path === 'routing/graph.json' ||
      ref.path === 'elevation/contours.json' || ref.path === 'elevation/dem.json' ||
      ref.path.startsWith('search/') || ref.path === 'content/wikipedia.json' ||
      ref.path === 'content/transit.json';
    const bytes = needsJson ? await bytesOf(value) : new Uint8Array(0);
    if (ref.path === 'routing/graph.json') {
      if (bytes.byteLength > MAX_GRAPH_BYTES) return { ok: false, code: 'graph-too-large', detail: 'routing graph exceeds local budget' };
      try {
        const graph = validateRegionalGraph(JSON.parse(new TextDecoder().decode(bytes)), {
          bounds: manifest.bounds, osmDataDate: manifest.osmDataDate,
        });
        for (const profile of ['walk', 'bicycle', 'car'] as const)
          if (graph.profiles.includes(profile) !== manifest.capabilities.includes(`routing.${profile}`))
            return { ok: false, code: 'graph-profile-mismatch', detail: `routing.${profile} capability does not match installed graph` };
      } catch {
        return { ok: false, code: 'invalid-routing-graph', detail: 'regional graph failed validation' };
      }
    }
    if (ref.path === 'elevation/contours.json') {
      if (bytes.byteLength > MAX_CONTOUR_BYTES) return { ok: false, code: 'contours-too-large', detail: 'regional contours exceed local budget' };
      try { validateRegionalContours(JSON.parse(new TextDecoder().decode(bytes)), manifest.bounds); }
      catch { return { ok: false, code: 'invalid-contours', detail: 'regional contour data failed validation' }; }
    }
    if (ref.path === 'elevation/dem.json') {
      if (bytes.byteLength > MAX_REGIONAL_DEM_BYTES)
        return { ok: false, code: 'dem-too-large', detail: 'regional elevation grid exceeds device budget' };
      try { validateRegionalDem(JSON.parse(new TextDecoder().decode(bytes)), manifest.id, manifest.bounds); }
      catch { return { ok: false, code: 'invalid-dem', detail: 'DEM is missing valid measured heights or license metadata' }; }
    }
    if (ref.path.startsWith('search/')) {
      searchBytes += bytes.byteLength;
      if (bytes.byteLength > MAX_REGIONAL_SHARD_BYTES || searchBytes > MAX_REGIONAL_SEARCH_BYTES)
        return { ok: false, code: 'search-too-large', detail: 'regional search budget exceeded' };
      try {
        const shard = parseRegionalShard(JSON.parse(new TextDecoder().decode(bytes)), ref.path);
        indexedRecords += shard.records.length;
        if (indexedRecords > MAX_REGIONAL_SEARCH_RECORDS)
          return { ok: false, code: 'search-too-large', detail: 'too many indexed places' };
      } catch {
        return { ok: false, code: 'invalid-search-shard', detail: `invalid OSM search shard: ${ref.path}` };
      }
    }
    if (ref.path === 'content/wikipedia.json' || ref.path === 'content/transit.json') {
      const limit = ref.path === 'content/wikipedia.json' ? MAX_WIKIPEDIA_BYTES : MAX_TRANSIT_BYTES;
      if (bytes.byteLength > limit) return { ok: false, code: 'content-too-large', detail: 'regional content exceeds local budget' };
      try {
        const data = JSON.parse(new TextDecoder().decode(bytes));
        if (ref.path === 'content/wikipedia.json') validateRegionalWikipedia(data, manifest.id);
        else validateRegionalTransit(data, manifest.id, manifest.bounds);
      } catch { return { ok: false, code: 'invalid-content', detail: `invalid licensed regional data: ${ref.path}` }; }
    }
    if (ref.path === manifest.style.path) {
      let style: { glyphs?: unknown; sprite?: unknown; sources?: Record<string, { url?: unknown; tiles?: unknown[] }> };
      try { style = JSON.parse(new TextDecoder().decode(bytes)) as typeof style; } catch { return { ok: false, code: "invalid-style", detail: "style is not JSON" }; }
      if (!localRef(style.glyphs) || !localRef(style.sprite) || !style.sources || Object.values(style.sources).some((s) => (s.url !== undefined && !localRef(s.url, true)) || (s.tiles !== undefined && (!Array.isArray(s.tiles) || s.tiles.some((t) => !localRef(t, true))))))
        return { ok: false, code: "external-style-resource", detail: "style contains a non-local resource" };
    }
  }
  return { ok: true, manifest };
}
