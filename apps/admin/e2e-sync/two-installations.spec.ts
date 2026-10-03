import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

const DB_NAME = "GeoNexoLocalFirstDB";
const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const INSTALLATION_A = "22222222-2222-4222-8222-222222222221";
const INSTALLATION_B = "22222222-2222-4222-8222-222222222222";
const BOOTSTRAP_PROOF = `${"b".repeat(42)}A`;
const UPDATED_AT = "2026-10-03T00:00:00.000Z";

type ProjectPayload = {
  entity: "project";
  data: {
    id: string;
    name: string;
    description?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
};

type SyncOperation = {
  operationId: string;
  workspaceId: string;
  entity: "project";
  entityId: string;
  operation: "upsert";
  baseVersion: number | null;
  predecessorOperationId?: string;
  createdAt: string;
  payload: ProjectPayload;
};

type Receipt = {
  operationId: string;
  version: number;
  sequence: string;
  predecessorOperationId?: string;
};

type StoredEntity = {
  version: number;
  payload: ProjectPayload;
  operationId: string;
  sequence: string;
};

const cursorFor = (sequence: number): string =>
  `v1.${Buffer.from(String(sequence), "utf8").toString("base64url")}.${"a".repeat(43)}`;

const sequenceFromCursor = (cursor: string | null): number => {
  if (!cursor) return 0;
  const [, encoded] = cursor.split(".");
  if (!encoded) return 0;
  return Number(Buffer.from(encoded, "base64url").toString("utf8")) || 0;
};

class FakeSyncServer {
  private generation = 0;
  private currentBearer = "";
  private workspaceId = "";
  private bootstrapProof = "";
  private sequence = 0;
  private receipts = new Map<string, Receipt>();
  private entities = new Map<string, StoredEntity>();
  private changes: Array<{
    operationId: string;
    entity: "project";
    entityId: string;
    operation: "upsert";
    payload: ProjectPayload;
    version: number;
    sequence: string;
  }> = [];

  readonly stats = {
    provisions: 0,
    recoveries: 0,
    pushAttempts: 0,
    accepted: 0,
    alreadyApplied: 0,
    conflicts: 0,
    committedFailures: 0,
    pulls: 0,
  };

  failNextPushAfterCommit = false;
  lastProjectId: string | null = null;

  private rotateBearer(): string {
    this.generation += 1;
    const generation = this.generation.toString(36).padStart(2, "0").slice(-2);
    this.currentBearer = `${generation}${"x".repeat(40)}A`;
    return this.currentBearer;
  }

  private json(route: Route, status: number, body: unknown): Promise<void> {
    return route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  }

  private authorized(route: Route): boolean {
    return (
      route.request().headers().authorization ===
      `Bearer ${this.currentBearer}`
    );
  }

  async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");

    if (path === "/workspace/provision" && request.method() === "POST") {
      const body = request.postDataJSON() as {
        workspaceId: string;
        bootstrapProof: string;
      };
      if (
        this.bootstrapProof &&
        (body.bootstrapProof !== this.bootstrapProof ||
          body.workspaceId !== this.workspaceId)
      ) {
        await this.json(route, 409, { error: { code: "VALIDATION_ERROR" } });
        return;
      }
      this.bootstrapProof = body.bootstrapProof;
      this.workspaceId = body.workspaceId;
      this.stats.provisions += 1;
      await this.json(route, 201, {
        workspaceId: this.workspaceId,
        bearer: this.rotateBearer(),
        generation: String(this.generation),
        issuedAt: new Date().toISOString(),
      });
      return;
    }

    if (path === "/workspace/recover" && request.method() === "POST") {
      const body = request.postDataJSON() as { bootstrapProof: string };
      if (body.bootstrapProof !== this.bootstrapProof) {
        await this.json(route, 404, { error: { code: "VALIDATION_ERROR" } });
        return;
      }
      this.stats.recoveries += 1;
      await this.json(route, 200, {
        workspaceId: this.workspaceId,
        bearer: this.rotateBearer(),
        generation: String(this.generation),
        issuedAt: new Date().toISOString(),
      });
      return;
    }

    if (!this.authorized(route)) {
      await this.json(route, 401, { error: { code: "VALIDATION_ERROR" } });
      return;
    }

    if (path === "/sync/push" && request.method() === "POST") {
      this.stats.pushAttempts += 1;
      const body = request.postDataJSON() as { operations: SyncOperation[] };
      const accepted: Receipt[] = [];
      const alreadyApplied: Receipt[] = [];
      const conflicts: Array<{
        operationId: string;
        entity: "project";
        entityId: string;
        baseVersion: number | null;
        serverVersion: number;
        localPayload?: ProjectPayload;
        serverPayload?: ProjectPayload;
        reason: "VERSION_CONFLICT" | "SCOPE_REJECTED";
      }> = [];

      for (const operation of body.operations) {
        const receipt = this.receipts.get(operation.operationId);
        if (receipt) {
          alreadyApplied.push(receipt);
          this.stats.alreadyApplied += 1;
          continue;
        }

        if (operation.workspaceId !== this.workspaceId) {
          conflicts.push({
            operationId: operation.operationId,
            entity: operation.entity,
            entityId: operation.entityId,
            baseVersion: operation.baseVersion,
            serverVersion: 0,
            localPayload: operation.payload,
            reason: "SCOPE_REJECTED",
          });
          this.stats.conflicts += 1;
          continue;
        }

        const current = this.entities.get(operation.entityId);
        if (
          current &&
          operation.baseVersion !== current.version
        ) {
          conflicts.push({
            operationId: operation.operationId,
            entity: operation.entity,
            entityId: operation.entityId,
            baseVersion: operation.baseVersion,
            serverVersion: current.version,
            localPayload: operation.payload,
            serverPayload: current.payload,
            reason: "VERSION_CONFLICT",
          });
          this.stats.conflicts += 1;
          continue;
        }

        const version = (current?.version ?? 0) + 1;
        const sequence = String(++this.sequence);
        const receiptValue: Receipt = {
          operationId: operation.operationId,
          version,
          sequence,
          ...(operation.predecessorOperationId
            ? { predecessorOperationId: operation.predecessorOperationId }
            : {}),
        };
        this.receipts.set(operation.operationId, receiptValue);
        this.entities.set(operation.entityId, {
          version,
          payload: operation.payload,
          operationId: operation.operationId,
          sequence,
        });
        this.changes.push({
          operationId: operation.operationId,
          entity: "project",
          entityId: operation.entityId,
          operation: "upsert",
          payload: operation.payload,
          version,
          sequence,
        });
        this.lastProjectId = operation.entityId;
        accepted.push(receiptValue);
        this.stats.accepted += 1;
      }

      if (this.failNextPushAfterCommit && accepted.length > 0) {
        this.failNextPushAfterCommit = false;
        this.stats.committedFailures += 1;
        await this.json(route, 500, { error: { code: "INTERNAL_ERROR" } });
        return;
      }

      await this.json(route, 200, {
        accepted,
        alreadyApplied,
        conflicts,
      });
      return;
    }

    if (path === "/sync/pull" && request.method() === "GET") {
      this.stats.pulls += 1;
      const after = sequenceFromCursor(url.searchParams.get("cursor"));
      const changes = this.changes.filter(
        (change) => Number(change.sequence) > after,
      );
      await this.json(route, 200, {
        changes,
        tombstones: [],
        nextCursor: cursorFor(this.sequence),
        hasMore: false,
      });
      return;
    }

    await this.json(route, 404, { error: { code: "ROUTE_NOT_FOUND" } });
  }
}

