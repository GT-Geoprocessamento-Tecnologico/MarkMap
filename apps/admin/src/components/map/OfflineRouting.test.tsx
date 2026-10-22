import { describe, expect, it } from "vitest";
import { hasOfflineRouting } from "./OfflineRouting";

describe("offline routing capability", () => {
  it("does not enable origin and destination controls without a graph", () => {
    expect(hasOfflineRouting({ routingGraph: undefined })).toBe(false);
  });
  it("recognizes a declared routing graph", () => {
    expect(hasOfflineRouting({ routingGraph: {} as never })).toBe(true);
  });
});
