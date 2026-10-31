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
  it('resamples GeoTIFF preview within a pixel budget without changing source metadata', async () => {
    const input = writeArrayBuffer(Array.from({ length: 16 }, (_, i) => i + 1), {
      width: 4, height: 4, SamplesPerPixel: 1,
      ModelPixelScale: [1, 1, 0], ModelTiepoint: [0, 0, 0, -48, -16, 0],
      GeographicTypeGeoKey: 4326,
    });
    const source = await readGeoTiffMetadata(input);
    const preview = await readGeoTiffRasterPreview(input, { maxPreviewPixels: 4 });
    expect(source).toMatchObject({ width: 4, height: 4 });
    expect(preview).toMatchObject({ width: 2, height: 2, crs: 4326, bounds: source.bounds });
    expect(preview.rgba).toHaveLength(16);
    await expect(readGeoTiffRasterPreview(input, { maxPreviewPixels: 0 })).rejects.toThrow('preview pixel limit');
  });


  it('bounds previews of extremely elongated rasters without altering source metadata', async () => {
    for (const [width, height] of [[4096, 1], [1, 4096]] as const) {
      const input = writeArrayBuffer(Array.from({ length: width * height }, (_, i) => i % 256), {
        width, height, SamplesPerPixel: 1,
        ModelPixelScale: [1, 1, 0], ModelTiepoint: [0, 0, 0, -48, -16, 0],
        GeographicTypeGeoKey: 4326,
      });
      const metadata = await readGeoTiffMetadata(input);
      const preview = await readGeoTiffRasterPreview(input, { maxPreviewPixels: 16 });
      expect(metadata).toMatchObject({ width, height, crs: 4326 });
      expect(preview.width * preview.height).toBeLessThanOrEqual(16);
      expect(preview.rgba).toHaveLength(preview.width * preview.height * 4);
      expect(preview.bounds).toEqual(metadata.bounds);
    }
  });

});