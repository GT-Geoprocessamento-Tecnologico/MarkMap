import { createHash } from "node:crypto";
import { createRequire } from "node:module";

// The contracts build currently emits JavaScript without declarations. The
// runtime schema below remains canonical; this type import resolves when the
// contracts package publishes declarations.
// @ts-expect-error declarations are not emitted by the current contracts build
import type { OfflineMapPackageManifest } from "../../../contracts/dist/src/offline-map.js";

const require = createRequire(import.meta.url);
const { offlineMapPackageManifestSchema } = require(
  "../../../contracts/dist/src/offline-map.js",
) as {
  offlineMapPackageManifestSchema: {
    safeParse: (input: unknown) => { success: boolean };
  };
};

export const MAX_PACKAGE_BYTES = 250 * 1024 * 1024;
const PMTILES_HEADER_BYTES = 127;

export type OfflinePackageValidationError =
  | "invalid-manifest"
  | "unsafe-path"
  | "budget-exceeded"
  | "missing-asset"
  | "checksum-mismatch"
  | "invalid-pmtiles-header"
  | "pmtiles-length-mismatch"
  | "external-style-resource"
  | "duplicate-asset-path";

export type OfflinePackageValidation =
  | { ok: true; manifest: OfflineMapPackageManifest }
  | { ok: false; code: OfflinePackageValidationError; detail: string };

type PackageBytes = ReadonlyMap<string, Uint8Array>;

const isSafeRelativePath = (path: string): boolean => {
  if (!path || path.startsWith("/") || path.endsWith("/") || path.includes("\\")) return false;
  return path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== ".." && /^[A-Za-z0-9._@-]+$/.test(segment));
};

const isLocalStyleRef = (value: unknown, allowPmtiles: boolean): boolean => {
  if (typeof value !== "string" || value.startsWith("//")) return false;
  if (allowPmtiles && value === "pmtiles://package.pmtiles") return true;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) || value.startsWith("/")) return false;
  return isSafeRelativePath(value.replace(/\{(?:fontstack|range)\}/g, "placeholder"));
};

const validateStyleResources = (style: unknown): boolean => {
  if (!style || typeof style !== "object") return false;
  const record = style as { sources?: unknown; glyphs?: unknown; sprite?: unknown };
  if (!isLocalStyleRef(record.glyphs, false) || !isLocalStyleRef(record.sprite, false)) return false;
  if (!record.sources || typeof record.sources !== "object" || Array.isArray(record.sources)) return false;
  return Object.values(record.sources).every((source) => {
    if (!source || typeof source !== "object") return false;
    const item = source as { url?: unknown; tiles?: unknown };
    if (item.url !== undefined && !isLocalStyleRef(item.url, true)) return false;
    if (item.tiles !== undefined && (!Array.isArray(item.tiles) || !item.tiles.every((tile) => isLocalStyleRef(tile, true)))) return false;
    return true;
  });
};

const sha256 = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const readUint64LE = (bytes: Uint8Array, offset: number): number => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const value = view.getBigUint64(offset, true);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("PMTiles offset exceeds safe integer range");
  return Number(value);
};

const validatePmtiles = (archive: Uint8Array): OfflinePackageValidation | undefined => {
  if (archive.byteLength < PMTILES_HEADER_BYTES || new TextDecoder().decode(archive.subarray(0, 7)) !== "PMTiles") {
    return { ok: false, code: "invalid-pmtiles-header", detail: "PMTiles v3 header is missing or truncated" };
  }
  if (archive[7] !== 3) {
    return { ok: false, code: "invalid-pmtiles-header", detail: "only PMTiles v3 is accepted" };
  }
  try {
    for (let offset = 8; offset < 72; offset += 16) {
      const start = readUint64LE(archive, offset);
      const length = readUint64LE(archive, offset + 8);
      if (start < PMTILES_HEADER_BYTES || start + length > archive.byteLength) {
        return { ok: false, code: "pmtiles-length-mismatch", detail: "PMTiles section exceeds supplied archive bytes" };
      }
    }
  } catch {
    return { ok: false, code: "pmtiles-length-mismatch", detail: "PMTiles section length is not representable" };
  }
  return undefined;
};

