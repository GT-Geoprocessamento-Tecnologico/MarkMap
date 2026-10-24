import { LOCAL_DB_NAME, LOCAL_DB_VERSION } from '../local-db/types';
import { digestHex } from './crypto';
import { readBlobBytes } from '../blob-bytes';

/** T3a is deliberately memory-bounded. T3b will add cross-database streaming. */
export const MAX_LOCAL_FIRST_SNAPSHOT_BYTES = 16 * 1024 * 1024;
export const LOCAL_FIRST_DATA_STORES = ['entities', 'originals', 'outbox', 'conflicts', 'acks'] as const;
export type DataStore = (typeof LOCAL_FIRST_DATA_STORES)[number];

export interface RawLocalFirstSnapshot {
  workspaceId: string;
  /** An absent sequence stays absent; a restore must not invent sync state. */
  outboxSequence: number | null;
  stores: Record<DataStore, unknown[]>;
}

export interface PortableLocalFirstSnapshot {
  schemaVersion: 1;
  database: typeof LOCAL_DB_NAME;
  databaseVersion: typeof LOCAL_DB_VERSION;
  metadata: { workspaceId: string; outboxSequence: number | null };
  stores: Record<DataStore, Record<string, unknown>[]>;
}

export interface SnapshotReader {
  /** One consistent, read-only transaction across all 6 stores. */
  read(): Promise<RawLocalFirstSnapshot>;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function openExistingDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(LOCAL_DB_NAME);
    let settled = false;
    const fail = (cause: Error) => {
      if (settled) return;
      settled = true;
      reject(cause);
    };
    // Opening without a version normally CREATES missing databases. Abort upgrades
    // before creation so inspecting a nonexistent source never mutates storage.
    request.onupgradeneeded = () => {
      try { request.transaction?.abort(); } catch { /* source stays untouched */ }
      fail(new Error('Banco de trabalho inexistente; exportacao nao iniciada.'));
    };
    request.onerror = () => fail(request.error ?? new Error('Falha ao abrir banco local.'));
    request.onblocked = () => fail(new Error('Banco bloqueado por outra aba.'));
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      if (db.version !== LOCAL_DB_VERSION) {
        db.close();
        fail(new Error('Versao do banco local nao compativel com o backup T3a.'));
        return;
      }
      for (const store of ['meta', ...LOCAL_FIRST_DATA_STORES]) {
        if (!db.objectStoreNames.contains(store)) {
          db.close();
          fail(new Error(`Store local ausente: ${store}.`));
          return;
        }
      }
      settled = true;
      resolve(db);
    };
  });
}

function storedSize(value: unknown, store: DataStore): number {
  if (!object(value)) throw new Error(`Registro nao estruturado: ${store}.`);
  if (store !== 'originals') return JSON.stringify(value)?.length * 3 || 0;
  const binary = value.originalBytes instanceof ArrayBuffer ? value.originalBytes : value.blob;
  const size = binary instanceof ArrayBuffer ? binary.byteLength : binary instanceof Blob ? binary.size : -1;
  if (size < 1) throw new Error('PDF original sem bytes recuperaveis.');
  const { originalBytes: _originalBytes, blob: _blob, ...metadata } = value;
  return size * 2 + JSON.stringify(metadata).length * 3;
}

