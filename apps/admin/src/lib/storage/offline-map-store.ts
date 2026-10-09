import type { OfflineMapPackageManifest } from "@geonexo/contracts";
import { bytesOf, validateOfflinePackage, OFFLINE_PACKAGE_DB, OFFLINE_PACKAGE_VERSION, type PackageAssets, type StoredOfflinePackage } from "@geonexo/maps/offline/package";

const PACKAGES = "packages";
const ASSETS = "assets";
type PackageRow = StoredOfflinePackage & { key: string; packageId: string; generation: string; bytes: number };
type AssetRow = { key: string; packageId: string; path: string; bytes: Blob };

function request<T>(req: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed")); }); }
function transaction(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted")); tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed")); }); }

export class OfflineMapStore {
  private dbPromise?: Promise<IDBDatabase>;
  constructor(private readonly dbName = OFFLINE_PACKAGE_DB) {}
  private open(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is unavailable"));
      const r = indexedDB.open(this.dbName, OFFLINE_PACKAGE_VERSION);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(PACKAGES)) db.createObjectStore(PACKAGES, { keyPath: "key" }); if (!db.objectStoreNames.contains(ASSETS)) { const s = db.createObjectStore(ASSETS, { keyPath: "key" }); s.createIndex("package", "packageId"); } };
      r.onsuccess = () => { r.result.onversionchange = () => { r.result.close(); this.dbPromise = undefined; }; resolve(r.result); };
      r.onerror = () => { this.dbPromise = undefined; reject(r.error); };
    });
    return this.dbPromise;
  }
  async list(): Promise<StoredOfflinePackage[]> { const db = await this.open(); const rows = await request<PackageRow[]>(db.transaction(PACKAGES, "readonly").objectStore(PACKAGES).getAll()); return rows.filter((row) => row.state === "active").map(({ key: _key, packageId: _packageId, generation: _generation, bytes: _bytes, ...row }) => row); }
  async get(packageId: string): Promise<StoredOfflinePackage | null> { const db = await this.open(); const rows = await request<PackageRow[]>(db.transaction(PACKAGES, "readonly").objectStore(PACKAGES).getAll()); const row = rows.find((candidate) => candidate.packageId === packageId && candidate.state === "active"); if (!row) return null; const { key: _key, packageId: _packageId, generation: _generation, bytes: _bytes, ...value } = row; return value; }
  async active(): Promise<StoredOfflinePackage | null> { const values = await this.list(); return values.find((v) => v.state === "active") ?? null; }
  async asset(packageId: string, path: string): Promise<Blob | null> { const db = await this.open(); const rows = await request<PackageRow[]>(db.transaction(PACKAGES, "readonly").objectStore(PACKAGES).getAll()); const active = rows.find((row) => row.packageId === packageId && row.state === "active"); if (!active) return null; const row = await request<AssetRow | undefined>(db.transaction(ASSETS, "readonly").objectStore(ASSETS).get(`${active.generation}:${path}`)); return row?.bytes ?? null; }

  async stage(manifest: OfflineMapPackageManifest, assets: PackageAssets): Promise<void> {
    const checked = await validateOfflinePackage(manifest, assets);
    if (!checked.ok) throw new Error(`${checked.code}: ${checked.detail}`);
    const packageBytes = manifest.archive.bytes + manifest.style.blob.bytes + manifest.glyphs.reduce((n, r) => n + r.blob.bytes, 0) + manifest.sprites.reduce((n, r) => n + r.blob.bytes, 0) + (manifest.searchShards ?? []).reduce((n, r) => n + r.blob.bytes, 0) +
      (manifest.routingGraph?.blob.bytes ?? 0) + (manifest.contourLines?.blob.bytes ?? 0) +
      (manifest.wikipediaPack?.blob.bytes ?? 0) + (manifest.transitPack?.blob.bytes ?? 0) +
      (manifest.demGrid?.blob.bytes ?? 0);
    const estimate = typeof navigator !== "undefined" ? await navigator.storage?.estimate?.() : undefined;
    if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.usage + packageBytes > estimate.quota) throw new Error("offline map storage quota is insufficient");
    const materialized = new Map<string, Blob>();
    for (const [path, asset] of [["package.pmtiles", assets.get("package.pmtiles")!], ...[manifest.style, ...manifest.glyphs, ...manifest.sprites, ...(manifest.searchShards ?? []), ...(manifest.routingGraph ? [manifest.routingGraph] : []), ...(manifest.contourLines ? [manifest.contourLines] : []),
      ...(manifest.wikipediaPack ? [manifest.wikipediaPack] : []),
      ...(manifest.transitPack ? [manifest.transitPack] : []),
      ...(manifest.demGrid ? [manifest.demGrid] : [])].map((ref) => [ref.path, assets.get(ref.path)!] as const)] as const) materialized.set(path, new Blob([await bytesOf(asset) as unknown as ArrayBuffer]));
    const db = await this.open();
    const generation = crypto.randomUUID();
    const key = `${manifest.id}:${generation}`;
    const tx = db.transaction([PACKAGES, ASSETS], "readwrite");
    const packages = tx.objectStore(PACKAGES); const store = tx.objectStore(ASSETS);
    const current = await request<PackageRow[]>(packages.getAll());
    const used = current.reduce((n, row) => n + row.bytes, 0);
    if (used + packageBytes > 250 * 1024 * 1024) { tx.abort(); throw new Error("offline map application quota is insufficient"); }
    packages.put({ key, packageId: manifest.id, generation, bytes: packageBytes, manifest, state: "staged", installedAt: new Date().toISOString() } satisfies PackageRow);
    for (const [path, bytes] of materialized) store.put({ key: `${generation}:${path}`, packageId: generation, path, bytes });
    await transaction(tx);
  }
  async activate(packageId: string): Promise<void> {
    const db = await this.open(); const tx = db.transaction([PACKAGES, ASSETS], "readwrite"); const store = tx.objectStore(PACKAGES); const assetStore = tx.objectStore(ASSETS); const all = await request<PackageRow[]>(store.getAll()); const next = all.find((p) => p.packageId === packageId && p.state === "staged"); if (!next) throw new Error("offline package is not staged");
    for (const row of all.filter((p) => p.packageId === packageId)) { if (row.key !== next.key) { store.delete(row.key); const oldAssets = await request<AssetRow[]>(assetStore.index("package").getAll(row.generation)); for (const asset of oldAssets) assetStore.delete(asset.key); } }
    store.put({ ...next, state: "active" });
    await transaction(tx);
  }
  async install(manifest: OfflineMapPackageManifest, assets: PackageAssets): Promise<void> { await this.stage(manifest, assets); await this.activate(manifest.id); }
  async remove(packageId: string): Promise<void> { const db = await this.open(); const tx = db.transaction([PACKAGES, ASSETS], "readwrite"); const packages = tx.objectStore(PACKAGES); const assets = tx.objectStore(ASSETS); const rows = await request<PackageRow[]>(packages.getAll()); for (const row of rows.filter((candidate) => candidate.packageId === packageId)) { packages.delete(row.key); const owned = await request<AssetRow[]>(assets.index("package").getAll(row.generation)); for (const asset of owned) assets.delete(asset.key); } await transaction(tx); }
}

export const offlineMapStore = new OfflineMapStore();
