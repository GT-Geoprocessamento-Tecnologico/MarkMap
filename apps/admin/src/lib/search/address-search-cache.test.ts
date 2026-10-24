import { describe, expect, it, vi } from 'vitest';
import { MemoryLocalDb } from '../local-db/memory';
import { requestValue } from '../local-db';
import { ADDRESS_CACHE_KEY, ADDRESS_CACHE_LIMIT, ADDRESS_CACHE_TTL, AddressSearchCache } from './address-search-cache';
import type { AddressResult } from './address-geocoder';

const endpoint = '/api/address-search';
const place = { id: 'cep:01311000', label: 'Avenida Paulista, São Paulo — 01311-000', lon: -46.63611, lat: -23.5475,
  source: 'BrasilAPI', attribution: 'BrasilAPI', postalCode: '01311000' };

describe('persistent offline address search', () => {
  it('reuses a formatted CEP after recreating the cache, without changing coordinates or metadata', async () => {
    const db = new MemoryLocalDb();
    await new AddressSearchCache(db).write('01311-000', endpoint, [place]);
    expect(await new AddressSearchCache(db).read('01311000', endpoint)).toEqual([place]);
  });

  it('finds saved places by another local label or exact CEP query', async () => {
    const db = new MemoryLocalDb();
    await new AddressSearchCache(db).write('Avenida Paulista, São Paulo', endpoint, [place]);
    const reopened = new AddressSearchCache(db);
    expect(await reopened.read('Paulista', endpoint)).toEqual([place]);
    expect(await reopened.read('01311-000', endpoint)).toEqual([place]);
    expect(await reopened.read('01311001', endpoint)).toBeNull();
  });

  it('expires entries at 90 days and keeps data before that boundary', async () => {
    const db = new MemoryLocalDb();
    let time = 100;
    const cache = new AddressSearchCache(db, () => time);
    await cache.write('01311000', endpoint, [place]);
    time += ADDRESS_CACHE_TTL - 1;
    expect(await cache.read('01311000', endpoint)).toEqual([place]);
    time++;
    expect(await cache.read('01311000', endpoint)).toBeNull();
  });

  it('does not persist empty, malformed or missing coordinates', async () => {
    const db = new MemoryLocalDb();
    const cache = new AddressSearchCache(db);
    await cache.write('01311000', endpoint, []);
    await cache.write('01311000', endpoint, [{ ...place, lat: null } as unknown as AddressResult]);
    expect(await cache.read('01311000', endpoint)).toBeNull();
    const row = await db.transact(['meta'], 'readonly', tx => requestValue(tx.store('meta').get(ADDRESS_CACHE_KEY)));
    expect(row).toBeUndefined();
  });

  it('keeps a session fallback when the persistent store rejects quota or read access', async () => {
    const db = new MemoryLocalDb();
    db.quotaBytes = 0;
    const cache = new AddressSearchCache(db);
    await cache.write('01311000', endpoint, [place]);
    db.failNextTransaction = true;
    expect(await cache.read('01311000', endpoint)).toEqual([place]);
  });

  it('evicts the oldest query beyond 200 and keeps another device setting', async () => {
    const db = new MemoryLocalDb();
    await db.transact(['meta'], 'readwrite', tx => tx.store('meta').put({ key: 'unrelated-setting', value: 'preserved' }));
    let time = 1;
    const cache = new AddressSearchCache(db, () => time++);
    for (let index = 0; index <= ADDRESS_CACHE_LIMIT; index++)
      await cache.write(`rua única ${index}`, endpoint, [{ ...place, id: `p${index}`, label: `Resultado exclusivo ${index}` }]);
    const row = await db.transact(['meta'], 'readonly', tx => requestValue(tx.store('meta').get(ADDRESS_CACHE_KEY)));
    expect(row.value.entries).toHaveLength(ADDRESS_CACHE_LIMIT);
    expect(row.value.entries.some((entry: {key: string}) => entry.key.endsWith(':rua unica 0'))).toBe(false);
    const unrelated = await db.transact(['meta'], 'readonly', tx => requestValue(tx.store('meta').get('unrelated-setting')));
    expect(unrelated.value).toBe('preserved');
  });

  it('does not leak results across provider endpoints or through mutable result arrays', async () => {
    const db = new MemoryLocalDb();
    const cache = new AddressSearchCache(db);
    await cache.write('01311000', endpoint, [place]);
    expect(await cache.read('01311000', '/api/other-provider')).toBeNull();
    const results = await cache.read('01311000', endpoint);
    results![0]!.lat = 42;
    expect((await cache.read('01311000', endpoint))![0]!.lat).toBe(place.lat);
  });

  it('rejects incompatible persisted cache versions and unsafe endpoints', async () => {
    const db = new MemoryLocalDb();
    await db.transact(['meta'], 'readwrite', tx => tx.store('meta').put({ key: ADDRESS_CACHE_KEY, value: { version: 2, entries: [] } }));
    const cache = new AddressSearchCache(db);
    expect(await cache.read('01311000', endpoint)).toBeNull();
    await cache.write('01311000', 'https://other.example/api/', [place]);
    expect(await cache.read('01311000', 'https://other.example/api/')).toBeNull();
  });

  it('recovers persistence after a storage operation never settles', async () => {
    vi.useFakeTimers();
    try {
      const db = new MemoryLocalDb();
      let stalled = true;
      const recovering = { transact: ((...args: Parameters<typeof db.transact>) => {
        if (stalled) { stalled = false; return new Promise(() => undefined); }
        return db.transact(...args);
      }) as typeof db.transact };
      const cache = new AddressSearchCache(recovering);
      const first = cache.write('01311000', endpoint, [place]);
      await vi.advanceTimersByTimeAsync(501);
      await first;
      const second = cache.write('Rua recuperada', endpoint, [place]);
      await vi.advanceTimersByTimeAsync(501);
      await second;
      const row = await db.transact(['meta'], 'readonly', tx => requestValue(tx.store('meta').get(ADDRESS_CACHE_KEY)));
      expect(row?.value.entries.some((entry: {key: string}) => entry.key.endsWith(':rua recuperada'))).toBe(true);
    } finally { vi.useRealTimers(); }
  });
});
