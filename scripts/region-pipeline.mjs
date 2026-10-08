#!/usr/bin/env node
/**
 * region-pipeline.mjs — Pipeline regional OSM → MarkMap (M3, MM-MAP-200).
 *
 * Orquestra: validação de entrada → extração (ferramenta externa opcional) →
 * índice de busca sharded → curvas de nível → grafo de roteamento →
 * manifest v2 com checksums SHA-256.
 *
 * Uso:
 *   node scripts/region-pipeline.mjs --input <dir> --output <dir> [--dry-run]
 *
 * Entradas esperadas em <dir> (todas opcionais exceto places.json):
 *   places.json      [{"id","name","type","category","lon","lat","description"?}]
 *   graph.json       {"nodes":[{"id","lon","lat"}],"edges":[...]}
 *   contours.json    {"interval","majorInterval","minElevation","maxElevation","contours":[...]}
 *   osm.pbf          binário bruto (copiado como artefato quando presente)
 *
 * Nenhum serviço de rede é usado: tudo é local.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile, copyFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PIPELINE_VERSION = "1.0.0";

/** Limites defensivos por artefato (bytes). */
export const PIPELINE_LIMITS = {
  maxArtifactBytes: 256 * 1024 * 1024,
  maxPlaces: 500_000,
  maxShardBytes: 4 * 1024 * 1024,
  shardsPerLetter: 4,
};

export class PipelineError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
  }
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function normalizeName(name) {
  if (typeof name !== "string") return "";
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mesmo shard da busca offline em packages/maps/src/search. */
export function getShardId(normalized) {
  const first = normalized.charAt(0);
  if (!first) return "other";
  const code = first.codePointAt(0) ?? 0;
  if (code >= 97 && code <= 122) {
    const idx = code - 97;
    return `${first}${idx % PIPELINE_LIMITS.shardsPerLetter}`;
  }
  if (code >= 48 && code <= 57) return "0-9";
  return "other";
}

/**
 * Particiona registros em shards por primeira letra normalizada.
 * Cada shard é um objeto { id, records } serializável.
 */
export function buildSearchShards(records, shardsPerLetter = PIPELINE_LIMITS.shardsPerLetter) {
  if (!Array.isArray(records)) {
    throw new PipelineError("places.json deve ser um array", "INVALID_PLACES");
  }
  if (records.length > PIPELINE_LIMITS.maxPlaces) {
    throw new PipelineError(
      `places.json excede o limite de ${PIPELINE_LIMITS.maxPlaces} registros`,
      "PLACES_TOO_LARGE",
    );
  }

  const shards = new Map();
  let index = 0;
  for (const raw of records) {
    if (!raw || typeof raw !== "object") {
      throw new PipelineError(`registro inválido na posição ${index}`, "INVALID_RECORD");
    }
    const { id, name, type, category, lon, lat, description } = raw;
    if (typeof id !== "string" || typeof name !== "string") {
      throw new PipelineError(`registro ${index} sem id/name string`, "INVALID_RECORD");
    }
    if (typeof lon !== "number" || typeof lat !== "number" || !Number.isFinite(lon) || !Number.isFinite(lat)) {
      throw new PipelineError(`registro ${id} com lon/lat inválidos`, "INVALID_COORDS");
    }

    const normalized = normalizeName(name);
    const shardId = getShardId(normalized);
    const key = shardsPerLetter === PIPELINE_LIMITS.shardsPerLetter ? shardId : shardId;

    const record = { id, name, normalized, type: String(type ?? ""), category: String(category ?? ""), lon, lat };
    if (typeof description === "string") record.description = description;

    const list = shards.get(key) ?? [];
    list.push(record);
    shards.set(key, list);
    index += 1;
  }

  return [...shards.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, recs]) => ({ id, records: recs }));
}

/** Valida estrutura mínima de um grafo de roteamento antes de empacotar. */
export function validateRoutingGraph(graph) {
  if (!graph || typeof graph !== "object") throw new PipelineError("graph.json inválido", "INVALID_GRAPH");
  const { nodes, edges } = graph;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    throw new PipelineError("graph.json precisa de nodes[] e edges[]", "INVALID_GRAPH");
  }
  for (const [i, node] of nodes.entries()) {
    if (!node || typeof node.id !== "number" || typeof node.lon !== "number" || typeof node.lat !== "number") {
      throw new PipelineError(`node inválido na posição ${i}`, "INVALID_NODE");
    }
  }
  for (const [i, edge] of edges.entries()) {
    if (!edge || typeof edge.from !== "number" || typeof edge.to !== "number" || typeof edge.distance !== "number") {
      throw new PipelineError(`edge inválido na posição ${i}`, "INVALID_EDGE");
    }
    if (edge.distance <= 0) throw new PipelineError(`edge ${i} com distância não positiva`, "INVALID_EDGE");
  }
  return { nodeCount: nodes.length, edgeCount: edges.length };
}

