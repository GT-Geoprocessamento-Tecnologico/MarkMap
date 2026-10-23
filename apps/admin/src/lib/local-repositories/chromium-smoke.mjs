import { chromium } from "playwright";

const baseUrl = process.env.GEONEXO_SMOKE_URL ?? "https://127.0.0.1:5188";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });

const first = await page.evaluate(async () => {
  const { localRepository } =
    await import("/src/lib/local-repositories/index.ts");
  const id = crypto.randomUUID();
  const workspaceId = await localRepository.workspaceId();
  const operation = await localRepository.mutate({
    entity: "project",
    entityId: id,
    payload: {
      entity: "project",
      data: {
        id,
        name: "chromium-smoke",
        status: "active",
        createdAt: "2026-09-30T00:00:00.000Z",
        updatedAt: "2026-09-30T00:00:00.000Z",
      },
    },
    operation: "upsert",
    baseVersion: null,
  });
  return {
    id,
    workspaceId,
    operationId: operation.operationId,
    outbox: (await localRepository.listOutbox()).length,
  };
});

await page.reload({ waitUntil: "domcontentloaded", timeout: 15_000 });
const result = await page.evaluate(async ({ id, workspaceId, operationId }) => {
  const { localRepository } =
    await import("/src/lib/local-repositories/index.ts");
  const reloadedWorkspaceId = await localRepository.workspaceId();
  const entity = await localRepository.getEntity(workspaceId, "project", id);
  const beforeAck = (await localRepository.listOutbox()).length;
  const acknowledged = await localRepository.acknowledge(operationId, 1, "1");
  const afterAck = (await localRepository.listOutbox()).length;
  return {
    reloadedWorkspaceId,
    entityPresent: Boolean(entity),
    beforeAck,
    acknowledged,
    afterAck,
  };
}, first);

// eslint-disable-next-line no-console
console.log(JSON.stringify({ baseUrl, first, result }));
if (
  result.reloadedWorkspaceId !== first.workspaceId ||
  !result.entityPresent ||
  first.outbox !== 1 ||
  result.beforeAck !== 1 ||
  !result.acknowledged ||
  result.afterAck !== 0
)
  process.exitCode = 1;
await browser.close();
