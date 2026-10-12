import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const ts = createRequire(import.meta.url)('typescript');
const root = new URL('../apps/admin/src/lib/', import.meta.url);
const workspaceId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function loadTs(path, imports, extra = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, root), 'utf8'), {
    fileName: path, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports, require(name) { if (!(name in imports)) throw Error('Unexpected dependency ' + name); return imports[name]; },
    crypto: webcrypto, btoa, Response, URLSearchParams, AbortController,
    Uint8Array, TextEncoder, setTimeout, clearTimeout, queueMicrotask, DOMException, Event,
    ...extra,
  });
  return exports;
}

class SerializedMetaDb {
  constructor() {
    this.rows = new Map();
    this.queue = Promise.resolve();
    this.transactions = 0;
    this.failNextCommit = false;
  }
  async workspaceId() { return workspaceId; }
  peek(key) { return this.rows.get(key)?.value; }
  async transact(stores, mode, work) {
    assert.deepEqual([...stores], ['meta']);
    const previous = this.queue;
    let release;
    this.queue = new Promise(resolve => { release = resolve; });
    await previous;
    this.transactions++;
    const rows = new Map(this.rows);
    const store = {
      get(key) {
        const request = { result: rows.get(key), error: null, onsuccess: null, onerror: null };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
      put(row) { rows.set(row.key, structuredClone(row)); },
    };
    try {
      const result = await work({ store(name) { assert.equal(name, 'meta'); return store; } });
      if (mode === 'readwrite') {
        if (this.failNextCommit) { this.failNextCommit = false; throw new Error('Commit failure'); }
        this.rows = rows;
      }
      return result;
    } finally { release(); }
  }
}

const { LocalRepository } = loadTs('local-repositories/index.ts', {
  '@geonexo/contracts': { syncConflictSchema: {parse:x=>x}, syncOperationSchema: {parse:x=>x} },
  '../local-db': { localDb: {}, entityKey:()=>'', originalKey:()=>'' },
  '../blob-bytes': { readBlobBytes: async () => new Uint8Array() },
});

function makeTab(repo, network) {
  repo.listOutbox = async () => [];
  repo.applyServerPage = async () => undefined;
  return loadTs('sync/sync-engine.ts', {
    '@geonexo/contracts': {
      capabilityProvisionResponseSchema: { parse: x => x },
      pushSyncResponseSchema: { parse: x => x },
      pullSyncResponseSchema: { parse: x => x },
    },
    '../api-client': { API_BASE: 'https://api.invalid/api/v1', API_MODE: 'live' },
    '../local-repositories': { localRepository: repo },
  }, {
    fetch: network, navigator: { onLine: true },
    window: { dispatchEvent() {} },
    CustomEvent: class { constructor(_name, { detail }) { this.detail = detail; } },
  });
}

function readBarrier() {
  const seen = new Map();
  const waiting = new Map();
  return async key => {
    if (key !== 'installationId' && key !== 'workspaceBootstrapProof') return;
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    if (count === 1) {
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      waiting.set(key, { gate, release });
      await gate;
    } else if (count === 2) waiting.get(key).release();
  };
}

function simultaneousProvision() {
  const db = new SerializedMetaDb();
  const proofGate = readBarrier();
  const repos = Array.from({ length: 2 }, () => {
    const repo = new LocalRepository(db);
    const baseGet = repo.getMeta.bind(repo);
    repo.getMeta = async key => {
      const value = await baseGet(key);
      await proofGate(key);
      return value;
    };
    return repo;
  });
  let serverProof;
  let generation = 0;
  const requests = [];
  const network = async (url, init) => {
    const path = String(url);
    if (path.endsWith('/workspace/provision')) {
      const body = JSON.parse(init.body);
      requests.push(body);
      if (!serverProof) serverProof = body.bootstrapProof;
      if (body.bootstrapProof !== serverProof) return new Response('', { status: 409 });
      generation++;
      return new Response(JSON.stringify({ workspaceId, bearer:'bearer-'+generation, generation:String(generation), issuedAt:'2026-10-12T00:00:00Z' }), {status:200});
    }
    if (path.includes('/sync/pull'))
      return new Response(JSON.stringify({changes:[],tombstones:[],hasMore:false,nextCursor:'stable'}), {status:200});
    throw Error('Unexpected HTTP request '+path);
  };
  return { db, requests, getServerProof:()=>serverProof, tabs:repos.map(repo=>makeTab(repo, network)) };
}

test('A48 two PWA tabs must share one durable provisioning identity', async () => {
  const h = simultaneousProvision();
  const results = await Promise.all(h.tabs.map(tab => tab.syncNow()));
  assert.deepEqual(results.map(result=>result.state), ['synced','synced']);
  assert.equal(h.requests.length, 2);
  assert.equal(h.requests[0].bootstrapProof, h.requests[1].bootstrapProof);
  assert.equal(h.requests[0].installationId, h.requests[1].installationId);
  assert.equal(h.db.peek('workspaceBootstrapProof'), h.getServerProof());
});

test('A48 initialized identity remains stable and avoids unnecessary regeneration', async () => {
  const db = new SerializedMetaDb();
  const repo = new LocalRepository(db);
  let made = 0;
  const factory = () => ({installationId:'installation-1',bootstrapProof:'secret-1'});
  const first = await repo.ensureBootstrapIdentity(() => { made++; return factory(); });
  const second = await repo.ensureBootstrapIdentity(() => { made++; return {installationId:'different',bootstrapProof:'different'}; });
  assert.deepEqual(JSON.parse(JSON.stringify(first)), factory());
  assert.deepEqual(JSON.parse(JSON.stringify(second)), factory());
  assert.equal(made, 1);
});

test('A48 partially initialized local identity fills only the missing value', async () => {
  const db = new SerializedMetaDb();
  const repo = new LocalRepository(db);
  await repo.setMeta('installationId','old-installation');
  const value = await repo.ensureBootstrapIdentity(() => ({ installationId:'new-installation', bootstrapProof:'new-proof' }));
  assert.equal(value.installationId,'old-installation');
  assert.equal(value.bootstrapProof,'new-proof');
  assert.equal(await repo.getMeta('installationId'),'old-installation');
});

test('A48 failed creation transaction does not persist a partial identity', async () => {
  const db = new SerializedMetaDb();
  const repo = new LocalRepository(db);
  db.failNextCommit = true;
  await assert.rejects(repo.ensureBootstrapIdentity(() => ({installationId:'first',bootstrapProof:'first-secret'})), /Commit failure/);
  assert.equal(await repo.getMeta('installationId'),undefined);
  assert.equal(await repo.getMeta('workspaceBootstrapProof'),undefined);
  const identity = await repo.ensureBootstrapIdentity(() => ({installationId:'retry',bootstrapProof:'retry-secret'}));
  assert.equal(identity.bootstrapProof,'retry-secret');
});

test('A49 delayed older capability cannot overwrite a newer stored generation', async () => {
  const db = new SerializedMetaDb();
  const repo1 = new LocalRepository(db);
  const repo2 = new LocalRepository(db);
  const latest={workspaceId, generation:'9', bearer:'fresh', issuedAt:'2026-10-12T00:00:00Z'};
  const stale ={workspaceId, generation:'8', bearer:'revoked', issuedAt:'2026-10-12T00:00:00Z'};
  await repo1.saveWorkspaceCapability(latest);
  const effective = await repo2.saveWorkspaceCapability(stale);
  assert.equal(effective.bearer,'fresh');
  assert.equal((await repo1.getMeta('workspaceCapability')).generation,'9');
});

test('A49 capability storage is atomic and keeps current bearer after commit failure', async () => {
  const db=new SerializedMetaDb();
  const repo=new LocalRepository(db);
  const old={workspaceId,generation:'5',bearer:'stable',issuedAt:'2026-10-12T00:00:00Z'};
  const fresh={workspaceId,generation:'6',bearer:'new',issuedAt:'2026-10-12T00:00:00Z'};
  await repo.saveWorkspaceCapability(old);
  db.failNextCommit = true;
  await assert.rejects(repo.saveWorkspaceCapability(fresh),/Commit failure/);
  assert.equal((await repo.getMeta('workspaceCapability')).bearer,'stable');
  assert.equal((await repo.saveWorkspaceCapability(fresh)).generation,'6');
});

test('A49 equal capability generation retains existing replacement behavior', async () => {
  const repo=new LocalRepository(new SerializedMetaDb());
  const initial={workspaceId,generation:'4',bearer:'first',issuedAt:'2026-10-12T00:00:00Z'};
  const replacement={...initial,bearer:'second'};
  await repo.saveWorkspaceCapability(initial);
  const current=await repo.saveWorkspaceCapability(replacement);
  assert.equal(current.bearer,'second');
});

test('A49 concurrent 401 recoveries keep the newest bearer even if older HTTP replies arrive last', async () => {
  const db = new SerializedMetaDb();
  const left = new LocalRepository(db);
  const right = new LocalRepository(db);
  await left.setMeta('installationId', 'installation-1');
  await left.setMeta('workspaceBootstrapProof', 'proof-1');
  await left.setMeta('workspaceCapability', {workspaceId,generation:'1',bearer:'expired',issuedAt:'2026-10-12T00:00:00Z'});
  let recoveries = 0;
  let releaseOld;
  const blockedOld = new Promise(resolve => { releaseOld = resolve; });
  const seen = [];
  const network = async (url, init) => {
    const target=String(url);
    if (target.endsWith('/workspace/recover')) {
      recoveries++;
      if (recoveries === 1) {
        await blockedOld;
        return new Response(JSON.stringify({workspaceId,generation:'2',bearer:'revoked-older',issuedAt:'2026-10-12T00:00:00Z'}), {status:200});
      }
      return new Response(JSON.stringify({workspaceId,generation:'3',bearer:'newest',issuedAt:'2026-10-12T00:00:00Z'}), {status:200});
    }
    if (target.includes('/sync/pull')) {
      seen.push(init.headers.Authorization);
      if (init.headers.Authorization === 'Bearer newest') {
        releaseOld();
        return new Response(JSON.stringify({changes:[],tombstones:[],nextCursor:'ok',hasMore:false}),{status:200});
      }
      return new Response('',{status:401});
    }
    throw Error('Unexpected request '+target);
  };
  const a = makeTab(left, network);
  const b = makeTab(right, network);
  let timeout;
  let result;
  try {
    result = await Promise.race([
      Promise.all([a.syncNow(),b.syncNow()]),
      new Promise((_,reject) => { timeout = setTimeout(()=>reject(Error('Recoveries failed to settle')),1000); }),
    ]);
  } finally { clearTimeout(timeout); }
  assert.deepEqual(result.map(x=>x.state),['synced','synced']);
  assert.equal(recoveries,2);
  assert.equal(seen.filter(x=>x==='Bearer newest').length,2);
  assert.equal((await left.getMeta('workspaceCapability')).generation,'3');
  assert.equal((await right.getMeta('workspaceCapability')).bearer,'newest');
});

test('A49 capability cannot be stored for another workspace', async () => {
  const db = new SerializedMetaDb();
  const repo = new LocalRepository(db);
  await assert.rejects(repo.saveWorkspaceCapability({
    workspaceId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    generation:'1',bearer:'wrong-workspace',issuedAt:'2026-10-12T00:00:00Z',
  }),/does not match/i);
  assert.equal(db.peek('workspaceCapability'),undefined);
});