/** Valida estrutura de curvas de nível. */
export function validateContours(contours) {
  if (!contours || typeof contours !== "object") throw new PipelineError("contours.json inválido", "INVALID_CONTOURS");
  const { interval, majorInterval, contours: list } = contours;
  if (typeof interval !== "number" || interval <= 0) {
    throw new PipelineError("interval deve ser positivo", "INVALID_CONTOURS");
  }
  if (typeof majorInterval !== "number" || majorInterval <= 0) {
    throw new PipelineError("majorInterval deve ser positivo", "INVALID_CONTOURS");
  }
  if (!Array.isArray(list)) throw new PipelineError("contours[] ausente", "INVALID_CONTOURS");
  for (const [i, c] of list.entries()) {
    if (!c || typeof c.elevation !== "number" || !Array.isArray(c.geometry)) {
      throw new PipelineError(`contour inválido na posição ${i}`, "INVALID_CONTOUR");
    }
  }
  return { interval, majorInterval, count: list.length };
}

/**
 * Monta o manifest v2 a partir dos artefatos já gravados.
 * Campos obrigatórios espelham offlineMapPackageManifestSchema (MM-MAP-120).
 */
export function buildManifest({ id, label, bounds, artifacts, sources, osmDataDate, packageVersion = PIPELINE_VERSION }) {
  if (!Array.isArray(bounds) || bounds.length !== 4 || bounds.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    throw new PipelineError("bounds deve ser [minLon, minLat, maxLon, maxLat]", "INVALID_BOUNDS");
  }
  const [minLon, minLat, maxLon, maxLat] = bounds;
  if (minLon > maxLon || minLat > maxLat) throw new PipelineError("bounds invertidos", "INVALID_BOUNDS");
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    throw new PipelineError("nenhum artefato para manifest", "NO_ARTIFACTS");
  }

  const checksums = {};
  let totalBytes = 0;
  for (const a of artifacts) {
    if (typeof a.sha256 !== "string" || a.sha256.length !== 64) {
      throw new PipelineError(`checksum inválido para ${a.path}`, "INVALID_CHECKSUM");
    }
    if (typeof a.bytes !== "number" || a.bytes < 0) {
      throw new PipelineError(`tamanho inválido para ${a.path}`, "INVALID_SIZE");
    }
    checksums[a.path] = a.sha256;
    totalBytes += a.bytes;
  }

  return {
    id,
    version: packageVersion,
    label,
    bounds: [minLon, minLat, maxLon, maxLat],
    minZoom: 0,
    maxZoom: 14,
    archive: artifacts.find((a) => a.path.endsWith(".pmtiles")) ?? artifacts[0],
    style: artifacts.find((a) => a.path === "style.json") ?? { path: "style.json", blob: artifacts[0] },
    glyphs: [],
    sprites: [],
    attribution: sources.attributions.join(" · ") || "OpenStreetMap",
    createdAt: new Date().toISOString(),
    packageVersion,
    osmDataDate,
    capabilities: ["search", "routing", "elevation", "contours"],
    checksums,
    totalBytes,
    sources,
    minimumCompatibleVersion: packageVersion,
  };
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function writeArtifact(outputDir, relPath, data) {
  const target = join(outputDir, relPath);
  await mkdir(resolve(target, ".."), { recursive: true });
  const bytes = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  if (bytes.byteLength > PIPELINE_LIMITS.maxArtifactBytes) {
    throw new PipelineError(`${relPath} excede o limite de bytes`, "ARTIFACT_TOO_LARGE");
  }
  await writeFile(target, bytes);
  return { path: relPath, bytes: bytes.byteLength, sha256: sha256(bytes), mediaType: mediaTypeFor(relPath) };
}

function mediaTypeFor(path) {
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".pmtiles")) return "application/vnd.pmtiles";
  if (path.endsWith(".pbf")) return "application/x-protobuf";
  if (path.endsWith(".geojson")) return "application/geo+json";
  return "application/octet-stream";
}

/**
 * Executa o pipeline. Retorna { artifacts, manifest, warnings }.
 * Não lança em ferramenta externa ausente: apenas registra warning.
 */
