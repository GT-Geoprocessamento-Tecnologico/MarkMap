import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(new URL('../packages/db/src/queries/sync.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  fileName: 'packages/db/src/queries/sync.ts', reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
assert.equal((js.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const workspaceId = '11111111-1111-4111-8111-111111111111';
const entityId = '22222222-2222-4222-8222-222222222222';
const ops = {
  workspaceId: 'ops.workspaceId', operationId: 'ops.operationId',
  version: 'ops.version', sequence: 'ops.sequence', envelope: 'ops.envelope',
  entity: 'ops.entity', entityId: 'ops.entityId',
};
const entities = {
  workspaceId: 'entities.workspaceId', entity: 'entities.entity',
  entityId: 'entities.entityId', version: 'entities.version',
  payload: 'entities.payload',
};
const tombstones = { workspaceId: 'tombstones.workspaceId', entity: 'tombstones.entity', entityId: 'tombstones.entityId' };
const sql = (strings, ...values) => ({ text: strings.join('@@'), values });
const eq = (field, value) => ({ field, value });
const and = (...conditions) => conditions;
const exports = {};
runInNewContext(js.outputText, {
  exports,
  require(name) {
    if (name === '@geonexo/contracts') return {
      assertGeometryCompatible() {}, geometryTypeSchema: { parse: x => x },
    };
    if (name === 'drizzle-orm') return { and, asc: x => x, eq, gt: () => ({}), sql };
    if (name === '../schema/sync.js') return {
      syncEntities: entities, syncOperations: ops, syncTombstones: tombstones,
      uploadSessions: {},
    };
    throw Error('Unexpected import ' + name);
  },
});
const { applyPushOperation } = exports;
const project = name => ({entity:'project',data:{id:entityId,name,description:null,status:'active',createdAt:'2026-10-12T00:00:00Z',updatedAt:'2026-10-12T00:00:00Z'}});
const op = (uuid, name, baseVersion=null, extra={}) => ({
  operationId: uuid, workspaceId, entity: 'project', entityId,
  operation: 'upsert', baseVersion, createdAt: '2026-10-12T00:00:00Z',
  payload: project(name), ...extra,
});
const id = n => String(n).padStart(8,'0')+'-0000-4000-8000-000000000000';
const key = row => row.entity+':'+row.entityId;
function database() {
  let state = { entities: new Map(), operations: new Map(), tombstones: new Map(), materialized: new Map(), sequence: 0 };
  let queue = Promise.resolve();
  const db = {
    get current() { return state.entities.get('project:'+entityId); },
    get materialized() { return state.materialized.get(entityId); },
    get sequence() { return state.sequence; },
    get operationCount() { return state.operations.size; },
    async transaction(callback) {
      let release;
      const ready = new Promise(resolve => { release=resolve; });
      const prev = queue; queue = ready;
      await prev;
      const tmp = { entities:new Map(state.entities), operations:new Map(state.operations), tombstones:new Map(state.tombstones), materialized:new Map(state.materialized), sequence:state.sequence };
      const tx = {
        async execute(fragment) {
          const statement = fragment.text;
          if (statement.includes('SELECT id FROM workspaces')) return [{id:workspaceId}];
          if (statement.includes('UPDATE workspaces SET next_sequence')) {
            tmp.sequence += 1;
            return [{ next_sequence:BigInt(tmp.sequence) }];
          }
          if (statement.includes('INSERT INTO projects')) {
            tmp.materialized.set(entityId, fragment.values[2]);
            return [{id:entityId}];
          }
          if (statement.includes('UPDATE projects') || statement.includes('DELETE FROM projects')) return [];
          throw Error('Unexpected statement '+statement.slice(0,85));
        },
        select() {
          return { from(table) { return { where(conditions) { return {
            async limit() {
              if (table === ops) {
                const lookup = conditions.find(c => c.field === ops.operationId)?.value;
                const match = tmp.operations.get(lookup);
                return match ? [match] : [];
              }
              if (table === entities) {
                const match = tmp.entities.get('project:'+entityId);
                return match ? [match] : [];
              }
              throw Error('Unexpected table select');
            },
          }; } }; } };
        },
        insert(table) {
          return { values(row) {
            if (table === ops) { tmp.operations.set(row.operationId,row); return Promise.resolve(row); }
            if (table === entities || table === tombstones) {
              return { async onConflictDoUpdate() {
                if (table === entities) tmp.entities.set(key(row),row);
                else tmp.tombstones.set(key(row),row);
              } };
            }
            throw Error('Unexpected insert table');
          } };
        },
        delete(table) {
          return { async where() {
            if (table !== tombstones) throw Error('Unexpected delete');
            tmp.tombstones.clear();
          } };
        },
      };
      try { const result=await callback(tx); state=tmp; return result; }
      finally { release(); }
    },
  };
  return db;
}

test('A55 first unversioned create is accepted with version 1', async () => {
  const db=database();
  const first=await applyPushOperation(db,op(id(1),'original'),workspaceId);
  assert.equal(first.status,'accepted');
  assert.equal(first.version,1);
  assert.equal(db.sequence,1);
});

test('A55 concurrent new operation with null base must not overwrite existing project', async () => {
  const db=database();
  await applyPushOperation(db,op(id(1),'device A'),workspaceId);
  const second=await applyPushOperation(db,op(id(2),'device B'),workspaceId);
  assert.equal(second.status,'conflict');
  assert.equal(second.conflict.reason,'VERSION_CONFLICT');
  assert.equal(second.conflict.serverVersion,1);
  assert.equal(db.materialized,'device A');
  assert.equal(db.operationCount,1);
  assert.equal(db.sequence,1);
});

test('A55 null-version delete cannot remove an existing project', async () => {
  const db=database();
  await applyPushOperation(db,op(id(1),'existing'),workspaceId);
  const deletion={operationId:id(2),workspaceId,entity:'project',entityId,operation:'delete',baseVersion:null,createdAt:'2026-10-12T00:00:00Z'};
  const result=await applyPushOperation(db,deletion,workspaceId);
  assert.equal(result.status,'conflict');
  assert.equal(db.materialized,'existing');
  assert.equal(db.sequence,1);
});

test('A55 explicit matching version still permits updates', async () => {
  const db=database();
  await applyPushOperation(db,op(id(1),'before'),workspaceId);
  const second=await applyPushOperation(db,op(id(2),'after',1),workspaceId);
  assert.equal(second.status,'accepted');
  assert.equal(second.version,2);
  assert.equal(db.materialized,'after');
});

test('A55 same exact operation remains idempotent after initial create', async () => {
  const db=database(), operation=op(id(1),'stable');
  await applyPushOperation(db,operation,workspaceId);
  const again=await applyPushOperation(db,operation,workspaceId);
  assert.equal(again.status,'already_applied');
  assert.equal(again.version,1);
  assert.equal(db.sequence,1);
});

test('A55 predecessor chain with null base continues to work when predecessor version matches', async () => {
  const db=database();
  await applyPushOperation(db,op(id(1),'first'),workspaceId);
  const result=await applyPushOperation(db,op(id(2),'follow up',null,{predecessorOperationId:id(1)}),workspaceId);
  assert.equal(result.status,'accepted');
  assert.equal(result.version,2);
  assert.equal(db.materialized,'follow up');
});

test('A55 stale predecessor cannot overwrite newer version', async () => {
  const db=database();
  await applyPushOperation(db,op(id(1),'first'),workspaceId);
  await applyPushOperation(db,op(id(2),'second',1),workspaceId);
  const rejected=await applyPushOperation(db,op(id(3),'third',null,{predecessorOperationId:id(1)}),workspaceId);
  assert.equal(rejected.status,'conflict');
  assert.equal(rejected.conflict.serverVersion,2);
  assert.equal(db.materialized,'second');
});

test('A55 creates from separate installations are serialized by the workspace transaction', async () => {
  const db=database();
  const [a,b]=await Promise.all([
    applyPushOperation(db,op(id(1),'one'),workspaceId),
    applyPushOperation(db,op(id(2),'two'),workspaceId),
  ]);
  assert.deepEqual([a.status,b.status],['accepted','conflict']);
  assert.equal(db.sequence,1);
});

test('A55 explicit stale version remains a conflict', async () => {
  const db=database();
  await applyPushOperation(db,op(id(1),'first'),workspaceId);
  const result=await applyPushOperation(db,op(id(2),'stale',0),workspaceId);
  assert.equal(result.status,'conflict');
  assert.equal(result.conflict.serverVersion,1);
});

test('A55 deleting at the explicit current version stays available', async () => {
  const db=database();
  await applyPushOperation(db,op(id(1),'previous'),workspaceId);
  const deletion={operationId:id(2),workspaceId,entity:'project',entityId,operation:'delete',baseVersion:1,createdAt:'2026-10-12T00:00:00Z'};
  const removed=await applyPushOperation(db,deletion,workspaceId);
  assert.equal(removed.status,'accepted');
  assert.equal(removed.version,2);
  assert.equal(db.sequence,2);
  const repeat=await applyPushOperation(db,op(id(3),'blind recreation'),workspaceId);
  assert.equal(repeat.status,'conflict');
  assert.equal(repeat.conflict.serverVersion,2);
});

test('A55 different-workspace operation cannot update server-owned entity', async () => {
  const db=database();
  const operation={...op(id(1),'outside'),workspaceId:'33333333-3333-4333-8333-333333333333'};
  const result=await applyPushOperation(db,operation,workspaceId);
  assert.equal(result.status,'conflict');
  assert.equal(result.conflict.reason,'SCOPE_REJECTED');
  assert.equal(db.operationCount,0);
  assert.equal(db.sequence,0);
});
