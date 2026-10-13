import { describe, it, expect } from "vitest";
import { sampleDem, sampleDemBilinear } from "../../src/elevation/dem.js";
import { computeElevationProfile, haversineDistanceKm } from "../../src/elevation/profile.js";
import { generateContours } from "../../src/elevation/contours.js";
import type { DemMetadata } from "@geonexo/contracts";

const metadata: DemMetadata = {
  source: "srtm",
  resolutionMeters: 30,
  verticalDatum: "EGM96",
  license: "Public Domain",
  attribution: "NASA SRTM",
  bounds: [-46.7, -23.6, -46.5, -23.4],
  noDataValue: -32768,
  dataType: "int16",
  width: 100,
  height: 100,
};

function makeDem(width: number, height: number): Int16Array {
  const dem = new Int16Array(width * height);
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      dem[r * width + c] = Math.floor(100 + r * 2 + c * 3);
    }
  }
  return dem;
}

describe("sampleDem", () => {
  it("returns elevation for in-bounds coordinates", () => {
    const dem = makeDem(100, 100);
    const value = sampleDem(dem, metadata, -46.6, -23.5);
    expect(value).not.toBeNull();
    expect(value).toBeGreaterThanOrEqual(100);
  });

  it("returns null for out-of-bounds coordinates", () => {
    const dem = makeDem(100, 100);
    expect(sampleDem(dem, metadata, -50, -23.5)).toBeNull();
    expect(sampleDem(dem, metadata, -46.6, -30)).toBeNull();
  });

  it("returns null for noDataValue", () => {
    const dem = new Int16Array(100 * 100).fill(-32768);
    expect(sampleDem(dem, metadata, -46.6, -23.5)).toBeNull();
  });
});

describe("sampleDemBilinear", () => {
  it("returns smoothed value", () => {
    const dem = makeDem(100, 100);
    const value = sampleDemBilinear(dem, metadata, -46.6, -23.5);
    expect(value).not.toBeNull();
    expect(typeof value).toBe("number");
  });

  it("returns null for out-of-bounds", () => {
    const dem = makeDem(100, 100);
    expect(sampleDemBilinear(dem, metadata, -50, -23.5)).toBeNull();
  });
});

describe("computeElevationProfile", () => {
  it("computes profile for a path", () => {
    const dem = makeDem(100, 100);
    const path: Array<[number, number]> = [
      [-46.65, -23.55],
      [-46.6, -23.5],
      [-46.55, -23.45],
    ];

    const profile = computeElevationProfile(path, dem, metadata);
    expect(profile.points).toHaveLength(3);
    expect(profile.totalDistance).toBeGreaterThan(0);
    expect(profile.gain).toBeGreaterThanOrEqual(0);
    expect(profile.loss).toBeGreaterThanOrEqual(0);
    expect(profile.minElevation).toBeLessThanOrEqual(profile.maxElevation);
  });

  it("handles single-point path", () => {
    const dem = makeDem(100, 100);
    const path: Array<[number, number]> = [[-46.6, -23.5]];
    const profile = computeElevationProfile(path, dem, metadata);
    expect(profile.points).toHaveLength(1);
    expect(profile.totalDistance).toBe(0);
  });
});

describe("haversineDistanceKm", () => {
  it("returns 0 for same point", () => {
    expect(haversineDistanceKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });

  it("computes positive distance", () => {
    expect(haversineDistanceKm(-23.55, -46.63, -23.56, -46.64)).toBeGreaterThan(0);
  });
});

describe("generateContours", () => {
  it("generates contours at specified interval", () => {
    const dem = makeDem(100, 100);
    const contours = generateContours(dem, metadata, 50, 250);
    expect(contours.contours.length).toBeGreaterThan(0);
    expect(contours.interval).toBe(50);
    expect(contours.majorInterval).toBe(250);
    expect(contours.minElevation).toBeLessThanOrEqual(contours.maxElevation);
  });

  it("marks major contours correctly", () => {
    const dem = makeDem(100, 100);
    const contours = generateContours(dem, metadata, 50, 250);
    const majors = contours.contours.filter((c: { isMajor: boolean }) => c.isMajor);
    const minors = contours.contours.filter((c: { isMajor: boolean }) => !c.isMajor);
    expect(majors.length + minors.length).toBe(contours.contours.length);
    for (const m of majors) {
      expect(m.elevation % 250).toBe(0);
    }
  });

  it("returns empty for flat terrain below interval", () => {
    const dem = new Int16Array(100 * 100).fill(100);
    const contours = generateContours(dem, metadata, 200, 1000);
    expect(contours.contours).toHaveLength(0);
  });
});
