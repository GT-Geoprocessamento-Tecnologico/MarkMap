import { expect, test } from '@playwright/test';

test('optional stores never imply a complete backup', async ({ page }) => {
  await page.goto('/?restore=1');
  const result = await page.evaluate(async () => {
    const path = '/src/lib/backup/multi-db.ts';
    const readers = await import(path);
    const absent = await readers.readOfflineMapsSnapshot();
    const create = (name: string, stores: string[]) => new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => { for (const store of stores) req.result.createObjectStore(store, {keyPath:store === 'store' ? 'id' : 'key'}); };
      req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
    });
    const write = (db: IDBDatabase, store: string, value: unknown) => new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    const maps = await create('GeoNexoOfflineMapPackages', ['packages', 'assets']);
    await write(maps, 'assets', {key:'orphan', bytes:new Uint8Array([1,2,3]).buffer}); maps.close();
    const orphanAsset = await readers.readOfflineMapsSnapshot();
    const blobs = await create('large-blob-store', ['blobs', 'metadata']);
    await write(blobs, 'metadata', {key:'orphan-meta'}); blobs.close();
    const orphanMetadata = await readers.readLargeBlobsSnapshot();
    const engine = await create('GeoNexoLocalEngineDB', ['store']);
    await write(engine, 'store', {id:'binary', payload:{originalBytes:new ArrayBuffer(4)}}); engine.close();
    const local = await readers.readLocalEngineSnapshot();
    return {absent:absent.coverage.status, assets:orphanAsset.coverage.status, blobs:orphanMetadata.coverage.status, local:local.coverage.status};
  });
  expect(result).toEqual({absent:'absent', assets:'pending', blobs:'pending', local:'pending'});
});

test('a live sync claim prevents concurrent restore and the pause prevents later sync', async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  let release!: () => void;
  let requests = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await first.route('**/synthetic-api/**', async route => { requests++; await gate; await route.fulfill({status:503, body:'{}'}); });
  await first.goto('/?restore=1');
  await second.goto('/?restore=1');
  await first.evaluate(async () => {
    const path = '/src/lib/sync/sync-engine.ts';
    const engine = await import(path);
    (window as Window & { testSync: Promise<unknown> }).testSync = engine.syncNow();
  });
  await expect.poll(() => requests, {timeout:15000}).toBe(1);
  const attempt = async () => second.evaluate(async () => {
    const dbPath = '/src/lib/local-db/index.ts';
    const restorePath = '/src/lib/backup/restore.ts';
    const {localDb} = await import(dbPath);
    const {restoreWorkspaceSnapshot} = await import(restorePath);
    const workspaceId = await localDb.workspaceId();
    const snapshot = {schemaVersion:1, database:'GeoNexoLocalFirstDB', databaseVersion:2, metadata:{workspaceId,outboxSequence:null}, stores:{entities:[],originals:[],outbox:[],conflicts:[],acks:[]}};
    try { await restoreWorkspaceSnapshot(snapshot, localDb, {confirmed:true}); return 'restored'; }
    catch (error) { return String(error); }
  });
  expect(await attempt()).toMatch(/Sincronização em andamento/);
  release();
  await first.evaluate(() => (window as Window & { testSync: Promise<unknown> }).testSync);
  expect(await attempt()).toBe('restored');
  const status = await first.evaluate(async () => {
    const path = '/src/lib/sync/sync-engine.ts';
    return (await (await import(path)).syncNow()).state;
  });
  expect(status).toBe('paused');
  expect(requests).toBe(1);
});

test('closing a sync owner permits explicit claim review but keeps sync paused', async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  let release!: () => void;
  let requests = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await context.route('**/synthetic-api/**', async route => {
    requests++;
    await gate;
    await route.abort().catch(() => undefined);
  });
  await first.goto('/?restore=1');
  await second.goto('/?restore=1');
  await first.evaluate(async () => {
    const path = '/src/lib/sync/sync-engine.ts';
    void (await import(path)).syncNow();
  });
  await expect.poll(() => requests, { timeout: 15_000 }).toBe(1);
  const token = await second.evaluate(async () => {
    const path = '/src/lib/local-repositories/index.ts';
    const { localRepository } = await import(path);
    return (await localRepository.getMeta('syncInProgress')).token as string;
  });
  const review = async () => second.evaluate(async (claimToken) => {
    const path = '/src/lib/sync/sync-engine.ts';
    return (await import(path)).recoverStaleSyncClaim(claimToken);
  }, token);
  expect(await review()).toBe(false);
  await first.close();
  release();
  await expect.poll(review, { timeout: 10_000 }).toBe(true);
  const state = await second.evaluate(async () => {
    const repoPath = '/src/lib/local-repositories/index.ts';
    const syncPath = '/src/lib/sync/sync-engine.ts';
    const { localRepository } = await import(repoPath);
    const engine = await import(syncPath);
    return {
      claim: await localRepository.getMeta('syncInProgress'),
      pause: await localRepository.getMeta('syncPausedAfterRestore'),
      sync: (await engine.syncNow()).state,
    };
  });
  expect(state.claim).toBeUndefined();
  expect(state.pause).toMatchObject({ kind: 'restore', generation: expect.any(String) });
  expect(state.sync).toBe('paused');
  expect(requests).toBe(1);
});
