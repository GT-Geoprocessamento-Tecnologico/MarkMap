import { describe, expect, it } from "vitest";
import { fitPdfToViewport } from "./pdf-fit";

describe("GeoPDF preview", () => {
  it("fits a wide original into a phone viewport without crop or stretch", () => {
    const size = fitPdfToViewport(3200, 2200, 360, 560);
    expect(size.width).toBeLessThanOrEqual(360);
    expect(size.height).toBeLessThanOrEqual(560);
    expect(size.width / size.height).toBeCloseTo(3200 / 2200);
  });
  it("fits tall plots by height, preserving proportional calibration", () => {
    const size = fitPdfToViewport(4000, 8000, 420, 630);
    expect(size.height).toBe(630);
    expect(size.width).toBe(315);
    expect(size.width / 4000).toBe(size.height / 8000);
  });
  it("does not upscale smaller PDFs", () => {
    expect(fitPdfToViewport(300, 200, 900, 700)).toEqual({
      width: 300,
      height: 200,
    });
  });
  it("handles invalid dimensions defensively", () => {
    expect(fitPdfToViewport(0, 100, 200, 200)).toEqual({ width: 1, height: 1 });
  });
});
