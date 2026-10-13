import { describe, expect, it } from 'vitest';
import { buildSearchShards, getShardId as builderShardId, normalizeName as builderNormalize } from '../../../../scripts/region-pipeline.mjs';
import { getPipelineShardId, normalizeName, searchIndex, searchRegionalShards } from '../../src/search/index.js';

describe('regional offline search parity', () => {
  const places = [
    { id:'one', name:'Rua Augusta', type:'way', category:'highway', lon:-46.65, lat:-23.55 },
    { id:'two', name:'Praça da Sé', type:'node', category:'place', lon:-46.63, lat:-23.55 },
  ];
  it('agrees with the region builder on shard IDs', () => {
    for (const p of places) expect(getPipelineShardId(normalizeName(p.name))).toBe(builderShardId(builderNormalize(p.name)));
  });
  it('finds names by internal word without requiring fuzzy search', () => {
    const records = buildSearchShards(places).flatMap((s) => s.records);
    expect(searchIndex(records, { query:'augusta' }).results[0]?.id).toBe('one');
    expect(searchIndex(records, { query:'sé' }).results[0]?.id).toBe('two');
  });
  it('reads builder output and skips mismatched or duplicate shard records', () => {
    const shards = buildSearchShards(places);
    const response = searchRegionalShards(shards, { query: 'praça' });
    expect(response.results).toHaveLength(1);
    expect(response.results[0]?.id).toBe('two');
    expect(searchRegionalShards([{id:'other',records:shards[0]?.records ?? []}],{query:'rua'}).results).toHaveLength(0);
  });
  it('does not treat empty query as match-all and clamps excessive result limits', () => {
    const records = buildSearchShards(places).flatMap((s)=>s.records);
    expect(searchIndex(records,{query:''}).total).toBe(0);
    expect(searchIndex(records,{query:'rua',limit:10_000}).results.length).toBeLessThanOrEqual(50);
  });
});
