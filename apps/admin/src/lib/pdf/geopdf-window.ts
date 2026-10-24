// Desenvolvido por MtsFerreira. Only the georeferenced map, not sheet margins.
import type { GeoReference } from "@markmap/contracts";

type Viewport = { convertToViewportPoint(x: number, y: number): number[] };
export type PdfWindow = Readonly<{ x: number; y: number; width: number; height: number }>;

/** Pixel bounds honor PDF.js CropBox, rotation and raster scale. */
export function georeferencedRasterWindow(
  reference: Pick<GeoReference, "cropBox" | "neatline">,
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number,
): PdfWindow {
  const [x0, y0, x1, y1] = reference.cropBox;
  const outline = reference.neatline.length >= 3
    ? reference.neatline
    : [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const points = outline.map(([x, y]) => viewport.convertToViewportPoint(x, y));
  if (!points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))
    throw new Error("A área geográfica do PDF é inválida.");
  const left = Math.max(0, Math.floor(Math.min(...points.map(([x]) => x))));
  const top = Math.max(0, Math.floor(Math.min(...points.map(([, y]) => y))));
  const right = Math.min(canvasWidth, Math.ceil(Math.max(...points.map(([x]) => x))));
  const bottom = Math.min(canvasHeight, Math.ceil(Math.max(...points.map(([, y]) => y))));
  if (right <= left || bottom <= top)
    throw new Error("A área georreferenciada não está visível na página.");
  return { x: left, y: top, width: right - left, height: bottom - top };
}
