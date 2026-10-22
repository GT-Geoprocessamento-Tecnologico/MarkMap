import { describe, expect, it } from "vitest";
import type { OfflineMapPackageManifest } from "@markmap/contracts/offline-map";
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
  const manifest = { id: "test-package", version: "1", label: "Test", bounds: [-48, -16, -47, -15] as [number, number, number, number], minZoom: 0, maxZoom: 12, archive: { id: crypto.randomUUID(), sha256: await hash(archive), bytes: archive.byteLength, mediaType: "application/vnd.pmtiles" as const }, style: { path: "style.json", blob: { id: crypto.randomUUID(), sha256: await hash(style), bytes: style.byteLength, mediaType: "application/json" as const } }, glyphs: [], sprites: [], attribution: "OpenStreetMap", createdAt: new Date().toISOString(), packageVersion: "1.0.0", osmDataDate: new Date().toISOString(), capabilities: [], checksums: { archive: await hash(archive) }, totalBytes: archive.byteLength + style.byteLength, sources: { osm: "OpenStreetMap", attributions: [] }, minimumCompatibleVersion: "1.0.0" };
  return { manifest: manifest as unknown as OfflineMapPackageManifest, assets: new Map([["package.pmtiles", archive], ["style.json", style]]) };
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

describe("offline style resource policy", () => {
  it("accepts geometry-only styles without optional glyphs or sprites", async () => {
    const value = await fixture();
    const style = new TextEncoder().encode(JSON.stringify({ sources: { base: { type: "vector", url: "pmtiles://package.pmtiles" } }, layers: [{ id: "base", type: "fill", source: "base" }] }));
    value.assets.set("style.json", style);
    value.manifest.style.blob = { ...value.manifest.style.blob, sha256: await hash(style), bytes: style.byteLength };
    value.manifest.totalBytes = value.manifest.archive.bytes + style.byteLength + value.manifest.glyphs.reduce((sum, asset) => sum + asset.blob.bytes, 0) + value.manifest.sprites.reduce((sum, asset) => sum + asset.blob.bytes, 0);
    await expect(validateOfflinePackage(value.manifest, value.assets)).resolves.toMatchObject({ ok: true });
    const adapted = adaptOfflineStyle({ sources: { base: { url: "pmtiles://package.pmtiles" } }, layers: [{ id: "base", type: "fill" }] }, { id: "local", attribution: "Licensed data" } as never);
    expect(adapted).not.toHaveProperty("glyphs");
    expect(adapted).not.toHaveProperty("sprite");
  });

  it("requires materialized glyphs and exact sprite pairs only when symbols use them", async () => {
    const value = await fixture();
    const glyph = new Uint8Array([1, 2, 3]);
    const glyphPath = "glyphs/Noto-Sans-Regular/0-255.pbf";
    value.manifest.glyphs = [{ path: glyphPath, blob: { id: crypto.randomUUID(), sha256: await hash(glyph), bytes: glyph.byteLength, mediaType: "application/x-protobuf" as const } }];
    value.assets.set(glyphPath, glyph);
    const style = new TextEncoder().encode(JSON.stringify({ sources: { base: { type: "vector", url: "pmtiles://package.pmtiles" } }, glyphs: "glyphs/{fontstack}/{range}.pbf", layers: [{ id: "labels", type: "symbol", layout: { "text-field": "{name}" } }] }));
    value.assets.set("style.json", style);
    value.manifest.style.blob = { ...value.manifest.style.blob, sha256: await hash(style), bytes: style.byteLength };
    value.manifest.totalBytes = value.manifest.archive.bytes + style.byteLength + value.manifest.glyphs.reduce((sum, asset) => sum + asset.blob.bytes, 0) + value.manifest.sprites.reduce((sum, asset) => sum + asset.blob.bytes, 0);
    await expect(validateOfflinePackage(value.manifest, value.assets)).resolves.toMatchObject({ ok: true });

    const literal = await fixture();
    const literalBytes = new Uint8Array([4]);
    literal.manifest.glyphs = [{ path: "glyphs/__MM_GLYPH_TOKEN__.pbf", blob: { id: crypto.randomUUID(), sha256: await hash(literalBytes), bytes: 1, mediaType: "application/x-protobuf" as const } }];
    literal.assets.set("glyphs/__MM_GLYPH_TOKEN__.pbf", literalBytes);
    literal.assets.set("style.json", style);
    literal.manifest.style.blob = { ...literal.manifest.style.blob, sha256: await hash(style), bytes: style.byteLength };
    literal.manifest.totalBytes = literal.manifest.archive.bytes + style.byteLength + literal.manifest.glyphs.reduce((sum, asset) => sum + asset.blob.bytes, 0) + literal.manifest.sprites.reduce((sum, asset) => sum + asset.blob.bytes, 0);
    await expect(validateOfflinePackage(literal.manifest, literal.assets)).resolves.toMatchObject({ ok: false, code: "invalid-style" });
  });
});
