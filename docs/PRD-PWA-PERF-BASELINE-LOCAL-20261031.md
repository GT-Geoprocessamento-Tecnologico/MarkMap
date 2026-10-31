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
