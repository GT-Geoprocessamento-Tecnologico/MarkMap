# MarkMap — PRD A59: conflitos monotônicos entre push e pull concorrentes

**Data:** 2026-10-13. **Base:** A58 sobre `dev/markmap-pwa-v2@180e017`; Checklist Mestre, HEAD e PRs/issues confirmados. **Track:** EVOLUIR EXISTENTE.

## Objetivo e contexto

Evitar que uma resposta HTTP do push, emitida antes de um pull mais recente em outra aba, **rebaixe** o conflito durável no IndexedDB. A57 protege `writeConflict` durante pull, mas `LocalRepository.saveConflict` gravava sem comparar a versão anterior. Resolver `use-server` podia restaurar payload antigo.

## Auditoria FUNCIONA/PARCIAL/QUEBRADO/NÃO IMPLEMENTADO

- **FUNCIONA:** `applyServerPage.writeConflict` monotônico A57, query por operationId e transações locais.
- **QUEBRADO (reproduzido):** `saveConflict` sobrescreve serverVersion v5 com v3 ou um `SCOPE_REJECTED` v0, permitindo decisão stale pelo usuário.
- **PARCIAL:** o teste usa MemoryLocalDb e chamadas de push/pull simuladas.
- **NÃO IMPLEMENTADO:** teste de disputa real em duas abas e dois dispositivos.

## Escopo/arquivos

- `apps/admin/src/lib/local-repositories/index.ts`: dentro da transação `conflicts` readwrite, ler o registro atual e gravar apenas se não houver versão igual/maior.
- `scripts/local-push-conflict-monotonic.test.mjs`: dez testes de progresso monotônico, preservação de payload, rollback, isolamento por operationId, `SCOPE_REJECTED` e outbox.
- Documentar no Handoff, checklist GitHub, Documento Mestre e Notion após commit.

## Fora do escopo, segurança e regras

Não alterar API, Zod, conteúdo do conflito, workspace, versionamento, schema IndexedDB, baseVersion, Neon/PostgreSQL, tokens, contrato de tombstone, MapLibre nem Capacitor. Confiança: resolução local nunca usa conflito de versão inferior; tombstone permanece distinguível pela ausência de serverPayload. Não registrar dados privados.

## Critérios de aceite

1. Dado conflito v5 vindo do pull, quando chega push atrasado v3, a versão v5 e payload v5 permanecem.
2. Mesmo serverVersion não substitui payload conhecido por ausência de payload.
3. Conflito de versão maior substitui o anterior, inclusive resposta do push.
4. SCOPE_REJECTED v0 novo é armazenado sem conflito prévio, mas não rebaixa v5.
5. Falha de transação reverte e outbox imutável continua intacta.
6. Operações distintas da mesma entidade continuam individualmente identificadas.

## QA e testes reais

Baseline A58 com método original: **4/10 FAIL**. Após patch: **10/10 PASS**. Suite A53–A59: **65/65 Node PASS**, TypeScript estrito isolado com stubs PASS e `node --check` PASS. A60 subsequente não entra neste gate. Não atesta PostgreSQL ou browser real.

## Git, riscos, rollback e ações proibidas

Somente branch dev, commits `[skip ci]`, checagem HEAD e blobs antes de publicar. Risco: duas respostas de mesma versão com payloads diferentes mantêm a primeira, conservador e consistente com A57. Rollback revert isolado sem migração. Proibidos CI GitHub, force push, deploy, main, Neon, secrets, tag/release, lojas e destruição de dados.

## Relatório final e orientação executor

Registrar diff, SHA do blob e commit, baseline, testes aprovados, limites, pendências de RC A38 e atualização de Handoff/Checklist. Executor deve revisar concorrência transacional sem criar uma segunda arquitetura offline-first. QA física é gate de release, não de início de próxima fase.