async function seedInstallation(
  page: Page,
  installationId: string,
): Promise<void> {
  await page.goto("/manifest.json");
  await page.evaluate(
    async ({ dbName, workspaceId, bootstrapProof, installationId }) => {
      await new Promise<void>((resolve, reject) => {
        const remove = indexedDB.deleteDatabase(dbName);
        remove.onsuccess = () => resolve();
        remove.onerror = () => reject(remove.error);
        remove.onblocked = () =>
          reject(new Error("IndexedDB anterior permaneceu aberto"));
      });

      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          const meta = db.createObjectStore("meta", { keyPath: "key" });
          const entities = db.createObjectStore("entities", { keyPath: "key" });
          entities.createIndex("workspace", "workspaceId", { unique: false });
          entities.createIndex(
            "entity",
            ["workspaceId", "entity", "entityId"],
            { unique: true },
          );
          const originals = db.createObjectStore("originals", { keyPath: "key" });
          originals.createIndex("workspace", "workspaceId", { unique: false });
          const outbox = db.createObjectStore("outbox", { keyPath: "key" });
          outbox.createIndex("workspace", "workspaceId", { unique: false });
          outbox.createIndex(
            "entity",
            ["workspaceId", "entity", "entityId"],
            { unique: false },
          );
          outbox.createIndex(
            "workspaceSequence",
            ["workspaceId", "localSequence"],
            { unique: true },
          );
          const conflicts = db.createObjectStore("conflicts", { keyPath: "key" });
          conflicts.createIndex("workspace", "workspaceId", { unique: false });
          const acks = db.createObjectStore("acks", { keyPath: "key" });
          acks.createIndex("workspace", "workspaceId", { unique: false });
          void meta;
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("meta", "readwrite");
          const store = tx.objectStore("meta");
          store.put({ key: "workspaceId", value: workspaceId });
          store.put({ key: "workspaceBootstrapProof", value: bootstrapProof });
          store.put({ key: "installationId", value: installationId });
          store.put({ key: "outboxSequence", value: 0 });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
          tx.onabort = () => reject(tx.error);
        };
      });
    },
    {
      dbName: DB_NAME,
      workspaceId: WORKSPACE_ID,
      bootstrapProof: BOOTSTRAP_PROOF,
      installationId,
    },
  );
}

