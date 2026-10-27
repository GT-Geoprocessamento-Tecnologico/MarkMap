import {
  LOCAL_DB_NAME,
  type LocalDb,
  type LocalDbTransaction,
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
import type { PortableLocalFirstSnapshot } from "./snapshot";

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

function inspectPendingSnapshot(snapshot: PortableLocalFirstSnapshot): {
  outbox: Record<string, unknown>[];
  conflicts: Record<string, unknown>[];
} {
  const { workspaceId, outboxSequence } = snapshot.metadata;
  const { outbox, conflicts } = snapshot.stores;
  if (!Array.isArray(outbox) || !Array.isArray(conflicts)) {
    throw new Error("Outbox ou conflitos ausentes no snapshot.");
  }
  if (outboxSequence !== null &&
    (!Number.isSafeInteger(outboxSequence) || outboxSequence < 0)) {
    throw new Error("Sequência da outbox inválida no backup.");
  }
  const seenIds = new Set<string>();
  const seenSequences = new Set<number>();
  let maxSequence = 0;
  for (const row of outbox) {
    if (!row || row.workspaceId !== workspaceId ||
      typeof row.operationId !== "string" || row.operationId.length === 0 ||
      row.key !== row.operationId || row.immutable !== true ||
      typeof row.localSequence !== "number" ||
      !Number.isSafeInteger(row.localSequence) || row.localSequence < 1) {
      throw new Error("Operação da outbox inválida no backup.");
    }
    if (seenIds.has(row.operationId) || seenSequences.has(row.localSequence)) {
      throw new Error("Operação ou sequência duplicada na outbox.");
    }
    seenIds.add(row.operationId);
    seenSequences.add(row.localSequence);
    maxSequence = Math.max(maxSequence, row.localSequence);
  }
  if (maxSequence > 0 &&
    (outboxSequence === null || maxSequence > outboxSequence)) {
    throw new Error("Sequência da outbox incompatível com as operações.");
  }
  const seenConflicts = new Set<string>();
  for (const row of conflicts) {
    if (!row || row.workspaceId !== workspaceId ||
      typeof row.operationId !== "string" || row.operationId.length === 0 ||
      row.key !== `${workspaceId}:${row.operationId}` ||
      seenConflicts.has(row.operationId)) {
      throw new Error("Conflito inválido ou duplicado no backup.");
    }
    seenConflicts.add(row.operationId);
  }
  return { outbox, conflicts };
}

/** Hash all PDFs before a readwrite transaction; WebCrypto awaits can close IDB transactions. */
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
      metadata.mediaType !== "application/pdf" ||
      typeof metadata.sha256 !== "string") {
      throw new Error("Original com metadados binários inconsistentes.");
    }
    if (await digestHex(bytes) !== metadata.sha256.toLowerCase()) {
      throw new Error(`SHA-256 do original "${String(metadata.blobId)}" corrompido no snapshot.`);
    }
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    return { ...metadata, originalBytes: copy,
      blob: new Blob([copy], { type: "application/pdf" }) };
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
    snapshot.database !== LOCAL_DB_NAME ||
    !snapshot.metadata?.workspaceId ||
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

async function checkPendingOutbox(
  tx: LocalDbTransaction,
  workspaceId: string,
): Promise<boolean> {
  try {
    const store = tx.store("outbox");
    const index = store.index("workspace");
    const records = await requestValue<unknown[]>(index.getAll(workspaceId));
    if (!Array.isArray(records)) {
      throw new Error("A consulta à outbox retornou formato inválido.");
    }
    return records.length > 0;
  } catch (error) {
    throw new Error(
      `Falha ao verificar operações pendentes na outbox: ${error instanceof Error ? error.message : "Erro desconhecido"}.`,
    );
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
    throw new Error(
      "Confirmação obrigatória: a restauração requer confirmação explícita para aplicar as alterações.",
    );
  }

  if (
    !snapshot ||
    typeof snapshot !== "object" ||
    snapshot.schemaVersion !== 1 ||
    snapshot.database !== LOCAL_DB_NAME ||
    !snapshot.metadata?.workspaceId ||
    !snapshot.stores
  ) {
    throw new Error("Snapshot inválido para restauração.");
  }

  const targetWorkspaceId = snapshot.metadata.workspaceId;
  const { outbox, conflicts } = inspectPendingSnapshot(snapshot);
  const preparedOriginals = await prepareOriginals(snapshot);

  return db.transact(
    ["meta", "entities", "originals", "outbox", "conflicts", "acks"],
    "readwrite",
    async (tx) => {
      // 1. Verificar identidade do workspace e evitar colisão
      const metaStore = tx.store("meta");
      const currentMeta = await requestValue<
        { key: string; value: string } | undefined
      >(metaStore.get("workspaceId"));
      const currentWorkspaceId = currentMeta?.value;

      // 2. Salvaguarda estrita: JAMAIS sobrescrever outbox pendente
      const hasPendingCurrent = currentWorkspaceId
        ? await checkPendingOutbox(tx, currentWorkspaceId)
        : false;
      const hasPendingTarget = await checkPendingOutbox(tx, targetWorkspaceId);

      if (hasPendingCurrent || hasPendingTarget) {
        throw new Error(
          "Não é possível restaurar o backup com operações locais pendentes na outbox. Sincronize antes de restaurar.",
        );
      }

      // Reject every populated target, including older workspace PDFs and ACKs:
      // restoration must never silently merge with data from this installation.
      const occupied = new Set(
        [currentWorkspaceId, targetWorkspaceId].filter(
          (id): id is string => typeof id === "string" && id.length > 0,
        ),
      );
      for (const id of occupied) {
        for (const name of ["entities", "originals", "conflicts", "acks"] as const) {
          const rows = await requestValue<unknown[]>(
            tx.store(name).index("workspace").getAll(id),
          );
          if (!Array.isArray(rows) || rows.length > 0) {
            throw new Error(
              `O workspace "${id}" já contém dados locais. Restauração exige destino vazio.`,
            );
          }
        }
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
      if (snapshot.metadata.outboxSequence !== null) {
        const existingSeq = await requestValue<
          { key: string; value: number } | undefined
        >(metaStore.get("outboxSequence"));
        const currentSeq = existingSeq?.value ?? 0;
        if (snapshot.metadata.outboxSequence > currentSeq) {
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
          originals: originals.length,
          acks: acks.length,
          outbox: outbox.length,
          conflicts: conflicts.length,
        },
      };
    },
  );
}