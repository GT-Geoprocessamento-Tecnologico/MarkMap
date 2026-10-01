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

const request = async (
  path: string,
  init: RequestInit,
  bearer?: string,
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
};

const parseJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return undefined;
  return JSON.parse(text) as unknown;
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
  const payload = await parseJson(response);
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
  const payload = await parseJson(response);
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
): Promise<Response> => {
  let current = await capability();
  let response = await request(path, init, current.bearer);
  if (response.status !== 401) return response;

  current = await recoverCapability();
  response = await request(path, init, current.bearer);
  return response;
};

const push = async (): Promise<{ pushed: number; conflicts: number }> => {
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
    const payload = await parseJson(response);
    if (!response.ok)
      throw new Error(`Sync push failed (HTTP ${response.status})`);

    const result = pushSyncResponseSchema.parse(payload);
    for (const ack of [...result.accepted, ...result.alreadyApplied]) {
      await localRepository.acknowledge(
        ack.operationId,
        ack.version,
        ack.sequence,
        ack.predecessorOperationId,
      );
      pushed += 1;
    }
    for (const conflict of result.conflicts) {
      await localRepository.saveConflict(conflict);
      conflicts += 1;
    }

    if (
      result.accepted.length +
        result.alreadyApplied.length +
        result.conflicts.length ===
      0
    )
      break;
  }

  return { pushed, conflicts };
};

const pull = async (): Promise<number> => {
  let pulled = 0;

  for (let page = 0; page < MAX_PULL_PAGES; page += 1) {
    const cursor = await localRepository.getMeta<string>(META_SYNC_CURSOR);
    const params = new URLSearchParams({ limit: String(MAX_BATCH) });
    if (cursor) params.set("cursor", cursor);

    const response = await withCapability(
      `/sync/pull?${params.toString()}`,
      { method: "GET" },
    );
    const payload = await parseJson(response);
    if (!response.ok)
      throw new Error(`Sync pull failed (HTTP ${response.status})`);

    const result = pullSyncResponseSchema.parse(payload);
    await localRepository.applyServerPage(
      result.changes,
      result.tombstones,
      result.nextCursor,
    );
    pulled += result.changes.length + result.tombstones.length;

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

  try {
    const pushed = await push();
    const pulled = await pull();
    const pending = (await localRepository.listOutbox()).length;
    return emit({
      state: pushed.conflicts > 0 ? "idle" : "synced",
      pushed: pushed.pushed,
      pulled,
      conflicts: pushed.conflicts,
      pending,
    });
  } catch {
    const pending = (await localRepository.listOutbox()).length;
    return emit({
      state: "error",
      pushed: 0,
      pulled: 0,
      conflicts: 0,
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
