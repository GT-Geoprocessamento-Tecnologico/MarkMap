import { readFile } from "node:fs/promises";
import { URL as NodeURL } from "node:url";
import { describe, expect, it } from "vitest";
import { offlineMapPackageManifestSchema } from "@markmap/contracts";
import { validateOfflinePackage } from "@markmap/maps/offline/package";
import { parsePublicRegionCatalog } from "./public-region-catalog";

const publicRoot = new NodeURL("../../../public/", import.meta.url);

describe("published regional assets", () => {
  it("exposes Araguaína through the existing catalog with complete, verified local assets", async () => {
    const catalog = parsePublicRegionCatalog(
      JSON.parse(
        await readFile(new NodeURL("maps/catalog.json", publicRoot), "utf8"),
      ),
    );
    const region = catalog.find((entry) => entry.id === "br-araguaina");
    expect(region).toBeDefined();
    const url = new NodeURL(region!.manifestUrl);
    expect(url.origin).toBe("https://appmarkmap.mtsferreira.dev");
    const manifestFile = new NodeURL(`.${url.pathname}`, publicRoot);
    const manifest = offlineMapPackageManifestSchema.parse(
      JSON.parse(await readFile(manifestFile, "utf8")),
    );
    expect(region).toMatchObject({
      id: manifest.id,
      bounds: manifest.bounds,
      sizeBytes: manifest.totalBytes,
    });
    expect(manifest.archive.sha256).toBe(
      "f0e0c9c8290a7000a563a6b27a95001b4225e9beec493377e6557d48581a807d",
    );
    expect(manifest.totalBytes).toBeLessThanOrEqual(10 * 1024 * 1024);
    const refs = [
      { path: "package.pmtiles", blob: manifest.archive },
      manifest.style,
      ...manifest.glyphs,
      ...manifest.sprites,
    ];
    const assets = new Map<string, Uint8Array>();
    for (const ref of refs)
      assets.set(
        ref.path,
        Uint8Array.from(await readFile(new NodeURL(ref.path, manifestFile))),
      );
    expect(await validateOfflinePackage(manifest, assets)).toMatchObject({
      ok: true,
    });
  });

  it("offers real state and city packages with matching geography, manifests and verified payloads", async () => {
    const raw = await readFile(new NodeURL("maps/catalog.json", publicRoot));
    expect(raw.byteLength).toBeLessThanOrEqual(64 * 1024);
    const catalog = parsePublicRegionCatalog(JSON.parse(raw.toString("utf8")));
    const metadata = await readFile(
      new NodeURL("maps/locations.json", publicRoot),
    );
    expect(metadata.byteLength).toBeLessThanOrEqual(64 * 1024);
    const index = JSON.parse(metadata.toString("utf8")) as {
      version: number;
      locations: {
        regionId: string;
        stateCode: string;
        stateName: string;
        kind: "state" | "city";
        cityName?: string;
      }[];
    };
    expect(index.version).toBe(1);
    expect(catalog.length).toBeGreaterThanOrEqual(55);
    expect(index.locations).toHaveLength(catalog.length);
    expect(
      new Set(index.locations.map((location) => location.regionId)).size,
    ).toBe(catalog.length);
    const stateCodes = [
      "AC",
      "AL",
      "AM",
      "AP",
      "BA",
      "CE",
      "DF",
      "ES",
      "GO",
      "MA",
      "MG",
      "MS",
      "MT",
      "PA",
      "PB",
      "PE",
      "PI",
      "PR",
      "RJ",
      "RN",
      "RO",
      "RR",
      "RS",
      "SC",
      "SE",
      "SP",
      "TO",
    ];
    expect(
      index.locations
        .filter((location) => location.kind === "state")
        .map((location) => location.stateCode)
        .sort(),
    ).toEqual(stateCodes);
    for (const stateCode of stateCodes) {
      expect(
        index.locations.some(
          (location) =>
            location.stateCode === stateCode &&
            location.kind === "city" &&
            location.cityName,
        ),
      ).toBe(true);
    }
    for (const region of catalog) {
      const location = index.locations.find(
        (item) => item.regionId === region.id,
      );
      expect(location, region.id).toBeDefined();
      expect(location!.stateName.trim().length).toBeGreaterThan(1);
      const url = new NodeURL(region.manifestUrl);
      expect(url.origin).toBe("https://appmarkmap.mtsferreira.dev");
      expect(url.pathname).toMatch(/^\/offline\/[a-z0-9-]+\/manifest\.json$/);
      const file = new NodeURL(`.${url.pathname}`, publicRoot);
      const manifest = offlineMapPackageManifestSchema.parse(
        JSON.parse(await readFile(file, "utf8")),
      );
      expect(region, region.id).toMatchObject({
        id: manifest.id,
        bounds: manifest.bounds,
        sizeBytes: manifest.totalBytes,
      });
      const assets = new Map<string, Uint8Array>();
      const refs = [
        { path: "package.pmtiles", blob: manifest.archive },
        manifest.style,
        ...manifest.glyphs,
        ...manifest.sprites,
      ];
      for (const ref of refs)
        assets.set(
          ref.path,
          Uint8Array.from(await readFile(new NodeURL(ref.path, file))),
        );
      expect(
        await validateOfflinePackage(manifest, assets),
        region.id,
      ).toMatchObject({ ok: true });
    }
  }, 60_000);
});
