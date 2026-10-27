import { webcrypto } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recoverStaleSyncClaim, resumeRecoveryPause, syncNow, type SyncResult } from "./sync-engine";

// `vi.mock` é içado para o topo do arquivo, então as duplicatas precisam ser
// criadas dentro de `vi.hoisted` para existirem quando o factory roda.
const mocks = vi.hoisted(() => ({
  listOutbox: vi.fn(),
  acknowledge: vi.fn(),
  saveConflict: vi.fn(),
  applyServerPage: vi.fn(),
  workspaceId: vi.fn(),
  getMeta: vi.fn(),
  setMeta: vi.fn(),
  saveWorkspaceCapability: vi.fn(),
  ensureBootstrapIdentity: vi.fn(),
  transact: vi.fn(),
}));

const { listOutbox, acknowledge, saveConflict, applyServerPage, workspaceId, getMeta, setMeta, saveWorkspaceCapability, ensureBootstrapIdentity } =
  mocks;

vi.mock("../api-client", () => ({
  API_BASE: "https://api.test/api/v1",
  API_MODE: "live",
}));

vi.mock("../local-repositories", () => ({ localRepository: mocks }));
vi.mock("../local-db", () => ({
  localDb: { transact: mocks.transact },
  requestValue: (request: IDBRequest) => new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }),
}));

