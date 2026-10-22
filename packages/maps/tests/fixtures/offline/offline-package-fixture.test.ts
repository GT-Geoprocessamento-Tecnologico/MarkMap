import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { offlineMapPackageManifestSchema } from "@markmap/contracts/offline-map";

import {
  MAX_PACKAGE_BYTES,
  validateOfflineMapPackage,
} from "../../../src/experimental/offline-package-validator.js";

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const readJson = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(resolve(fixtureDir, name), "utf8"));

const digest = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

const blobBytes = (value: unknown): number => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("fixture blob is not an object");
  }
  const bytes = (value as Record<string, unknown>).bytes;
  if (typeof bytes !== "number") throw new Error("fixture blob bytes missing");
  return bytes;
};

const recomputeTotal = (manifest: Record<string, unknown>): void => {
  const glyphs = manifest.glyphs as Array<Record<string, unknown>>;
  const sprites = manifest.sprites as Array<Record<string, unknown>>;
  manifest.totalBytes =
    blobBytes(manifest.archive) +
    blobBytes((manifest.style as Record<string, unknown>).blob) +
    glyphs.reduce((sum, asset) => sum + blobBytes(asset.blob), 0) +
    sprites.reduce((sum, asset) => sum + blobBytes(asset.blob), 0);
};

const makeArchive = (sectionLength = 0): Uint8Array => {
  const archive = new Uint8Array(127);
  archive.set(Buffer.from("PMTiles", "ascii"), 0);
  archive[7] = 3;
  const view = new DataView(archive.buffer);
  for (let offset = 8; offset < 72; offset += 16) {
    view.setBigUint64(offset, BigInt(127), true);
    view.setBigUint64(offset + 8, BigInt(sectionLength), true);
  }
  return archive;
};

const makePackage = async () => {
  const manifest = (await readJson("manifest.json")) as Record<string, unknown>;
  const archive = makeArchive();
  const style = await readFile(resolve(fixtureDir, "style.json"));
  const glyphs = manifest.glyphs as Array<Record<string, unknown>>;
  const sprites = manifest.sprites as Array<Record<string, unknown>>;
  const assets = new Map<string, Uint8Array>([["package.pmtiles", archive], ["style.json", style]]);
  const updateRefs = (refs: Array<Record<string, unknown>>) => refs.map((ref, index) => {
    const bytes = Buffer.from(`asset-${index}`, "utf8");
    assets.set(String(ref.path), bytes);
    return { ...ref, blob: { ...(ref.blob as Record<string, unknown>), bytes: bytes.byteLength, sha256: digest(bytes) } };
  });
  manifest.archive = { ...(manifest.archive as Record<string, unknown>), bytes: archive.byteLength, sha256: digest(archive) };
  manifest.style = { ...(manifest.style as Record<string, unknown>), blob: { ...(manifest.style as Record<string, unknown>).blob as Record<string, unknown>, bytes: style.byteLength, sha256: digest(style) } };
  manifest.glyphs = updateRefs(glyphs);
  manifest.sprites = updateRefs(sprites);
  recomputeTotal(manifest);
  return { manifest, assets };
};

const containsRemoteUrl = (value: unknown): boolean => {
  if (typeof value === "string") return /^https?:\/\//i.test(value);
  if (Array.isArray(value)) return value.some(containsRemoteUrl);
  if (value && typeof value === "object") {
    return Object.values(value).some(containsRemoteUrl);
  }
  return false;
};

