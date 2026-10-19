import type { OfflineMapPackageManifest } from "@geonexo/contracts";
import { bytesOf, validateOfflinePackage, OFFLINE_PACKAGE_DB, OFFLINE_PACKAGE_VERSION, OFFLINE_PACKAGE_QUOTA, type PackageAsset, type PackageAssets, type StoredOfflinePackage } from "@geonexo/maps/offline/package";

import { matchesActiveRegionGeneration } from './region-generation-guard.mjs';
import { notifyRegionCatalogChanged } from './region-catalog-events.mjs';
import { readActiveGenerationAsset } from './region-generation-asset.mjs';
import { copyBytes, isBlobPreparationError, settleTransaction } from './idb-binary-compat.mjs';

export class StaleRegionGenerationError extends Error {
  readonly code = 'stale-active-generation';
  constructor() {
    super('A região instalada mudou em outra aba. Consulte a versão novamente antes de atualizar.');
    this.name = 'StaleRegionGenerationError';
  }
}

const PACKAGES = "packages";
const ASSETS = "assets";
type PackageRow = StoredOfflinePackage & { key: string; packageId: string; generation: string; bytes: number };
type AssetRow = { key: string; packageId: string; path: string; bytes: Blob | ArrayBuffer };

function request<T>(req: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed")); }); }
function transaction(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted")); tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed")); }); }