/** Reads a stable IndexedDB snapshot, never invoking workspaceId() or any readwrite operation. */
export async function readLocalFirstSnapshot(factory: IDBFactory = indexedDB): Promise<RawLocalFirstSnapshot> {
  const db = await openExistingDatabase(factory);
  try {
    return await new Promise<RawLocalFirstSnapshot>((resolve, reject) => {
      const stores = Object.fromEntries(LOCAL_FIRST_DATA_STORES.map(name => [name, []])) as unknown as Record<DataStore, unknown[]>;
      let workspaceId: string | null = null;
      let outboxSequence: number | null = null;
      let estimated = 0;
      let count = 0;
      let failure: Error | null = null;
      let tx: IDBTransaction;
      try {
        tx = db.transaction(['meta', ...LOCAL_FIRST_DATA_STORES], 'readonly');
      } catch (cause) { reject(cause); return; }
      const stop = (cause: Error) => {
        failure ??= cause;
        try { tx.abort(); } catch { reject(cause); }
      };
      tx.onabort = () => reject(failure ?? tx.error ?? new Error('Leitura local abortada.'));
      tx.onerror = () => reject(failure ?? tx.error ?? new Error('Leitura local falhou.'));
      tx.oncomplete = () => {
        if (!workspaceId) return reject(new Error('Identidade do workspace ausente: nenhum novo ID foi criado.'));
        if (outboxSequence !== null && (!Number.isSafeInteger(outboxSequence) || outboxSequence < 0))
          return reject(new Error('Sequencia local invalida.'));
        resolve({ workspaceId, outboxSequence, stores });
      };
      const meta = tx.objectStore('meta');
      const workspaceRequest = meta.get('workspaceId');
      workspaceRequest.onsuccess = () => {
        const record: unknown = workspaceRequest.result;
        if (!object(record) || typeof record.value !== 'string' || !record.value)
          return stop(new Error('Identidade do workspace ausente: nenhum novo ID foi criado.'));
        workspaceId = record.value;
      };
      const sequenceRequest = meta.get('outboxSequence');
      sequenceRequest.onsuccess = () => {
        const record: unknown = sequenceRequest.result;
        if (record === undefined) return;
        if (!object(record) || typeof record.value !== 'number')
          return stop(new Error('Sequencia local invalida.'));
        outboxSequence = record.value;
      };
      // IDB requests are queued synchronously. No await inside a live transaction:
      // WebKit can auto-commit between awaited cursor operations.
      for (const name of LOCAL_FIRST_DATA_STORES) {
        const request = tx.objectStore(name).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          try {
            count += 1;
            if (count > 100_000) throw new Error('Quantidade excede o limite do exportador T3a.');
            estimated += storedSize(cursor.value, name);
            if (estimated > MAX_LOCAL_FIRST_SNAPSHOT_BYTES)
              throw new Error('Dados maiores que 16 MiB; exportacao integral exige T3b streaming.');
            stores[name].push(cursor.value);
            cursor.continue();
          } catch (cause) {
            stop(cause instanceof Error ? cause : new Error('Leitura de registro local falhou.'));
          }
        };
      }
    });
  } finally {
    db.close();
  }
}

function strictJson(value: unknown, location: string): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((v, i) => strictJson(v, `${location}[${i}]`));
  if (object(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    const next: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype')
        throw new Error(`Chave de registro insegura: ${location}.`);
      next[key] = strictJson(nested, `${location}.${key}`);
    }
    return next;
  }
  throw new Error(`Dado nao serializavel sem perda detectado em ${location}.`);
}

function toBase64(bytes: Uint8Array): string {
  let result = '';
  // 12 KiB is divisible by 3: no padding in intermediate base64 chunks.
  for (let offset = 0; offset < bytes.length; offset += 12_288) {
    const part = bytes.subarray(offset, offset + 12_288);
    let characters = '';
    for (let i = 0; i < part.length; i++) characters += String.fromCharCode(part[i]);
    result += btoa(characters);
  }
  return result;
}

async function portableOriginal(value: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { originalBytes, blob, ...metadata } = value;
  const legacyBlob = blob instanceof Blob ? blob : null;
  const raw = originalBytes instanceof ArrayBuffer ? new Uint8Array(originalBytes) : null;
  if ((blob !== undefined && !legacyBlob) || (originalBytes !== undefined && !raw))
    throw new Error('Original com armazenamento binario desconhecido.');
  if (!legacyBlob && !raw) throw new Error('PDF original sem bytes recuperaveis.');
  const bytes = raw ?? new Uint8Array(await readBlobBytes(legacyBlob!));
  if (bytes.byteLength !== metadata.bytes || metadata.mediaType !== 'application/pdf' ||
      typeof metadata.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(metadata.sha256))
    throw new Error('PDF original com metadados inconsistentes.');
  if (legacyBlob && legacyBlob.size !== bytes.byteLength)
    throw new Error('Representacoes do PDF original divergem.');
  const hash = await digestHex(bytes);
  if (hash !== metadata.sha256.toLowerCase()) throw new Error('SHA-256 do PDF original nao confere.');
  if (raw && legacyBlob && hash !== await digestHex(new Uint8Array(await readBlobBytes(legacyBlob))))
    throw new Error('Representacoes do PDF original divergem.');
  return { ...(strictJson(metadata, 'original') as Record<string, unknown>), originalBytesBase64: toBase64(bytes) };
}

