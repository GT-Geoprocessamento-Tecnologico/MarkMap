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

// Contract rules from packages/contracts/src/sync.ts: VERSION_CONFLICT
// requires a positive serverVersion, while SCOPE_REJECTED requires zero
// and must not disclose serverPayload.
function assertWireConflict(result) {
  assert.equal(result.status,'conflict');
  assert.ok(result.conflict);
  const c=result.conflict;
  if(c.reason==='SCOPE_REJECTED') {
    assert.equal(c.serverVersion,0);
    assert.equal(Object.hasOwn(c,'serverPayload'),false);
  } else {
    assert.equal(c.reason,'VERSION_CONFLICT');
    assert.ok(c.serverVersion>=1,'VERSION_CONFLICT cannot have serverVersion 0');
  }
}

test('A56 missing predecessor of a new entity returns wire-valid conflict, not VERSION_CONFLICT version 0',async()=>{
  const db=database();
  const result=await applyPushOperation(db,op(id(2),'offline',null,{predecessorOperationId:id(1)}),workspaceId);
  assertWireConflict(result);
  assert.equal(result.conflict.reason,'SCOPE_REJECTED');
  assert.equal(db.operationCount,0);
  assert.equal(db.sequence,0);
  assert.equal(db.current,undefined);
});

test('A56 missing predecessor with explicit base 0 also yields a valid scope rejection',async()=>{
  const db=database();
  const result=await applyPushOperation(db,op(id(2),'offline',0,{predecessorOperationId:id(1)}),workspaceId);
  assertWireConflict(result);
  assert.equal(result.conflict.reason,'SCOPE_REJECTED');
});

test('A56 positive base version against nonexistent entity has a wire-valid conflict',async()=>{
  const db=database();
  const result=await applyPushOperation(db,op(id(1),'local',4),workspaceId);
  assertWireConflict(result);
  assert.equal(result.conflict.reason,'SCOPE_REJECTED');
  assert.equal(db.sequence,0);
});

test('A56 invalid predecessor of an existing project preserves VERSION_CONFLICT and server payload',async()=>{
  const db=database();
  await applyPushOperation(db,op(id(1),'remote'),workspaceId);
  const result=await applyPushOperation(db,op(id(3),'out of chain',null,{predecessorOperationId:id(2)}),workspaceId);
  assertWireConflict(result);
  assert.equal(result.conflict.reason,'VERSION_CONFLICT');
  assert.equal(result.conflict.serverVersion,1);
  assert.equal(result.conflict.serverPayload?.data.name,'remote');
  assert.equal(db.materialized,'remote');
  assert.equal(db.sequence,1);
});

test('A56 wrong-entity predecessor does not let another entity branch apply',async()=>{
  const db=database();
  await applyPushOperation(db,op(id(1),'remote'),workspaceId);
  const attempt=op(id(2),'other',null,{entityId:'33333333-3333-4333-8333-333333333333',predecessorOperationId:id(1)});
  const result=await applyPushOperation(db,attempt,workspaceId);
  assertWireConflict(result);
  assert.equal(result.conflict.reason,'VERSION_CONFLICT');
  assert.equal(result.conflict.serverVersion,1);
  assert.equal(db.sequence,1);
});

test('A56 stale predecessor after tombstone conflicts without revealing a deleted payload',async()=>{
  const db=database();
  await applyPushOperation(db,op(id(1),'former'),workspaceId);
  const deletion={operationId:id(2),workspaceId,entity:'project',entityId,operation:'delete',baseVersion:1,createdAt:'2026-10-12T00:00:00Z'};
  await applyPushOperation(db,deletion,workspaceId);
  const result=await applyPushOperation(db,op(id(3),'stale successor',null,{predecessorOperationId:id(1)}),workspaceId);
  assertWireConflict(result);
  assert.equal(result.conflict.reason,'VERSION_CONFLICT');
  assert.equal(result.conflict.serverVersion,2);
  assert.equal(Object.hasOwn(result.conflict,'serverPayload'),false);
  assert.equal(db.sequence,2);
});

test('A56 confirmed latest tombstone predecessor allows explicit recreate with version 3',async()=>{
  const db=database();
  await applyPushOperation(db,op(id(1),'former'),workspaceId);
  const deletion={operationId:id(2),workspaceId,entity:'project',entityId,operation:'delete',baseVersion:1,createdAt:'2026-10-12T00:00:00Z'};
  await applyPushOperation(db,deletion,workspaceId);
  const result=await applyPushOperation(db,op(id(3),'restored',null,{predecessorOperationId:id(2)}),workspaceId);
  assert.equal(result.status,'accepted');
  assert.equal(result.version,3);
  assert.equal(db.sequence,3);
  assert.equal(db.materialized,'restored');
});

test('A56 initial create and subsequent explicit version update remain unchanged',async()=>{
  const db=database();
  assert.equal((await applyPushOperation(db,op(id(1),'first'),workspaceId)).status,'accepted');
  const updated=await applyPushOperation(db,op(id(2),'second',1),workspaceId);
  assert.equal(updated.status,'accepted');
  assert.equal(updated.version,2);
});
