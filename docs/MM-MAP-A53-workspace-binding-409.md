# MarkMap — PRD MM-MAP-A53: binding seguro de workspace

**Data:** 2026-10-12. **Base:** `dev/markmap-pwa-v2@74d257b`, HEAD e Checklist Mestre Notion verificados, PRs/issues 0.

## Objetivo e contexto
Garantir que um `workspaceId` já vinculado a prova diferente produza conflito HTTP 409 previsível, não 500. `INSERT ... ON CONFLICT(proof_digest)` não captura violações na chave primária independente `workspaces.id`.

## Auditoria (FUNCIONA / QUEBRADO / PARCIAL / NÃO IMPLEMENTADO)
**FUNCIONA:** bootstrap proof, auth/capability, rate limit, provisionamento válido, recovery e IndexedDB/outbox.
**QUEBRADO (reproduzido):** `SQLSTATE 23505` direto ou encapsulado pelo Drizzle sai da query de provisionamento sem classificação; rota só converte erros com mensagem de binding.
**PARCIAL:** teste local por stubs de driver/HTTP, sem banco real.
**NÃO IMPLEMENTADO:** homologação real do workflow em Neon de teste.

## Escopo, arquivos e fora do escopo
- `packages/db/src/queries/workspaces.ts`: classificar `23505` e cadeia `cause` até quatro níveis, lançar erro de binding genérico; demais erros SQL são repassados.
- `scripts/backend-workspace-binding.test.mjs`: nove cenários de SQL direto/encapsulado, erro não relacionado, resposta 201/409/429 e binding revogado.
- Atualizar Handoff, Checklist Mestre, Mestre e Notion.
- **Fora:** alterar API, SQL schema, migrations, capability, service worker, armazenamento local, outbox, PostGIS ou processos de release.

## Segurança e critérios de aceite
1. Dado workspaceId existente com prova diferente, quando o INSERT gerar 23505, então a API responde 409 neutro, sem expor constraint/SQL.
2. Dado erro SQL sem 23505, a rota mantém tratamento inesperado.
3. Dada prova correta, retorno 201 com generation válido.
4. Dado rate limit excedido, resposta 429 sem chamada SQL.
5. Nenhum descarte de dados offline, outbox ou reexecução automática.

## Testes/QA de verdade
Antes: **4/9 FAIL**. Depois: **9/9 PASS**; Node 22.16.0 `node --test scripts/*.test.mjs` **250/250 PASS duas vezes**. `node --check` PASS e `tsc --strict --noEmit` isolado com stubs Drizzle e PWA/sync PASS.
**Não executados:** monorepo lint/typecheck/build/Vitest/Playwright completos, Hono e PostgreSQL/Neon reais, WebView/Android/iOS, homologação física.

## Documentação, Git, ações proibidas, risco e relatório esperado
Branch `dev/markmap-pwa-v2`; HEAD e tarefas paralelas auditados; commits `[skip ci]`. Sem GitHub Actions/CI, merge main, deploy público, Neon/migration, force push, segredos, tags/release, lojas ou dados destrutivos.
**Risco:** outros conflitos `23505` na mesma query também retornam 409; resposta segura e reversível. **Rollback:** revert isolado de query e testes, sem migração. Registrar SHA, testes observados, bloqueios do RC e próximo passo em Handoff/Checklist Notion. Não marcar release aprovado.
