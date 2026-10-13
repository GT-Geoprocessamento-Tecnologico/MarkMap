import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';

const requireLocal = createRequire(import.meta.url);
const ts = requireLocal('typescript');
const base = new URL('../apps/admin/src/', import.meta.url);
const loadTS = (relative, mocks, extras = {}) => {
  const source = readFileSync(new URL(relative, base), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    esModuleInterop: true,
  }});
  assert.deepEqual(compiled.diagnostics ?? [], []);
  const exports = {};
  runInNewContext(compiled.outputText, {
    exports,
    require(name) { if (!(name in mocks)) throw Error('Unexpected runtime import: ' + name); return mocks[name]; },
    Blob, TextEncoder, Uint8Array, ArrayBuffer, crypto: webcrypto, Error,
    ...extras,
  });
  return exports;
};
const indexes = {
  MAX_REGIONAL_SEARCH_RECORDS: 25_000,
  MAX_REGIONAL_SHARD_BYTES: 2 * 1024 * 1024,
  MAX_REGIONAL_SEARCH_BYTES: 12 * 1024 * 1024,
  parseRegionalShard(data, path) {
    assert.equal(path, 'search/a0.json');
    assert.equal(data.id, 'a0');
    return data;
  },
};
const search = () => loadTS('lib/search/regional-package-search.ts', {
  '@geonexo/maps/search/regional-shards': indexes,
});
const shard = value => new Blob([JSON.stringify({ id: 'a0', records: [{
  id: value, name: value, normalized: value, lon: 1, lat: 2, type: 'poi', category: 'poi',
}] })]);
const manifest = { searchShards: [{ path: 'search/a0.json' }] };

test('A34 regional search pins the active generation for each shard', async () => {
  const called = [];
  const store = {
    async getActiveRevision() { return { generation: 'old', manifest }; },
    async assetAtRevision(id, path, generation) {
      called.push([id, path, generation]);
      assert.equal(generation, 'old');
      return shard('correct-old-data');
    },
    async get() { return { manifest }; },
    async asset() { return shard('incorrect-new-data'); },
  };
  const records = await search().loadRegionalPackageSearch(store, 'region-1');
  assert.equal(records[0]?.name, 'correct-old-data');
  assert.deepEqual(called, [['region-1', 'search/a0.json', 'old']]);
});

test('A34 search does not display records from a replaced generation', async () => {
  let calls = 0;
  const store = {
    async getActiveRevision() {
      return { generation: ++calls === 1 ? 'old' : 'new', manifest };
    },
    async assetAtRevision(_id, _path, generation) {
      assert.equal(generation, 'old');
      return shard('old-data');
    },
    async get() { return { manifest }; },
    async asset() { return shard('new-data'); },
  };
  await assert.rejects(search().loadRegionalPackageSearch(store, 'region-1'), /atualizad/i);
});

test('A34 missing installed search pack never fetches network resources', async () => {
  const store = { async getActiveRevision() { return null; },
    async assetAtRevision() { throw Error('Must not read asset'); },
    async get() { throw Error('Unexpected legacy read'); },
    async asset() { throw Error('Unexpected legacy asset read'); },
  };
  assert.equal((await search().loadRegionalPackageSearch(store, 'region-1')).length, 0);
});

const worker = mocks => {
  let handler;
  const emitted = [];
  loadTS('workers/offline-route.worker.ts', mocks, {
    self: { addEventListener(name, fn) { if (name === 'message') handler = fn; }, postMessage(data) { emitted.push(data); } },
  });
  return { send(msg) { handler({ data: msg }); }, emitted };
};
const payload = new Blob(['{"graph":"hello"}']);
const bytes = Buffer.from('{"graph":"hello"}');
const sha256 = createHash('sha256').update(bytes).digest('hex');
const routeManifest = { routingGraph: { path: 'graph.json', blob: { bytes: bytes.length, sha256 } },
  capabilities: ['routing.walk'], bounds: [0, 0, 10, 10], osmDataDate: '2026-10-01' };
