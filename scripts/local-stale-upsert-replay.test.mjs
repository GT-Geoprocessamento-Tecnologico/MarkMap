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

test('A60 stale upsert cannot conflict with local update based on a newer version', async()=>{
  const h=await setup('upsert',3);
  await h.repo.applyServerPage([upsert('obsolete v2',2)],[],'cursor-2');
  assert.equal((await h.conflicts()).length,0);
  assert.equal((await h.repo.listOutbox()).length,1);
  assert.equal((await h.entity()).payload?.data.name,'local edit');
});

test('A60 stale upsert cannot conflict with pending delete based on newer version',async()=>{
  const h=await setup('delete',4);
  await h.repo.applyServerPage([upsert('obsolete v3',3)],[],'cursor-3');
  assert.equal((await h.conflicts()).length,0);
  assert.equal((await h.repo.listOutbox()).length,1);
  assert.equal((await h.entity()).deleted,true);
});

test('A60 upsert at exactly the known base version is not a competing edit',async()=>{
  const h=await setup('upsert',2);
  await h.repo.applyServerPage([upsert('known v2',2)],[],'cursor-2');
  assert.equal((await h.conflicts()).length,0);
  assert.equal((await h.repo.listOutbox()).length,1);
});

test('A60 newer upsert remains a conflict, not silently dropped',async()=>{
  const h=await setup('upsert',2);
  await h.repo.applyServerPage([upsert('new v3',3)],[],'cursor-3');
  const [v]=await h.conflicts();
  assert.equal(v.serverVersion,3);
  assert.equal(v.serverPayload?.data.name,'new v3');
});

test('A60 upsert conflict is retained for an unknown null base',async()=>{
  const h=await setup('upsert',null);
  await h.repo.applyServerPage([upsert('server v1',1)],[],'cursor-1');
  assert.equal((await h.conflicts())[0].serverVersion,1);
});

test('A60 mixed obsolete upsert and tombstone leave locally versioned outbox untouched',async()=>{
  const h=await setup('upsert',5);
  await h.repo.applyServerPage([upsert('stale upsert v4',4)],[tombstone(3)],'cursor-5');
  assert.equal((await h.conflicts()).length,0);
  assert.equal((await h.repo.listOutbox()).length,1);
  assert.equal((await h.entity()).payload?.data.name,'local edit');
  assert.equal(await h.repo.getMeta('syncCursor'),'cursor-5');
});

test('A60 stale version cannot overwrite newer conflict from a separate push result',async()=>{
  const h=await setup('upsert',3);
  await h.repo.saveConflict({
    operationId:h.operationRecord.operationId,
    entity:'project',entityId,baseVersion:3,serverVersion:5,
    reason:'VERSION_CONFLICT',serverPayload:payload('latest'),localPayload:payload('local edit'),
  });
  await h.repo.applyServerPage([upsert('obsolete',2)],[],'cursor-2');
  assert.equal((await h.conflicts())[0].serverVersion,5);
  assert.equal((await h.conflicts())[0].serverPayload?.data.name,'latest');
});

test('A60 stale event cannot acknowledge an unrelated pending operation',async()=>{
  const h=await setup('upsert',3);
  await h.repo.applyServerPage([upsert('unrelated v1',1)],[],'cursor-1');
  assert.equal((await h.repo.listOutbox()).length,1);
  const acks=await h.repo.db.transact(['acks'],'readonly',tx=>new Promise(resolve=>{
    const r=tx.store('acks').index('workspace').getAll(h.workspaceId);
    r.onsuccess=()=>resolve(r.result);
  }));
  assert.equal(acks.length,0);
});

test('A60 truly accepted own change is still ACKed when server identifies operationId',async()=>{
  const h=await setup('upsert',2);
  await h.repo.applyServerPage([{
    ...upsert('accepted',3),operationId:h.operationRecord.operationId,
  }],[],'cursor-3');
  assert.equal((await h.conflicts()).length,0);
  assert.equal((await h.repo.listOutbox()).length,0);
  assert.equal((await h.entity()).version,3);
});

test('A60 invalid cursor CAS blocks stale updates without changing durable state',async()=>{
  const h=await setup('upsert',3);
  await h.repo.setMeta('syncCursor','newer-cursor');
  await assert.rejects(h.repo.applyServerPage([upsert('obsolete',2)],[],'bad-cursor',{expectedCursor:'old-cursor'}),/cursor changed/);
  assert.equal(await h.repo.getMeta('syncCursor'),'newer-cursor');
  assert.equal((await h.repo.listOutbox()).length,1);
});
