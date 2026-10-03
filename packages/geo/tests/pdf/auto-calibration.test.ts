import { describe, expect, it } from "vitest";

import {
  autoCalibrateFromText,
  pageToLonLat,
  type PdfTextSample,
} from "../../src/pdf/index.js";

const geometry = {
  pageIndex: 0,
  cropBox: [0, 0, 800, 650] as [number, number, number, number],
  rotation: 0 as const,
};

const geographicSamples: PdfTextSample[] = [
  { text: "48°24′ W", page: [100, 20] },
  { text: "48°18′ W", page: [300, 18] },
  { text: "48°12′ W", page: [500, 21] },
  { text: "48°06′ W", page: [700, 19] },
  { text: "7°24′ S", page: [18, 100] },
  { text: "7°18′ S", page: [20, 250] },
  { text: "7°12′ S", page: [19, 400] },
  { text: "7°06′ S", page: [21, 550] },
  { text: "Mapa de campo", page: [400, 325] },
];

describe("automatic PDF grid calibration", () => {
  it("accepts a consistent geographic border grid with independent controls", () => {
    const result = autoCalibrateFromText(geographicSamples, geometry);
    expect(result.method).toBe("geographic-grid");
    expect(result.reference).not.toBeNull();
    expect(result.confidence).toBeGreaterThanOrEqual(0.88);
    expect(result.reference?.residual.independentCheck).toBe(true);

    const center = pageToLonLat(result.reference!, [500, 400]);
    expect(center[0]).toBeCloseTo(-48.2, 5);
    expect(center[1]).toBeCloseTo(-7.2, 5);
  });

  it("rejects a geographic grid whose labels are not linearly consistent", () => {
    const noisy = geographicSamples.map((sample) =>
      sample.text === "48°18′ W"
        ? { ...sample, page: [610, sample.page[1]] as [number, number] }
        : sample,
    );
    const result = autoCalibrateFromText(noisy, geometry);
    expect(result.method).toBe("geographic-grid");
    expect(result.reference).toBeNull();
    expect(result.confidence).toBeLessThan(0.88);
  });

  it("accepts a SIRGAS-style UTM 22S border grid and stores WGS84 controls", () => {
    const samples: PdfTextSample[] = [
      { text: "SIRGAS 2000 / UTM 22S", page: [400, 620] },
      { text: "700 000", page: [100, 20] },
      { text: "710 000", page: [300, 20] },
      { text: "720 000", page: [500, 20] },
      { text: "730 000", page: [700, 20] },
      { text: "9 180 000", page: [20, 100] },
      { text: "9 190 000", page: [20, 250] },
      { text: "9 200 000", page: [20, 400] },
      { text: "9 210 000", page: [20, 550] },
    ];
    const result = autoCalibrateFromText(samples, geometry);
    expect(result.method).toBe("utm-grid");
    expect(result.reference).not.toBeNull();
    expect(result.reference?.sourceCrs).toBe("EPSG:4326");
    expect(result.confidence).toBeGreaterThanOrEqual(0.88);

    const center = pageToLonLat(result.reference!, [400, 325]);
    expect(center[0]).toBeGreaterThan(-75);
    expect(center[0]).toBeLessThan(-30);
    expect(center[1]).toBeGreaterThan(-35);
    expect(center[1]).toBeLessThan(6);
  });

  it("does not guess calibration from only two labels per axis", () => {
    const result = autoCalibrateFromText(
      geographicSamples.filter((sample) =>
        ["48°24′ W", "48°06′ W", "7°24′ S", "7°06′ S"].includes(
          sample.text,
        ),
      ),
      geometry,
    );
    expect(result.reference).toBeNull();
    expect(result.reason).toMatch(/três rótulos/i);
  });
});
