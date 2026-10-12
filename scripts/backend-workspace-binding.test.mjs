import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const dbPath = new URL('../packages/db/src/queries/workspaces.ts', import.meta.url);
const routePath = new URL('../services/api/src/routes/workspace.ts', import.meta.url);
const workspaceId = '11111111-1111-4111-8111-111111111111';
const requestId = '33333333-3333-4333-8333-333333333333';
const installationId = '22222222-2222-4222-8222-222222222222';
const proof = 'a'.repeat(43);

const tag = (strings, ...values) => ({ text: strings.join('$'), values });
function load(path, modules) {
  const output = ts.transpileModule(readFileSync(path, 'utf8'), {
    fileName: path.pathname, reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const diagnostics = output.diagnostics?.filter(x => x.category === ts.DiagnosticCategory.Error) || [];
  assert.equal(diagnostics.length, 0, 'TypeScript transpilation diagnostics');
  const exports = {};
  runInNewContext(output.outputText, {
    exports, require(key) {
      assert.ok(Object.hasOwn(modules, key), `unexpected dependency ${key}`);
      return modules[key];
    },
    Error, TypeError, Date, Buffer, BigInt,
  });
  return exports;
}

function loadBackend(execute) {
  const db = { execute };
  const api = load(dbPath, {
    'drizzle-orm': { sql: tag, and: () => ({}), eq: () => ({}) },
    '../schema/workspaces.js': { workspaces: {} },
  });
  return { db, ...api };
}
function pgUnique(constraint='workspaces_pkey') {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505', constraint,
  });
}
const bindingMessage = /workspace binding/i;

test('A53 conflicting workspace ID and different bootstrap proof maps SQLSTATE 23505 to binding conflict', async () => {
  const b = loadBackend(async () => { throw pgUnique(); });
  await assert.rejects(b.provisionWorkspace(b.db, {workspaceId, proofDigest:'other-proof', capabilityHash:'new-token'}), bindingMessage);
});

test('A53 wrapped DrizzleQueryError 23505 remains a business conflict', async () => {
  const wrapped = Object.assign(new Error('Failed query: params redacted'), {cause: pgUnique()});
  const b = loadBackend(async () => { throw wrapped; });
  await assert.rejects(b.provisionWorkspace(b.db, {workspaceId, proofDigest:'different', capabilityHash:'token'}), bindingMessage);
});

test('A53 other PostgreSQL unique constraints reject the provisioning without leaking driver detail', async () => {
  const b = loadBackend(async () => { throw pgUnique('workspaces_capability_hash_unique'); });
  await assert.rejects(b.provisionWorkspace(b.db, {workspaceId, proofDigest:'proof', capabilityHash:'collision'}), e => {
    assert.match(e.message, bindingMessage);
    assert.doesNotMatch(e.message, /constraint|duplicate key/i);
    return true;
  });
});

test('A53 non-conflict SQL errors must be preserved for normal 500 handling', async () => {
  const unavailable = Object.assign(new Error('DB unavailable'), {code:'08006'});
  const b = loadBackend(async () => { throw unavailable; });
  await assert.rejects(b.provisionWorkspace(b.db, {workspaceId, proofDigest:'proof', capabilityHash:'hash'}), e => e === unavailable);
});

test('A53 proper re-provision with same proof preserves successful generation advance', async () => {
  const b = loadBackend(async () => [{id: workspaceId, generation: 4n}]);
  const out = await b.provisionWorkspace(b.db, {workspaceId, proofDigest:'same-proof', capabilityHash:'new-token'});
  assert.equal(out.workspaceId, workspaceId);
  assert.equal(out.generation, '4');
});

test('A53 revoked binding with empty SQL RETURNING still fails safely', async () => {
  const b = loadBackend(async () => []);
  await assert.rejects(b.provisionWorkspace(b.db, {workspaceId, proofDigest:'proof', capabilityHash:'hash'}), bindingMessage);
});

function appHarness(execute, rateLimit={allowed:true,remaining:10,retryAfterSeconds:60}) {
  const backend = loadBackend(execute);
  const handlers = new Map();
  class AppError extends Error {
    constructor(message, opts) { super(message); this.status = opts.status; this.code = opts.code; }
  }
  const {workspaceRoutes} = load(routePath, {
    'node:crypto': createRequire(import.meta.url)('node:crypto'),
    '@geonexo/contracts': {
      capabilityProvisionRequestSchema: {parse:v=>v},
      capabilityProvisionResponseSchema: {parse:v=>v},
      capabilityRecoveryRequestSchema: {parse:v=>v},
      ErrorCodes:{RATE_LIMITED:'RATE_LIMITED'},
    },
    '@geonexo/db': {
      getDb:()=>backend.db,
      provisionWorkspace:backend.provisionWorkspace,
      recoverWorkspaceCapability:backend.recoverWorkspaceCapability,
    },
    '../lib/errors.js': {AppError, ErrorCode:{VALIDATION_ERROR:'VALIDATION_ERROR'}},
    '../lib/workspace-rate-limit.js':{checkWorkspaceRateLimit: async()=>rateLimit},
  });
  workspaceRoutes({post(path,callback){handlers.set(path,callback);}});
  async function request(path='/workspace/provision') {
    const headers = {};
    const c = {
      req: {json:async()=>({workspaceId,installationId,bootstrapProof:proof})},
      get:()=>requestId,
      header(name,value){headers[name]=value;},
      json(body,status=200){return {status,body,headers};},
    };
    try {return await handlers.get(path)(c);}
    catch (error) {
      if (error instanceof AppError) return {status:error.status,body:{error:{code:error.code,message:error.message}}};
      return {status:500,body:{error:{code:'INTERNAL_ERROR',message:'Internal server error'}}};
    }
  }
  return {request};
}

test('A53 API route returns HTTP 409 instead of 500 for reused workspace ID with wrong proof', async () => {
  const api = appHarness(async () => {throw pgUnique();});
  const res=await api.request();
  assert.equal(res.status,409);
  assert.equal(res.body.error.code,'VALIDATION_ERROR');
  assert.doesNotMatch(res.body.error.message, /duplicate key|constraint/i);
});

test('A53 API route retains HTTP 201 for allowed initial/repeated provisioning', async () => {
  const api=appHarness(async()=>[{id:workspaceId,generation:2n}]);
  const res=await api.request();
  assert.equal(res.status,201);
  assert.equal(res.body.workspaceId,workspaceId);
  assert.equal(res.body.generation,'2');
});

test('A53 rate-limited provisioning never reaches the database', async () => {
  let writes=0;
  const api=appHarness(async()=>{writes++;return[{id:workspaceId,generation:1n}]},{allowed:false,remaining:0,retryAfterSeconds:60});
  const res=await api.request();
  assert.equal(res.status,429);
  assert.equal(writes,0);
});
