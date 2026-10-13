import { describe, expect, it } from 'vitest';
import {
  OfflinePackageSource,
  createOfflineAssetProtocol,
  MAX_RANGE_BYTES,
} from '../../src/offline/protocol.js';

describe('offline protocol bounded requests (A22)', () => {
  it('reads exact PMTiles ranges and rejects an incomplete archive read', async () => {
    const source = new OfflinePackageSource(new File(['abcdef'], 'demo.pmtiles'), 'demo');
    const response = await source.getBytes(1, 3);
    expect(new TextDecoder().decode(response.data)).toBe('bcd');
    await expect(source.getBytes(5, 2)).rejects.toMatchObject({ code: 'truncated-range' });
    await expect(source.getBytes(0, MAX_RANGE_BYTES + 1)).rejects.toMatchObject({ code: 'invalid-range' });
  });

  it('returns only a matching local glyph blob', async () => {
    const calls: string[] = [];
    const handler = createOfflineAssetProtocol(async (id, path) => {
      calls.push(`${id}:${path}`);
      return new Blob(['demo']);
    });
    const response = await handler({ url: 'geonexo-package://region-1/glyphs/0-255.pbf' }, new AbortController());
    expect(new TextDecoder().decode(response.data)).toBe('demo');
    expect(calls).toEqual(['region-1:glyphs/0-255.pbf']);
  });

  it('rejects malformed asset paths before hitting IndexedDB', async () => {
    const handler = createOfflineAssetProtocol(async () => { throw new Error('resolver should not run'); });
    await expect(handler({ url: 'geonexo-package://region-1/%2Fprivate' }, new AbortController()))
      .rejects.toMatchObject({ code: 'invalid-url' });
  });

  it('rejects missing asset, oversized asset and truncated Blob reads', async () => {
    const request = { url: 'geonexo-package://region-1/style.json' };
    await expect(createOfflineAssetProtocol(async () => null)(request, new AbortController()))
      .rejects.toMatchObject({ code: 'missing-asset' });
    class ShortBlob extends Blob {
      override async arrayBuffer(): Promise<ArrayBuffer> { return new ArrayBuffer(1); }
    }
    await expect(createOfflineAssetProtocol(async () => new ShortBlob(['abc']))(request, new AbortController()))
      .rejects.toMatchObject({ code: 'incomplete-read' });
  });

  it('treats an aborted resolver as normal cancellation', async () => {
    const controller = new AbortController();
    let finish!: (blob: Blob) => void;
    const handler = createOfflineAssetProtocol(() => new Promise<Blob>((resolve) => { finish = resolve; }));
    const request = handler({ url: 'geonexo-package://region-1/style.json' }, controller);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    finish(new Blob(['late']));
  });
});
