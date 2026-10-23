import { describe, it, expect } from "vitest";
import { convertDistance, convertArea, convertAngle } from "../../src/units/survey.js";

describe("Surveying Units & Brazilian Alqueires", () => {
  it("converts meters to US Survey Feet, Chains, and Rods accurately", () => {
    expect(convertDistance(100, "meters", "survey_feet")).toBeCloseTo(328.0833, 3);
    expect(convertDistance(201.168, "meters", "chains")).toBeCloseTo(10.0, 3);
    expect(convertDistance(5.0292, "meters", "rods")).toBeCloseTo(1.0, 3);
  });

  it("converts square meters to Brazilian Alqueire units and hectares", () => {
    expect(convertArea(24200, "alqueire_paulista")).toBe(1.0);
    expect(convertArea(48400, "alqueire_mineiro")).toBe(1.0);
    expect(convertArea(96800, "alqueire_baiano")).toBe(1.0);
    expect(convertArea(27225, "alqueire_norte")).toBe(1.0);
    expect(convertArea(10000, "hectares")).toBe(1.0);
  });

  it("converts degrees to Gon and Mils", () => {
    expect(convertAngle(360, "degrees", "gon")).toBeCloseTo(400.0, 3);
    expect(convertAngle(180, "degrees", "mils")).toBeCloseTo(3200.0, 3);
  });

  it("validates input ranges", () => {
    expect(() => convertDistance(NaN, "meters", "kilometers")).toThrow(RangeError);
    expect(() => convertArea(-100, "hectares")).toThrow(RangeError);
    expect(() => convertAngle(Infinity, "degrees", "radians")).toThrow(RangeError);
  });
});
