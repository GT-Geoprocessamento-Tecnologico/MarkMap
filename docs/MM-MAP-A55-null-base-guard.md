# MarkMap — A55: proteção de baseVersion nula no sync

**Data:** 2026-10-12. **Base auditada:** `dev/markmap-pwa-v2@8223dfbecea84cb26c385a8b6393a0aec9db5fa2`, Checklist Mestre Notion, PRs/issues sem atividade. Offline-first React/Vite/TypeScript + IndexedDB/outbox, Hono, Neon/PostGIS e contratos Zod preservados.

## Objetivo e evidência da auditoria
- **FUNCIONA:** operação inicial com `baseVersion:null`, versões explícitas, encadeamento por `predecessorOperationId`, recibo idempotente por `operationId` e bloqueio de workspace por transação.
- **QUEBRADO (reproduzido):** `applyPushOperation` somente comparava versão se `baseVersion !== null`; uma segunda instalação com `baseVersion:null` e novo `operationId` sobrescrevia entidade existente ou tombstone sem apresentar conflito. Também permitia exclusão sem versão.
- **PARCIAL:** os testes usam Drizzle/transação simulados, não PostgreSQL real.
- **NÃO IMPLEMENTADO:** gate de homologação Postgres/Neon, web/PWA real e dispositivos Android/iOS físicos.

## Escopo e arquivos afetados
- `packages/db/src/queries/sync.ts`: tratar `baseVersion:null` como ausência de versão anterior (expectativa 0) para operações sem predecessor; preservar a versão resolvida por predecessor válido. Se o servidor já tiver versão positiva, devolver `VERSION_CONFLICT` ANTES de alocar sequence, gravar syncEntities/operations/tombstones ou materializar projeto.
- `scripts/backend-null-version-guard.test.mjs`: 11 testes Node para primeiras criações, sobrescrita concorrente, delete cego, versão explícita, repetição idempotente, predecessor válido/obsoleto, concorrência serializada, tombstone e workspace.
- `docs/handoff.md`, `docs/master-checklist.md`, `docs/MARKMAP_MASTER.md`, `docs/release-checklist.md` e Checklist Mestre Notion recebem evidência.

## Fora do escopo e segurança
Sem alterar schema, contratos Zod, formato de payload, cursor, API, IndexedDB, outbox, infraestrutura remota, PostGIS, grants, tokens, MapLibre, Capacitor ou interpretação de versões explícitas. Nenhum log de payload/credenciais. Conflitos nunca descartam dados offline: a outbox permanece aguardando resolução explícita do usuário.

## Critérios de aceite
1. Primeira operação de criação com `baseVersion:null` e sem entidade remota permanece válida.
2. Nova operação sem base sobre entidade/tombstone com versão positiva retorna conflito, sem gravação ou avanço de sequência.
3. Atualização/delete com versão correta continuam válidos; versão desatualizada conflita.
4. Idempotência do mesmo `operationId` permanece, assim como cadeia com predecessor confirmado da entidade correta.
5. Isolamento por workspace e mutex/`FOR UPDATE` existentes não mudam.

## Testes e QA
- Baseline anterior: **3/9 testes A55 falharam** reproduzindo sobrescrita, exclusão cega e corrida de criação.
- Após patch: **11/11 testes A55 PASS**; regressão backend A53+A54+A55 **27/27 PASS em três execuções locais** (Node 22.16.0); `node --check` PASS; TypeScript `tsc -p tsconfig.qa.json` com contratos/Drizzle stubs isolados, `strict:true`, PASS.
- **NÃO executados:** lint/typecheck/build/Vitest/Playwright completos do monorepo, Postgres/PostGIS/Neon reais, browser IndexedDB/PWA/WebGL, Android/iOS, sync entre dois aparelhos, RC A38. Não substituir homologação por mocks.

## Git, ações proibidas, riscos e rollback
Somente branch `dev/markmap-pwa-v2` com HEAD verificado e commits `[skip ci]`; nenhum GitHub Actions/CI, merge main, deploy, migração, alteração de produção, force push, secrets, tags, release/lojas ou exclusão de dados. **Risco de compatibilidade:** instalações antigas que dependiam de atualização sem versão passarão a gerar conflito resolvível, em vez de sobrescrever silenciosamente. **Rollback:** revert dos commits A55; nenhuma migração. Próxima etapa: monitorar idempotência de resolução de conflito e concorrência com testes locais; homologação A38 bloqueia somente release.

## Relatório final esperado
SHA do HEAD, arquivos modificados, casos reproduzidos, resultados realmente executados, riscos e pendências de integração; atualizar Handoff e Checklist no GitHub/Notion.
