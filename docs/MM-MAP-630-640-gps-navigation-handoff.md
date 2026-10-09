# MarkMap - MM-MAP-630/640: GPS em primeiro plano e orientacao offline

**Data:** 2026-10-09  
**Branch de desenvolvimento unica:** `dev/markmap-pwa-v2`  
**Base auditada antes da mudanca:** `9919758c37accb82310da86a7522d46b25c0877f`  
**Versao de trabalho:** `0.2.0-dev.0` (sem tag ou release).  
**Estado:** IMPLEMENTADO EM CODIGO / NAO VALIDADO. Testes integrais adiados por solicitacao expressa do responsavel.

## Objetivo

Adicionar navegacao baseada no GPS que funciona com o grafo regional armazenado no aparelho, sem Google Maps, chamadas remotas ou registro permanente de coordenadas. Preservar React/Vite/TypeScript, MapLibre/Terra Draw, IndexedDB/outbox, Hono, Neon/PostGIS e Capacitor opcionais.

## Contexto e classificacao antes da mudanca

- FUNCIONA na linha historica: basemap e ferramentas GIS, IndexedDB/outbox. Ainda sem teste integral recente neste HEAD.
- PARCIAL: roteamento walk/bicycle/car pelo grafo instalado e Worker; GPS somente de ponto unico; TTS como previa manual; curvas e indices regionais em fixtures.
- QUEBRADO: calculo de `totalBytes` no schema M8 ignorava arquivos `wikipediaPack` e `transitPack`, podendo rejeitar o proprio pacote. `RegionManager.repairRegion` omitia todos os ativos opcionais, retornando validacao inadequada.
- NAO IMPLEMENTADO: watch GPS continuo, progresso por rota, recalc, aviso de saida do trajeto, chegada com margem de precisao, voz local por manobra.

## Implementacao

1. `packages/maps/src/routing/navigation-progress.ts`: projecao de pontos GPS na rota, distancia ao trajeto, estimativas restantes, manobra seguinte e chegada conservadora. Fixes vencidos ou imprecisos sao recusados, sem assumir altitudes.
2. `apps/admin/src/workers/offline-route.worker.ts`: guarda somente a rota ativa em memoria, calcula progresso com mensagens tipadas e refaz a rota usando o grafo local. Respostas obsoletas tem identificadores.
3. `apps/admin/src/components/map/OfflineRouting.tsx`: opt-in para `watchPosition`/`clearWatch`, continuidade apenas em primeiro plano, permissao Capacitor quando aplicavel, inicio/parada/retomada, status, ETA, sinal e recalc controlado por repeticao/cooldown. Sem sincronizacao de GPS, logs de trajeto ou armazenamento de amostras.
4. `apps/admin/src/pages/workspace/CommandCenterPage.tsx`: marcador GPS e acompanhamento opcional de camera no mapa. Nao reajustar a camera para o percurso completo durante o recalc.
5. `MM-MAP-140/M8`: corrigir soma de Wikipedia/transporte no manifest e incluir todos os ativos opcionais na leitura de integridade do gerenciador.

## Regras de seguranca, privacidade e limites

- Geolocation requer HTTPS/contexto seguro e permissao explicita; no Capacitor, usar o bridge de permissao ja existente. `watchPosition` nao e prometido em background. Ao ocultar pagina, navegar para outra rota ou desmontar a tela, `clearWatch` e imediato. Retomada exige novo clique.
- Dados GPS sao efemeros no navegador. Nao inserir amostras em IndexedDB/outbox, querystring, telemetry remota, logs ou API Neon.
- Rejeitar fix com mais de 30 s, precisao pior que 80 m, coordenadas impossiveis ou timestamp futuro >5 s. Parametros iniciais sujeitos a medicao final.
- Desvio somente apos 3 fixes confiaveis consecutivos acima de `max(40 m, 2x accuracy)`. Cooldown minimo 30 s; sem caminho local alternativo, manter rota anterior e avisar. Nao insistir sem limite.
- Chegada somente quando a esfera de precisao estiver completamente dentro do raio de 25 m do destino e houver progresso proximo ao final do trajeto.
- Voz apenas `SpeechSynthesisVoice.localService === true`, preferencia `pt-BR`; nenhum TTS remoto implicitamente selecionado. A disponibilidade real por Android/iOS/WebView varia e precisa de evidencia final. Instrucoes nao substituem sinalizacao de transito.
- Sem tracking persistente em background, Android Auto/CarPlay ou promessa de seguranca viaria. M7 so se torna CONCLUIDO apos dados reais e QA.

## Escopo excluido

