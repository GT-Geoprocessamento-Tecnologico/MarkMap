export type TerrainBounds = [number, number, number, number];

export interface TerrainGrid {
  schemaVersion: 1;
  regionId: string;
  metadata: {
    bounds: TerrainBounds;
    width: number;
    height: number;
    noDataValue: number;
    resolutionMeters: number;
    attribution: string;
    license: string;
    sourceUrl: string;
    verticalDatum: string;
    source: "aws-terrain-tiles";
    sourceVersion: string;
    tileZoom: number;
  };
  values: number[];
}

const TILE_SIZE = 256;
const MAX_TILES = 64;
const MAX_GRID_CELLS = 256 * 256;
const MAX_GRID_BYTES = 2 * 1024 * 1024;
const MAX_TILE_BYTES = 512 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 64;
const CACHE_NAME = "markmap-terrain-v1";
const SOURCE_VERSION = "mapzen-terrain-tiles-v1";
const SOURCE_URL = "https://registry.opendata.aws/terrain-tiles/";
const ATTRIBUTION =
  "Terrain Tiles por Mapzen, hospedado no AWS Open Data; provedores de origem conforme a atribuição Tilezen.";
const LICENSE =
  "Open data; attribution requirements vary by source provider. See Tilezen attribution.";
const VERTICAL_DATUM =
  "Referência vertical varia conforme a fonte; consulte a atribuição.";
const NO_DATA = -32768;
const tileMemory = new Map<string, DecodedTile>();
const IMAGE_DECODE_TIMEOUT_MS = 15_000;

type DecodedTile = { z: number; x: number; y: number; rgba: Uint8ClampedArray };

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validBounds(bounds: unknown): bounds is TerrainBounds {
  return (
    Array.isArray(bounds) &&
    bounds.length === 4 &&
    bounds.every(finite) &&
    bounds[0] >= -180 &&
    bounds[2] <= 180 &&
    bounds[1] >= -90 &&
    bounds[3] <= 90 &&
    bounds[0] < bounds[2] &&
    bounds[1] < bounds[3]
  );
}

function assertBounds(bounds: TerrainBounds): void {
  if (!validBounds(bounds)) throw new Error("Limites de terreno inválidos.");
}

function tileXY(lon: number, lat: number, zoom: number): [number, number] {
  const n = 2 ** zoom;
  const x = Math.max(0, Math.min(n - 1, Math.floor(((lon + 180) / 360) * n)));
  const yMercator =
    ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const y = Math.max(0, Math.min(n - 1, Math.floor(yMercator)));
  return [x, y];
}

function tileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

function tileUrl(z: number, x: number, y: number): string {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
}

function decodePixel(
  r: number,
  g: number,
  b: number,
  alpha = 255,
): number | null {
  if (alpha === 0) return null;
  const elevation = r * 256 + g + b / 256 - 32768;
  if (
    !Number.isFinite(elevation) ||
    elevation < -12_000 ||
    elevation > 12_000
  ) {
    throw new Error("Pixel de terreno fora do domínio.");
  }
  return elevation;
}

export function decodeTerrariumPixel(
  r: number,
  g: number,
  b: number,
  alpha = 255,
): number | null {
  if (
    ![r, g, b, alpha].every(Number.isInteger) ||
    [r, g, b, alpha].some((v) => v < 0 || v > 255)
  ) {
    throw new Error("Pixel Terrarium inválido.");
  }
  return decodePixel(r, g, b, alpha);
}

async function readResponse(
  response: Response,
  signal: AbortSignal,
): Promise<Blob> {
  if (!response.ok)
    throw new Error(`Tile de terreno indisponível (${response.status}).`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_TILE_BYTES)
    throw new Error("Tile de terreno excede o limite.");
  if (!response.body) {
    const blob = await response.blob();
    if (blob.size > MAX_TILE_BYTES)
      throw new Error("Tile de terreno excede o limite.");
    return blob;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      if (signal.aborted)
        throw signal.reason ?? new DOMException("Abortado", "AbortError");
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_TILE_BYTES)
        throw new Error("Tile de terreno excede o limite.");
      chunks.push(part.value);
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new Blob([bytes], {
    type: response.headers.get("content-type") ?? "image/png",
  });
}

