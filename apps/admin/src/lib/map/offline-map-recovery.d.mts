export interface MapForegroundRecoveryState {
  hasError: boolean;
  hasLocalContext: boolean;
  visible?: boolean;
}
export declare function createOfflineMapRecovery(requestRetry: () => void): {
  onForeground(state: MapForegroundRecoveryState): boolean;
  retryManually(): boolean;
  dispose(): void;
};
export declare function resolveOfflineBasemap(options: {
  regionId: string | null;
  revision: number;
  neutralFor: string | null;
  geoPdfId?: string | null;
}): { regionId: string | null; neutralActive: boolean };
