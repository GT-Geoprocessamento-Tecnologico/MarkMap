# A7 — Coordenação de instalação regional entre abas

**Data:** 2026-10-10  
**Branch:** `dev/markmap-pwa-v2`  
**HEAD-base:** `459ef229bad00cb9f26f7ed87fdd349453bb63be`  
**Status:** implementação em código e teste Node simulando Web Locks; **sem E2E em navegador real**.

## Objetivo / contexto

Evitar que duas abas do mesmo origin executem simultaneamente o download/ativação da mesma região e disputem os mesmos checkpoints. A proteção existente por identidade de geração no IndexedDB permanece como fonte de integridade; Web Locks é uma coordenação adicional, não substituição.

**Regra vigente:** por decisão expressa do responsável, ausência de testes físicos/reais NÃO bloqueia a continuidade das fases de desenvolvimento. QA não executada permanece dívida de homologação. Nenhum merge, deploy ou release é autorizado por essa decisão.

## Auditoria

- **FUNCIONA EM CÓDIGO:** `ResumableInstaller` usa `this.active` para proteger instalação na mesma instância após a pré-checagem, e `OfflineMapStore` faz staging/ativação por geração.
- **PARCIAL:** duas instâncias/abas podem iniciar download da mesma região antes de `this.active` ser definido; isso pode duplicar transferência e disputar checkpoints, sem comprovação de perda de dados.
- **NÃO IMPLEMENTADO:** coordenação entre abas sem Web Locks por mecanismo alternativo de lease; opção deliberadamente deixada fora do escopo para evitar locks órfãos em IndexedDB.

## Escopo implementado

1. `withRegionInstallLock(id, action, lockManager)`: usa o Web Locks API com `ifAvailable: true`, modo exclusivo e chave específica por ID de região. Em conflito, não executa ação e sinaliza `acquired: false`.
2. `ResumableInstaller.startInstall()` valida ID, introduz guard `installing` **sincronamente** antes de qualquer `await`, usa o lock por toda a instalação e sinaliza `install-busy-other-tab` como erro recuperável.
3. Navegadores sem Web Locks: fallback para caminho anterior, preservando guard da mesma instância e checagem transacional de geração ao ativar; não afirmar exclusividade entre abas.
4. Mantém abort, histórico de checkpoints, mapa ativo, IndexedDB/outbox, contratos e quota.

## Fora do escopo e arquivos

Sem alteração de DB schema, migrations, Neon, protocolo de sync, SW, mapa, autenticação, deploy ou dependências. Não introduzir lock persistente que possa ficar órfão após force-stop.

Arquivos:
- `apps/admin/src/lib/storage/region-install-lock.mjs` e `.d.mts` (novo).
- `apps/admin/src/lib/storage/resumable-installer.ts` (wrapper exclusivo).
- `scripts/region-install-lock.test.mjs` (regressões Node).
- `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md` (estado).

## Segurança e critérios de aceite

- Dadas duas ações simultâneas com o mesmo ID e Web Locks disponível, apenas uma adquire, e a outra não executa sua função.
- Dados IDs diferentes, não há bloqueio desnecessário entre regiões.
- Dado erro na instalação, lock é liberado no `finally`; o próximo retry é possível.
- Dado browser sem a API, instalar segue possível e NÃO declara exclusividade entre abas.
- Um ID malformado nunca vira nome de lock arbitrário; `startInstall` falha com `invalid-manifest`.
- Em todos os caminhos: mapa ativo, outbox e artefatos de outros agentes permanecem preservados.

## Testes executados e riscos

**Executado localmente:** Node `v22.16.0`, `node --test scripts/*.test.mjs apps/admin/src/lib/storage/*.test.mjs apps/admin/scripts/*.test.mjs` após os incrementos A5/A6/A7 = **46/46 aprovados**, 0 skipped. Três novos testes A7 com gerenciador Web Locks simulado cobrem concorrência, IDs diferentes/erro e fallback. `node --check` do helper e análise sintática via TypeScript `transpileModule` do wrapper passaram.

**NÃO EXECUTADO / NÃO BLOQUEANTE PARA CODAR:** navegador com Web Locks real, duas abas em WebView, E2E IndexedDB e interrupção por sistema, lint/typecheck/build completo. Não declarar homologação de multiabas ou segurança para release com base no mock.

**Risco residual:** browsers sem Web Locks continuam sem coordenação entre abas; preservação transacional de geração continua sendo o controle crítico. Web Locks são por origin e não coordenam múltiplos dispositivos.

## Regras de Git, ações proibidas, rollback e relatório

Somente branch `dev/markmap-pwa-v2`, `[skip ci]`, atualização fast-forward condicionada ao HEAD verificado. Proibidos: CI remoto, deploy público, merge main, delete/force push de branches, release/tag, migrações ou exclusões em produção, credenciais e alteração Neon.

Rollback: revert do commit A7 apenas, que retoma o fluxo anterior sem schema changes. Relatório: SHA, arquivos alterados, testes Node e demais verificações realmente executadas, QA não executada, limites e próxima ação. Atualizar Checklist Mestre do Notion e Handoff.
