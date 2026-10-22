import type { DemMetadata } from "@markmap/contracts";

export function sampleDem(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  lon: number,
  lat: number,
): number | null {
  const [minLon, minLat, maxLon, maxLat] = metadata.bounds;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return null;

  const colFrac = (lon - minLon) / (maxLon - minLon);
  const rowFrac = (lat - minLat) / (maxLat - minLat);
  const col = Math.min(
    Math.floor(colFrac * (metadata.width - 1)),
    metadata.width - 1,
  );
  const row = Math.min(
    Math.floor(rowFrac * (metadata.height - 1)),
    metadata.height - 1,
  );

  const value = dem[row * metadata.width + col];
  if (value === undefined || value === metadata.noDataValue) return null;
  return value;
}

export function sampleDemBilinear(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  lon: number,
  lat: number,
): number | null {
  const [minLon, minLat, maxLon, maxLat] = metadata.bounds;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return null;

  const colFrac =
    ((lon - minLon) / (maxLon - minLon)) * (metadata.width - 1);
  const rowFrac =
    ((lat - minLat) / (maxLat - minLat)) * (metadata.height - 1);

  const col0 = Math.floor(colFrac);
  const row0 = Math.floor(rowFrac);
  const col1 = Math.min(col0 + 1, metadata.width - 1);
  const row1 = Math.min(row0 + 1, metadata.height - 1);
  const dx = colFrac - col0;
  const dy = rowFrac - row0;

  const v00 = dem[row0 * metadata.width + col0];
  const v01 = dem[row0 * metadata.width + col1];
  const v10 = dem[row1 * metadata.width + col0];
  const v11 = dem[row1 * metadata.width + col1];

  if (
    v00 === undefined || v01 === undefined ||
    v10 === undefined || v11 === undefined ||
    v00 === metadata.noDataValue || v01 === metadata.noDataValue ||
    v10 === metadata.noDataValue || v11 === metadata.noDataValue
  ) {
    return sampleDem(dem, metadata, lon, lat);
  }

  return (
    v00 * (1 - dx) * (1 - dy) +
    v01 * dx * (1 - dy) +
    v10 * (1 - dx) * dy +
    v11 * dx * dy
  );
}
