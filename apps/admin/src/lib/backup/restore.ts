import { LOCAL_DB_NAME, type LocalDb, type LocalDbTransaction } from '../local-db/types';
import {
  decryptBackupEntry, digestHex, fromHex, workspaceFingerprint,
} from './crypto';
import {
  BACKUP_ARCHIVE_TYPE, BACKUP_ARCHIVE_VERSION, type EncryptedWorkspaceArchive,
} from './export';
import { validateBackupManifest } from './manifest';
import type { PortableLocalFirstSnapshot } from './snapshot';

export function fromBase64(encoded: string): Uint8Array {
  const decoded = atob(encoded);
  return Uint8Array.from(decoded, ch => ch.charCodeAt(0));
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Falha na operação IndexedDB.'));
  });
}

export interface DryRunSummary {
  entitiesCount: number;
  originalsCount: number;
  acksCount: number;
  projectsCount: number;
  featuresCount: number;
  totalRecords: number;
  totalOriginalsBytes: number;
}

export interface DryRunRestoreResult {
  valid: true;
  appVersion: string;
  createdAt: string;
  sourceWorkspaceFingerprint: string;
  workspaceId: string;
  summary: DryRunSummary;
  snapshot: PortableLocalFirstSnapshot;
}

export interface RestoreOptions {
  /** Confirmação explícita para aplicar as alterações */
  confirmed?: boolean;
}

export interface RestoreResult {
  workspaceId: string;
  restoredCounts: {
    entities: number;
    originals: number;
    acks: number;
  };
}

/**
 * Executa inspeção completa e validação de integridade do backup sem nenhuma escrita em disco.
 * Descriptografa o payload em memória, valida hashes e certifica a conformidade do schema.
 */
