import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  decodeTerrariumPixel,
  getCachedTerrainGrid,
  getTerrainPoint,
  type TerrainBounds,
} from './terrain-client';

const bounds: TerrainBounds = [-48.3, -7.3, -48.1, -7.1];

describe('terrain-client', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('decodes Terrarium RGB with fractional meters and treats transparent pixels as no-data', () => {
    expect(decodeTerrariumPixel(128, 254, 0)).toBe(254);
    expect(decodeTerrariumPixel(128, 254, 128)).toBe(254.5);
    expect(decodeTerrariumPixel(0, 0, 0, 0)).toBeNull();
    expect(() => decodeTerrariumPixel(256, 0, 0)).toThrow();
  });

  it('rejects invalid points before making a network request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getTerrainPoint(181, -7)).rejects.toThrow(/Coordenada/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an oversized PNG response before image decoding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {
      status: 200,
      headers: { 'content-length': String(512 * 1024 + 1) },
    })));
    await expect(getTerrainPoint(-48.2, -7.2)).rejects.toThrow(/excede o limite/);
  });

  it('rejects a cache entry whose body checksum does not match', async () => {
    const response = new Response('{"schemaVersion":1}', {
      headers: { 'x-markmap-sha256': 'deadbeef' },
    });
    const match = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match }) });
    await expect(getCachedTerrainGrid('araguaina', bounds)).resolves.toBeNull();
    expect(match).toHaveBeenCalledOnce();
  });

  it('reads a valid cached grid and rejects a bounds identity mismatch', async () => {
    const grid = {
      schemaVersion: 1 as const,
      regionId: 'araguaina',
      metadata: {
        bounds, width: 2, height: 2, noDataValue: -32768, resolutionMeters: 20,
        attribution: 'Terrain Tiles', license: 'Open data', sourceUrl: 'https://example.test/source',
        verticalDatum: 'composite', source: 'aws-terrain-tiles' as const, sourceVersion: 'mapzen-terrain-tiles-v1', tileZoom: 8,
      },
      values: [240, 241, 242, 243],
    };
    const body = JSON.stringify(grid);
    const bytes = new TextEncoder().encode(body);
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((value) => value.toString(16).padStart(2, '0')).join('');
    const match = vi.fn().mockResolvedValue(new Response(body, { headers: { 'x-markmap-sha256': hash } }));
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match }) });
    await expect(getCachedTerrainGrid('araguaina', bounds)).resolves.toEqual(grid);
    await expect(getCachedTerrainGrid('araguaina', [-48.4, -7.3, -48.1, -7.1])).resolves.toBeNull();
  });

  it('returns null when the Cache API is unavailable', async () => {
    vi.stubGlobal('caches', undefined);
    await expect(getCachedTerrainGrid('araguaina', bounds)).resolves.toBeNull();
  });
});
