import { z } from "zod";

import { uuidSchema } from "./project.js";

const finite = z.number().finite();
const pagePointSchema = z.tuple([finite, finite]);
const groundPointSchema = z.tuple([finite, finite]);
const cropBoxSchema = z.tuple([finite, finite, finite, finite]);

export const blobRefSchema = z
  .object({
    id: uuidSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    bytes: z
      .number()
      .int()
      .positive()
      .max(25 * 1024 * 1024),
    mediaType: z.string().trim().min(1).max(127),
  })
  .strict();

export const controlPointSchema = z
  .object({
    page: pagePointSchema,
    ground: groundPointSchema,
  })
  .strict();

export const geoReferenceSchema = z
  .object({
    profile: z.enum(["iso-measure-geo", "ogc-lgidict", "manual"]),
    sourceCrs: z.string().trim().min(1).max(128),
    pageIndex: z.number().int().min(0).max(100_000),
    cropBox: cropBoxSchema,
    rotation: z.union([
      z.literal(0),
      z.literal(90),
      z.literal(180),
      z.literal(270),
    ]),
    controls: z.array(controlPointSchema).max(10_000),
    neatline: z.array(pagePointSchema).max(10_000),
    transform: z
      .object({
        model: z.literal("affine"),
        coefficients: z.array(finite).length(6),
      })
      .strict(),
    residual: z
      .object({
        rmseMeters: finite.nonnegative().nullable(),
        maxMeters: finite.nonnegative().nullable(),
        independentCheck: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const pdfImportStateSchema = z.enum([
  "queued",
  "processing",
  "needs-calibration",
  "ready",
  "failed",
]);

export const importMetadataSchema = z
  .object({
    id: uuidSchema,
    projectId: uuidSchema,
    originalName: z.string().trim().min(1).max(255),
    source: blobRefSchema,
    format: z.literal("pdf"),
    state: pdfImportStateSchema,
    pageCount: z.number().int().min(1).max(100_000).nullable(),
    geoReference: geoReferenceSchema.nullable(),
    errorCode: z.string().trim().min(1).max(64).nullable(),
  })
  .strict()
  .superRefine((metadata, ctx) => {
    if (metadata.source.mediaType !== "application/pdf")
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source", "mediaType"],
        message: "PDF imports require application/pdf",
      });
  });

export type PagePoint = z.infer<typeof pagePointSchema>;
export type BlobRef = z.infer<typeof blobRefSchema>;
export type ControlPoint = z.infer<typeof controlPointSchema>;
export type GeoReference = z.infer<typeof geoReferenceSchema>;
export type PdfImportState = z.infer<typeof pdfImportStateSchema>;
export type ImportMetadata = z.infer<typeof importMetadataSchema>;
