import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface SiteManifest {
  id: string;
  start_url: string;
  scope: string;
  display: string;
}

interface VercelConfig {
  redirects?: Array<{ source: string; destination: string }>;
  rewrites?: Array<{ source: string; destination: string }>;
}

describe("site app installation contract", () => {
  it("installs the app from the marketing origin and launches /app/", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(process.cwd(), "public/manifest.json"), "utf8"),
    ) as SiteManifest;

    expect(manifest.id).toBe("/app/");
    expect(manifest.start_url).toBe("/app/");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
  });

  it("serves the operational app under the same origin", () => {
    const config = JSON.parse(
      readFileSync(resolve(process.cwd(), "vercel.json"), "utf8"),
    ) as VercelConfig;

    expect(config.rewrites).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/app/:path*",
          destination: "https://appmarkmap.mtsferreira.dev/:path*",
        }),
      ]),
    );
  });
});