describe("regional offline package fixture", () => {
  it("validates the canonical manifest and its bounded regional envelope", async () => {
    const result = offlineMapPackageManifestSchema.safeParse(
      await readJson("manifest.json"),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archive.bytes).toBe(4_300_633);
    expect(result.data.maxZoom).toBe(12);
    expect(result.data.bounds).toEqual([-48.4, -16.2, -47.2, -15.3]);
    expect(result.data.attribution).toContain("OpenStreetMap");
  });

  it("validates actual PMTiles bytes and every referenced asset", async () => {
    const { manifest, assets } = await makePackage();
    const result = validateOfflineMapPackage(manifest, assets);
    expect(result.ok).toBe(true);
  });

  it("rejects traversal paths before package activation", async () => {
    const result = offlineMapPackageManifestSchema.safeParse(
      await readJson("manifest-path-traversal.json"),
    );
    expect(result.success).toBe(false);
  });

  it("rejects remote style, glyph, sprite and source URLs", async () => {
    const style = await readJson("style.json");
    const externalStyle = await readJson("style-external.json");
    expect(containsRemoteUrl(style)).toBe(false);
    expect(containsRemoteUrl(externalStyle)).toBe(true);
    const { manifest, assets } = await makePackage();
    const externalBytes = Buffer.from(JSON.stringify(externalStyle), "utf8");
    assets.set("style.json", externalBytes);
    const styleRef = manifest.style as Record<string, unknown>;
    styleRef.blob = { ...(styleRef.blob as Record<string, unknown>), bytes: externalBytes.byteLength, sha256: digest(externalBytes) };
    recomputeTotal(manifest);
    expect(validateOfflineMapPackage(manifest, assets)).toMatchObject({ ok: false, code: "external-style-resource" });
    for (const scheme of ["//cdn.example.test/map", "mapbox://styles/x", "ftp://x/map", "file:///tmp/map", "data:text/plain,x", "blob:https://x"]) {
      const schemeStyle = { ...style as Record<string, unknown>, sources: { basemap: { type: "vector", url: scheme } }, glyphs: "glyphs/{fontstack}/{range}.pbf", sprite: "sprites/light" };
      const schemeBytes = Buffer.from(JSON.stringify(schemeStyle), "utf8");
      const schemePackage = await makePackage();
      schemePackage.assets.set("style.json", schemeBytes);
      const schemeRef = schemePackage.manifest.style as Record<string, unknown>;
      schemeRef.blob = { ...(schemeRef.blob as Record<string, unknown>), bytes: schemeBytes.byteLength, sha256: digest(schemeBytes) };
      recomputeTotal(schemePackage.manifest);
      expect(validateOfflineMapPackage(schemePackage.manifest, schemePackage.assets)).toMatchObject({ ok: false, code: "external-style-resource" });
    }
  });

  it("rejects a changed asset digest, truncated header and declared section length", async () => {
    const first = await makePackage();
    const changedStyle = Buffer.from("changed", "utf8");
    first.assets.set("style.json", changedStyle);
    first.manifest.style = { ...(first.manifest.style as Record<string, unknown>), blob: { ...(first.manifest.style as Record<string, unknown>).blob as Record<string, unknown>, bytes: changedStyle.byteLength } };
    recomputeTotal(first.manifest);
    expect(validateOfflineMapPackage(first.manifest, first.assets)).toMatchObject({ ok: false, code: "checksum-mismatch" });

    const truncated = await makePackage();
    const shortArchive = new Uint8Array(10);
    truncated.assets.set("package.pmtiles", shortArchive);
    truncated.manifest.archive = { ...(truncated.manifest.archive as Record<string, unknown>), bytes: shortArchive.byteLength, sha256: digest(shortArchive) };
    recomputeTotal(truncated.manifest);
    expect(validateOfflineMapPackage(truncated.manifest, truncated.assets)).toMatchObject({ ok: false, code: "invalid-pmtiles-header" });

    const mismatched = await makePackage();
    const badArchive = makeArchive(1);
    mismatched.assets.set("package.pmtiles", badArchive);
    mismatched.manifest.archive = { ...(mismatched.manifest.archive as Record<string, unknown>), bytes: badArchive.byteLength, sha256: digest(badArchive) };
    recomputeTotal(mismatched.manifest);
    expect(validateOfflineMapPackage(mismatched.manifest, mismatched.assets)).toMatchObject({ ok: false, code: "pmtiles-length-mismatch" });
  });

  it("rejects traversal and packages above the 250 MiB activation budget", async () => {
    const traversal = await readJson("manifest-path-traversal.json");
    const packageData = await makePackage();
    expect(validateOfflineMapPackage(traversal, packageData.assets)).toMatchObject({ ok: false, code: "unsafe-path" });
    const oversized = await makePackage();
    oversized.manifest.archive = { ...(oversized.manifest.archive as Record<string, unknown>), bytes: 200 * 1024 * 1024 };
    oversized.manifest.style = { ...(oversized.manifest.style as Record<string, unknown>), blob: { ...(oversized.manifest.style as Record<string, unknown>).blob as Record<string, unknown>, bytes: 25 * 1024 * 1024 } };
    const firstSprite = (oversized.manifest.sprites as Array<Record<string, unknown>>)[0];
    if (!firstSprite) throw new Error("fixture must contain a sprite");
    firstSprite.blob = { ...(firstSprite.blob as Record<string, unknown>), bytes: 25 * 1024 * 1024 };
    recomputeTotal(oversized.manifest);
    expect(validateOfflineMapPackage(oversized.manifest, oversized.assets)).toMatchObject({ ok: false, code: "budget-exceeded" });
    expect(MAX_PACKAGE_BYTES).toBe(250 * 1024 * 1024);
  });

  it("rejects duplicate assets and an asset colliding with the archive", async () => {
    const duplicate = await makePackage();
    const glyphs = duplicate.manifest.glyphs as Array<Record<string, unknown>>;
    glyphs[1] = { ...glyphs[1], path: glyphs[0]?.path };
    expect(validateOfflineMapPackage(duplicate.manifest, duplicate.assets)).toMatchObject({ ok: false, code: "duplicate-asset-path" });
    const collision = await makePackage();
    const sprites = collision.manifest.sprites as Array<Record<string, unknown>>;
    sprites[0] = { ...sprites[0], path: "package.pmtiles" };
    expect(validateOfflineMapPackage(collision.manifest, collision.assets)).toMatchObject({ ok: false, code: "duplicate-asset-path" });
  });
});
