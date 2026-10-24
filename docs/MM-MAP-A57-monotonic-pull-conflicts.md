# MarkMap — PRD A57: conflitos monotônicos no pull de tombstones

**Data:** 2026-10-13. **Base:** `dev/markmap-pwa-v2@0c0b0d0eac5ef785af0c6076e183bb05a6c5fc92`, Checklist Mestre Notion conferido, sem PR/issue aberto.

## Objetivo e contexto
Evitar perda silenciosa de dados na resolução de conflitos entre instalações quando uma página de sync contém exclusão antiga e recriação mais recente da mesma entidade. Preservar React/Vite/TypeScript, Hono, Neon/PostGIS, IndexedDB/outbox e Capacitor, com operação de campo offline-first.

## Auditoria antes da mudança
- **FUNCIONA:** versões monotônicas no `applyPushOperation`, CAS de cursor A44/A52, outbox durável, conflito e resolução `keep-local`/`use-server`, aplicação de páginas em transação local.
- **QUEBRADO (reproduzido):** `LocalRepository.applyServerPage` aplica primeiro todas as mudanças `upsert`, depois todos os tombstones; `writeConflict` sobrescreve sem comparar versão. Assim, uma exclusão v2 pode substituir conflito de recriação v3/v5, inclusive em páginas distintas; `use-server` então apaga a entidade restaurada.
- **PARCIAL:** testes reais de LocalRepository sobre `MemoryLocalDb`, mas não em IndexedDB de navegador/WebView nem Postgres remoto.
- **NÃO IMPLEMENTADO:** homologação de release com dois dispositivos reais, Android/iOS e full monorepo gates.

## Escopo e arquivos afetados
- `apps/admin/src/lib/local-repositories/index.ts`: tornar `writeConflict` assíncrono na transação `readwrite`, ler conflito existente por `(workspaceId, operationId)` e impedir substituição quando o `serverVersion` persistido for maior ou igual ao evento recebido; aguardar o resultado nas rotas upsert e tombstone.
- `scripts/local-pull-conflict-order.test.mjs`: 10 testes para exclusão antiga + recriação nova no mesmo pull, páginas separadas, `use-server`, tombstone mais nova, replay da mesma versão, ausência de edição pendente, CAS de cursor e rollback de transação.
- `docs/handoff.md`, `docs/master-checklist.md`, `docs/MARKMAP_MASTER.md`, `docs/release-checklist.md` e Notion: registrar evidência e próximos passos.

## Fora do escopo / segurança
Não alterar contratos da API, payloads, SQL/Neon, schema IndexedDB, versionamento/cursor, autenticação, lifecycle de outbox, dados de usuário, releases ou infraestrutura. Sem logs de conteúdo de campo, bearer, IDs ou secrets. Não reconhecer um tombstone como ACK sem operationId (o contrato do tombstone não contém esse campo).

## Critérios de aceite
1. Recriação `upsert` v3 após tombstone v2 mantém conflito de versão 3, inclusive quando o servidor devolve arrays separados.
2. `resolveConflict(use-server)` restaura o payload de versão 3, nunca exclusão obsoleta.
3. Tombstone v3 após upsert v2 substitui conflito antigo; replay/versão igual não descarta payload.
4. Estado sem operações pendentes aplica eventos por versão sem falsos conflitos.
5. Falha transacional/cursor incompatível não altera conflito nem cursor nem descarta outbox.

## QA realmente executada
- **Antes do patch:** 3 de 7 testes falharam ao reproduzir rebaixamento de conflito, resolução errada e tombstone tardia.
- **Após:** 10/10 testes A57 aprovados. Regressão combinada backend A53–A56 + A57: **45/45 testes Node PASS em três execuções**. `tsc -p tsconfig.qa.json` strict com contratos tipados por stubs, sem emitir arquivos, **PASS**. `node --check scripts/local-pull-conflict-order.test.mjs` **PASS**. Arquivos locais reconstruídos a partir dos blobs SHA do GitHub.
- **Não executados:** full monorepo lint/typecheck/build/Vitest/Playwright, navegador IndexedDB real e PWA instalada, backend/Hono/Neon/PostGIS integrados e dispositivos Android/iOS físicos.

## Regras Git, ações proibidas, riscos e relatório esperado
Somente `dev/markmap-pwa-v2`, verificar HEAD e PRs/issues antes da escrita, commits `[skip ci]`. Proibidos GitHub Actions/CI remoto, merge main, deploy público, migration/Neon produção, force push, secrets, release/tag, lojas ou exclusão destrutiva.
**Risco:** conflito mais recente prevalece sobre evento histórico; empate de versão conserva conflito já armazenado. Nenhuma migração. **Rollback:** revert pontual da mudança de repositório e teste, sem tocar dados offline.
**Relatório:** SHA final, evidência comparativa antes/depois, testes efetivos e pendências de release no Handoff, Checklist GitHub e Notion; não bloquear novas fases por testes físicos pendentes.
