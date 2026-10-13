import { describe, expect, it } from 'vitest';
import { buildLocalMapSearchRecords } from './local-map-search';

describe('offline indexed feature search', () => {
  it('indexes existing local geometries without network access', () => {
    const list = buildLocalMapSearchRecords([
      {id:'a',geometry:{type:'Point',coordinates:[-48.2,-7.2]},properties:{name:'Pico'}},
      {id:'b',geometry:{type:'LineString',coordinates:[[-48.1,-7.1],[-48.3,-7.3]]},properties:{title:'Trilha do Centro'}},
      {id:'c',geometry:{type:'Point',coordinates:[999,999]},properties:{name:'Invalido'}},
    ]);
    expect(list).toHaveLength(2);
    expect(list[0]?.name).toBe('Pico');
    expect(list[1]?.lon).toBe(-48.1);
    expect(list[1]?.normalized).toBe('trilha do centro');
  });
});
