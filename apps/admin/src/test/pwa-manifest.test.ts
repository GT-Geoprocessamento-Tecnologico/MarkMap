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
  launch_handler?: {
    client_mode?: string;
  };
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
    expect(manifest.launch_handler?.client_mode).toBe("navigate-existing");
  });

  it("declares the required install icons", () => {
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: expect.stringMatching(/^\/icons\/icon-192x192-[0-9a-f]{8}\.png$/),
          sizes: "192x192",
          type: "image/png",
        }),
        expect.objectContaining({
          src: expect.stringMatching(/^\/icons\/icon-512x512-[0-9a-f]{8}\.png$/),
          sizes: "512x512",
          type: "image/png",
        }),
      ]),
    );
  });

  it("ships readable PNGs matching every declared install-icon size", () => {
    for (const icon of manifest.icons) {
      expect(icon.src).toMatch(/^\/icons\/[a-z0-9-]+\.png$/);
      const png = readFileSync(resolve(process.cwd(), "public", icon.src.slice(1)));
      expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
      expect(png[25], "regular icons keep alpha; maskable icons use an opaque platform background").toBe(icon.purpose === "maskable" ? 2 : 6);
    }
  });
});
