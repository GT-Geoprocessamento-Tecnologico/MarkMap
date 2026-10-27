import { syncConflictSchema, syncOperationSchema } from '@markmap/contracts';
import { LOCAL_FIRST_DATA_STORES, type PortableLocalFirstSnapshot } from './snapshot';

export function inspectPendingSnapshot(snapshot: PortableLocalFirstSnapshot): {
  outbox: Record<string, unknown>[];
  conflicts: Record<string, unknown>[];
} {
  const { workspaceId, outboxSequence } = snapshot.metadata;
  for (const name of LOCAL_FIRST_DATA_STORES) {
    const rows = snapshot.stores[name];
    if (!Array.isArray(rows)) throw new Error(`Store ausente no snapshot: ${name}.`);
    const keys = new Set<string>();
    for (const row of rows) {
      if (!row || typeof row !== "object" || Array.isArray(row) || row.workspaceId !== workspaceId) {
        throw new Error(`Registro inválido ou de outro workspace: ${name}.`);
      }
      let expected: string | undefined;
      if (name === "entities" && typeof row.entity === "string" && row.entity &&
          typeof row.entityId === "string" && row.entityId) expected = `${workspaceId}:${row.entity}:${row.entityId}`;
      if (name === "originals" && typeof row.blobId === "string" && row.blobId) expected = `${workspaceId}:${row.blobId}`;
      if ((name === "outbox" || name === "acks") && typeof row.operationId === "string" && row.operationId) expected = row.operationId;
      if (name === "conflicts" && typeof row.operationId === "string" && row.operationId) expected = `${workspaceId}:${row.operationId}`;
      if (!expected || row.key !== expected || keys.has(expected)) {
        throw new Error(`Chave inválida ou duplicada no snapshot: ${name}.`);
      }
      keys.add(expected);
    }
  }
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
    const operation = { ...row };
    delete operation.key;
    delete operation.immutable;
    delete operation.localSequence;
    if (!syncOperationSchema.safeParse(operation).success) {
      throw new Error("Conteúdo da operação da outbox inválido no backup.");
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
    const conflict = { ...row };
    delete conflict.key;
    delete conflict.workspaceId;
    delete conflict.createdAt;
    if (!syncConflictSchema.safeParse(conflict).success) {
      throw new Error("Conteúdo do conflito inválido no backup.");
    }
    seenConflicts.add(row.operationId);
  }
  return { outbox, conflicts };
}
