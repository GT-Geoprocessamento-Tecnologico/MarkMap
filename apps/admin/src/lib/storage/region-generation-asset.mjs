/**
 * Read an asset and its active package marker in ONE IndexedDB snapshot.
 * The caller supplies an explicit generation: stale requests fail closed.
 */
const asPromise = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB asset read failed"));
  });

export async function readActiveGenerationAsset(
  db,
  packageId,
  path,
  generation,
) {
  if (
    typeof packageId !== "string" ||
    typeof path !== "string" ||
    typeof generation !== "string" ||
    !packageId ||
    !path ||
    !generation
  )
    throw new TypeError("Expected region, asset path and generation");
  const tx = db.transaction(["packages", "assets"], "readonly");
  const packageRequest = tx
    .objectStore("packages")
    .get(`${packageId}:${generation}`);
  const assetRequest = tx.objectStore("assets").get(`${generation}:${path}`);
  const [region, asset] = await Promise.all([
    asPromise(packageRequest),
    asPromise(assetRequest),
  ]);
  if (
    !region ||
    region.state !== "active" ||
    region.packageId !== packageId ||
    region.generation !== generation ||
    !asset ||
    asset.packageId !== generation ||
    asset.path !== path
  )
    return null;
  if (asset.bytes instanceof Blob) return asset.bytes;
  if (asset.bytes instanceof ArrayBuffer) return new Blob([asset.bytes]);
  return null;
}
