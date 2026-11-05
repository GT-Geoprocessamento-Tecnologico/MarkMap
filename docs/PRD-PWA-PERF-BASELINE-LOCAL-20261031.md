# PRD — Baseline de desempenho local do MarkMap (A197)

**Estado:** PR técnico separado e em rascunho. Base: `main@92dfbffa77d4707820ef9124e97d7b6cf066e260` (v0.5.21). O PR #104, candidato v0.5.22, permanece aguardando homologação. Não reservar nova versão para arquivos de QA.

## Objetivo e contexto
O plano `docs/MM-MAP-900-performance.md` define métricas de startup, mapa, FPS, memória, busca, rota, pacotes e bateria. O baseline físico ainda não foi comprovado. Medir primeiro, antes de decidir WebAssembly/threads/SIMD ou afirmar ganhos por dispositivo. Não pressupor um modelo de celular.

## Auditoria e classificação
- **FUNCIONA (código):** MapLibre com `.maplibregl-canvas`, marca `[data-map-ready="true"]` usada no E2E GeoTIFF, Playwright WebKit/Chromium e CI local. Não implica validação física.
- **PARCIAL:** MM-MAP-900 documenta nove métricas, mas não registra números físicos verificáveis.
- **BLOQUEADO:** issue #45, GitHub Actions sem runner/steps. No ambiente atual, falta checkout completo, pnpm, dependências e navegador real testável.
- **NÃO IMPLEMENTADO:** núcleo WASM otimizado e coleta automática de dados de usuários. Não implementar nesta etapa.

## Escopo
Criar `apps/admin/perf/` com:
1. `baseline-metrics.mjs` + `.d.mts`: funções puras de p50/p95 de intervalos entre frames, FPS, marcações de prontidão e capacidade em faixas genéricas; ausências devem ser `unknown` ou `null`, nunca zeros inventados.
2. `baseline-metrics.test.mjs`: testes Node de entradas, amostras vazias, tempo regressivo e privacidade, sem dependências externas.
3. `playwright.config.ts` e `device-baseline.perf.spec.ts`: suíte manual fora do `testDir` E2E padrão; abre o shell, aguarda mapa/canvas, mede 2,5s de frames durante pan e memória JS opcional. Relatório JSON no console **local**, rotulado `browser-emulation`.
4. Este PRD com sequência de QA em navegadores e aparelhos físicos. Sem alterações no app distribuído.

## Fora do escopo, segurança e LGPD
Não alterar app/runtime, Service Worker, manifest, IndexedDB, outbox, OPFS, mapas locais, Neon, API, versão publicada, sync, permisos, arquivos originais, configs de infraestrutura ou telemetria.
Não coletar user-agent, GPS, modelo, identificadores, IP, screenshots, feições GIS, dados de usuário ou histórico. Não fazer fetch, uploads ou persistência. Métricas de heap não suportadas ficam `null`.
Sem pipeline padrão ou alertas automáticos. Medição emulada não é teste físico.

## Critérios de aceite
1. Node verifica p50/p95, tempo de frames, ausência de dados, capacidade desconhecida, erros e saída sem identificação.
2. Suite Playwright de desempenho é manual e isolada; não é incluída em `pnpm --filter admin test:e2e` nem no bundle de produção.
3. Shell e mapa real devem ficar visíveis, canvas MapLibre presente e frames capturados. Ausência de mapa/frames => **FAIL**, sem falsear sucesso.
4. Medir em Chrome e WebKit emulados (apenas referência técnica); documentar que não representam aparelhos reais.
5. Futuramente comparar v0.5.21 com candidato v0.5.22 no mesmo cenário e em Android de memória restrita, Android mais capaz e iOS/WebKit físicos. Registrar memória/p95/FPS/tempo de carga, sem fabricar budgets.
6. Antes de integrar melhorias funcionais, executar lint/typecheck/Vitest/build/E2E/offline/QA real. Gate #45 continua bloqueado; este PR não homologa #104.

