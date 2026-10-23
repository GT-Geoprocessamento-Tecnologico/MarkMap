# MM-MAP-A45 — Recuperação de conexão IndexedDB após suspensão (2026-10-12)

## Objetivo e fonte

Corrigir falhas reproduzíveis de reabertura do banco local após erro transitório, bloqueio ou `versionchange`, preservando uso offline-first sem rede. Base: `dev/markmap-pwa-v2@554cb00` e Checklist Mestre Notion verificados em 2026-10-12, sem PRs/issues abertos.

## Auditoria do HEAD

- **FUNCIONA:** operações transacionais do IndexedDB, workspaceId estável, memória de saída/outbox separada, CAS cursor A44, cache de conexão bem-sucedida.
- **QUEBRADO (reproduzido):** `dbPromise` e `workspacePromise` armazenavam rejeições permanentes, `onversionchange` fechava conexão sem invalidar cache, `close()` em promessa rejeitada gerava `unhandledRejection`, `onblocked` seguido de sucesso criava conexão órfã.
- **PARCIAL:** retomada offline real em browser WebView não homologada.
- **NÃO IMPLEMENTADO:** testes físicos Android/iOS/multiabas reais.

## Escopo e arquivos

- `apps/admin/src/lib/local-db/index.ts`: limpar cache de abertura/ID em erro, invalidar referências de conexão em `versionchange`, fechar sucessos tardios de request previamente rejeitado e fazer `close` tolerar promessa já rejeitada.
- `scripts/local-db-reopen.test.mjs`: seis cenários Node direcionados em emulador mínimo do contrato IndexedDB.
- Documentação: `docs/MM-MAP-A45-idb-recovery.md`, `docs/handoff.md` e `docs/master-checklist.md`, além do Checklist Mestre Notion.

## Fora do escopo

Nenhuma mudança no esquema/versão IndexedDB, IndexedDB outbox, MapLibre, PWA SW, contratos HTTP, Hono, Neon/PostGIS ou política de sync. Sem polling, rede, reset/deleção de dados ou limpeza automática.

## Segurança e qualidade

A falha local permanece observável e propagada ao chamador na tentativa corrente, mas não envenena tentativas subsequentes. O ID de workspace é obtido do banco após reabertura; nenhuma operação local é enviada ao servidor nem descartada para recuperar conexão.

## Critérios de aceite

- Rejeição transitória de `indexedDB.open` não bloqueia segunda tentativa;
- rejeição de transação durante `workspaceId()` pode ser repetida;
- `onversionchange` fecha conexão antiga e reabre preservando o workspace ID;
- `close()` após erro não gera rejeição não tratada;
- `onblocked` seguido de sucesso fecha conexão obsoleta;
- chamadas concorrentes normais mantêm abertura única e ID consistente.

## Testes executados e QA

- Baseline sobre HEAD A44: **5 falhas / 6 casos**; após correção: **6/6 PASS**.
- `node --test scripts/*.test.mjs`: **208/208 PASS em três execuções locais**, sem GitHub Actions/CI.
- `tsc --strict --noEmit` isolado com stubs local-db/index.ts + local-db/types.ts e sync-engine.ts: PASS; `node --check` do teste PASS.
- **NÃO EXECUTADO:** monorepo full lint/build/Vitest/Playwright, IndexedDB no navegador real, force-stop Android/iOS, dispositivos físicos, PostGIS real, migração e release. Dívida de homologação, **não bloqueio para desenvolvimento**.

## Documentação, Git e reversão

Trabalhar em `dev/markmap-pwa-v2`, commits `[skip ci]`, sem rebase/force push nem sobrescrever agentes. Proibido merge main, GitHub CI remoto, deploy, migration, DELETE/DROP/TRUNCATE, secrets, tags, release, signing ou publicação de loja sem autorização. Risco: falha permanente de IndexedDB continua dando erro em novas tentativas, mas não há loop/polling. Rollback: revert apenas do patch e teste; nenhuma migration. Relatório final: SHA, arquivos, 5 falhas iniciais, evidências, pendências, ações não executadas.
