# MarkMap — PRD A56: conflito de predecessor inválido com entidade ausente

**Data:** 2026-10-12. **Base auditada:** `dev/markmap-pwa-v2@336ee9c92469f141bbfc891ecb0dfed297d05651`; Checklist Mestre Notion e PRs/issues verificados antes de editar.

## Objetivo e contexto

Garantir que `applyPushOperation` nunca emita `VERSION_CONFLICT` com `serverVersion: 0`. Esse envelope viola o contrato compartilhado `syncConflictSchema` (VERSION_CONFLICT exige versão positiva), podendo fazer `pushSyncResponseSchema.parse` rejeitar a resposta de `/sync/push` e gerar HTTP 500 apesar de conflito esperado. O erro ocorre com `predecessorOperationId` inexistente em entidade sem versão remota, ou `baseVersion` positiva para entidade ausente.

## Auditoria do HEAD

- **FUNCIONA:** CAS e idempotência de operações, isolamento do workspace, A55 proteção contra sobrescrita cega, predecessor existente e atualizado, tombstone/recriação versionada.
- **QUEBRADO (reproduzido):** `conflictFor()` retorna motivo `VERSION_CONFLICT` mesmo para `currentVersion === 0`, incompatível com Zod.
- **PARCIAL:** testes com um adaptador serializado Drizzle/SQL em memória; não equivalem ao banco real.
- **NÃO IMPLEMENTADO nesta rodada:** execução PostgreSQL/Neon de integração e E2E Android/iOS.

## Escopo e arquivos

- `packages/db/src/queries/sync.ts`: quando não existir versão remota, classificar como `SCOPE_REJECTED` com `serverVersion: 0`, sem payload remoto; quando `currentVersion > 0`, manter `VERSION_CONFLICT`, versão e payload do servidor se existente.
- `scripts/backend-predecessor-conflict.test.mjs`: oito casos de predecessor ausente, baseVersion inconsistente, predecessor de entidade incorreta, tombstone concorrente, reativação encadeada e updates legítimos.
- Documentar resultado no PRD, Handoff, Checklist Mestre do GitHub/Notion e checklist de release.

## Fora do escopo

Nenhuma alteração de enum Zod, contrato HTTP, schema PostgreSQL/IndexedDB, UI, outbox, Neon, assinatura de credenciais, release, deploy ou sincronização de instalações reais.

## Segurança e regras de negócio

`SCOPE_REJECTED` é o tipo existente do contrato que suporta `serverVersion: 0`, sem simular uma versão positiva inexistente. Não divulgar `serverPayload` de recurso inexistente ou de outro workspace. Operações com predecessor válido e versão atual continuam aplicáveis, tombstones preservados, replay de `operationId` idempotente.

## Critérios de aceite

1. Predecessor ausente e entidade inexistente => conflito serializável `SCOPE_REJECTED`, versão zero, sem escrita.
2. Base positiva para entidade ausente => mesmo formato válido; sem avançar sequência.
3. Predecessor ausente com entidade existente => `VERSION_CONFLICT`, versão positiva, e payload apenas se houver.
4. Predecessor obsoleto após tombstone => conflito sem payload de entidade excluída.
5. Predecessor de tombstone atualizado => permite recriação na versão seguinte.
6. Edição com versão explícita e criação inicial mantêm os resultados anteriores.

## Testes e QA

- Baseline: **3/8 FAIL** em A56 no código do HEAD original.
- Patch: **8/8 PASS** no teste A56 e **11/11 PASS** nos testes A55.
- Regressão Node backend A53+A54+A55+A56: **35/35 PASS** (mock de SQL/Hono, não integração real).
- `tsc -p tsconfig.qa.json`: checagem estrita isolada com declarações stub **PASS**; não é o typecheck completo do monorepo.
- Pendente: full lint/typecheck/build/Vitest/Playwright, PostgreSQL/PostGIS em integração, navegador IndexedDB, Android/iOS e 2 instalações reais.

## Riscos, rollback, ações proibidas e Git

Risco de semântica: `SCOPE_REJECTED` também sinaliza pré-condição inválida quando versão remota é zero, pois não há outro motivo de conflito compatível com o contrato público. Não criar novo enum sem estratégia de compatibilidade. Reverter apenas a alteração do helper e testes se necessário; sem migração.

Versionar somente em `dev/markmap-pwa-v2` após conferir HEAD e tarefas de outros agentes, com mensagem `[skip ci]`, sem CI GitHub. Proibido merge main, deploy, Neon/migration, secrets, force push, tag/release, loja, exclusões de dados ou mudança irreversível. Não bloquear fases de código por QA física, mas não considerar RC aprovado.

## Relatório final esperado

SHA GitHub, arquivos alterados, baseline e resultados realmente observados, limites, pendências de integração, Handoff e Checklist Mestre atualizados.
