import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderGeoTiffOverlay } from './geotiff-overlay';

vi.mock('@markmap/maps', () => ({
  adaptiveMapBudget: vi.fn(() => ({ tier: 'constrained', maxCanvasSize: [2048, 2048] })),
  readMapDeviceHints: vi.fn(() => ({})),
  readGeoTiffRasterPreview: vi.fn().mockResolvedValue({ width: 2, height: 2, samplesPerPixel: 1, crs: 4326, bounds: [-48, -16, -47, -15], geoKeys: {}, rgba: new Uint8Array(16) }),
}));

describe('GeoTIFF overlay adapter', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('creates MapLibre image coordinates and releases the object URL', async () => {
    vi.stubGlobal('Worker', undefined);
    const revoked: string[] = [];
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:local-tiff'), revokeObjectURL: vi.fn((url: string) => revoked.push(url)) });
    const canvas = { width: 0, height: 0, getContext: () => ({ putImageData: vi.fn() }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['png'])) };
    vi.stubGlobal('document', { createElement: () => canvas });
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
    const overlay = await renderGeoTiffOverlay(Object.assign(new Blob(['tiff']), { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }) as Blob);
    const { readGeoTiffRasterPreview } = await import('@markmap/maps');
    expect(vi.mocked(readGeoTiffRasterPreview)).toHaveBeenCalledWith(
      expect.anything(), expect.objectContaining({ maxPreviewDimension: 2048, maxPreviewPixels: 2_000_000 }),
    );
    expect(overlay.coordinates).toEqual([[-48, -15], [-47, -15], [-47, -16], [-48, -16]]);
    overlay.release();
    expect(revoked).toEqual(['blob:local-tiff']);
  });

  it('rejects invalid per-axis limits before decoding or creating a canvas', async () => {
    await expect(renderGeoTiffOverlay(new Blob(['tiff']), { maxPreviewDimension: -1 }))
      .rejects.toThrow('Limite inválido de dimensão');
  });

  it('fails closed for an oversized or inconsistent worker/decoder preview', async () => {
    vi.stubGlobal('Worker', undefined);
    const { readGeoTiffRasterPreview } = await import('@markmap/maps');
    vi.mocked(readGeoTiffRasterPreview).mockResolvedValueOnce({
      width: 3000, height: 1, samplesPerPixel: 1, crs: 4326,
      bounds: [-48, -16, -47, -15], geoKeys: {}, rgba: new Uint8Array(12_000),
    });
    await expect(renderGeoTiffOverlay(new Blob(['tiff'])))
      .rejects.toThrow('Prévia GeoTIFF excede os limites');
  });

  it('rejects projected CRS instead of misplacing it', async () => {
    vi.stubGlobal('Worker', undefined);
    const { readGeoTiffRasterPreview } = await import('@markmap/maps');
    vi.mocked(readGeoTiffRasterPreview).mockResolvedValueOnce({
      width: 1,
      height: 1,
      samplesPerPixel: 1,
      crs: 31983,
      bounds: [-5000000, -1000000, -4999999, -999999],
      geoKeys: {},
      rgba: new Uint8Array(4),
    });

    await expect(
      renderGeoTiffOverlay(
        Object.assign(new Blob(['tiff']), {
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
        }) as Blob,
      ),
    ).rejects.toThrow('EPSG:4326');
  });

  it('decodes the original when worker construction is blocked', async () => {
    const { readGeoTiffRasterPreview } = await import('@markmap/maps');
    const rasterMock = vi.mocked(readGeoTiffRasterPreview);
    rasterMock.mockClear();
    vi.stubGlobal('Worker', class { constructor() { throw new Error('Worker blocked'); } });
    const revoked: string[] = [];
    const NativeURL = globalThis.URL;
    vi.stubGlobal('URL', class extends NativeURL {
      static createObjectURL() { return 'blob:local-fallback'; }
      static revokeObjectURL(url: string) { revoked.push(url); }
    });
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ putImageData: vi.fn() }),
      toBlob: (callback: (value: Blob | null) => void) => callback(new Blob(['png'])),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
    const overlay = await renderGeoTiffOverlay(new Blob(['tiff']));
    expect(rasterMock).toHaveBeenCalledTimes(1);
    expect(overlay.coordinates).toEqual([[-48, -15], [-47, -15], [-47, -16], [-48, -16]]);
    overlay.release();
    expect(revoked).toEqual(['blob:local-fallback']);
  });

  it('falls back if Web Worker starts but stalls, then terminates it', async () => {
    const { readGeoTiffRasterPreview } = await import('@markmap/maps');
    const rasterMock = vi.mocked(readGeoTiffRasterPreview);
    rasterMock.mockClear();
    const terminate = vi.fn();
    const posted = vi.fn();
    class HangingWorker {
      postMessage() { posted(); /* Simulates an idle worker in a WebView. */ }
      terminate() { terminate(); }
    }
    vi.stubGlobal('Worker', HangingWorker);
    const revoked: string[] = [];
    const NativeURL = globalThis.URL;
    vi.stubGlobal('URL', class extends NativeURL {
      static createObjectURL() { return 'blob:local-stalled'; }
      static revokeObjectURL(url: string) { revoked.push(url); }
    });
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ putImageData: vi.fn() }),
      toBlob: (callback: (value: Blob | null) => void) => callback(new Blob(['png'])),
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
    vi.useFakeTimers();
    const pending = renderGeoTiffOverlay(new Blob(['tiff']));
    // Wait for the worker message; the OPFS preflight can be asynchronous.
    await vi.waitFor(() => expect(posted).toHaveBeenCalledTimes(1), { timeout: 3000 });
    await vi.advanceTimersByTimeAsync(90_000);
    const overlay = await pending;
    expect(rasterMock).toHaveBeenCalledTimes(1);
    expect(terminate).toHaveBeenCalledTimes(1);
    overlay.release();
    expect(revoked).toEqual(['blob:local-stalled']);
  });

});
