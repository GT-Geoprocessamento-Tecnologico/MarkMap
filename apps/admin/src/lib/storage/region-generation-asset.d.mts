export declare function readActiveGenerationAsset(
  db: IDBDatabase, packageId: string, path: string, generation: string,
): Promise<Blob | null>;
