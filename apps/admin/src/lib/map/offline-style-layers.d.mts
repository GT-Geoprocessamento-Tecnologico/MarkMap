export declare function ensureOfflineSourceLayers<S, L extends { id: string }>(
  map: {
    getSource(id: string): unknown;
    addSource(id: string, source: S): unknown;
    getLayer(id: string): unknown;
    addLayer(layer: L): unknown;
  },
  sourceId: string,
  source: S,
  layers: readonly L[],
): { sourceAdded: boolean; layersAdded: number };
