import { FileSource, PMTiles, Protocol, type RangeResponse } from "pmtiles";
// @ts-expect-error contracts emits runtime JS without declarations in this workspace
import type { OfflineMapPackageManifest } from "../../../contracts/dist/src/offline-map.js";
import { isSafePackagePath } from "./package.js";

export { Protocol };
export const MAX_RANGE_BYTES = 4 * 1024 * 1024;
export const MAX_ASSET_BYTES = 4 * 1024 * 1024;

export class OfflinePackageSource extends FileSource {
  private readonly key: string;
  constructor(file: File, packageId: string) { super(file); this.key = `geonexo-offline:${packageId}`; }
  override getKey(): string { return this.key; }
  override async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 || length > MAX_RANGE_BYTES) throw new RangeError("offline PMTiles range is invalid or too large");
    if (signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
    const read = this.file.slice(offset, offset + length).arrayBuffer();
    const aborted = signal ? new Promise<never>((_, reject) => signal.addEventListener("abort", () => reject(new DOMException("The operation was aborted", "AbortError")), { once: true })) : undefined;
    const bytes = await (aborted ? Promise.race([read, aborted]) : read);
    if (signal?.aborted) throw new DOMException("The operation was aborted", "AbortError");
    return { data: bytes };
  }
}

export function createOfflinePmtiles(file: File, packageId: string): PMTiles { return new PMTiles(new OfflinePackageSource(file, packageId)); }

export function createOfflineProtocol(manifest: OfflineMapPackageManifest, file: File): Protocol {
  const protocol = new Protocol({ metadata: false });
  protocol.add(createOfflinePmtiles(file, manifest.id));
  return protocol;
}

export type OfflineAssetResolver = (packageId: string, path: string) => Promise<Blob | null>;

/** MapLibre protocol handler for validated glyph, sprite and style assets. */
export function createOfflineAssetProtocol(resolve: OfflineAssetResolver) {
  return async (params: { url: string }, controller: AbortController): Promise<{ data: ArrayBuffer }> => {
    const match = /^geonexo-package:\/\/([^/]+)\/(.+)$/.exec(params.url);
    if (!match) throw new Error("invalid offline package asset URL");
    if (/%2f|%2F/.test(match[2]!)) throw new Error("invalid offline package asset URL");
    let packageId: string;
    let path: string;
    try {
      packageId = decodeURIComponent(match[1]!);
      path = decodeURIComponent(match[2]!);
    } catch {
      throw new Error("invalid offline package asset URL");
    }
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(packageId) || !isSafePackagePath(path)) throw new Error("invalid offline package asset URL");
    if (controller.signal.aborted) throw new DOMException("The operation was aborted", "AbortError");
    const blob = await resolve(packageId, path);
    if (controller.signal.aborted) throw new DOMException("The operation was aborted", "AbortError");
    if (!blob) throw new Error("offline package asset not found");
    if (blob.size > MAX_ASSET_BYTES) throw new RangeError("offline package asset is too large");
    const read = blob.arrayBuffer();
    const aborted = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new DOMException("The operation was aborted", "AbortError")), { once: true }));
    const data = await Promise.race([read, aborted]);
    if (controller.signal.aborted) throw new DOMException("The operation was aborted", "AbortError");
    return { data };
  };
}