export async function dryRunRestore(
  fileData: ArrayBuffer | Uint8Array,
  password: string,
): Promise<DryRunRestoreResult> {
  if (!password || typeof password !== 'string') {
    throw new Error('Senha não fornecida.');
  }

  const bytes = fileData instanceof Uint8Array
    ? fileData
    : new Uint8Array(fileData);

  let archiveJson: string;
  try {
    archiveJson = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Arquivo de backup inválido: não é um texto UTF-8 codificado.');
  }

  let archive: EncryptedWorkspaceArchive;
  try {
    archive = JSON.parse(archiveJson) as EncryptedWorkspaceArchive;
  } catch {
    throw new Error('Arquivo de backup corrompido: formato JSON inválido.');
  }

  if (
    !archive ||
    typeof archive !== 'object' ||
    archive.type !== BACKUP_ARCHIVE_TYPE ||
    archive.version !== BACKUP_ARCHIVE_VERSION
  ) {
    throw new Error('Formato de arquivo de backup desconhecido ou incompatível.');
  }

  const manifestValidation = validateBackupManifest(archive.manifest);
  if (!manifestValidation.valid) {
    throw new Error(`Manifesto de backup inválido: ${manifestValidation.errors.join(', ')}`);
  }

  const manifest = archive.manifest;
  const localFirstEntry = manifest.entries.find(e => e.section === 'local-first');
  if (!localFirstEntry) {
    throw new Error('Manifesto não contém entrada da seção local-first.');
  }

  const fileItem = archive.files?.find(f => f.path === localFirstEntry.path);
  if (!fileItem || typeof fileItem.base64 !== 'string') {
    throw new Error('Arquivo de dados do backup local-first não encontrado no pacote.');
  }

  let ciphertext: Uint8Array;
  try {
    ciphertext = fromBase64(fileItem.base64);
  } catch {
    throw new Error('Dados do backup em base64 corrompidos.');
  }

  if (ciphertext.byteLength !== localFirstEntry.sizeBytes) {
    throw new Error('Arquivo corrompido: tamanho do ciphertext não corresponde ao manifesto.');
  }

  const cipherHash = await digestHex(ciphertext);
  if (cipherHash !== localFirstEntry.sha256) {
    throw new Error('Arquivo corrompido: hash SHA-256 do ciphertext não confere com o manifesto.');
  }

  const cleartext = await decryptBackupEntry(password, manifest, localFirstEntry.path, ciphertext);

  let snapshot: PortableLocalFirstSnapshot;
  try {
    snapshot = JSON.parse(new TextDecoder().decode(cleartext)) as PortableLocalFirstSnapshot;
  } catch {
    throw new Error('Payload descriptografado corrompido: JSON inválido.');
  }

  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    snapshot.schemaVersion !== 1 ||
    snapshot.database !== LOCAL_DB_NAME ||
    !snapshot.metadata?.workspaceId ||
    !snapshot.stores
  ) {
    throw new Error('Estrutura de dados do snapshot inválida ou incompatível.');
  }

  const salt = fromHex(manifest.encryption.saltHex);
  const fingerprint = await workspaceFingerprint(snapshot.metadata.workspaceId, salt);
  if (fingerprint !== manifest.sourceWorkspaceFingerprint) {
    throw new Error('Fingerprint do workspace não confere com a assinatura do manifesto.');
  }

  const entities = snapshot.stores.entities || [];
  const originals = snapshot.stores.originals || [];
  const acks = snapshot.stores.acks || [];

  let projectsCount = 0;
  let featuresCount = 0;
  for (const ent of entities) {
    const row = ent as Record<string, unknown>;
    if (row.entity === 'project' && !row.deleted) projectsCount++;
    if (row.entity === 'feature' && !row.deleted) featuresCount++;
  }

  let totalOriginalsBytes = 0;
  for (const orig of originals) {
    const row = orig as Record<string, unknown>;
    if (typeof row.bytes === 'number') totalOriginalsBytes += row.bytes;
  }

  const totalRecords = entities.length + originals.length + acks.length;

  return {
    valid: true,
    appVersion: manifest.appVersion,
    createdAt: manifest.createdAt,
    sourceWorkspaceFingerprint: manifest.sourceWorkspaceFingerprint,
    workspaceId: snapshot.metadata.workspaceId,
    summary: {
      entitiesCount: entities.length,
      originalsCount: originals.length,
      acksCount: acks.length,
      projectsCount,
      featuresCount,
      totalRecords,
      totalOriginalsBytes,
    },
    snapshot,
  };
}

