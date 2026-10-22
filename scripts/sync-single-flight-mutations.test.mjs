import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const ts = createRequire(import.meta.url)('typescript');
const file = new URL('../apps/admin/src/lib/sync/SyncController.tsx', import.meta.url);
const source = ts.transpileModule(readFileSync(file, 'utf8'), {
  fileName: 'SyncController.tsx', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});
assert.equal((source.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
const result = { state: 'synced', pushed: 0, pulled: 0, conflicts: 0, pending: 0 };

function startHarness() {
  const window = new EventTarget();
  const document = new EventTarget();
  const navigator = { onLine: true };
  document.visibilityState = 'visible';
  let resolvedFirst = false;
  let settleFirst;
  const first = new Promise(resolve => { settleFirst = () => { resolvedFirst = true; resolve(result); }; });
  const effects = [];
  const scheduled = [];
  const state = { actualSyncs: 0, invalidations: 0 };
  const queryClient = { async invalidateQueries() { state.invalidations++; } };
  let dispose;
  const exports = {};
  runInNewContext(source.outputText, {
    exports,
    require(name) {
      if (name === 'react') return { useEffect(callback) { dispose = callback(); effects.push('mounted'); } };
      if (name === '@tanstack/react-query') return { useQueryClient: () => queryClient };
      if (name === './sync-engine') return { syncNow: () => {
        if (!resolvedFirst) {
          if (state.actualSyncs === 0) state.actualSyncs++;
          return first;
        }
        state.actualSyncs++;
        return Promise.resolve(result);
      } };
      throw Error('Unexpected import '+name);
    },
    indexedDB: {}, navigator, window, document,
    setTimeout(callback, ms) { scheduled.push({ callback, ms }); return scheduled.length; },
    clearTimeout: () => undefined,
    setInterval: () => 1, clearInterval: () => undefined,
  });
  exports.SyncController();
  return {
    state, navigator, window, flush: async () => { for (let i=0;i<8;i++) await Promise.resolve(); },
    onLocalMutation() { window.dispatchEvent(new Event('geonexo-local-mutation')); },
    debounce() { const job = scheduled.pop(); assert.equal(job.ms, 2500); job.callback(); },
    settleFirst, stop: () => dispose?.(),
  };
}

test('A51 local edit arriving during an active push/pull is not forgotten by singleton sync', async () => {
  const h = startHarness();
  assert.equal(h.state.actualSyncs, 1);
  h.onLocalMutation();
  h.debounce();
  assert.equal(h.state.actualSyncs, 1);
  h.settleFirst();
  await h.flush();
  assert.equal(h.state.actualSyncs, 2, 'new outbox edit should run a fresh sync after the in-flight request');
  h.stop();
});

test('A51 repeated local edits during one flight cause at most one queued rerun', async () => {
  const h = startHarness();
  for (let i=0;i<3;i++) { h.onLocalMutation(); h.debounce(); }
  h.settleFirst();
  await h.flush();
  assert.equal(h.state.actualSyncs, 2);
  h.stop();
});

test('A51 queued rerun does not contact network while offline', async () => {
  const h = startHarness();
  h.onLocalMutation(); h.debounce();
  h.navigator.onLine = false;
  h.settleFirst();
  await h.flush();
  assert.equal(h.state.actualSyncs, 1);
  h.navigator.onLine = true;
  h.window.dispatchEvent(new Event('online'));
  await h.flush();
  assert.equal(h.state.actualSyncs, 2);
  h.stop();
});

test('A51 unmount suppresses a queued sync and leaves local outbox untouched', async () => {
  const h = startHarness();
  h.onLocalMutation(); h.debounce();
  h.stop();
  h.settleFirst();
  await h.flush();
  assert.equal(h.state.actualSyncs, 1);
});
