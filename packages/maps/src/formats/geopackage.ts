export interface GpkgHeaderInfo {
  isValidSqlite: boolean;
  userVersion?: number;
}

export function inspectGeoPackageHeader(buffer: ArrayBuffer): GpkgHeaderInfo {
  if (buffer.byteLength < 16) {
    return { isValidSqlite: false };
  }
  const headerText = new TextDecoder("ascii").decode(new Uint8Array(buffer.slice(0, 16)));
  const isValidSqlite = headerText.startsWith("SQLite format 3");
  return { isValidSqlite };
}
