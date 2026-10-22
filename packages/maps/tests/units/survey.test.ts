import { describe, it, expect } from "vitest";
import { convertDistance, convertAngle } from "../../src/units/survey.js";

describe("Surveying Units", () => {
  it("converts meters to US Survey Feet, Chains, and Rods accurately", () => {
    expect(convertDistance(100, "meters", "survey_feet")).toBeCloseTo(328.0833, 3);
    expect(convertDistance(201.168, "meters", "chains")).toBeCloseTo(10.0, 3);
    expect(convertDistance(5.0292, "meters", "rods")).toBeCloseTo(1.0, 3);
  });

  it("converts degrees to Gon and Mils", () => {
    expect(convertAngle(360, "degrees", "gon")).toBeCloseTo(400.0, 3);
    expect(convertAngle(180, "degrees", "mils")).toBeCloseTo(3200.0, 3);
  });
});
