import { describe, expect, it } from 'vitest';
import { adaptOfflineStyle } from '../../src/offline/style.js';
import { createOfflineProtocol } from '../../src/offline/protocol.js';

const manifest = {
  id: 'region-1', attribution: '© OpenStreetMap contributors',
  minZoom: 0, maxZoom: 14,
} as never;
const sourceStyle = {
  version: 8,
  sources: {
    roads: { type: 'vector', url: 'pmtiles://package.pmtiles' },
  },
  glyphs: 'glyphs/{fontstack}/{range}.pbf',
  sprite: 'sprites/default',
};

describe('A24 protocol ownership URLs', () => {
  it('rewrites all style resources for an isolated view alias', () => {
    const adapted = adaptOfflineStyle(sourceStyle, manifest, 'mkview42');
    expect(adapted).toMatchObject({
      glyphs: 'geonexo-package://mkview42/glyphs/{fontstack}/{range}.pbf',
      sprite: 'geonexo-package://mkview42/sprites/default',
      sources: { roads: { url: 'pmtiles://geonexo-offline:mkview42' } },
    });
    expect(sourceStyle.sources.roads.url).toBe('pmtiles://package.pmtiles');
  });
  it('keeps legacy package ID URLs when no lease ID is supplied', () => {
    const adapted = adaptOfflineStyle(sourceStyle, manifest);
    expect(adapted).toMatchObject({
      glyphs: 'geonexo-package://region-1/glyphs/{fontstack}/{range}.pbf',
      sources: { roads: { url: 'pmtiles://geonexo-offline:region-1' } },
    });
  });
  it('rejects an untrusted alias before rewriting offline sources', () => {
    expect(() => adaptOfflineStyle(sourceStyle, manifest, '../other')).toThrow(/protocol lease identity/);
    expect(() => adaptOfflineStyle(sourceStyle, manifest, 'mk/%2f')).toThrow(/protocol lease identity/);
  });
  it('binds PMTiles source identity to the requested view instead of manifest ID', () => {
    const file = new File([new Uint8Array(127)], 'package.pmtiles');
    const protocol = createOfflineProtocol(manifest, file, 'mkview42');
    // Protocol registration uses PMTiles.getKey() internally; tiles must be
    // looked up by the isolated map-view ID, not by a shared region ID.
    expect(protocol).toBeDefined();
    expect(protocol.get('geonexo-offline:mkview42')).toBeDefined();
    expect(protocol.get('markmap-offline:mkview42')).toBeDefined();
  });
});
