import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateRegionalWikipedia, validateRegionalTransit, RegionContentError } from '../packages/maps/src/content/region-content.mjs';
import { buildManifest, runPipeline } from './region-pipeline.mjs';

const bounds = [-48, -16, -47, -15];
const now = '2026-10-09T12:00:00.000Z';
const wiki = {
  regionId: 'sample-region', version: '1.0.0', generatedAt: now,
  attribution: 'Wikipedia contributors', license: 'CC BY-SA 4.0',
  articles: [{id:'wiki:1', title:'Parque Central', summary:'História local', language:'pt-BR',
    url:'https://pt.wikipedia.org/wiki/Parque', osmId:'node/123', attribution:'Wikipedia contributors', license:'CC BY-SA 4.0'}],
};
const transit = {
  regionId: 'sample-region', version: '1.0.0', generatedAt: now,
  attribution: 'Transport agency', license: 'Data license by agency',
  stations: [{id:'station-1', name:'Estação Central', lon:-47.5, lat:-15.5, lines:['line-1']}],
  lines: [{id:'line-1', name:'Linha Azul', color:'#123ABC', mode:'metro', stationIds:['station-1']}],
};
const hash = x => createHash('sha256').update(x).digest('hex');

test('valid licensed wikipedia and metro data are local and bounded', () => {
  assert.equal(validateRegionalWikipedia(wiki, 'sample-region').articles.length, 1);
  assert.equal(validateRegionalTransit(transit, 'sample-region', bounds).stations.length, 1);
});
test('rejects Wikipedia URL with script scheme', () => {
  assert.throws(() => validateRegionalWikipedia({...wiki, articles:[{...wiki.articles[0], url:'javascript:alert(1)'}]}, 'sample-region'), RegionContentError);
});
test('rejects reused IDs and missing license', () => {
  assert.throws(() => validateRegionalWikipedia({...wiki, articles:[wiki.articles[0], wiki.articles[0]]}, 'sample-region'), /inválido/i);
  assert.throws(() => validateRegionalWikipedia({...wiki, license:''}, 'sample-region'), /licença/i);
});
test('rejects stations outside region and broken line references', () => {
  assert.throws(() => validateRegionalTransit({...transit, stations:[{...transit.stations[0], lat:80}]}, 'sample-region', bounds), RegionContentError);
  assert.throws(() => validateRegionalTransit({...transit, lines:[]}, 'sample-region', bounds), /desconhecida/i);
});
test('enforces regional affiliation', () => {
  assert.throws(() => validateRegionalWikipedia(wiki, 'different-region'), RegionContentError);
  assert.throws(() => validateRegionalTransit(transit, 'different-region', bounds), RegionContentError);
});
test('buildManifest accounts for optional content assets and capability names', () => {
  const artifacts = [
    { path:'package.pmtiles', bytes:127, sha256:'a'.repeat(64), mediaType:'application/vnd.pmtiles' },
    { path:'style.json', bytes:80, sha256:'b'.repeat(64), mediaType:'application/json' },
    { path:'content/wikipedia.json', bytes:400, sha256:'c'.repeat(64), mediaType:'application/json' },
    { path:'content/transit.json', bytes:300, sha256:'d'.repeat(64), mediaType:'application/json' },
  ];
  const m = buildManifest({id:'sample-region',label:'Sample',bounds,minZoom:0,maxZoom:12,artifacts,
    osmDataDate:now,sources:{osm:'OpenStreetMap',attributions:[]},now:new Date(now)});
  assert.equal(m.totalBytes, 907);
  assert.equal(m.wikipediaPack?.path,'content/wikipedia.json');
  assert.equal(m.transitPack?.blob.sha256,'d'.repeat(64));
  assert.ok(m.capabilities.includes('wikipedia') && m.capabilities.includes('transit'));
});
test('regional pipeline packages actual licensed data and sha checksums without network', async () => {
  const input=await mkdtemp(join(tmpdir(),'mm-content-in-'));
  const output=await mkdtemp(join(tmpdir(),'mm-content-out-'));
  try {
    const archive=Buffer.alloc(127); archive.write('PMTiles',0,'ascii');archive[7]=3;
    for(let i=8;i<72;i+=16){archive.writeBigUInt64LE(127n,i);archive.writeBigUInt64LE(0n,i+8);}
    await writeFile(join(input,'basemap.pmtiles'),archive);
    await writeFile(join(input,'style.json'),JSON.stringify({version:8,glyphs:'glyphs/{fontstack}/{range}.pbf',sprite:'sprites/sprite',sources:{base:{type:'vector',url:'pmtiles://package.pmtiles'}},layers:[]}));
    await writeFile(join(input,'region.json'),JSON.stringify({id:'sample-region',label:'Sample',bounds,osmDataDate:now,minZoom:0,maxZoom:12}));
    await writeFile(join(input,'wikipedia.json'),JSON.stringify(wiki));
    await writeFile(join(input,'transit.json'),JSON.stringify(transit));
    const result=await runPipeline({input,output,now:new Date(now)});
    assert.ok(result.manifest.capabilities.includes('wikipedia'));
    for (const ref of [result.manifest.wikipediaPack,result.manifest.transitPack]) {
      const raw=await readFile(join(output,ref.path));
      assert.equal(raw.byteLength,ref.blob.bytes);
      assert.equal(hash(raw),ref.blob.sha256);
    }
    assert.equal(result.manifest.totalBytes,result.artifacts.filter(x=>x.path!=='manifest.json').reduce((sum,a)=>sum+a.bytes,0));
  } finally {await rm(input,{recursive:true,force:true});await rm(output,{recursive:true,force:true});}
});
test('pipeline refuses unlicensed content and does not advertise capability', async () => {
  const input=await mkdtemp(join(tmpdir(),'mm-content-bad-'));
  const output=await mkdtemp(join(tmpdir(),'mm-content-out-'));
  try {
    const archive=Buffer.alloc(127);archive.write('PMTiles',0,'ascii');archive[7]=3;
    for(let i=8;i<72;i+=16){archive.writeBigUInt64LE(127n,i);archive.writeBigUInt64LE(0n,i+8);}
    await writeFile(join(input,'basemap.pmtiles'),archive);
    await writeFile(join(input,'style.json'),JSON.stringify({version:8,sources:{base:{type:'vector',url:'pmtiles://package.pmtiles'}}}));
    await writeFile(join(input,'region.json'),JSON.stringify({id:'sample-region',label:'Sample',bounds,osmDataDate:now,minZoom:0,maxZoom:12}));
    await writeFile(join(input,'wikipedia.json'),JSON.stringify({...wiki,license:''}));
    await assert.rejects(runPipeline({input,output}),/licença/i);
  } finally {await rm(input,{recursive:true,force:true});await rm(output,{recursive:true,force:true});}
});
