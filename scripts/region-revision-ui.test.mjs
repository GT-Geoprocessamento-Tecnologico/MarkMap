import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { createHash, webcrypto } from 'node:crypto';

const ts = createRequire(import.meta.url)('typescript');
const from = new URL('../apps/admin/src/components/map/', import.meta.url);
const sha = text => createHash('sha256').update(text).digest('hex');
const settle = () => new Promise(resolve => setTimeout(resolve, 35));

function renderComponent(file, exportName, store, otherModules, props) {
  const state = [];
  const effects = [];
  const transit = [];
  const hooks = {
    useState(initial) {
      const item = { value: initial, updates: [] };
      state.push(item);
      return [initial, next => { item.updates.push(next); item.value = next; }];
    },
    useEffect(callback) { effects.push(callback); },
    useMemo(callback) { return callback(); },
  };
  const imports = {
    react: hooks,
    'react/jsx-runtime': { jsx() { return null; }, jsxs() { return null; }, Fragment: {} },
    '../../lib/storage/offline-map-store': { offlineMapStore: store },
    ...otherModules,
  };
  const source = readFileSync(new URL(file, from), 'utf8');
  const emitted = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  assert.equal((emitted.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error).length, 0);
  const exports = {};
  runInNewContext(emitted.outputText, {
    exports,
    require: name => { if (!(name in imports)) throw Error('Unexpected import: ' + name); return imports[name]; },
    Error, Blob, TextEncoder, Uint8Array, ArrayBuffer, crypto: webcrypto,
  });
  exports[exportName]({ ...props, onStation() {}, onTransit: result => transit.push(result) });
  assert.equal(effects.length, 1);
  effects[0]();
  return { exports, state, transit };
}

const wikiText = JSON.stringify({ articles: [{ id: 'wiki1', title: 'Offline verified article', summary: 'safe' }],
  attribution: 'Publisher', license: 'ODbL' });
const wiki = new Blob([wikiText]);
const knowledgeManifest = { id: 'regional', bounds: [0, 0, 1, 1], wikipediaPack: {
  path: 'wikipedia.json', blob: { bytes: wiki.size, sha256: sha(wikiText) },
}};
const knowledgeDeps = { '@geonexo/maps/content/region-content.mjs': {
  MAX_TRANSIT_BYTES: 2000000, MAX_WIKIPEDIA_BYTES: 2000000,
  validateRegionalWikipedia(value) { return value; }, validateRegionalTransit(value) { return value; },
}};

const demText = JSON.stringify({metadata:{source:'srtm',attribution:'Trusted',license:'ODbL',resolutionMeters:30,verticalDatum:'EGM96'},values:[12,12,12,12]});
const demBlob = new Blob([demText]);
const elevationManifest = { id: 'regional', bounds: [0,0,1,1], demGrid: {
  path:'dem.json',blob:{bytes:demBlob.size,sha256:sha(demText)},
}};
const demDeps = { '@geonexo/maps/elevation/regional-dem.mjs': {
  MAX_REGIONAL_DEM_BYTES: 2000000,
  validateRegionalDem(value) { return value; },
  computeRegionalElevationProfile() { return null; },
}};

const revisions = (manifest, blob, options = {}) => {
  let readings = 0;
  const observed = [];
  return {
    observed,
    async getActiveRevision() { readings++; if (options.failRead) throw new Error(options.failRead);
      return {generation:options.changeAfterFirst && readings > 1 ? 'new' : 'old',manifest}; },
    async assetAtRevision(_id, path, generation) {
      observed.push([path,generation]);
      if (options.failAsset) throw new Error(options.failAsset);
      assert.equal(generation,'old'); return blob;
    },
    async get() { throw new Error('Legacy unpinned metadata read'); },
    async asset() { throw new Error('Legacy unpinned asset read'); },
  };
};

test('A34 Wikipedia offline assets are pinned to the selected active generation', async () => {
  const store = revisions(knowledgeManifest,wiki);
  const ui = renderComponent('OfflineKnowledge.tsx','OfflineKnowledge',store,knowledgeDeps,{packageId:'regional'});
  await settle();
  assert.deepEqual(store.observed,[['wikipedia.json','old']]);
  assert.equal(ui.state[2].updates.at(-1)?.articles?.[0]?.title,'Offline verified article');
});

test('A34 Wikipedia/transport must not surface old data after a region update', async () => {
  const store = revisions(knowledgeManifest,wiki,{changeAfterFirst:true});
  const ui = renderComponent('OfflineKnowledge.tsx','OfflineKnowledge',store,knowledgeDeps,{packageId:'regional'});
  await settle();
  assert.equal(ui.state[2].updates.some(v=>v.articles?.length),false);
  assert.match(ui.state[3].updates.at(-1)||'',/atualizado/i);
});

test('A34 knowledge errors never expose untrusted IndexedDB secrets in UI', async () => {
  const store = revisions(knowledgeManifest,wiki,{failAsset:'Denied /private/path?token=TOP_SECRET'});
  const ui = renderComponent('OfflineKnowledge.tsx','OfflineKnowledge',store,knowledgeDeps,{packageId:'regional'});
  await settle();
  const error=ui.state[3].updates.at(-1);
  assert.match(error,/Conteúdo regional indisponível/);
  assert.doesNotMatch(error,/private|token|secret|path/i);
});

test('A34 elevation uses the active revision for checksum-verified local DEM', async () => {
  const store=revisions(elevationManifest,demBlob);
  const ui=renderComponent('OfflineElevation.tsx','OfflineElevation',store,demDeps,{packageId:'regional',route:null});
  await settle();
  assert.deepEqual(store.observed,[['dem.json','old']]);
  assert.equal(ui.state[1].updates.at(-1)?.metadata?.source,'srtm');
});

test('A34 elevation does not publish a DEM after region generation changes', async () => {
  const store=revisions(elevationManifest,demBlob,{changeAfterFirst:true});
  const ui=renderComponent('OfflineElevation.tsx','OfflineElevation',store,demDeps,{packageId:'regional',route:null});
  await settle();
  assert.equal(ui.state[1].updates.some(v=>v?.metadata),false);
  assert.match(ui.state[2].updates.at(-1)||'',/atualizado/i);
});

test('A34 elevation errors redact accidental storage paths and tokens', async () => {
  const store=revisions(elevationManifest,demBlob,{failAsset:'Error from /private/idb?token=TOP_SECRET'});
  const ui=renderComponent('OfflineElevation.tsx','OfflineElevation',store,demDeps,{packageId:'regional',route:null});
  await settle();
  const error=ui.state[2].updates.at(-1);
  assert.match(error,/Dados altimétricos indisponíveis/);
  assert.doesNotMatch(error,/private|token|secret|path/i);
});