## Como executar no checkout com dependências
```bash
node --test apps/admin/perf/baseline-metrics.test.mjs
pnpm install --frozen-lockfile
pnpm --filter admin exec playwright test --config perf/playwright.config.ts
```
O Playwright usa o build e preview descritos no `apps/admin/playwright.config.ts`. Caso o mapa falhe, capturar o erro, sem inventar baseline.

## Validação executada nesta etapa
- `node --test apps/admin/perf/baseline-metrics.test.mjs`: **15/15 PASS** em Node 22.16.0 (arquivo local do candidato).
- `node --check` das fontes MJS: **PASS**.
- Sintaxe TS global 5.8.3 do config/spec: **0 diagnósticos**; **não equivale a typecheck completo**.
- **NÃO EXECUTADOS:** Playwright integrado, build Vite, suite Vitest, benchmarks reais, memória/bateria física, Android/iOS.

## Git, QA, coordenação, documentação e rollback
Branch própria a partir da main, PR Draft; não tocar os mesmos arquivos do #104 nem alterar versão do app. Não merge, force push, deploy, tags, billing, secrets ou limpeza de dados sem autorização. Documentar SHA, testes PASS/FAIL/BLOCKED e próximos passos no Obsidian/Notion/PR.
Riscos: FPS headless e heap opcional diferem de dispositivos físicos; `map-ready` é sinal de interface, **não** primeiro frame GPU comprovado; preservar nome das métricas. Qualquer erro na suíte é FAIL, não excluir casos para verde artificial.
Rollback: retirar apenas `apps/admin/perf/*` e este PRD, sem modificar armazenamento local. Handoff esperado: branch/SHA, dados de comparação pendentes, condições de aceite, riscos e relatório ao agente futuro.


## A198 — Correção do coletor manual antes da homologação (31/10/2026)
- O `playwright.config.ts` agora fixa explicitamente `webServer.cwd` na raiz `apps/admin`, preservando o comando `pnpm build && pnpm preview` original. Sem esse ajuste, a configuração em `perf/` poderia executar o build na pasta errada.
- A captura `requestAnimationFrame` agora inicia em `pointerdown` e termina em `pointerup`, amostrando apenas o arrasto do mapa (aproximadamente 2 s). Rejeita canvas invisível, página ocultada, ausência de frames, duração < 1 s ou timeout; listeners e timers são liberados.
- A instalação dos listeners é confirmada com `evaluateHandle` **antes** de enviar eventos do mouse; emulaçāo de navegador não equivale a medição em dispositivo físico.
- **QA executado em ambiente isolado:** 15/15 testes Node originais do PR PASS; 5/5 verificações da configuração mesclada com stub PASS; 3/3 caminhos do coletor simulados (drag válido, página oculta e drag curto) PASS; checagem sintática TS sem erros e typecheck isolado com declarações Playwright simuladas PASS. Nenhum benchmark de desempenho real foi produzido.
- **Gates pendentes:** Playwright real com app compilado, lint, typecheck completo, Vitest, build, QA Android/iOS físico e dados de bateria/memória. PR permanece DRAFT, sem merge/deploy.


## A199 — Comparador reproduzivel de antes/depois (31/10/2026)

**Escopo:** somente scripts manuais de QA na PR #105, sem alteracao em codigo do aplicativo, telemetria, storage ou rede. A PR #104 permanece isolada.

### Procedimento com checkout e runner disponiveis
1. Obter o codigo da instrumentacao `apps/admin/perf/` **da mesma PR #105** em ambos os worktrees de teste (v0.5.21 e v0.5.22), sem commit e sem publicar. Essa instrumentacao nao existe originalmente nas branches de release; nao executar benchmarks com versoes diferentes dos scripts.
2. Em cada worktree, instalar com `pnpm install --frozen-lockfile` e executar a mesma suite manual (na pasta `apps/admin`):
   ```bash
   pnpm exec playwright test --config perf/playwright.config.ts --repeat-each=3 > baseline-local.log 2>&1
   ```
