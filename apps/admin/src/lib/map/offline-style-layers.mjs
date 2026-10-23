/** Restore app-owned overlay layers individually after a style replacement.
 * Checking only the source misses partial failures where one layer was omitted.
 */
export function ensureOfflineSourceLayers(map, sourceId, source, layers) {
  if (
    !map ||
    typeof map.getSource !== "function" ||
    typeof map.addSource !== "function" ||
    typeof map.getLayer !== "function" ||
    typeof map.addLayer !== "function" ||
    typeof sourceId !== "string" ||
    !sourceId ||
    !Array.isArray(layers)
  ) {
    throw new TypeError("Expected MapLibre source/layer operations");
  }
  let sourceAdded = false;
  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, source);
    sourceAdded = true;
  }
  let layersAdded = 0;
  for (const layer of layers) {
    if (!layer || typeof layer.id !== "string" || !layer.id)
      throw new TypeError("Invalid overlay layer");
    if (!map.getLayer(layer.id)) {
      map.addLayer(layer);
      layersAdded++;
    }
  }
  return { sourceAdded, layersAdded };
}
