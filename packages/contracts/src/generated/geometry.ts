import { z } from "zod";

/** Canonical storage SRID (SIRGAS 2000) used by PostGIS. */
export const STORAGE_SRID = 4674;

/**
 * The wire format is fixed on purpose: the client must not be able to choose an
 * arbitrary SRID (10-BACKEND-VISIONARIO-PRD.md:235).
 */
export const wireSridSchema = z.literal(4326);

/**
 * RFC 7946 position: [longitude, latitude] with an optional altitude.
 * Modelled as a union because `z.tuple([a, b, c.optional()])` still demands 3
 * elements, which would reject every 2D GeoJSON coordinate.
 */
export const positionSchema = z.union([
  z.tuple([z.number().finite(), z.number().finite()]),
  z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
]);

export const pointGeometrySchema = z.object({
  type: z.literal("Point"),
  coordinates: positionSchema,
});

export const lineStringGeometrySchema = z.object({
  type: z.literal("LineString"),
  coordinates: z
    .array(positionSchema)
    .min(2, "LineString needs at least 2 positions"),
});

const isRingClosed = (ring: readonly Position[]): boolean => {
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first === undefined || last === undefined) return false;
  return first[0] === last[0] && first[1] === last[1];
};

/** RFC 7946 linear ring: at least 4 positions, first equal to last. */
export const linearRingSchema = z
  .array(positionSchema)
  .min(4, "Linear ring must have at least 4 positions")
  .refine(
    isRingClosed,
    "Linear ring must be closed (first position equals last)",
  );

export const polygonGeometrySchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z
    .array(linearRingSchema)
    .min(1, "Polygon needs at least 1 ring"),
});

export const multiPointGeometrySchema = z.object({
  type: z.literal("MultiPoint"),
  coordinates: z.array(positionSchema).min(1),
});

export const multiLineStringGeometrySchema = z.object({
  type: z.literal("MultiLineString"),
  coordinates: z.array(z.array(positionSchema).min(2)).min(1),
});

export const multiPolygonGeometrySchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(linearRingSchema).min(1)).min(1),
});

/**
 * GeometryCollection is deliberately not modelled: the first milestone only
 * produces Point/LineString/Polygon and their Multi* forms. Registered in
 * docs/api/README.md as a pending item.
 */
export const geometrySchema = z.discriminatedUnion("type", [
  pointGeometrySchema,
  lineStringGeometrySchema,
  polygonGeometrySchema,
  multiPointGeometrySchema,
  multiLineStringGeometrySchema,
  multiPolygonGeometrySchema,
]);

export const geometryTypeSchema = z.enum([
  "Point",
  "LineString",
  "Polygon",
  "MultiPoint",
  "MultiLineString",
  "MultiPolygon",
]);

/** Single geometry types a vector layer can declare. */
export const simpleGeometryTypeSchema = z.enum([
  "Point",
  "LineString",
  "Polygon",
]);

export const geometryKindSchema = z.enum(["point", "line", "polygon"]);
export type GeometryKind = z.infer<typeof geometryKindSchema>;

const kindByType: Record<z.infer<typeof geometryTypeSchema>, GeometryKind> = {
  Point: "point",
  MultiPoint: "point",
  LineString: "line",
  MultiLineString: "line",
  Polygon: "polygon",
  MultiPolygon: "polygon",
};

export type GeometryType = z.infer<typeof geometryTypeSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Geometry = z.infer<typeof geometrySchema>;
export type Point = z.infer<typeof pointGeometrySchema>;
export type LineString = z.infer<typeof lineStringGeometrySchema>;
export type Polygon = z.infer<typeof polygonGeometrySchema>;
export type MultiPoint = z.infer<typeof multiPointGeometrySchema>;
export type MultiLineString = z.infer<typeof multiLineStringGeometrySchema>;
export type MultiPolygon = z.infer<typeof multiPolygonGeometrySchema>;
export type LinearRing = z.infer<typeof linearRingSchema>;

export const geometryKindOf = (geometry: Geometry): GeometryKind =>
  kindByType[geometry.type];

/** A layer with a declared geometryType accepts only that exact type. */
export const isGeometryCompatibleWith = (
  geometry: Geometry,
  allowedType: GeometryType | null,
): boolean => (allowedType === null ? true : geometry.type === allowedType);
