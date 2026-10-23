# MarkMap — PRD A60: prevenir conflito falso em upsert antigo do pull

**Data:** 2026-10-13. **Base:** A59 sobre o HEAD dev A57–A58, Checklist Mestre verificado; nenhuma PR/issue aberta. **Track:** EVOLUIR EXISTENTE.

## Objetivo/contexto

Um dispositivo editando com baseVersion v3 não deve receber conflito por um upsert histórico v2/v3 emitido numa página de pull. Os tombstones antigos já foram tratados em A58; o caminho de `changes` não comparava versões em presença de pendência local, e podia bloquear a outbox indevidamente.

## Auditoria FUNCIONA / QUEBRADO / PARCIAL / NÃO IMPLEMENTADO

- **FUNCIONA:** ACK exato por operationId, predecessor de operação confirmada, conflito por upsert verdadeiramente novo, CAS de cursor, persistência offline-first.
- **QUEBRADO (reproduzido):** `applyServerPage` cria `VERSION_CONFLICT` para mudança de versão <= baseVersion da mutação local, mesmo que não haja alteração concorrente posterior.
- **PARCIAL:** baseVersion nula/predecessor de cadeia sem ACK ainda exige caminho conservador, não inferir conhecimento do servidor.
- **NÃO IMPLEMENTADO:** teste de browser multiabas, Postgres real e dois dispositivos físicos.

## Escopo e arquivos

- `apps/admin/src/lib/local-repositories/index.ts`: no ramo `pending` de upserts remotos, ignorar eventos de versão menor ou igual à base conhecida; o ramo ACK exato por operationId e o predecessor reconhecido seguem prioritários.
- `scripts/local-stale-upsert-replay.test.mjs`: dez regressões positivas/negativas, CAS, ACK próprio, base nula, lote misto e concorrência.
- Registrar evidências em Handoff, Checklist, Documento Mestre, release-checklist e Notion.

## Fora do escopo e segurança

Sem alterar contrato `ServerChange`, API Hono, backend, Neon/PostGIS, esquema local, cursor, cache PWA, MapLibre, Terra Draw ou Capacitor. Nunca descartar outbox/ACK, expor payload ou criar sucesso falso de sync. Não alterar operações sem base conhecida.

## Critérios de aceite

1. Com baseVersion v3 e upsert remoto v2/v3, operação local pendente não vira conflito e continua na outbox.
2. Upsert concorrente v4 com baseVersion v3 ainda produz conflito explícito.
3. BaseVersion nula continua conservadora, sem presumir versão conhecida.
4. Mesmo operationId aceito pelo servidor ainda gera ACK durável, sem gerar conflito.
5. Lote misto com tombstone antigo não rebaixa versão; cursor avança atomically, CAS falho reverte.

## QA real e documentação

Baseline A59: **5/10 FAIL**. Após patch: **10/10 PASS**. Regressão Node local **75/75 PASS em três execuções** (A53–A60), TS estrito isolado com stubs PASS, `node --check` dos novos testes PASS. Full monorepo lint/typecheck/build/Vitest/Playwright, IndexedDB browser real, Hono/Neon, Android/iOS físicos e duas instalações **não executados**. Atualizar Handoff/Checklist, sem chamar release aprovado.

## Git, ações proibidas, riscos e rollback

Somente `dev/markmap-pwa-v2`, `[skip ci]`, revalidar HEAD e hashes antes de commit; proibir GitHub Actions remoto, merge main, deploy, Neon/migração, força push, secrets, tags/releases, loja ou exclusão destrutiva. Risco: cliente com baseVersion incorreta pode ignorar evento que acreditava conhecer, mas envio ao servidor continua submetido a CAS, preservando integridade. Rollback isolado, sem migration.

## Relatório e instrução final ao executor

Entregar SHA/arquivos, casos baseline e após, testes de verdade, riscos residuais e próximo item A61 com evidência, Handoff e Checklist Notion sincronizados. Prosseguir código sem esperar pelo gate físico A38 de release.
