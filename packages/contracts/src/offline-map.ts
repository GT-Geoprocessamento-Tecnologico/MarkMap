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

const capabilitySchema = z.enum([
  "basemap",
  "search",
  "routing.walk",
  "routing.bicycle",
  "routing.car",
  "elevation",
  "contours",
  "wikipedia",
  "transit",
]);

export const capabilityPathSchema = z.string().regex(/^[A-Za-z0-9._@-]+$/);

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
    /** Optional, integrity-checked OSM name/POI indexes, stored with this generation. */
    searchShards: z
      .array(
        assetRefSchema.refine(
          (asset) =>
            /^search\/(?:[a-z][0-3]|0-9|other)\.json$/.test(asset.path) &&
            asset.blob.mediaType === "application/json",
          "regional search shard must be a JSON file in search/",
        ),
      )
      .max(64)
      .optional(),
    /** Optional local routing network; absent means routing is unavailable. */
    routingGraph: assetRefSchema
      .refine(
        (asset) =>
          asset.path === "routing/graph.json" &&
          asset.blob.mediaType === "application/json",
        "routing graph must be routing/graph.json",
      )
      .optional(),
    /** Optional precomputed contours; not a digital elevation model. */
    contourLines: assetRefSchema
      .refine(
        (asset) =>
          asset.path === "elevation/contours.json" &&
          asset.blob.mediaType === "application/json",
        "contour lines must be elevation/contours.json",
      )
      .optional(),
    /** Optional bounded, license-attributed DEM with explicit no-data values. */
    demGrid: assetRefSchema
      .refine(
        (asset) =>
          asset.path === "elevation/dem.json" &&
          asset.blob.mediaType === "application/json",
        "regional DEM must be elevation/dem.json",
      )
      .optional(),
    /** Licensed regional excerpts only. No remote fetching is required after installation. */
    wikipediaPack: assetRefSchema
      .refine(
        (asset) =>
          asset.path === "content/wikipedia.json" &&
          asset.blob.mediaType === "application/json",
        "wikipedia content must be content/wikipedia.json",
      )
      .optional(),
    transitPack: assetRefSchema
      .refine(
        (asset) =>
          asset.path === "content/transit.json" &&
          asset.blob.mediaType === "application/json",
        "transit content must be content/transit.json",
      )
      .optional(),
    attribution: z.string().trim().min(1).max(2_000),
    createdAt: z.string().datetime(),
    /** Versionamento do pacote */
    packageVersion: z.string().trim().min(1).max(64),
    /** Data da fonte OSM */
    osmDataDate: z.string().datetime(),
    /** Capabilities (features) do pacote */
    capabilities: z.array(capabilitySchema).default([]),
    /** Checksums individuais de cada componente */
    checksums: z.object({
      archive: z.string().regex(/^[a-f0-9]{64}$/),
      style: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
      glyphs: z.array(z.string().regex(/^[a-f0-9]{64}$/)).default([]),
      sprites: z.array(z.string().regex(/^[a-f0-9]{64}$/)).default([]),
    }),
    /** Tamanho total do pacote (bytes) */
    totalBytes: z
      .number()
      .int()
      .int()
      .positive()
      .max(250 * 1024 * 1024),
    /** Fonte/licenças */
    sources: z
      .object({
        osm: z.string().min(1),
        attributions: z
          .array(z.object({ name: z.string(), url: z.string().url() }))
          .default([]),
      })
      .default({ osm: "", attributions: [] }),
    /** Componentes opcionais do pacote */
    optionalComponents: z
      .object({
        search: z.object({}).default({}),
        routing: z
          .object({
            walk: z.boolean().default(true),
            bicycle: z.boolean().default(true),
            car: z.boolean().default(false),
          })
          .default({}),
        elevation: z.boolean().default(true),
        contours: z.boolean().default(true),
      })
      .default({}),
    /** Compatibilidade */
    minimumCompatibleVersion: z.string().trim().min(1).max(64),
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
      manifest.sprites.reduce((sum, asset) => sum + asset.blob.bytes, 0) +
      (manifest.searchShards ?? []).reduce(
        (sum, asset) => sum + asset.blob.bytes,
        0,
      ) +
      (manifest.routingGraph?.blob.bytes ?? 0) +
      (manifest.contourLines?.blob.bytes ?? 0) +
      (manifest.wikipediaPack?.blob.bytes ?? 0) +
      (manifest.transitPack?.blob.bytes ?? 0) +
      (manifest.demGrid?.blob.bytes ?? 0);
    if (
      manifest.capabilities.includes("search") !==
      Boolean(manifest.searchShards?.length)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capabilities"],
        message: "search capability must match installed search shards",
      });
    }
    for (const profile of ["walk", "bicycle", "car"] as const) {
      if (
        manifest.capabilities.includes(`routing.${profile}`) !==
        Boolean(
          manifest.routingGraph && manifest.optionalComponents.routing[profile],
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["capabilities"],
          message: `routing.${profile} capability inconsistent with graph`,
        });
      }
    }
    if (
      manifest.capabilities.includes("contours") !==
      Boolean(manifest.contourLines)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capabilities"],
        message: "contours capability inconsistent with data",
      });
    }
    if (
      manifest.capabilities.includes("elevation") !== Boolean(manifest.demGrid)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capabilities"],
        message: "elevation requires a real regional DEM grid",
      });
    }
    if (manifest.demGrid && !manifest.optionalComponents.elevation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["optionalComponents"],
        message: "DEM grid must enable elevation component",
      });
    }
    if (
      manifest.capabilities.includes("wikipedia") !==
      Boolean(manifest.wikipediaPack)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capabilities"],
        message: "wikipedia capability must match package",
      });
    }
    if (
      manifest.capabilities.includes("transit") !==
      Boolean(manifest.transitPack)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capabilities"],
        message: "transit capability must match package",
      });
    }
    if (manifest.totalBytes !== bytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalBytes"],
        message: "totalBytes must equal referenced assets",
      });
    }
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

export type Capability = z.infer<typeof capabilitySchema>;

export type OptionalComponents = {
  search: Record<string, never>;
  routing: {
    walk: boolean;
    bicycle: boolean;
    car: boolean;
  };
  elevation: boolean;
  contours: boolean;
};

export type ManifestChecksums = {
  archive: string;
  style?: string;
  glyphs: string[];
  sprites: string[];
};

export type ManifestSources = {
  osm: string;
  attributions: Array<{ name: string; url: string }>;
};
