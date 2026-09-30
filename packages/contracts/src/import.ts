import { z } from "zod";

import { errorCodeSchema } from "./errors.js";
import { uuidSchema, timestampSchema } from "./project.js";

// PDF imports use the local-first blob/metadata protocol; the legacy GeoJSON,
// KML and Shapefile contracts below remain unchanged for existing callers.
export { importMetadataSchema, pdfImportStateSchema } from "./pdf.js";
export type { ImportMetadata, PdfImportState } from "./pdf.js";

/**
 * `queued` is the entry state: the upload has been accepted and is waiting for
 * a worker. Fixed by 10-BACKEND-VISIONARIO-PRD.md:203.
 */
export const importStatusSchema = z.enum([
  "queued",
  "processing",
  "completed",
  "failed",
]);

/**
 * Formats the first-stage pipeline accepts
 * (10-BACKEND-VISIONARIO-PRD.md:368-372). GeoPackage and GeoTIFF arrive later.
 */
export const importFormatSchema = z.enum(["geojson", "kml", "shapefile"]);

/** A stored import row, mirroring the `imports` table (PRD:196-208). */
export const importSchema = z.object({
  id: uuidSchema,
  projectId: uuidSchema,
  targetLayerId: uuidSchema.nullable(),
  originalName: z.string(),
  format: importFormatSchema,
  status: importStatusSchema,
  rowCount: z.number().int().min(0, "rowCount cannot be negative").nullable(),
  errorCode: errorCodeSchema.nullable(),
  /** Already sanitized before it is persisted, and returned to the client as-is. */
  errorMessage: z.string().nullable(),
  createdAt: timestampSchema,
  completedAt: timestampSchema.nullable(),
});

/**
 * POST /imports body. The file travels base64-encoded because an upload is
 * untrusted input: the declared `format` is only a hint and the pipeline
 * re-detects it in the `detect` step, because an extension alone proves
 * nothing (10-BACKEND-VISIONARIO-PRD.md:379-382).
 *
 * Size limits are configurable and belong to the upload endpoint, so no byte
 * ceiling is hardcoded here (PRD:384).
 */
export const createImportSchema = z.object({
  projectId: uuidSchema,
  targetLayerId: uuidSchema.nullish(),
  originalName: z.string().trim().min(1, "originalName is required").max(255),
  format: importFormatSchema,
  contentBase64: z.string().min(1, "contentBase64 is required"),
});

export type Import = z.infer<typeof importSchema>;
export type CreateImport = z.infer<typeof createImportSchema>;
export type ImportStatus = z.infer<typeof importStatusSchema>;
export type ImportFormat = z.infer<typeof importFormatSchema>;
