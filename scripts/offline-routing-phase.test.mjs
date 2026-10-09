import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { validateRegionalGraph } from '../packages/maps/src/routing/graph-format.mjs';
import { validateRegionalContours } from '../packages/maps/src/elevation/contour-package.mjs';
import { runPipeline, buildManifest } from './region-pipeline.mjs';
const graph = {
  version:'v1',bounds:[-49,-25,-45,-21],osmDataDate:'2026-10-08T00:00:00.000Z',profiles:['walk','car'],turnRestrictions:[],
  nodes:[{id:0,lon:-46.6,lat:-23.5},{id:1,lon:-46.59,lat:-23.5}],
  edges:[{id:0,from:0,to:1,distance:1100,speedKph:40,highwayType:'residential',oneway:false,access:{},bridges:false,tunnels:false}],
};
const contours={interval:20,majorInterval:100,contours:[{elevation:100,geometry:[[-46.6,-23.5],[-46.59,-23.5]]}]};
test('valid region data',()=>{assert.equal(validateRegionalGraph(graph).nodes.length,2);assert.equal(validateRegionalContours(contours,graph.bounds).contours.length,1)});
test('rejects duplicate nodes',()=>assert.throws(()=>validateRegionalGraph({...graph,nodes:[...graph.nodes,graph.nodes[0]]})));
test('rejects nonexistent edge target',()=>assert.throws(()=>validateRegionalGraph({...graph,edges:[{...graph.edges[0],to:55}]})));
test('rejects profiles duplicate',()=>assert.throws(()=>validateRegionalGraph({...graph,profiles:['walk','walk']})));
test('rejects missing bridge/tunnel flags',()=>assert.throws(()=>validateRegionalGraph({...graph,edges:[{...graph.edges[0],bridges:undefined}]})));
test('rejects date mismatch',()=>assert.throws(()=>validateRegionalGraph(graph,{osmDataDate:'2026-10-09T00:00:00.000Z'})));
test('rejects wrong bounds',()=>assert.throws(()=>validateRegionalGraph(graph,{bounds:[-50,-25,-45,-21]})));
test('rejects bad contour coordinates',()=>assert.throws(()=>validateRegionalContours({...contours,contours:[{elevation:10,geometry:[[0,0],[1,1]]}]},graph.bounds)));
test('pipeline packs graph and contours with exact digest and profile flags',async()=>{
  const base=await mkdtemp(join(tmpdir(),'mm-route-'));
  const input=join(base,'in'),output=join(base,'out');
  try {
    await mkdir(input);
    const pm=Buffer.alloc(127);pm.write('PMTiles',0,'ascii');pm[7]=3;
    for(let i=8;i<72;i+=16){pm.writeBigUInt64LE(127n,i);pm.writeBigUInt64LE(0n,i+8)}
    await writeFile(join(input,'basemap.pmtiles'),pm);
    await writeFile(join(input,'style.json'),JSON.stringify({version:8,glyphs:'glyphs/{fontstack}/{range}.pbf',sprite:'sprites/sprite',sources:{base:{type:'vector',url:'pmtiles://package.pmtiles'}},layers:[]}));
    await writeFile(join(input,'region.json'),JSON.stringify({id:'test',label:'Test',bounds:graph.bounds,osmDataDate:graph.osmDataDate}));
    await writeFile(join(input,'graph.json'),JSON.stringify(graph));
    await writeFile(join(input,'contours.json'),JSON.stringify(contours));
    const {manifest,artifacts}=await runPipeline({input,output});
    assert.deepEqual(manifest.capabilities,['basemap','routing.walk','routing.car','contours']);
    assert.equal(manifest.routingGraph.path,'routing/graph.json');
    assert.equal(manifest.optionalComponents.routing.bicycle,false);
    assert.equal(manifest.contourLines.path,'elevation/contours.json');
    const files=await Promise.all([manifest.routingGraph,manifest.contourLines].map(async ref=>{
      const bytes=await readFile(join(output,ref.path));
      assert.equal(createHash('sha256').update(bytes).digest('hex'),ref.blob.sha256);
      return bytes.length;
    }));
    assert.equal(manifest.totalBytes,artifacts.filter(a=>a.path!=='manifest.json').reduce((n,a)=>n+a.bytes,0));
    assert.ok(files[0]>0 && files[1]>0);
  } finally {await rm(base,{recursive:true,force:true})}
});