async function decodePng(
  blob: Blob,
  signal?: AbortSignal,
): Promise<Uint8ClampedArray> {
  throwIfAborted(signal);
  const header = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  if (
    header.length < 24 ||
    header[0] !== 0x89 ||
    header[1] !== 0x50 ||
    header[2] !== 0x4e ||
    header[3] !== 0x47 ||
    header[4] !== 0x0d ||
    header[5] !== 0x0a ||
    header[6] !== 0x1a ||
    header[7] !== 0x0a ||
    header[12] !== 0x49 ||
    header[13] !== 0x48 ||
    header[14] !== 0x44 ||
    header[15] !== 0x52 ||
    new DataView(header.buffer).getUint32(16) !== TILE_SIZE ||
    new DataView(header.buffer).getUint32(20) !== TILE_SIZE
  ) {
    throw new Error("Cabeçalho PNG de terreno inválido.");
  }
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob, {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none",
      });
      try {
        throwIfAborted(signal);
        if (bitmap.width !== TILE_SIZE || bitmap.height !== TILE_SIZE)
          throw new Error("Dimensão PNG inválida.");
        return pixelsFromBitmap(bitmap);
      } finally {
        bitmap.close();
      }
    } catch (error) {
      if (signal?.aborted)
        throw signal.reason ?? new DOMException("Abortado", "AbortError");
      if (error instanceof Error && error.message === "Dimensão PNG inválida.")
        throw error;
      // Older WebKit may expose ImageBitmap but reject decoding options or its
      // 2D canvas; retry with the bounded DOM image path below.
    }
  }
  return pixelsFromDomImage(blob, signal);
}

function pixelsFromBitmap(bitmap: ImageBitmap): Uint8ClampedArray {
  const canvas =
    typeof OffscreenCanvas === "function"
      ? new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
      : typeof document !== "undefined"
        ? document.createElement("canvas")
        : null;
  if (!canvas) throw new Error("Canvas de terreno indisponível.");
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas de terreno indisponível.");
  context.drawImage(bitmap, 0, 0);
  return context.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
}

async function pixelsFromDomImage(
  blob: Blob,
  signal?: AbortSignal,
): Promise<Uint8ClampedArray> {
  if (
    typeof document === "undefined" ||
    typeof URL.createObjectURL !== "function"
  )
    throw new Error("Decodificador de imagem indisponível.");
  throwIfAborted(signal);
  const image = document.createElement("img");
  const objectUrl = URL.createObjectURL(blob);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (message: string) => {
        cleanup();
        reject(new Error(message));
      };
      const abort = () => {
        cleanup();
        reject(signal?.reason ?? new DOMException("Abortado", "AbortError"));
      };
      const cleanup = () => {
        if (timer !== undefined) clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        signal?.removeEventListener("abort", abort);
      };
      image.onload = () => {
        cleanup();
        resolve();
      };
      image.onerror = () =>
        fail("Não foi possível decodificar o tile de terreno.");
      timer = setTimeout(
        () => fail("Tempo limite ao decodificar o tile de terreno."),
        IMAGE_DECODE_TIMEOUT_MS,
      );
      if (signal?.aborted) {
        abort();
        return;
      }
      signal?.addEventListener("abort", abort, { once: true });
      image.src = objectUrl;
    });
    throwIfAborted(signal);
    if (image.naturalWidth !== TILE_SIZE || image.naturalHeight !== TILE_SIZE)
      throw new Error("Dimensão PNG inválida.");
    const canvas = document.createElement("canvas");
    canvas.width = TILE_SIZE;
    canvas.height = TILE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas de terreno indisponível.");
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, TILE_SIZE, TILE_SIZE).data;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted)
    throw signal.reason ?? new DOMException("Abortado", "AbortError");
}

function makeTimeoutSignal(
  parent: AbortSignal | undefined,
  timeoutMs = REQUEST_TIMEOUT_MS,
): {
  signal: AbortSignal;
  abort: (reason?: unknown) => void;
  dispose: () => void;
} {
  const controller = new AbortController();
  const abort = () =>
    controller.abort(
      parent?.reason ?? new DOMException("Abortado", "AbortError"),
    );
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(
    () => controller.abort(new DOMException("Tempo esgotado", "TimeoutError")),
    timeoutMs,
  );
  return {
    signal: controller.signal,
    abort: (reason) => controller.abort(reason),
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    },
  };
}