async function enqueueProjectUpdate(
  page: Page,
  entityId: string,
  operationId: string,
  name: string,
): Promise<void> {
  await page.evaluate(
    async ({ dbName, entityId, operationId, name, updatedAt }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(
            ["meta", "entities", "outbox"],
            "readwrite",
          );
          const meta = tx.objectStore("meta");
          const entities = tx.objectStore("entities");
          const outbox = tx.objectStore("outbox");
          const workspaceRequest = meta.get("workspaceId");

          workspaceRequest.onsuccess = () => {
            const workspaceId = (
              workspaceRequest.result as { value?: string } | undefined
            )?.value;
            if (!workspaceId) {
              tx.abort();
              return;
            }
            const key = `${workspaceId}:project:${entityId}`;
            const entityRequest = entities.get(key);
            entityRequest.onsuccess = () => {
              const current = entityRequest.result as
                | {
                    version: number;
                    payload: ProjectPayload;
                    predecessorOperationId?: string;
                  }
                | undefined;
              if (!current?.payload) {
                tx.abort();
                return;
              }
              const sequenceRequest = meta.get("outboxSequence");
              sequenceRequest.onsuccess = () => {
                const localSequence =
                  Number(
                    (
                      sequenceRequest.result as
                        | { value?: number }
                        | undefined
                    )?.value ?? 0,
                  ) + 1;
                const payload: ProjectPayload = {
                  entity: "project",
                  data: {
                    ...current.payload.data,
                    name,
                    updatedAt,
                  },
                };
                meta.put({ key: "outboxSequence", value: localSequence });
                entities.put({
                  ...current,
                  key,
                  workspaceId,
                  entity: "project",
                  entityId,
                  deleted: false,
                  payload,
                  updatedAt,
                  predecessorOperationId: operationId,
                });
                outbox.put({
                  key: operationId,
                  immutable: true,
                  localSequence,
                  operationId,
                  workspaceId,
                  entity: "project",
                  entityId,
                  operation: "upsert",
                  baseVersion: current.version,
                  ...(current.predecessorOperationId
                    ? {
                        predecessorOperationId:
                          current.predecessorOperationId,
                      }
                    : {}),
                  createdAt: updatedAt,
                  payload,
                });
              };
            };
          };

          tx.oncomplete = () => {
            db.close();
            window.dispatchEvent(new Event("geonexo-local-mutation"));
            resolve();
          };
          tx.onerror = () => reject(tx.error);
          tx.onabort = () =>
            reject(tx.error ?? new Error("Falha ao enfileirar atualização"));
        };
      }),
    {
      dbName: DB_NAME,
      entityId,
      operationId,
      name,
      updatedAt: UPDATED_AT,
    },
  );
}

