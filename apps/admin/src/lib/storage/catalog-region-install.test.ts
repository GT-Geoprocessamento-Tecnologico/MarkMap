import { describe, expect, it, vi } from "vitest";
import { installCatalogRegion } from "./catalog-region-install";
import type { PublicRegion } from "./public-region-catalog";
import type { ResumableInstaller } from "./resumable-installer";

const region: PublicRegion = {
  id: "regiao-teste", label: "Região de teste", area: "Brasil",
  manifestUrl: "https://maps.example.org/test/manifest.json",
  bounds: [-49, -8, -47, -6], sizeBytes: 1024, attribution: "Dados licenciados",
};
const manifest = {
  id: region.id, version: "1.0.0", label: "Região de teste",
  bounds: region.bounds, minZoom: 0, maxZoom: 12,
  archive: { id: "00000000-0000-4000-8000-000000000001",
    sha256: "a".repeat(64), bytes: 1000, mediaType: "application/vnd.pmtiles" },
  style: { path: "style.json", blob: { id: "00000000-0000-4000-8000-000000000002",
    sha256: "b".repeat(64), bytes: 24, mediaType: "application/json" } },
  glyphs: [], sprites: [], attribution: "Dados de teste",
  createdAt: "2026-10-13T00:00:00.000Z",
  packageVersion: "1.0.0", osmDataDate: "2026-10-13T00:00:00.000Z",
  capabilities: ["basemap"],
  checksums: { archive: "a".repeat(64), glyphs: [], sprites: [] },
  totalBytes: region.sizeBytes,
  sources: { osm: "OpenStreetMap", attributions: [] },
  minimumCompatibleVersion: "0.2.0",
};
const fake = (overrides: Record<string, unknown> = {}) => ({
  checkResume: vi.fn(async () => ({ canResume: false, checkpoint: null })),
  startInstall: vi.fn(async () => ({ success: true,
    data: { installId: "test", status: "active" } })),
  ...overrides,
}) as unknown as ResumableInstaller;
const remote = (data: unknown = manifest) =>
  vi.fn(async () => new Response(JSON.stringify(data)));

describe("catalog download security and consent", () => {
  it("uses verified installation without user-supplied URLs", async () => {
    const installer = fake();
    const result = await installCatalogRegion(region, installer, {
      signal: new AbortController().signal, fetcher: remote() as typeof fetch,
    });
    expect(result.kind).toBe("installed");
    expect(installer.startInstall).toHaveBeenCalledWith(expect.objectContaining({
      packageId: region.id, baseUrl: "https://maps.example.org/test/",
      forceValidate: false, manifest: expect.objectContaining({ archivePath: "package.pmtiles" }),
    }));
  });
  it("rejects mismatched size, bounds and identity before writing", async () => {
    const installer = fake();
    for (const [bad, message] of [
      [{ ...manifest, id: "another-region" }, "não corresponde"],
      [{ ...manifest, totalBytes: 2048 }, "totalBytes"],
      [{ ...manifest, bounds: [-48, -8, -47, -6] }, "não corresponde"],
    ] as const) {
      await expect(installCatalogRegion(region, installer, {
        signal: new AbortController().signal, fetcher: remote(bad) as typeof fetch,
      })).rejects.toThrow(message);
    }
    expect(installer.startInstall).not.toHaveBeenCalled();
  });
  it("does not silently replace a saved download from another version", async () => {
    const installer = fake({ checkResume: vi.fn(async () => ({ needsConfirmation: true })) });
    const result = await installCatalogRegion(region, installer, {
      signal: new AbortController().signal, fetcher: remote() as typeof fetch,
    });
    expect(result.kind).toBe("confirm");
    expect(installer.startInstall).not.toHaveBeenCalled();
    await installCatalogRegion(region, installer, {
      signal: new AbortController().signal, fetcher: remote() as typeof fetch,
      replaceCheckpoint: true,
    });
    expect(installer.startInstall).toHaveBeenCalledWith(
      expect.objectContaining({ forceValidate: true }),
    );
  });
  it("reports installer failures without marking the region installed", async () => {
    const installer = fake({
      startInstall: vi.fn(async () => ({ success: false, error: {
        code: "checksum-mismatch", message: "Failed", retryable: false,
      } })),
    });
    const result = await installCatalogRegion(region, installer, {
      signal: new AbortController().signal, fetcher: remote() as typeof fetch,
    });
    expect(result).toEqual({ kind: "error", code: "checksum-mismatch" });
  });
});
