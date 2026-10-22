import { describe, expect, it } from "vitest";
import { georeferencedRasterWindow } from "./geopdf-window";

const reference = {
  cropBox: [0, 0, 1000, 800] as [number, number, number, number],
  neatline: [[200, 100], [800, 100], [800, 600], [200, 600]] as [number, number][],
};

describe("georeferenced PDF image window", () => {
  it("removes letterhead and margins outside the actual map", () => {
    const viewport = { convertToViewportPoint: (x: number, y: number) => [x, 800 - y] };
    expect(georeferencedRasterWindow(reference, viewport, 1000, 800))
      .toEqual({ x: 200, y: 200, width: 600, height: 500 });
  });

  it("keeps orientation after a 90-degree rotation and scale", () => {
    const viewport = { convertToViewportPoint: (x: number, y: number) => [2 * y, 2 * (1000 - x)] };
    expect(georeferencedRasterWindow(reference, viewport, 1600, 2000))
      .toEqual({ x: 200, y: 400, width: 1000, height: 1200 });
  });

  it("preserves full-page manual calibrations", () => {
    const viewport = { convertToViewportPoint: (x: number, y: number) => [x, 800 - y] };
    expect(georeferencedRasterWindow({ ...reference, neatline: [] }, viewport, 1000, 800))
      .toEqual({ x: 0, y: 0, width: 1000, height: 800 });
  });

  it("rejects unusable spatial windows without guessing a position", () => {
    const viewport = { convertToViewportPoint: () => [Number.NaN, 0] };
    expect(() => georeferencedRasterWindow(reference, viewport, 1000, 800)).toThrow();
  });
});
