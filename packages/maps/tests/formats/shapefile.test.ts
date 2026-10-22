import { describe, it, expect } from "vitest";
import { parseShapefileZip } from "../../src/formats/shapefile.js";

describe("Shapefile Parser", () => {
  it("rejects zip files exceeding 25MB safety limit", async () => {
    const hugeBuffer = new ArrayBuffer(26 * 1024 * 1024);
    await expect(parseShapefileZip(hugeBuffer)).rejects.toThrow("Dataset exceeds maximum allowed size of 25MB");
  });
});
