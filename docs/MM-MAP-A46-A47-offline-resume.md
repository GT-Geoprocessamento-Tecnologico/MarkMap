# MarkMap — MM-MAP-A46-A47: recuperação e retomada PWA (2026-10-12)

## Objetivo e estado real

Proteger operações offline contra conexões IndexedDB silenciosamente fechadas na suspensão do WebView/PWA e atualizar sincronização ao retornar do background. Base auditada: `dev/markmap-pwa-v2@37bf678` no GitHub e Checklist Mestre no Notion; PRs/issues abertos 0.

## Auditoria

- **FUNCIONA:** A45 trata falha de abertura/transação, `onversionchange` e cache do workspace; A44 protege cursor; syncNow usa single-flight, offline-first e outbox durável.
- **QUEBRADO:** `db.transaction` em conexão fechada sem `versionchange` lança `InvalidStateError` indefinidamente, pois conexão resolvida permanece cacheada; controlador ignora `pageshow.persisted` e foco ao retornar de WebView e não invalida queries ao salvar conflito novo.
- **PARCIAL:** comportamento React é testado com eventos simulados; aparelhos reais não disponíveis.
- **NÃO IMPLEMENTADO:** gate real Android/iOS, browser IndexedDB multiabas, homologação RC.

## Escopo e arquivos

- `apps/admin/src/lib/local-db/index.ts`: na criação de transação com `InvalidStateError`, limpa cache da mesma conexão, sem repetir a operação; o próximo acesso reabre. Outras falhas permanecem erros explícitos.
- `apps/admin/src/lib/sync/SyncController.tsx`: reage a `pageshow` restaurado e `focus` visível; respeita `navigator.onLine === false`, estado hidden, unmount; invalida queries para conflitos.
- `scripts/local-db-reopen.test.mjs`: adapta expectativa A45 à invalidação segura de `InvalidStateError`.
- `scripts/local-db-suspension.test.mjs`, `scripts/sync-foreground-recovery.test.mjs`: dez cenários novos.

## Segurança, limites e ações proibidas

Não alterar versão/esquema IndexedDB, workspace, outbox, dados de campo, API Hono, Neon/PostGIS, worker ou política de sincronização. Não reproduzir gravações automaticamente após erro de criação de transação. Nenhuma credencial/log sensível. Proibido CI GitHub, deploy, merge main, force push, migração, secrets, release/tag, lojas e operações destrutivas.

## Critérios de aceite

Conexão fechada sem evento falha uma vez, limpa handle e recupera dados na chamada seguinte; nenhuma escrita é reexecutada silenciosamente. `DataError` não reabre conexão boa. Retorno de bfcache/foco visível dispara sync; páginas normais ou foco oculto não duplicam; offline não toca rede. Conflito provoca refresh da interface; cleanup remove handlers.

## Evidência de QA local

- No HEAD anterior, **6 de 10** novos testes falharam, confirmando lacunas.
- Após correção, **10/10 PASS**; regressão Node `NODE_PATH=$(npm root -g) node --test scripts/*.test.mjs`: **218/218 PASS em duas execuções**.
- `tsc -p tsconfig.foreground.qa.json` com stubs isolados: PASS; `node --check` dos testes: PASS.
- Não executados: full monorepo lint/typecheck/build/Vitest/Playwright, IndexedDB navegador/WebView real, Android/iOS ou dois aparelhos.

## Git, documentação, riscos e relatório

Somente `dev/markmap-pwa-v2`, commits `[skip ci]`, sem sobrescrever agentes. Se a suspensão interromper uma transação depois de iniciar, mantém erro original; não assume commit e não faz retry automático. Rollback por revert pontual, sem migration. Registrar SHA, testes e dívida do release no Handoff, Checklist Mestre GitHub e Notion. Próxima etapa deve priorizar inconsistências realmente reproduzidas, sem travar novas fases pela homologação física.
