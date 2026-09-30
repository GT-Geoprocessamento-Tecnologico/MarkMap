import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { inspectPdf, isPdfError, type PdfInspection } from "../../../../../packages/geo/src/pdf/index";
import type { OriginalRecord } from "../local-repositories";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export const PDF_MAX_BYTES = 25 * 1024 * 1024;
export const PDF_MAX_PAGES = 100;
export const PDF_MAX_PIXELS = 16_000_000;

const readBytes = async (blob: Blob): Promise<Uint8Array> =>
  new Uint8Array(typeof blob.arrayBuffer === "function" ? await blob.arrayBuffer() : await new Response(blob).arrayBuffer());

export async function sha256Blob(blob: Blob): Promise<string> {
  const bytes = await readBytes(blob);
  const digest = await crypto.subtle.digest("SHA-256", bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const reasonFor = (error: unknown) => {
  if (isPdfError(error)) {
    if (error.code === "unsupported-crs") return "O CRS declarado entra em conflito com os valores GPTS; o PDF não foi posicionado automaticamente.";
    if (error.code === "invalid-control-points") return "Os pontos geográficos do PDF são inconsistentes; o PDF não foi posicionado automaticamente.";
    return error.message;
  }
  return "O documento pode ser visualizado, mas os metadados geográficos não puderam ser interpretados.";
};

export function PdfPreview({ record }: { record: OriginalRecord }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [inspection, setInspection] = useState<PdfInspection | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let disposed = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | undefined;
    let document: pdfjs.PDFDocumentProxy | undefined;
    let loadingTask: ReturnType<typeof pdfjs.getDocument> | undefined;
    const canvas = canvasRef.current;
    if (!canvas) return () => undefined;
    setState("loading");
    setInspection(null);
    setReason(null);
    void (async () => {
      try {
        const bytes = await readBytes(record.blob);
        if (bytes.byteLength > PDF_MAX_BYTES) throw new Error("O PDF excede o limite local de 25 MiB.");
        try {
          setInspection(await inspectPdf(bytes, { maxBytes: PDF_MAX_BYTES, maxPages: PDF_MAX_PAGES }));
        } catch (error) {
          setReason(reasonFor(error));
        }
        loadingTask = pdfjs.getDocument({ data: bytes, disableAutoFetch: true, disableStream: true });
        document = await loadingTask.promise;
        if (document.numPages > PDF_MAX_PAGES) throw new Error("O PDF excede o limite de páginas local.");
        const page = await document.getPage(1);
        const initial = page.getViewport({ scale: 1 });
        const scale = Math.min(2, Math.sqrt(PDF_MAX_PIXELS / Math.max(1, initial.width * initial.height)));
        const viewport = page.getViewport({ scale });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        renderTask = page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport });
        await renderTask.promise;
        if (!disposed) {
          setPageCount(document.numPages);
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
      renderTask?.cancel();
      void loadingTask?.destroy();
      document?.cleanup();
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [record.blob, record.sha256]);

  const geographicStatus = inspection?.pages[0]?.viewports.length
    ? "Metadados geográficos encontrados; o posicionamento automático permanece desativado nesta visualização."
    : reason
      ? `Não posicionado: ${reason}`
      : "Não posicionado: aguardando leitura dos metadados.";

  return (
    <article className="mt-6 rounded-2xl border border-outline-variant bg-surface-container p-4" aria-label={`Pré-visualização de ${record.originalName ?? "PDF"}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Pré-visualização PDF</h2>
          <p className="text-xs text-on-surface-variant">{record.originalName ?? record.blobId} · {pageCount ?? "…"} página(s)</p>
        </div>
        <span className={`text-xs font-semibold ${state === "ready" ? "text-emerald-700" : "text-amber-700"}`}>{state === "ready" ? "Visualização local" : "Processando…"}</span>
      </div>
      <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{geographicStatus}</p>
      <div className="mt-4 overflow-auto rounded-lg bg-white p-2"><canvas ref={canvasRef} aria-label="Primeira página do PDF" /></div>
    </article>
  );
}
