import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildManifest,
  buildSearchShards,
  getShardId,
  normalizeName,
  PipelineError,
  runPipeline,
  validateContours,
  validateRoutingGraph,
} from "../../../../scripts/region-pipeline.mjs";

let inputDir: string;
let outputDir: string;

beforeEach(async () => {
  inputDir = await mkdtemp(join(tmpdir(), "mmpipe-in-"));
  outputDir = await mkdtemp(join(tmpdir(), "mmpipe-out-"));
});

afterEach(async () => {
  await rm(inputDir, { recursive: true, force: true });
  await rm(outputDir, { recursive: true, force: true });
});

const places = [
  { id: "n1", name: "Avenida Paulista", type: "way", category: "highway", lon: -46.6, lat: -23.5 },
  { id: "n2", name: "Praça da Sé", type: "node", category: "square", lon: -46.6, lat: -23.5 },
  { id: "n3", name: "Estação Expresso", type: "node", category: "station", lon: -46.6, lat: -23.5 },
];


async function writeRequiredRegionFiles() {
  const pmtiles = Buffer.alloc(127);
  pmtiles.write("PMTiles", 0, "ascii");
  pmtiles[7] = 3;
  for (let offset = 8; offset < 72; offset += 16) {
    pmtiles.writeBigUInt64LE(127n, offset);
    pmtiles.writeBigUInt64LE(0n, offset + 8);
  }
  await writeFile(join(inputDir, "basemap.pmtiles"), pmtiles);
  await writeFile(join(inputDir, "style.json"), JSON.stringify({
    version: 8, glyphs: "glyphs/{fontstack}/{range}.pbf",
    sprite: "sprites/sprite",
    sources: { basemap: { type: "vector", url: "pmtiles://package.pmtiles" } },
    layers: [],
  }));
  await writeFile(join(inputDir, "region.json"), JSON.stringify({
    id: "test-region", label: "Test Region", bounds: [-49, -25, -45, -21],
    minZoom: 0, maxZoom: 14, osmDataDate: "2026-10-08T00:00:00.000Z",
    minimumCompatibleVersion: "0.2.0-dev.0",
  }));
}

