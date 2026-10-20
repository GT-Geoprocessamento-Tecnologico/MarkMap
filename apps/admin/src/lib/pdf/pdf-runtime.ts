import "./pdf-compat";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "./pdf-worker.ts?worker&url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export { pdfjs };
