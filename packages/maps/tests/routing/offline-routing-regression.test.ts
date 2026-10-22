import { describe, expect, it } from 'vitest';
import { findRoute, buildAdjacencyList } from '../../src/routing/router.js';
import type { RoutingGraph } from '@geonexo/contracts';

const graph: RoutingGraph = {
  version:'v1', nodes:[
    {id:0,lon:0,lat:0},{id:1,lon:0.01,lat:0},{id:2,lon:0.01,lat:0.01},
  ], edges:[
    {id:0,from:0,to:1,distance:1000,speedKph:50,name:'Rua A',highwayType:'residential',oneway:true,access:{},bridges:false,tunnels:false},
    {id:1,from:1,to:2,distance:1000,speedKph:50,name:'Rua B',highwayType:'residential',oneway:false,access:{},bridges:false,tunnels:false},
  ], turnRestrictions:[], bounds:[0,0,0.01,0.01],osmDataDate:'2026-10-09T00:00:00Z',profiles:['walk','bicycle','car'],
};
const request = (origin:[number,number],destination:[number,number],profile:'walk'|'bicycle'|'car') => ({origin,destination,profile});
describe('offline route correctness before graph integration',()=>{
  it('allows the legal forward side of a one-way street for car, never the reverse',()=>{
    expect(buildAdjacencyList(graph,'car').get(0)?.length).toBe(1);
    expect(findRoute(graph,request([0,0],[0.01,0],'car'))?.distance).toBe(1000);
    expect(findRoute(graph,request([0.01,0],[0,0],'car'))).toBeNull();
    expect(findRoute(graph,request([0.01,0],[0,0],'walk'))?.distance).toBe(1000);
  });
  it('calculates duration in seconds and preserves snapped positions',()=>{
    const result=findRoute(graph,request([0,0],[0.01,0],'car'))!;
    expect(result.duration).toBeCloseTo(72,4);
    expect(result.geometry).toEqual([[0,0],[0.01,0]]);
    expect(result.steps.at(-1)?.maneuver.type).toBe('arrive');
  });
  it('computes turn using real coordinates',()=>{
    const result=findRoute(graph,request([0,0],[0.01,0.01],'walk'))!;
    expect(result.steps[1]?.maneuver.type).toBe('turn_left');
    expect(result.distance).toBe(2000);
  });
  it('rejects empty graph',()=>{
    expect(findRoute({...graph,nodes:[],edges:[]},request([0,0],[1,1],'walk'))).toBeNull();
  });
});
