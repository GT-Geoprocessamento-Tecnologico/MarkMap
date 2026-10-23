# MarkMap — PRD A54: idempotência por lote no sync backend

## Objetivo e contexto

Em `dev/markmap-pwa-v2@f9bd9a7`, impedir que um único POST /sync/push contenha o mesmo operationId mais de uma vez e grave parcialmente antes de responder com ACKs contraditórios. Preservar offline-first, retry idempotente ENTRE requisições, IndexedDB/outbox e Hono/Neon/PostGIS.

## Auditoria

- **FUNCIONA:** contratos Zod para operação, idempotência por workspace/operationId na query SQL e conflito de versão.
- **QUEBRADO (reproduzido):** `pushSyncRequestSchema` aceita IDs repetidos no mesmo array; a rota processa e confirma o prefixo antes de descobrir a duplicação, com recibos ambíguos.
- **PARCIAL:** testes isolados de Hono/mock DB; ambiente real com Postgres não homologado.
- **NÃO IMPLEMENTADO:** browser multiabas e dispositivos reais do gate RC.

## Escopo/arquivos

- `services/api/src/routes/sync.ts`: valida unicidade de operationId no lote depois do parse do contrato, antes de `applyPushOperation`; erro `AppError` 400 `VALIDATION_ERROR`.
- `scripts/backend-sync-batch-idempotency.test.mjs`: 7 regressões de duplicatas adjacentes/distantes/limite 500, lote válido, replay em requisição distinta, conflito e lote vazio.
- `docs/handoff.md`, `docs/master-checklist.md`, `docs/MARKMAP_MASTER.md`, `docs/release-checklist.md` e Notion.

## Fora do escopo

Não alterar schema PostgreSQL/IndexedDB, contratos públicos de operações, materialização PostGIS, bearer, limites da API, migrations, cache PWA, Android/iOS, deploy ou release.

## Segurança e critérios de aceite

1. Dado lote com IDs duplicados, retorna 400 neutro **antes de qualquer transação SQL**.
2. Lote com IDs únicos mantém ACKs na ordem; reenvio de operação já persistida em **outra requisição** continua idempotente.
3. Conflitos de versão seguem explícitos e sem ACK de sucesso; lote vazio é no-op.
4. Não registrar payloads, credenciais, IDs privados em mensagens de erro nem excluir dados/offline outbox.

## Testes/QA (realmente executados, sem GitHub CI)

No código original: **3/7 FAIL**. Após correção: **7/7 PASS**. Node v22.16.0, `NODE_PATH=$(npm root -g) node --test scripts/*.test.mjs`: **257/257 PASS em três rodadas completas**; `node --check` PASS; `tsc -p tsconfig.sync-route.qa.json` isolado com stubs de dependências PASS. Testes Node do endpoint usam simulação de Hono e DB; não comprovam integração SQL real. **Não executado:** full lint/typecheck/build/Vitest/Playwright do monorepo, Postgres/Neon real, IndexedDB browser, Android/iOS físico, duas instalações.

## Git/risco/rollback/relatório

Somente branch `dev/markmap-pwa-v2`, commits `[skip ci]`, sem sobrescrever terceiros. Proibido acionar GitHub Actions, merge main, deploy, alteração Neon, migration, secrets, force push, release/tag, lojas ou apagar dados. Risco residual: lotes grandes com IDs únicos mantêm transações independentes existentes; falha inesperada após commit parcial continua dependente da idempotência de retry. Rollback por revert do patch e teste, sem migration. Registrar SHA/testes/pendências no Handoff e Checklist Mestre. A38 bloqueia release, não desenvolvimento.
