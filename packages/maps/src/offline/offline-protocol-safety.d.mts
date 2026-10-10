export declare class OfflineProtocolIntegrityError extends Error {
  readonly code: 'invalid-range' | 'truncated-range' | 'invalid-asset' | 'asset-too-large' | 'incomplete-read' | 'missing-asset' | 'invalid-url';
  constructor(code: OfflineProtocolIntegrityError['code'], message: string);
}
export declare function offlineAbortError(): DOMException;
export declare function assertOfflineByteRange(offset: number, length: number, fileSize: number, maximum: number): void;
export declare function abortableOfflineRead<T>(work: PromiseLike<T> | T, signal?: AbortSignal): Promise<T>;
export declare function assertOfflineAssetBlob(blob: unknown, maximum: number): Blob;
export declare function assertOfflineReadLength(buffer: unknown, expected: number): ArrayBuffer;
