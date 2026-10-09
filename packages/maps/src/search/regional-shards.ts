import { getPipelineShardId, normalizeName, type SearchRecord } from './index.js';

export const MAX_REGIONAL_SEARCH_RECORDS = 25_000;
export const MAX_REGIONAL_SHARD_BYTES = 2 * 1024 * 1024;
export const MAX_REGIONAL_SEARCH_BYTES = 12 * 1024 * 1024;

export interface RegionalShardData { id: string; records: SearchRecord[]; }

/** Validates installed OSM search data before it becomes visible to the worker. */
export function parseRegionalShard(payload: unknown, expectedPath: string): RegionalShardData {
  const expectedId = /^search\/([a-z][0-3]|0-9|other)\.json$/.exec(expectedPath)?.[1];
  if (!expectedId) throw new Error('Caminho do índice regional inválido');
  if (!payload || typeof payload !== 'object') throw new Error('Índice regional inválido');
  const source = payload as { id?: unknown; records?: unknown };
  if (source.id !== expectedId || !Array.isArray(source.records) ||
      source.records.length > MAX_REGIONAL_SEARCH_RECORDS) throw new Error('Índice regional inconsistente');
  const seen = new Set<string>();
  const records: SearchRecord[] = [];
  for (const raw of source.records) {
    if (!raw || typeof raw !== 'object') throw new Error('Registro regional inválido');
    const record = raw as Record<string, unknown>;
    if (typeof record.id !== 'string' || record.id.length < 1 || record.id.length > 160 ||
        typeof record.name !== 'string' || record.name.length < 1 || record.name.length > 200 ||
        typeof record.normalized !== 'string' ||
        typeof record.type !== 'string' || record.type.length > 60 ||
        typeof record.category !== 'string' || record.category.length > 60 ||
        (record.description !== undefined && (typeof record.description !== 'string' || record.description.length > 500)) ||
        typeof record.lon !== 'number' || record.lon < -180 || record.lon > 180 ||
        typeof record.lat !== 'number' || record.lat < -90 || record.lat > 90 ||
        !Number.isFinite(record.lon) || !Number.isFinite(record.lat) ||
        record.normalized !== normalizeName(record.name) ||
        getPipelineShardId(record.normalized) !== expectedId || seen.has(record.id)) {
      throw new Error('Registro regional inválido ou duplicado');
    }
    seen.add(record.id);
    records.push(record as unknown as SearchRecord);
  }
  return { id: expectedId, records };
}
