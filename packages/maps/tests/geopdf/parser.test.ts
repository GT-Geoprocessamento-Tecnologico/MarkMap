import { describe, it, expect } from "vitest";
import { parseGeoPdfMetadata } from "../../src/geopdf/parser.js";

describe("GeoPDF Parser", () => {
  it("extracts ISO 32000 LGIDict / Measure dictionary metadata", async () => {
    const mockPdfHeader = new TextEncoder().encode(
      "%PDF-1.6\n1 0 obj\n<< /Type /Viewport /BBox [0 0 600 800] /Measure << /Subtype /GEO /GCS << /Type /CRS /EPSG 4326 >> >> >>\nendobj\n"
    );
    const metadata = await parseGeoPdfMetadata(mockPdfHeader.buffer);
    expect(metadata.isGeoreferenced).toBe(true);
    expect(metadata.epsgCode).toBe(4326);
    expect(metadata.bbox).toEqual([0, 0, 600, 800]);
  });
});
