import { describe, expect, it } from 'vitest';
import { WikipediaStore, sanitizeWikipediaHtml } from '../../src/content/wikipedia.js';
import { TransitStore } from '../../src/content/transit.js';
import { validateRegionalWikipedia, validateRegionalTransit } from '../../src/content/region-content.mjs';

const date = '2026-10-09T12:00:00.000Z';
const wikipedia = { regionId: 'city', version: '1', generatedAt: date, attribution: 'Editors', license: 'CC BY-SA 4.0',
  articles: [{ id: 'w1', title: 'História', summary: 'Conteúdo', language: 'pt-BR',
    osmId: 'node/1', wikidataId: 'Q1', attribution: 'Editors', license: 'CC BY-SA 4.0' }] };
const transit = { regionId: 'city', version: '1', generatedAt: date, attribution: 'Agency', license: 'Open data',
  stations: [{ id: 's1', name: 'Estação', lon: -47.5, lat: -15.5, lines: ['l1'] }],
  lines: [{ id: 'l1', name: 'Linha', color: '#ff0011', mode: 'metro' as const, stationIds: ['s1'] }] };

describe('licensed offline content hardening', () => {
  it('rejects invalid URLs and stale regional references', () => {
    expect(validateRegionalWikipedia(wikipedia, 'city').articles).toHaveLength(1);
    expect(() => validateRegionalWikipedia({ ...wikipedia, articles: [{ ...wikipedia.articles[0], url: 'javascript:alert(1)' }] }, 'city')).toThrow();
    expect(() => validateRegionalTransit({ ...transit, stations: [{ ...transit.stations[0], lat: 30 }] }, 'city', [-48, -16, -47, -15])).toThrow();
  });
  it('escapes attributes and active HTML while retaining basic formatting', () => {
    const html = sanitizeWikipediaHtml('<script>alert(1)</script><b onclick=alert(2)>Seguro</b><a href="javascript:alert(3)">link</a><img src=x onerror=alert(4)>');
    expect(html).toContain('<b>Seguro</b>');
    expect(html).not.toMatch(/script|onclick|onerror|javascript:|<img|<a/i);
  });
  it('replaces, rather than accumulates, local article and station indices', () => {
    const wiki = new WikipediaStore();
    wiki.load(validateRegionalWikipedia(wikipedia, 'city').articles);
    expect(wiki.getByOsmId('node/1')?.title).toBe('História');
    wiki.load([]);
    expect(wiki.getByOsmId('node/1')).toBeUndefined();
    const stations = new TransitStore();
    stations.load(validateRegionalTransit(transit, 'city', [-48, -16, -47, -15]));
    expect(stations.stationCount).toBe(1);
    stations.load({ ...transit, stations: [], lines: [] });
    expect(stations.stationCount).toBe(0);
    expect(stations.searchStations('')).toEqual([]);
  });
});
