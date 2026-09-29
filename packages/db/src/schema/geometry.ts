import { customType } from 'drizzle-orm/pg-core';

/**
 * PostGIS geometry column: any geometry type, canonical storage SRID 4674
 * (SIRGAS 2000 — 00-MASTER-PRD.md:234, 50-CONTRATOS-DE-INTEGRACAO.md:90).
 *
 * This type exists for DDL generation (drizzle-kit emits
 * `geometry(Geometry, 4674)`) and for honest column typing: a raw column read
 * returns the driver value (PostGIS text/EWKB), never a parsed GeoJSON.
 * Reads must project `geoJsonFromGeometry()` and writes must use
 * `geomFromGeoJSON()` — both in `src/queries/spatial.ts`.
 */
export const geometryColumn = customType<{ data: string; driverData: string }>({
  dataType: () => 'geometry(Geometry, 4674)',
});
