import type { Bbox, Geometry } from "@geonexo/contracts";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import type { Db } from "../client.js";
import { InvalidGeometryError } from "../errors.js";

/**
 * The only PostGIS entry points of the package — the functions allowed by
 * 10-BACKEND-VISIONARIO-PRD.md:237-247. Conversion happens here, at the system
 * border, and is always explicit (00-MASTER-PRD.md:236).
 *
 * Wire format is GeoJSON in EPSG:4326; storage is EPSG:4674.
 */

/** Wire GeoJSON (4326) -> stored geometry (4674). */
export const geomFromGeoJSON = (geometry: Geometry): SQL =>
  sql`ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326), 4674)`;

/** Stored geometry (4674) -> wire GeoJSON (4326). */
export const geoJsonFromGeometry = (column: AnyPgColumn): SQL<string> =>
  sql<string>`ST_AsGeoJSON(ST_Transform(${column}, 4326))`;

/**
 * `geometry && envelope` keeps the GiST index usable (PRD:487-488). The wire
 * bbox (4326) is transformed to the storage SRID instead of being relabelled.
 */
export const bboxOverlaps = (column: AnyPgColumn, bbox: Bbox): SQL =>
  sql`${column} && ST_Transform(ST_MakeEnvelope(${bbox.minLng}, ${bbox.minLat}, ${bbox.maxLng}, ${bbox.maxLat}, 4326), 4674)`;

type GeometryProbe = { empty: boolean; valid: boolean };

/** True when the error carries a 5-character SQLSTATE (e.g. `22023`). */
const isSqlState = (error: unknown): error is { code: string } => {
  if (typeof error !== "object" || error === null || !("code" in error))
    return false;
  const { code } = error as { code: unknown };
  return typeof code === "string" && /^[0-9A-Z]{5}$/.test(code);
};

/**
 * Validates before insert/update: parseable, non-empty and `ST_IsValid`
 * (00-MASTER-PRD.md:532). The probe reads no tables, so a SQLSTATE failure
 * here can only come from the geometry itself (bad JSON, unparseable text,
 * coordinates the projection rejects).
 */
export const assertStorableGeometry = async (
  db: Db,
  geometry: Geometry,
): Promise<void> => {
  let rows: GeometryProbe[];
  try {
    rows = await db.execute<GeometryProbe>(sql`
      SELECT ST_IsEmpty(g) AS empty, ST_IsValid(g) AS valid
      FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(geometry)}), 4326) AS g) AS probe
    `);
  } catch (error) {
    if (isSqlState(error)) throw new InvalidGeometryError();
    throw error;
  }
  const row = rows[0];
  if (!row || row.empty === true || row.valid !== true)
    throw new InvalidGeometryError();
};
