import {
  capabilityProvisionResponseSchema,
  pullSyncResponseSchema,
  pushSyncResponseSchema,
  type WorkspaceCapability,
} from "@markmap/contracts";

import { API_BASE, API_MODE } from "../api-client";
import { localRepository } from "../local-repositories";
import { localDb, requestValue } from "../local-db";

export type SyncState =
  | "disabled"
  | "paused"
  | "locked"
  | "blocked"
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

const META_CAPABILITY = "workspaceCapability";
const META_SYNC_CURSOR = "syncCursor";
export const RECOVERY_SYNC_PAUSE_KEY = "syncPausedAfterRestore";
export const SYNC_ACTIVE_KEY = "syncInProgress";
const SYNC_WEB_LOCK = "markmap-sync-recovery-v1";
const WEB_LOCK_PROTOCOL = "weblocks-v1";

export function webLockClaimToken(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const claim = value as { protocol?: unknown; token?: unknown };
  if (Object.keys(value).length !== 2 || claim.protocol !== WEB_LOCK_PROTOCOL ||
      typeof claim.token !== "string" ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(claim.token)) return null;
  return claim.token;
}

/** Caller must obtain explicit operator confirmation for the observed token. */
export async function recoverStaleSyncClaim(expectedToken: string): Promise<boolean> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== "function" ||
      !webLockClaimToken({ protocol: WEB_LOCK_PROTOCOL, token: expectedToken })) return false;
  try {
    const generation = crypto.randomUUID();
    return await locks.request(SYNC_WEB_LOCK, { mode: "exclusive", ifAvailable: true }, async (lock) => {
      if (!lock) return false;
      return localDb.transact(["meta"], "readwrite", async (tx) => {
        const store = tx.store("meta");
        const [current, pause] = await Promise.all([
          requestValue<{ value: unknown } | undefined>(store.get(SYNC_ACTIVE_KEY)),
          requestValue<{ value: unknown } | undefined>(store.get(RECOVERY_SYNC_PAUSE_KEY)),
        ]);
        if (!current || webLockClaimToken(current.value) !== expectedToken) return false;
        store.delete(SYNC_ACTIVE_KEY);
        // Clearing a crash claim must not let a periodic sync run without review.
        if (pause === undefined || pause.value === false)
          store.put({ key: RECOVERY_SYNC_PAUSE_KEY, value: { kind: "restore", generation } });
        return true;
      });
    });
  } catch {
    return false;
  }
}

/** Unknown or legacy markers are never interpreted as authorization to sync. */
export function recoveryPauseGeneration(marker: unknown): string | null {
  if (!marker || typeof marker !== "object" || Array.isArray(marker)) return null;
  const value = marker as { kind?: unknown; generation?: unknown };
  return value.kind === "restore" && typeof value.generation === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.generation)
    ? value.generation : null;
}

/** Clear only the exact pause presented to the operator and only without a claim. */
export async function resumeRecoveryPause(expectedGeneration: string): Promise<boolean> {
  try {
    return await localDb.transact(["meta"], "readwrite", async (tx) => {
      const store = tx.store("meta");
      const [pause, active] = await Promise.all([
        requestValue<{ value: unknown } | undefined>(store.get(RECOVERY_SYNC_PAUSE_KEY)),
        requestValue<unknown>(store.get(SYNC_ACTIVE_KEY)),
      ]);
      const currentGeneration = pause && recoveryPauseGeneration(pause.value);
      if (active !== undefined || !currentGeneration || currentGeneration !== expectedGeneration) return false;
      store.put({ key: RECOVERY_SYNC_PAUSE_KEY, value: false });
      return true;
    });
  } catch {
    return false;
  }
}
const MAX_BATCH = 500;
const MAX_PULL_PAGES = 50;
const REQUEST_TIMEOUT_MS = 15_000;

let inFlight: Promise<SyncResult> | null = null;

// This durable claim coordinates cooperating tabs with restore. A crash leaves
// the claim in place; never guess that an unknown or old token is safe to clear.
async function claimSync(webLocked: boolean): Promise<{ token: string } | { state: "paused" | "locked" | "blocked" }> {
  try {
    const token = crypto.randomUUID();
    return await localDb.transact(["meta"], "readwrite", async (tx) => {
      const store = tx.store("meta");
      const [pause, active] = await Promise.all([
        requestValue<{ value: unknown } | undefined>(store.get(RECOVERY_SYNC_PAUSE_KEY)),
        requestValue<unknown>(store.get(SYNC_ACTIVE_KEY)),
      ]);
      if (active !== undefined) return { state: "locked" as const };
      if (pause !== undefined && pause.value !== false)
        return { state: recoveryPauseGeneration(pause.value) ? "paused" as const : "blocked" as const };
      store.add({ key: SYNC_ACTIVE_KEY, value: webLocked ? { protocol: WEB_LOCK_PROTOCOL, token } : token });
      return { token };
    });
  } catch {
    return { state: "blocked" };
  }
}

async function releaseSync(token: string, webLocked: boolean): Promise<boolean> {
  try {
    return await localDb.transact(["meta"], "readwrite", async (tx) => {
      const store = tx.store("meta");
      const current = await requestValue<{ value: unknown } | undefined>(store.get(SYNC_ACTIVE_KEY));
      if ((webLocked ? webLockClaimToken(current?.value) : current?.value) !== token) return false;
      store.delete(SYNC_ACTIVE_KEY);
      return true;
    });
  } catch {
    return false;
  }
}

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
  const identity = await localRepository.ensureBootstrapIdentity(() => ({
    installationId: crypto.randomUUID(),
    bootstrapProof: randomProof(),
  }));
  return { workspaceId, ...identity };
};

