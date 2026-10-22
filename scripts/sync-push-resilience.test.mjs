import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const file = new URL('../apps/admin/src/lib/sync/sync-engine.ts', import.meta.url);
const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
  fileName: 'sync-engine.ts', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.equal((compiled.diagnostics ?? []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);

function simulate(initial, responses, { acknowledgementBlocked = false } = {}) {
  let outbox = initial.map(id => ({ operationId: id, entity: 'project', entityId: id }));
  const acknowledged = [];
  const conflictIds = new Set();
  const operations = [];
  let fetches = 0;
  const stored = new Map([['workspaceCapability', {
    workspaceId: 'workspace-1', generation: '1', bearer: 'safe-bearer',
  }]]);
  const localRepository = {
    async listOutbox() { return outbox.filter(x => !conflictIds.has(x.operationId)); },
    async acknowledge(id) {
      acknowledged.push(id);
      if (acknowledgementBlocked) return false;
      outbox = outbox.filter(x => x.operationId !== id);
      return true;
    },
    async saveConflict(value) { conflictIds.add(value.operationId); },
    async applyServerPage() {},
    async getMeta(key) { return stored.get(key); },
    async setMeta(key, value) { stored.set(key, value); },
    async workspaceId() { return 'workspace-1'; },
  };
  const outs = [];
  const mockFetch = async (url, init) => {
    fetches += 1;
    if (fetches > 8) throw new Error('Sync made too many requests');
    if (String(url).includes('/sync/push')) {
      operations.push(JSON.parse(init.body).operations.map(x => x.operationId));
      const data = responses.shift() ?? { accepted: [], alreadyApplied: [], conflicts: [] };
      return new Response(JSON.stringify(data), { status: 200 });
    }
    if (String(url).includes('/sync/pull')) {
      return new Response(JSON.stringify({changes: [], tombstones: [], hasMore: false, nextCursor: 'cursor'}), {status:200});
    }
    throw new Error('Unexpected fetch: ' + url);
  };
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports, require(specifier) {
      if (specifier === '../api-client') return { API_BASE: 'https://api.invalid/api/v1', API_MODE: 'live' };
      if (specifier === '../local-repositories') return { localRepository };
      if (specifier === '@markmap/contracts') return {
        capabilityProvisionResponseSchema: {parse(x){return x;}},
        pullSyncResponseSchema: {parse(x){return x;}},
        pushSyncResponseSchema: {parse(x){return x;}},
      };
      throw new Error('Unexpected module ' + specifier);
    },
    fetch: mockFetch,
    Response, URLSearchParams, AbortController, TextEncoder, Uint8Array,
    setTimeout, clearTimeout,
    navigator: { onLine: true },
    window: { dispatchEvent(event) { outs.push(event.detail); } },
    CustomEvent: class { constructor(_, {detail}) { this.detail = detail; } },
  });
  return { syncNow: exports.syncNow, operations, getAcknowledged:()=>acknowledged, getPending:()=>outbox.filter(x=>!conflictIds.has(x.operationId)), outs };
}
const a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const receipt=(id)=>({operationId:id,version:1,sequence:'1'});

test('A37 successful ACK is durable, removes pending work and reports synced', async()=>{
  const h=simulate([a],[{accepted:[receipt(a)],alreadyApplied:[],conflicts:[]}]);
  const result=await h.syncNow();
  assert.equal(result.state,'synced');
  assert.equal(result.pending,0);
  assert.deepEqual(h.getAcknowledged(),[a]);
  assert.equal(h.operations.length,1);
});

test('A37 empty server reply never pretends unsent work was synced',async()=>{
  const h=simulate([a],[{accepted:[],alreadyApplied:[],conflicts:[]}]);
  const result=await h.syncNow();
  assert.equal(result.state,'idle');
  assert.equal(result.pending,1);
  assert.equal(h.operations.length,1);
});

test('A37 unknown acknowledgement fails closed without clearing local operation',async()=>{
  const h=simulate([a],[{accepted:[receipt(b)],alreadyApplied:[],conflicts:[]}]);
  const result=await h.syncNow();
  assert.equal(result.state,'error');
  assert.equal(result.pending,1);
  assert.equal(h.operations.length,1);
  assert.equal(h.getAcknowledged().length,0);
});

test('A37 duplicate ACK in accepted/alreadyApplied is rejected as non-idempotent',async()=>{
  const h=simulate([a],[{accepted:[receipt(a)],alreadyApplied:[receipt(a)],conflicts:[]}]);
  const result=await h.syncNow();
  assert.equal(result.state,'error');
  assert.equal(result.pending,1);
  assert.equal(h.getAcknowledged().length,0);
});

test('A37 an ACK not removed by storage cannot start an unbounded push loop',async()=>{
  const h=simulate([a],[{accepted:[receipt(a)],alreadyApplied:[],conflicts:[]}],{acknowledgementBlocked:true});
  const result=await h.syncNow();
  assert.equal(result.state,'error');
  assert.equal(result.pending,1);
  assert.equal(h.operations.length,1);
});

test('A37 a conflict is not removed/silently overwritten and reports idle',async()=>{
  const h=simulate([a],[{accepted:[],alreadyApplied:[],conflicts:[{operationId:a,serverVersion:2}]}]);
  const result=await h.syncNow();
  assert.equal(result.state,'idle');
  assert.equal(result.conflicts,1);
  assert.equal(h.operations.length,1);
  assert.deepEqual(h.getAcknowledged(),[]);
});

test('A37 partial ACK keeps remaining edits queued and reports idle',async()=>{
  const h=simulate([a,b],[{accepted:[receipt(a)],alreadyApplied:[],conflicts:[]},{accepted:[],alreadyApplied:[],conflicts:[]}]);
  const result=await h.syncNow();
  assert.equal(result.state,'idle');
  assert.equal(result.pending,1);
  assert.deepEqual(h.getPending().map(x=>x.operationId),[b]);
  assert.equal(h.operations.length,2);
});
