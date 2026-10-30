import {
  LOCAL_DB_NAME,
  LOCAL_DB_VERSION,
  type LocalDb,
} from "../local-db/types";
import {
  decryptBackupEntry,
  digestHex,
  fromHex,
  workspaceFingerprint,
} from "./crypto";
import {
  BACKUP_ARCHIVE_TYPE,
  BACKUP_ARCHIVE_VERSION,
  type EncryptedWorkspaceArchive,
} from "./export";
import { validateBackupManifest } from "./manifest";
import { LOCAL_FIRST_DATA_STORES, type PortableLocalFirstSnapshot } from "./snapshot";
import { inspectPendingSnapshot } from "./validation";
import { isPhotoMediaType, isSupportedBackupOriginalMediaType, validatePhotoBytes, validatePhotoOriginalMetadata } from "../photo/point-photo-policy.mjs";
import { geoReferenceSchema } from "@markmap/contracts";
import { assertGeoPdfProjectIds } from "../pdf/project-geopdf-link.mjs";

export function fromBase64(encoded: string): Uint8Array {
  const decoded = atob(encoded);
  return Uint8Array.from(decoded, (ch) => ch.charCodeAt(0));
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Falha na operação IndexedDB."));
  });
}

export interface DryRunSummary {
  entitiesCount: number;
  originalsCount: number;
  acksCount: number;
  outboxCount: number;
  conflictsCount: number;
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
    outbox: number;
    conflicts: number;
  };
}

/** Hash all local originals before a readwrite transaction; WebCrypto awaits can close IDB transactions. */
async function prepareOriginals(
  snapshot: PortableLocalFirstSnapshot,
): Promise<Record<string, unknown>[]> {
  const workspaceId = snapshot.metadata.workspaceId;
  if (!Array.isArray(snapshot.stores.originals)) {
    throw new Error("Originais ausentes no snapshot.");
  }
  return Promise.all(snapshot.stores.originals.map(async (rawOrig) => {
    const { originalBytesBase64, ...metadata } = rawOrig;
    if (metadata.workspaceId !== workspaceId ||
      typeof metadata.blobId !== "string" || metadata.blobId.length === 0 ||
      metadata.key !== `${workspaceId}:${metadata.blobId}`) {
      throw new Error("Original com workspace ou chave inválidos no backup.");
    }
    if (typeof originalBytesBase64 !== "string" || originalBytesBase64.length === 0) {
      throw new Error(`Original "${String(metadata.blobId)}" sem bytes no snapshot.`);
    }
    const bytes = fromBase64(originalBytesBase64);
    if (metadata.bytes !== bytes.byteLength ||
      !isSupportedBackupOriginalMediaType(metadata.mediaType) ||
      typeof metadata.sha256 !== "string") {
      throw new Error("Original com metadados binários inconsistentes.");
    }
    validatePhotoOriginalMetadata(metadata);
    if (metadata.geoPdfReference !== undefined || metadata.projectGeoPdfIds !== undefined) {
      if (metadata.mediaType !== "application/pdf")
        throw new Error("Metadados geográficos em original não PDF.");
      assertGeoPdfProjectIds(metadata.projectGeoPdfIds);
      if (metadata.geoPdfReference !== undefined) geoReferenceSchema.parse(metadata.geoPdfReference);
    }
    if (isPhotoMediaType(metadata.mediaType)) validatePhotoBytes(metadata.mediaType, bytes);
    if (await digestHex(bytes) !== metadata.sha256.toLowerCase()) {
      throw new Error(`SHA-256 do original "${String(metadata.blobId)}" corrompido no snapshot.`);
    }
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    // Store bytes in the same WebKit-compatible form used by LocalRepository.
    return { ...metadata, originalBytes: copy };
  }));
}

/**
 * Executa inspeção completa e validação de integridade do backup sem nenhuma escrita em disco.
 * Descriptografa o payload em memória, valida hashes e certifica a conformidade do schema.
 */