const saveCapability = async (
  candidate: unknown,
): Promise<WorkspaceCapability> => {
  const capability = capabilityProvisionResponseSchema.parse(candidate);
  const localWorkspaceId = await localRepository.workspaceId();
  if (capability.workspaceId !== localWorkspaceId)
    throw new Error("Workspace capability does not match this device.");
  return localRepository.saveWorkspaceCapability(capability);
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

  // A second PWA tab may already have recovered a newer bearer while this
  // request was in flight. Try that durable capability before rotating again.
  const stored = await localRepository.getMeta<WorkspaceCapability>(META_CAPABILITY);
  if (
    stored?.workspaceId === current.workspaceId &&
    BigInt(stored.generation) > BigInt(current.generation)
  ) {
    current = capabilityProvisionResponseSchema.parse(stored);
    response = await request(path, init, current.bearer);
    if (response.status !== 401) return response;
  }

  current = await recoverCapability();
  return request(path, init, current.bearer);
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
    if (!response.ok) {
      // Capability renewal can invalidate the cursor after the URL was built.
      // Retry only if a concurrent, durable transaction changed the cursor;
      // never erase an unrelated malformed cursor in response to HTTP 400.
      if (
        response.status === 400 &&
        (await localRepository.getMeta<string>(META_SYNC_CURSOR)) !== cursor
      ) continue;
      throw new Error(`Sync pull failed (HTTP ${response.status})`);
    }
    // Another tab may have advanced/reset the cursor during the request.
    // Re-fetch rather than attempt to commit an out-of-date page.
    if ((await localRepository.getMeta<string>(META_SYNC_CURSOR)) !== cursor)
      continue;

    const result = pullSyncResponseSchema.parse(payload);
    // When more data is claimed, the next cursor must never return to one
    // already requested in this cycle. Fail before persisting that page.
    if (result.hasMore && seenCursors.has(result.nextCursor))
      throw new Error("Sync pull cursor did not advance");
    await localRepository.applyServerPage(
      result.changes,
      result.tombstones,
      result.nextCursor,
      { expectedCursor: cursor },
    );
    const applied = result.changes.length + result.tombstones.length;
    pulled += applied;
    onProgress?.(applied);

    if (!result.hasMore) return pulled;
  }

  throw new Error("Sync pull exceeded the page safety limit");
};

const performSync = async (): Promise<SyncResult> => {
  // Check the durable gate before bootstrap, capability provisioning, or fetch.
  // Read failures and malformed markers fail closed.
  let pause: unknown;
  try {
    pause = await localRepository.getMeta<unknown>(RECOVERY_SYNC_PAUSE_KEY);
  } catch {
    return emit({ state: "blocked", pushed: 0, pulled: 0, conflicts: 0, pending: 0 });
  }
  if (pause !== undefined && pause !== false) {
    return emit({ state: recoveryPauseGeneration(pause) ? "paused" : "blocked",
      pushed: 0, pulled: 0, conflicts: 0, pending: 0 });
  }
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

  const runClaimed = async (webLocked: boolean): Promise<SyncResult> => {
    // Restore checks this claim in its transaction before writing any records.
    const claim = await claimSync(webLocked);
    if ("state" in claim)
      return emit({ state: claim.state, pushed: 0, pulled: 0, conflicts: 0, pending: pendingBefore });

    emit({ state: "syncing", pushed: 0, pulled: 0, conflicts: 0, pending: pendingBefore });
    let pushedCount = 0;
    let pulledCount = 0;
    let conflictCount = 0;
    let result: SyncResult;
    try {
      // Retain durable progress even if a subsequent page or request fails.
      await push((accepted, conflicts) => { pushedCount += accepted; conflictCount += conflicts; });
      await pull((applied) => { pulledCount += applied; });
      const pending = (await localRepository.listOutbox()).length;
      result = { state: conflictCount > 0 || pending > 0 ? "idle" : "synced",
        pushed: pushedCount, pulled: pulledCount, conflicts: conflictCount, pending };
    } catch {
      // Even a failed local read must release only this operation's claim.
      const pending = await localRepository.listOutbox().then(rows => rows.length, () => pendingBefore);
      result = { state: "error", pushed: pushedCount, pulled: pulledCount, conflicts: conflictCount, pending };
    }
    const released = await releaseSync(claim.token, webLocked);
    return released ? emit(result) : emit({ ...result, state: "locked" });
  };

  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  // Legacy tabs cannot participate in this protocol. A previously sent request
  // may also have reached the server even after its owner disappears.
  if (!locks || typeof locks.request !== "function") return runClaimed(false);
  try {
    return await locks.request(SYNC_WEB_LOCK, { mode: "exclusive", ifAvailable: true },
      async (lock) => lock ? runClaimed(true) : emit({
        state: "locked", pushed: 0, pulled: 0, conflicts: 0, pending: pendingBefore,
      }));
  } catch {
    return emit({ state: "blocked", pushed: 0, pulled: 0, conflicts: 0, pending: pendingBefore });
  }
};

export const syncNow = (): Promise<SyncResult> => {
  if (inFlight) return inFlight;
  inFlight = performSync().finally(() => {
    inFlight = null;
  });
  return inFlight;
};
