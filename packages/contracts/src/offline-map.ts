import { z } from "zod";

import { blobRefSchema } from "./pdf.js";

const finite = z.number().finite();
/** Regional archives have a larger, separately reviewed budget than PDFs. */
export const offlineMapArchiveRefSchema = blobRefSchema
  .extend({
    bytes: z
      .number()
      .int()
      .positive()
      .max(250 * 1024 * 1024),
    mediaType: z.literal("application/vnd.pmtiles"),
  })
  .strict();
export const mapBoundsSchema = z
  .tuple([finite, finite, finite, finite])
  .superRefine((bounds, ctx) => {
    const [minLng, minLat, maxLng, maxLat] = bounds;
    if (
      minLng < -180 ||
      maxLng > 180 ||
      minLat < -90 ||
      maxLat > 90 ||
      minLng >= maxLng ||
      minLat >= maxLat
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "bounds must be an ordered WGS84 extent",
      });
    }
  });

const assetPathSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((path) => {
    if (
      path.startsWith("/") ||
      path.endsWith("/") ||
      path.includes("\\") ||
      /[%?#:]/.test(path)
    )
      return false;
    const segments = path.split("/");
    return segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        /^[A-Za-z0-9._@-]+$/.test(segment),
    );
  }, "asset path must be a strict POSIX relative path");
const assetBlobSchema = blobRefSchema
  .extend({
    mediaType: z.enum([
      "application/json",
      "application/x-protobuf",
      "image/png",
    ]),
  })
  .strict();
const assetRefSchema = z
  .object({ path: assetPathSchema, blob: assetBlobSchema })
  .strict();

export const offlineMapPackageManifestSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9._-]{0,127}$/),
    version: z.string().trim().min(1).max(64),
    label: z.string().trim().min(1).max(160),
    bounds: mapBoundsSchema,
    minZoom: z.number().int().min(0).max(24),
    maxZoom: z.number().int().min(0).max(24),
    archive: offlineMapArchiveRefSchema,
    style: z
      .object({
        path: assetPathSchema,
        blob: assetBlobSchema.refine(
          (blob) => blob.mediaType === "application/json",
          "style must be JSON",
        ),
      })
      .strict(),
    glyphs: z.array(assetRefSchema).max(256),
    sprites: z.array(assetRefSchema).max(256),
    attribution: z.string().trim().min(1).max(2_000),
    createdAt: z.string().datetime(),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    if (manifest.minZoom > manifest.maxZoom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minZoom"],
        message: "minZoom cannot exceed maxZoom",
      });
    }
    const bytes =
      manifest.archive.bytes +
      manifest.style.blob.bytes +
      manifest.glyphs.reduce((sum, asset) => sum + asset.blob.bytes, 0) +
      manifest.sprites.reduce((sum, asset) => sum + asset.blob.bytes, 0);
    if (bytes > 250 * 1024 * 1024)
      ctx.addIssue({
        code: z.ZodIssueCode.too_big,
        maximum: 250 * 1024 * 1024,
        type: "number",
        inclusive: true,
        path: ["archive", "bytes"],
        message: "map manifest exceeds 250 MiB",
      });
  });

export type MapBounds = z.infer<typeof mapBoundsSchema>;
export type OfflineMapArchiveRef = z.infer<typeof offlineMapArchiveRefSchema>;
export type OfflineMapPackageManifest = z.infer<
  typeof offlineMapPackageManifestSchema
>;
