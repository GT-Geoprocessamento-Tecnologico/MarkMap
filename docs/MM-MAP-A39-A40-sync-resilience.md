# MarkMap A39/A40 - Sincronizacao incremental resiliente

## Objetivo
Evitar pull repetitivo sobre cursor que nao avanca e preservar contagem de push ja confirmado quando o pull falhar, sem alterar o trabalho offline.

## Fonte e contexto
- Fonte de verdade: `GEONEXO_FONTE_CHATGPT.md`, Checklist Mestre Notion, branch `dev/markmap-pwa-v2` HEAD `2f3a7530b7f4ece79c9e0e5516897669516dff8e` (verificado em 2026-10-11).
- A35-A37 concluidas somente com QA Node (181/181); A38 RC fisica/integrada segue bloqueada, mas nao bloqueia desenvolvimento.
- `apps/admin/src/lib/sync/sync-engine.ts` usa `localRepository.applyServerPage` para efetivar paginas e persistir cursor; `SyncController` invalida UI quando `pushed` ou `pulled` for positivo.

## Auditoria anterior a alteracao
- FUNCIONA: outbox offline-first, ACK persistido, conflito explicito, 401 recover, timeout bounded, cursor persistido apos aplicar pagina.
- PARCIAL: limite de 50 paginas evita loop infinito mas permite requests repetidos antes do erro.
- QUEBRADO (reproducao exigida): pull com `hasMore=true` e cursor que nao progride aplica paginas redundantes; erro de pull apos push ja efetivado retorna `pushed=0`, nao invalidando queries.
- NAO IMPLEMENTADO: guarda explicita contra ciclo de cursors.

## Escopo
- A39: detectar cursor repetido ou ciclo enquanto `hasMore=true`, falhar com erro seguro antes de mutacao da pagina repetida; manter limite de 50 como defesa adicional.
- A40: quando push termina mas pull falha, reportar contagem real de ACKs/conflitos bem-sucedidos e estado `error`, preservando a outbox pendente.
- Testes Node isolados com pagina/ACK/erro e regressao de todos testes Node disponiveis.

## Fora do escopo
- Mudanca de contratos, banco Neon/PostGIS, migrations, APIs, React UI, esquema IndexedDB, outbox, CI remoto, deploy ou release.
- E2E/Android/iOS real nao disponiveis neste ambiente e nao serao alegados como testados.

## Arquivos afetados
- `apps/admin/src/lib/sync/sync-engine.ts` (alteracoes minimas).
- `scripts/sync-pull-progress.test.mjs` (regressao versionada, sem rede externa).
- `docs/MM-MAP-A39-A40-sync-resilience.md`.
- `docs/handoff.md`, `docs/master-checklist.md`, `docs/MARKMAP_MASTER.md` (status/evidencia caso validado).

## Seguranca
- Nao exibir URL, bearer, provas de bootstrap nem excecoes de parse em status da UI.
- Nao confirmar ACK no cliente antes da resposta do servidor. Nao descartar dados, cursor ou conflitos em erro.
- Limitar retries/paginacao sem polling extra.

## Criterios de aceite
- Dado um pull com `hasMore=true` e mesmo cursor, nao repetir indefinidamente nem avancar o checkpoint para pagina repetida.
- Dado ciclo A->B->A, abortar com estado `error` antes de aplicar a pagina de retorno.
- Dadas paginas progressivas e pagina final, aplicar/contar todas e retornar `synced`.
- Dado ACK positivo confirmado e erro do pull posterior, retornar `error` mantendo `pushed>0` para UI atualizar versao local.
- Dado modo offline, nenhuma chamada HTTP e outbox intacta.

## Testes e QA
- `node --test scripts/sync-pull-progress.test.mjs` antes/depois para reproduzir e resolver.
- `node --test scripts/*.test.mjs` apos ajuste para regressao (esperado baseline 181, sem alegar ate executar).
- `node --check` nos novos JS e TypeScript `tsc --strict --noEmit` isolado com stubs existentes, se possivel.
- Full pnpm lint/typecheck/build/Vitest/Playwright, navegador real/Neon/device: reportar nao executados se ambiente indisponivel.

## Regras Git e proibicoes
- Usar somente `dev/markmap-pwa-v2` com HEAD reconfirmado, nao sobrescrever commits de outros agentes.
- Nao usar GitHub Actions/CI remoto. Se for autorizado versionar, commits `[skip ci]`; nenhum merge/force push/tag.
- Proibidos deploy, publicacao em lojas, mudanca de secrets, migracao destrutiva e DELETE/DROP/TRUNCATE em producao.
- Reverter por commit isolado sem migracao ou perda de dados.

## Riscos e relatorio esperado
- Um servidor inconsistente pode falhar mais cedo (intencional) e retomar somente quando cursor correto for emitido.
- Um erro de pull apos push pode reportar progresso parcial: estado permanece `error`, nunca sucesso falso.
- Relatorio: arquivos, erros reproduzidos, comando, contagem de testes, itens nao executados, riscos e branch SHA.

## Evidencia executada na fase A39/A40 (sem CI)
- Baseline do alvo: 3 falhas/6 casos; cursor repetido (13 chamadas no stub), ciclo de cursores (13 chamadas no stub), progresso de push zerado quando pull retorna HTTP 500.
- Correcoes verificadas: 8/8 testes novos PASS; regressao completa dos testes Node versionados disponiveis, `node --test scripts/*.test.mjs`: 189/189 PASS, 0 skipped/falhas, Node v22.16.0.
- `node --check` do novo teste PASS e `tsc --project .../qa/isolated_a37/tsconfig.json` (estrito, com stubs) PASS. Full monorepo, Vitest, Playwright, IndexedDB/WebView e Android/iOS fisicos NAO EXECUTADOS.
- Nenhuma chamada a GitHub Actions, banco/Neon, Vercel ou dados de dispositivos durante esses testes.
