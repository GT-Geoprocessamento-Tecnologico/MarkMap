# MarkMap — PRD A52: recuperação de cursor assinado por capability

Data: 2026-10-12. Base auditada: `dev/markmap-pwa-v2@45ad191` e Checklist Mestre Notion. 0 PR/issue ativo.

## Objetivo e contexto

O cursor `v1.<payload>.<HMAC>` de `services/api/src/lib/sync-cursor.ts` é assinado com o hash da capability atual. A rotação/recovery 401 altera bearer e torna cursor antigo inválido; o cliente persistia `syncCursor`, causando 400 na chamada `/sync/pull`. Corrigir sem tocar API/DB; funcionamento offline-first deve continuar disponível sem rede.

## Auditoria do estado

- FUNCIONA: IndexedDB/outbox, transação local, CAS A44, renew/provision A49/A50, backend Hono valida cursor assinado.
- QUEBRADO reproduzido: cursor antigo após rotação bloqueava pull.
- PARCIAL: cenários de concorrência usando mocks; teste real IndexedDB multiabas não executado.
- NÃO IMPLEMENTADO: homologação release A38, dispositivos reais.

## Escopo e arquivos afetados

- `apps/admin/src/lib/local-repositories/index.ts`: ao salvar capability nova, limpar somente `meta.syncCursor` em mesma transação readwrite quando bearer muda; preservar meta/outbox.
- `apps/admin/src/lib/sync/sync-engine.ts`: detectar cursor mudado antes de aplicar página; após 400, somente tentar novamente se cursor persistido mudou.
- `scripts/sync-bootstrap-race.test.mjs`: suportar `delete` no mock de IndexedDB.
- `scripts/sync-rotated-cursor.test.mjs`: seis regressões para rotação, geração antiga, rollback, cursor inválido e concorrência.
- Registrar evidência em Handoff, Checklist e Notion.

## Fora do escopo

Nenhuma migration, mudança no PostgreSQL/PostGIS, API de sync, schema IndexedDB, assinatura HMAC, criação de endpoints, perda/reset da outbox, leitura remota offline, alteração de MapLibre/Capacitor.

## Segurança e critérios de aceite

1. Capability de geração antiga não substitui nova nem remove cursor válido.
2. Capability com bearer novo invalida cursor no mesmo commit local; falha transacional reverte ambos.
3. Resposta HTTP 400 por cursor **alterado concorrentemente** repete pull com cursor atualizado.
4. HTTP 400 sem alteração de cursor continua erro, sem apagar dados nem fazer retry infinito.
5. Resposta stale de outra aba não aplica entidades nem checkpoint antigo.
6. Sem tokens, URLs privadas ou erros internos em UI.

## Testes e QA

Baseline: 3/6 falhas no HEAD anterior. Após: 6/6 novos PASS, Node 22.16.0 `node --test scripts/*.test.mjs` **241/241 PASS** em três execuções; TypeScript strict `tsc -p tsconfig.qa.json` e `tsc -p tsconfig.foreground.qa.json` com stubs isolados PASS, `node --check` PASS. Quatro SHA locais conferidos no GitHub. **Não equivale** a full lint/typecheck/build/Vitest/Playwright monorepo, E2E browser/Android/iOS, Neon/Hono remoto, dispositivos físicos.

## Documentação, riscos e Git

Commits em `dev/markmap-pwa-v2` com `[skip ci]`. Não acionar GitHub Actions, merge main, deploy, migration destrutiva, force push, secrets, tags, release, loja ou exclusão de dados. Revalidar HEAD e concorrência antes do commit. Risco: a primeira sincronização após rotação rebaixa cursor para início e pode consumir mais páginas, mas permite recuperar todas as mudanças. Rollback por revert isolado, sem migration.

## Relatório esperado

SHA de código/testes/docs, testes realmente executados, classificação de pendências, próximos passos livres. A38 bloqueia release, **não bloqueia desenvolvimento**.