async function checkPendingOutbox(tx: LocalDbTransaction, workspaceId: string): Promise<boolean> {
  try {
    const store = tx.store('outbox');
    const index = store.index('workspace');
    const records = await requestValue<unknown[]>(index.getAll(workspaceId));
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
}

/**
 * Restaura um snapshot validado no banco local transacionalmente.
 * Salvaguardas estritas:
 * 1. Exige confirmação explícita (options.confirmed = true).
 * 2. Bloqueia se houver operações pendentes na outbox.
 * 3. Bloqueia conflito com workspace local populado diferente do backup.
 */
export async function restoreWorkspaceSnapshot(
  snapshot: PortableLocalFirstSnapshot,
  db: LocalDb,
  options: RestoreOptions = {},
): Promise<RestoreResult> {
  if (options.confirmed !== true) {
    throw new Error('Confirmação obrigatória: a restauração requer confirmação explícita para aplicar as alterações.');
  }

  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    snapshot.schemaVersion !== 1 ||
    snapshot.database !== LOCAL_DB_NAME ||
    !snapshot.metadata?.workspaceId ||
    !snapshot.stores
  ) {
    throw new Error('Snapshot inválido para restauração.');
  }

  const targetWorkspaceId = snapshot.metadata.workspaceId;

  return db.transact(
    ['meta', 'entities', 'originals', 'outbox', 'conflicts', 'acks'],
    'readwrite',
    async (tx) => {
      // 1. Verificar identidade do workspace e evitar colisão
      const metaStore = tx.store('meta');
      const currentMeta = await requestValue<{ key: string; value: string } | undefined>(
        metaStore.get('workspaceId'),
      );
      const currentWorkspaceId = currentMeta?.value;

      if (currentWorkspaceId && currentWorkspaceId !== targetWorkspaceId) {
        const entitiesIndex = tx.store('entities').index('workspace');
        const existingEntities = await requestValue<unknown[]>(
          entitiesIndex.getAll(currentWorkspaceId),
        );
        if (existingEntities && existingEntities.length > 0) {
          throw new Error(
            `O backup pertence ao workspace "${targetWorkspaceId}", mas o banco local ativo é "${currentWorkspaceId}". A restauração entre workspaces com dados existentes é bloqueada para evitar corrupção.`,
          );
        }
      }

      // 2. Salvaguarda estrita: JAMAIS sobrescrever outbox pendente
      const hasPendingCurrent = currentWorkspaceId
        ? await checkPendingOutbox(tx, currentWorkspaceId)
        : false;
      const hasPendingTarget = await checkPendingOutbox(tx, targetWorkspaceId);

      if (hasPendingCurrent || hasPendingTarget) {
        throw new Error(
          'Não é possível restaurar o backup com operações locais pendentes na outbox. Sincronize antes de restaurar.',
        );
      }

      // 3. Restaurar entidades
      const entitiesStore = tx.store('entities');
      const entities = snapshot.stores.entities || [];
      for (const entity of entities) {
        if (entity.workspaceId !== targetWorkspaceId) {
          throw new Error('Entidade com workspaceId divergente no snapshot.');
        }
        entitiesStore.put(entity);
      }

      // 4. Restaurar originais (com verificação estrita de hash e reconstrução binária)
      const originalsStore = tx.store('originals');
      const originals = snapshot.stores.originals || [];
      for (const rawOrig of originals) {
        const { originalBytesBase64, ...metadata } = rawOrig;
        if (typeof originalBytesBase64 !== 'string' || !originalBytesBase64) {
          throw new Error(`Original "${String(metadata.blobId)}" sem bytes no snapshot.`);
        }
        const binaryBytes = fromBase64(originalBytesBase64);
        const hash = await digestHex(binaryBytes);
        if (hash !== String(metadata.sha256).toLowerCase()) {
          throw new Error(`SHA-256 do original "${String(metadata.blobId)}" corrompido no snapshot.`);
        }
        const bufferCopy = new ArrayBuffer(binaryBytes.byteLength);
        new Uint8Array(bufferCopy).set(binaryBytes);
        const mediaType = typeof metadata.mediaType === 'string' ? metadata.mediaType : 'application/pdf';

        const record = {
          ...metadata,
          originalBytes: bufferCopy,
          blob: new Blob([bufferCopy], { type: mediaType }),
        };
        originalsStore.put(record);
      }

      // 5. Restaurar acks
      const acksStore = tx.store('acks');
      const acks = snapshot.stores.acks || [];
      for (const ack of acks) {
        if (ack.workspaceId !== targetWorkspaceId) {
          throw new Error('ACK com workspaceId divergente no snapshot.');
        }
        acksStore.put(ack);
      }

      // 6. Atualizar meta (workspaceId e sequence se aplicável)
      metaStore.put({ key: 'workspaceId', value: targetWorkspaceId });
      if (snapshot.metadata.outboxSequence !== null) {
        const existingSeq = await requestValue<{ key: string; value: number } | undefined>(
          metaStore.get('outboxSequence'),
        );
        const currentSeq = existingSeq?.value ?? 0;
        if (snapshot.metadata.outboxSequence > currentSeq) {
          metaStore.put({ key: 'outboxSequence', value: snapshot.metadata.outboxSequence });
        }
      }

      return {
        workspaceId: targetWorkspaceId,
        restoredCounts: {
          entities: entities.length,
          originals: originals.length,
          acks: acks.length,
        },
      };
    },
  );
}
