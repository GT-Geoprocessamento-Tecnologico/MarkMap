export class DownloadIntegrityError extends Error {
  readonly code: string;
  constructor(code: string, message: string);
}
export interface ChunkStore {
  get(sha256: string, offset: number): Promise<Uint8Array | null>;
  put(sha256: string, offset: number, data: Uint8Array): Promise<void>;
  deleteAsset(sha256: string): Promise<void>;
}
export function downloadVerifiedAsset(options: {
  url: string;
  sha256: string;
  size: number;
  store: ChunkStore;
  fetcher?: typeof fetch;
  signal?: AbortSignal;
  onProgress?: (p: { downloadedBytes: number; totalBytes: number }) => void;
  chunkSize?: number;
}): Promise<Blob>;
