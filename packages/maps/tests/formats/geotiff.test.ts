import { describe, expect, it } from 'vitest';
import { writeArrayBuffer } from 'geotiff';
import { isGeoTiffSignature, readGeoTiffMetadata, readGeoTiffRasterPreview, validateGeoTiffInput } from '../../src/formats/geotiff.js';

describe('bounded GeoTIFF input', () => {
  it('recognizes both TIFF byte orders', () => {
    expect(isGeoTiffSignature(new Uint8Array([0x49, 0x49, 0x2a, 0x00]))).toBe(true);
    expect(isGeoTiffSignature(new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]))).toBe(true);
    expect(isGeoTiffSignature(new Uint8Array([0, 0, 0, 0]))).toBe(false);
  });

  it('rejects truncated and oversized local input', () => {
    expect(() => validateGeoTiffInput(new Uint8Array(7))).toThrow('too small');
    expect(() => validateGeoTiffInput(new Uint8Array(8), { maxBytes: 7 })).toThrow('byte limit');
  });

  it('extracts local image metadata, geographic CRS, and bounds', async () => {
    const input = writeArrayBuffer([1, 2, 3, 4], {
      width: 2, height: 2, SamplesPerPixel: 1,
      ModelPixelScale: [10, 10, 0], ModelTiepoint: [0, 0, 0, -48, -16, 0],
      GeographicTypeGeoKey: 4326,
    });
    await expect(readGeoTiffMetadata(input)).resolves.toMatchObject({
      width: 2, height: 2, samplesPerPixel: 1, crs: 4326,
      bounds: [-48, -36, -28, -16],
    });
  });

  it('decodes a bounded local RGBA preview', async () => {
    const input = writeArrayBuffer([20, 40, 60, 80], { width: 2, height: 2, SamplesPerPixel: 1 });
    await expect(readGeoTiffRasterPreview(input, { maxPixels: 4 })).resolves.toMatchObject({
      width: 2, height: 2, rgba: new Uint8Array([20, 20, 20, 255, 40, 40, 40, 255, 60, 60, 60, 255, 80, 80, 80, 255]),
    });
    await expect(readGeoTiffRasterPreview(input, { maxPixels: 3 })).rejects.toThrow('pixel limit');
  });
});