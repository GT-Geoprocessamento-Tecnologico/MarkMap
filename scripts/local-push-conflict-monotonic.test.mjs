import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
const ts=createRequire(import.meta.url)('typescript');
const root=new URL('../apps/admin/src/lib/',import.meta.url);
const entityId='22222222-2222-4222-8222-222222222222';
function load(path,imports={}) {
  const output=ts.transpileModule(readFileSync(new URL(path,root),'utf8'),{
    fileName:path,reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  });
  assert.equal((output.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  const exports={};
  runInNewContext(output.outputText,{
    exports,require(name){assert.ok(Object.hasOwn(imports,name),name);return imports[name];},
    crypto:webcrypto,Promise,Map,Set,Blob,Event,DOMException,queueMicrotask,
  });
  return exports;
}
const {MemoryLocalDb}=load('local-db/memory.ts');
const {LocalRepository}=load('local-repositories/index.ts',{
  '@geonexo/contracts':{
    syncOperationSchema:{parse:x=>x},
    syncConflictSchema:{parse:x=>{
      if(x.reason==='VERSION_CONFLICT' && x.serverVersion<1)throw Error('Bad version');
      if(x.reason==='SCOPE_REJECTED' && (x.serverVersion!==0||x.serverPayload))throw Error('Bad scope');
      return x;
    }},
  },
  '../local-db':{entityKey:(w,e,id)=>`${w}:${e}:${id}`,localDb:{},originalKey:(w,id)=>`${w}:${id}`},
  '../blob-bytes':{readBlobBytes:async()=>new Uint8Array()},
});
const payload=name=>({entity:'project',data:{id:entityId,name,description:null,status:'active',createdAt:'2026-10-13T00:00:00Z',updatedAt:'2026-10-13T00:00:00Z'}});
const upsert=(name,version)=>({operationId:`${String(version).padStart(8,'0')}-0000-4000-8000-000000000000`,entity:'project',entityId,operation:'upsert',payload:payload(name),version,sequence:String(version)});
async function setup() {
  const repo=new LocalRepository(new MemoryLocalDb()),workspaceId=await repo.workspaceId();
  const local=await repo.mutate({entity:'project',entityId,operation:'upsert',payload:payload('field edit'),baseVersion:null});
  return {repo,workspaceId,local,conflicts:()=>repo.listConflicts(workspaceId),entity:()=>repo.getEntity(workspaceId,'project',entityId)};
}
const reply=(h,version,name,reason='VERSION_CONFLICT')=>({operationId:h.local.operationId,entity:'project',entityId,baseVersion:null,serverVersion:version,reason,localPayload:payload('field edit'),...(name?{serverPayload:payload(name)}:{})});

test('A59 stale push conflict cannot replace newer durable pull conflict',async()=>{
  const h=await setup();
  await h.repo.applyServerPage([upsert('latest v5',5)],[],'cursor-5');
  await h.repo.saveConflict(reply(h,3,'stale v3'));
  const [v]=await h.conflicts();
  assert.equal(v.serverVersion,5);
  assert.equal(v.serverPayload?.data.name,'latest v5');
  assert.equal((await h.repo.listOutbox()).length,0,'conflicted item not automatically resent');
});

test('A59 use-server after delayed push still restores newest server entity',async()=>{
  const h=await setup();
  await h.repo.applyServerPage([upsert('latest v5',5)],[],'cursor-5');
  await h.repo.saveConflict(reply(h,3,'stale v3'));
  await h.repo.resolveConflict(h.local.operationId,'use-server');
  const entity=await h.entity();
  assert.equal(entity.deleted,false);
  assert.equal(entity.version,5);
  assert.equal(entity.payload?.data.name,'latest v5');
});

test('A59 conflict with equal serverVersion never loses known payload',async()=>{
  const h=await setup();
  await h.repo.saveConflict(reply(h,5,'authoritative'));
  await h.repo.saveConflict(reply(h,5,undefined));
  assert.equal((await h.conflicts())[0].serverPayload?.data.name,'authoritative');
});

test('A59 a newer push conflict supersedes a stale pull conflict',async()=>{
  const h=await setup();
  await h.repo.applyServerPage([upsert('older v3',3)],[],'cursor-3');
  await h.repo.saveConflict(reply(h,5,'newer v5'));
  const [v]=await h.conflicts();
  assert.equal(v.serverVersion,5);
  assert.equal(v.serverPayload?.data.name,'newer v5');
});

test('A59 initial push conflict is stored when none exists',async()=>{
  const h=await setup();
  await h.repo.saveConflict(reply(h,2,'server'));
  assert.equal((await h.conflicts()).length,1);
  assert.equal((await h.conflicts())[0].serverVersion,2);
});

test('A59 SCOPE_REJECTED zero must not downgrade stored VERSION_CONFLICT positive',async()=>{
  const h=await setup();
  await h.repo.saveConflict(reply(h,7,'new v7'));
  await h.repo.saveConflict(reply(h,0,undefined,'SCOPE_REJECTED'));
  const [v]=await h.conflicts();
  assert.equal(v.serverVersion,7);
  assert.equal(v.reason,'VERSION_CONFLICT');
});

test('A59 a standalone scope rejection is still durable',async()=>{
  const h=await setup();
  await h.repo.saveConflict(reply(h,0,undefined,'SCOPE_REJECTED'));
  assert.equal((await h.conflicts())[0].serverVersion,0);
});

test('A59 failed local transaction does not destroy previous conflict',async()=>{
  const h=await setup();
  await h.repo.saveConflict(reply(h,4,'v4'));
  h.repo.db.failNextTransaction=true;
  await assert.rejects(h.repo.saveConflict(reply(h,5,'v5')),/Transação local abortada/);
  assert.equal((await h.conflicts())[0].serverVersion,4);
});

test('A59 another operation on the same entity is independently tracked',async()=>{
  const h=await setup();
  const later=await h.repo.mutate({entity:'project',entityId,operation:'upsert',payload:payload('other edit'),baseVersion:null});
  await h.repo.saveConflict(reply(h,4,'older'));
  await h.repo.saveConflict({...reply(h,5,'newer'),operationId:later.operationId});
  const conflicts=await h.conflicts();
  assert.equal(conflicts.length,2);
  assert.equal(conflicts.find(x=>x.operationId===h.local.operationId).serverVersion,4);
  assert.equal(conflicts.find(x=>x.operationId===later.operationId).serverVersion,5);
});

test('A59 pending outbox envelope survives any conflict save',async()=>{
  const h=await setup();
  await h.repo.saveConflict(reply(h,3,'remote'));
  const persisted=await h.repo.db.transact(['outbox'],'readonly',tx=>new Promise((resolve,reject)=>{
    const req=tx.store('outbox').get(h.local.operationId);
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  }));
  assert.equal(persisted.operationId,h.local.operationId);
  assert.equal(persisted.payload.data.name,'field edit');
});
