import { describe, it, expect } from "vitest";

import { GeometrySchema } from "../geometry-helpers.js";

describe("GeometrySchema strict validation", () => {
  it("accepts a valid Point geometry", () => {
    const valid = { type: "Point", coordinates: [0, 0] } as const;
    expect(() => GeometrySchema.parse(valid)).not.toThrow();
  });

  it("rejects a Point with non‑numeric coordinates", () => {
    const invalid: unknown = { type: "Point", coordinates: ["a", 0] };
    expect(() => GeometrySchema.parse(invalid)).toThrow();
  });

  it("rejects a Polygon with insufficient points", () => {
    const invalid = {
      type: "Polygon",
      coordinates: [
        [0, 0],
        [1, 1],
        [2, 2],
      ],
    } satisfies Record<string, unknown>; // needs at least 4
    expect(() => GeometrySchema.parse(invalid)).toThrow();
  });
});
