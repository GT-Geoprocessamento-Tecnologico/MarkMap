import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const source = readFileSync(new URL('../apps/admin/src/lib/sync/SyncController.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  fileName: 'SyncController.tsx', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
assert.equal((compiled.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);

function harness({ online = true, visible = true, responses = [] } = {}) {
  const window = new EventTarget();
  const document = new EventTarget();
  document.visibilityState = visible ? 'visible' : 'hidden';
  const navigator = { onLine: online };
  const state = { runs: 0, invalidations: 0, disposed: false };
  let cleanup;
  const queryClient = { async invalidateQueries() { state.invalidations++; } };
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports,
    require(name) {
      if (name === 'react') return { useEffect(callback) { cleanup = callback(); } };
      if (name === '@tanstack/react-query') return { useQueryClient() { return queryClient; } };
      if (name === './sync-engine') return { async syncNow() {
        state.runs++;
        return responses.shift() || {state:'synced', pushed:0, pulled:0, conflicts:0, pending:0};
      } };
      throw Error('Unexpected module ' + name);
    },
    indexedDB: {}, window, document, navigator,
    setInterval: () => 17, clearInterval: () => undefined,
    setTimeout, clearTimeout,
  });
  exports.SyncController();
  return {
    state, window, document, navigator,
    async idle() { await new Promise(resolve => setImmediate(resolve)); },
    firePageshow(persisted) {
      const event = new Event('pageshow');
      Object.defineProperty(event, 'persisted', { value: persisted });
      window.dispatchEvent(event);
    },
    stop() { cleanup?.(); state.disposed = true; },
  };
}

test('A47 restored PWA from bfcache schedules a new sync without visibilitychange', async () => {
  const h = harness();
  await h.idle();
  assert.equal(h.state.runs, 1);
  h.firePageshow(true);
  await h.idle();
  assert.equal(h.state.runs, 2);
  h.stop();
});

test('A47 normal pageshow does not cause duplicate initial sync', async () => {
  const h = harness();
  await h.idle();
  h.firePageshow(false);
  await h.idle();
  assert.equal(h.state.runs, 1);
  h.stop();
});

test('A47 app focus with unchanged visibility resumes pending sync, not while hidden', async () => {
  const h = harness();
  await h.idle();
  h.window.dispatchEvent(new Event('focus'));
  await h.idle();
  assert.equal(h.state.runs, 2);
  h.document.visibilityState = 'hidden';
  h.window.dispatchEvent(new Event('focus'));
  await h.idle();
  assert.equal(h.state.runs, 2);
  h.stop();
});

test('A47 fresh server conflicts invalidate visible conflict queries', async () => {
  const h = harness({ responses: [{state:'idle',pulled:0,pushed:0,conflicts:2,pending:0}] });
  await h.idle();
  assert.equal(h.state.runs, 1);
  assert.equal(h.state.invalidations, 1);
  h.stop();
});

test('A47 after unmount, foreground events must not restart sync', async () => {
  const h = harness();
  await h.idle();
  h.stop();
  h.firePageshow(true);
  h.window.dispatchEvent(new Event('focus'));
  await h.idle();
  assert.equal(h.state.runs, 1);
});

test('A47 offline PWA foreground events leave remote sync untouched', async () => {
  const h = harness({ online:false });
  await h.idle();
  h.firePageshow(true);
  h.window.dispatchEvent(new Event('focus'));
  await h.idle();
  assert.equal(h.state.runs, 0);
  h.stop();
});