async function fetchTile(
  z: number,
  x: number,
  y: number,
  parent?: AbortSignal,
): Promise<DecodedTile> {
  if (parent?.aborted)
    throw parent.reason ?? new DOMException("Abortado", "AbortError");
  const key = tileKey(z, x, y);
  const existing = tileMemory.get(key);
  if (existing) return existing;
  const timeout = makeTimeoutSignal(parent);
  try {
    const response = await fetch(tileUrl(z, x, y), {
      signal: timeout.signal,
      mode: "cors",
      credentials: "omit",
      redirect: "error",
    });
    const rgba = await decodePng(
      await readResponse(response, timeout.signal),
      timeout.signal,
    );
    if (timeout.signal.aborted)
      throw timeout.signal.reason ?? new DOMException("Abortado", "AbortError");
    const tile = { z, x, y, rgba };
    tileMemory.set(key, tile);
    while (tileMemory.size > 8)
      tileMemory.delete(tileMemory.keys().next().value as string);
    return tile;
  } finally {
    timeout.dispose();
  }
}

function sampleTile(
  tile: DecodedTile,
  lon: number,
  lat: number,
): number | null {
  const n = 2 ** tile.z;
  const globalX = ((lon + 180) / 360) * n;
  const globalY =
    ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
  const px = Math.max(0, Math.min(255, Math.floor((globalX - tile.x) * 256)));
  const py = Math.max(0, Math.min(255, Math.floor((globalY - tile.y) * 256)));
  const offset = (py * 256 + px) * 4;
  return decodePixel(
    tile.rgba[offset],
    tile.rgba[offset + 1],
    tile.rgba[offset + 2],
    tile.rgba[offset + 3],
  );
}

export async function getTerrainPoint(
  lon: number,
  lat: number,
  signal?: AbortSignal,
): Promise<{ elevationMeters: number | null; resolutionMeters: number }> {
  if (
    !finite(lon) ||
    !finite(lat) ||
    lon < -180 ||
    lon > 180 ||
    lat < -85.051129 ||
    lat > 85.051129
  ) {
    throw new Error("Coordenada de terreno inválida.");
  }
  const zoom = 12;
  const [x, y] = tileXY(lon, lat, zoom);
  const elevationMeters = sampleTile(
    await fetchTile(zoom, x, y, signal),
    lon,
    lat,
  );
  if (signal?.aborted)
    throw signal.reason ?? new DOMException("Abortado", "AbortError");
  return {
    elevationMeters,
    resolutionMeters: 40_075_016.686 / (256 * 2 ** zoom),
  };
}

function tileRange(
  bounds: TerrainBounds,
  zoom: number,
): Array<[number, number]> {
  const [west, south, east, north] = bounds;
  const [x0, y0] = tileXY(west, north, zoom);
  const [x1, y1] = tileXY(east, south, zoom);
  const count = (x1 - x0 + 1) * (y1 - y0 + 1);
  if (count > MAX_TILES) return [];
  const result: Array<[number, number]> = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) result.push([x, y]);
  return result;
}

function chooseZoom(bounds: TerrainBounds): {
  zoom: number;
  tiles: Array<[number, number]>;
} {
  for (let zoom = 12; zoom >= 0; zoom--) {
    const tiles = tileRange(bounds, zoom);
    if (tiles.length > 0 && tiles.length <= MAX_TILES) return { zoom, tiles };
  }
  throw new Error("Área de terreno excede 64 tiles.");
}

function gridBytes(grid: TerrainGrid): number {
  return new TextEncoder().encode(JSON.stringify(grid)).byteLength;
}

function gridResolution(
  bounds: TerrainBounds,
  width: number,
  height: number,
): number {
  const midLat = (((bounds[1] + bounds[3]) / 2) * Math.PI) / 180;
  const lonMeters =
    (Math.abs(bounds[2] - bounds[0]) * 111_320 * Math.cos(midLat)) /
    (width - 1);
  const latMeters = (Math.abs(bounds[3] - bounds[1]) * 111_320) / (height - 1);
  return Math.max(lonMeters, latMeters);
}