const waitFor = async (predicate) => {
  const deadline = Date.now() + 3000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for offline worker readiness');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
};
function workerImports(store) {
  return {
    '../lib/storage/offline-map-store': { offlineMapStore: store },
    '../lib/map/offline-route-worker-errors.mjs': {
      describeOfflineRouteWorkerFailure: (_error) => 'Falha segura no grafo regional.',
    },
    '@geonexo/maps/routing': { findRoute: () => null },
    '@geonexo/maps/routing/navigation-progress': { computeOfflineNavigationProgress: () => null },
    '@geonexo/maps/routing/graph-format.mjs': {
      MAX_GRAPH_BYTES: 8 * 1024 * 1024,
      validateRegionalGraph: () => ({ profiles: ['walk'] }),
    },
  };
}

test('A34 offline routing binds graph Blob to the manifest generation', async () => {
  let pinned = false;
  const store = {
    async getActiveRevision() { return { generation: 'old', manifest: routeManifest }; },
    async assetAtRevision(_id, path, generation) {
      assert.equal(path, 'graph.json'); assert.equal(generation, 'old');
      pinned = true; return payload;
    },
    async get() { return { manifest: routeManifest }; },
    async asset() { return new Blob(['stale-wrong-graph']); },
  };
  const w = worker(workerImports(store));
  w.send({ type: 'load', packageId: 'region-1' });
  await waitFor(() => w.emitted.some(message => message.type === 'ready'));
  assert.equal(pinned, true);
  assert.deepEqual(w.emitted.at(-1)?.profiles, ['walk']);
});

test('A34 offline routing does not announce stale routing profiles after region replacement', async () => {
  let reads = 0;
  const store = {
    async getActiveRevision() {
      reads += 1;
      return { generation: reads === 1 ? 'old' : 'new', manifest: routeManifest };
    },
    async assetAtRevision() { return payload; },
    async get() { return { manifest: routeManifest }; },
    async asset() { return payload; },
  };
  const w = worker(workerImports(store));
  w.send({ type: 'load', packageId: 'region-1' });
  await waitFor(() => w.emitted.some(message => message.type === 'ready'));
  assert.equal(w.emitted.at(-1)?.profiles?.length, 0);
  assert.match(w.emitted.at(-1)?.reason ?? '', /segura/i);
});

test('A34 displays only trusted regional search error text', () => {
  const { describeRegionalSearchLoadError } = search();
  const leaked = describeRegionalSearchLoadError(Error('Could not load /private/sync.json?token=TOP_SECRET'));
  assert.match(leaked, /Busca regional indisponível/);
  assert.doesNotMatch(leaked, /private|sync|token|secret|https:/i);
  assert.equal(describeRegionalSearchLoadError(Error('Índice regional ausente; reinstale este mapa offline.')),
    'Índice regional ausente; reinstale este mapa offline.');
  assert.equal(describeRegionalSearchLoadError(Error('O mapa regional foi atualizado. Reabra a busca offline.')),
    'O mapa regional foi atualizado. Reabra a busca offline.');
});

test('A34 a missing shard in the unchanged generation gets integrity guidance', async () => {
  let reads = 0;
  const store = {
    async getActiveRevision() { reads += 1; return { generation: 'same', manifest }; },
    async assetAtRevision() { return null; },
    async get() { throw Error('legacy read forbidden'); },
    async asset() { throw Error('legacy read forbidden'); },
  };
  await assert.rejects(search().loadRegionalPackageSearch(store, 'region-1'), /Índice regional ausente/);
  assert.equal(reads, 2);
});

test('A34 a missing shard during a region update reports revision change, not corruption', async () => {
  let reads = 0;
  const store = {
    async getActiveRevision() { return { generation: ++reads === 1 ? 'v1' : 'v2', manifest }; },
    async assetAtRevision() { return null; },
  };
  await assert.rejects(search().loadRegionalPackageSearch(store, 'region-1'), /foi atualizado/);
});
