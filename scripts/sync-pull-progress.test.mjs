import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const path = new URL('../apps/admin/src/lib/sync/sync-engine.ts', import.meta.url);
const source = readFileSync(path, 'utf8');
const compiled = ts.transpileModule(source, {
  fileName: 'sync-engine.ts',
  reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.equal((compiled.diagnostics ?? []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);

const a = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const cursor = n => `v1.${Buffer.from(String(n)).toString('base64url')}.${'a'.repeat(43)}`;
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const pushAccepted = id => ({ accepted: [{ operationId: id, version: 1, sequence: '1' }], alreadyApplied: [], conflicts: [] });
const page = (id, hasMore, changes = []) => ({ changes, tombstones: [], nextCursor: cursor(id), hasMore });

function simulate({ outbox = [], pushReplies = [], pullReplies = [], initialCursor = undefined, online = true } = {}) {
  let queue = outbox.map(operationId => ({ operationId, entity: 'project', entityId: operationId }));
  const meta = new Map([['workspaceCapability', { workspaceId: a, generation: '1', bearer: 'local-test-bearer' }]]);
  if (initialCursor) meta.set('syncCursor', initialCursor);
  let pushRequests = 0;
  let pullRequests = 0;
  const applied = [];
  const statuses = [];
  const repository = {
    async listOutbox() { return queue; },
    async acknowledge(operationId) { queue = queue.filter(op => op.operationId !== operationId); return true; },
    async saveConflict() {},
    async applyServerPage(changes, tombstones, nextCursor) {
      applied.push({ changes, tombstones, nextCursor });
      meta.set('syncCursor', nextCursor);
    },
    async getMeta(key) { return meta.get(key); },
    async setMeta(key, value) { meta.set(key, value); },
    async workspaceId() { return a; },
  };
  const network = async (url) => {
    const target = String(url);
    if (target.includes('/sync/push')) {
      pushRequests += 1;
      if (pushRequests > 12) throw new Error('Runaway push');
      const reply = pushReplies.shift() ?? { accepted: [], alreadyApplied: [], conflicts: [] };
      return response(reply.body ?? reply, reply.status ?? 200);
    }
    if (target.includes('/sync/pull')) {
      pullRequests += 1;
      if (pullRequests > 12) throw new Error('Runaway pull');
      const reply = pullReplies.shift() ?? { body: page('static', true) };
      return response(reply.body ?? reply, reply.status ?? 200);
    }
    throw new Error('Unexpected request ' + target);
  };
  const exported = {};
  runInNewContext(compiled.outputText, {
    exports: exported,
    require(name) {
      if (name === '../api-client') return { API_BASE: 'https://api.invalid/api/v1', API_MODE: 'live' };
      if (name === '../local-repositories') return { localRepository: repository };
      if (name === '@geonexo/contracts') return {
        capabilityProvisionResponseSchema: { parse: x => x },
        pullSyncResponseSchema: { parse: x => x },
        pushSyncResponseSchema: { parse: x => x },
      };
      throw Error('Unknown import ' + name);
    },
    fetch: network,
    Response, URLSearchParams, AbortController, TextEncoder, Uint8Array,
    setTimeout, clearTimeout,
    navigator: { onLine: online },
    window: { dispatchEvent(e) { statuses.push(e.detail); } },
    CustomEvent: class { constructor(_type, { detail }) { this.detail = detail; } },
  });
  return {
    syncNow: exported.syncNow,
    counts: () => ({ pullRequests, pushRequests, applied: applied.length }),
    currentCursor: () => meta.get('syncCursor'),
    statuses,
    pending: () => queue.length,
  };
}

test('A39 unchanged hasMore cursor aborts before duplicate page is applied', async () => {
  const c = cursor('one');
  const h = simulate({ initialCursor: c, pullReplies: [page('one', true)] });
  const result = await h.syncNow();
  assert.equal(result.state, 'error');
  assert.equal(h.counts().pullRequests, 1);
  assert.equal(h.counts().applied, 0);
  assert.equal(h.currentCursor(), c);
});

test('A39 cycle A->B->A stops before cursor regression', async () => {
  const h = simulate({ pullReplies: [page('a', true), page('b', true), page('a', true)] });
  const result = await h.syncNow();
  assert.equal(result.state, 'error');
  assert.equal(h.counts().pullRequests, 3);
  assert.equal(h.counts().applied, 2);
  assert.equal(h.currentCursor(), cursor('b'));
});

test('A39 distinct cursor chain and final page can sync successfully', async () => {
  const h = simulate({ pullReplies: [page('a', true, [{ id: 1 }]), page('b', false, [{ id: 2 }])] });
  const result = await h.syncNow();
  assert.equal(result.state, 'synced');
  assert.equal(result.pulled, 2);
  assert.equal(h.counts().applied, 2);
  assert.equal(h.currentCursor(), cursor('b'));
});

test('A39 legitimate terminal page may reuse the current cursor', async () => {
  const c = cursor('unchanged');
  const h = simulate({ initialCursor: c, pullReplies: [page('unchanged', false)] });
  const result = await h.syncNow();
  assert.equal(result.state, 'synced');
  assert.equal(h.counts().pullRequests, 1);
});

test('A40 successful push remains counted when a subsequent pull returns HTTP 500', async () => {
  const h = simulate({ outbox: [a], pushReplies: [pushAccepted(a)], pullReplies: [{ status: 500, body: { error: 'unavailable' } }] });
  const result = await h.syncNow();
  assert.equal(result.state, 'error');
  assert.equal(result.pushed, 1);
  assert.equal(result.conflicts, 0);
  assert.equal(result.pending, 0);
  assert.equal(h.pending(), 0);
  assert.equal(h.counts().pushRequests, 1);
  assert.equal(h.counts().pullRequests, 1);
});

test('A40 no network call occurs while offline and outbox is preserved', async () => {
  const h = simulate({ outbox: [a], online: false });
  const result = await h.syncNow();
  assert.equal(result.state, 'offline');
  assert.equal(result.pending, 1);
  assert.equal(h.counts().pullRequests, 0);
  assert.equal(h.counts().pushRequests, 0);
});

test('A40 a committed pull page remains counted when next page errors', async () => {
  const h = simulate({ pullReplies: [page('first', true, [{ id: 1 }]), { status: 503, body: { error: 'unavailable' } }] });
  const result = await h.syncNow();
  assert.equal(result.state, 'error');
  assert.equal(result.pulled, 1);
  assert.equal(h.counts().applied, 1);
  assert.equal(h.currentCursor(), cursor('first'));
});

test('A40 ACK from first batch remains counted if next push batch fails', async () => {
  const second = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const h = simulate({ outbox: [a, second], pushReplies: [pushAccepted(a), { status: 503, body: { error: 'unavailable' } }] });
  const result = await h.syncNow();
  assert.equal(result.state, 'error');
  assert.equal(result.pushed, 1);
  assert.equal(result.pending, 1);
  assert.equal(h.counts().pushRequests, 2);
  assert.equal(h.counts().pullRequests, 0);
});
