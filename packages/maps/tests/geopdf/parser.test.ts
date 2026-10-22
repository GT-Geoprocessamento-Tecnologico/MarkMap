import { describe, it, expect } from "vitest";
import { parseGeoPdfMetadata } from "../../src/geopdf/parser.js";

describe("GeoPDF Parser", () => {
  it("rejects byte-pattern lookalikes instead of inventing GeoPDF metadata", async () => {
    const mockPdfHeader = new TextEncoder().encode(
      "%PDF-1.6\n1 0 obj\n<< /Type /Viewport /BBox [0 0 600 800] /Measure << /Subtype /GEO /GCS << /Type /CRS /EPSG 4326 >> >> >>\nendobj\n"
    );
    await expect(parseGeoPdfMetadata(mockPdfHeader.buffer)).rejects.toThrow();
  });
});
