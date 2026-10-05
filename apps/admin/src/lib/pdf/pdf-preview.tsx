import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { geoReferenceSchema, type GeoReference } from "@geonexo/contracts";
import {
  autoCalibrateFromText,
  fitAffine,
  inspectPdf,
  isPdfError,
  type AutoCalibrationMethod,
  type PdfInspection,
  type PdfTextSample,
} from "@geonexo/geo/pdf";
import { useToast } from "@geonexo/ui";

import {
  localRepository,
  type OriginalRecord,
} from "../local-repositories";
import { resolveEmbeddedGeoReference } from "./geopdf-overlay";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const PDF_MAX_BYTES = 25 * 1024 * 1024;
export const PDF_MAX_PAGES = 100;
export const PDF_MAX_PIXELS = 16_000_000;

type CalibrationPoint = {
  page: [number, number];
  pixel: [number, number];
  longitude: string;
  latitude: string;
};

type PageGeometry = {
  cropBox: [number, number, number, number];
  rotation: 0 | 90 | 180 | 270;
};

type ViewportConverter = {
  convertToPdfPoint(x: number, y: number): number[];
};

type StoredReferenceSource =
  | { method: "manual" }
  | {
      method: "auto-grid";
      variant: AutoCalibrationMethod;
      confidence: number;
    };

const referenceKey = (blobId: string) => `pdfGeoref:${blobId}`;
const referenceSourceKey = (blobId: string) => `pdfGeorefSource:${blobId}`;

const textSamplesForPage = async (
  page: pdfjs.PDFPageProxy,
): Promise<PdfTextSample[]> => {
  const text = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  return text.items.flatMap((entry) => {
    const item = entry as { str?: unknown; transform?: unknown };
    if (
      typeof item.str !== "string" ||
      !Array.isArray(item.transform) ||
      item.transform.length < 6 ||
      item.str.trim().length === 0
    )
      return [];
    const transformed = pdfjs.Util.transform(
      viewport.transform,
      item.transform as number[],
    );
    const pagePoint = viewport.convertToPdfPoint(
      transformed[4] ?? 0,
      transformed[5] ?? 0,
    );
    if (
      pagePoint.length < 2 ||
      !Number.isFinite(pagePoint[0]) ||
      !Number.isFinite(pagePoint[1])
    )
      return [];
    return [
      {
        text: item.str,
        page: [pagePoint[0]!, pagePoint[1]!] as [number, number],
      },
    ];
  });
};

const readBytes = async (blob: Blob): Promise<Uint8Array> =>
  new Uint8Array(
    typeof blob.arrayBuffer === "function"
      ? await blob.arrayBuffer()
      : await new Response(blob).arrayBuffer(),
  );

export async function sha256Blob(blob: Blob): Promise<string> {
  const bytes = await readBytes(blob);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer,
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const reasonFor = (error: unknown) => {
  if (isPdfError(error)) {
    if (error.code === "unsupported-crs")
      return "O sistema de coordenadas declarado pelo PDF não pode ser usado automaticamente. Você ainda pode posicionar o mapa manualmente.";
    if (error.code === "invalid-control-points")
      return "Os pontos geográficos do PDF são inconsistentes. Você ainda pode posicionar o mapa manualmente.";
    return error.message;
  }
  return "O documento pode ser visualizado, mas os metadados geográficos não puderam ser interpretados.";
};

const radians = Math.PI / 180;
const distanceMeters = (
  first: readonly [number, number],
  second: readonly [number, number],
): number => {
  const dLat = (second[1] - first[1]) * radians;
  const dLon = (second[0] - first[0]) * radians;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(first[1] * radians) *
      Math.cos(second[1] * radians) *
      Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.min(1, Math.sqrt(a)));
};

const applyAffine = (
  coefficients: readonly number[],
  point: readonly [number, number],
): [number, number] => [
  coefficients[0]! * point[0] +
    coefficients[1]! * point[1] +
    coefficients[2]!,
  coefficients[3]! * point[0] +
    coefficients[4]! * point[1] +
    coefficients[5]!,
];

