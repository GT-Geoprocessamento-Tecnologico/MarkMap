import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error The build-only Node helper is intentionally outside the app TS project.
import {
  collectShellAssets,
  generateShellManifest,
} from "../../scripts/generate-shell-manifest.mjs";

describe("production shell manifest", () => {
  it("includes hashed app assets and excludes APIs, maps, and arbitrary files", async () => {
    const root = await mkdtemp(join(tmpdir(), "geonexo-shell-"));
    await mkdir(join(root, "assets"), { recursive: true });
    await mkdir(join(root, "api"), { recursive: true });
    await mkdir(join(root, "maps"), { recursive: true });
    await mkdir(join(root, "fonts"), { recursive: true });
    await mkdir(join(root, "icons"), { recursive: true });
    for (const file of [
      "index.html",
      "manifest.json",
      "version.json",
      "assets/index-a1b2c3d4.js",
      "assets/pdf-worker-a1b2c3d4.mjs",
      "assets/index-a1b2c3d4.css",
      "fonts/ui.woff2",
      "icons/icon-192x192.png",
      "maps/region.pmtiles",
      "api/health.json",
      "debug.txt",
    ]) {
      await writeFile(join(root, file), "fixture");
    }
    const assets = await collectShellAssets(root);
    expect(assets).toEqual([
      "/assets/index-a1b2c3d4.css",
      "/assets/index-a1b2c3d4.js",
      "/assets/pdf-worker-a1b2c3d4.mjs",
      "/fonts/ui.woff2",
      "/icons/icon-192x192.png",
      "/index.html",
      "/manifest.json",
      "/version.json",
    ]);
    await generateShellManifest(root);
    expect(
      JSON.parse(await readFile(join(root, "shell-manifest.json"), "utf8"))
        .assets,
    ).toEqual(assets);
  });
});
