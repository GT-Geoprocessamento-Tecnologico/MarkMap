export type RegionInstallLockResult<T> =
  | { acquired: true; supported: boolean; result: T }
  | { acquired: false; supported: true };

export declare function withRegionInstallLock<T>(
  regionId: string,
  action: () => Promise<T>,
  lockManager?: LockManager,
): Promise<RegionInstallLockResult<T>>;
