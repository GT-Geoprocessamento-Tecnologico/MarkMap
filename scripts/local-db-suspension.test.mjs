import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const ts = createRequire(import.meta.url)('typescript');
const file = new URL('../apps/admin/src/lib/local-db/index.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
  fileName: 'index.ts', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);

function environment() {
  let count = 0;
  let failMode;
  const rows = new Map();
  const connections = [];
  const idb = {
    get opens() { return count; },
    connections,
    failNext(name) { failMode = name; },
    open() {
      count++;
      const request = { result: null, onsuccess: null, onerror: null, onblocked: null, onupgradeneeded: null };
      const db = {
        closed: false, onversionchange: null,
        close() { this.closed = true; },
        transaction(_names, _mode) {
          if (this.closed || failMode) {
            const name = this.closed ? 'InvalidStateError' : failMode;
            failMode = undefined;
            throw new DOMException(name, name);
          }
          const staged = new Map(rows);
          let aborted = false;
          const tx = {
            error: null, oncomplete: null, onabort: null, onerror: null,
            abort() { aborted = true; queueMicrotask(() => tx.onabort?.()); },
            objectStore() {
              return {
                get(key) {
                  const r = { result: staged.get(key), onsuccess: null, onerror: null };
                  queueMicrotask(() => r.onsuccess?.());
                  return r;
                },
                put(row) { staged.set(row.key, row); },
              };
            },
          };
          setImmediate(() => {
            if (aborted) return;
            rows.clear();
            for (const [key, value] of staged) rows.set(key, value);
            tx.oncomplete?.();
          });
          return tx;
        },
      };
      connections.push(db);
      queueMicrotask(() => { request.result = db; request.onsuccess?.(); });
      return request;
    },
  };
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports,
    require(name) {
      if (name === './types') return { LOCAL_DB_NAME: 'GeoNexoLocalFirstDB', LOCAL_DB_VERSION: 2 };
      throw Error('Unrecognized import ' + name);
    },
    indexedDB: idb, crypto: webcrypto, DOMException, Promise, queueMicrotask,
  });
  return { idb, db: new exports.IndexedLocalDb(), requestValue: exports.requestValue };
}

test('A46 silent connection shutdown invalidates cache, preserving the previously committed record', async () => {
  const { idb, db, requestValue } = environment();
  await db.transact(['meta'], 'readwrite', tx => tx.store('meta').put({key:'saved',value:'offline-data'}));
  idb.connections[0].close(); // WebView silently disposed of the handle; no versionchange.
  await assert.rejects(db.transact(['meta'], 'readonly', tx => requestValue(tx.store('meta').get('saved'))), e => e.name === 'InvalidStateError');
  const row = await db.transact(['meta'], 'readonly', tx => requestValue(tx.store('meta').get('saved')));
  assert.equal(row.value, 'offline-data');
  assert.equal(idb.opens, 2);
});

test('A46 stale closed connection cannot poison workspace ID reads across resume', async () => {
  const { idb, db, requestValue } = environment();
  const workspace = await db.workspaceId();
  idb.connections[0].close();
  await assert.rejects(db.transact(['meta'], 'readonly', tx => requestValue(tx.store('meta').get('workspaceId'))), e => e.name === 'InvalidStateError');
  assert.equal(await db.workspaceId(), workspace);
  assert.equal(idb.opens, 2);
});

test('A46 a transaction creation failure must never execute local write callback', async () => {
  const { idb, db } = environment();
  await db.workspaceId();
  idb.connections[0].close();
  let touched = false;
  await assert.rejects(db.transact(['outbox'], 'readwrite', () => { touched = true; }), e => e.name === 'InvalidStateError');
  assert.equal(touched, false);
  await db.transact(['outbox'], 'readwrite', () => { touched = true; });
  assert.equal(touched, true);
  assert.equal(idb.opens, 2);
});

test('A46 non-InvalidStateError transaction failure does not churn working connections', async () => {
  const { idb, db } = environment();
  await db.workspaceId();
  idb.failNext('DataError');
  await assert.rejects(db.transact(['meta'], 'readonly', () => 1), e => e.name === 'DataError');
  assert.equal(await db.transact(['meta'], 'readonly', () => 9), 9);
  assert.equal(idb.opens, 1);
});
