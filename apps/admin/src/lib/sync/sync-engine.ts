import {
  capabilityProvisionResponseSchema,
  pullSyncResponseSchema,
  pushSyncResponseSchema,
  type WorkspaceCapability,
} from "@geonexo/contracts";

import { API_BASE, API_MODE } from "../api-client";
import { localRepository } from "../local-repositories";

export type SyncState =
  | "disabled"
  | "offline"
  | "idle"
  | "syncing"
  | "synced"
  | "error";

export type SyncResult = {
  state: SyncState;
  pushed: number;
  pulled: number;
  conflicts: number;
  pending: number;
};

const META_BOOTSTRAP_PROOF = "workspaceBootstrapProof";
const META_INSTALLATION_ID = "installationId";
const META_CAPABILITY = "workspaceCapability";
const META_SYNC_CURSOR = "syncCursor";
const MAX_BATCH = 500;
const MAX_PULL_PAGES = 50;
const REQUEST_TIMEOUT_MS = 15_000;

let inFlight: Promise<SyncResult> | null = null;

const emit = (result: SyncResult): SyncResult => {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent<SyncResult>("geonexo-sync-status", { detail: result }),
    );
  return result;
};

const base64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
};

const randomProof = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
};

// The request deadline includes receiving and parsing the body. Clearing the
// timer after headers alone can strand syncNow() on a stalled HTTP stream.
type SyncHttpResponse = { ok: boolean; status: number; payload: unknown };

