import { pdfjs } from "./pdf-runtime";
import {
  inspectPdf,
  resolveIsoMeasure,
  resolveOgcLgiDict,
  pageToLonLat,
  type GeoReference,
} from "@markmap/geo/pdf";
import { readBlobBytes } from "../blob-bytes";
import { georeferencedRasterWindow } from "./geopdf-window";

export type GeoPdfOverlay = {
  url: string;
  coordinates: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ];
  width: number;
  height: number;
  release(): void;
};

export type GeoPdfResolution = {
  reference: GeoReference | null;
  pageCount: number | null;
  reason: string | null;
};

const MAX_RENDER_PIXELS = 4_000_000;

export const readPdfBytes = async (blob: Blob): Promise<Uint8Array> =>
  new Uint8Array(await readBlobBytes(blob));

export async function resolveEmbeddedGeoReference(
  blob: Blob,
): Promise<GeoPdfResolution> {
  try {
    const bytes = await readPdfBytes(blob);
    const inspection = await inspectPdf(bytes, {
      maxBytes: 25 * 1024 * 1024,
      maxPages: 100,
    });
    const page = inspection.pages[0];
    if (!page)
      return {
        reference: null,
        pageCount: inspection.pageCount,
        reason: "O PDF não possui página utilizável.",
      };
    if (page.viewports.length === 0)
      return {
        reference: null,
        pageCount: inspection.pageCount,
        reason: "Este PDF não possui georreferenciamento reconhecido.",
      };

    const profile = page.viewports[0]?.profile;
    const reference =
      profile === "iso-measure-geo"
        ? resolveIsoMeasure(page)
        : resolveOgcLgiDict(page);
    return { reference, pageCount: inspection.pageCount, reason: null };
  } catch (error) {
    return {
      reference: null,
      pageCount: null,
      reason:
        error instanceof Error
          ? error.message
          : "Não foi possível interpretar o georreferenciamento do PDF.",
    };
  }
}

const canvasBlob = (
  canvas: HTMLCanvasElement,
  type = "image/webp",
  quality = 0.9,
): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Não foi possível rasterizar a página do PDF.")),
      type,
      quality,
    );
  });

export async function renderGeoPdfOverlay(
  blob: Blob,
  reference: GeoReference,
  maxPixels = MAX_RENDER_PIXELS,
): Promise<GeoPdfOverlay> {
  const bytes = await readPdfBytes(blob);
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  let canvas: HTMLCanvasElement | null = null;
  let cutCanvas: HTMLCanvasElement | null = null;
  try {
    const pdfDocument = await loadingTask.promise;
    const page = await pdfDocument.getPage(reference.pageIndex + 1);
    const baseViewport = page.getViewport({ scale: 1 });
    const basePixels = Math.max(1, baseViewport.width * baseViewport.height);
    const scale = Math.min(2, Math.sqrt(maxPixels / basePixels));
    const viewport = page.getViewport({ scale: Math.max(0.1, scale) });

    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    if (width * height > maxPixels * 1.02)
      throw new Error("A página excede o limite de rasterização móvel.");

    canvas = globalThis.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D indisponível neste dispositivo.");

    // The embedded map viewport may occupy only part of the sheet.
    const frame = georeferencedRasterWindow(reference, viewport, width, height);
    const corners = [
      [frame.x, frame.y],
      [frame.x + frame.width, frame.y],
      [frame.x + frame.width, frame.y + frame.height],
      [frame.x, frame.y + frame.height],
    ] as const;
    const coordinates = corners.map(([x, y]) => {
      const [pageX, pageY] = viewport.convertToPdfPoint(x, y);
      const [longitude, latitude] = pageToLonLat(reference, [pageX, pageY]);
      if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        Math.abs(longitude) > 180 ||
        Math.abs(latitude) > 90
      )
        throw new Error("O posicionamento do PDF gerou coordenadas inválidas.");
      return [longitude, latitude] as [number, number];
    }) as GeoPdfOverlay["coordinates"];

    const task = page.render({ canvas, canvasContext: context, viewport });
    await task.promise;
    const fullPage =
      frame.x === 0 &&
      frame.y === 0 &&
      frame.width === width &&
      frame.height === height;
    if (!fullPage) {
      cutCanvas = globalThis.document.createElement("canvas");
      cutCanvas.width = frame.width;
      cutCanvas.height = frame.height;
      const cutContext = cutCanvas.getContext("2d", { alpha: false });
      if (!cutContext) throw new Error("Canvas do GeoPDF indisponível.");
      cutContext.drawImage(
        canvas,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        0,
        0,
        frame.width,
        frame.height,
      );
    }
    const image = await canvasBlob(cutCanvas ?? canvas);
    const url = URL.createObjectURL(image);
    return {
      url,
      coordinates,
      width: frame.width,
      height: frame.height,
      release: () => URL.revokeObjectURL(url),
    };
  } finally {
    if (cutCanvas) {
      cutCanvas.width = 0;
      cutCanvas.height = 0;
    }
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    await loadingTask.destroy().catch(() => undefined);
  }
}
