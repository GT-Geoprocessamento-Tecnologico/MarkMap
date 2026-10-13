import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

const ts = createRequire(import.meta.url)('typescript');
const root = new URL('../apps/admin/src/lib/', import.meta.url);
const entityId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';

function load(path, imports = {}) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, root), 'utf8'), {
    fileName: path, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  assert.equal((compiled.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports,
    require(name) { assert.ok(Object.hasOwn(imports, name), name); return imports[name]; },
    crypto: webcrypto, Promise, Map, Set, Blob, Event, DOMException, queueMicrotask,
  });
  return exports;
}

const { MemoryLocalDb } = load('local-db/memory.ts');
const { LocalRepository } = load('local-repositories/index.ts', {
  '@geonexo/contracts': {
    syncOperationSchema: { parse: x => x },
    syncConflictSchema: { parse: x => {
      if (x.reason === 'VERSION_CONFLICT') assert.ok(x.serverVersion > 0);
      return x;
    } },
  },
  '../local-db': {
    entityKey: (workspace, entity, id) => `${workspace}:${entity}:${id}`,
    originalKey: (workspace, id) => `${workspace}:${id}`, localDb: {},
  },
  '../blob-bytes': { readBlobBytes: async () => new Uint8Array() },
});

const payload = name => ({
  entity: 'project',
  data: { id: entityId, name, description: null, status: 'active',
    createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' },
});
async function setup(baseVersion = 1) {
  const repo = new LocalRepository(new MemoryLocalDb());
  const workspaceId = await repo.workspaceId();
  const initial = await repo.mutate({
    entity: 'project', entityId, operation: 'upsert', baseVersion,
    payload: payload('field edit'),
  });
  return {
    repo, workspaceId, initial,
    conflicts: () => repo.listConflicts(workspaceId),
    pending: () => repo.listOutbox(),
    entity: () => repo.getEntity(workspaceId, 'project', entityId),
  };
}
const conflict = (operation, version, name, extra = {}) => ({
  operationId: operation.operationId, entity: operation.entity, entityId: operation.entityId,
  baseVersion: operation.baseVersion, serverVersion: version, reason: 'VERSION_CONFLICT',
  ...(operation.payload ? { localPayload: operation.payload } : {}),
  ...(name ? { serverPayload: payload(name) } : {}),
  ...extra,
});

test('A61 resolved use-server conflict cannot reappear after delayed push receipt', async () => {
  const h = await setup();
  await h.repo.saveConflict(conflict(h.initial, 3, 'server v3'));
  await h.repo.resolveConflict(h.initial.operationId, 'use-server');
  assert.equal((await h.conflicts()).length, 0);
  await h.repo.saveConflict(conflict(h.initial, 4, 'stale response'));
  assert.equal((await h.conflicts()).length, 0);
  assert.equal((await h.entity()).version, 3);
  assert.equal((await h.entity()).payload.data.name, 'server v3');
});

test('A61 resolved keep-local conflict preserves replacement mutation after old receipt', async () => {
  const h = await setup();
  await h.repo.saveConflict(conflict(h.initial, 3, 'server v3'));
  await h.repo.resolveConflict(h.initial.operationId, 'keep-local');
  const [successor] = await h.pending();
  assert.ok(successor && successor.operationId !== h.initial.operationId);
  await h.repo.saveConflict(conflict(h.initial, 5, 'late v5'));
  assert.equal((await h.conflicts()).length, 0);
  assert.equal((await h.pending()).map(x => x.operationId).join(','), successor.operationId);
  assert.equal((await h.entity()).payload.data.name, 'field edit');
});

test('A61 ACKed operation ignores later conflicting push receipt', async () => {
  const h = await setup();
  assert.equal(await h.repo.acknowledge(h.initial.operationId, 2, '2'), true);
  await h.repo.saveConflict(conflict(h.initial, 3, 'late server v3'));
  assert.equal((await h.conflicts()).length, 0);
  assert.equal((await h.pending()).length, 0);
  assert.equal((await h.entity()).version, 2);
});

test('A61 unknown operation id never creates orphan conflict', async () => {
  const h = await setup();
  const unknown = { ...h.initial, operationId: '44444444-4444-4444-8444-444444444444' };
  await h.repo.saveConflict(conflict(unknown, 3, 'stale'));
  assert.equal((await h.conflicts()).length, 0);
  assert.equal((await h.pending()).length, 1);
});

test('A61 mismatched entity identifier fails closed without touching existing state', async () => {
  const h = await setup();
  await assert.rejects(
    h.repo.saveConflict(conflict(h.initial, 3, 'stale', { entityId: otherId })),
    /conflict receipt|conflito|operation/i,
  );
  assert.equal((await h.conflicts()).length, 0);
  assert.equal((await h.pending()).length, 1);
});

test('A61 mismatched entity type fails closed', async () => {
  const h = await setup();
  await assert.rejects(
    h.repo.saveConflict(conflict(h.initial, 3, 'stale', { entity: 'layer' })),
    /conflict receipt|conflito|operation/i,
  );
  assert.equal((await h.conflicts()).length, 0);
});

test('A61 mismatched base version fails closed', async () => {
  const h = await setup(2);
  await assert.rejects(
    h.repo.saveConflict(conflict(h.initial, 3, 'stale', { baseVersion: 1 })),
    /conflict receipt|conflito|operation/i,
  );
  assert.equal((await h.conflicts()).length, 0);
  assert.equal((await h.pending()).length, 1);
});

test('A61 active operation still persists genuine conflict', async () => {
  const h = await setup();
  await h.repo.saveConflict(conflict(h.initial, 3, 'remote'));
  const [saved] = await h.conflicts();
  assert.equal(saved.operationId, h.initial.operationId);
  assert.equal(saved.serverVersion, 3);
  assert.equal((await h.pending()).length, 0);
});

test('A61 active conflict keeps highest server version despite delayed lower reply', async () => {
  const h = await setup();
  await h.repo.saveConflict(conflict(h.initial, 5, 'remote v5'));
  await h.repo.saveConflict(conflict(h.initial, 3, 'late v3'));
  const [saved] = await h.conflicts();
  assert.equal(saved.serverVersion, 5);
  assert.equal(saved.serverPayload.data.name, 'remote v5');
});

test('A61 failed IndexedDB transaction preserves original pending operation', async () => {
  const h = await setup();
  h.repo.db.failNextTransaction = true;
  await assert.rejects(h.repo.saveConflict(conflict(h.initial, 3, 'remote')), /Transação local abortada/);
  assert.equal((await h.conflicts()).length, 0);
  assert.equal((await h.pending()).length, 1);
});

test('A61 chained local edits survive late receipt after explicit keep-local resolution', async () => {
  const h = await setup();
  const second = await h.repo.mutate({
    entity: 'project', entityId, operation: 'upsert', baseVersion: 1,
    payload: payload('newer field edit'),
  });
  await h.repo.saveConflict(conflict(h.initial, 3, 'remote'));
  await h.repo.resolveConflict(h.initial.operationId, 'keep-local');
  const pending = await h.pending();
  assert.equal(pending.length, 1);
  assert.notEqual(pending[0].operationId, h.initial.operationId);
  assert.notEqual(pending[0].operationId, second.operationId);
  await h.repo.saveConflict(conflict(h.initial, 4, 'late receipt'));
  assert.equal((await h.conflicts()).length, 0);
  assert.equal((await h.pending()).length, 1);
  assert.equal((await h.entity()).payload.data.name, 'newer field edit');
});

test('A61 late ACK never removes rebased successor after resolution', async () => {
  const h = await setup();
  await h.repo.saveConflict(conflict(h.initial, 3, 'remote'));
  await h.repo.resolveConflict(h.initial.operationId, 'keep-local');
  const [successor] = await h.pending();
  assert.equal(await h.repo.acknowledge(h.initial.operationId, 2, '2'), false);
  assert.equal((await h.pending())[0].operationId, successor.operationId);
  assert.equal((await h.conflicts()).length, 0);
});
