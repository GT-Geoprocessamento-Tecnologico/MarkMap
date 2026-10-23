import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { siteConfig } from "./site-config";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("canonical installed app launch contract", () => {
  it("never installs the marketing site itself", () => {
    const html = read("index.html");
    const boot = read("src/main.tsx");
    expect(html).not.toMatch(/rel="manifest"/);
    expect(boot).not.toMatch(/serviceWorker\.register/);
    expect(boot).toContain("registration.unregister()");
  });
  it("offers a no-JavaScript link to the dedicated application origin", () => {
    const button = read("src/components/InstallAppButton.tsx");
    expect(button).toContain("href={siteConfig.appDownloadUrl}");
    expect(siteConfig.appDownloadUrl).toMatch(
      /^https:\/\/appmarkmap\.mtsferreira\.dev\//,
    );
  });
  it("redirects every legacy /app entry to the canonical origin", () => {
    const config = JSON.parse(read("vercel.json")) as {
      redirects: Array<{ source: string; destination: string }>;
      rewrites: Array<{ source: string; destination: string }>;
    };
    for (const path of ["/app", "/app/"]) {
      expect(config.redirects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: path,
            destination: "https://appmarkmap.mtsferreira.dev/",
          }),
        ]),
      );
    }
    expect(config.redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/app/:path*",
          destination: "https://appmarkmap.mtsferreira.dev/:path*",
        }),
      ]),
    );
    expect(config.rewrites.some((item) => item.source === "/app/:path*")).toBe(
      false,
    );
  });
  it("keeps a migration worker for already-installed marketing PWAs", () => {
    const source = read("public/sw.js");
    expect(source).toContain("Response.redirect(destination.href, 302)");
    expect(source).not.toContain("cache.addAll");
    expect(source).not.toContain("cache.put(");
  });
});
