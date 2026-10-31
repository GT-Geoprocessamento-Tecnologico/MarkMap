import { fromArrayBuffer } from 'geotiff';

export const MAX_GEOTIFF_BYTES = 128 * 1024 * 1024;
export const MAX_GEOTIFF_PIXELS = 100_000_000;

export interface GeoTiffMetadata {
  width: number;
  height: number;
  samplesPerPixel: number;
  bounds: [number, number, number, number] | null;
  crs: number | null;
  geoKeys: Record<string, unknown>;
}

export interface GeoTiffInputLimits { maxBytes?: number; maxPixels?: number; maxPreviewPixels?: number }

export interface GeoTiffRasterPreview extends GeoTiffMetadata {
  /** Interleaved RGBA bytes, suitable for a browser ImageData/canvas. */
  rgba: Uint8Array;
}

function toArrayBuffer(input: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (input instanceof ArrayBuffer) return input;
  return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
}

export function validateGeoTiffInput(input: ArrayBuffer | Uint8Array, limits: GeoTiffInputLimits = {}): void {
  if (input.byteLength < 8) throw new TypeError('GeoTIFF input is too small.');
  if (input.byteLength > (limits.maxBytes ?? MAX_GEOTIFF_BYTES)) throw new RangeError('GeoTIFF exceeds the local byte limit.');
}

async function openImage(input: ArrayBuffer | Uint8Array, limits: GeoTiffInputLimits) {
  validateGeoTiffInput(input, limits);
  const image = await (await fromArrayBuffer(toArrayBuffer(input))).getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const pixels = width * height;
  if (!Number.isSafeInteger(pixels) || pixels > (limits.maxPixels ?? MAX_GEOTIFF_PIXELS)) throw new RangeError('GeoTIFF exceeds the local pixel limit.');
  return image;
}

function metadataFromImage(image: Awaited<ReturnType<typeof openImage>>): GeoTiffMetadata {
  const keys = image.getGeoKeys() ?? {};
  const projected = keys.ProjectedCSTypeGeoKey;
  const geographic = keys.GeographicTypeGeoKey;
  const crs = typeof projected === 'number' ? projected : typeof geographic === 'number' ? geographic : null;
  const rawBounds = image.getBoundingBox();
  const bounds = rawBounds.length === 4 && rawBounds.every(Number.isFinite) ? [rawBounds[0], rawBounds[1], rawBounds[2], rawBounds[3]] as [number, number, number, number] : null;
  return { width: image.getWidth(), height: image.getHeight(), samplesPerPixel: image.getSamplesPerPixel(), bounds, crs, geoKeys: { ...keys } };
}

export async function readGeoTiffMetadata(input: ArrayBuffer | Uint8Array, limits: GeoTiffInputLimits = {}): Promise<GeoTiffMetadata> {
  return metadataFromImage(await openImage(input, limits));
}

export async function readGeoTiffMetadataFromBlob(blob: Blob, limits: GeoTiffInputLimits = {}): Promise<GeoTiffMetadata> {
  if (blob.size > (limits.maxBytes ?? MAX_GEOTIFF_BYTES)) throw new RangeError('GeoTIFF exceeds the local byte limit.');
  return readGeoTiffMetadata(await blob.arrayBuffer(), limits);
}

export async function readGeoTiffRasterPreview(input: ArrayBuffer | Uint8Array, limits: GeoTiffInputLimits = {}): Promise<GeoTiffRasterPreview> {
  const image = await openImage(input, limits);
  const metadata = metadataFromImage(image);
  if (limits.maxPreviewPixels !== undefined &&
      (!Number.isSafeInteger(limits.maxPreviewPixels) || limits.maxPreviewPixels < 1)) {
    throw new RangeError('Invalid GeoTIFF preview pixel limit.');
  }
  const maximum = limits.maxPreviewPixels ?? metadata.width * metadata.height;
  // Preserve full-resolution source/CRS while bounding the pixels drawn on the map.
  // readRGB resamples during decode; never materialize a full-sized RGBA preview.
  const scale = Number.isFinite(maximum) && maximum > 0
    ? Math.min(1, Math.sqrt(maximum / (metadata.width * metadata.height))) : 1;
  const width = Math.max(1, Math.floor(metadata.width * scale));
  const height = Math.max(1, Math.floor(metadata.height * scale));
  const raster = await image.readRGB({ interleave: true, width, height });
  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const red = raster[pixel * 3] ?? 0;
    rgba[pixel * 4] = red;
    rgba[pixel * 4 + 1] = raster[pixel * 3 + 1] ?? red;
    rgba[pixel * 4 + 2] = raster[pixel * 3 + 2] ?? red;
    rgba[pixel * 4 + 3] = 255;
  }
  return { ...metadata, width, height, rgba };
}

export function isGeoTiffSignature(input: ArrayBuffer | Uint8Array): boolean {
  if (input.byteLength < 4) return false;
  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input, 0, 4) : new Uint8Array(input.buffer, input.byteOffset, 4);
  return (bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0x00) || (bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0x00 && bytes[3] === 0x2a);
}