/** A corrupt IndexedDB key must not be laundered into a seemingly valid backup. */
function assertCanonicalRecordKey(name: DataStore, row: Record<string, unknown>, workspaceId: string): void {
  const validId = (id: unknown): id is string => typeof id === 'string' && id.length > 0;
  let expected: string;
  switch (name) {
    case 'entities':
      if (!validId(row.entity) || !validId(row.entityId))
        throw new Error('Entidade local sem identificadores validos.');
      expected = `${workspaceId}:${row.entity}:${row.entityId}`;
      break;
    case 'originals':
      if (!validId(row.blobId)) throw new Error('Original local sem blobId.');
      expected = `${workspaceId}:${row.blobId}`;
      break;
    case 'outbox':
    case 'acks':
      if (!validId(row.operationId)) throw new Error('Operacao local sem identificador.');
      expected = row.operationId;
      break;
    case 'conflicts':
      if (!validId(row.operationId)) throw new Error('Conflito local sem identificador.');
      expected = `${workspaceId}:${row.operationId}`;
      break;
  }
  if (row.key !== expected) throw new Error(`Chave inconsistente no store ${name}; backup bloqueado.`);
}

/** Normalizes legacy Blob PDFs without changing the records in IndexedDB. */
export async function makePortableLocalFirst(raw: RawLocalFirstSnapshot): Promise<PortableLocalFirstSnapshot> {
  if (typeof raw.workspaceId !== 'string' || !raw.workspaceId)
    throw new Error('Workspace vazio.');
  if (raw.outboxSequence !== null && (!Number.isSafeInteger(raw.outboxSequence) || raw.outboxSequence < 0))
    throw new Error('Sequencia da outbox invalida.');
  const stores = Object.fromEntries(LOCAL_FIRST_DATA_STORES.map(name => [name, []])) as unknown as Record<DataStore, Record<string, unknown>[]>;
  let maxLocalSequence = 0;
  for (const name of LOCAL_FIRST_DATA_STORES) {
    if (!Array.isArray(raw.stores[name])) throw new Error(`Store nao disponivel: ${name}.`);
    for (const [index, row] of raw.stores[name].entries()) {
      if (!object(row) || row.workspaceId !== raw.workspaceId || typeof row.key !== 'string' || !row.key)
        throw new Error(`Registro invalido ou de outro workspace em ${name}[${index}].`);
      assertCanonicalRecordKey(name, row, raw.workspaceId);
      if (name === 'outbox') {
        if (typeof row.localSequence !== 'number' || !Number.isSafeInteger(row.localSequence) || row.localSequence < 1)
          throw new Error('Outbox sem sequencia local valida.');
        maxLocalSequence = Math.max(maxLocalSequence, row.localSequence);
      }
      stores[name].push(name === 'originals' ? await portableOriginal(row) :
        strictJson(row, name) as Record<string, unknown>);
    }
  }
  if (maxLocalSequence > 0 && (raw.outboxSequence === null || maxLocalSequence > raw.outboxSequence))
    throw new Error('Outbox nao corresponde a sequencia local persistida.');
  return {
    schemaVersion: 1,
    database: LOCAL_DB_NAME,
    databaseVersion: LOCAL_DB_VERSION,
    metadata: { workspaceId: raw.workspaceId, outboxSequence: raw.outboxSequence },
    stores,
  };
}