export async function dryRunRestore(
  fileData: ArrayBuffer | Uint8Array,
  password: string,
): Promise<DryRunRestoreResult> {
  if (!password || typeof password !== "string") {
    throw new Error("Senha não fornecida.");
  }

  const bytes =
    fileData instanceof Uint8Array ? fileData : new Uint8Array(fileData);
  // Match the T3a export limit before allocating decoded JSON and base64 copies.
  if (bytes.byteLength > 32 * 1024 * 1024) {
    throw new Error("Arquivo de backup excede o limite de 32 MiB.");
  }

  let archiveJson: string;
  try {
    archiveJson = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(
      "Arquivo de backup inválido: não é um texto UTF-8 codificado.",
    );
  }

  let archive: EncryptedWorkspaceArchive;
  try {
    archive = JSON.parse(archiveJson) as EncryptedWorkspaceArchive;
  } catch {
    throw new Error("Arquivo de backup corrompido: formato JSON inválido.");
  }

  if (
    !archive ||
    typeof archive !== "object" ||
    archive.type !== BACKUP_ARCHIVE_TYPE ||
    archive.version !== BACKUP_ARCHIVE_VERSION
  ) {
    throw new Error(
      "Formato de arquivo de backup desconhecido ou incompatível.",
    );
  }

  const manifestValidation = validateBackupManifest(archive.manifest);
  if (!manifestValidation.valid) {
    throw new Error(
      `Manifesto de backup inválido: ${manifestValidation.errors.join(", ")}`,
    );
  }

  const manifest = archive.manifest;
  const localFirstEntry = manifest.entries.find(
    (e) => e.section === "local-first",
  );
  if (!localFirstEntry) {
    throw new Error("Manifesto não contém entrada da seção local-first.");
  }

  const fileItem = archive.files?.find((f) => f.path === localFirstEntry.path);
  if (!fileItem || typeof fileItem.base64 !== "string") {
    throw new Error(
      "Arquivo de dados do backup local-first não encontrado no pacote.",
    );
  }

  let ciphertext: Uint8Array;
  try {
    ciphertext = fromBase64(fileItem.base64);
  } catch {
    throw new Error("Dados do backup em base64 corrompidos.");
  }

  if (ciphertext.byteLength !== localFirstEntry.sizeBytes) {
    throw new Error(
      "Arquivo corrompido: tamanho do ciphertext não corresponde ao manifesto.",
    );
  }

  const cipherHash = await digestHex(ciphertext);
  if (cipherHash !== localFirstEntry.sha256) {
    throw new Error(
      "Arquivo corrompido: hash SHA-256 do ciphertext não confere com o manifesto.",
    );
  }

  const cleartext = await decryptBackupEntry(
    password,
    manifest,
    localFirstEntry.path,
    ciphertext,
  );

  let snapshot: PortableLocalFirstSnapshot;
  try {
    snapshot = JSON.parse(
      new TextDecoder().decode(cleartext),
    ) as PortableLocalFirstSnapshot;
  } catch {
    throw new Error("Payload descriptografado corrompido: JSON inválido.");
  }

  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    snapshot.schemaVersion !== 1 ||
    snapshot.database !== LOCAL_DB_NAME || snapshot.databaseVersion !== LOCAL_DB_VERSION ||
    typeof snapshot.metadata?.workspaceId !== "string" || !snapshot.metadata.workspaceId ||
    !snapshot.stores
  ) {
    throw new Error("Estrutura de dados do snapshot inválida ou incompatível.");
  }

  const salt = fromHex(manifest.encryption.saltHex);
  const fingerprint = await workspaceFingerprint(
    snapshot.metadata.workspaceId,
    salt,
  );
  if (fingerprint !== manifest.sourceWorkspaceFingerprint) {
    throw new Error(
      "Fingerprint do workspace não confere com a assinatura do manifesto.",
    );
  }

  const { outbox, conflicts } = inspectPendingSnapshot(snapshot);
  await prepareOriginals(snapshot);
  const entities = snapshot.stores.entities || [];
  const originals = snapshot.stores.originals || [];
  const acks = snapshot.stores.acks || [];

  let projectsCount = 0;
  let featuresCount = 0;
  for (const ent of entities) {
    const row = ent as Record<string, unknown>;
    if (row.entity === "project" && !row.deleted) projectsCount++;
    if (row.entity === "feature" && !row.deleted) featuresCount++;
  }

  let totalOriginalsBytes = 0;
  for (const orig of originals) {
    const row = orig as Record<string, unknown>;
    if (typeof row.bytes === "number") totalOriginalsBytes += row.bytes;
  }

  const totalRecords =
    entities.length + originals.length + acks.length + outbox.length + conflicts.length;

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
      outboxCount: outbox.length,
      conflictsCount: conflicts.length,
      projectsCount,
      featuresCount,
      totalRecords,
      totalOriginalsBytes,
    },
    snapshot,
  };
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
    throw new Error(
      "Confirmação obrigatória: a restauração requer confirmação explícita para aplicar as alterações.",
    );
  }

  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    snapshot.schemaVersion !== 1 ||
    snapshot.database !== LOCAL_DB_NAME || snapshot.databaseVersion !== LOCAL_DB_VERSION ||
    typeof snapshot.metadata?.workspaceId !== "string" || !snapshot.metadata.workspaceId ||
    !snapshot.stores
  ) {
    throw new Error("Snapshot inválido para restauração.");
  }

  const targetWorkspaceId = snapshot.metadata.workspaceId;
  const { outbox, conflicts } = inspectPendingSnapshot(snapshot);
  const preparedOriginals = await prepareOriginals(snapshot);
  const pauseGeneration = crypto.randomUUID();

  return db.transact(
    ["meta", "entities", "originals", "outbox", "conflicts", "acks"],
    "readwrite",
    async (tx) => {
      const metaStore = tx.store("meta");
      const sensitiveKeys = ["workspaceCapability", "workspaceBootstrapProof", "installationId", "syncCursor"] as const;
      // Count every store globally in the transaction, including stale workspaces
      // and malformed rows hidden from the workspace index.
      const [workspace, sensitive, existingSeq, activeSync, existingPause, counts] = await Promise.all([
        requestValue<{ key: string; value: unknown } | undefined>(metaStore.get("workspaceId")),
        Promise.all(sensitiveKeys.map(key => requestValue<{ key: string; value: unknown } | undefined>(metaStore.get(key)))),
        requestValue<{ key: string; value: unknown } | undefined>(metaStore.get("outboxSequence")),
        requestValue<unknown>(metaStore.get("syncInProgress")),
        requestValue<{ value: unknown } | undefined>(metaStore.get("syncPausedAfterRestore")),
        Promise.all(LOCAL_FIRST_DATA_STORES.map(name => requestValue(tx.store(name).count()))),
      ]);
      // Any claim, including a malformed or stale one, blocks writes until reviewed.
      if (activeSync !== undefined) {
        throw new Error("Sincronização em andamento ou não finalizada impede a restauração.");
      }
      // Do not let a new recovery replace a pause still awaiting a decision.
      if (existingPause !== undefined && existingPause.value !== false) {
        throw new Error("Uma restauração anterior ainda aguarda decisão de sincronização.");
      }
      const occupied = counts.findIndex(count => count !== 0);
      if (occupied !== -1) {
        throw new Error(`O banco local já contém dados no workspace/store ${LOCAL_FIRST_DATA_STORES[occupied]}; restauração exige destino vazio.`);
      }
      // Do not adopt a different identity or orphan sync credentials on an apparently empty database.
      if (workspace && workspace.value !== targetWorkspaceId) {
        throw new Error("O workspace existente difere do backup; restauração bloqueada.");
      }
      if (!workspace && sensitive.some(row => row !== undefined)) {
        throw new Error("Metadados de sincronização sem workspace impedem a restauração segura.");
      }
      // A cursor may have advanced beyond the older snapshot and cannot be reused safely.
      if (sensitive[3] !== undefined) {
        throw new Error("Cursor de sincronização existente impede a restauração segura.");
      }
      const capability = sensitive[0]?.value;
      if (sensitive[0] !== undefined && (
        !capability || typeof capability !== "object" || Array.isArray(capability) ||
        !("workspaceId" in capability) || capability.workspaceId !== targetWorkspaceId
      )) {
        throw new Error("Credencial de workspace inválida ou divergente impede a restauração.");
      }
      const currentSeq = existingSeq?.value;
      if (existingSeq !== undefined && (
        typeof currentSeq !== "number" || !Number.isSafeInteger(currentSeq) || currentSeq < 0
      )) {
        throw new Error("Sequência local da outbox inválida impede a restauração.");
      }

      // 3. Restaurar entidades
      const entitiesStore = tx.store("entities");
      const entities = snapshot.stores.entities || [];
      for (const entity of entities) {
        if (entity.workspaceId !== targetWorkspaceId) {
          throw new Error("Entidade com workspaceId divergente no snapshot.");
        }
        entitiesStore.put(entity);
      }

      // 4. Restaurar originais já validados sem awaits de WebCrypto.
      const originalsStore = tx.store("originals");
      for (const record of preparedOriginals) {
        originalsStore.put(record);
      }

      // 5. Recriar a outbox e os conflitos com IDs e sequência originais.
      for (const operation of outbox) tx.store("outbox").add(operation);
      for (const conflict of conflicts) tx.store("conflicts").add(conflict);

      // 6. Restaurar acks
      const acksStore = tx.store("acks");
      const acks = snapshot.stores.acks || [];
      for (const ack of acks) {
        if (ack.workspaceId !== targetWorkspaceId) {
          throw new Error("ACK com workspaceId divergente no snapshot.");
        }
        acksStore.put(ack);
      }

      // 7. Atualizar meta (workspaceId e sequence se aplicável)
      metaStore.put({ key: "workspaceId", value: targetWorkspaceId });
      // Persist the safety gate atomically with restored data and outbox.
      metaStore.put({ key: "syncPausedAfterRestore", value: { kind: "restore", generation: pauseGeneration } });
      if (snapshot.metadata.outboxSequence !== null) {
        if (snapshot.metadata.outboxSequence > (typeof currentSeq === "number" ? currentSeq : 0)) {
          metaStore.put({
            key: "outboxSequence",
            value: snapshot.metadata.outboxSequence,
          });
        }
      }

      return {
        workspaceId: targetWorkspaceId,
        restoredCounts: {
          entities: entities.length,
          originals: preparedOriginals.length,
          acks: acks.length,
          outbox: outbox.length,
          conflicts: conflicts.length,
        },
      };
    },
  );
}
