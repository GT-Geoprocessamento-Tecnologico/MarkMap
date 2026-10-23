import { FileSource, PMTiles, Protocol, type RangeResponse } from "pmtiles";
import type { OfflineMapPackageManifest } from "@markmap/contracts/offline-map";
import { isSafePackagePath } from "./package.js";
import {
  OfflineProtocolIntegrityError,
  abortableOfflineRead,
  assertOfflineAssetBlob,
  assertOfflineByteRange,
  assertOfflineReadLength,
  offlineAbortError,
} from "./offline-protocol-safety.mjs";

export { Protocol };
export const MAX_RANGE_BYTES = 4 * 1024 * 1024;
export const MAX_ASSET_BYTES = 4 * 1024 * 1024;

export class OfflinePackageSource extends FileSource {
  private readonly key: string;
  constructor(file: File, packageId: string, prefix = 'markmap-offline') { super(file); this.key = `${prefix}:${packageId}`; }
  override getKey(): string { return this.key; }
  override async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    assertOfflineByteRange(offset, length, this.file.size, MAX_RANGE_BYTES);
    if (signal?.aborted) throw offlineAbortError();
    if (length === 0) return { data: new ArrayBuffer(0) };
    const bytes = await abortableOfflineRead(this.file.slice(offset, offset + length).arrayBuffer(), signal);
    return { data: assertOfflineReadLength(bytes, length) };
  }
}

export function createOfflinePmtiles(file: File, packageId: string, prefix = 'markmap-offline'): PMTiles { return new PMTiles(new OfflinePackageSource(file, packageId, prefix)); }

export function createOfflineProtocol(manifest: OfflineMapPackageManifest, file: File, protocolId = manifest.id): Protocol {
  const protocol = new Protocol({ metadata: false });
  protocol.add(createOfflinePmtiles(file, protocolId, 'markmap-offline'));
  protocol.add(createOfflinePmtiles(file, protocolId, 'geonexo-offline'));
  return protocol;
}

export type OfflineAssetResolver = (packageId: string, path: string) => Promise<Blob | null>;

/** MapLibre handler for verified local glyph/sprite/style assets. */
export function createOfflineAssetProtocol(resolve: OfflineAssetResolver) {
  return async (params: { url: string }, controller: AbortController): Promise<{ data: ArrayBuffer }> => {
    // Keep the historical scheme readable while accepting the MarkMap alias
    // emitted by older local builds. Existing IndexedDB packages remain valid.
    const match = /^(?:geonexo|markmap)-package:\/\/([^/]+)\/(.+)$/.exec(params.url);
    if (!match || /%2f/i.test(match[2]!)) {
      throw new OfflineProtocolIntegrityError('invalid-url', 'invalid offline package asset URL');
    }
    let packageId: string;
    let path: string;
    try {
      packageId = decodeURIComponent(match[1]!);
      path = decodeURIComponent(match[2]!);
    } catch {
      throw new OfflineProtocolIntegrityError('invalid-url', 'invalid offline package asset URL');
    }
    if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(packageId) || !isSafePackagePath(path)) {
      throw new OfflineProtocolIntegrityError('invalid-url', 'invalid offline package asset URL');
    }
    if (controller.signal.aborted) throw offlineAbortError();
    const blob = await abortableOfflineRead(resolve(packageId, path), controller.signal);
    if (!blob) throw new OfflineProtocolIntegrityError('missing-asset', 'Offline package asset is unavailable');
    assertOfflineAssetBlob(blob, MAX_ASSET_BYTES);
    const data = await abortableOfflineRead(blob.arrayBuffer(), controller.signal);
    return { data: assertOfflineReadLength(data, blob.size) };
  };
}
