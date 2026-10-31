import { readGeoTiffRasterPreview, adaptiveMapBudget, readMapDeviceHints, type GeoTiffInputLimits, type GeoTiffRasterPreview } from '@markmap/maps';
import { readBlobBytes } from '../blob-bytes';
import { geoTiffPreviewCacheKey, readGeoTiffPreviewCache, writeGeoTiffPreviewCache } from '../storage/geotiff-preview-opfs';

export type GeoTiffOverlay = {
  url: string;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  width: number;
  height: number;
  release(): void;
};

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível criar a prévia GeoTIFF.')), 'image/png'));
}

class WorkerUnavailableError extends Error {}
async function decodeRaster(blob: Blob, limits: GeoTiffInputLimits): Promise<GeoTiffRasterPreview> {
  if (typeof Worker === 'undefined') return readGeoTiffRasterPreview(await readBlobBytes(blob), limits);
  let worker: Worker;
  try { worker = new Worker(new URL('../../workers/geotiff-overlay.worker.ts', import.meta.url), { type: 'module' }); }
  catch { return readGeoTiffRasterPreview(await readBlobBytes(blob), limits); }
  try {
    return await new Promise<GeoTiffRasterPreview>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Tempo limite de processamento GeoTIFF excedido.')), 90_000);
      const done = (result: GeoTiffRasterPreview | Error) => {
        clearTimeout(timeout);
        if (result instanceof Error) reject(result);
        else resolve(result);
      };
      worker.onmessage = (event: MessageEvent<{ kind: string; preview?: GeoTiffRasterPreview; message?: string }>) => {
        if (event.data?.kind === 'result' && event.data.preview) done(event.data.preview);
        else done(new Error(event.data?.message || 'Não foi possível processar o GeoTIFF.'));
      };
      worker.onerror = () => done(new WorkerUnavailableError('Worker GeoTIFF indisponível.'));
      try { worker.postMessage({ blob, limits }); }
      catch { done(new WorkerUnavailableError('Não foi possível iniciar o worker GeoTIFF.')); }
    });
  } catch (error) {
    if (error instanceof WorkerUnavailableError)
      return readGeoTiffRasterPreview(await readBlobBytes(blob), limits);
    throw error;
  } finally { worker.terminate(); }
}

export async function renderGeoTiffOverlay(blob: Blob, limits: GeoTiffInputLimits = {}): Promise<GeoTiffOverlay> {
  if (blob.size > (limits.maxBytes ?? 128 * 1024 * 1024)) throw new RangeError('GeoTIFF excede o limite local.');
  const tier = adaptiveMapBudget(readMapDeviceHints()).tier;
  const devicePreviewLimit = tier === 'constrained' ? 2_000_000 : tier === 'capable' ? 12_000_000 : 6_000_000;
  const adaptedLimits = { ...limits, maxPreviewPixels: Math.min(limits.maxPreviewPixels ?? devicePreviewLimit, devicePreviewLimit) };
  const cacheKey = await geoTiffPreviewCacheKey(blob);
  const cached = cacheKey ? await readGeoTiffPreviewCache(cacheKey, adaptedLimits) : null;
  if (cached) {
    const url = URL.createObjectURL(cached.image);
    return { url, width: cached.width, height: cached.height, coordinates: cached.coordinates, release: () => URL.revokeObjectURL(url) };
  }
  const preview = await decodeRaster(blob, adaptedLimits);
  if (preview.crs !== 4326) throw new Error('A prévia GeoTIFF exige CRS geográfico EPSG:4326 neste MVP.');
  if (!preview.bounds) throw new Error('O GeoTIFF não possui bounds geográficos utilizáveis.');
  const [west, south, east, north] = preview.bounds;
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north || west < -180 || east > 180 || south < -90 || north > 90) throw new Error('Bounds GeoTIFF inválidos para overlay geográfico.');
  const canvas = document.createElement('canvas');
  canvas.width = preview.width;
  canvas.height = preview.height;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D indisponível neste dispositivo.');
    context.putImageData(new ImageData(new Uint8ClampedArray(preview.rgba.buffer as ArrayBuffer, preview.rgba.byteOffset, preview.rgba.byteLength), preview.width, preview.height), 0, 0);
    const image = await canvasBlob(canvas);
    const url = URL.createObjectURL(image);
    const coordinates: GeoTiffOverlay['coordinates'] = [[west, north], [east, north], [east, south], [west, south]];
    if (cacheKey) void writeGeoTiffPreviewCache(cacheKey, image, { width: preview.width, height: preview.height, coordinates });
    return { url, coordinates, width: preview.width, height: preview.height, release: () => URL.revokeObjectURL(url) };
  } finally { canvas.width = 0; canvas.height = 0; }
}
