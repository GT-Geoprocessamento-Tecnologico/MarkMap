export declare function notifyRegionCatalogChanged(
  regionId: string,
  Channel?: typeof BroadcastChannel,
): boolean;
export declare function subscribeRegionCatalogChanges(
  callback: (regionId: string) => void,
  Channel?: typeof BroadcastChannel,
): () => void;