- Background Geolocation, tracking remoto, compartilhamento de posicao, analytics geograficos, armazenamento de trilhas, notificacao push, Android Auto e CarPlay.
- Gerador de grafo completo a partir de OSM PBF, todos os tipos de restricoes condicionais e rota a partir de fontes nao oficiais.
- DEM/licenciamento/dados de terreno reais; nenhuma mudanca destrutiva em schema/banco.
- Nao mudar a fonte de verdade de dados do dispositivo; Neon permanece sync/backup.

## Arquivos

- `packages/maps/src/routing/navigation-progress.ts` (novo)
- `apps/admin/src/workers/offline-route.worker.ts`
- `apps/admin/src/components/map/OfflineRouting.tsx`
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx`
- `packages/contracts/src/offline-map.ts`
- `apps/admin/src/lib/storage/region-manager.ts`
- `docs/MM-MAP-630-640-gps-navigation-handoff.md`
- `docs/master-checklist.md`, `docs/handoff.md`, `docs/MARKMAP_MASTER.md`

## Aceite a verificar na rodada final (nao executar agora)

- Dado um pacote com grafo regional valido, quando o usuario permite GPS e inicia navegacao, entao o marcador atualiza e distancia, ETA e manobra sao calculados exclusivamente no dispositivo.
- Dadas amostras antigas/imprecisas, quando chegam, entao nao disparam recalc, chegada nem anuncios de manobras.
- Dado um desvio real com fixes confiaveis repetidos, quando fora da rota, entao existe no maximo um recalc ativo e a rota anterior permanece caso nao exista alternativa.
- Quando pagina fica oculta, permissao e negada ou a rota e limpa, `clearWatch` cancela observacao e TTS para; reabrir nao reinicia o GPS sem clique.
- Dada voz pt-BR do tipo localService, o opt-in habilita instrucoes locais; sem voz local, app avisa e continua sem audio.
- Dado Wikipedia/transporte no pacote regional, o manifest soma todos os assets e o verificador inclui todos eles.
- Dado um update PWA em offline/outbox com escritas pendentes, nada de projeto ou outbox e descartado.

## Sequencia de QA final (solicitada para depois do desenvolvimento)

**Nao executado nesta entrega:** nenhum teste, lint, typecheck, build, Playwright, emulador ou teste fisico. Nao marcar aprovacao por inspecao de codigo.

Quando autorizado para a rodada final:

1. Checkout completo no HEAD consolidado e `pnpm install --frozen-lockfile`.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` no monorepo.
3. Vitest do progresso GPS e do contrato M8, inclusive erros, limites, throttle, permission denied e ticks com tempo falso.
4. Playwright Chromium/Firefox/WebKit, GPS simulado, background/foreground, Worker, IndexedDB e PWA reiniciada offline.
5. Pacote OSM PMTiles + graph + busca + transit/wikipedia reais, hash, importacao via pasta/URL, integridade, alteracao de geracao, rollback e quota.
6. Revisao acessibilidade/UX em mobile; evidencias fisicas Android/iOS/GPS se disponiveis (nao bloquear evolucao sem aparelhos).
7. Security review: licencas OSM/CC, URL, HTML, ZIP, cache, outbox e regressoes.
8. Liberar PR para main somente com gate MM-MAP-940 aprovado e bloqueio de deploy automatico Vercel comprovado.

## Regras Git e proibicoes

- Trabalhar **apenas em `dev/markmap-pwa-v2`**, revalidar HEAD/PRs antes de push e marcar `[skip ci]`; nao criar nova branch por fase. Nao executar CI do GitHub.
- Nao realizar merge em main, deploy, release/tag, publish mobile, force push/reset, credenciais, mudanca critica de permissao, migration destrutiva, DROP/TRUNCATE/DELETE, secret rotation ou modificacao de producao.
- Os cinco branches antigos continuam pendentes de exclusao remota, embora o historico esteja preservado no ramo consolidado. Nao apagar referencias sem verificar SHAs atuais e trabalho paralelo.

## Riscos / rollback

- GPS de baixo sinal e ruas paralelas podem produzir match incorreto. Valores de limite sao iniciais, nao calibrados em campo; instrucao exibida e aproximada.
- Sem grafo regional instalado, permanece apenas planejamento manual; GPS nao fornece rota real.
- TTS local pode ser inexistente ou bloqueado pelo navegador. Nenhum fallback cloud e utilizado.
- A desativacao desta tela e possivel por revert dos commits desta fase, sem migracoes e sem tocar na fonte operacional IndexedDB/outbox.

## Relatorio final esperado / proximo task

Reportar `RESULTADO`, `MODIFICACOES`, `ARQUIVOS`, `QA EXECUTADA`, `QA PENDENTE`, `RISCOS`, `LICENCAS` e `PROXIMO ID`. Proxima prioridade em codigo: pipeline de roteamento OSM real e polimento do gerenciamento de regioes. O teste integral permanece reservado a MM-MAP-900/940 quando o desenvolvimento estiver concluido.
