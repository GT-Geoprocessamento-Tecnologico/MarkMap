import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const ts = createRequire(import.meta.url)('typescript');
const file = new URL('../apps/admin/src/lib/local-db/index.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
  fileName: 'local-db/index.ts', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const stores = ['meta', 'entities', 'originals', 'outbox', 'conflicts', 'acks'];

// Minimal async IDB contract: open, store requests, transactions, close and versionchange.
// It models successful commit only; no browser compliance claims.
function fakeIndexedDb() {
  let failures = 0;
  let txFailures = 0;
  let blocked = 0;
  let opens = 0;
  const connections = [];
  const data = new Map();
  const otherTables = new Map(stores.filter(name => name !== 'meta').map(name => [name, new Map()]));
  const idb = {
    seed(storeName, record) {
      const table = storeName === 'meta' ? data : otherTables.get(storeName);
      if (!table) throw new Error('Unknown store ' + storeName);
      table.set(record.key, record);
    },
    get opens() { return opens; },
    get connections() { return connections; },
    failOpen(times = 1) { failures = times; },
    failTransaction(times = 1) { txFailures = times; },
    blockOpen(times = 1) { blocked = times; },
    open() {
      opens++;
      const req = { result: undefined, error: null, onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null };
      const willFail = failures-- > 0;
      const willBlock = blocked-- > 0;
      const connection = {
        closed: false, closeCount: 0, onversionchange: null,
        objectStoreNames: { contains(name) { return stores.includes(name); } },
        close() { this.closed = true; this.closeCount++; },
        transaction(names, mode) {
          if (this.closed) throw new DOMException('Database is closed', 'InvalidStateError');
          if (txFailures-- > 0) throw new DOMException('Transient transaction failure', 'InvalidStateError');
          const staged = new Map(data);
          let aborted = false;
          const tx = {
            oncomplete: null, onerror: null, onabort: null, error: null,
            abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); },
            objectStore(name) {
              const table = name === 'meta' ? staged : otherTables.get(name);
              if (!table) throw new Error('Unknown store ' + name);
              return {
                get(key) {
                  const row = table.get(key);
                  const r = { result: row, error: null, onsuccess: null, onerror: null };
                  queueMicrotask(() => r.onsuccess?.());
                  return r;
                },
                put(row) { table.set(row.key, row); },
                index(indexName) {
                  if (indexName !== 'workspace') throw Error('Unexpected index ' + indexName);
                  return {
                    openKeyCursor() {
                      const ids = [...new Set([...table.values()]
                        .map(record => record.workspaceId)
                        .filter(value => typeof value === 'string'))].sort();
                      let offset = 0;
                      const cursorRequest = { result: null, error: null, onsuccess: null, onerror: null };
                      const emit = () => {
                        const key = ids[offset];
                        cursorRequest.result = key === undefined ? null : {
                          key,
                          continue() { offset += 1; queueMicrotask(emit); },
                        };
                        cursorRequest.onsuccess?.();
                      };
                      queueMicrotask(emit);
                      return cursorRequest;
                    },
                  };
                },
              };
            },
          };
          setImmediate(() => {
            if (aborted) return;
            if (mode === 'readwrite') { data.clear(); for (const [k, v] of staged) data.set(k, v); }
            tx.oncomplete?.();
          });
          return tx;
        },
      };
      connections.push(connection);
      // IDB exposes success/error only after listeners are installed.
      queueMicrotask(() => {
        if (willFail) { req.error = new Error('Open failed transiently'); req.onerror?.(); return; }
        if (willBlock) {
          req.onblocked?.();
          setImmediate(() => { req.result = connection; req.onsuccess?.(); });
          return;
        }
        req.result = connection;
        req.onsuccess?.();
      });
      return req;
    },
  };
  return idb;
}
function harness() {
  const indexedDB = fakeIndexedDb();
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports,
    require(name) {
      if (name === './types') return { LOCAL_DB_NAME: 'GeoNexoLocalFirstDB', LOCAL_DB_VERSION: 2 };
      throw Error('Unexpected require: ' + name);
    },
    indexedDB, crypto: webcrypto, DOMException, Promise, queueMicrotask,
  });
  return { indexedDB, db: new exports.IndexedLocalDb() };
}

