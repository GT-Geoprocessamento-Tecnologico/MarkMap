import { z } from 'zod';

/**
 * Coordinate validation per geometry type as specified in integration-details.md
 */

export const PointCoordinates = z.tuple([z.number(), z.number()]);
export const LineStringCoordinates = z.array(PointCoordinates).min(2);
export const PolygonCoordinates = z.array(z.array(PointCoordinates).min(4));

/**
 * GeometrySchema validates only simple geometries (Point, LineString, Polygon)
 * with strict coordinate validation per type.
 */
export const GeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'),   coordinates: PointCoordinates }),
  z.object({ type: z.literal('LineString'), coordinates: LineStringCoordinates }),
  z.object({ type: z.literal('Polygon'), coordinates: PolygonCoordinates }),
]);

export type Geometry = z.infer<typeof GeometrySchema>;
export type Point = z.infer<z.TypeOf<typeof PointCoordinates>>;
export type LineString = z.infer<z.TypeOf<typeof LineStringCoordinates>>;
export type Polygon = z.infer<z.TypeOf<typeof PolygonCoordinates>>;