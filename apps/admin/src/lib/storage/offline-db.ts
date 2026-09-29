/**
 * GeoNexo Offline Local Engine (SQLite / IndexedDB Local Storage)
 * 
 * Motor de banco de dados local que armazena dados espacialmente no próprio
 * dispositivo do usuário para garantir funcionamento 100% offline e sem perdas.
 */

const DB_NAME = 'GeoNexoLocalEngineDB';
const DB_VERSION = 1;

export interface LocalRecord {
  id: string;
  collection: 'layers' | 'datasets' | 'telemetry' | 'preferences' | 'permissions';
  payload: any;
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

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async save(collection: LocalRecord['collection'], id: string, payload: any): Promise<void> {
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
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async get(collection: LocalRecord['collection'], id: string): Promise<any | null> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const req = store.get(`${collection}:${id}`);
      req.onsuccess = () => resolve(req.result ? req.result.payload : null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAll(collection: LocalRecord['collection']): Promise<any[]> {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('store', 'readonly');
      const store = tx.objectStore('store');
      const index = store.index('collection');
      const req = index.getAll(collection);
      req.onsuccess = () => resolve(req.result.map((r: LocalRecord) => r.payload));
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineDB = new OfflineLocalDB();