function validateGrid(
  grid: unknown,
  regionId: string,
  bounds: TerrainBounds,
): TerrainGrid {
  if (!grid || typeof grid !== "object")
    throw new Error("Grade de terreno ausente.");
  const value = grid as TerrainGrid;
  assertBounds(bounds);
  const m = value.metadata;
  if (
    value.schemaVersion !== 1 ||
    value.regionId !== regionId ||
    !m ||
    m.source !== "aws-terrain-tiles" ||
    !Number.isInteger(m.tileZoom) ||
    m.tileZoom < 0 ||
    m.tileZoom > 12 ||
    !validBounds(m.bounds) ||
    m.bounds.some((v, i) => Math.abs(v - bounds[i]) > 1e-7) ||
    m.sourceVersion !== SOURCE_VERSION ||
    !Number.isInteger(m.width) ||
    !Number.isInteger(m.height) ||
    m.width < 2 ||
    m.height < 2 ||
    m.width * m.height > MAX_GRID_CELLS ||
    !Array.isArray(value.values) ||
    value.values.length !== m.width * m.height ||
    !finite(m.resolutionMeters) ||
    m.resolutionMeters <= 0 ||
    typeof m.attribution !== "string" ||
    !m.attribution ||
    typeof m.license !== "string" ||
    !m.license ||
    typeof m.sourceUrl !== "string" ||
    !m.sourceUrl ||
    typeof m.verticalDatum !== "string" ||
    !m.verticalDatum ||
    m.attribution.length > 400 ||
    m.license.length > 300 ||
    m.sourceUrl.length > 500 ||
    m.verticalDatum.length > 120
  ) {
    throw new Error("Metadados da grade de terreno inválidos.");
  }
  let validSamples = 0;
  for (const sample of value.values) {
    if (
      !Number.isInteger(sample) ||
      (sample !== NO_DATA && (sample < -12_000 || sample > 12_000))
    )
      throw new Error("Amostra de terreno inválida.");
    if (sample !== NO_DATA) validSamples++;
  }
  if (!validSamples) throw new Error("Grade de terreno sem amostras válidas.");
  if (gridBytes(value) > MAX_GRID_BYTES)
    throw new Error("Grade de terreno excede o limite.");
  return value;
}

function cacheRequest(regionId: string, bounds: TerrainBounds): Request {
  const origin = globalThis.location?.origin ?? "https://markmap.local";
  return new Request(
    `${origin}/__markmap-terrain/${SOURCE_VERSION}/${encodeURIComponent(regionId)}/${bounds.join(",")}`,
  );
}

async function digest(body: string): Promise<string> {
  const bytes = new TextEncoder().encode(body);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}

export async function getCachedTerrainGrid(
  regionId: string,
  bounds: TerrainBounds,
): Promise<TerrainGrid | null> {
  assertBounds(bounds);
  if (typeof caches === "undefined") return null;
  const response = await caches
    .open(CACHE_NAME)
    .then((cache) => cache.match(cacheRequest(regionId, bounds)));
  if (!response) return null;
  let body: string;
  try {
    body = await readCacheBody(response);
  } catch {
    return null;
  }
  const expected = response.headers.get("x-markmap-sha256");
  if (!expected || expected !== (await digest(body))) return null;
  try {
    return validateGrid(JSON.parse(body), regionId, bounds);
  } catch {
    return null;
  }
}

