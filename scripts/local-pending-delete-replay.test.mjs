import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const ts = createRequire(import.meta.url)('typescript');
const root = new URL('../apps/admin/src/lib/', import.meta.url);
const entityId = '22222222-2222-4222-8222-222222222222';
function load(path, imports={}) {
  const output = ts.transpileModule(readFileSync(new URL(path,root),'utf8'), {
    fileName:path, reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  });
  assert.equal((output.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  const exports={};
  runInNewContext(output.outputText, {
    exports, require(name) { assert.ok(Object.hasOwn(imports,name),name); return imports[name]; },
    crypto:webcrypto, Promise, Map, Set, Blob, Event, DOMException, queueMicrotask,
  });
  return exports;
}
const {MemoryLocalDb}=load('local-db/memory.ts');
const {LocalRepository}=load('local-repositories/index.ts',{
  '@geonexo/contracts':{
    syncOperationSchema:{parse:x=>x},
    syncConflictSchema:{parse:x=>{
      assert.ok(x.serverVersion>0,'VERSION_CONFLICT must have positive version');
      return x;
    }},
  },
  '../local-db':{entityKey:(w,e,id)=>`${w}:${e}:${id}`,localDb:{},originalKey:(w,id)=>`${w}:${id}`},
  '../blob-bytes':{readBlobBytes:async()=>new Uint8Array()},
});
const payload=(name)=>({entity:'project',data:{id:entityId,name,description:null,status:'active',createdAt:'2026-10-13T00:00:00Z',updatedAt:'2026-10-13T00:00:00Z'}});
const tombstone=(version)=>({entity:'project',entityId,version,sequence:String(version),deletedAt:'2026-10-13T00:00:00Z'});
const upsert=(name,version)=>({operationId:`${String(version).padStart(8,'0')}-0000-4000-8000-000000000000`,entity:'project',entityId,operation:'upsert',payload:payload(name),version,sequence:String(version)});
async function setup(operation='delete',baseVersion=1) {
  const repo=new LocalRepository(new MemoryLocalDb());
  const workspaceId=await repo.workspaceId();
  const operationRecord=await repo.mutate({entity:'project',entityId,operation,baseVersion,...(operation==='upsert'?{payload:payload('local edit')}:{})});
  return {repo,workspaceId,operationRecord,
    conflicts:()=>repo.listConflicts(workspaceId),
    entity:()=>repo.getEntity(workspaceId,'project',entityId)};
}

test('A58 ambiguous own delete tombstone does not preempt an authoritative push ACK',async()=>{
  const h=await setup('delete',1);
  await h.repo.applyServerPage([],[tombstone(2)],'cursor-2');
  assert.equal((await h.conflicts()).length,0);
  const pending=await h.repo.listOutbox();
  assert.equal(pending.length,1);
  assert.equal(pending[0].operationId,h.operationRecord.operationId);
  assert.equal(await h.repo.getMeta('syncCursor'),'cursor-2');
});

test('A58 caller must not infer ACK from tombstone with no operationId',async()=>{
  const h=await setup('delete',1);
  await h.repo.applyServerPage([],[tombstone(2)],'cursor-2');
  assert.equal((await h.repo.listOutbox()).length,1,'pending operation survives ambiguous tombstone');
  await h.repo.acknowledge(h.operationRecord.operationId,2,'2');
  assert.equal((await h.repo.listOutbox()).length,0);
  assert.equal((await h.entity()).deleted,true);
  assert.equal((await h.entity()).version,2);
});

test('A58 competing delete at expected next version is safely deferred for push to decide',async()=>{
  const h=await setup('delete',3);
  await h.repo.applyServerPage([],[tombstone(4)],'cursor-4');
  assert.equal((await h.conflicts()).length,0,'do not guess whether other device deleted');
  assert.equal((await h.repo.listOutbox()).length,1);
});

test('A58 genuinely advanced tombstone remains an explicit conflict',async()=>{
  const h=await setup('delete',1);
  await h.repo.applyServerPage([],[tombstone(3)],'cursor-3');
  const [conflict]=await h.conflicts();
  assert.equal(conflict.serverVersion,3);
  assert.equal(conflict.serverPayload,undefined);
  assert.equal((await h.repo.listOutbox()).length,0,'durable conflicted operation hidden from retry');
});

test('A58 old tombstone cannot conflict with pending delete based on newer version',async()=>{
  const h=await setup('delete',3);
  await h.repo.applyServerPage([],[tombstone(2)],'cursor-2');
  assert.equal((await h.conflicts()).length,0);
  assert.equal((await h.repo.listOutbox()).length,1);
});

test('A58 old tombstone cannot conflict with pending upsert based on newer version',async()=>{
  const h=await setup('upsert',3);
  await h.repo.applyServerPage([],[tombstone(2)],'cursor-2');
  assert.equal((await h.conflicts()).length,0);
  assert.equal((await h.repo.listOutbox()).length,1);
  assert.equal((await h.entity()).payload?.data.name,'local edit');
});

test('A58 unrelated newer tombstone still conflicts with pending upsert',async()=>{
  const h=await setup('upsert',1);
  await h.repo.applyServerPage([],[tombstone(2)],'cursor-2');
  assert.equal((await h.conflicts())[0].serverVersion,2);
});

test('A58 unknown-base pending delete remains conservative: do not assume own receipt',async()=>{
  const h=await setup('delete',null);
  await h.repo.applyServerPage([],[tombstone(1)],'cursor-1');
  assert.equal((await h.conflicts())[0].serverVersion,1);
});

test('A58 a remote upsert still conflicts with local pending delete',async()=>{
  const h=await setup('delete',1);
  await h.repo.applyServerPage([upsert('remote',2)],[],'cursor-2');
  const [conflict]=await h.conflicts();
  assert.equal(conflict.serverVersion,2);
  assert.equal(conflict.serverPayload?.data.name,'remote');
});

test('A58 cursor CAS failure rolls back deferred local state',async()=>{
  const h=await setup('delete',1);
  await h.repo.setMeta('syncCursor','other');
  await assert.rejects(h.repo.applyServerPage([],[tombstone(2)],'new',{expectedCursor:'wrong'}),/Sync cursor changed/);
  assert.equal(await h.repo.getMeta('syncCursor'),'other');
  assert.equal((await h.conflicts()).length,0);
  assert.equal((await h.repo.listOutbox()).length,1);
});
