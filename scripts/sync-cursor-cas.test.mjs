import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const ts = createRequire(import.meta.url)('typescript');
const root = new URL('../apps/admin/src/lib/', import.meta.url);
function load(path, mocks, extras = {}) {
  const js = ts.transpileModule(readFileSync(new URL(path, root), 'utf8'), {
    fileName: path, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  assert.equal((js.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  runInNewContext(js.outputText, {
    exports,
    require(name) { if (!(name in mocks)) throw Error('Missing test stub ' + name); return mocks[name]; },
    crypto: webcrypto, queueMicrotask, Event, DOMException, Blob, Response,
    ...extras,
  });
  return exports;
}
const { MemoryLocalDb } = load('local-db/memory.ts', {});
const localDb = { entityKey:(w,e,id)=>w+':'+e+':'+id, originalKey:(w,id)=>w+':'+id, localDb:{} };
const { LocalRepository } = load('local-repositories/index.ts', {
  '@markmap/contracts': { syncConflictSchema:{parse:x=>x}, syncOperationSchema:{parse:x=>x} },
  '../local-db': localDb,
  '../blob-bytes': { readBlobBytes:async()=>new Uint8Array() },
});
const createRepo = () => new LocalRepository(new MemoryLocalDb());

const remote = id => ({operation:'upsert',operationId:'aaaa1111-aaaa-4111-8111-aaaaaaaaaaaa',entity:'project',entityId:id,version:1,sequence:'1',payload:{entity:'project',data:{id,name:'remote'}}});

test('A44 remote page CAS accepts matching cursor and persists the new cursor', async()=>{
  const repo=createRepo();
  await repo.setMeta('syncCursor','A');
  await repo.applyServerPage([],[], 'B',{expectedCursor:'A'});
  assert.equal(await repo.getMeta('syncCursor'),'B');
});

test('A44 an older tab cannot rewind a more recent cursor', async()=>{
  const repo=createRepo();
  await repo.setMeta('syncCursor','A');
  await repo.applyServerPage([],[], 'C',{expectedCursor:'A'});
  await assert.rejects(repo.applyServerPage([],[], 'B',{expectedCursor:'A'}),/cursor/i);
  assert.equal(await repo.getMeta('syncCursor'),'C');
});

test('A44 stale page is rejected BEFORE mutating any remote entities', async()=>{
  const repo=createRepo();
  const workspaceId=await repo.workspaceId();
  await repo.setMeta('syncCursor','newer');
  await assert.rejects(repo.applyServerPage([remote('foreign')],[], 'older',{expectedCursor:'old'}),/cursor/i);
  assert.equal(await repo.getMeta('syncCursor'),'newer');
  assert.equal(await repo.getEntity(workspaceId,'project','foreign'),undefined);
});

test('A44 default calls with three arguments remain compatible', async()=>{
  const repo=createRepo();
  await repo.setMeta('syncCursor','previous');
  await repo.applyServerPage([],[], 'legacy-next');
  assert.equal(await repo.getMeta('syncCursor'),'legacy-next');
});

test('A44 sync engine sends its exact request cursor to the transaction',async()=>{
  const expected='my-current-cursor';
  const calls=[];
  const repository={
    async listOutbox(){return[];}, async getMeta(key){return key==='workspaceCapability'?{workspaceId:'test-workspace',bearer:'token',generation:'1'}:key==='syncCursor'?expected:undefined;},
    async applyServerPage(changes,tombstones,nextCursor,options){calls.push({changes,tombstones,nextCursor,options});},
  };
  const engine=load('sync/sync-engine.ts',{
    '../api-client':{API_BASE:'https://api.invalid',API_MODE:'live'},
    '../local-repositories':{localRepository:repository},
    '@markmap/contracts':{capabilityProvisionResponseSchema:{parse:x=>x},pushSyncResponseSchema:{parse:x=>x},pullSyncResponseSchema:{parse:x=>x}},
  },{
    fetch:async()=>new Response(JSON.stringify({changes:[],tombstones:[],nextCursor:'next',hasMore:false}),{status:200}),
    URLSearchParams,AbortController,TextEncoder,Uint8Array,setTimeout,clearTimeout,
    navigator:{onLine:true},window:{dispatchEvent(){}},CustomEvent:class{constructor(){}},
  });
  const result=await engine.syncNow();
  assert.equal(result.state,'synced');
  assert.equal(calls.length,1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options)),{expectedCursor:expected});
});
