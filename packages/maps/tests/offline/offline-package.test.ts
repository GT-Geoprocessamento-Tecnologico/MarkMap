import { describe, expect, it } from "vitest";
import { adaptOfflineStyle } from "../../src/offline/style.js";
import { validateOfflinePackage } from "../../src/offline/package.js";
import { createOfflineAssetProtocol } from "../../src/offline/protocol.js";

const hash = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
};
async function fixture() {
  const archive = new Uint8Array(127); archive.set(new TextEncoder().encode("PMTiles")); archive[7] = 3;
  for (let p = 8; p < 72; p += 16) new DataView(archive.buffer).setBigUint64(p, 127n, true);
  const style = new TextEncoder().encode(JSON.stringify({ sources: { base: { type: "vector", url: "pmtiles://package.pmtiles" } }, glyphs: "glyphs/{fontstack}/{range}.pbf", sprite: "sprites/light" }));
  const manifest = { id: "test-package", version: "1", label: "Test", bounds: [-48, -16, -47, -15] as [number, number, number, number], minZoom: 0, maxZoom: 12, archive: { id: crypto.randomUUID(), sha256: await hash(archive), bytes: archive.byteLength, mediaType: "application/vnd.pmtiles" as const }, style: { path: "style.json", blob: { id: crypto.randomUUID(), sha256: await hash(style), bytes: style.byteLength, mediaType: "application/json" as const } }, glyphs: [], sprites: [], attribution: "OpenStreetMap", createdAt: new Date().toISOString() };
  return { manifest, assets: new Map([["package.pmtiles", archive], ["style.json", style]]) };
}

describe("offline package", () => {
  it("accepts a complete local PMTiles package", async () => { const value = await fixture(); expect((await validateOfflinePackage(value.manifest, value.assets)).ok).toBe(true); });
  it("rejects external style references and truncated archives", async () => { const value = await fixture(); const style = new TextEncoder().encode(JSON.stringify({ sources: { base: { url: "https://example.invalid/map.pmtiles" } }, glyphs: "glyphs/{fontstack}/{range}.pbf", sprite: "sprites/light" })); value.assets.set("style.json", style); expect((await validateOfflinePackage(value.manifest, value.assets)).ok).toBe(false); const broken = await fixture(); broken.assets.set("package.pmtiles", new Uint8Array(10)); expect((await validateOfflinePackage(broken.manifest, broken.assets)).ok).toBe(false); });
  it("rewrites package resources and preserves attribution", () => { const result = adaptOfflineStyle({ sources: { base: { url: "pmtiles://package.pmtiles", attribution: "Existing source" } }, glyphs: "glyphs/{fontstack}/{range}.pbf", sprite: "sprites/light" }, { id: "local", attribution: "Licensed data" } as never); expect(result).toMatchObject({ attribution: "Licensed data", glyphs: "geonexo-package://local/glyphs/{fontstack}/{range}.pbf", sources: { base: { attribution: "Existing source; Licensed data" } } }); });
  it("rejects an aborted or oversized local asset read", async () => {
    const protocol = createOfflineAssetProtocol(async () => new Blob([new Uint8Array(4)]));
    const controller = new AbortController(); controller.abort();
    await expect(protocol({ url: "geonexo-package://local/style.json" }, controller)).rejects.toMatchObject({ name: "AbortError" });
    const oversized = createOfflineAssetProtocol(async () => new Blob([new Uint8Array(4 * 1024 * 1024 + 1)]));
    await expect(oversized({ url: "geonexo-package://local/style.json" }, new AbortController())).rejects.toThrow("too large");
  });
  it("rejects traversal, encoded separators and malformed escapes before resolver access", async () => {
    let calls = 0;
    const protocol = createOfflineAssetProtocol(async () => { calls += 1; return new Blob([new Uint8Array(1)]); });
    for (const url of ["geonexo-package://local/../secret", "geonexo-package://local/glyphs%2Fsecret", "geonexo-package://local/%ZZ"]) {
      await expect(protocol({ url }, new AbortController())).rejects.toThrow("invalid offline package asset URL");
    }
    expect(calls).toBe(0);
  });
});
