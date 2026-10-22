import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const file = new URL('../apps/admin/src/lib/sync/sync-engine.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
  fileName: 'sync-engine.ts', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.equal((compiled.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
const WORKSPACE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const capability = (generation, bearer) => ({ workspaceId: WORKSPACE, generation, bearer, issuedAt: '2026-10-12T00:00:00Z' });
const goodPage = () => new Response(JSON.stringify({ changes: [], tombstones: [], nextCursor: 'next', hasMore: false }), { status: 200 });

function harness({ newerOnFirst401 = false, refreshedBearerDenied = false, previousGeneration = '1' } = {}) {
  const metadata = new Map([
    ['workspaceCapability', capability(previousGeneration, 'old-token')],
    ['workspaceBootstrapProof', 'local-proof'],
    ['installationId', 'local-installation'],
  ]);
  const requests = [];
  let recovered = 0;
  let changedOnce = false;
  const repo = {
    async workspaceId() { return WORKSPACE; },
    async listOutbox() { return []; },
    async getMeta(key) { return metadata.get(key); },
    async setMeta(key, value) { metadata.set(key, value); },
    async ensureBootstrapIdentity() {
      return { installationId: 'local-installation', bootstrapProof: 'local-proof' };
    },
    async saveWorkspaceCapability(candidate) {
      const previous = metadata.get('workspaceCapability');
      if (BigInt(previous.generation) > BigInt(candidate.generation)) return previous;
      metadata.set('workspaceCapability', candidate);
      return candidate;
    },
    async applyServerPage(_changes, _tombstones, cursor) { metadata.set('syncCursor', cursor); },
  };
  async function fetchStub(path, init) {
    const target = String(path);
    const bearer = init?.headers?.Authorization;
    requests.push({ path: target, bearer });
    if (target.endsWith('/workspace/recover')) {
      recovered++;
      return new Response(JSON.stringify(capability('3', 'third-token')), { status: 200 });
    }
    if (!target.includes('/sync/pull')) throw Error('Unexpected request ' + target);
    if (bearer === 'Bearer old-token') {
      if (newerOnFirst401 && !changedOnce) {
        changedOnce = true;
        metadata.set('workspaceCapability', capability('2', 'fresh-token'));
      }
      return new Response('', { status: 401 });
    }
    if (bearer === 'Bearer fresh-token' && refreshedBearerDenied)
      return new Response('', { status: 401 });
    if (bearer === 'Bearer fresh-token' || bearer === 'Bearer third-token') return goodPage();
    throw Error('Unexpected Authorization in test');
  }
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports,
    require(name) {
      if (name === '../api-client') return { API_BASE: 'https://api.invalid/api/v1', API_MODE: 'live' };
      if (name === '../local-repositories') return { localRepository: repo };
      if (name === '@markmap/contracts') return {
        capabilityProvisionResponseSchema: { parse: x => x },
        pullSyncResponseSchema: { parse: x => x },
        pushSyncResponseSchema: { parse: x => x },
      };
      throw Error('Unexpected module ' + name);
    },
    fetch: fetchStub,
    Response, URLSearchParams, AbortController, TextEncoder, Uint8Array,
    setTimeout, clearTimeout,
    navigator: { onLine: true },
    window: { dispatchEvent() {} },
    CustomEvent: class { constructor(_name, { detail }) { this.detail = detail; } },
  });
  return { syncNow: exports.syncNow, requests, getRecoveries: () => recovered, getCapability: () => metadata.get('workspaceCapability') };
}

test('A50 stale tab retries the newer local bearer after 401 without extra workspace recovery', async () => {
  const h = harness({ newerOnFirst401: true });
  const result = await h.syncNow();
  assert.equal(result.state, 'synced');
  assert.equal(h.requests.length, 2);
  assert.equal(h.getRecoveries(), 0);
  assert.deepEqual(h.requests.map(x => x.bearer), ['Bearer old-token', 'Bearer fresh-token']);
  assert.equal(h.getCapability().generation, '2');
});

test('A50 if no newer local bearer exists, normal workspace recovery remains available', async () => {
  const h = harness();
  const result = await h.syncNow();
  assert.equal(result.state, 'synced');
  assert.equal(h.requests.length, 3);
  assert.equal(h.getRecoveries(), 1);
  assert.deepEqual(h.requests.map(x => x.bearer), ['Bearer old-token', undefined, 'Bearer third-token']);
});

test('A50 if refreshed local bearer is also 401, fall back to a single remote recovery', async () => {
  const h = harness({ newerOnFirst401: true, refreshedBearerDenied: true });
  const result = await h.syncNow();
  assert.equal(result.state, 'synced');
  assert.equal(h.requests.length, 4);
  assert.equal(h.getRecoveries(), 1);
  assert.deepEqual(h.requests.map(x => x.bearer), ['Bearer old-token', 'Bearer fresh-token', undefined, 'Bearer third-token']);
});

test('A50 refreshed local bearer survives after retry, no later remote recovery is triggered', async () => {
  const h = harness({ newerOnFirst401: true });
  assert.equal((await h.syncNow()).state, 'synced');
  const again = await h.syncNow();
  assert.equal(again.state, 'synced');
  assert.equal(h.getRecoveries(), 0);
  assert.equal(h.requests.length, 3);
  assert.equal(h.requests[2].bearer, 'Bearer fresh-token');
});
