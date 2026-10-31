import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderGeoTiffOverlay } from './geotiff-overlay';

vi.mock('@markmap/maps', () => ({
  adaptiveMapBudget: vi.fn(() => ({ tier: 'constrained' })),
  readMapDeviceHints: vi.fn(() => ({})),
  readGeoTiffRasterPreview: vi.fn().mockResolvedValue({ width: 2, height: 2, samplesPerPixel: 1, crs: 4326, bounds: [-48, -16, -47, -15], geoKeys: {}, rgba: new Uint8Array(16) }),
}));

describe('GeoTIFF overlay adapter', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('creates MapLibre image coordinates and releases the object URL', async () => {
    vi.stubGlobal('Worker', undefined);
    const revoked: string[] = [];
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:local-tiff'), revokeObjectURL: vi.fn((url: string) => revoked.push(url)) });
    const canvas = { width: 0, height: 0, getContext: () => ({ putImageData: vi.fn() }), toBlob: (callback: (blob: Blob) => void) => callback(new Blob(['png'])) };
    vi.stubGlobal('document', { createElement: () => canvas });
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });
    const overlay = await renderGeoTiffOverlay(Object.assign(new Blob(['tiff']), { arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) }) as Blob);
    expect(overlay.coordinates).toEqual([[-48, -15], [-47, -15], [-47, -16], [-48, -16]]);
    overlay.release();
    expect(revoked).toEqual(['blob:local-tiff']);
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
});
