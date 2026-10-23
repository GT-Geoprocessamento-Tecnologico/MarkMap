import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "../src/distance.js";

describe("haversineDistanceKm", () => {
  it("calculates distance correctly", () => {
    expect(haversineDistanceKm(-23.55, -46.63, -23.55, -46.63)).toBe(0);
  });
  it("calculates a non-zero distance", () => {
    expect(haversineDistanceKm(-23.55, -46.63, -23.56, -46.64)).toBeGreaterThan(0);
  });
});
