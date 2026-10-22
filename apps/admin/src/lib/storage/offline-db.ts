/**
 * IndexedDB storage for local records. Writes resolve after transaction commit.
 */

const DB_NAME = 'GeoNexoLocalEngineDB';
const DB_VERSION = 1;

export interface LocalRecord {
  id: string;
  collection: 'layers' | 'datasets' | 'telemetry' | 'preferences' | 'permissions';
  payload: unknown;
  updatedAt: string;
}

class OfflineLocalDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private init(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('store')) {
          const store = db.createObjectStore('store', { keyPath: 'id' });
          store.createIndex('collection', 'collection', { unique: false });
        }
      };

      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          this.dbPromise = null;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        this.dbPromise = null;
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  async save(collection: LocalRecord['collection'], id: string, payload: unknown): Promise<void> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('store', 'readwrite');
      const store = tx.objectStore('store');
      const record: LocalRecord = {
        id: `${collection}:${id}`,
        collection,
        payload,
        updatedAt: new Date().toISOString(),
      };
      const req = store.put(record);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new Error('A gravação local foi abortada.'));
      tx.onerror = () => reject(tx.error ?? new Error('Não foi possível gravar os dados locais.'));
      req.onerror = () => reject(req.error);
    });
  }

  async get(collection: LocalRecord['collection'], id: string): Promise<unknown | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const req = store.get(`${collection}:${id}`);
      req.onsuccess = () => resolve(req.result ? req.result.payload : null);
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error ?? new Error('A leitura local foi abortada.'));
    });
  }

  async getAll(collection: LocalRecord['collection']): Promise<unknown[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const index = store.index('collection');
      const req = index.getAll(collection);
      req.onsuccess = () => resolve(req.result.map((r: LocalRecord) => r.payload));
      req.onerror = () => reject(req.error);
      tx.onabort = () => reject(tx.error ?? new Error('A leitura local foi abortada.'));
    });
  }
}

export const offlineDB = new OfflineLocalDB();
