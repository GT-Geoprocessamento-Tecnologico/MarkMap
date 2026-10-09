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
 * Entradas obrigatórias em <dir>:
 *   region.json      id,label,bounds,osmDataDate,versao
 *   osm.pbf          extrato OSM PBF regional (builder limitado a pequenos extratos)
 *                   OU basemap.pmtiles pregerado (prioridade se ambos existirem)
 *   style.json       opcional com osm.pbf; gerado automaticamente sem dependencia remota
 * Entradas opcionais: places.json, graph.json, contours.json.
 * Relations e nomes tipograficos exigem processamento posterior.
 *
 * Nenhum serviço de rede é usado: tudo é local.
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildPmtilesFromOsmFile, defaultOfflineStyle, OsmTileError } from "./osm-pbf-pmtiles.mjs";

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
function blobRef(artifact, mediaType) {
  const hex = artifact.sha256.toLowerCase();
  // UUID v4-shaped deterministic identifier derived from the immutable checksum.
  const id = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    "4" + hex.slice(13, 16),
    "8" + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
  return { id, sha256: hex, bytes: artifact.bytes, mediaType };
}

/**
 * The manifest must satisfy packages/contracts/src/offline-map.ts, not only
 * contain similarly named fields. Never substitute a search file for PMTiles.
 */
export function buildManifest({
  id, label, bounds, artifacts, sources, osmDataDate, packageVersion = PIPELINE_VERSION,
  minZoom = 0, maxZoom = 14, minimumCompatibleVersion = "0.2.0-dev.0", now = new Date(),
}) {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,127}$/.test(id))
    throw new PipelineError("id regional inválido", "INVALID_REGION_ID");
  if (typeof label !== "string" || !label.trim() || label.length > 160)
    throw new PipelineError("label regional inválida", "INVALID_LABEL");
  if (!Array.isArray(bounds) || bounds.length !== 4 || bounds.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    throw new PipelineError("bounds deve ser [minLon, minLat, maxLon, maxLat]", "INVALID_BOUNDS");
  }
  const [minLon, minLat, maxLon, maxLat] = bounds;
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90 ||
      minLon >= maxLon || minLat >= maxLat)
    throw new PipelineError("bounds WGS84 inválidos", "INVALID_BOUNDS");
  if (!Number.isInteger(minZoom) || !Number.isInteger(maxZoom) || minZoom < 0 || maxZoom > 24 || minZoom > maxZoom)
    throw new PipelineError("intervalo de zoom inválido", "INVALID_ZOOM");
  if (!Array.isArray(artifacts)) throw new PipelineError("artifacts deve ser array", "INVALID_ARTIFACTS");

  const basemap = artifacts.find((a) => a.path === "package.pmtiles");
  const style = artifacts.find((a) => a.path === "style.json");
  if (!basemap || basemap.mediaType !== "application/vnd.pmtiles")
    throw new PipelineError("PMTiles v3 ausente: índice/OSM PBF não é basemap", "MISSING_BASEMAP");
  if (!style || style.mediaType !== "application/json")
    throw new PipelineError("style.json ausente", "MISSING_STYLE");
  const spriteArtifacts = artifacts.filter((a) => a.path.startsWith('sprites/'));
  const glyphArtifacts = artifacts.filter((a) => a.path.startsWith('glyphs/'));
  const activeArtifacts = [basemap, style, ...spriteArtifacts, ...glyphArtifacts];
  let totalBytes = 0;
  for (const a of artifacts) {
    if (!/^[a-f0-9]{64}$/.test(a.sha256) || !Number.isSafeInteger(a.bytes) || a.bytes <= 0)
      throw new PipelineError("artefato inválido: " + a.path, "INVALID_ARTIFACT");
  }
  totalBytes = activeArtifacts.reduce((sum, a) => sum + a.bytes, 0);
  if (spriteArtifacts.length > 256 || glyphArtifacts.length > 256) throw new PipelineError("glyphs/sprites excedem 256 arquivos", "TOO_MANY_ASSETS");
  if (basemap.bytes > 250 * 1024 * 1024 || style.bytes > 25 * 1024 * 1024 ||
      totalBytes > 250 * 1024 * 1024)
    throw new PipelineError("pacote excede o contrato v2 atual de 250 MiB", "PACKAGE_TOO_LARGE");
  if (typeof osmDataDate !== "string" || !Number.isFinite(Date.parse(osmDataDate)))
    throw new PipelineError("osmDataDate deve ser ISO 8601 válido", "INVALID_OSM_DATE");
  if (typeof sources?.osm !== "string" || !sources.osm.trim())
    throw new PipelineError("origem OSM ausente", "INVALID_SOURCES");
  const attributionItems = sources.attributions ?? [];
  if (!Array.isArray(attributionItems) || attributionItems.some((a) =>
    !a || typeof a.name !== "string" || !a.name.trim() || typeof a.url !== "string" || !/^https:\/\//.test(a.url)
  )) throw new PipelineError("attributions deve conter name e URL HTTPS", "INVALID_SOURCES");
  const attributions = attributionItems.length ? attributionItems : [
    { name: "OpenStreetMap contributors", url: "https://www.openstreetmap.org/copyright" },
  ];
  const archiveRef = blobRef(basemap, "application/vnd.pmtiles");
  const styleRef = blobRef(style, "application/json");
  return {
    id, version: packageVersion, label, bounds, minZoom, maxZoom,
    archive: archiveRef, style: { path: style.path, blob: styleRef },
    glyphs: glyphArtifacts.map((a) => ({ path: a.path, blob: blobRef(a, a.mediaType) })),
    sprites: spriteArtifacts.map((a) => ({ path: a.path, blob: blobRef(a, a.mediaType) })),
    attribution: attributions.map((a) => a.name).join(" · "),
    createdAt: now.toISOString(), packageVersion, osmDataDate,
    // Auxiliary JSON files are not activated by the current offline store.
    capabilities: ["basemap"],
    checksums: { archive: basemap.sha256, style: style.sha256,
      glyphs: glyphArtifacts.map((a) => a.sha256), sprites: spriteArtifacts.map((a) => a.sha256) },
    totalBytes, sources: { osm: sources.osm, attributions },
    optionalComponents: { search: {}, routing: { walk: false, bicycle: false, car: false }, elevation: false, contours: false },
    minimumCompatibleVersion,
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
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".pmtiles")) return "application/vnd.pmtiles";
  if (path.endsWith(".pbf")) return "application/x-protobuf";
  if (path.endsWith(".geojson")) return "application/geo+json";
  return "application/octet-stream";
}

