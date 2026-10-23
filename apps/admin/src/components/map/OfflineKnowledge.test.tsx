import { describe, expect, it } from "vitest";
import { hasOfflineKnowledge } from "./OfflineKnowledge";

describe("offline knowledge capability", () => {
  it("does not advertise content for geometry-only manifests", () => {
    expect(
      hasOfflineKnowledge({ wikipediaPack: undefined, transitPack: undefined }),
    ).toBe(false);
  });
  it("recognizes a manifest with an optional content pack", () => {
    expect(
      hasOfflineKnowledge({
        wikipediaPack: {} as never,
        transitPack: undefined,
      }),
    ).toBe(true);
  });
});
