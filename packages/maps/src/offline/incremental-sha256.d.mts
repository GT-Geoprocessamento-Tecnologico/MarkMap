/** Incremental SHA-256 checksum; not an authenticity signature. */
export declare class IncrementalSha256 {
  update(bytes: Uint8Array): this;
  digestHex(): string;
}
export declare function sha256Blob(blob: Blob, chunkSize?: number): Promise<string>;