const request = async (
  path: string,
  init: RequestInit,
  bearer?: string,
): Promise<SyncHttpResponse> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...init.headers,
      },
    });
    if (!response.ok) {
      // Do not wait for an untrusted error body (including an expired bearer).
      void response.body?.cancel().catch(() => undefined);
      return { ok: false, status: response.status, payload: undefined };
    }
    const text = await response.text();
    return {
      ok: true,
      status: response.status,
      payload: text ? JSON.parse(text) as unknown : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const ensureBootstrap = async (): Promise<{
  workspaceId: string;
  installationId: string;
  bootstrapProof: string;
}> => {
  const workspaceId = await localRepository.workspaceId();
  let installationId =
    await localRepository.getMeta<string>(META_INSTALLATION_ID);
  let bootstrapProof =
    await localRepository.getMeta<string>(META_BOOTSTRAP_PROOF);

  if (!installationId) {
    installationId = crypto.randomUUID();
    await localRepository.setMeta(META_INSTALLATION_ID, installationId);
  }
  if (!bootstrapProof) {
    bootstrapProof = randomProof();
    await localRepository.setMeta(META_BOOTSTRAP_PROOF, bootstrapProof);
  }
  return { workspaceId, installationId, bootstrapProof };
};

const saveCapability = async (
  candidate: unknown,
): Promise<WorkspaceCapability> => {
  const capability = capabilityProvisionResponseSchema.parse(candidate);
  const localWorkspaceId = await localRepository.workspaceId();
  if (capability.workspaceId !== localWorkspaceId)
    throw new Error("Workspace capability does not match this device.");
  const current =
    await localRepository.getMeta<WorkspaceCapability>(META_CAPABILITY);
  if (
    current &&
    BigInt(current.generation) > BigInt(capability.generation)
  )
    return current;
  await localRepository.setMeta(META_CAPABILITY, capability);
  return capability;
};

const provisionCapability = async (): Promise<WorkspaceCapability> => {
  const bootstrap = await ensureBootstrap();
  const response = await request("/workspace/provision", {
    method: "POST",
    body: JSON.stringify(bootstrap),
  });
  const payload = response.payload;
  if (!response.ok)
    throw new Error(`Workspace provisioning failed (HTTP ${response.status})`);
  return saveCapability(payload);
};

const recoverCapability = async (): Promise<WorkspaceCapability> => {
  const { bootstrapProof } = await ensureBootstrap();
  const response = await request("/workspace/recover", {
    method: "POST",
    body: JSON.stringify({ bootstrapProof }),
  });
  const payload = response.payload;
  if (!response.ok)
    throw new Error(`Workspace recovery failed (HTTP ${response.status})`);
  return saveCapability(payload);
};

const capability = async (): Promise<WorkspaceCapability> => {
  const current =
    await localRepository.getMeta<WorkspaceCapability>(META_CAPABILITY);
  return current
    ? capabilityProvisionResponseSchema.parse(current)
    : provisionCapability();
};

const withCapability = async (
  path: string,
  init: RequestInit,
): Promise<SyncHttpResponse> => {
  let current = await capability();
  let response = await request(path, init, current.bearer);
  if (response.status !== 401) return response;

  current = await recoverCapability();
  response = await request(path, init, current.bearer);
  return response;
};

const push = async (
  onProgress?: (accepted: number, conflicts: number) => void,
): Promise<{ pushed: number; conflicts: number }> => {
  let pushed = 0;
  let conflicts = 0;

  while (true) {
    const pending = await localRepository.listOutbox();
    if (pending.length === 0) break;

    const batch = pending.slice(0, MAX_BATCH);
    const response = await withCapability("/sync/push", {
      method: "POST",
      body: JSON.stringify({ operations: batch }),
    });
    const payload = response.payload;
    if (!response.ok)
      throw new Error(`Sync push failed (HTTP ${response.status})`);

    const result = pushSyncResponseSchema.parse(payload);
    // A response must only acknowledge operations in this exact request.
    // Unknown or duplicate IDs could otherwise cause an endless resend loop.
    const sentIds = new Set(batch.map((operation) => operation.operationId));
    const respondedIds = new Set<string>();
    for (const receipt of [...result.accepted, ...result.alreadyApplied, ...result.conflicts]) {
      if (!sentIds.has(receipt.operationId) || respondedIds.has(receipt.operationId))
        throw new Error("Invalid sync push response: unexpected or duplicate operation");
      respondedIds.add(receipt.operationId);
    }
    for (const ack of [...result.accepted, ...result.alreadyApplied]) {
      const acknowledged = await localRepository.acknowledge(
        ack.operationId,
        ack.version,
        ack.sequence,
        ack.predecessorOperationId,
      );
      // Only a durable ACK counts as progress. A rejected/stale receipt must
      // leave the operation available for a safe retry, not report success.
      if (acknowledged !== true)
        throw new Error("Sync acknowledgement could not be persisted");
      pushed += 1;
      onProgress?.(1, 0);
    }
    for (const conflict of result.conflicts) {
      await localRepository.saveConflict(conflict);
      conflicts += 1;
      onProgress?.(0, 1);
    }

    if (respondedIds.size === 0) break;

    // Some adapters may fail to remove an ACK from the durable outbox.
    // Avoid re-posting it indefinitely: the next manual sync can retry safely.
    const stillPending = new Set(
      (await localRepository.listOutbox()).map((operation) => operation.operationId),
    );
    if (batch.every((operation) => stillPending.has(operation.operationId)))
      throw new Error("Sync push response did not advance the local outbox");
  }

  return { pushed, conflicts };
};

const pull = async (onProgress?: (applied: number) => void): Promise<number> => {
  let pulled = 0;
  // Repeated cursors can replay already-applied data and burn network/CPU.
  const seenCursors = new Set<string>();

  for (let page = 0; page < MAX_PULL_PAGES; page += 1) {
    const cursor = await localRepository.getMeta<string>(META_SYNC_CURSOR);
    if (cursor) seenCursors.add(cursor);
    const params = new URLSearchParams({ limit: String(MAX_BATCH) });
    if (cursor) params.set("cursor", cursor);

    const response = await withCapability(
      `/sync/pull?${params.toString()}`,
      { method: "GET" },
    );
    const payload = response.payload;
    if (!response.ok)
      throw new Error(`Sync pull failed (HTTP ${response.status})`);

    const result = pullSyncResponseSchema.parse(payload);
    // When more data is claimed, the next cursor must never return to one
    // already requested in this cycle. Fail before persisting that page.
    if (result.hasMore && seenCursors.has(result.nextCursor))
      throw new Error("Sync pull cursor did not advance");
    await localRepository.applyServerPage(
      result.changes,
      result.tombstones,
      result.nextCursor,
    );
    const applied = result.changes.length + result.tombstones.length;
    pulled += applied;
    onProgress?.(applied);

    if (!result.hasMore) return pulled;
  }

  throw new Error("Sync pull exceeded the page safety limit");
};

const performSync = async (): Promise<SyncResult> => {
  const pendingBefore = (await localRepository.listOutbox()).length;

  if (API_MODE !== "live")
    return emit({
      state: "disabled",
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      pending: pendingBefore,
    });

  if (typeof navigator !== "undefined" && navigator.onLine === false)
    return emit({
      state: "offline",
      pushed: 0,
      pulled: 0,
      conflicts: 0,
      pending: pendingBefore,
    });

  emit({
    state: "syncing",
    pushed: 0,
    pulled: 0,
    conflicts: 0,
    pending: pendingBefore,
  });

  // Track durable progress as pages/ACKs are applied. A later failure must
  // not hide successful changes from SyncController/query invalidation.
  let pushedCount = 0;
  let pulledCount = 0;
  let conflictCount = 0;
  try {
    await push((accepted, conflicts) => {
      pushedCount += accepted;
      conflictCount += conflicts;
    });
    await pull((applied) => { pulledCount += applied; });
    const pending = (await localRepository.listOutbox()).length;
    return emit({
      // A partial/empty server reply must never label unsent edits as synced.
      state: conflictCount > 0 || pending > 0 ? "idle" : "synced",
      pushed: pushedCount,
      pulled: pulledCount,
      conflicts: conflictCount,
      pending,
    });
  } catch {
    const pending = (await localRepository.listOutbox()).length;
    return emit({
      state: "error",
      pushed: pushedCount,
      pulled: pulledCount,
      conflicts: conflictCount,
      pending,
    });
  }
};

export const syncNow = (): Promise<SyncResult> => {
  if (inFlight) return inFlight;
  inFlight = performSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
};
