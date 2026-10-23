# MarkMap — PRD A61: impedir conflito ressuscitado por resposta tardia de push

**Data:** 2026-10-13. **Base auditada:** `main@4906b7e87f3143252eb9befb8674e713cbb88e24`; Checklist Mestre Notion lido; sem PR ou issue aberta. **Track:** EVOLUIR EXISTENTE, implementação mínima offline-first.

## Objetivo e contexto

Impedir que uma resposta tardia de `/sync/push` grave novamente um conflito cuja operação local já teve ACK ou foi resolvida em outra aba. Hoje `resolveConflict` exclui a outbox antiga, mas `saveConflict` grava apenas em `conflicts`, sem verificar a existência da operação; isso pode ressuscitar uma decisão obsoleta e, ao resolver novamente, apagar uma operação sucessora válida.

## Auditoria: FUNCIONA / PARCIAL / QUEBRADO / NÃO IMPLEMENTADO

- **FUNCIONA (código):** IndexedDB/outbox com transações, `acknowledge` durável, resolução `use-server`/`keep-local`, monotonicidade por `serverVersion` de A59 e filtros do pull A58–A60.
- **QUEBRADO (evidência estática):** `saveConflict` só abre store `conflicts` e aceita operationId já excluído por ACK ou resolução. O fluxo de resolução pode remover sucessores se o conflito obsoleto for processado.
- **PARCIAL:** backend pode responder depois que outra aba resolveu o estado; o protocolo assíncrono necessita conciliação transacional no cliente.
- **NÃO IMPLEMENTADO/SEM EVIDÊNCIA:** execução de suíte A61 em navegador IndexedDB real, duas instalações físicas, CI GitHub Actions (bloqueio de cobrança).

## Escopo e arquivos afetados

- `apps/admin/src/lib/local-repositories/index.ts`: validar, na **mesma transação readwrite IndexedDB**, que a operação de conflito continua na outbox do workspace, sem ACK durável e corresponde à entidade/base original, antes de inserir ou substituir conflito. Nunca regenerar operação antiga.
- `scripts/local-late-conflict-after-resolution.test.mjs`: regressões Node de ACK tardio, resoluções em abas, encadeamento local, mismatch de recibo, rollback, casos positivos e monotonicidade.
- Documentação `docs/handoff.md`, `docs/master-checklist.md`, Notion Checklist Mestre e checklist de release.

## Regras de negócio e segurança

- Operação removida por ACK ou resolução não aceita conflito tardio; nenhuma alteração em entidade, sucessor, outbox ou cursor.
- Recibo de conflito que alega `operationId` de entidade/base diferente deve ser recusado explicitamente (não permitir que uma resposta incorreta escolha outra entidade).
- Conflitos ativos válidos continuam duráveis; versão remota nunca retrocede e `SCOPE_REJECTED` mantém semântica.
- Sem credenciais, payloads sensíveis em logs, alterações Neon/PostGIS, mudança de API, migration, IndexedDB schema ou frontend.

## Critérios de aceite

1. `use-server` finalizado impede conflito obsoleto de reaparecer após reply tardio.
2. `keep-local` cria apenas nova operação e não a perde quando reply antigo chega.
3. ACK durável bloqueia conflito posterior sobre o mesmo operationId.
4. Identificador desconhecido nunca gera conflito órfão.
5. Entidade/base não correspondentes falham fechados, sem mutação.
6. Conflito verdadeiramente pendente mantém persistência e regra monotônica.
7. Transação abortada preserva estado; nenhuma mudança de cursor.
8. Suíte de regressão automatizada executada quando houver runtime de testes acessível; sem afirmar PASS quando não executada.

## Testes e QA

`NODE_PATH=$(npm root -g) node --test scripts/local-late-conflict-after-resolution.test.mjs` e regressões A53–A60; `tsc --noEmit`, lint, build, Vitest, Playwright conforme ambiente. Vercel build pode fornecer evidência de compilação do HEAD, mas nunca substitui testes de integração, browser/IndexedDB, Android/iOS. GitHub Actions atualmente bloqueado por cobrança/limite.

## Git, coexistência e ações proibidas

Trabalhar apenas na `main` por pedido explícito do responsável; conferir HEAD e SHA de cada blob imediatamente antes da gravação; sem force push, reset, deploy manual, releases/tags, publicação em lojas, alterações Neon ou migrations destrutivas. Não sobrescrever agentes nem refazer frontend. Diff reversível em um método e um teste; rollback com revert padrão, sem reset.

## Riscos e relatório final esperado

Risco de ignorar resposta antiga legítima: só ignorar quando não houver operação ativa correspondente ou já existir ACK. Distinguir **código alterado**, **testes realmente executados**, **validadores externos observados**, **pendências de ambiente** e **SHA final**. Estado de release permanece não homologado sem os gates aplicáveis.
