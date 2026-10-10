/** SHA-256 of canonical keys/values of a validated regional manifest. */
export declare function fingerprintRegionManifest(manifest: unknown): string;
export interface RegionUpdatePreview {
  sourceUrl: string;
  installedVersion: string;
  manifestFingerprint: string;
}
export declare function matchesRegionUpdatePreview(manifest: unknown, sourceUrl: string,
  installedVersion: string, expected?: RegionUpdatePreview): boolean;
