import { describe, it, expect } from "vitest";
import { createGeoPdfLayerConfig } from "../../src/geopdf/layer.js";

describe("GeoPDF Layer Builder", () => {
  it("generates MapLibre raster source and layer spec with georeferenced coordinates", () => {
    const config = createGeoPdfLayerConfig("geopdf-1", "blob:http://localhost/raster", [
      [-48.2, -7.2],
      [-48.1, -7.2],
      [-48.1, -7.3],
      [-48.2, -7.3],
    ]);
    expect(config.source.type).toBe("image");
    expect(config.source.coordinates).toHaveLength(4);
    expect(config.layer.type).toBe("raster");
  });
});
