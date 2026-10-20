import { afterEach, expect, it, vi } from 'vitest';
import { downloadBlob } from './file-download';

afterEach(() => vi.restoreAllMocks());

it('releases the Blob URL and detached link if the browser rejects starting a download', () => {
  const anchor = document.createElement('a');
  vi.spyOn(document, 'createElement').mockReturnValue(anchor);
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:rejected-download');
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  vi.spyOn(anchor, 'click').mockImplementation(() => { throw new Error('Download indisponível.'); });

  expect(() => downloadBlob(new Blob(['test']), 'teste.kml')).toThrow('Download indisponível.');
  expect(anchor.isConnected).toBe(false);
  expect(revoke).toHaveBeenCalledWith('blob:rejected-download');
});
