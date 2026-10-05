import { describe, expect, it } from "vitest";
import { siteConfig } from "./site-config";

describe("MarkMap distribution config", () => {
  it("keeps public distribution disabled until release", () => {
    expect(siteConfig.distribution).toEqual({ web: false, android: false, ios: false });
    expect(siteConfig.appWebUrl).toBeNull();
    expect(siteConfig.androidDownloadUrl).toBeNull();
    expect(siteConfig.iosStoreUrl).toBeNull();
  });
});
