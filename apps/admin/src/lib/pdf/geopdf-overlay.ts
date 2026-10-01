import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import {
  inspectPdf,
  resolveIsoMeasure,
  resolveOgcLgiDict,
  pageToLonLat,
  type GeoReference,
} from "@geonexo/geo/pdf";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

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
  new Uint8Array(
    typeof blob.arrayBuffer === "function"
      ? await blob.arrayBuffer()
      : await new Response(blob).arrayBuffer(),
  );

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
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
    disableRange: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  let canvas: HTMLCanvasElement | null = null;
  try {
    const document = await loadingTask.promise;
    const page = await document.getPage(reference.pageIndex + 1);
    const baseViewport = page.getViewport({ scale: 1 });
    const basePixels = Math.max(1, baseViewport.width * baseViewport.height);
    const scale = Math.min(2, Math.sqrt(maxPixels / basePixels));
    const viewport = page.getViewport({ scale: Math.max(0.1, scale) });

    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    if (width * height > maxPixels * 1.02)
      throw new Error("A página excede o limite de rasterização móvel.");

    canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas 2D indisponível neste dispositivo.");

    const task = page.render({ canvas, canvasContext: context, viewport });
    await task.promise;

    const image = await canvasBlob(canvas);
    const url = URL.createObjectURL(image);
    const canvasCorners = [
      [0, 0],
      [width, 0],
      [width, height],
      [0, height],
    ] as const;
    const coordinates = canvasCorners.map(([x, y]) => {
      const [pageX, pageY] = viewport.convertToPdfPoint(x, y);
      const [longitude, latitude] = pageToLonLat(reference, [pageX, pageY]);
      if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        longitude < -180 ||
        longitude > 180 ||
        latitude < -90 ||
        latitude > 90
      )
        throw new Error("O posicionamento do PDF gerou coordenadas inválidas.");
      return [longitude, latitude] as [number, number];
    }) as GeoPdfOverlay["coordinates"];

    return {
      url,
      coordinates,
      width,
      height,
      release: () => URL.revokeObjectURL(url),
    };
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    await loadingTask.destroy().catch(() => undefined);
  }
}
