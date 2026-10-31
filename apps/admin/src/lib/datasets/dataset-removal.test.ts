import { beforeEach, describe, expect, it, vi } from 'vitest';
import { removeDataset, saveDataset, getDataset, listDatasets } from './dataset-store';
import { offlineDB } from '../storage/offline-db';

vi.mock('../storage/offline-db', () => ({
  offlineDB: { get: vi.fn(), getAll: vi.fn(), save: vi.fn(), delete: vi.fn() },
}));
vi.mock('../storage/import-catalog-events.mjs', () => ({
  notifyImportCatalogChanged: vi.fn(),
}));

describe('exclusao de dataset no armazenamento offline', () => {
  const data = new Map<string, unknown>();
  beforeEach(() => {
    data.clear();
    vi.mocked(offlineDB.get).mockImplementation(async (_, id) => data.get(id) ?? null);
    vi.mocked(offlineDB.getAll).mockImplementation(async () => [...data.values()]);
    vi.mocked(offlineDB.save).mockImplementation(async (_, id, record) => { data.set(id, record); });
    vi.mocked(offlineDB.delete).mockImplementation(async (_, id) => { data.delete(id); });
  });

  it('remove dados, geometria e bytes em vez de manter deleted: true', async () => {
    const record = { id: 'record-1', name: 'trilha.geojson', format: 'GeoJSON' as const,
      sizeBytes: 6, featuresCount: 0, uploadedAt: new Date().toISOString(),
      crs: 'EPSG:4326', originalBlob: new Blob(['dados!']),
      geojson: { type: 'FeatureCollection' as const, features: [] } };
    await saveDataset(record);
    expect(data.get(record.id)).toMatchObject({ originalBytes: expect.any(ArrayBuffer) });
    expect(await listDatasets()).toHaveLength(1);
    await removeDataset(record.id);
    expect(data.has(record.id)).toBe(false);
    expect(await getDataset(record.id)).toBeNull();
    await removeDataset(record.id);
    expect(offlineDB.delete).toHaveBeenCalledTimes(1);
  });
});
