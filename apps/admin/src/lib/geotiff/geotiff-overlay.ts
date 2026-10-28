import { readGeoTiffRasterPreview, type GeoTiffInputLimits } from '@markmap/maps';
import { readBlobBytes } from '../blob-bytes';

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

export async function renderGeoTiffOverlay(blob: Blob, limits: GeoTiffInputLimits = {}): Promise<GeoTiffOverlay> {
  const preview = await readGeoTiffRasterPreview(await readBlobBytes(blob), limits);
  if (preview.crs !== 4326) throw new Error('A prévia GeoTIFF exige CRS geográfico EPSG:4326 neste MVP.');
  if (!preview.bounds) throw new Error('O GeoTIFF não possui bounds geográficos utilizáveis.');
  const [west, south, east, north] = preview.bounds;
  if (![west, south, east, north].every(Number.isFinite) || west >= east || south >= north || west < -180 || east > 180 || south < -90 || north > 90) throw new Error('Bounds GeoTIFF inválidos para overlay geográfico.');
  const canvas = document.createElement('canvas');
  canvas.width = preview.width;
  canvas.height = preview.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponível neste dispositivo.');
  context.putImageData(new ImageData(new Uint8ClampedArray(preview.rgba), preview.width, preview.height), 0, 0);
  const image = await canvasBlob(canvas);
  const url = URL.createObjectURL(image);
  canvas.width = 0;
  canvas.height = 0;
  return {
    url,
    coordinates: [[west, north], [east, north], [east, south], [west, south]],
    width: preview.width,
    height: preview.height,
    release: () => URL.revokeObjectURL(url),
  };
}
