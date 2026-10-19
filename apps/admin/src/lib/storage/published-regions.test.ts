import { readFile } from "node:fs/promises";
import { URL as NodeURL } from "node:url";
import { describe, expect, it } from "vitest";
import { offlineMapPackageManifestSchema } from "@geonexo/contracts";
import { validateOfflinePackage } from "@geonexo/maps/offline/package";
import { parsePublicRegionCatalog } from "./public-region-catalog";

const publicRoot = new NodeURL("../../../public/", import.meta.url);

describe("published regional assets", () => {
  it("exposes Araguaína through the existing catalog with complete, verified local assets", async () => {
    const catalog = parsePublicRegionCatalog(JSON.parse(await readFile(new NodeURL("maps/catalog.json", publicRoot), "utf8")));
    const region = catalog.find((entry) => entry.id === "br-araguaina");
    expect(region).toBeDefined();
    const url = new NodeURL(region!.manifestUrl);
    expect(url.origin).toBe("https://appmarkmap.mtsferreira.dev");
    const manifestFile = new NodeURL(`.${url.pathname}`, publicRoot);
    const manifest = offlineMapPackageManifestSchema.parse(JSON.parse(await readFile(manifestFile, "utf8")));
    expect(region).toMatchObject({ id: manifest.id, bounds: manifest.bounds, sizeBytes: manifest.totalBytes });
    expect(manifest.totalBytes).toBeLessThanOrEqual(10 * 1024 * 1024);
    const refs = [{ path: "package.pmtiles", blob: manifest.archive }, manifest.style, ...manifest.glyphs, ...manifest.sprites];
    const assets = new Map<string, Uint8Array>();
    for (const ref of refs) assets.set(ref.path, Uint8Array.from(await readFile(new NodeURL(ref.path, manifestFile))));
    expect(await validateOfflinePackage(manifest, assets)).toMatchObject({ ok: true });
  });
});
