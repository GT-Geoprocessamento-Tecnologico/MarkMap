import { describe, expect, it } from 'vitest';
import { parseRegionalShard } from '../../src/search/regional-shards.js';

const valid = { id: 'r1', records: [{id:'osm:way:1',name:'Rua Augusta',normalized:'rua augusta',type:'street',category:'highway',lon:-46.65,lat:-23.55}] };
describe('regional search shards safety', () => {
  it('accepts a properly named and normalized regional shard', () => {
    expect(parseRegionalShard(valid, 'search/r1.json').records[0]?.name).toBe('Rua Augusta');
  });
  it('accepts normalized CEP metadata and rejects malformed optional lists', () => {
    const withCep = { id: 'r1', records: [{ ...valid.records[0], postalCodes: ['77800000'] }] };
    expect(parseRegionalShard(withCep, 'search/r1.json').records[0]?.postalCodes).toEqual(['77800000']);
    expect(() => parseRegionalShard({ ...withCep, records: [{ ...withCep.records[0], postalCodes: ['77800-000'] }] }, 'search/r1.json')).toThrow();
    expect(() => parseRegionalShard({ ...withCep, records: [{ ...withCep.records[0], postalCodes: Array.from({ length: 17 }, () => '77800000') }] }, 'search/r1.json')).toThrow();
  });
  it('rejects mismatch, traversal, out-of-bounds and inconsistent search name', () => {
    expect(() => parseRegionalShard(valid, 'search/r0.json')).toThrow();
    expect(() => parseRegionalShard(valid, 'search/../r1.json')).toThrow();
    expect(() => parseRegionalShard({...valid, records:[{...valid.records[0], lat:999}]}, 'search/r1.json')).toThrow();
    expect(() => parseRegionalShard({...valid, records:[{...valid.records[0], normalized:'not-a-street'}]}, 'search/r1.json')).toThrow();
  });
  it('rejects duplicated item identifiers', () => {
    expect(() => parseRegionalShard({...valid, records:[valid.records[0], valid.records[0]]}, 'search/r1.json')).toThrow();
  });
});
