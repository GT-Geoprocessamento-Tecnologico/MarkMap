// Desenvolvido por MtsFerreira. Search responses stay on this device, outside sync/outbox.
import { normalizeName, normalizePostalCode, searchIndex } from '@geonexo/maps/search';
import { localDb, requestValue, type LocalDb } from '../local-db';
import type { AddressResult } from './address-geocoder';

export const ADDRESS_CACHE_KEY = 'address-search-cache:v1';
export const ADDRESS_CACHE_LIMIT = 200;
export const ADDRESS_CACHE_TTL = 90 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 1024 * 1024;
const STORAGE_DEADLINE = 500;
type Entry = { key: string; endpoint: string; savedAt: number; results: AddressResult[] };
type Snapshot = { version: 1; entries: Entry[] };

function keyFor(query: string, endpoint: string): string | null {
  if (!/^\/api\/[a-zA-Z0-9/_-]+$/.test(endpoint) || query.trim().length < 3 || query.length > 160) return null;
  const term = normalizePostalCode(query) ?? normalizeName(query);
  return term ? `${endpoint}:${term}` : null;
}

function checkedResults(raw: unknown): AddressResult[] {
  if (!Array.isArray(raw) || raw.length > 5) return [];
  return raw.flatMap((value: unknown) => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    if (typeof item.id !== 'string' || !item.id || item.id.length > 160 ||
        typeof item.label !== 'string' || !item.label.trim() || item.label.length > 220 ||
        typeof item.lat !== 'number' || !Number.isFinite(item.lat) || Math.abs(item.lat) > 90 ||
        typeof item.lon !== 'number' || !Number.isFinite(item.lon) || Math.abs(item.lon) > 180 ||
        (item.source !== undefined && (typeof item.source !== 'string' || item.source.length > 80)) ||
        (item.attribution !== undefined && (typeof item.attribution !== 'string' || item.attribution.length > 240)) ||
        (item.postalCode !== undefined && (typeof item.postalCode !== 'string' || !/^\d{8}$/.test(item.postalCode)))) return [];
    return [{ id: item.id, label: item.label, lat: item.lat, lon: item.lon,
      ...(item.source !== undefined ? { source: item.source } : {}),
      ...(item.attribution !== undefined ? { attribution: item.attribution } : {}),
      ...(item.postalCode !== undefined ? { postalCode: item.postalCode } : {}) } as AddressResult];
  });
}

function entriesFrom(raw: unknown, now: number): Entry[] {
  if (!raw || typeof raw !== 'object') return [];
  const value = raw as Record<string, unknown>;
  if (value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > ADDRESS_CACHE_LIMIT) return [];
  return value.entries.flatMap((rawEntry: unknown) => {
    if (!rawEntry || typeof rawEntry !== 'object') return [];
    const entry = rawEntry as Record<string, unknown>;
    if (typeof entry.key !== 'string' || entry.key.length > 400 ||
        typeof entry.endpoint !== 'string' || !/^\/api\/[a-zA-Z0-9/_-]+$/.test(entry.endpoint) ||
        !entry.key.startsWith(`${entry.endpoint}:`) || typeof entry.savedAt !== 'number' ||
        !Number.isFinite(entry.savedAt) || entry.savedAt > now || now - entry.savedAt >= ADDRESS_CACHE_TTL) return [];
    const results = checkedResults(entry.results);
    return results.length ? [{ key: entry.key, endpoint: entry.endpoint, savedAt: entry.savedAt, results }] : [];
  });
}

function bounded(entries: Entry[]): Entry[] {
  const unique = new Map<string, Entry>();
  for (const entry of entries.sort((a, b) => a.savedAt - b.savedAt)) unique.set(entry.key, entry);
  const result = [...unique.values()].sort((a, b) => b.savedAt - a.savedAt).slice(0, ADDRESS_CACHE_LIMIT);
  while (result.length && new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_BYTES) result.pop();
  return result;
}

async function withDeadline<T>(operation: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation.catch(() => fallback), new Promise<T>(resolve => {
      timer = setTimeout(() => resolve(fallback), STORAGE_DEADLINE);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}

export class AddressSearchCache {
  private memory: Entry[] = [];
  private writes: Promise<void> = Promise.resolve();
  constructor(private readonly db: Pick<LocalDb, 'transact'> = localDb, private readonly now = Date.now) {}

  async read(query: string, endpoint: string): Promise<AddressResult[] | null> {
    const key = keyFor(query, endpoint);
    if (!key) return null;
    const now = this.now();
    const saved = await withDeadline(this.db.transact(['meta'], 'readonly', async tx => {
      const row = await requestValue<{ value?: unknown } | undefined>(tx.store('meta').get(ADDRESS_CACHE_KEY));
      return entriesFrom(row?.value, now);
    }), [] as Entry[]);
    this.memory = bounded([...saved, ...entriesFrom({ version: 1, entries: this.memory }, now)]);
    const exact = this.memory.find(entry => entry.key === key);
    if (exact) return checkedResults(exact.results);

    // A saved place remains searchable by its label or CEP, not only its original query.
    const places = new Map<string, AddressResult>();
    for (const entry of this.memory) if (entry.endpoint === endpoint)
      for (const item of entry.results) places.set(`${item.id}:${item.lon}:${item.lat}`, item);
    const records = [...places.entries()].map(([id, item]) => ({ id, name: item.label,
      normalized: normalizeName(item.label), type: 'address', category: 'endereço', lon: item.lon, lat: item.lat,
      ...(item.postalCode ? { postalCodes: [item.postalCode] } : {}) }));
    const matches = searchIndex(records, { query, limit: 5 }).results;
    const results = matches.flatMap(match => places.has(match.id) ? [places.get(match.id)!] : []);
    return results.length ? checkedResults(results) : null;
  }

  async write(query: string, endpoint: string, results: AddressResult[]): Promise<void> {
    const key = keyFor(query, endpoint);
    const checked = checkedResults(results);
    if (!key || !checked.length) return;
    const entry: Entry = { key, endpoint, savedAt: this.now(), results: checked };
    this.memory = bounded([...entriesFrom({ version: 1, entries: this.memory }, this.now()), entry]);
    const operation = this.writes.then(async () => {
      await withDeadline(this.db.transact(['meta'], 'readwrite', async tx => {
        const store = tx.store('meta');
        const row = await requestValue<{ value?: unknown } | undefined>(store.get(ADDRESS_CACHE_KEY));
        const snapshot: Snapshot = { version: 1, entries: bounded([
          ...entriesFrom(row?.value, this.now()),
          ...entriesFrom({ version: 1, entries: this.memory }, this.now()), entry,
        ]) };
        store.put({ key: ADDRESS_CACHE_KEY, value: snapshot });
      }), undefined);
    });
    this.writes = operation.catch(() => undefined);
    await withDeadline(this.writes, undefined);
  }
}

export const addressSearchCache = new AddressSearchCache();