async function readCacheBody(response: Response): Promise<string> {
  if (!response.body) {
    const blob = await response.blob();
    if (blob.size > MAX_GRID_BYTES)
      throw new Error("Cache de terreno excede o limite.");
    return await blob.text();
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > MAX_GRID_BYTES) {
        await reader.cancel();
        throw new Error("Cache de terreno excede o limite.");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function downloadTerrainGrid(options: {
  regionId: string;
  bounds: TerrainBounds;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}): Promise<TerrainGrid> {
  const { regionId, bounds, signal, onProgress } = options;
  if (!regionId.trim()) throw new Error("Região de terreno inválida.");
  assertBounds(bounds);
  const { zoom, tiles } = chooseZoom(bounds);
  const decoded: DecodedTile[] = [];
  if (typeof caches === "undefined")
    throw new Error(
      "Cache API indisponível; não é possível baixar altitude offline.",
    );
  const deadline = makeTimeoutSignal(signal, DOWNLOAD_TIMEOUT_MS);
  try {
    let next = 0;
    let completed = 0;
    const worker = async () => {
      for (;;) {
        const i = next++;
        if (i >= tiles.length) return;
        if (deadline.signal.aborted)
          throw (
            deadline.signal.reason ?? new DOMException("Abortado", "AbortError")
          );
        decoded[i] = await fetchTile(
          zoom,
          tiles[i][0],
          tiles[i][1],
          deadline.signal,
        );
        onProgress?.(++completed, tiles.length);
      }
    };
    try {
      await Promise.all(
        Array.from({ length: Math.min(4, tiles.length) }, worker),
      );
    } catch (error) {
      deadline.abort(error);
      throw error;
    }
  } finally {
    deadline.dispose();
  }
  const width = 256,
    height = 256;
  const values: number[] = [];
  for (let row = 0; row < height; row++) {
    const lat = bounds[1] + (row / (height - 1)) * (bounds[3] - bounds[1]);
    for (let col = 0; col < width; col++) {
      const lon = bounds[0] + (col / (width - 1)) * (bounds[2] - bounds[0]);
      const [x, y] = tileXY(lon, lat, zoom);
      const tile = decoded.find(
        (candidate) => candidate.x === x && candidate.y === y,
      );
      const sample = tile ? sampleTile(tile, lon, lat) : null;
      if (deadline.signal.aborted)
        throw (
          deadline.signal.reason ?? new DOMException("Abortado", "AbortError")
        );
      values.push(sample === null ? NO_DATA : Math.round(sample));
    }
  }
  const grid = validateGrid(
    {
      schemaVersion: 1,
      regionId,
      metadata: {
        bounds,
        width,
        height,
        noDataValue: NO_DATA,
        resolutionMeters: Math.max(
          gridResolution(bounds, width, height),
          40_075_016.686 / (256 * 2 ** zoom),
        ),
        attribution: ATTRIBUTION,
        license: LICENSE,
        sourceUrl: SOURCE_URL,
        verticalDatum: VERTICAL_DATUM,
        source: "aws-terrain-tiles",
        sourceVersion: SOURCE_VERSION,
        tileZoom: zoom,
      },
      values,
    },
    regionId,
    bounds,
  );
  const body = JSON.stringify(grid);
  const sha = await digest(body);
  const cache = await caches.open(CACHE_NAME);
  const request = cacheRequest(regionId, bounds);
  const entries = await cache.keys();
  let existingBytes = 0;
  for (const entry of entries) {
    if (entry.url === request.url) continue;
    const existing = await cache.match(entry);
    if (existing) {
      try {
        existingBytes += new TextEncoder().encode(
          await readCacheBody(existing.clone()),
        ).byteLength;
      } catch {
        existingBytes = MAX_CACHE_BYTES + 1;
        break;
      }
    }
    if (existingBytes > MAX_CACHE_BYTES) break;
  }
  const otherEntries = entries.filter((entry) => entry.url !== request.url);
  if (
    otherEntries.length >= MAX_CACHE_ENTRIES ||
    existingBytes + new TextEncoder().encode(body).byteLength > MAX_CACHE_BYTES
  ) {
    throw new Error("Orçamento do cache de altitude excedido.");
  }
  if (signal?.aborted || deadline.signal.aborted)
    throw (
      signal?.reason ??
      deadline.signal.reason ??
      new DOMException("Abortado", "AbortError")
    );
  await cache.put(
    request,
    new Response(body, {
      headers: {
        "content-type": "application/json",
        "x-markmap-sha256": sha,
      },
    }),
  );
  return grid;
}

export async function removeCachedTerrainGrid(
  regionId: string,
  bounds: TerrainBounds,
): Promise<void> {
  assertBounds(bounds);
  if (typeof caches !== "undefined")
    await caches
      .open(CACHE_NAME)
      .then((cache) => cache.delete(cacheRequest(regionId, bounds)));
}
