export const MAX_VECTOR_IMPORT_BYTES = 25 * 1024 * 1024;

export async function parseShapefileZip(zipBuffer: ArrayBuffer): Promise<GeoJSON.FeatureCollection> {
  if (zipBuffer.byteLength > MAX_VECTOR_IMPORT_BYTES) {
    throw new Error(`Dataset exceeds maximum allowed size of 25MB (${(zipBuffer.byteLength / 1024 / 1024).toFixed(1)}MB)`);
  }

  throw new Error("Shapefile ZIP parsing is not available in this build; no features were imported");
}
