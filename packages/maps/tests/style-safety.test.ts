import { describe, expect, it } from "vitest";
import {
  sanitizeKnownBasemapFilter,
  sanitizeNullableNumericComparisons,
  shouldProvideMissingStyleImage,
} from "../src/style-safety.js";

describe("basemap style safety", () => {
  it("guards nullable numeric comparisons used by road shield filters", () => {
    const filter = [
      "all",
      ["has", "ref"],
      ["<=", ["get", "ref_length"], 6],
    ];

    expect(sanitizeNullableNumericComparisons(filter)).toEqual([
      "all",
      ["has", "ref"],
      [
        "case",
        ["!=", ["get", "ref_length"], null],
        ["<=", ["to-number", ["get", "ref_length"]], 6],
        false,
      ],
    ]);
  });

  it("only sanitizes the known noisy basemap layers", () => {
    const filter = [">=", ["get", "ref_length"], 2];

    expect(
      sanitizeKnownBasemapFilter("highway-shield-non-us", filter),
    ).not.toEqual(filter);
    expect(sanitizeKnownBasemapFilter("custom-layer", filter)).toBe(filter);
  });

  it("provides transparent fallbacks only for known missing sprite images", () => {
    expect(shouldProvideMissingStyleImage("sports_centre")).toBe(true);
    expect(shouldProvideMissingStyleImage("office")).toBe(true);
    expect(shouldProvideMissingStyleImage("custom-marker")).toBe(false);
  });
});