function accountedBytes(rows: PackageRow[], packageId: string): number {
  return rows.reduce((used, row) => {
    if (!Number.isSafeInteger(row.bytes) || row.bytes < 0) throw new Error("invalid offline map storage accounting");
    return row.packageId === packageId && row.state === "staged" ? used : used + row.bytes;
  }, 0);
}

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
  /** Read the installed manifest and its CAS generation in the SAME snapshot. */
  async getActiveRevision(packageId: string): Promise<{generation: string; manifest: OfflineMapPackageManifest} | null> {
    const db = await this.open();
    const rows = await request<PackageRow[]>(db.transaction(PACKAGES, 'readonly').objectStore(PACKAGES).getAll());
    const matching = rows.filter((row) => row.packageId === packageId && row.state === 'active');
    if (matching.length > 1) throw new Error('Ambiguous active offline map generations');
    return matching.length ? { generation: matching[0].generation, manifest: matching[0].manifest } : null;
  }
  /**
   * A19: bind MapLibre assets to a single active generation. The package marker
   * and asset are read from the same readonly transaction; stale readers get null.
   */
  async assetAtRevision(packageId: string, path: string, generation: string): Promise<Blob | null> {
    return readActiveGenerationAsset(await this.open(), packageId, path, generation);
  }
  async active(): Promise<StoredOfflinePackage | null> { const values = await this.list(); return values.find((v) => v.state === "active") ?? null; }
  async asset(packageId: string, path: string): Promise<Blob | null> { const db = await this.open(); const rows = await request<PackageRow[]>(db.transaction(PACKAGES, "readonly").objectStore(PACKAGES).getAll()); const active = rows.find((row) => row.packageId === packageId && row.state === "active"); if (!active) return null; const row = await request<AssetRow | undefined>(db.transaction(ASSETS, "readonly").objectStore(ASSETS).get(`${active.generation}:${path}`)); if (!row) return null; if (row.bytes instanceof Blob) return row.bytes; if (row.bytes instanceof ArrayBuffer) return new Blob([row.bytes]); return null; }

  /** Active packages remain counted; obsolete staged generations are reclaimed atomically. */
  async installationBudget(packageId: string): Promise<{ usedBytes: number; availableBytes: number; limitBytes: number }> {
    const db = await this.open();
    const rows = await request<PackageRow[]>(db.transaction(PACKAGES, "readonly").objectStore(PACKAGES).getAll());
    const usedBytes = accountedBytes(rows, packageId);
    return { usedBytes, availableBytes: Math.max(0, OFFLINE_PACKAGE_QUOTA - usedBytes), limitBytes: OFFLINE_PACKAGE_QUOTA };
  }
  async stage(manifest: OfflineMapPackageManifest, assets: PackageAssets, expectedActiveGeneration?: string): Promise<string> {
    const checked = await validateOfflinePackage(manifest, assets);
    if (!checked.ok) throw new Error(`${checked.code}: ${checked.detail}`);
    const packageBytes = manifest.archive.bytes + manifest.style.blob.bytes + manifest.glyphs.reduce((n, r) => n + r.blob.bytes, 0) + manifest.sprites.reduce((n, r) => n + r.blob.bytes, 0) + (manifest.searchShards ?? []).reduce((n, r) => n + r.blob.bytes, 0) +
      (manifest.routingGraph?.blob.bytes ?? 0) + (manifest.contourLines?.blob.bytes ?? 0) +
      (manifest.wikipediaPack?.blob.bytes ?? 0) + (manifest.transitPack?.blob.bytes ?? 0) +
      (manifest.demGrid?.blob.bytes ?? 0);
    const estimate = typeof navigator !== "undefined" ? await navigator.storage?.estimate?.() : undefined;
    if (estimate?.quota !== undefined && estimate.usage !== undefined && estimate.usage + packageBytes > estimate.quota) throw new Error("offline map storage quota is insufficient");
    const entries: ReadonlyArray<readonly [string, PackageAsset]> = [["package.pmtiles", assets.get("package.pmtiles")!], ...[manifest.style, ...manifest.glyphs, ...manifest.sprites, ...(manifest.searchShards ?? []), ...(manifest.routingGraph ? [manifest.routingGraph] : []), ...(manifest.contourLines ? [manifest.contourLines] : []),
      ...(manifest.wikipediaPack ? [manifest.wikipediaPack] : []), ...(manifest.transitPack ? [manifest.transitPack] : []), ...(manifest.demGrid ? [manifest.demGrid] : [])].map((ref) => [ref.path, assets.get(ref.path)! as PackageAsset] as const)];
    const fallbackLimit = 10 * 1024 * 1024;
    const materialize = async (buffers: boolean): Promise<Map<string, Blob | ArrayBuffer>> => {
      const result = new Map<string, Blob | ArrayBuffer>();
      for (const [path, asset] of entries) {
        if (!buffers && asset instanceof Blob) { result.set(path, asset); continue; }
        const bytes = await bytesOf(asset);
        result.set(path, buffers ? copyBytes(bytes) : new Blob([bytes as unknown as ArrayBuffer]));
      }
      return result;
    };
    const materialized = await materialize(false);
    const db = await this.open();
    const generation = crypto.randomUUID();
    const key = `${manifest.id}:${generation}`;
    const attempt = async (records: Map<string, Blob | ArrayBuffer>): Promise<void> => {
      const tx = db.transaction([PACKAGES, ASSETS], "readwrite");
      let requestError: DOMException | null = null;
      const packages = tx.objectStore(PACKAGES); const store = tx.objectStore(ASSETS);
      const current = await request<PackageRow[]>(packages.getAll());
      if (!matchesActiveRegionGeneration(current, manifest.id, expectedActiveGeneration)) { tx.abort(); throw new StaleRegionGenerationError(); }
      const used = accountedBytes(current, manifest.id);
      if (used + packageBytes > OFFLINE_PACKAGE_QUOTA) { tx.abort(); throw new Error(`A região exige ${Math.ceil(packageBytes / 1048576)} MiB temporários; restam ${Math.floor(Math.max(0, OFFLINE_PACKAGE_QUOTA - used) / 1048576)} MiB no orçamento de mapas.`); }
      for (const old of current.filter((row) => row.packageId === manifest.id && row.state === "staged")) {
        packages.delete(old.key);
        const abandoned = await request<AssetRow[]>(store.index("package").getAll(old.generation));
        for (const asset of abandoned) store.delete(asset.key);
      }
      packages.put({ key, packageId: manifest.id, generation, bytes: packageBytes, manifest, state: "staged", installedAt: new Date().toISOString() } satisfies PackageRow);
      for (const [path, bytes] of records) {
        const put = store.put({ key: `${generation}:${path}`, packageId: generation, path, bytes });
        put.onerror = () => { requestError ??= put.error; try { tx.abort(); } catch { /* already aborting */ } };
      }
      await settleTransaction(tx, () => requestError);
    };
    try { await attempt(materialized); }
    catch (error) {
      if (!isBlobPreparationError(error)) throw error;
      if (packageBytes > fallbackLimit) throw new Error('IndexedDB não conseguiu serializar este pacote Blob; pacotes acima de 10 MiB não podem usar o fallback sem materialização integral.');
      await attempt(await materialize(true));
    }
    return generation;
  }
  async activate(packageId: string, expectedGeneration?: string, expectedActiveGeneration?: string): Promise<void> {
    const db = await this.open(); const tx = db.transaction([PACKAGES, ASSETS], "readwrite");
    const store = tx.objectStore(PACKAGES); const assetStore = tx.objectStore(ASSETS);
    const all = await request<PackageRow[]>(store.getAll());
    // Recheck CAS atomically immediately before replacing the active package.
    // Locks may not exist in every WebView and local imports bypass HTTP locks.
    if (!matchesActiveRegionGeneration(all, packageId, expectedActiveGeneration)) {
      tx.abort();
      throw new StaleRegionGenerationError();
    }
    const staged = all.filter((p) => p.packageId === packageId && p.state === "staged");
    const next = expectedGeneration
      ? staged.find((p) => p.generation === expectedGeneration)
      : staged.length === 1 ? staged[0] : undefined;
    if (!next) { tx.abort(); throw new Error("offline package staging was replaced or is ambiguous"); }
    for (const row of all.filter((p) => p.packageId === packageId)) { if (row.key !== next.key) { store.delete(row.key); const oldAssets = await request<AssetRow[]>(assetStore.index("package").getAll(row.generation)); for (const asset of oldAssets) assetStore.delete(asset.key); } }
    store.put({ ...next, state: "active" });
    await transaction(tx);
    notifyRegionCatalogChanged(packageId);
  }
  /** Roll back only the generation created by the failed installation. */
  private async discardStaged(packageId: string, generation: string): Promise<void> {
    const db = await this.open();
    const tx = db.transaction([PACKAGES, ASSETS], 'readwrite');
    const settled = transaction(tx);
    const packages = tx.objectStore(PACKAGES);
    const assets = tx.objectStore(ASSETS);
    try {
      const key = `${packageId}:${generation}`;
      const row = await request<PackageRow | undefined>(packages.get(key));
      if (row && row.state === 'staged' && row.generation === generation && row.packageId === packageId) {
        packages.delete(key);
        const owned = await request<IDBValidKey[]>(assets.index('package').getAllKeys(generation));
        for (const assetKey of owned) assets.delete(assetKey);
      }
      await settled;
    } catch (error) {
      try { tx.abort(); } catch { /* Already finished. */ }
      await settled.catch(() => undefined);
      throw error;
    }
  }
  async install(manifest: OfflineMapPackageManifest, assets: PackageAssets, expectedActiveGeneration?: string): Promise<void> {
    const generation = await this.stage(manifest, assets, expectedActiveGeneration);
    try { await this.activate(manifest.id, generation, expectedActiveGeneration); }
    catch (error) {
      // Never delete an active generation, including one installed by another tab.
      await this.discardStaged(manifest.id, generation).catch(() => undefined);
      throw error;
    }
  }
  async remove(packageId: string): Promise<void> { const db = await this.open(); const tx = db.transaction([PACKAGES, ASSETS], "readwrite"); const packages = tx.objectStore(PACKAGES); const assets = tx.objectStore(ASSETS); const rows = await request<PackageRow[]>(packages.getAll()); for (const row of rows.filter((candidate) => candidate.packageId === packageId)) { packages.delete(row.key); const owned = await request<AssetRow[]>(assets.index("package").getAll(row.generation)); for (const asset of owned) assets.delete(asset.key); } await transaction(tx); notifyRegionCatalogChanged(packageId); }
}

export const offlineMapStore = new OfflineMapStore();
