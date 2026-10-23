import { beforeEach, describe, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";

type CacheEntry = { request: Request; response: Response };

const bounds: [number, number, number, number] = [-48.3, -7.3, -48.1, -7.1];

function pngHeader(): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48,
    0x44, 0x52,
  ]);
  new DataView(bytes.buffer).setUint32(16, 256);
  new DataView(bytes.buffer).setUint32(20, 256);
  return bytes;
}

function installImageDecoder(rgba = [128, 254, 128, 255]) {
  const data = new Uint8ClampedArray(256 * 256 * 4);
  for (let offset = 0; offset < data.length; offset += 4)
    data.set(rgba, offset);
  const getImageData = vi.fn(() => ({ data }));
  const getContext = vi.fn(() => ({ drawImage: vi.fn(), getImageData }));
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 256, height: 256, close: vi.fn() })),
  );
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      width = 0;
      height = 0;
      getContext = getContext;
    },
  );
  return { getImageData };
}

function installCache(initial: CacheEntry[] = []) {
  const entries = new Map(
    initial.map(({ request, response }) => [
      request.url,
      { request, response },
    ]),
  );
  const cache = {
    match: vi.fn(async (request: Request) =>
      entries.get(request.url)?.response.clone(),
    ),
    put: vi.fn(async (request: Request, response: Response) => {
      entries.set(request.url, {
        request: request.clone(),
        response: response.clone(),
      });
    }),
    delete: vi.fn(async (request: Request) => entries.delete(request.url)),
    keys: vi.fn(async () =>
      [...entries.values()].map(({ request }) => request.clone()),
    ),
  };
  vi.stubGlobal("caches", { open: vi.fn(async () => cache) });
  return { cache, entries };
}

function installTileFetch() {
  const response = new Response(pngHeader().buffer as ArrayBuffer, {
    status: 200,
    headers: { "content-type": "image/png", "content-length": "24" },
  });
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    expect(url).toMatch(
      /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\/terrarium\//,
    );
    expect(init?.credentials).toBe("omit");
    expect(init?.redirect).toBe("error");
    return response.clone();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function sha256(body: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(body),
  );
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

describe("terrain-client public storage integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.stubGlobal("Blob", NodeBlob);
    installImageDecoder();
  });

  it("downloads a grid, persists it, then reads it after a module reload without network", async () => {
    const { cache } = installCache();
    const fetchMock = installTileFetch();
    const client = await import("./terrain-client");
    const grid = await client.downloadTerrainGrid({
      regionId: "araguaina",
      bounds,
    });
    expect(grid.metadata.sourceVersion).toBe("mapzen-terrain-tiles-v1");
    expect(Number.isFinite(grid.metadata.resolutionMeters)).toBe(true);
    expect(cache.put).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(64);
    const networkCallsBeforeOfflineRead = fetchMock.mock.calls.length;
    vi.resetModules();
    fetchMock.mockRejectedValue(
      new Error("network must not be used for cached read"),
    );
    const reloaded = await import("./terrain-client");
    await expect(
      reloaded.getCachedTerrainGrid("araguaina", bounds),
    ).resolves.toEqual(grid);
    expect(fetchMock.mock.calls.length).toBe(networkCallsBeforeOfflineRead);
  });

  it("rejects corrupted and wrong-identity cache bodies", async () => {
    const { cache, entries } = installCache();
    const client = await import("./terrain-client");
    const request = new Request(
      `${location.origin}/__markmap-terrain/mapzen-terrain-tiles-v1/araguaina/${bounds.join(",")}`,
    );
    entries.set(request.url, {
      request,
      response: new Response('{"schemaVersion":1}', {
        headers: { "x-markmap-sha256": "00" },
      }),
    });
    await expect(
      client.getCachedTerrainGrid("araguaina", bounds),
    ).resolves.toBeNull();
    const body = JSON.stringify({
      schemaVersion: 1,
      regionId: "other",
      metadata: {
        bounds,
        width: 2,
        height: 2,
        noDataValue: -32768,
        resolutionMeters: 20,
        attribution: "x",
        license: "x",
        sourceUrl: "https://example.test",
        verticalDatum: "x",
        source: "aws-terrain-tiles",
        sourceVersion: "mapzen-terrain-tiles-v1",
        tileZoom: 8,
      },
      values: [1, 2, 3, 4],
    });
    entries.set(request.url, {
      request,
      response: new Response(body, {
        headers: { "x-markmap-sha256": await sha256(body) },
      }),
    });
    await expect(
      client.getCachedTerrainGrid("araguaina", bounds),
    ).resolves.toBeNull();
    expect(cache.match).toHaveBeenCalledTimes(2);
  });

  it("fails closed when Cache API is unavailable and does not put after abort", async () => {
    const client = await import("./terrain-client");
    vi.stubGlobal("caches", undefined);
    await expect(
      client.downloadTerrainGrid({ regionId: "araguaina", bounds }),
    ).rejects.toThrow(/Cache API indisponível/);
    const { cache } = installCache();
    const controller = new AbortController();
    controller.abort(new DOMException("cancelled", "AbortError"));
    await expect(
      client.downloadTerrainGrid({
        regionId: "araguaina",
        bounds,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it("bounds world tile enumeration to 64 and reports coarse honest resolution", async () => {
    const { cache } = installCache();
    const fetchMock = installTileFetch();
    const client = await import("./terrain-client");
    const world: [number, number, number, number] = [-180, -80, 180, 80];
    const grid = await client.downloadTerrainGrid({
      regionId: "world",
      bounds: world,
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(64);
    expect(grid.metadata.tileZoom).toBeLessThan(12);
    expect(grid.values.some((value) => value !== -32768)).toBe(true);
    expect(grid.metadata.resolutionMeters).toBeGreaterThan(100_000);
    expect(cache.put).toHaveBeenCalledOnce();
  });

  it("adapts a published state extent to a bounded lower zoom", async () => {
    const { cache } = installCache();
    const fetchMock = installTileFetch();
    const client = await import("./terrain-client");
    const tocantins: [number, number, number, number] = [
      -50.7389, -13.693, -45.6993, -5.1684,
    ];
    const grid = await client.downloadTerrainGrid({
      regionId: "br-uf-to",
      bounds: tocantins,
    });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(64);
    expect(grid.metadata.tileZoom).toBeLessThan(12);
    expect(grid.values.some((value) => value !== -32768)).toBe(true);
    expect(Number.isFinite(grid.metadata.resolutionMeters)).toBe(true);
    expect(cache.put).toHaveBeenCalledOnce();
  });

  it("rejects a non-PNG response before image decoding and respects the 64-entry quota", async () => {
    const decoder = installImageDecoder();
    const fetchMock = vi.fn(
      async () =>
        new Response("not png", {
          status: 200,
          headers: { "content-type": "image/png" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    installCache();
    const client = await import("./terrain-client");
    await expect(
      client.downloadTerrainGrid({ regionId: "invalid-png", bounds }),
    ).rejects.toThrow(/Cabeçalho PNG/);
    expect(decoder.getImageData).not.toHaveBeenCalled();

    installTileFetch();
    const entries = Array.from({ length: 64 }, (_, i) => ({
      request: new Request(`${location.origin}/terrain/${i}`),
      response: new Response("x"),
    }));
    const { cache } = installCache(entries);
    await expect(
      client.downloadTerrainGrid({ regionId: "quota", bounds }),
    ).rejects.toThrow(/Orçamento/);
    expect(cache.put).not.toHaveBeenCalled();
    expect(cache.delete).not.toHaveBeenCalled();
  });
});