async function installFakeApi(
  context: BrowserContext,
  server: FakeSyncServer,
): Promise<void> {
  await context.route("**/api/v1/**", (route) => server.handle(route));
}

test("duas instalações preservam retry/idempotência e expõem conflito sem sobrescrever", async ({
  browser,
}) => {
  const server = new FakeSyncServer();
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();

  try {
    await installFakeApi(contextA, server);
    await installFakeApi(contextB, server);

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    await seedInstallation(pageA, INSTALLATION_A);
    await seedInstallation(pageB, INSTALLATION_B);

    await pageA.goto("/projects");
    await pageB.goto("/projects");
    await expect.poll(() => server.stats.provisions).toBeGreaterThanOrEqual(2);

    await contextA.setOffline(true);
    await pageA
      .getByRole("button", { name: /Criar (Novo|Primeiro) Projeto/ })
      .first()
      .click();
    await pageA.getByLabel("Nome do Projeto *").fill("Projeto Compartilhado");
    await pageA.getByLabel("Descrição do projeto").fill("Sync E2E");
    await pageA.getByRole("button", { name: "Salvar Projeto" }).click();
    await expect(
      pageA.getByText("Projeto Compartilhado", { exact: true }),
    ).toBeVisible();

    server.failNextPushAfterCommit = true;
    await contextA.setOffline(false);
    await pageA.evaluate(() => window.dispatchEvent(new Event("online")));

    await expect
      .poll(() => server.stats.committedFailures)
      .toBe(1);
    await expect(
      pageA
        .getByRole("status")
        .filter({ hasText: "Não foi possível sincronizar" }),
    ).toBeVisible();

    await pageA.getByRole("button", { name: "Sincronizar" }).click();
    await expect
      .poll(() => server.stats.alreadyApplied)
      .toBeGreaterThanOrEqual(1);
    await expect
      .poll(() => server.stats.accepted)
      .toBe(1);

    const projectId = server.lastProjectId;
    expect(projectId).not.toBeNull();

    await pageB.evaluate(() => window.dispatchEvent(new Event("online")));
    await pageB.getByRole("button", { name: "Sincronizar" }).click();
    await expect(
      pageB.getByText("Projeto Compartilhado", { exact: true }),
    ).toBeVisible();

    await contextA.setOffline(true);
    await contextB.setOffline(true);
    await enqueueProjectUpdate(
      pageA,
      projectId!,
      "44444444-4444-4444-8444-444444444441",
      "Versão A",
    );
    await enqueueProjectUpdate(
      pageB,
      projectId!,
      "44444444-4444-4444-8444-444444444442",
      "Versão B",
    );

    await contextA.setOffline(false);
    await pageA.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => server.stats.accepted).toBe(2);

    await contextB.setOffline(false);
    await pageB.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect.poll(() => server.stats.conflicts).toBeGreaterThanOrEqual(1);

    await expect(
      pageB.getByRole("status").filter({ hasText: "1 conflito para revisar" }),
    ).toBeVisible();
    await pageB.getByRole("button", { name: "Resolver" }).click();

    pageB.once("dialog", (dialog) => void dialog.accept());
    await pageB
      .getByRole("button", { name: "Usar versão do servidor" })
      .click();

    await expect(pageB.getByText("Versão A", { exact: true })).toBeVisible();
    await expect(pageB.getByText("Versão B", { exact: true })).toHaveCount(0);

    expect(server.stats.accepted).toBe(2);
    expect(server.stats.alreadyApplied).toBeGreaterThanOrEqual(1);
    expect(server.stats.conflicts).toBeGreaterThanOrEqual(1);
    expect(server.stats.recoveries).toBeGreaterThanOrEqual(1);
  } finally {
    await Promise.all([contextA.close(), contextB.close()]);
  }
});
