import { webcrypto } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { syncNow, type SyncResult } from "./sync-engine";

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
}));

const { listOutbox, acknowledge, saveConflict, applyServerPage, workspaceId, getMeta, setMeta } =
  mocks;

vi.mock("../api-client", () => ({
  API_BASE: "https://api.test/api/v1",
  API_MODE: "live",
}));

vi.mock("../local-repositories", () => ({ localRepository: mocks }));

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
  getMeta.mockImplementation(async (key: string) => meta.get(key));
  setMeta.mockImplementation(async (key: string, value: unknown) => {
    meta.set(key, value);
  });
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
    resetOutbox();
    applyServerPage.mockReset().mockResolvedValue(undefined);
    workspaceId.mockReset().mockResolvedValue(WORKSPACE_ID);
    resetMeta({ workspaceCapability: capability });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
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
    expect(applyServerPage).toHaveBeenCalledWith(expect.anything(), [], cursor("bmV4dA"));
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
    expect(applyServerPage).toHaveBeenCalledWith([], expect.any(Array), cursor("dG9tYg"));
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