const readWorkspace = async (db) => db.workspaceId();

// Every case fails on the old implementation; a failure must not poison the instance.
test('A45 database opens again after transient IndexedDB open failure', async () => {
  const { indexedDB, db } = harness();
  indexedDB.failOpen();
  await assert.rejects(readWorkspace(db), /Open failed transiently/);
  const workspace = await readWorkspace(db);
  assert.equal(typeof workspace, 'string');
  assert.equal(indexedDB.opens, 2);
  assert.equal(await readWorkspace(db), workspace);
});

test('A45 workspace ID loading retries after transaction creation failure', async () => {
  const { indexedDB, db } = harness();
  indexedDB.failTransaction();
  await assert.rejects(db.workspaceId(), /Transient transaction failure/);
  const workspace = await db.workspaceId();
  assert.equal(typeof workspace, 'string');
  // InvalidStateError means the cached connection can be closing/closed.
  // A46 deliberately reopens it instead of poisoning future operations.
  assert.equal(indexedDB.opens, 2);
});

test('A45 versionchange invalidates closed connection and reopens without deleting data', async () => {
  const { indexedDB, db } = harness();
  const workspace = await db.workspaceId();
  assert.equal(indexedDB.opens, 1);
  indexedDB.connections[0].onversionchange?.();
  assert.equal(indexedDB.connections[0].closed, true);
  assert.equal(await db.workspaceId(), workspace);
  assert.equal(indexedDB.opens, 2);
});

test('A45 close after a rejected open must not create unhandled rejection and can reopen', async () => {
  const { indexedDB, db } = harness();
  indexedDB.failOpen();
  await assert.rejects(db.workspaceId(), /Open failed transiently/);
  db.close();
  const workspace = await db.workspaceId();
  assert.equal(typeof workspace, 'string');
  assert.equal(indexedDB.opens, 2);
});

test('A45 a blocked obsolete request closes its late connection before next retry', async () => {
  const { indexedDB, db } = harness();
  indexedDB.blockOpen();
  await assert.rejects(db.workspaceId(), /bloqueado/i);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(indexedDB.connections[0].closed, true);
  const workspace = await db.workspaceId();
  assert.equal(typeof workspace, 'string');
  assert.equal(indexedDB.opens, 2);
});

test('A45 parallel successful calls reuse a single opening and stable workspace', async () => {
  const { indexedDB, db } = harness();
  const [one, two] = await Promise.all([db.workspaceId(), db.workspaceId()]);
  assert.equal(one, two);
  assert.equal(indexedDB.opens, 1);
});

test('A86 recovers unique saved workspace after losing metadata', async () => {
  const { indexedDB, db } = harness();
  indexedDB.seed('entities', {
    key: 'saved-workspace:project:p1', workspaceId: 'saved-workspace',
    entity: 'project', entityId: 'p1', deleted: false,
  });
  assert.equal(await db.workspaceId(), 'saved-workspace');
  db.close();
  assert.equal(await db.workspaceId(), 'saved-workspace');
});

test('A86 recovers the workspace of existing PDF originals', async () => {
  const { indexedDB, db } = harness();
  indexedDB.seed('originals', {
    key: 'pdf-workspace:pdf-1', workspaceId: 'pdf-workspace', blobId: 'pdf-1',
  });
  assert.equal(await db.workspaceId(), 'pdf-workspace');
});

test('A86 blocks unsafe identity recreation when multiple workspaces remain', async () => {
  const { indexedDB, db } = harness();
  indexedDB.seed('entities', { key: 'workspace-a:project:p1', workspaceId: 'workspace-a' });
  indexedDB.seed('outbox', { key: 'op-1', workspaceId: 'workspace-b' });
  await assert.rejects(db.workspaceId(), /vários workspaces/);
  await assert.rejects(db.workspaceId(), /vários workspaces/);
});

test('A86 preserves an existing identity even when old records are retained', async () => {
  const { indexedDB, db } = harness();
  indexedDB.seed('meta', { key: 'workspaceId', value: 'active-workspace' });
  indexedDB.seed('entities', { key: 'old:project:p1', workspaceId: 'old' });
  assert.equal(await db.workspaceId(), 'active-workspace');
});