const createManualReference = (
  points: readonly CalibrationPoint[],
  geometry: PageGeometry,
): GeoReference => {
  const controls = points.map((point) => {
    const longitude = Number(point.longitude);
    const latitude = Number(point.latitude);
    if (
      !Number.isFinite(longitude) ||
      !Number.isFinite(latitude) ||
      longitude < -180 ||
      longitude > 180 ||
      latitude < -90 ||
      latitude > 90
    )
      throw new Error(
        "Revise latitude e longitude. Use graus decimais, por exemplo -48.2084 e -7.2096.",
      );
    return {
      page: point.page,
      ground: [longitude, latitude] as [number, number],
    };
  });
  if (controls.length < 3)
    throw new Error("Marque pelo menos 3 pontos conhecidos no PDF.");

  const coefficients = fitAffine(controls);
  const errors = controls.map((control) =>
    distanceMeters(
      applyAffine(coefficients, control.page),
      control.ground,
    ),
  );
  const rmse = Math.sqrt(
    errors.reduce((sum, value) => sum + value * value, 0) / errors.length,
  );
  const max = Math.max(...errors);
  const [minX, minY, maxX, maxY] = geometry.cropBox;
  return geoReferenceSchema.parse({
    profile: "manual",
    sourceCrs: "EPSG:4326",
    pageIndex: 0,
    cropBox: geometry.cropBox,
    rotation: geometry.rotation,
    controls,
    neatline: [
      [minX, minY],
      [maxX, minY],
      [maxX, maxY],
      [minX, maxY],
    ],
    transform: { model: "affine", coefficients },
    residual: {
      rmseMeters: rmse,
      maxMeters: max,
      independentCheck: false,
    },
  });
};

