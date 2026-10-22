import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const code = ts.transpileModule(readFileSync(new URL('../services/api/src/routes/sync.ts', import.meta.url), 'utf8'), {
  fileName: 'sync.ts', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
assert.equal((code.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
class AppError extends Error {
  constructor(message, { status, code }) { super(message); this.status = status; this.code = code; }
}
const batch = ids => ids.map((operationId, n) => ({
  operationId, workspaceId: 'workspace-a', entity: 'project', entityId: 'entity-' + n,
  operation: 'delete', baseVersion: 0,
}));
function harness(resolveOperation) {
  const handlers = new Map(), calls = [], exports = {};
  const field = { optional() { return this; }, int() { return this; }, min() { return this; }, max() { return this; }, default() { return this; } };
  const modules = {
    '@markmap/contracts': {
      pushSyncRequestSchema: { parse: value => value },
      pushSyncResponseSchema: { parse: value => value },
      pullSyncResponseSchema: { parse: value => value },
    },
    '@markmap/db': {
      getDb: () => ({}),
      async applyPushOperation(db, operation, workspaceId) {
        assert.equal(workspaceId, 'workspace-a'); calls.push(operation);
        return resolveOperation?.(operation, calls) ?? {
          status: 'accepted', version: calls.length, sequence: String(calls.length),
        };
      },
      async pullChanges() { throw Error('Unexpected pull'); },
    },
    zod: { z: { string: () => field, coerce: { number: () => field }, object: () => ({}) } },
    '../lib/errors.js': { AppError, ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR' } },
    '../lib/sync-cursor.js': { createSyncCursor: () => '', readSyncCursor: () => ({ sequence: '0' }) },
  };
  runInNewContext(code.outputText, {
    exports, require(key) { assert.ok(Object.hasOwn(modules, key), key); return modules[key]; },
    Set, Promise,
  });
  exports.syncRoutes({
    post(path, handler) { handlers.set(path, handler); }, get() {},
  });
  return {
    calls,
    async push(operations) {
      const ctx = {
        req: { json: async () => ({ operations }) },
        get: () => 'workspace-a',
        json: (body, status = 200) => ({ body, status }),
      };
      try { return await handlers.get('/sync/push')(ctx); }
      catch (e) {
        if (!(e instanceof AppError)) throw e;
        return { status: e.status, body: { error: { code: e.code, message: e.message } } };
      }
    },
  };
}

for (const [name, ids] of [
  ['adjacent duplicate', ['one', 'one']],
  ['nonadjacent conflicting envelopes', ['one', 'two', 'one']],
  ['last item in 500-operation batch', [...Array.from({length:499}, (_, i) => 'op-' + i), 'op-0']],
]) {
  test('A54 ' + name + ' rejects the whole batch before SQL', async () => {
    const h = harness();
    const result = await h.push(batch(ids));
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'VALIDATION_ERROR');
    assert.equal(h.calls.length, 0);
  });
}
test('A54 unique batch keeps ordered ACKs', async () => {
  const h = harness(), r = await h.push(batch(['a', 'b']));
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(r.body.accepted.map(x => x.operationId))), ['a', 'b']);
  assert.equal(h.calls.length, 2);
});
test('A54 repeat of a committed ID in a later request remains idempotent', async () => {
  const h = harness(() => ({ status: 'already_applied', version: 4, sequence: '15' }));
  const r = await h.push(batch(['previously-committed']));
  assert.equal(r.status, 200);
  assert.equal(r.body.alreadyApplied[0].version, 4);
  assert.equal(r.body.accepted.length, 0);
});
test('A54 version conflict still produces a conflict without an ACK', async () => {
  const h = harness(operation => ({ status: 'conflict', conflict: {
    operationId: operation.operationId, entity: operation.entity,
    entityId: operation.entityId, serverVersion: 2, baseVersion: 0, reason: 'VERSION_CONFLICT',
  } }));
  const r = await h.push(batch(['conflicting-operation']));
  assert.equal(r.status, 200);
  assert.equal(r.body.conflicts.length, 1);
  assert.equal(r.body.accepted.length, 0);
});
test('A54 empty batch is a no-op', async () => {
  const h = harness(), r = await h.push([]);
  assert.equal(r.status, 200);
  assert.equal(h.calls.length, 0);
});
