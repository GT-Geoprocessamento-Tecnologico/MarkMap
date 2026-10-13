import { describe, expect, it, vi } from "vitest";
import { installCatalogRegion } from "./catalog-region-install";
import type { PublicRegion } from "./public-region-catalog";
import type { ResumableInstaller } from "./resumable-installer";

const region: PublicRegion = {
  id: "regiao-teste", label: "Teste", area: "Brasil",
  manifestUrl: "https://maps.example.org/test/manifest.json",
  bounds: [-49, -8, -47, -6], sizeBytes: 1024, attribution: "Licença permitida",
};
const manifest = {
  id: region.id, totalBytes: region.sizeBytes, bounds: region.bounds,
};
const fake = (overrides: Record<string, unknown> = {}) => ({
  checkResume: vi.fn(async () => ({ needsConfirmation: false })),
  startInstall: vi.fn(async () => ({ success: true })),
  ...overrides,
}) as unknown as ResumableInstaller;
const fetcher = vi.fn(async () => new Response(JSON.stringify(manifest)));

describe("catalog-to-installer boundary", () => {
  it("refuses mismatched regions before writing anything", async () => {
    const installer = fake();
    const invalid = vi.fn(async () => new Response(JSON.stringify({ ...manifest, id: "other" })));
    await expect(installCatalogRegion(region, installer, {
      signal: new AbortController().signal, fetcher: invalid as typeof fetch,
    })).rejects.toThrow();
    expect(installer.startInstall).not.toHaveBeenCalled();
  });
  it("requires explicit confirmation for different saved checkpoints", async () => {
    const installer = fake({
      checkResume: vi.fn(async () => ({ needsConfirmation: true })),
    });
    // An invalid manifest never gets as far as reading checkpoints.
    await expect(installCatalogRegion(region, installer, {
      signal: new AbortController().signal, fetcher: fetcher as typeof fetch,
    })).rejects.toThrow();
    expect(installer.startInstall).not.toHaveBeenCalled();
  });
});
