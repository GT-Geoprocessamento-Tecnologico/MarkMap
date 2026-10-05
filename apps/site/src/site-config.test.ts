import { describe, expect, it } from "vitest";
import { siteConfig } from "./site-config";

describe("MarkMap distribution config", () => {
  it("keeps public app download disabled until release", () => {
    expect(siteConfig.distribution).toEqual({ app: false });
    expect(siteConfig.appDownloadUrl).toBeNull();
    expect(siteConfig.compatibility).toEqual(["Android", "iOS"]);
  });
});
