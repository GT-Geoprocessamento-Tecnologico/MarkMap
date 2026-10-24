import { describe, expect, it } from "vitest";
import { siteConfig } from "./site-config";

describe("MarkMap distribution config", () => {
  it("routes every install CTA to the canonical operational PWA", () => {
    expect(siteConfig.distribution).toEqual({ app: true });
    expect(siteConfig.appDownloadUrl).toBe("https://appmarkmap.mtsferreira.dev/?install=1");
    expect(siteConfig.compatibility).toEqual(["Android", "iOS"]);
  });
});