const PAUSE_A = { kind: "restore", generation: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
const PAUSE_B = { kind: "restore", generation: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_WORKSPACE_ID = "33333333-3333-4333-8333-333333333333";
const FEATURE_ID = "44444444-4444-4444-8444-444444444444";
const CREATED_AT = "2026-01-01T00:00:00.000Z";

/** `bearer` precisa de 42 caracteres base64url + 1 dígito de paridade (U-R). */
const BEARER = `${"a".repeat(42)}U`;

const capability = {
  workspaceId: WORKSPACE_ID,
  bearer: BEARER,
  generation: "1",
  issuedAt: CREATED_AT,
};

/** Cursor v1.<base64url>.<base64url de 43> conforme `syncCursorSchema`. */
const cursor = (token: string): string => `v1.${token}.${"b".repeat(43)}`;

const projectPayload = (id: string) => ({
  entity: "project" as const,
  data: {
    id,
    name: "Campo norte",
    status: "active",
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  },
});

const operation = (id: string, entityId = PROJECT_ID) => ({
  operationId: id,
  entity: "project",
  entityId,
  predecessorOperationId: undefined,
  payload: projectPayload(entityId),
  recordedAt: CREATED_AT,
});

const ack = (operationId: string, sequence = "1") => ({
  operationId,
  version: 1,
  sequence,
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const emptyPull = {
  changes: [],
  tombstones: [],
  nextCursor: cursor("Y2xvc2Vk"),
  hasMore: false,
};

/** jsdom não expõe estado de rede confiável; o motor só lê `navigator.onLine`. */
const setOnline = (online: boolean): void => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: online });
};

const pathsOf = (): string[] => vi.mocked(fetch).mock.calls.map((call) => String(call[0]));

function installWebLocks() {
  let held = false;
  const request = vi.fn(async (_name: string, _options: unknown, work: (lock: object | null) => Promise<unknown>) => {
    if (held) return work(null);
    held = true;
    try { return await work({ name: "markmap-sync-recovery-v1", mode: "exclusive" }); }
    finally { held = false; }
  });
  Object.defineProperty(navigator, "locks", { configurable: true, value: { request } });
  return { request, setHeld: (value: boolean) => { held = value; } };
}

/**
 * Outbox em memória.
 *
 * O motor lê a outbox várias vezes por ciclo (`pendingBefore`, cada iteração do
 * lote, `pending` final) e a entrada só some quando é confirmada. Uma resposta
 * fixa por chamada quebraria essa ordem, então `acknowledge` remove de fato a
 * operação e `listOutbox` sempre reflete o estado corrente.
 *
 * O filtro reproduz o `listOutbox` real (local-repositories/index.ts), que
 * esconde da fila tanto as operações já confirmadas quanto as que voltaram como
 * conflito. Sem isso o motor reenviaria a operação em conflito para sempre.
 */
let outbox: { operationId: string }[] = [];
let conflicted = new Set<string>();

const resetOutbox = (operations: { operationId: string }[] = []): void => {
  outbox = [...operations];
  conflicted = new Set();
  listOutbox.mockImplementation(
    async () => outbox.filter((entry) => !conflicted.has(entry.operationId)) as never,
  );
  acknowledge.mockImplementation(async (operationId: string) => {
    outbox = outbox.filter((entry) => entry.operationId !== operationId);
    return true;
  });
  saveConflict.mockImplementation(async (conflict: { operationId: string }) => {
    conflicted.add(conflict.operationId);
  });
};

/** Lote de uma operação que deve ser enviada uma única vez. */
const singlePush = (operationId: string): void => resetOutbox([operation(operationId)]);

/**
 * Store de metadados em memória.
 *
 * Sem ele `getMeta` responderia sempre `undefined` e o motor reprovisionaria a
 * capability a cada chamada, consumindo respostas extras de `fetch`. O store
 * reproduz o comportamento real: provisionar grava, e a chamada seguinte lê.
 */
let meta = new Map<string, unknown>();

const resetMeta = (initial: Record<string, unknown> = {}): void => {
  meta = new Map(Object.entries(initial));
  mocks.transact.mockReset().mockImplementation(async (_stores, _mode, work) => {
    const copy = new Map(meta);
    const store = {
      get: (key: string) => {
        const request = { result: copy.has(key) ? { key, value: copy.get(key) } : undefined, onsuccess: null } as unknown as IDBRequest;
        void Promise.resolve().then(() => request.onsuccess?.(new Event("success")));
        return request;
      },
      put: (row: { key: string; value: unknown }) => copy.set(row.key, row.value),
      add: (row: { key: string; value: unknown }) => {
        if (copy.has(row.key)) throw new Error("Chave duplicada");
        copy.set(row.key, row.value);
      },
      delete: (key: string) => copy.delete(key),
    };
    const result = await work({ store: () => store });
    meta = copy;
    return result;
  });
  getMeta.mockImplementation(async (key: string) => meta.get(key));
  setMeta.mockImplementation(async (key: string, value: unknown) => {
    meta.set(key, value);
  });
  saveWorkspaceCapability.mockImplementation(async (value: unknown) => {
    meta.set("workspaceCapability", value);
    return value;
  });
  ensureBootstrapIdentity.mockImplementation(async (factory: () => unknown) => factory());
};

const emitStatus = async (): Promise<SyncResult[]> => {
  const seen: SyncResult[] = [];
  const listener = (event: Event) => seen.push((event as CustomEvent<SyncResult>).detail);
  window.addEventListener("geonexo-sync-status", listener);
  try {
    await syncNow();
  } finally {
    window.removeEventListener("geonexo-sync-status", listener);
  }
  return seen;
};

describe("syncNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setOnline(true);
    // jsdom não expõe `crypto.getRandomValues`, usado pelo bootstrap proof.
    vi.stubGlobal("crypto", webcrypto);
    listOutbox.mockReset();
    acknowledge.mockReset();
    saveConflict.mockReset();
    saveWorkspaceCapability.mockReset();
    ensureBootstrapIdentity.mockReset();
    resetOutbox();
    applyServerPage.mockReset().mockResolvedValue(undefined);
    workspaceId.mockReset().mockResolvedValue(WORKSPACE_ID);
    resetMeta({ workspaceCapability: capability });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    Reflect.deleteProperty(navigator, "locks");
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("pausa persistente bloqueia rede e bootstrap", async () => {
    resetMeta({ syncPausedAfterRestore: PAUSE_A, workspaceCapability: capability });
    resetOutbox([operation("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")]);
    expect((await syncNow()).state).toBe("paused");
    expect(fetch).not.toHaveBeenCalled();
    expect(workspaceId).not.toHaveBeenCalled();
    expect(ensureBootstrapIdentity).not.toHaveBeenCalled();
    expect(acknowledge).not.toHaveBeenCalled();
    expect(outbox).toHaveLength(1);
  });

  it.each([true, "inválido"])("marcador legado ou inválido não permite sync nem retomada (%s)", async (pause) => {
    resetMeta({ syncPausedAfterRestore: pause, workspaceCapability: capability });
    expect((await syncNow()).state).toBe("blocked");
    expect(await resumeRecoveryPause(PAUSE_A.generation)).toBe(false);
    expect(meta.get("syncPausedAfterRestore")).toEqual(pause);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falha ao ler pausa bloqueia a rede", async () => {
    getMeta.mockRejectedValue(new Error("IndexedDB indisponível"));
    expect((await syncNow()).state).toBe("blocked");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("restauração que pausa após leitura inicial impede aquisição e rede", async () => {
    listOutbox.mockImplementationOnce(async () => {
      meta.set("syncPausedAfterRestore", PAUSE_A);
      return [];
    });
    expect((await syncNow()).state).toBe("paused");
    expect(meta.get("syncPausedAfterRestore")).toEqual(PAUSE_A);
    expect(meta.has("syncInProgress")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("claim ocupado ou leitura transacional falha impedem rede sem apagar lock", async () => {
    meta.set("syncInProgress", "outra-aba");
    expect((await syncNow()).state).toBe("locked");
    expect(meta.get("syncInProgress")).toBe("outra-aba");
    expect(fetch).not.toHaveBeenCalled();
    meta.delete("syncInProgress");
    mocks.transact.mockRejectedValueOnce(new Error("transação indisponível"));
    expect((await syncNow()).state).toBe("blocked");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("Web Lock ocupado impede claim e rede", async () => {
    const locks = installWebLocks();
    locks.setHeld(true);
    expect((await syncNow()).state).toBe("locked");
    expect(meta.has("syncInProgress")).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("mantém Web Lock até terminar a rede e nunca recupera claim ativo", async () => {
    installWebLocks();
    let start!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    let finish!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    vi.mocked(fetch).mockImplementationOnce(async () => {
      start();
      await waiting;
      return json(emptyPull);
    });
    const running = syncNow();
    await started;
    const claim = meta.get("syncInProgress") as { protocol: string; token: string };
    expect(claim).toMatchObject({ protocol: "weblocks-v1", token: expect.any(String) });
    expect(await recoverStaleSyncClaim(claim.token)).toBe(false);
    expect(meta.get("syncInProgress")).toEqual(claim);
    finish();
    expect((await running).state).toBe("synced");
    expect(meta.has("syncInProgress")).toBe(false);
  });

  it("recupera claim versionado de dono ausente sem alterar pausa ou iniciar sync", async () => {
    installWebLocks();
    const token = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    resetMeta({ syncInProgress: { protocol: "weblocks-v1", token }, syncPausedAfterRestore: PAUSE_A });
    expect(await recoverStaleSyncClaim(token)).toBe(true);
    expect(meta.has("syncInProgress")).toBe(false);
    expect(meta.get("syncPausedAfterRestore")).toEqual(PAUSE_A);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("ao revisar claim sem pausa cria uma pausa antes de permitir novo sync", async () => {
    installWebLocks();
    const token = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    resetMeta({ syncInProgress: { protocol: "weblocks-v1", token } });
    expect(await recoverStaleSyncClaim(token)).toBe(true);
    expect(meta.get("syncPausedAfterRestore")).toMatchObject({ kind: "restore", generation: expect.any(String) });
    expect((await syncNow()).state).toBe("paused");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("release não apaga claim versionado substituído durante o sync", async () => {
    installWebLocks();
    let start!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    let finish!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    vi.mocked(fetch).mockImplementationOnce(async () => {
      start();
      await waiting;
      return json(emptyPull);
    });
    const running = syncNow();
    await started;
    const replacement = { protocol: "weblocks-v1", token: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" };
    meta.set("syncInProgress", replacement);
    finish();
    expect((await running).state).toBe("locked");
    expect(meta.get("syncInProgress")).toEqual(replacement);
  });

  it("não apaga token substituído, legado ou malformado", async () => {
    installWebLocks();
    const old = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const replacement = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    for (const marker of [{ protocol: "weblocks-v1", token: replacement }, old,
      { protocol: "weblocks-v1", token: old, extra: true }]) {
      meta.set("syncInProgress", marker);
      expect(await recoverStaleSyncClaim(old)).toBe(false);
      expect(meta.get("syncInProgress")).toEqual(marker);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fallback sem Web Locks usa claim legado e não permite removê-lo automaticamente", async () => {
    const old = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    meta.set("syncInProgress", old);
    expect(await recoverStaleSyncClaim(old)).toBe(false);
    expect(meta.get("syncInProgress")).toBe(old);
    expect((await syncNow()).state).toBe("locked");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falha da API Web Locks bloqueia a rede e a recuperação", async () => {
    Object.defineProperty(navigator, "locks", { configurable: true, value: {
      request: vi.fn().mockRejectedValue(new Error("sem acesso")),
    } });
    const token = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect((await syncNow()).state).toBe("blocked");
    meta.set("syncInProgress", { protocol: "weblocks-v1", token });
    expect(await recoverStaleSyncClaim(token)).toBe(false);
    expect(meta.has("syncInProgress")).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("não remove claim substituído por outro token ao terminar", async () => {
    let start!: () => void;
    const started = new Promise<void>(resolve => { start = resolve; });
    let finish!: () => void;
    const waiting = new Promise<void>(resolve => { finish = resolve; });
    vi.mocked(fetch).mockImplementationOnce(async () => {
      start();
      await waiting;
      return json(emptyPull);
    });
    const running = syncNow();
    await started;
    expect(meta.get("syncInProgress")).toEqual(expect.any(String));
    meta.set("syncInProgress", "token-de-outro-sync");
    finish();
    expect((await running).state).toBe("locked");
    expect(meta.get("syncInProgress")).toBe("token-de-outro-sync");
  });

  it("CAS não remove pausa de outro restore nem um claim concorrente", async () => {
    resetMeta({ syncPausedAfterRestore: PAUSE_B });
    expect(await resumeRecoveryPause(PAUSE_A.generation)).toBe(false);
    expect(meta.get("syncPausedAfterRestore")).toEqual(PAUSE_B);
    meta.set("syncPausedAfterRestore", PAUSE_A);
    meta.set("syncInProgress", "outra-aba");
    expect(await resumeRecoveryPause(PAUSE_A.generation)).toBe(false);
    expect(meta.get("syncPausedAfterRestore")).toEqual(PAUSE_A);
    expect(meta.get("syncInProgress")).toBe("outra-aba");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("somente retoma a rede após remover explicitamente a pausa", async () => {
    resetMeta({ syncPausedAfterRestore: PAUSE_A, workspaceCapability: capability });
    expect((await syncNow()).state).toBe("paused");
    expect(fetch).not.toHaveBeenCalled();
    expect(await resumeRecoveryPause(PAUSE_A.generation)).toBe(true);
    vi.mocked(fetch).mockResolvedValueOnce(json(emptyPull));
    expect((await syncNow()).state).toBe("synced");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("não toca na rede e preserva a outbox enquanto offline", async () => {
    setOnline(false);
    listOutbox.mockResolvedValue([operation("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")]);

    const result = await syncNow();

    expect(result.state).toBe("offline");
    expect(result.pending).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("esvazia a outbox quando o servidor aceita o lote", async () => {
    const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const b = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    resetOutbox([operation(a), operation(b)]);
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ accepted: [ack(a), ack(b)], alreadyApplied: [], conflicts: [] }))
      .mockResolvedValueOnce(json(emptyPull));

    const result = await syncNow();

    expect(result.state).toBe("synced");
    expect(result.pushed).toBe(2);
    expect(result.pending).toBe(0);
    expect(acknowledge).toHaveBeenCalledTimes(2);
  });

  it("confirma uma operação já aplicada sem duplicar o efeito", async () => {
    const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    singlePush(a);
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ accepted: [], alreadyApplied: [ack(a)], conflicts: [] }))
      .mockResolvedValueOnce(json(emptyPull));

    const result = await syncNow();

    expect(result.pushed).toBe(1);
    expect(result.pending).toBe(0);
    expect(acknowledge).toHaveBeenCalledTimes(1);
  });

  it("mantém a outbox intacta quando o push devolve HTTP 500", async () => {
    listOutbox.mockResolvedValue([operation("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")]);
    vi.mocked(fetch).mockResolvedValue(json({ message: "boom" }, 500));

    const result = await syncNow();

    expect(result.state).toBe("error");
    expect(result.pending).toBe(1);
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("descarrega a outbox na tentativa seguinte após HTTP 500", async () => {
    const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    resetOutbox([operation(a)]);
    vi.mocked(fetch)
      .mockResolvedValueOnce(json({ message: "boom" }, 500))
      .mockResolvedValueOnce(json({ accepted: [ack(a)], alreadyApplied: [], conflicts: [] }))
      .mockResolvedValueOnce(json(emptyPull));

    expect((await syncNow()).state).toBe("error");
    expect((await syncNow()).state).toBe("synced");
    expect(acknowledge).toHaveBeenCalledTimes(1);
  });

  it("não confirma nada quando a requisição estoura o tempo limite", async () => {
    listOutbox.mockResolvedValue([operation("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")]);
    vi.mocked(fetch).mockImplementation((_url, init) => {
      const signal = (init as RequestInit).signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () =>
          reject(new DOMException("Aborted", "AbortError")),
        );
      });
    });

    const promise = syncNow();
    await vi.advanceTimersByTimeAsync(20_000);
    const result = await promise;

    expect(result.state).toBe("error");
    expect(result.pending).toBe(1);
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("registra conflito e devolve a escolha para a interface", async () => {
    const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    singlePush(a);
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        json({
          accepted: [],
          alreadyApplied: [],
          conflicts: [
            {
              operationId: a,
              entity: "feature",
              entityId: FEATURE_ID,
              baseVersion: 1,
              serverVersion: 3,
              reason: "VERSION_CONFLICT",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(json(emptyPull));

    const result = await syncNow();

    expect(result.conflicts).toBe(1);
    expect(result.state).toBe("idle");
    expect(saveConflict).toHaveBeenCalledTimes(1);
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("faz pull incremental a partir do cursor já salvo", async () => {
    getMeta.mockImplementation(async (key: string) => {
      if (key === "workspaceCapability") return capability;
      if (key === "syncCursor") return cursor("Y3Vyc29yNw");
      return undefined;
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        json({
          changes: [
            {
              operationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              entity: "project",
              entityId: PROJECT_ID,
              operation: "upsert",
              payload: projectPayload(PROJECT_ID),
              version: 1,
              sequence: "7",
            },
          ],
          tombstones: [],
          nextCursor: cursor("bmV4dA"),
          hasMore: false,
        }),
      );

    const result = await syncNow();

    expect(result.pulled).toBe(1);
    expect(pathsOf()[0]).toContain(`cursor=${encodeURIComponent(cursor("Y3Vyc29yNw"))}`);
    expect(applyServerPage).toHaveBeenCalledWith(expect.anything(), [], cursor("bmV4dA"), { expectedCursor: cursor("Y3Vyc29yNw") });
  });

  it("aplica tombstones recebidos do servidor", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        json({
          changes: [],
          tombstones: [
            {
              entity: "feature",
              entityId: FEATURE_ID,
              version: 2,
              sequence: "9",
              deletedAt: CREATED_AT,
            },
          ],
          nextCursor: cursor("dG9tYg"),
          hasMore: false,
        }),
      );

    const result = await syncNow();

    expect(result.pulled).toBe(1);
    expect(applyServerPage).toHaveBeenCalledWith([], expect.any(Array), cursor("dG9tYg"), { expectedCursor: undefined });
  });

  it("provisiona a capability e envia o bearer no push", async () => {
    resetMeta();
    const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    singlePush(a);
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(capability)) // provision
      .mockResolvedValueOnce(json({ accepted: [ack(a)], alreadyApplied: [], conflicts: [] }))
      .mockResolvedValueOnce(json(emptyPull));

    const result = await syncNow();

    expect(result.state).toBe("synced");
    expect(pathsOf().some((path) => path.endsWith("/workspace/provision"))).toBe(true);
    const pushCall = vi.mocked(fetch).mock.calls.find((call) =>
      String(call[0]).endsWith("/sync/push"),
    );
    const headers = (pushCall?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined;
    expect(headers?.Authorization).toBe(`Bearer ${BEARER}`);
  });

  it("recupera a capability e repete a requisição ao receber 401", async () => {
    const a = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    resetMeta();
    singlePush(a);
    vi.mocked(fetch)
      .mockResolvedValueOnce(json(capability)) // provision
      .mockResolvedValueOnce(json({ message: "expired" }, 401)) // push
      .mockResolvedValueOnce(json(capability)) // recover
      .mockResolvedValueOnce(json({ accepted: [ack(a)], alreadyApplied: [], conflicts: [] }))
      .mockResolvedValueOnce(json(emptyPull)); // pull

    const result = await syncNow();

    expect(result.state).toBe("synced");
    expect(pathsOf().some((path) => path.endsWith("/workspace/recover"))).toBe(true);
    expect(meta.get("workspaceCapability")).toMatchObject({ workspaceId: WORKSPACE_ID });
  });

  it("recusa capability pertencente a outro workspace", async () => {
    resetMeta();
    workspaceId.mockResolvedValue(WORKSPACE_ID);
    vi.mocked(fetch).mockResolvedValueOnce(json({ ...capability, workspaceId: OTHER_WORKSPACE_ID }));

    const result = await syncNow();

    expect(result.state).toBe("error");
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("emite syncing e synced para a interface", async () => {
    resetOutbox();
    vi.mocked(fetch).mockResolvedValueOnce(json(emptyPull));

    const states = (await emitStatus()).map((status) => status.state);

    expect(states).toEqual(["syncing", "synced"]);
  });
});
