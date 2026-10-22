import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const path = new URL('../apps/admin/src/lib/sync/sync-engine.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(path, 'utf8'), {
  fileName: 'sync-engine.ts', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const emptyPull = () => response({ changes: [], tombstones: [], nextCursor: 'cursor-end', hasMore: false });
const ackResponse = () => response({ accepted: [{ operationId: ID, version: 1, sequence: '1' }], alreadyApplied: [], conflicts: [] });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function harness({ pending = true, ack = true, network, fastTimeout = false } = {}) {
  let outbox = pending ? [{ operationId: ID, entity: 'project', entityId: ID }] : [];
  let requests = 0;
  let abortCount = 0;
  const meta = new Map([['workspaceCapability', { workspaceId: ID, generation: '1', bearer: 'local-bearer' }], ['workspaceBootstrapProof', 'local-proof'], ['installationId', 'local-installation']]);
  const repository = {
    async listOutbox() { return outbox; },
    async acknowledge(operationId) {
      if (ack !== true) return ack === null ? undefined : ack;
      outbox = outbox.filter(op => op.operationId !== operationId);
      return true;
    },
    async saveConflict() {},
    async applyServerPage(_changes, _tombstones, nextCursor) { meta.set('syncCursor', nextCursor); },
    async getMeta(key) { return meta.get(key); },
    async setMeta(key, value) { meta.set(key, value); },
    async ensureBootstrapIdentity(create) {
      const installationId = meta.get('installationId');
      const bootstrapProof = meta.get('workspaceBootstrapProof');
      if (installationId && bootstrapProof) return { installationId, bootstrapProof };
      const generated = create();
      if (!installationId) meta.set('installationId', generated.installationId);
      if (!bootstrapProof) meta.set('workspaceBootstrapProof', generated.bootstrapProof);
      return { installationId: installationId || generated.installationId,
        bootstrapProof: bootstrapProof || generated.bootstrapProof };
    },
    async saveWorkspaceCapability(candidate) {
      const current = meta.get('workspaceCapability');
      if (current && BigInt(current.generation) > BigInt(candidate.generation)) return current;
      meta.set('workspaceCapability', candidate);
      return candidate;
    },
    async workspaceId() { return ID; },
  };
  const fn = async (url, init) => {
    requests += 1;
    if (requests > 6) throw new Error('request loop');
    init?.signal?.addEventListener('abort', () => { abortCount++; }, { once: true });
    if (network) return network(String(url), init, requests);
    return String(url).includes('/sync/push') ? ackResponse() : emptyPull();
  };
  const exported = {};
  runInNewContext(compiled.outputText, {
    exports: exported,
    require(name) {
      if (name === '../api-client') return { API_BASE: 'https://api.invalid/api/v1', API_MODE: 'live' };
      if (name === '../local-repositories') return { localRepository: repository };
      if (name === '@markmap/contracts') return {
        capabilityProvisionResponseSchema: { parse: x => x },
        pullSyncResponseSchema: { parse: x => x },
        pushSyncResponseSchema: { parse: x => x },
      };
      throw Error('Unexpected import: ' + name);
    },
    fetch: fn,
    Response, URLSearchParams, AbortController, TextEncoder, Uint8Array,
    setTimeout: fastTimeout ? (callback, _ms) => setTimeout(callback, 10) : setTimeout,
    clearTimeout,
    navigator: { onLine: true },
    window: { dispatchEvent() {} },
    CustomEvent: class { constructor(_type, { detail }) { this.detail = detail; } },
  });
  return { syncNow: exported.syncNow, getPending: () => outbox.length, getRequests: () => requests, getAborts: () => abortCount };
}

test('A41 timeout includes streaming JSON response body after headers arrive', async () => {
  const h = harness({ pending: false, fastTimeout: true, network: async (_url, init) => {
    const stream = new ReadableStream({ start(controller) {
      init.signal.addEventListener('abort', () => controller.error(new Error('body aborted')), { once: true });
    }});
    return new Response(stream, { status: 200 });
  }});
  const result = await Promise.race([h.syncNow(), sleep(400).then(() => 'stalled')]);
  assert.notEqual(result, 'stalled', 'sync must not remain stuck after response headers');
  assert.equal(result.state, 'error');
  assert.equal(h.getAborts(), 1);
});

test('A42 rejected acknowledgement must not be counted as committed', async () => {
  const h = harness({ ack: false });
  const result = await h.syncNow();
  assert.equal(result.state, 'error');
  assert.equal(result.pushed, 0);
  assert.equal(result.pending, 1);
  assert.equal(h.getRequests(), 1);
});

test('A42 undefined acknowledgement must not count as committed', async () => {
  const h = harness({ ack: null });
  const result = await h.syncNow();
  assert.equal(result.state, 'error');
  assert.equal(result.pushed, 0);
  assert.equal(result.pending, 1);
});

test('A42 successful acknowledgement still clears the queue once', async () => {
  const h = harness();
  const result = await h.syncNow();
  assert.equal(result.state, 'synced');
  assert.equal(result.pushed, 1);
  assert.equal(result.pending, 0);
  assert.equal(h.getRequests(), 2);
});

test('A41 a failed HTTP response needs no JSON body to report an error', async () => {
  const h = harness({pending: false, network: async () => new Response('INVALID-JSON', {status: 503}) });
  const result = await h.syncNow();
  assert.equal(result.state, 'error');
  assert.equal(result.pending, 0);
});

test('A41 invalid successful JSON keeps pending work for retry', async () => {
  const h = harness({network: async () => new Response('not-json', {status: 200}) });
  const result = await h.syncNow();
  assert.equal(result.state, 'error');
  assert.equal(result.pending, 1);
});

test('A41 body timeout does not poison later manual synchronization', async () => {
  let first = true;
  const h = harness({pending:false,fastTimeout:true,network:async (_url, init)=>{
    if (!first) return emptyPull();
    first = false;
    return new Response(new ReadableStream({start(controller){
      init.signal.addEventListener('abort',()=>controller.error(new Error('expired')), {once:true});
    }}),{status:200});
  }});
  const firstResult = await Promise.race([h.syncNow(),sleep(100).then(()=> 'stalled')]);
  assert.notEqual(firstResult, 'stalled');
  assert.equal(firstResult.state, 'error');
  const secondResult = await h.syncNow();
  assert.equal(secondResult.state, 'synced');
  assert.equal(h.getRequests(), 2);
});


test('A41 bearer recovery ignores an unread 401 error body', async () => {
  const calls = [];
  const h = harness({ pending: false, fastTimeout: true, network: async (url, init) => {
    calls.push({ url, bearer: init?.headers?.Authorization });
    if (url.includes('/workspace/recover')) return response({workspaceId: ID, bearer: 'new-bearer', generation: '2', issuedAt: '2026-10-12T00:00:00Z'});
    if (calls.filter(x => x.url.includes('/sync/pull')).length === 1)
      return new Response(new ReadableStream({ start() {} }), {status: 401});
    return emptyPull();
  }});
  const result = await Promise.race([h.syncNow(), sleep(400).then(() => 'stalled')]);
  assert.notEqual(result, 'stalled');
  assert.equal(result.state, 'synced');
  assert.equal(calls.length, 3);
  assert.equal(calls.at(-1).bearer, 'Bearer new-bearer');
});
