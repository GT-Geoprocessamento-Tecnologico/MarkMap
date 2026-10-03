import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type ManifestIcon = {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
};

type WebManifest = {
  name: string;
  short_name: string;
  id: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: ManifestIcon[];
};

const publicDir = resolve(process.cwd(), "public");
const manifest = JSON.parse(
  readFileSync(resolve(publicDir, "manifest.json"), "utf8"),
) as WebManifest;
const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

const pngDimensions = (file: string): { width: number; height: number } => {
  const bytes = readFileSync(file);
  expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
};

describe("PWA installability contract", () => {
  it("declares a standalone manifest linked from the application shell", () => {
    expect(manifest.name.length).toBeGreaterThan(0);
    expect(manifest.short_name).toBe("GeoNexo");
    expect(manifest.id).toBe("./");
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(indexHtml).toContain('rel="manifest" href="/manifest.json"');
    expect(indexHtml).toContain('rel="apple-touch-icon"');
  });

  it("ships required regular and maskable PNG icons with declared dimensions", () => {
    for (const [size, purpose] of [
      [192, "any"],
      [512, "any"],
      [192, "maskable"],
      [512, "maskable"],
    ] as const) {
      const icon = manifest.icons.find(
        (candidate) =>
          candidate.sizes === `${size}x${size}` &&
          (candidate.purpose ?? "any") === purpose,
      );
      expect(icon, `missing ${purpose} ${size}x${size} icon`).toBeDefined();
      const file = resolve(publicDir, icon!.src.replace(/^\//, ""));
      expect(existsSync(file), icon!.src).toBe(true);
      expect(icon!.type).toBe("image/png");
      expect(pngDimensions(file)).toEqual({ width: size, height: size });
    }
  });

  it("keeps browser zoom available for accessibility", () => {
    expect(indexHtml).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(indexHtml).not.toMatch(/maximum-scale\s*=\s*1/i);
  });
});
