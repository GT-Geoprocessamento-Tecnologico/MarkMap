export declare const REGION_DOWNLOAD_CHUNK_SIZE: number;
export declare function isValidCheckpoint(offset: number, length: number, assetSize: number, chunkSize?: number): boolean;
export interface SessionHashes { packageId: string; hashes: string[] }
export declare function unreferencedSessionHashes(packageId: string, sessions: readonly SessionHashes[]): string[];