describe("region-pipeline (MM-MAP-200)", () => {
  it("normalizes names for indexing", () => {
    expect(normalizeName("Avenida  Paulistá!")).toBe("avenida paulista");
    expect(normalizeName("São João")).toBe("sao joao");
    expect(normalizeName(undefined)).toBe("");
  });

  it("assigns stable shard ids", () => {
    expect(getShardId("avenida")).toBe("a0");
    expect(getShardId("estacao")).toMatch(/^e\d$/);
    expect(getShardId("123")).toBe("0-9");
    expect(getShardId("!!!")).toBe("other");
  });

  it("partitions places into shards", () => {
    const shards = buildSearchShards(places);
    expect(shards.length).toBeGreaterThan(0);
    const ids = shards.flatMap((s: { records: Array<{ id: string }> }) => s.records.map((r) => r.id));
    expect(ids.sort()).toEqual(["n1", "n2", "n3"]);
    for (const shard of shards) {
      expect(shard.id).toBeTruthy();
      for (const rec of shard.records) {
        expect(rec.normalized).toBe(normalizeName(rec.name));
      }
    }
  });

  it("rejects malformed places", () => {
    expect(() => buildSearchShards("nope")).toThrow(PipelineError);
    expect(() => buildSearchShards([{ id: "x" }])).toThrow(PipelineError);
    expect(() =>
      buildSearchShards([{ id: "x", name: "y", lon: Number.NaN, lat: 0 }]),
    ).toThrow(PipelineError);
  });

  it("validates routing graph structure", () => {
    const graph = {
      nodes: [
        { id: 0, lon: -46.6, lat: -23.5 },
        { id: 1, lon: -46.5, lat: -23.5 },
      ],
      edges: [{ id: 0, from: 0, to: 1, distance: 1000 }],
    };
    expect(validateRoutingGraph(graph)).toEqual({ nodeCount: 2, edgeCount: 1 });
    expect(() => validateRoutingGraph({ nodes: [], edges: [{ from: 0 }] })).toThrow(PipelineError);
    expect(() =>
      validateRoutingGraph({
        nodes: [{ id: 0, lon: 1, lat: 1 }],
        edges: [{ from: 0, to: 0, distance: 0 }],
      }),
    ).toThrow(PipelineError);
  });

  it("validates contour layers", () => {
    const contours = { interval: 20, majorInterval: 100, contours: [{ elevation: 100, geometry: [[0, 0]] }] };
    expect(validateContours(contours)).toEqual({ interval: 20, majorInterval: 100, count: 1 });
    expect(() => validateContours({ interval: 0, majorInterval: 100, contours: [] })).toThrow(PipelineError);
    expect(() => validateContours({ interval: 20, majorInterval: 100, contours: [{}] })).toThrow(PipelineError);
  });

  it("builds a contract-shaped v2 manifest only with a real basemap and style", () => {
    const artifacts = [
      { path: "package.pmtiles", bytes: 127, sha256: "a".repeat(64), mediaType: "application/vnd.pmtiles" },
      { path: "style.json", bytes: 42, sha256: "b".repeat(64), mediaType: "application/json" },
      { path: "search/a0.json", bytes: 10, sha256: "c".repeat(64), mediaType: "application/json" },
    ];
    const manifest = buildManifest({
      id: "region-x", label: "Teste", bounds: [-48.4, -16.2, -47.2, -15.3],
      artifacts, sources: { osm: "OpenStreetMap", attributions: [] },
      osmDataDate: "2026-10-08T00:00:00.000Z", packageVersion: "1.0.0",
      now: new Date("2026-10-09T12:00:00.000Z"),
    });
    expect(manifest.archive.mediaType).toBe("application/vnd.pmtiles");
    expect(manifest.archive.bytes).toBe(127);
    expect(manifest.style.blob.sha256).toBe("b".repeat(64));
    expect(manifest.checksums.archive).toBe("a".repeat(64));
    expect(manifest.checksums.style).toBe("b".repeat(64));
    expect(manifest.capabilities).toEqual(["basemap", "search"]);
    expect(manifest.sources.attributions).toEqual([
      { name: "OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" },
    ]);
    expect(manifest.createdAt).toBe("2026-10-09T12:00:00.000Z");
    expect(manifest.minimumCompatibleVersion).toBe("0.2.0-dev.0");
    expect(manifest.totalBytes).toBe(179);
    expect(manifest.searchShards?.[0]?.path).toBe("search/a0.json");
  });

  it("fails closed instead of turning a search shard into a basemap", () => {
    const base = {
      id: "x", label: "x", bounds: [1, 2, 3, 4],
      artifacts: [{ path: "search/a0.json", bytes: 1, sha256: "c".repeat(64), mediaType: "application/json" }],
      sources: { osm: "OpenStreetMap", attributions: [] },
      osmDataDate: "2026-01-01T00:00:00.000Z",
    };
    expect(() => buildManifest(base)).toThrow(PipelineError);
    expect(() => buildManifest({ ...base, artifacts: [] })).toThrow(PipelineError);
    expect(() => buildManifest({ ...base, bounds: [10, 2, 3, 4] })).toThrow(PipelineError);
  });

  it("runs end-to-end and writes artifacts plus manifest", async () => {
    await writeFile(join(inputDir, "places.json"), JSON.stringify(places));
    await writeFile(
      join(inputDir, "graph.json"),
      JSON.stringify({
        nodes: [
          { id: 0, lon: -46.6, lat: -23.5 },
          { id: 1, lon: -46.5, lat: -23.5 },
        ],
        edges: [{ id: 0, from: 0, to: 1, distance: 1200, oneway: false, access: {}, speedKph: 50, highwayType: "primary", bridges: false, tunnels: false }],
      }),
    );
    await writeFile(
      join(inputDir, "contours.json"),
      JSON.stringify({ interval: 20, majorInterval: 100, contours: [{ elevation: 100, geometry: [[0, 0]] }] }),
    );

    await writeRequiredRegionFiles();
    const result = await runPipeline({ input: inputDir, output: outputDir });

    expect(result.dryRun).toBe(false);
    expect(result.artifacts.length).toBeGreaterThanOrEqual(4);
    expect(result.manifest).not.toBeNull();
    expect(result.manifest!.totalBytes).toBeGreaterThan(0);

    const { readFile } = await import("node:fs/promises");
    const manifestOnDisk = JSON.parse(await readFile(join(outputDir, "manifest.json"), "utf8"));
    expect(manifestOnDisk.packageVersion).toBe("1.0.0");
    expect(manifestOnDisk.checksums.archive).toMatch(/^[a-f0-9]{64}$/);
    expect(manifestOnDisk.capabilities).toEqual(["basemap", "search"]);
    expect(manifestOnDisk.searchShards?.length).toBeGreaterThan(0);

    const shardFiles = result.artifacts.filter((a: { path: string }) => a.path.startsWith("search/"));
    expect(shardFiles.length).toBeGreaterThan(0);
    for (const f of shardFiles) expect(f.sha256).toHaveLength(64);
  });

  it("warns instead of failing when optional inputs are missing", async () => {
    await writeFile(join(inputDir, "places.json"), JSON.stringify(places));
    await writeRequiredRegionFiles();
    const result = await runPipeline({ input: inputDir, output: outputDir });
    expect(result.warnings.some((w: string) => w.includes("graph.json"))).toBe(true);
    expect(result.warnings.some((w: string) => w.includes("contours.json"))).toBe(true);
    expect(result.manifest).not.toBeNull();
  });

  it("fails when no artifacts can be produced", async () => {
    await expect(runPipeline({ input: inputDir, output: outputDir })).rejects.toMatchObject({
      name: "PipelineError",
      code: "MISSING_BASEMAP",
    });
  });

  it("rejects a truncated or counterfeit basemap", async () => {
    await writeRequiredRegionFiles();
    await writeFile(join(inputDir, "basemap.pmtiles"), Buffer.from("not-a-pmtiles"));
    await expect(runPipeline({ input: inputDir, output: outputDir })).rejects.toMatchObject({
      code: "INVALID_PMTILES",
    });
  });

  it("validates arguments before doing work", async () => {
    await expect(runPipeline({})).rejects.toMatchObject({ code: "MISSING_ARGS" });
    await expect(runPipeline({ input: inputDir, output: inputDir })).rejects.toMatchObject({
      code: "SAME_DIR",
    });
    await expect(
      runPipeline({ input: join(inputDir, "nope"), output: outputDir }),
    ).rejects.toMatchObject({ code: "INPUT_MISSING" });
  });

  it("supports dry-run without writing output", async () => {
    await writeFile(join(inputDir, "places.json"), JSON.stringify(places));
    const result = await runPipeline({ input: inputDir, output: outputDir, dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(result.artifacts).toHaveLength(0);
    const { readdir } = await import("node:fs/promises");
    expect(await readdir(outputDir)).toHaveLength(0);
  });

  it("rejects invalid places.json payload", async () => {
    await writeRequiredRegionFiles();
    await writeFile(join(inputDir, "places.json"), "{ not json");
    await expect(runPipeline({ input: inputDir, output: outputDir })).rejects.toMatchObject({
      code: "INVALID_JSON",
    });
    await mkdir(join(inputDir, "sub"), { recursive: true });
  });
});