export const validateOfflineMapPackage = (
  manifestInput: unknown,
  assets: PackageBytes,
): OfflinePackageValidation => {
  if (manifestInput && typeof manifestInput === "object") {
    const candidate = manifestInput as { style?: { path?: unknown; blob?: { bytes?: unknown } }; archive?: { bytes?: unknown }; glyphs?: unknown; sprites?: unknown };
    const candidatePaths = [
      candidate.style?.path,
      ...(Array.isArray(candidate.glyphs) ? candidate.glyphs.map((asset) => (asset as { path?: unknown }).path) : []),
      ...(Array.isArray(candidate.sprites) ? candidate.sprites.map((asset) => (asset as { path?: unknown }).path) : []),
    ];
    if (candidatePaths.some((path) => typeof path !== "string" || !isSafeRelativePath(path))) {
      return { ok: false, code: "unsafe-path", detail: "asset path is not a safe relative POSIX path" };
    }
    if (candidatePaths.includes("package.pmtiles")) {
      return { ok: false, code: "duplicate-asset-path", detail: "asset path collides with the reserved archive" };
    }
    if (new Set(candidatePaths).size !== candidatePaths.length) {
      return { ok: false, code: "duplicate-asset-path", detail: "asset paths must be unique" };
    }
    const declaredBytes: unknown[] = [
      candidate.archive?.bytes,
      candidate.style?.blob?.bytes,
      ...(Array.isArray(candidate.glyphs) ? candidate.glyphs.map((asset: unknown) => (asset as { blob?: { bytes?: unknown } }).blob?.bytes) : []),
      ...(Array.isArray(candidate.sprites) ? candidate.sprites.map((asset: unknown) => (asset as { blob?: { bytes?: unknown } }).blob?.bytes) : []),
    ];
    const numericBytes = declaredBytes.filter(
      (bytes): bytes is number => typeof bytes === "number" && Number.isFinite(bytes),
    );
    if (numericBytes.length === declaredBytes.length && numericBytes.reduce((sum: number, bytes: number) => sum + bytes, 0) > MAX_PACKAGE_BYTES) {
      return { ok: false, code: "budget-exceeded", detail: "package exceeds the 250 MiB activation budget" };
    }
  }
  if (!offlineMapPackageManifestSchema.safeParse(manifestInput).success) {
    return { ok: false, code: "invalid-manifest", detail: "manifest does not match the canonical contract" };
  }
  const manifest = manifestInput as OfflineMapPackageManifest;
  const paths = [manifest.style.path, ...manifest.glyphs.map((asset: { path: string }) => asset.path), ...manifest.sprites.map((asset: { path: string }) => asset.path)];
  if (paths.some((path) => !isSafeRelativePath(path))) {
    return { ok: false, code: "unsafe-path", detail: "asset path is not a safe relative POSIX path" };
  }
  if (paths.includes("package.pmtiles") || new Set(paths).size !== paths.length) {
    return { ok: false, code: "duplicate-asset-path", detail: "asset paths must be unique and cannot collide with the archive" };
  }
  const totalBytes = manifest.archive.bytes + manifest.style.blob.bytes + manifest.glyphs.reduce((sum: number, asset: { blob: { bytes: number } }) => sum + asset.blob.bytes, 0) + manifest.sprites.reduce((sum: number, asset: { blob: { bytes: number } }) => sum + asset.blob.bytes, 0);
  if (totalBytes > MAX_PACKAGE_BYTES) {
    return { ok: false, code: "budget-exceeded", detail: "package exceeds the 250 MiB activation budget" };
  }
  const archive = assets.get("package.pmtiles");
  if (!archive || archive.byteLength !== manifest.archive.bytes) {
    return { ok: false, code: "pmtiles-length-mismatch", detail: "archive bytes do not match the manifest" };
  }
  if (sha256(archive) !== manifest.archive.sha256.toLowerCase()) {
    return { ok: false, code: "checksum-mismatch", detail: "archive SHA-256 does not match the manifest" };
  }
  const headerError = validatePmtiles(archive);
  if (headerError) return headerError;
  const refs = [manifest.style, ...manifest.glyphs, ...manifest.sprites];
  for (const ref of refs) {
    const bytes = assets.get(ref.path);
    if (!bytes || bytes.byteLength !== ref.blob.bytes) {
      return { ok: false, code: "missing-asset", detail: `asset bytes missing or length mismatch: ${ref.path}` };
    }
    if (sha256(bytes) !== ref.blob.sha256.toLowerCase()) {
      return { ok: false, code: "checksum-mismatch", detail: `asset SHA-256 does not match the manifest: ${ref.path}` };
    }
    if (ref.path === manifest.style.path) {
      try {
        if (!validateStyleResources(JSON.parse(new TextDecoder().decode(bytes)))) {
          return { ok: false, code: "external-style-resource", detail: "style contains an HTTP(S) resource" };
        }
      } catch {
        return { ok: false, code: "invalid-manifest", detail: "style asset is not valid JSON" };
      }
    }
  }
  return { ok: true, manifest };
};
