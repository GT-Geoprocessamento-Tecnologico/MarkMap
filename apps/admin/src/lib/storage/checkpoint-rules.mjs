/** Canonical one-MiB range checkpoint geometry. No schema migration required. */
export const REGION_DOWNLOAD_CHUNK_SIZE = 1024 * 1024;

/** Only complete, aligned chunks belong to the expected immutable asset. */
export function isValidCheckpoint(offset, length, assetSize, chunkSize = REGION_DOWNLOAD_CHUNK_SIZE) {
  return Number.isSafeInteger(offset) && offset >= 0 &&
    Number.isSafeInteger(length) && length > 0 &&
    Number.isSafeInteger(assetSize) && assetSize > 0 &&
    Number.isSafeInteger(chunkSize) && chunkSize >= 1024 && chunkSize <= 4 * 1024 * 1024 &&
    offset < assetSize && offset % chunkSize === 0 &&
    length === Math.min(chunkSize, assetSize - offset);
}

/** Do not delete content-addressed chunks still referenced by another region. */
export function unreferencedSessionHashes(packageId, sessions) {
  const removed = sessions.find((session) => session.packageId === packageId);
  if (!removed || !Array.isArray(removed.hashes)) return [];
  const shared = new Set(sessions.filter((session) => session.packageId !== packageId)
    .flatMap((session) => Array.isArray(session.hashes) ? session.hashes : []));
  return [...new Set(removed.hashes)].filter((hash) => !shared.has(hash));
}
