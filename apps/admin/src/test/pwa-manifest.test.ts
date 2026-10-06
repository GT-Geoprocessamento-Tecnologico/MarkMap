import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface ManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

interface PwaManifest {
  id: string;
  start_url: string;
  scope: string;
  display: string;
  prefer_related_applications?: boolean;
  icons: ManifestIcon[];
}

describe("PWA manifest installability", () => {
  const manifest = JSON.parse(
    readFileSync(resolve(process.cwd(), "public/manifest.json"), "utf8"),
  ) as PwaManifest;

  it("uses a stable root identity and standalone launch scope", () => {
    expect(manifest.id).toBe("/");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.prefer_related_applications).toBe(false);
  });

  it("declares the required install icons", () => {
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icons/icon-192x192.png",
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: "/icons/icon-512x512.png",
          sizes: "512x512",
          type: "image/png",
        }),
      ]),
    );
  });
});
