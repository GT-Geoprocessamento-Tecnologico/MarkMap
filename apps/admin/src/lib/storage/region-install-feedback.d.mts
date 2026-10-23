export type RegionFailureKind =
  | "cancel"
  | "quota"
  | "network"
  | "version"
  | "busy"
  | "integrity"
  | "storage"
  | "error";
export declare function isRegionalQuotaError(error: unknown): boolean;
export declare function describeRegionInstallError(code: string): {
  kind: RegionFailureKind;
  title: string;
  message: string;
  retryable: boolean;
};