3. Manter os dois logs localmente (um por versao, **sem anexar dados pessoais**) e comparar com o mesmo script da PR #105:
   ```bash
   node apps/admin/perf/compare-baselines.mjs baseline-antes.log baseline-depois.log
   ```
4. Conferir manualmente os SHAs dos dois worktrees e o navegador/dispositivo de cada execucao; o comparador **nao infere versao nem identidade do hardware**.
5. A saida apresenta medianas aritmeticas (inclusive para quantidade par de amostras), diferencas percentuais de tempos e cadencia de `requestAnimationFrame`, memoria somente quando ambos os lados a reportam; nenhum veredito automatico de otimizacao.
6. Rejeitar logs ausentes, dados invalidos, perfis de browser diferentes, hints de capacidade incompatíveis e alegacoes de aparelho fisico nao verificadas. A cadencia de `requestAnimationFrame` **nao demonstra FPS de GPU/MapLibre**.

### Evidencia executada e riscos
- `node --test apps/admin/perf/baseline-metrics.test.mjs apps/admin/perf/compare-baselines.test.mjs`: **31/31 PASS** em Node 22.16.0, incluindo RED -> GREEN para mediana aritmetica par, CLI real com entradas artificiais, rejeicao de comparacoes incompatíveis e nao vazamento de logs nos erros.
- `node --check apps/admin/perf/compare-baselines.mjs`: PASS. Codigo e testes versionados no GitHub, conferidos por blob SHA.
- **Nao executados:** Playwright com app real, comparacao real de releases, lint/typecheck integrado, Vite build, Vitest, Android/iOS fisicos. Falha de provisionamento de runner GitHub Actions registrada na issue #45.
- Riscos residuais: navegador emulado e monitoramento rAF nao avaliam fielmente GPU, bateria ou WebView; compatibilidade de buckets nao prova mesmo dispositivo. Nenhum ganho de desempenho deve ser anunciado ate observacao nos aparelhos e gates completos.


## A200 — Gate de repeticoes minimas no comparador de baselines (31/10/2026)

**Problema reproduzido (RED):** o CLI gerava relatorio de comparacao mesmo com 1 execucao por perfil, ou com 3 execucoes de uma versao e 2 da outra. O proprio procedimento de aceite desta PR determina `--repeat-each=3` antes de comparar.

**Correcao (GREEN):** o CLI `node apps/admin/perf/compare-baselines.mjs baseline-antes.log baseline-depois.log` agora verifica **no minimo tres amostras por perfil e mesma quantidade antes/depois**. Se um teste falhar e faltar uma amostra, o comando encerra com codigo nao-zero, sem imprimir comparacao ou dados brutos. `compareBaselineLogs()` permanece util para testes unitarios com fixtures pequenas, mas o *CLI de homologacao* aplica o requisito minimo.

**Evidencia executada:**
- Antes da correcao, dois testes novos falharam porque o comando aceitava logs incompletos.
- Apos a correcao: `node --test apps/admin/perf/baseline-metrics.test.mjs apps/admin/perf/compare-baselines.test.mjs` — **33/33 PASS**, Node 22.16.0.
- `node --check apps/admin/perf/compare-baselines.mjs` — PASS.
- Arquivos da PR cotejados por Git blob SHA com os executados localmente.
- **Nao executados:** Playwright com app real, build, lint/typecheck integrado, Vitest, Android/iOS fisicos, benchmarks v0.5.21 versus v0.5.22. CI segue bloqueado pela issue #45.

**Limites:** tres amostras sao requisito minimo do procedimento, nao constituem significancia estatistica; mesmo hardware/condicoes e resultados do mapa/GPU ainda exigem QA real. Nenhum resultado de desempenho foi inventado. Nenhuma alteracao em runtime, SW, armazenamento offline ou telemetria.
