export interface GeoPdfLayerConfig {
  sourceId: string;
  layerId: string;
  source: {
    type: "image";
    url: string;
    coordinates: [[number, number], [number, number], [number, number], [number, number]];
  };
  layer: {
    id: string;
    type: "raster";
    source: string;
    paint?: Record<string, unknown>;
  };
}

export function createGeoPdfLayerConfig(
  id: string,
  imageUrl: string,
  corners: [[number, number], [number, number], [number, number], [number, number]]
): GeoPdfLayerConfig {
  const sourceId = `geopdf-src-${id}`;
  const layerId = `geopdf-layer-${id}`;
  return {
    sourceId,
    layerId,
    source: {
      type: "image",
      url: imageUrl,
      coordinates: corners,
    },
    layer: {
      id: layerId,
      type: "raster",
      source: sourceId,
      paint: {
        "raster-opacity": 0.85,
        "raster-fade-duration": 0,
      },
    },
  };
}
