export interface OfflineStyleMapEvents {
  loaded(): boolean;
  once(type: 'render', callback: () => void): unknown;
  off(type: 'render', callback: () => void): unknown;
}
export declare function createOfflineStyleLifecycle(options: {
  map: OfflineStyleMapEvents;
  isActive: () => boolean;
  onHydrate: () => void;
  onReady: () => void;
  onError: (error: unknown) => void;
  onStyleReset?: () => void;
}): {
  styleLoad(): boolean;
  sourceData(event: { sourceId?: string; isSourceLoaded?: boolean }): boolean;
  contextLost(): void;
  contextRestored(): void;
  dispose(): void;
};
