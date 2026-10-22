import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const ts = createRequire(import.meta.url)('typescript');
const root = new URL('../apps/admin/src/lib/', import.meta.url);
const workspaceEntityId = '22222222-2222-4222-8222-222222222222';

function load(path, imports = {}) {
  const output = ts.transpileModule(readFileSync(new URL(path, root), 'utf8'), {
    fileName: path, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  assert.equal((output.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  runInNewContext(output.outputText, {
    exports,
    require(name) {
      if (!(name in imports)) throw Error('Unexpected import: ' + name);
      return imports[name];
    },
    crypto: webcrypto, Promise, Map, Set, Blob, Event, DOMException, queueMicrotask,
  });
  return exports;
}

function strictConflict(value) {
  if (value.reason === 'VERSION_CONFLICT' && value.serverVersion < 1)
    throw Error('VERSION_CONFLICT requires positive version');
  if (value.reason === 'SCOPE_REJECTED' && (value.serverVersion !== 0 || value.serverPayload))
    throw Error('SCOPE_REJECTED cannot reveal server data');
  for (const name of ['localPayload', 'serverPayload']) {
    if (value[name] && (value[name].entity !== value.entity || value[name].data.id !== value.entityId))
      throw Error('Conflict payload identity mismatch');
  }
  return value;
}

const { MemoryLocalDb } = load('local-db/memory.ts');
const { LocalRepository } = load('local-repositories/index.ts', {
  '@markmap/contracts': {
    syncOperationSchema: { parse: value => value },
    syncConflictSchema: { parse: strictConflict },
  },
  '../local-db': { entityKey:(workspace,entity,id) => `${workspace}:${entity}:${id}`, localDb:{}, originalKey:(workspace,id)=>`${workspace}:${id}` },
  '../blob-bytes': { readBlobBytes: async () => new Uint8Array() },
});

const payload = name => ({entity:'project', data:{id:workspaceEntityId, name, description:null, status:'active', createdAt:'2026-10-13T00:00:00Z', updatedAt:'2026-10-13T00:00:00Z'}});
const change = (name, version, sequence) => ({
  operationId:`${String(version).padStart(8,'0')}-0000-4000-8000-000000000000`,
  entity:'project', entityId:workspaceEntityId, operation:'upsert', payload:payload(name), version, sequence:String(sequence),
});
const tombstone = (version,sequence) => ({ entity:'project', entityId:workspaceEntityId, version, sequence:String(sequence), deletedAt:'2026-10-13T00:00:00Z' });

async function harness(pending = true) {
  const repo = new LocalRepository(new MemoryLocalDb());
  const workspaceId = await repo.workspaceId();
  let pendingId;
  if (pending) {
    const local = await repo.mutate({entity:'project',entityId:workspaceEntityId,operation:'upsert',payload:payload('field edit'),baseVersion:null});
    pendingId = local.operationId;
  }
  const conflicts = async () => repo.listConflicts(workspaceId);
  const current = async () => repo.getEntity(workspaceId, 'project', workspaceEntityId);
  return {repo,workspaceId,pendingId,conflicts,current};
}

test('A57 newest upsert after an earlier tombstone wins pending conflict in one mixed page',async()=>{
  const h=await harness();
  await h.repo.applyServerPage([change('server restored',3,3)],[tombstone(2,2)],'cursor-3');
  const list=await h.conflicts();
  assert.equal(list.length,1);
  assert.equal(list[0].operationId,h.pendingId);
  assert.equal(list[0].serverVersion,3);
  assert.equal(list[0].serverPayload?.data.name,'server restored');
  assert.equal(await h.repo.getMeta('syncCursor'),'cursor-3');
});

test('A57 use-server resolves to latest restored server payload, not stale deletion',async()=>{
  const h=await harness();
  await h.repo.applyServerPage([change('recreated',3,3)],[tombstone(2,2)],'cursor-3');
  await h.repo.resolveConflict(h.pendingId,'use-server');
  const entity=await h.current();
  assert.equal(entity.deleted,false);
  assert.equal(entity.version,3);
  assert.equal(entity.payload?.data.name,'recreated');
  assert.equal((await h.repo.listOutbox()).length,0);
});

test('A57 an older tombstone arriving on the next page cannot downgrade stored conflict',async()=>{
  const h=await harness();
  await h.repo.applyServerPage([change('latest',5,5)],[],'cursor-5');
  await h.repo.applyServerPage([],[tombstone(3,3)],'cursor-6',{expectedCursor:'cursor-5'});
  const [result]=await h.conflicts();
  assert.equal(result.serverVersion,5);
  assert.equal(result.serverPayload?.data.name,'latest');
});

test('A57 a later tombstone is retained over an older upsert for a pending operation',async()=>{
  const h=await harness();
  await h.repo.applyServerPage([change('previous',1,1)],[tombstone(2,2)],'cursor-2');
  const [result]=await h.conflicts();
  assert.equal(result.serverVersion,2);
  assert.equal(result.serverPayload,undefined);
});

test('A57 server upsert after an older tombstone applies when no local changes are pending',async()=>{
  const h=await harness(false);
  await h.repo.applyServerPage([change('upsert v3',3,3)],[tombstone(2,2)],'cursor-3');
  const row=await h.current();
  assert.equal(row.version,3);
  assert.equal(row.deleted,false);
  assert.equal(row.payload?.data.name,'upsert v3');
  assert.equal((await h.conflicts()).length,0);
});

test('A57 latest tombstone applies when there is no local pending mutation',async()=>{
  const h=await harness(false);
  await h.repo.applyServerPage([change('upsert v1',1,1)],[tombstone(2,2)],'cursor-2');
  const row=await h.current();
  assert.equal(row.version,2);
  assert.equal(row.deleted,true);
  assert.equal(row.payload,undefined);
});

test('A57 stale cursor fails before any conflict is committed',async()=>{
  const h=await harness();
  await h.repo.setMeta('syncCursor','current-cursor');
  await assert.rejects(h.repo.applyServerPage([change('server',2,2)],[],'new-cursor',{expectedCursor:'stale-cursor'}),/Sync cursor changed/);
  assert.equal((await h.conflicts()).length,0);
  assert.equal(await h.repo.getMeta('syncCursor'),'current-cursor');
  assert.equal((await h.repo.listOutbox()).length,1);
});


test('A57 same-version replay never drops a stored server payload',async()=>{
  const h=await harness();
  await h.repo.applyServerPage([change('accepted v4',4,4)],[],'cursor-4');
  await h.repo.applyServerPage([],[tombstone(4,4)],'cursor-4b',{expectedCursor:'cursor-4'});
  const [result]=await h.conflicts();
  assert.equal(result.serverVersion,4);
  assert.equal(result.serverPayload?.data.name,'accepted v4');
});

test('A57 newer server tombstone on a later page supersedes stored upsert conflict',async()=>{
  const h=await harness();
  await h.repo.applyServerPage([change('older',2,2)],[],'cursor-2');
  await h.repo.applyServerPage([],[tombstone(3,3)],'cursor-3',{expectedCursor:'cursor-2'});
  const [result]=await h.conflicts();
  assert.equal(result.serverVersion,3);
  assert.equal(result.serverPayload,undefined);
  assert.equal((await h.repo.listOutbox()).length,0, 'a conflicted edit stays durable but is hidden from automatic push');
});

test('A57 failed transaction does not persist partial conflict or advance cursor', async()=>{
  const h=await harness();
  h.repo.db.failNextTransaction = true;
  await assert.rejects(h.repo.applyServerPage([change('remote',2,2)],[],'failed-cursor'),/Transação local abortada/);
  assert.equal((await h.conflicts()).length,0);
  assert.equal(await h.repo.getMeta('syncCursor'),undefined);
  assert.equal((await h.repo.listOutbox()).length,1);
});
