import { describe, expect, it } from "vitest";
import { siteConfig } from "./site-config";

describe("MarkMap distribution config", () => {
  it("points the public download flow to the production installable app", () => {
    expect(siteConfig.distribution).toEqual({ app: true });
    expect(siteConfig.appDownloadUrl).toBe("/app/");
    expect(siteConfig.compatibility).toEqual(["Android", "iOS"]);
  });
});
