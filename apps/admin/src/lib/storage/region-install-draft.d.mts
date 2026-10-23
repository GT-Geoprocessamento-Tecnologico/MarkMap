export declare function normalizePublicRegionManifestUrl(
  value: unknown,
): string | null;
export declare function getRegionInstallDraftUrl(
  storage?: Storage,
): string | null;
export declare function rememberRegionInstallDraftUrl(
  value: string,
  storage?: Storage,
): boolean;
export declare function clearRegionInstallDraftUrl(storage?: Storage): void;