export function PdfPreview({ record }: { record: OriginalRecord }) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<ViewportConverter | null>(null);
  const pageGeometryRef = useRef<PageGeometry | null>(null);
  const [inspection, setInspection] = useState<PdfInspection | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [calibrating, setCalibrating] = useState(false);
  const [calibration, setCalibration] = useState<CalibrationPoint[]>([]);
  const [storedReference, setStoredReference] =
    useState<GeoReference | null>(null);
  const [storedReferenceSource, setStoredReferenceSource] =
    useState<StoredReferenceSource | null>(null);
  const [embeddedReference, setEmbeddedReference] =
    useState<GeoReference | null>(null);
  const [autoCalibrationReason, setAutoCalibrationReason] =
    useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    void Promise.all([
      localRepository.getMeta<GeoReference>(referenceKey(record.blobId)),
      localRepository.getMeta<StoredReferenceSource>(
        referenceSourceKey(record.blobId),
      ),
      resolveEmbeddedGeoReference(record.blob),
    ])
      .then(([stored, source, embedded]) => {
        if (disposed) return;
        setStoredReference(stored ?? null);
        setStoredReferenceSource(
          source ?? (stored ? { method: "manual" } : null),
        );
        setEmbeddedReference(embedded.reference);
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [record.blob, record.blobId, record.sha256]);

  useEffect(() => {
    let disposed = false;
    let renderTask:
      | { cancel: () => void; promise: Promise<unknown> }
      | undefined;
    let pdfDocument: pdfjs.PDFDocumentProxy | undefined;
    let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined;
    const canvas = canvasRef.current;
    if (!canvas) return () => undefined;
    setState("loading");
    setInspection(null);
    setReason(null);
    setAutoCalibrationReason(null);
    viewportRef.current = null;
    pageGeometryRef.current = null;
    void (async () => {
      try {
        const bytes = await readBytes(record.blob);
        if (bytes.byteLength > PDF_MAX_BYTES)
          throw new Error("O PDF excede o limite local de 25 MiB.");
        let inspectionResult: PdfInspection | null = null;
        try {
          inspectionResult = await inspectPdf(bytes, {
            maxBytes: PDF_MAX_BYTES,
            maxPages: PDF_MAX_PAGES,
          });
          setInspection(inspectionResult);
        } catch (error) {
          setReason(reasonFor(error));
        }
        loadingTask = pdfjs.getDocument({
          data: bytes,
          disableAutoFetch: true,
          disableStream: true,
          disableRange: true,
          useSystemFonts: false,
          verbosity: 0,
        });
        pdfDocument = await loadingTask.promise;
        if (pdfDocument.numPages > PDF_MAX_PAGES)
          throw new Error("O PDF excede o limite de páginas local.");
        const page = await pdfDocument.getPage(1);
        const initial = page.getViewport({ scale: 1 });
        const scale = Math.min(
          2,
          Math.sqrt(
            PDF_MAX_PIXELS /
              Math.max(1, initial.width * initial.height),
          ),
        );
        const viewport = page.getViewport({ scale });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        viewportRef.current = viewport;
        const view = page.view;
        if (view.length === 4) {
          const rotation = (((page.rotate % 360) + 360) % 360) as
            | 0
            | 90
            | 180
            | 270;
          const geometry: PageGeometry = {
            cropBox: [view[0]!, view[1]!, view[2]!, view[3]!],
            rotation,
          };
          pageGeometryRef.current = geometry;

          const existingReference =
            await localRepository.getMeta<GeoReference>(
              referenceKey(record.blobId),
            );
          const hasEmbeddedMetadata =
            (inspectionResult?.pages[0]?.viewports.length ?? 0) > 0;
          if (!existingReference && !hasEmbeddedMetadata) {
            const samples = await textSamplesForPage(page);
            const automatic = autoCalibrateFromText(samples, {
              pageIndex: 0,
              cropBox: geometry.cropBox,
              rotation: geometry.rotation,
            });
            if (automatic.reference) {
              const source: StoredReferenceSource = {
                method: "auto-grid",
                variant: automatic.method!,
                confidence: automatic.confidence,
              };
              await localRepository.setMeta(
                referenceKey(record.blobId),
                automatic.reference,
              );
              await localRepository.setMeta(
                referenceSourceKey(record.blobId),
                source,
              );
              if (!disposed) {
                setStoredReference(automatic.reference);
                setStoredReferenceSource(source);
                setAutoCalibrationReason(null);
                setReason(null);
              }
            } else if (!disposed) {
              setAutoCalibrationReason(automatic.reason);
            }
          }
        }
        const context = canvas.getContext("2d", { alpha: false });
        if (!context)
          throw new Error("Canvas 2D indisponível neste dispositivo.");
        renderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });
        await renderTask.promise;
        if (!disposed) {
          setPageCount(pdfDocument.numPages);
          setState("ready");
        }
      } catch (error) {
        if (!disposed) {
          setReason(reasonFor(error));
          setState("error");
        }
      }
    })();
    return () => {
      disposed = true;
      viewportRef.current = null;
      pageGeometryRef.current = null;
      renderTask?.cancel();
      void loadingTask?.destroy();
      pdfDocument?.cleanup();
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [record.blob, record.sha256, record.blobId]);

  const hasMapReference = Boolean(storedReference || embeddedReference);
  const geographicStatus = storedReference
    ? storedReferenceSource?.method === "auto-grid"
      ? `Grade do PDF calibrada automaticamente (${Math.round(
          storedReferenceSource.confidence * 100,
        )}% de confiança). Você pode revisar manualmente se necessário.`
      : "Posicionamento manual salvo neste dispositivo."
    : embeddedReference
      ? "Mapa georreferenciado detectado. Você pode abri-lo no mapa e continuar usando offline."
      : autoCalibrationReason
        ? `Calibração automática não aprovada: ${autoCalibrationReason} Use o posicionamento manual como fallback.`
        : reason
          ? `Posicionamento automático indisponível: ${reason}`
          : inspection?.pages[0]?.viewports.length
            ? "Metadados geográficos encontrados, mas o posicionamento ainda precisa ser validado."
            : "Procurando grade/coordenadas no PDF. Se não houver confiança suficiente, use o posicionamento manual.";

  const readyToSave = useMemo(
    () =>
      calibration.length >= 3 &&
      calibration.every(
        (point) =>
          point.longitude.trim().length > 0 &&
          point.latitude.trim().length > 0,
      ),
    [calibration],
  );

  const addCalibrationPoint = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!calibrating || calibration.length >= 6) return;
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;
    const rect = canvas.getBoundingClientRect();
    const pixelX =
      ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
    const pixelY =
      ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
    const [pageX, pageY] = viewport.convertToPdfPoint(pixelX, pixelY);
    setCalibration((current) => [
      ...current,
      {
        page: [pageX, pageY],
        pixel: [pixelX, pixelY],
        longitude: "",
        latitude: "",
      },
    ]);
  };

  const updateCalibration = (
    index: number,
    field: "longitude" | "latitude",
    value: string,
  ) =>
    setCalibration((current) =>
      current.map((point, pointIndex) =>
        pointIndex === index ? { ...point, [field]: value } : point,
      ),
    );

  const fillCurrentLocation = (index: number) => {
    if (!navigator.geolocation) {
      toast({
        title: "GPS indisponível",
        description: "Este dispositivo não oferece localização ao navegador.",
        variant: "error",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        updateCalibration(index, "longitude", String(coords.longitude));
        updateCalibration(index, "latitude", String(coords.latitude));
      },
      () =>
        toast({
          title: "Localização não disponível",
          description:
            "Ative a permissão de localização e tente novamente.",
          variant: "error",
        }),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
    );
  };

  const saveCalibration = async () => {
    const geometry = pageGeometryRef.current;
    if (!geometry) {
      toast({
        title: "PDF ainda não está pronto",
        description: "Aguarde a página terminar de carregar.",
        variant: "error",
      });
      return;
    }
    try {
      const reference = createManualReference(calibration, geometry);
      await localRepository.setMeta(referenceKey(record.blobId), reference);
      await localRepository.setMeta(referenceSourceKey(record.blobId), {
        method: "manual",
      } satisfies StoredReferenceSource);
      setStoredReference(reference);
      setStoredReferenceSource({ method: "manual" });
      setCalibrating(false);
      toast({
        title: "Mapa posicionado",
        description:
          calibration.length >= 4
            ? `Erro residual máximo: ${reference.residual.maxMeters?.toFixed(1) ?? "—"} m.`
            : "Posicionamento salvo neste dispositivo.",
        variant: "success",
      });
    } catch (cause) {
      toast({
        title: "Não foi possível posicionar o mapa",
        description:
          cause instanceof Error
            ? cause.message
            : "Revise os pontos informados.",
        variant: "error",
      });
    }
  };

  return (
    <article
      className="mt-6 rounded-2xl border border-outline-variant bg-surface-container p-4"
      aria-label={`Pré-visualização de ${record.originalName ?? "PDF"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Mapa PDF</h2>
          <p className="text-xs text-on-surface-variant">
            {record.originalName ?? record.blobId} · {pageCount ?? "…"} página(s)
          </p>
        </div>
        <span
          className={`text-xs font-semibold ${
            state === "ready" ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {state === "ready" ? "Salvo offline" : "Processando…"}
        </span>
      </div>

      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        {geographicStatus}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {hasMapReference && (
          <a
            href={`/workspace?pdfId=${encodeURIComponent(record.blobId)}`}
            className="flex min-h-[44px] items-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-500"
          >
            Abrir no mapa
          </a>
        )}
        {!embeddedReference && (
          <button
            type="button"
            onClick={() => {
              setCalibrating((current) => !current);
              setCalibration([]);
            }}
            className="min-h-[44px] rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface"
          >
            {calibrating ? "Cancelar posicionamento" : "Posicionar manualmente"}
          </button>
        )}
      </div>

      {calibrating && (
        <section className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3">
          <h3 className="font-semibold">Posicionar mapa</h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            Toque em pelo menos 3 locais conhecidos no PDF e informe a
            longitude e a latitude de cada ponto. Quatro pontos ou mais ajudam
            a conferir a qualidade do ajuste.
          </p>
          {calibration.length > 0 && (
            <div className="mt-3 space-y-3">
              {calibration.map((point, index) => (
                <div
                  key={`${point.page[0]}-${point.page[1]}-${index}`}
                  className="rounded-lg border border-outline-variant bg-surface-container p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>Ponto {index + 1}</strong>
                    <button
                      type="button"
                      onClick={() =>
                        setCalibration((current) =>
                          current.filter((_, pointIndex) => pointIndex !== index),
                        )
                      }
                      className="min-h-[44px] px-2 text-sm text-red-500"
                    >
                      Remover
                    </button>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label className="text-xs">
                      Longitude
                      <input
                        value={point.longitude}
                        onChange={(event) =>
                          updateCalibration(
                            index,
                            "longitude",
                            event.target.value,
                          )
                        }
                        inputMode="decimal"
                        placeholder="-48.2084"
                        className="mt-1 min-h-[44px] w-full rounded-lg border border-outline-variant bg-background px-3"
                      />
                    </label>
                    <label className="text-xs">
                      Latitude
                      <input
                        value={point.latitude}
                        onChange={(event) =>
                          updateCalibration(
                            index,
                            "latitude",
                            event.target.value,
                          )
                        }
                        inputMode="decimal"
                        placeholder="-7.2096"
                        className="mt-1 min-h-[44px] w-full rounded-lg border border-outline-variant bg-background px-3"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => fillCurrentLocation(index)}
                    className="mt-2 min-h-[44px] rounded-lg border border-outline-variant px-3 text-sm"
                  >
                    Usar minha localização neste ponto
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="flex min-h-[44px] items-center text-sm text-on-surface-variant">
              {calibration.length}/6 pontos marcados
            </span>
            <button
              type="button"
              disabled={!readyToSave}
              onClick={() => void saveCalibration()}
              className="min-h-[44px] rounded-lg bg-gradient-to-r from-brand-blue to-brand-cyan px-4 font-bold text-white hover:brightness-110 disabled:opacity-40"
            >
              Salvar posicionamento
            </button>
          </div>
        </section>
      )}

      <div className="mt-4 overflow-auto rounded-lg bg-white p-2">
        <div className="relative w-max">
          <canvas
            ref={canvasRef}
            aria-label={
              calibrating
                ? "Primeira página do PDF. Toque para marcar um ponto de calibração."
                : "Primeira página do PDF"
            }
            onClick={addCalibrationPoint}
            className={calibrating ? "cursor-crosshair touch-none" : ""}
          />
          {calibrating &&
            calibration.map((point, index) => (
              <span
                key={`marker-${index}`}
                aria-hidden="true"
                className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-cyan-600 text-xs font-bold text-white shadow"
                style={{
                  left: point.pixel[0],
                  top: point.pixel[1],
                }}
              >
                {index + 1}
              </span>
            ))}
        </div>
      </div>
    </article>
  );
}
