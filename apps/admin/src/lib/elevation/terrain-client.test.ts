import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeTerrariumPixel,
  getCachedTerrainGrid,
  getTerrainPoint,
  type TerrainBounds,
} from './terrain-client';

const bounds: TerrainBounds = [-48.3, -7.3, -48.1, -7.1];

if (!Blob.prototype.arrayBuffer) {
  Object.defineProperty(Blob.prototype, 'arrayBuffer', { value: function (): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this as Blob);
    });
  } });
}

describe('terrain-client', () => {
  beforeEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function pngResponse(): Response {
    const bytes = new Uint8Array(32);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    new DataView(bytes.buffer).setUint32(16, 256);
    new DataView(bytes.buffer).setUint32(20, 256);
    return new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } });
  }

  function domDecoder({ fail = false, pending = false } = {}) {
    const pixels = new Uint8ClampedArray(256 * 256 * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([128, 254, 0, 255], offset);
    const context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: pixels })) };
    const image: Record<string, unknown> = { naturalWidth: 256, naturalHeight: 256, onload: null, onerror: null };
    Object.defineProperty(image, 'src', { set: () => { if (pending) return; queueMicrotask(() => fail ? (image.onerror as (() => void))?.() : (image.onload as (() => void))?.()); } });
    const createElement = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'img') return image as unknown as HTMLElement;
      if (tag === 'canvas') return { width: 0, height: 0, getContext: () => context } as unknown as HTMLElement;
      return document.createElement(tag);
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:terrain-test');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    return { context, createElement, createObjectURL, revokeObjectURL };
  }

  it('decodes Terrarium RGB with fractional meters and treats transparent pixels as no-data', () => {
    expect(decodeTerrariumPixel(128, 254, 0)).toBe(254);
    expect(decodeTerrariumPixel(128, 254, 128)).toBe(254.5);
    expect(decodeTerrariumPixel(0, 0, 0, 0)).toBeNull();
    expect(() => decodeTerrariumPixel(256, 0, 0)).toThrow();
  });

  it('rejects invalid points before making a network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getTerrainPoint(181, -7)).rejects.toThrow(/Coordenada/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized PNG response before image decoding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {
      status: 200,
      headers: { 'content-length': String(512 * 1024 + 1) },
    })));
    await expect(getTerrainPoint(-48.2, -7.2)).rejects.toThrow(/excede o limite/);
  });

  it('uses the DOM image/canvas fallback when ImageBitmap is unavailable', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const fallback = domDecoder();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pngResponse()));
    await expect(getTerrainPoint(10, 10)).resolves.toMatchObject({ elevationMeters: 254 });
    expect(fallback.revokeObjectURL).toHaveBeenCalledWith('blob:terrain-test');
    expect(fallback.context.drawImage).toHaveBeenCalledOnce();
  });

  it('falls back when ImageBitmap rejects and cleans the object URL on decode failure', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('unsupported ImageBitmap options')));
    const fallback = domDecoder({ fail: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pngResponse()));
    await expect(getTerrainPoint(20, 10)).rejects.toThrow(/decodificar o tile/);
    expect(fallback.revokeObjectURL).toHaveBeenCalledWith('blob:terrain-test');
  });

  it('keeps the modern ImageBitmap path and Terrarium result', async () => {
    const pixels = new Uint8ClampedArray(256 * 256 * 4);
    for (let offset = 0; offset < pixels.length; offset += 4) pixels.set([128, 254, 0, 255], offset);
    const context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: pixels })) };
    class FakeOffscreenCanvas { width = 0; height = 0; getContext() { return context; } }
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 256, height: 256, close: vi.fn() }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pngResponse()));
    await expect(getTerrainPoint(30, 10)).resolves.toMatchObject({ elevationMeters: 254 });
    expect(context.drawImage).toHaveBeenCalledOnce();
    const controller = new AbortController();
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockImplementation(async () => {
      controller.abort();
      return { width: 256, height: 256, close };
    }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pngResponse()));
    await expect(getTerrainPoint(31, 10, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('aborts a pending DOM image decode and revokes its object URL promptly', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    const fallback = domDecoder({ pending: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(pngResponse()));
    const controller = new AbortController();
    const pending = getTerrainPoint(40, 10, controller.signal);
    await vi.waitFor(() => expect(fallback.createObjectURL).toHaveBeenCalledOnce());
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(fallback.revokeObjectURL).toHaveBeenCalledWith('blob:terrain-test');
  });

  it('rejects a cache entry whose body checksum does not match', async () => {
    const response = new Response('{"schemaVersion":1}', {
      headers: { 'x-markmap-sha256': 'deadbeef' },
    });
    const match = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match }) });
    await expect(getCachedTerrainGrid('araguaina', bounds)).resolves.toBeNull();
    expect(match).toHaveBeenCalledOnce();
  });

  it('reads a valid cached grid and rejects a bounds identity mismatch', async () => {
    const grid = {
      schemaVersion: 1 as const,
      regionId: 'araguaina',
      metadata: {
        bounds, width: 2, height: 2, noDataValue: -32768, resolutionMeters: 20,
        attribution: 'Terrain Tiles', license: 'Open data', sourceUrl: 'https://example.test/source',
        verticalDatum: 'composite', source: 'aws-terrain-tiles' as const, sourceVersion: 'mapzen-terrain-tiles-v1', tileZoom: 8,
      },
      values: [240, 241, 242, 243],
    };
    const body = JSON.stringify(grid);
    const bytes = new TextEncoder().encode(body);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((value) => value.toString(16).padStart(2, '0')).join('');
    const match = vi.fn().mockResolvedValue(new Response(body, { headers: { 'x-markmap-sha256': hash } }));
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match }) });
    await expect(getCachedTerrainGrid('araguaina', bounds)).resolves.toEqual(grid);
    await expect(getCachedTerrainGrid('araguaina', [-48.4, -7.3, -48.1, -7.1])).resolves.toBeNull();
  });

  it('returns null when the Cache API is unavailable', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(getCachedTerrainGrid('araguaina', bounds)).resolves.toBeNull();
  });
});
