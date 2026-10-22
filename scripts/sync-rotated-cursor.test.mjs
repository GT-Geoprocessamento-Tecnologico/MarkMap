import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, createHmac, webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const root = new URL('../apps/admin/src/lib/', import.meta.url);
const load = (path, imports = {}, extra = {}) => {
  const js = ts.transpileModule(readFileSync(new URL(path, root), 'utf8'), {
    fileName: path, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  assert.equal((js.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  runInNewContext(js.outputText, {
    exports, require(name) { if (!(name in imports)) throw Error('Unexpected import ' + name); return imports[name]; },
    crypto: webcrypto, btoa, Blob, Event, Response, URLSearchParams,
    TextEncoder, Uint8Array, AbortController, setTimeout, clearTimeout, queueMicrotask, DOMException,
    ...extra,
  });
  return exports;
};
const { MemoryLocalDb } = load('local-db/memory.ts');
const { LocalRepository } = load('local-repositories/index.ts', {
  '@geonexo/contracts': { syncOperationSchema: {parse:x=>x}, syncConflictSchema: {parse:x=>x} },
  '../local-db': { localDb:{}, entityKey:(w,e,id)=>w+':'+e+':'+id, originalKey:(w,id)=>w+':'+id },
  '../blob-bytes': { readBlobBytes:async()=>new Uint8Array() },
});
const signed = (workspaceId, sequence, bearer) => {
  const payload = Buffer.from(JSON.stringify({ workspaceId, sequence })).toString('base64url');
  const key = createHash('sha256').update(bearer).digest();
  return 'v1.'+payload+'.'+createHmac('sha256',key).update(payload).digest('base64url');
};
const cap = (workspaceId, generation, bearer = 'token-'+generation) =>
  ({ workspaceId, generation:String(generation), bearer, issuedAt:'2026-10-12T14:00:00Z' });
const context = async () => {
  const db=new MemoryLocalDb(), repo=new LocalRepository(db), workspaceId=await repo.workspaceId();
  return { db, repo, workspaceId };
};

test('A52 rotating bearer invalidates the signed cursor without touching other local metadata', async () => {
  const {repo,workspaceId}=await context();
  await repo.saveWorkspaceCapability(cap(workspaceId,1));
  await repo.setMeta('syncCursor', signed(workspaceId,'18','token-1'));
  await repo.setMeta('outboxSequence',23);
  await repo.saveWorkspaceCapability(cap(workspaceId,2));
  assert.equal(await repo.getMeta('syncCursor'),undefined);
  assert.equal(await repo.getMeta('outboxSequence'),23);
});

test('A52 same bearer or stale generation never resets a valid cursor', async()=>{
  const {repo,workspaceId}=await context();
  await repo.saveWorkspaceCapability(cap(workspaceId,3));
  const cursor=signed(workspaceId,'20','token-3');
  await repo.setMeta('syncCursor',cursor);
  await repo.saveWorkspaceCapability(cap(workspaceId,3));
  await repo.saveWorkspaceCapability(cap(workspaceId,2));
  assert.equal(await repo.getMeta('syncCursor'),cursor);
  assert.equal((await repo.getMeta('workspaceCapability')).generation,'3');
});

test('A52 equal generation with changed bearer retires old cursor; failed transaction rolls back',async()=>{
  const {repo,db,workspaceId}=await context();
  await repo.saveWorkspaceCapability(cap(workspaceId,1));
  const cursor=signed(workspaceId,'20','token-1');
  await repo.setMeta('syncCursor',cursor);
  db.failNextTransaction=true;
  await assert.rejects(repo.saveWorkspaceCapability(cap(workspaceId,2)));
  assert.equal(await repo.getMeta('syncCursor'),cursor);
  await repo.saveWorkspaceCapability(cap(workspaceId,1,'replacement'));
  assert.equal(await repo.getMeta('syncCursor'),undefined);
});

async function harness({ recovery=true, badCursor=false, concurrent=false }={}) {
  const {repo,workspaceId}=await context();
  await repo.saveWorkspaceCapability(cap(workspaceId,1));
  const old=badCursor?'malformed-cursor':signed(workspaceId,'12','token-1');
  await repo.setMeta('syncCursor',old);
  await repo.setMeta('installationId','id1');
  await repo.setMeta('workspaceBootstrapProof','proof1');
  const final=signed(workspaceId,'30',recovery?'token-2':'token-1');
  const requested=[];
  let changed=false;
  const fetch=async(url,options)=>{
    const path=String(url), auth=options.headers.Authorization;
    if(path.endsWith('/workspace/recover'))
      return new Response(JSON.stringify(cap(workspaceId,2)),{status:200});
    if(!path.includes('/sync/pull'))throw Error('Unexpected endpoint '+path);
    const cursor=new URL(path).searchParams.get('cursor');
    requested.push(cursor);
    if(recovery&&auth==='Bearer token-1')return new Response('',{status:401});
    if(cursor&&cursor!==signed(workspaceId,'12',recovery?'token-2':'token-1') &&
       cursor!==signed(workspaceId,'21','token-1'))return new Response('',{status:400});
    if(cursor&&!cursor.startsWith('v1.'))return new Response('',{status:400});
    if(cursor&&!((recovery?'token-2':'token-1')==='token-1' || cursor!==old))return new Response('',{status:400});
    if(concurrent&&!changed){
      changed=true;
      await repo.setMeta('syncCursor',signed(workspaceId,'21','token-1'));
      return new Response(JSON.stringify({changes:[],tombstones:[],nextCursor:final,hasMore:false}),{status:200});
    }
    return new Response(JSON.stringify({changes:[],tombstones:[],nextCursor:final,hasMore:false}),{status:200});
  };
  const {syncNow}=load('sync/sync-engine.ts',{
    '@geonexo/contracts':{capabilityProvisionResponseSchema:{parse:x=>x},pullSyncResponseSchema:{parse:x=>x},pushSyncResponseSchema:{parse:x=>x}},
    '../api-client':{API_BASE:'https://api.invalid/api/v1',API_MODE:'live'},
    '../local-repositories':{localRepository:repo},
  },{fetch,navigator:{onLine:true},window:{dispatchEvent(){}},CustomEvent:class{constructor(){} }});
  return {syncNow,repo,old,final,requested};
}

test('A52 credential rotation during HTTP request restarts pull with a new signed cursor',async()=>{
  const h=await harness();
  assert.equal((await h.syncNow()).state,'synced');
  assert.deepEqual(h.requested.map(Boolean),[true,true,false]);
  assert.equal(await h.repo.getMeta('syncCursor'),h.final);
});

test('A52 genuinely invalid cursor on same bearer stays intact and fails closed',async()=>{
  const h=await harness({recovery:false,badCursor:true});
  assert.equal((await h.syncNow()).state,'error');
  assert.equal(await h.repo.getMeta('syncCursor'),h.old);
  assert.equal(h.requested.length,1);
});

test('A52 stale successful response from other tab is not committed after cursor advance',async()=>{
  const h=await harness({recovery:false,concurrent:true});
  assert.equal((await h.syncNow()).state,'synced');
  assert.equal(h.requested.length,2);
  assert.equal(await h.repo.getMeta('syncCursor'),h.final);
});