/** Packages validated PMTiles or builds small-area vector PMTiles from OSM PBF. */
export async function runPipeline({ input, output, dryRun = false, now = new Date() }) {
  if (typeof input !== "string" || typeof output !== "string")
    throw new PipelineError("--input e --output são obrigatórios", "MISSING_ARGS");
  const inputDir = resolve(input);
  const outputDir = resolve(output);
  if (!(await exists(inputDir)))
    throw new PipelineError("diretório de entrada não existe: " + inputDir, "INPUT_MISSING");
  if (inputDir === outputDir)
    throw new PipelineError("entrada e saída devem ser diferentes", "SAME_DIR");

  const warnings = [];
  const artifacts = [];
  const entries = await readdir(inputDir);
  if (entries.length === 0) warnings.push("diretório de entrada vazio");
  if (dryRun) return { dryRun: true, artifacts, manifest: null, warnings, inputDir, outputDir };

  // Fail before writing any output. Never claim a search shard is a PMTiles map.
  const basemapPath = join(inputDir, "basemap.pmtiles");
  const stylePath = join(inputDir, "style.json");
  const metadataPath = join(inputDir, "region.json");
  const hasBasemap = await exists(basemapPath);
  const hasOsm = await exists(join(inputDir, "osm.pbf"));
  if (!hasBasemap && !hasOsm)
    throw new PipelineError("basemap.pmtiles ou osm.pbf e obrigatorio", "MISSING_BASEMAP");
  if (!(await exists(metadataPath)))
    throw new PipelineError("region.json com bounds/data/versao e obrigatorio", "MISSING_REGION_METADATA");

  let metadata;
  let styleData;
  try {
    metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    styleData = await exists(stylePath) ? JSON.parse(await readFile(stylePath, "utf8")) : defaultOfflineStyle();
  } catch {
    throw new PipelineError("region.json ou style.json invalido", "INVALID_JSON");
  }
  if (!hasBasemap && await exists(stylePath))
    warnings.push("style.json fornecido: certifique-se de que os source-layer coincidam com o builder regional");
  if (hasBasemap && !(await exists(stylePath)))
    throw new PipelineError("style.json e obrigatorio ao fornecer basemap.pmtiles", "MISSING_STYLE");
  if (!styleData || !styleData.sources || typeof styleData.sources !== "object")
    throw new PipelineError("style.json sem fontes", "INVALID_STYLE");
  let basemap;
  if (hasBasemap) {
    basemap = await readFile(basemapPath);
    if (hasOsm) warnings.push("basemap.pmtiles pregerado prevalece sobre osm.pbf");
  } else {
    try {
      const built = await buildPmtilesFromOsmFile(join(inputDir, "osm.pbf"), {
        bounds: metadata.bounds, minZoom: metadata.minZoom ?? 0, maxZoom: metadata.maxZoom ?? 12,
      });
      basemap = built.bytes;
      warnings.push("OSM PBF convertido para " + built.tileCount + " tiles / " + built.featureCount + " geometrias; relations, labels e fontes vetoriais completas ainda nao sao cobertos");
    } catch (error) {
      if (error instanceof OsmTileError) throw new PipelineError(error.message, error.code);
      throw error;
    }
  }
  if (basemap.byteLength < 127 ||
      basemap.toString("ascii", 0, 7) !== "PMTiles" || basemap[7] !== 3)
    throw new PipelineError("basemap não tem header PMTiles v3 válido", "INVALID_PMTILES");
  for (let offset = 8; offset < 72; offset += 16) {
    const start = Number(basemap.readBigUInt64LE(offset));
    const size = Number(basemap.readBigUInt64LE(offset + 8));
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(size) ||
        start < 127 || start + size > basemap.byteLength)
      throw new PipelineError("seção PMTiles fora do arquivo", "INVALID_PMTILES");
  }
  await mkdir(outputDir, { recursive: true });
  artifacts.push(await writeArtifact(outputDir, "package.pmtiles", basemap));
  artifacts.push(await writeArtifact(outputDir, "style.json", JSON.stringify(styleData)));
  // MapLibre automatically requests sprite metadata from style.sprite. The
  // generated symbol-free basemap ships a valid empty sprite instead of 404s.
  if (!hasBasemap && !(await exists(stylePath))) {
    const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZ0AAAAASUVORK5CYII=', 'base64');
    for (const suffix of ['', '@2x']) {
      artifacts.push(await writeArtifact(outputDir, 'sprites/sprite' + suffix + '.json', '{}'));
      artifacts.push(await writeArtifact(outputDir, 'sprites/sprite' + suffix + '.png', transparentPng));
    }
  }

  const placesPath = join(inputDir, "places.json");
  if (await exists(placesPath)) {
    let places;
    try { places = JSON.parse(await readFile(placesPath, "utf8")); }
    catch { throw new PipelineError("places.json inválido", "INVALID_JSON"); }
    for (const shard of buildSearchShards(places))
      artifacts.push(await writeArtifact(outputDir, "search/" + shard.id + ".json", JSON.stringify(shard)));
  } else warnings.push("places.json ausente: busca regional não foi empacotada");

  const graphPath = join(inputDir, "graph.json");
  if (await exists(graphPath)) {
    let graph;
    try { graph = JSON.parse(await readFile(graphPath, "utf8")); }
    catch { throw new PipelineError("graph.json inválido", "INVALID_JSON"); }
    validateRoutingGraph(graph);
    artifacts.push(await writeArtifact(outputDir, "routing/graph.json", JSON.stringify(graph)));
  } else warnings.push("graph.json ausente: roteamento não foi empacotado");

  const contoursPath = join(inputDir, "contours.json");
  if (await exists(contoursPath)) {
    let contours;
    try { contours = JSON.parse(await readFile(contoursPath, "utf8")); }
    catch { throw new PipelineError("contours.json inválido", "INVALID_JSON"); }
    validateContours(contours);
    artifacts.push(await writeArtifact(outputDir, "elevation/contours.json", JSON.stringify(contours)));
  } else warnings.push("contours.json ausente: curvas de nível não foram empacotadas");

  if (hasOsm && !hasBasemap) warnings.push("Limite do builder integrado: ate 32 MiB de extrato PBF; use um gerador regional especializado para areas maiores");
  warnings.push("glyphs/sprites e ativação de componentes auxiliares exigem integração posterior ao contrato v2");

  const manifest = buildManifest({
    ...metadata,
    artifacts,
    sources: metadata.sources ?? { osm: "OpenStreetMap", attributions: [] },
    osmDataDate: metadata.osmDataDate,
    now,
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