export async function runPipeline({ input, output, dryRun = false, now = new Date() }) {
  if (typeof input !== "string" || typeof output !== "string") {
    throw new PipelineError("--input e --output são obrigatórios", "MISSING_ARGS");
  }
  const inputDir = resolve(input);
  const outputDir = resolve(output);

  if (!(await exists(inputDir))) throw new PipelineError(`diretório de entrada não existe: ${inputDir}`, "INPUT_MISSING");
  if (inputDir === outputDir) throw new PipelineError("entrada e saída devem ser diferentes", "SAME_DIR");

  const warnings = [];
  const artifacts = [];

  const placesPath = join(inputDir, "places.json");
  const hasPlaces = await exists(placesPath);
  if (!hasPlaces) warnings.push("places.json ausente: índice de busca não será gerado");

  const entries = await readdir(inputDir);
  if (entries.length === 0) warnings.push("diretório de entrada vazio");

  if (dryRun) {
    return { dryRun: true, artifacts, manifest: null, warnings, inputDir, outputDir };
  }

  await mkdir(outputDir, { recursive: true });

  if (hasPlaces) {
    const raw = await readFile(placesPath, "utf8");
    let places;
    try {
      places = JSON.parse(raw);
    } catch {
      throw new PipelineError("places.json não é JSON válido", "INVALID_JSON");
    }
    const shards = buildSearchShards(places);
    for (const shard of shards) {
      artifacts.push(await writeArtifact(outputDir, `search/${shard.id}.json`, JSON.stringify(shard)));
    }
  }

  const graphPath = join(inputDir, "graph.json");
  if (await exists(graphPath)) {
    const graph = JSON.parse(await readFile(graphPath, "utf8"));
    validateRoutingGraph(graph);
    artifacts.push(await writeArtifact(outputDir, "routing/graph.json", JSON.stringify(graph)));
  } else {
    warnings.push("graph.json ausente: grafo de roteamento não será empacotado");
  }

  const contoursPath = join(inputDir, "contours.json");
  if (await exists(contoursPath)) {
    const contours = JSON.parse(await readFile(contoursPath, "utf8"));
    validateContours(contours);
    artifacts.push(await writeArtifact(outputDir, "elevation/contours.json", JSON.stringify(contours)));
  } else {
    warnings.push("contours.json ausente: curvas de nível não serão empacotadas");
  }

  const pbfPath = join(inputDir, "osm.pbf");
  if (await exists(pbfPath)) {
    const bytes = await readFile(pbfPath);
    artifacts.push(await writeArtifact(outputDir, `osm/${basename(pbfPath)}`, bytes));
  } else {
    warnings.push("osm.pbf ausente: dados OSM brutos não serão copiados");
  }

  if (artifacts.length === 0) {
    throw new PipelineError("nenhum artefato gerado: verifique o diretório de entrada", "NO_OUTPUT");
  }

  const stylePath = join(inputDir, "style.json");
  if (await exists(stylePath)) {
    await copyFile(stylePath, join(outputDir, "style.json"));
    const bytes = await readFile(stylePath);
    artifacts.push({ path: "style.json", bytes: bytes.byteLength, sha256: sha256(bytes), mediaType: "application/json" });
  } else {
    warnings.push("style.json ausente: estilo não será empacotado");
  }

  const manifest = buildManifest({
    id: `region-${now.toISOString().slice(0, 10)}`,
    label: "Região gerada pelo pipeline",
    bounds: [-180, -90, 180, 90],
    artifacts,
    sources: { osm: "OpenStreetMap", attributions: ["© OpenStreetMap contributors"] },
    osmDataDate: now.toISOString(),
  });

  artifacts.push(await writeArtifact(outputDir, "manifest.json", JSON.stringify(manifest, null, 2)));

  return { dryRun: false, artifacts, manifest, warnings, inputDir, outputDir };
}

function parseArgs(argv) {
  const args = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--input") args.input = argv[++i];
    else if (arg === "--output") args.output = argv[++i];
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") args.help = true;
    else throw new PipelineError(`argumento desconhecido: ${arg}`, "UNKNOWN_ARG");
  }
  return args;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      process.stdout.write(
        "Uso: node scripts/region-pipeline.mjs --input <dir> --output <dir> [--dry-run]\n",
      );
      process.exit(0);
    }
    const result = await runPipeline(args);
    if (result.dryRun) {
      process.stdout.write(`dry-run ok: input=${result.inputDir} output=${result.outputDir}\n`);
    } else {
      process.stdout.write(
        `pipeline ok: ${result.artifacts.length} artefatos, totalBytes=${result.manifest.totalBytes}\n`,
      );
    }
    for (const w of result.warnings) process.stderr.write(`aviso: ${w}\n`);
    process.exit(0);
  } catch (err) {
    const code = err instanceof PipelineError ? ` [${err.code}]` : "";
    process.stderr.write(`erro${code}: ${err?.message ?? err}\n`);
    process.exit(1);
  }
}
