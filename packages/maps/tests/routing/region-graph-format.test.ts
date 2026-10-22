import { describe, expect, it } from 'vitest';
import { validateRegionalGraph } from '../../src/routing/graph-format.mjs';
import { validateRegionalContours, contoursToGeoJSON } from '../../src/elevation/contour-package.mjs';
import { findRoute } from '../../src/routing/router.js';
import type { RoutingGraph } from '@markmap/contracts';

const graph: RoutingGraph = {
  version: 'v1', bounds: [-1, -1, 1, 1], osmDataDate: '2026-10-08T00:00:00.000Z',
  profiles: ['walk','car'], turnRestrictions: [{ fromEdge: 0, viaNode: 1, toEdge: 1, type: 'no_left_turn' }],
  nodes: [{ id: 0, lon: 0, lat: 0 }, { id: 1, lon: 0.001, lat: 0 },
    { id: 2, lon: 0.002, lat: 0.001 }, { id: 3, lon: 0.002, lat: 0 }],
  edges: [
    { id: 0, from: 0, to: 1, distance: 110, speedKph: 30, highwayType: 'residential', oneway: false, access: {}, bridges: false, tunnels: false },
    { id: 1, from: 1, to: 2, distance: 160, speedKph: 30, highwayType: 'residential', oneway: false, access: {}, bridges: false, tunnels: false },
    { id: 2, from: 1, to: 3, distance: 110, speedKph: 30, highwayType: 'residential', oneway: false, access: {}, bridges: false, tunnels: false },
    { id: 3, from: 3, to: 2, distance: 110, speedKph: 30, highwayType: 'residential', oneway: false, access: {}, bridges: false, tunnels: false },
  ],
};
const request = (profile: 'walk'|'car') => ({ origin: [0,0] as [number,number], destination: [0.002,0.001] as [number,number], profile });

describe('regional graph protocol and restrictions', () => {
  it('validates a bounded complete graph and profile-specific turns', () => {
    expect(validateRegionalGraph(graph,{ bounds: graph.bounds, osmDataDate:graph.osmDataDate })).toBe(graph);
    expect(findRoute(graph, request('walk'))?.distance).toBe(270);
    expect(findRoute(graph, request('car'))?.distance).toBe(330);
  });
  it('refuses a forbidden turn when no alternative exists', () => {
    const incomplete: RoutingGraph = { ...graph, edges: graph.edges.slice(0,2) };
    expect(findRoute(incomplete,request('car'))).toBeNull();
  });
  it('rejects duplicate ids, broken links, bad profiles, wrong date and bounds', () => {
    expect(() => validateRegionalGraph({ ...graph, nodes: [...graph.nodes, graph.nodes[0]] })).toThrow();
    expect(() => validateRegionalGraph({ ...graph, edges: [{...graph.edges[0], to:99}] })).toThrow();
    expect(() => validateRegionalGraph({ ...graph, profiles: ['walk','walk'] })).toThrow();
    expect(() => validateRegionalGraph(graph, { osmDataDate:'2026-10-09T00:00:00Z' })).toThrow();
    expect(() => validateRegionalGraph(graph, { bounds: [2,2,3,3] })).toThrow();
  });
  it('rejects invalid or excessive contour geometry and converts valid lines', () => {
    const contour = { interval:20, majorInterval:100, contours:[{ elevation:100, geometry:[[0,0],[0.1,0.1]] }] };
    expect(contoursToGeoJSON(validateRegionalContours(contour,graph.bounds)).features).toHaveLength(1);
    expect(() => validateRegionalContours({ ...contour, contours: [{ elevation:100, geometry:[[0,0]] }] },graph.bounds)).toThrow();
    expect(() => validateRegionalContours({ ...contour, contours: [{ elevation:100, geometry:[[0,0],[999,0]] }] },graph.bounds)).toThrow();
  });
});
