# MarkMap — Checklist Mestre de Execução


## A20/A21 — recuperação de falhas do mapa e alternativa offline (2026-10-10)

- [x] **A20 IMPLEMENTADO EM CÓDIGO:** mapa com erro mostra `Tentar novamente`, que dispara remount controlado de MapLibre/protocolos sem tocar na seleção, mapas ativos ou outbox.
- [x] **A20 IMPLEMENTADO EM CÓDIGO:** uma tentativa automática por contexto local com erro ao retornar à tela/aba visível; sem timer/poll; evitar loops em falha permanente, erros em rajada e eventos tardios do mapa desmontado.
- [x] **A21 IMPLEMENTADO EM CÓDIGO:** modo `Fundo simples offline` usa fallback local sem fontes remotas, preserva dados de campo e origem selecionada, permite voltar ao mapa regional; GeoPDF e mudança de região/revisão têm prioridade.
- [x] **QA NODE DIRECIONADA:** 42/42 PASS (36 regressões A10–A19, 6 novos A20/A21); `node --check` e declaração auxiliar TypeScript `tsc --strict --noEmit` PASS.
- [ ] **HOMOLOGAÇÃO NÃO BLOQUEANTE PARA DESENVOLVER:** lint/typecheck/build/Playwright monorepo, MapLibre e IndexedDB reais, WebGL context-loss, Android/iOS físicos e desempenho.
- [ ] **PRÓXIMA FASE:** diagnosticar erros residuais de protocolo/recuperação visual e UX de armazenamento sem criar novo estado global; iniciar sobre HEAD real.
- [ ] **PUBLICAÇÃO NÃO AUTORIZADA:** sem merge `main`, Vercel deploy, GitHub CI remoto, Neon/migration, lojas, tags/releases ou exclusão/force-push. PRD `docs/MM-MAP-A20-A21-map-recovery.md`.


## A18/A19 — reconciliação ao retomar e assets da geração correta (2026-10-10)

- [x] **A18 CÓDIGO:** seleção do localStorage reavaliada ao retornar do background mesmo se `storage` foi perdido; verificação do ID+geração ativo IndexedDB em focus/pageshow/visibilitychange visível, sem rede, timers nem polling.
- [x] **A18 CÓDIGO:** eventos concorrentes coalescidos; geração sem mudança não recria MapLibre; remoção é distinguida de falha de leitura; resultados após troca de seleção/desmontagem são ignorados. Settings revalida catálogo local.
- [x] **A19 CÓDIGO:** `assetAtRevision` busca pacote ativo e recurso Blob em **uma transação readonly**, vincula estilo/PMTiles/contornos/glyphs por geração e recusa dados stale.
- [x] **QA Node real e direcionada:** **36/36 PASS**, 0 fail/skip no recorte A10–A19; `node --check` e `tsc --noEmit --strict` isolado de helpers/declarations PASS.
- [ ] **QA NÃO BLOQUEANTE PARA CONTINUAR CÓDIGO:** lint/typecheck/build/E2E monorepo, IndexedDB/MapLibre/WebView real, suspensão real de WebView e aparelhos Android/iOS.
- [ ] **PRÓXIMO DESENVOLVIMENTO:** diagnosticar fluxo de reconciliação de UI em retorno do background e tratar casos confirmados sem substituir store nem arquitetura.
- [ ] **SEM PUBLICAÇÃO:** não foi autorizado merge `main`, GitHub CI, Vercel deploy, Neon/migration, tag/release, app stores, exclusão ou force-push. PRD `docs/MM-MAP-A18-A19-foreground-generation.md`.


## A16/A17 — seleção ativa e mapa offline reativos (2026-10-10)

- [x] **A16 CÓDIGO:** eventos de seleção same-tab e cross-tab via storage, chave histórica preservada, IDs validados e subscribe com unsubscribe; Settings passa a usar `useSyncExternalStore` sem estado duplicado.
- [x] **A17 CÓDIGO:** CommandCenter observa seleção; reinstalação/troca da região selecionada invalida estilo/MapLibre, protocolos, busca, rota, conhecimento, elevação, transporte e workers anteriores. GeoPDF mantém prioridade.
- [x] **A17 CÓDIGO:** ausência de pacote selecionado pode invalidar somente a chave local; sem remoção de pacotes, IndexedDB/outbox, desenhos ou dados de campo. Mudanças no catálogo de região não selecionada não forçam rebuild.
- [x] **QA DIRECIONADA:** Node 5/5 PASS para novos eventos de seleção; Node 17/17 PASS para regressões anteriores em execução separada. Checagem JS e TypeScript isolada da fachada/declaração passou.
- [ ] **HOMOLOGAÇÃO NÃO BLOQUEANTE:** typecheck/lint/build/teste integral, renderização MapLibre/IndexedDB real, multiabas/WebView, Android/iOS, interrupção durante troca rápida.
- [ ] **PRÓXIMO CÓDIGO:** reconciliar alterações perdidas ao voltar do background/aba suspensa lendo geração ativa, sem polls contínuos ou rede.
- [ ] **PRODUÇÃO NÃO AUTORIZADA:** não fazer GitHub CI, deploy, merge main, Neon/migration, tag/release ou exclusões. PRD `docs/MM-MAP-A16-A17-reactive-map-selection.md`.


## A14/A15 — geração transacional e aviso entre abas (2026-10-10)

- [x] **A14 CÓDIGO:** snapshot de geração ativa com manifest; preview exige geração local; atualização reconfirma sob Web Lock e passa geração esperada para `OfflineMapStore`.
- [x] **A14 CÓDIGO:** `stage()` + `activate()` aplicam CAS na transação IndexedDB e recusam sobrescrever novo ativo da mesma região; cleanup limitado ao staging próprio; mensagem de erro orienta consultar novamente.
- [x] **A15 CÓDIGO:** catálogo envia sinal `BroadcastChannel` apenas após commit; Settings invalida autorização e relê IndexedDB; ausência de API não altera proteção da ativação.
- [x] **QA LOCAL DIRECIONADO:** Node `17/17 PASS` (6 novos + 11 regressões); JS check, declarações TS isoladas, sintaxe TS/TSX e simulação do store CAS rejeitando stale sem mutation.
- [ ] **HOMOLOGAÇÃO NÃO BLOQUEANTE PARA DESENVOLVIMENTO:** full lint/typecheck/build, navegador IndexedDB real, múltiplas abas/Capacitor, E2E, Android/iOS físico e fontes OSM licenciadas.
- [ ] **PRÓXIMO CÓDIGO:** seleção de mapa fora de Configurações, atualização de catálogo na navegação e recuperação ao reabrir; checar HEAD/PRs antes de iniciar.
- [ ] **RELEASE SEPARADO:** não realizar CI remoto, deploy Vercel, merge main, tag/release, banco Neon/migração ou exclusão de dados sem autorização expressa. PRD `docs/MM-MAP-A14-A15-cross-tab-consistency.md`.


## A12/A13 — Recuperação de instalação e confirmação segura de versão (2026-10-10)

- [x] **A12 — IMPLEMENTADO EM CÓDIGO:** ao voltar para Configurações restaura URL pública de manifest na aba ou origem do mapa selecionado, sem rede automática; sessionStorage ignora tokens/credenciais/query/hash e não armazena bytes.
- [x] **A13 — IMPLEMENTADO EM CÓDIGO:** preview de update inclui SHA-256 canônico do manifest completo, URL de origem e versão instalada; confirmação valida todos e descarta aceite desatualizado. Installer existente ainda verifica cada arquivo antes de ativar.
- [x] **QA DIRECIONADA REAL:** 14/14 Node PASS, JS `node --check`, registry/types `tsc --strict --noEmit` isolado e TSX sintático.
- [ ] **QA EXTERNA NÃO BLOQUEANTE PARA DESENVOLVIMENTO:** browser/Capacitor multiabas, IndexedDB persistido, lint/typecheck/build monorepo, E2E e aparelhos. Não marcar homologação.
- [ ] **PRÓXIMA FASE:** consistência do estado de atualização e integridade entre abas/navegação, usando HEAD real e evitando reimplementação.
- [ ] **RELEASE/PUBLICAÇÃO:** não autorizado merge main, CI remoto, deploy Vercel, Neon, tag/release e exclusões. Evidência: `docs/MM-MAP-A12-A13-region-continuity.md`.


## A10/A11 — Retomada na interface e quota segura (2026-10-10)

- [x] **A10 CÓDIGO + NODE:** consulta read-only do manifest e contagem de blocos com versão/hash correspondentes; botão retomar e confirmação explícita para staging de outra versão; estados UI checking/downloading/validating/activating/canceling e barra de progresso.
- [x] **A10 CÓDIGO + NODE:** cancelamento por AbortSignal desde fetch HTTPS bounded do manifest, pré-download, download e antes da ativação; cancelamento/saída da tela não apaga chunks ou mapa ativo.
- [x] **A11 CÓDIGO + NODE:** quota insuficiente e limite de mapas tratados separadamente, mensagens acionáveis sem limpar dados automaticamente; rede, checksum e conflito de abas possuem mensagens diferentes.
- [x] **TESTE LOCAL DIRECIONADO:** 8/8 Node PASS (5 novos + 3 históricos), JS `node --check`, TS/TSX `transpileModule` sintático sem erros.
- [ ] **DÍVIDA DE HOMOLOGAÇÃO NÃO BLOQUEANTE PARA DESENVOLVIMENTO:** full lint/typecheck/Vitest/build, E2E UI/IndexedDB/Capacitor, Android/iOS e medição RAM/quota com pacotes regionais reais. Não declarar essas verificações aprovadas nem fechar gate de release.
- [ ] **CONTINUIDADE:** verificar UX de recuperação após navegação/reentrada, fonte remota e diagnosticar pendências de código antes de próxima fase; respeitar `dev/markmap-pwa-v2`. Nenhum CI/deploy/merge/tag/Neon autorizado.


## A8/A9 — memória e retomada segura (2026-10-10)

- [x] **A8 código + Node:** novo `Blob` por chunk persistido no IndexedDB v1, leitura `getBlob` compatível com antigos `ArrayBuffer`, hash do Blob realmente montado sem retenção de arrays completos. Não pressupor benchmark de RAM.
- [x] **A9 código + Node:** `checkResume` usa tamanho esperado por hash e valida alinhamento/chunk; sessions legadas permanecem legíveis. Limpeza atômica de sessão remove somente hashes sem uso em outra região.
- [x] **A9 fallback:** servidor que retorna HTTP 200 em Range não inicial provoca recomeço de digest/montagem do zero, checksum integral obrigatório e progresso monotônico.
- [x] **Testes locais direcionados:** **53/53 Node PASS**, `node --check` e TypeScript isolado do checkpoint store sem erros.
- [ ] **HOMOLOGAÇÃO NÃO BLOQUEANTE PARA CÓDIGO:** lint/typecheck/build/test/e2e monorepo, IndexedDB browser real/Capacitor, RAM/CPU em celular, testes físicos, dados regionais reais com licença. Não declarar funcionalidade homologada em produção.
- [ ] **PRÓXIMO DESENVOLVIMENTO:** auditar fluxo de instalação regional na interface e recuperação amigável em erros/quota, preservar mapa ativo, outbox e operação offline.
- [ ] **GATE DE RELEASE SEPARADO:** nenhum merge main, deploy, CI remoto, tag, release, publicação móvel ou operação Neon sem autorização. PRD: `docs/MM-MAP-A8-A9-checkpoint-recovery.md`.


## A7 — instalação offline sem concorrência no mesmo origin (2026-10-10)

- [x] **IMPLEMENTADO + NODE:** Web Locks com `ifAvailable` por ID para impedir instalação simultânea da mesma região em abas do mesmo origin que suportem essa API; guarda por instância definida antes do primeiro `await`.
- [x] **IMPLEMENTADO + NODE:** falha recuperável `install-busy-other-tab`, lock liberado em erro e fallback transparente quando Web Locks indisponível; estágio/ativação transacional anteriores preservados.
- [x] **Node direcionado:** `46/46` testes verdes, incluindo 3 cenários simulados da A7. Sintaxe JS/TS dos arquivos alterados sem erro.
- [ ] **QA opcional/não bloqueante para desenvolvimento:** duas abas reais, Safari/WebView, quota em pressão, npm lint/typecheck/build/Playwright, Android/iOS. Não afirmar homologação.
- [ ] **PRÓXIMA FASE DE CÓDIGO:** reduzir pico de RAM do Blob final e tratar continuidade de checkpoint; sem deploy/tag/main/CI/Neon nesta etapa.


## Continuidade após M10 — A5/A6 (2026-10-10)

**REGRA NOVA:** avaliação física, dispositivo real e testes de campo **não bloqueiam desenvolvimento**. Evidências ausentes são registradas em dívida de QA/homologação; nunca recebem marcação de teste aprovado. Deploy/release/merge ainda são ações separadas, exigindo autorização explícita.

- [x] **A5 código + Node:** SHA-256 incremental auditável e `sha256Blob` por slices, header PMTiles sem alocação de arquivo inteiro; 6 novos testes direcionados, digest comparado com Node em vários limites de bloco.
- [x] **A6 código + Node:** HTTP Range limitado exatamente ao conteúdo esperado; HTTP 200 completo baixado em chunks com checksum, persistência e limpeza segura; checkpoint contagem com cursor; remoção de cap remoto arbitrário de 64 MiB em favor do orçamento existente de 250 MiB + preflight de quota.
- [x] **QA Node direcionada:** 43/43 verdes (37 anteriores + 6 novos), `node --check` e sintaxe TS isolada.
- [ ] **DÍVIDA DE HOMOLOGAÇÃO, SEM TRAVAR PRÓXIMAS FASES:** teste end-to-end de arquivo >64 MiB, IndexedDB/outbox no WebView e browser, benchmarks RAM/quota, lint/typecheck/build monorepo, Playwright, aparelhos físicos, dados reais licenciados.
- [ ] **PRÓXIMO DESENVOLVIMENTO:** concorrência entre abas e redução de pico de RAM na montagem de arquivos; preservar integração existente e registrar evidências locais.
- [ ] **RELEASE/PUBLICAÇÃO:** não foi solicitado deploy, merge main, tag ou loja; não executar sem autorização explícita. Relatório `docs/MM-MAP-A5-A6-offline-streaming.md`.


## M10 — MM-MAP-900/940, execução local parcial (2026-10-10)

- [x] **QA REAL / Node:** `node --check` do recorte de módulos `.mjs`; suíte começou 25/29 e depois de consertar fixtures PMTiles/contagem e adicionar regressões passou **37/37**, 0 falhas/0 skipped.
- [x] **QA REAL / pesquisa e artefatos:** extrato OSM real externo documentado, 22 artefatos/529.195 bytes publicados localmente em staging, 21 SHA-256/tamanhos conferidos, PMTiles v3/MVT 7 tiles, busca com nomes de ruas e perfis walk/bicycle; `tsc --noEmit` passou somente nos dois módulos TS isolados de busca. SHA/dados em `docs/MM-MAP-M10-qa-2026-10-10.md`.
- [x] **QA REAL / regressão de segurança:** testes cobrem saída existente preservada, falha tardia sem pacote parcial, header raster negado, limite PMTiles excessivo e 3 cenários `SKIP_WAITING` simulados em `node:vm` (não navegador).
- [ ] **BLOQUEADO:** lint/typecheck/Vitest/build completos sem `pnpm` ou `node_modules`; npm externo bloqueado. Playwright/Chromium `localhost` negado pela política do ambiente. Nenhum E2E Web/PWA real, MapLibre, IndexedDB/outbox, Android/iOS físico, instalação remota/cold offline, memória e bateria.
- [ ] **BLOQUEADO:** fonte externa real exige timestamp OSM/data de produção verificado (QA local usou placeholder), assets licenciados e leitor PMTiles independente; nada foi redistribuído ou publicado.
- [ ] **GATE MM-MAP-940 VERMELHO:** não abrir PR para main, não acionar CI, Vercel, tag/release ou produção sem evidência integral e autorização.


## A4 — Publicador de mapas seguro (2026-10-10)

- [x] **PARCIAL EM CÓDIGO, NÃO VALIDADO:** pipeline monta pacote completo em staging isolado; valida caminhos, tamanho e SHA-256 antes de promover a pasta final; erro não publica pacote incompleto.
- [x] **PARCIAL EM CÓDIGO, NÃO VALIDADO:** destino com conteúdo é preservado/recusado (`OUTPUT_NOT_EMPTY`), diretório vazio ainda suportado; stage de `Blob` evita materialização duplicada na cópia para IndexedDB.
- [ ] **M10 / TESTES:** Node testes do pipeline, erro tardio e saída não vazia, conteúdo real PMTiles/OSM, lint/typecheck/build/Playwright, duas abas, IndexedDB/outbox, crash/interrupção, quota e dispositivo.
- [ ] **BLOQUEIOS:** fontes OSM/PMTiles com permissão de redistribuição, glyphs/sprites licenciados e validação de pacote em leitor independente; download remoto 64 MiB, conversor PBF 32 MiB, SHA browser consome memória.


## A3 — MM-MAP-200/210/400/430 (2026-10-10)

- [x] **PARCIAL EM CÓDIGO, NÃO VALIDADO:** cópia em fluxo e checagem básica de PMTiles MVT v3 pré-gerado; limite de 250 MiB no publicador, SHA-256 e saída atômica. PBF direto continua limitado a 32 MiB.
- [x] **PARCIAL EM CÓDIGO, NÃO VALIDADO:** índice offline do extrato pequeno inclui nomes de vias e endereços reais (`addr:*`); `places.json` explícito prevalece; shard excedente derivado é omitido sem anúncio falso.
- [x] **PARCIAL EM CÓDIGO, NÃO VALIDADO:** sidecars de sprites/glyphs incluídos com limites/path seguro, fontes de estilo externas bloqueadas, filtro por bounds e trilhas/ciclovias no estilo básico.
- [ ] **M10 QA FINAL:** fontes e licenças OSM reais; PMTiles leitor independente; lint/typecheck/unit/build/E2E; leitura MapLibre e busca offline no Worker após reinício; IndexedDB/outbox, memória e quota do dispositivo; cobertura de glyphs/sprites; sem GitHub Actions.
- [ ] **LIMITAÇÃO ATUAL:** distribuição remota limitada a 64 MiB e importação grande em memória; não liberar mapas grandes em produção nem fechar gate MM-MAP-940.


## A2 — MM-UPD-030/040 (2026-10-09)

- [x] **CÓDIGO PARCIAL, NÃO VALIDADO:** reload do update PWA só na aba que autorizou; controllerchange de outra aba não força reload.
- [x] **CÓDIGO PARCIAL, NÃO VALIDADO:** validação de scope/worker waiting antes de ativação; SW requer handshake same-origin recente para `SKIP_WAITING`.
- [ ] **QA M10:** verificar outbox, IndexedDB, duas abas, site/app same-origin, atualização online/offline, compatibilidade SW, Safari/Chromium e persistência após reload.
- [ ] **PRÓXIMO A3:** ampliar pipeline OSM/PMTiles e busca regional, sem dados inventados.


## Continuidade A1 — MM-MAP-135/140/145 (2026-10-09)

- [x] **PARCIAL EM CÓDIGO, NÃO VALIDADO:** staging antigo da região substituído em transação IndexedDB, sem excluir mapa ativo; ativação exige geração esperada.
- [x] **PARCIAL EM CÓDIGO, NÃO VALIDADO:** preflight de limite agregado de 250 MiB, espaço temporário para blocos e geração; `navigator.storage.estimate().usage` incorporado; aviso na UI.
- [ ] **GATE M10:** testar quota, corrupção, abort/resume, múltiplas abas, rollback e preservação IndexedDB/outbox; lint/typecheck/unit/build/E2E adiados.
- [ ] **PRÓXIMO A2:** MM-UPD-030/040 — compatibilidade do service worker e popup de atualização opt-in, sem deploy.

- [x] `MM-UPD-030` **CÓDIGO NÃO VALIDADO:** bloquear pacote regional que requer app mais recente comparando com `apps/admin/package.json`; exibir versão do PWA em Configurações (`c8e48b4`). Testar no gate final.

## Próxima fase M8/M1/M3 — GTFS local e hardening (2026-10-09; PREVALECE)

**Branch** `dev/markmap-pwa-v2@98785e5`; `main@156d4e8` preservada, sem CI do GitHub, deploy ou tag. Todas as marcas abaixo significam **código enviado, ainda sem execução da suíte de testes**.

- [x] M8: fonte GTFS Schedule extraída localmente + metadados obrigatórios de licença/HTTPS gera `transit.json` (estações/linhas) sem rede, com orçamento e validações do contrato; `transit.json` original prioritário.
- [x] M3: atribuição OSM permanente ao combinar GTFS, DEM e mapa.
- [x] M2: limpar fonte de atualização HTTP antiga ao importar nova região por pasta, para não atualizar contra servidor obsoleto.
- [x] M1: encerrar portas MessageChannel no popup de atualização PWA.
- [x] M7: preservar segmentos a pé se direção de bicicleta for desconhecida e não anunciar `car`.
- [ ] Próximos pacotes/dados reais com licença, geometrias de transporte somente com shapes oficiais, ampliação de área OSM e compatibilidade/storage.
- [ ] **TESTES AO FINAL**: `pnpm lint/typecheck/test/build`, navegador/E2E, dados GTFS/OSM/DEM reais, GPS, offline, outbox e PWA install/upgrade; nada desta rodada foi testado.
- [ ] Cinco branches legadas continuam pendentes de exclusão por ferramenta, sem perder histórico. Sem main/deploy.

---


## M8 estação no mapa — incremento adicional (2026-10-09)

- [x] `MM-MAP-710` **CÓDIGO:** sobrepor estações verificadas de transporte público ao MapLibre com cores de linha e popup, sem internet (commit `e905ebc`).
- [ ] Validação real e geometria de trilhos/linhas não incluídas; não exibir conexões artificiais como rotas reais.
- [ ] Testes e QA integral continuam reservados ao `MM-MAP-940` final.

---


## Atualização prioritária — 2026-10-09 — após M6/M2/M1/M7 (PREVALECE)

**Branch única:** `dev/markmap-pwa-v2@2a91716`; `main@156d4e8` intocada; `0.2.0-dev.0` em desenvolvimento. **Notion:** https://app.notion.com/p/3ed8e0bd0f4d81b6832bcf848c0ab504?pvs=204

- [x] `MM-MAP-500/530` **CÓDIGO:** processamento opcional de SRTM `.hgt` bruto (1–4 quadrículas) / DEM licenciado em JSON, no-data explícito, grade até 256², SHA-256, IndexedDB, perfil da rota sem rede.
- [x] `MM-MAP-140/700` **CÓDIGO:** URL HTTPS para consulta manual de versão regional e instalação apenas por clique/validação de conteúdo.
- [x] `MM-UPD-020` **CÓDIGO:** SW em espera comprova protocolos via MessageChannel antes do popup ativar atualização.
- [x] `MM-MAP-600` **CÓDIGO:** bloqueio conservador de trechos OSM ambíguos e contagem correta de nós.
- [ ] Todos os itens acima são **não validados**. Por decisão do responsável, nenhum teste/lint/typecheck/build/E2E foi executado nesta sequência. Não marcar como FUNCIONA ou release.
- [ ] Obter dados OSM/DEM reais e atestar licenças, datum, no-data/limites de memória, origem HTTPS/CORS, conservação da outbox e PWA em modo avião.
- [ ] M7: automotivo com relações/turn restrictions; M8: fontes reais Wikipedia/transit; M9 nativo opcional fora de escopo PWA puro.
- [ ] M10 `MM-MAP-900/940`: suíte local integral **somente ao final** do desenvolvimento. CI GitHub, deploy Vercel, PR/merge main, release/tag proibidos nesta etapa.
- [ ] Limpeza remota dos cinco ramos antigos ainda pendente por limitação de ferramentas; não apagar sem autorização/verificação de refs.

**Manual de continuidade:** `docs/MARKMAP_MASTER.md`. Handoff: `docs/handoff.md`. **Não abrir novas branches e não sobrescrever agentes.**

---


## Incremento M3/M5/M7 - extratos OSM para busca e rotas basicas - 2026-10-09

- [x] **Em codigo, NAO VALIDADO:** gerador pequeno `osm.pbf` -> POIs nomeados e grafo basico walk/bicycle com limites estritos; sem grafo de carro, sem relations/turn restrictions condicionais.
- [x] Entradas de publicador `places.json`/`graph.json` continuam prioritarias; fallback da derivacao opcional nao quebra o basemap nem anuncia capacidade ausente.
- [ ] **QA deliberadamente adiada** ate concluir desenvolvimento: grafo real, PBF real, PMTiles independente, lint/typecheck/test/build e E2E PWA offline/IndexedDB no gate final.
- [ ] Pipeline para regioes grandes, acesso legal complexo e DEM com licencas permanecem pendentes.

**Handoff:** `docs/MM-MAP-200-610-small-osm-builder.md`. **Branch:** `dev/markmap-pwa-v2`. Sem GitHub CI, deploy, main, tag ou migration.


## Incremento de desenvolvimento MM-MAP-630/640 e hardening M8 - 2026-10-09

**Branch ativa:** `dev/markmap-pwa-v2`; baseline antes deste incremento: `9919758`; versao `0.2.0-dev.0` sem release. O gate final permanece bloqueado.

- [x] **M7 GPS PARCIAL (codigo):** seguimento de rota por GPS somente no primeiro plano, opt-in, parada automatica no background, mapa com marcador e follow opcional; localizacao efemera sem sync/log.
- [x] **M7 Progresso PARCIAL (codigo):** aproximação sobre polilinha regional, distancia/ETA restante, manobra seguinte, chegada conservadora conforme precisao; fixa um tempo maximo de idade para amostras.
- [x] **M7 Recaclculo PARCIAL (codigo):** Web Worker calcula progresso e rota, 3 fixes confiaveis fora do trajeto antes de tentar reroute, cooldown 30 s; preserva rota anterior em falhas.
- [x] **M7 Voz PARCIAL (codigo):** somente voz local pt-BR declarada pelo browser como localService; opt-in do usuario, sem fallback de voz remota.
- [x] **M8/M2 hardening (codigo):** somatorio de wikipedia/transit na verificacao de totalBytes, e verificador de integridade das regioes inclui todos os arquivos opcionais.
- [ ] **QA NESTE INCREMENTO NAO EXECUTADA por solicitacao do responsavel:** nem testes Node, nem TS/ESLint, nem Vitest, nem build, nem Playwright, nem teste de dispositivo. NAO classificar como funcionalidades validadas.
- [ ] **Final MM-MAP-900/940:** executar a bateria completa apos encerrar o desenvolvimento: dependencias, lint, typecheck, teste, build, E2E offline multi-browser, GPS e Worker simulados, IndexedDB/outbox preservados, pacotes OSM/M8 reais, Android/iOS quando acessiveis, seguranca/licencas.
- [ ] **Continuacao de codigo:** grafo de rotas OSM real e expansao de DEM/relevo com fonte licenciada; ajustes do gestor de regioes por catalogo seguro. Nao gerar dados artificiais para usuarios.

**Documento tecnico/PRD de continuidade:** `docs/MM-MAP-630-640-gps-navigation-handoff.md`.
**Regras:** nao criar novo ramo; nao fazer CI do GitHub, deploy Vercel, tag/release, merge main, migration ou operacao irreversivel. Limpeza de 5 branches antigos continua PENDENTE.


## Governança vigente — 2026-10-09 — branch única PWA

**Fonte operacional:** `docs/MARKMAP_CONSOLIDATION_M8_HANDOFF.md`. **Única branch de desenvolvimento:** `dev/markmap-pwa-v2`, criada a partir do HEAD `86681a9` (todos os cinco branches anteriores em cadeia linear). **main:** `156d4e8` intocada. **Versão de desenvolvimento:** `0.2.0-dev.0`.

- [x] Histórico consolidado sem cherry-pick/rebase/force push.
- [ ] Exclusão das cinco refs antigas **PENDENTE**: API GitHub de deleção indisponível; somente remover depois da última checagem de ancestralidade/PR.
- [x] Auditoria detectou instalação por pasta incompleta (search/routing/contours) e perfil DEM com 0 m fabricados: correções preparadas no ramo consolidado.
- [x] M8 PARCIAL: conteúdo licenciado Wikipedia/transporte offline versionado, SHA-256, IndexedDB/instalação/UI; dados reais e E2E pendentes.
- [x] QA local direcionado: 17/17 Node pipeline/rotas/conteúdo, 5/5 runtime hardening, `tsc --strict` isolado 0 erros, sintaxe TypeScript 14 arquivos aprovada. Não são QA monorepo.
- [ ] Gate M10: lint/typecheck/Vitest/build/Playwright em checkout completo, pacotes reais, rollback/outbox e QA de licença/segurança.

Regra **substitui para próximos agentes** quaisquer instruções históricas abaixo que mandem abrir novos ramos; manter apenas `main` e `dev/markmap-pwa-v2` após a limpeza autorizada. **Sem deploy/CI/tag/release/migration.**


### Incremento M7 — algoritmo de rotas corrigido, ainda PARCIAL (2026-10-09)

- [x] Corrigidos sentido permitido de `oneway`, unidades de ETA em segundos, geometria da rota (inclusive arestas reversas) e cálculo de curvas via coordenadas; regressões em algoritmo puro passaram no Node e `tsc --strict` isolado.
- [ ] Não anunciar navegação operacional: `graph.json` validado/instalado e conectado ao Worker/UI/voz ainda pendente, turn restrictions não são aplicadas e nenhuma rota real em navegador foi testada.
- [ ] Próxima prioridade M7: `MM-MAP-600/610` com grafo regional versionado e roteamento offline em Worker, depois `MM-MAP-620/630/640` GPS, manobras, recálculo e voz; gate Web sem CI Github.

## Incremento M4/M5/M6 — 2026-10-09 (PWA-first, parcialmente validado)

**Branch:** `agent/MM-MAP-310-420-offline-packages` (base `agent/MM-MAP-300-400-pwa-integration@706650b`); **versão:** `0.2.0-dev.0`, sem release. **Manual:** `docs/MM-MAP-310-530-kmz-regional-search-elevation.md`.

- [x] **MM-MAP-310 parcial:** KMZ (`doc.kml` / KML único) com ZIP local limitado, path traversal/zip bomb/CRC32 bloqueados; usa mesmo validador GeoJSON; original preservado.
- [x] **MM-MAP-400/410/420 parcial:** índice `search/*.json` registrado como `searchShards?` com checksum no manifest, orçamento defensivo, instalação no mesmo staging/generation IndexedDB, leitura no PWA e pesquisa no Worker sem rede.
- [x] **MM-MAP-520 parcial:** perfil altimétrico de trilhas 3D importadas no painel Dados (distância, subidas/descidas e gráfico); sem altitude fictícia; não usa DEM.
- [x] **QA isolada:** `tsc --strict` de 4 módulos puros, `node --check` do pipeline, transpilação sintática de 22 arquivos TS/TSX e testes Node locais de ZIP, CRC, busca/registros, reader e perfil executados com sucesso.
- [ ] **QA completo pendente:** lint, typecheck, Vitest, build e Playwright do monorepo (checkout com dependências indisponível); IndexedDB real, PMTiles/OSM real, armazenamento após restart e navegadores móveis.
- [ ] **Próxima fase:** dados DEM/contours reais (M6), roteamento regional + UI/voz (M7), Wikipedia/transporte (M8) e gate MM-MAP-940; não afirmar prontidão para `main`.

Sem CI GitHub, sem deploy/release, sem alteração em `main` ou na branch de integração. Versão oficial permanece `0.1.0` em `main`.


## Progresso M4/M5 — 2026-10-09 (ainda PARCIAL)

**Branch de continuidade:** `agent/MM-MAP-300-400-pwa-integration`, derivada de `agent/MM-MAP-200-pwa-regions@e0dac95`; sem alteração em `feat/maps-engine-v2-offline` ou `main`. **Versão de trabalho:** `0.2.0-dev.0`.

- [x] **MM-MAP-300 parcial:** GPX (waypoints, tracks/segmentos, rotas e altitude) integrado à página Dados; arquivo original e GeoJSON WGS84 validados/salvos offline.
- [x] **MM-MAP-310 parcial:** KML (pontos, linhas, polígonos simples com anéis, altitude) integrado; KMZ e estilos avançados ainda pendentes.
- [x] **MM-MAP-320 parcial:** exportação de GeoJSON normalizado e do original GPX/KML; round-trip completo com persistência em navegador ainda pendente.
- [x] **MM-MAP-400 parcial:** correspondência de IDs do gerador regional (`a0`/`0-9`/`other`) no runtime; shards ainda não empacotados/ativados no dispositivo.
- [x] **MM-MAP-410/420 parcial:** busca por palavras internas com limite e consultas vazias seguras; painel no mapa via Worker busca feições locais já carregadas e centraliza resultados. **Não é busca de POIs OSM regionais distribuídos ainda**.
- [x] **QA direcionada:** 20/20 testes Node passaram, 16 arquivos TS/TSX com sintaxe válida, `tsc --strict` isolado dos módulos puros. Sem GitHub CI.
- [ ] **QA completo:** lint/typecheck/Vitest/build/Playwright do monorepo, navegador IndexedDB, PWA offline e dados OSM reais não executados.
- [ ] **Próxima prioridade:** persistência e carga verificada dos shards de busca de pacotes OSM (MM-MAP-400/410), depois KMZ/round-trip M4, E2E e gate MM-MAP-940.

**Documento de continuidade:** `docs/MM-MAP-300-420-pwa-continuity.md`. Nenhum deploy, release/tag, migration ou merge na `main`.


## Incremento 2026-10-09 — M1/M2/M3 PWA-first, ainda PARCIAL

- **Branch de trabalho:** `agent/MM-MAP-200-pwa-regions`, derivada de `feat/maps-engine-v2-offline@eb8f436` (HEAD de integração não modificado).
- **MM-MAP-200 PARCIAL:** conversor limitado de OSM PBF para MVT/PMTiles v3 sem internet, `region.json` + `manifest.json`, estilo MapLibre básico e sprites PNG/JSON locais. Não processa relações, rótulos/fontes nem regiões grandes; faltam extrato real e leitura PMTiles independente.
- **MM-MAP-130 PARCIAL:** retomada de download HTTP Range com checksum SHA-256 e staging persistente separado via IndexedDB. UI de URL HTTPS em Configurações permite apontar `manifest.json`; só ativa após validar todos os arquivos, mantendo mapa anterior em falhas. Faltam E2E/IndexedDB em navegador e hospedagem/CORS real.
- **MM-MAP-140 PARCIAL:** integridade real do mapa via revalidação de blobs no gerenciador; reparo automático permanece indisponível (sem sucesso falso).
- **MM-UPD-010 PARCIAL:** `version.json` gerado e pré-cacheado no shell com versão, SHA opcional, horário e protocolos. Exibição na interface e protocolo de compatibilidade completo não validados.
- **QA direcionada:** `node --test` = 12/12 aprovados (PBF sintético, PMTiles diretório, HTTP Range, URL, SHA, shell); `node --check` verde. `tsc` isolado com mocks anteriores NÃO é typecheck do monorepo. **NÃO executados:** lint/typecheck/build/Vitest/E2E completos, distribuição real OSM e PWA offline em dispositivo/navegador.
- **Gate:** testes físicos Android/iOS não bloqueiam desenvolvimento PWA, mas a integração em `main` ainda é proibida enquanto o gate Web, revisão de segurança e controle de deploy não estiverem verdes. Nenhum deploy, migration, release ou produção autorizados/executados.
- **Próximo:** validar pacote com extrato PBF real e leitor PMTiles, validar IndexedDB/Playwright, corrigir o pipeline conforme evidência, completar catálogo/update e testes de integração. M4→M8 permanecem parciais/históricos e M9 nativo fora do escopo PWA.


> Documento mestre único da iniciativa Maps Engine v2: `docs/MARKMAP_MASTER.md`.
> Versão baseline em `main`: `0.1.0`. Linha de desenvolvimento ativa: `0.2.0-dev.0` em `feat/maps-engine-v2-offline`.

> Espelho versionado do **Checklist Mestre do Notion**.
>
> Notion: https://app.notion.com/p/3ed8e0bd0f4d81b6832bcf848c0ab504?pvs=204
>
> **Regra de sincronização:** qualquer mudança relevante de fase, arquitetura, bloqueio, evidência ou próximo passo deve atualizar, na mesma execução, este arquivo, o Checklist Mestre no Notion e `docs/handoff.md`. Não marcar item como concluído sem evidência.

**Snapshot:** 2026-10-09  
**Repositório:** `mmatteuus/MarkMap`  
**HEAD main auditado para esta iniciativa:** `156d4e8`

**Branch de integração Maps Engine v2:** `feat/maps-engine-v2-offline`

## Estado operacional

**Objetivo:** manter uma única visão executável da MarkMap. O produto é offline-first; Neon/PostGIS é sincronização/backup, não requisito para o trabalho de campo.

**Auditoria:** fluxo de instalação pelo site foi redesenhado para mesma origem: `markmap.mtsferreira.dev` agora possui manifest/service worker próprios, captura `beforeinstallprompt` antes do render, CTAs chamam `prompt()` no clique e o app operacional é montado em `/app/` por rewrite para o projeto `markmap-app`. O código está em `main`, mas a publicação do HEAD atual está bloqueada temporariamente pelo limite diário da Vercel Free (`api-deployments-free-per-day`, >100); produção ainda não é evidência desta versão.

**Fase atual:** frontends Web/PWA publicados na Vercel com domínios customizados configurados. Release continua condicionado à API/sync remoto de produção, testes físicos, política pública de privacidade, smoke de produção e signing/publicação mobile autorizados.

## Legenda

- ✅ **CONCLUÍDO** — há evidência técnica.
- 🟡 **EM ANDAMENTO** — implementação existe, mas falta fechar validação atual.
- ⏸ **BLOQUEADO** — depende de fator externo.
- ⬜ **PENDENTE** — ainda precisa ser executado.

# FASE 0 — Governança e continuidade

- [x] **P0** Criar Instruções-Mestre do projeto.
- [x] **P0** Criar Handoff de Continuidade.
- [x] **P0** Criar política de mudanças estruturais.
- [x] **P0** Criar baseline de ADRs.
- [x] **P0** Criar política/inventário de terceiros.
- [x] **P0** Criar Checklist Mestre no Notion.
- [x] **P0** Publicar Instruções-Mestre, Handoff, políticas, ADRs e personalização no repositório. Evidência histórica: commits `0326018` até `3fd2979`.
- [x] **P1** Checklist revalidado em 2026-10-02 contra main, PR #2 e Neon production.
- [x] **P1** Auditoria/limpeza documental concluída em 2026-10-03. Evidência: commits `b0d2a3c` e `8ddf3ef`.
- [x] **P1** Espelho versionado do Checklist Mestre criado no repositório em `docs/master-checklist.md`; sincronização Notion ↔ GitHub ↔ Handoff passa a ser obrigatória para mudanças relevantes.

# FASE 1 — Qualidade do HEAD atual

- [x] **P0** Baseline anterior com `lint + typecheck + test + build` verde e Playwright `68 passed / 12 skipped / 0 failed`. Evidência: commit `101d678`.
- [x] **P0** Testes de reconnect/retry/conflict do sync adicionados. Evidência: commit `08073ad`.
- [x] **P0** Baseline verde anterior em `8ddf3ef` registrada.
- [x] **P0** HEAD final `cc2331d` revalidado: Lint, Typecheck, Unit, Build, E2E desktop/Android, E2E iOS/WebKit, E2E duas instalações e PostGIS Integration verdes; Quality and Security verde com dependency audit, secret scan e Lighthouse/a11y.
- [x] **P0** Pacotes mobile revalidados: Android APK verde em `c1f86eb`; iOS App verde em `b52ca6f`.
- [ ] **P1** Revalidar CI completa em um runner que efetivamente execute os steps do HEAD atual; execuções recentes encerraram antes dos steps.

# FASE 2 — Offline-first

- [x] **P0** Escrita local-first via IndexedDB/outbox.
- [x] **P0** React Query configurado para não bloquear mutações locais por estado de rede. Evidência: `fd8875`.
- [x] **P0** Reload/persistência local cobertos por testes e validação de app empacotado.
- [x] **P0** Service worker com limites explícitos de API/navegação/assets.
- [x] **P0** Bootstrap PWA corrigido de `process.env.NODE_ENV` para `import.meta.env.PROD`.
- [ ] **P0** Teste físico Android: criar/editar dados, force-stop e reabrir totalmente offline.
- [ ] **P1** Teste físico iPhone/iPad equivalente.

# FASE 3 — Sync e Neon/PostGIS

- [x] **P0** `/sync/push` e `/sync/pull`.
- [x] **P0** Capability de workspace, idempotência, predecessor, cursor incremental, tombstones e conflitos.
- [x] **P0** Materialização de project/map/layer/feature/import nas tabelas reais.
- [x] **P0** PostGIS e pgcrypto presentes em production.
- [x] **P0** Production possui tabelas de domínio/sync necessárias.
- [x] **P1** Bucket privado `geonexo-assets` criado.
- [ ] **P1** 🟡 Limpeza de drift preparada e validada em branch temporária Neon: remover FK SET NULL obsoleta e quatro índices redundantes. Production permanece inalterada até autorização explícita.
- [ ] **P0** Publicar/configurar a API Hono de production e ativar no app `VITE_API_MODE=live` + `VITE_API_URL`; revisar CORS/env.
- [ ] **P0** Executar smoke de sincronização real contra production com fixture descartável e limpar a fixture depois, somente com autorização explícita.
- [x] **P1** E2E automatizado com dois contextos/instalações isolados cobre capability/recovery, reconexão offline→online, retry, idempotência, pull e conflito. Evidência final: `e0bab0b` + baseline `cc2331d`.
- [ ] **P1** Confirmar fluxo entre dois dispositivos/instalações reais.

# FASE 4 — PWA

- [x] **P0** Manifest standalone e ícones normal/maskable.
- [x] **P0** Cold offline/app shell corrigidos. Evidência: `fd8875`.
- [x] **P0** UpdatePrompt com ativação controlada.
- [x] **P0** Validação automatizada de PWA: manifest/ícones/installability, service worker, app shell offline e migração IndexedDB preservando workspace, entidade e outbox. Evidência: `ad83ff2` e `8aed47d`.
- [x] **P1** Regressões PWA recentes corrigidas: bloqueio de zoom removido e `@vitejs/plugin-basic-ssl` restaurado no desenvolvimento.
- [ ] **P0** 🟡 Instalação do app pelo site implementada em mesma origem: manifest/service worker no site, CTAs chamam `beforeinstallprompt.prompt()` e o app inicia em `/app/`; falta publicar o HEAD atual após liberação do limite diário da Vercel e validar prompt real em Android/Chromium.
- [ ] **P1** 🟡 UX iOS preparada com safe areas, `apple-mobile-web-app-capable`, status bar e fluxo Add to Home Screen; falta validação física no Safari iOS.
- [ ] **P1** Registrar evidência de atualização de versão preservando IndexedDB/outbox em aparelho real.

# FASE 5 — GIS e GeoPDF

- [x] **P0** MapLibre + Terra Draw preservados como núcleo cartográfico.
- [x] **P0** GeoPDF oficial de Araguaína testado com georreferenciamento real. Evidência: `101d678`.
- [x] **P0** Importação de CRS projetado com reprojeção para WGS84 e suporte SIRGAS 2000 / UTM Brasil.
- [x] **P0** Auto-calibração offline de PDF/GeoPDF sem georreferenciamento válido implementada com confidence gate e fallback manual. Evidência: `7603e4b`, `ce2478e`, `02930a1`.
- [ ] **P1** Confirmar fluxo de calibração manual para PDF sem georreferenciamento válido.
- [ ] **P1** Teste de GeoPDF grande em aparelho físico com memória limitada.
- [ ] **P1** Validar exportação/round-trip dos formatos legados prioritários.

# FASE 6 — Android e iOS empacotados

- [x] **P0** Capacitor adotado sem reescrever React/Vite.
- [x] **P0** PWA definida como experiência instalável principal; Capacitor permanece como empacotamento Android/iOS.
- [x] **P0** Workflow Android gera debug APK e valida permissões de GPS.
- [x] **P0** Blank screen em WebView antigo corrigido. Evidência: `0c1839`.
- [x] **P0** GPS Android empacotado e permissões verificadas. Evidência: `d90e341`.
- [x] **P0** Android APK revalidado em `c1f86eb`.
- [x] **P1** Estrutura Capacitor iOS e workflow macOS revalidados.
- [x] **P1** iOS App verde em `b52ca6f`.
- [ ] **P1** Teste físico iOS.

# FASE 7 — Segurança, privacidade e distribuição

- [x] **P0** Banco não é acessado diretamente pelo navegador; fluxo permanece app → API → Neon.
- [x] **P0** Bucket remoto privado.
- [ ] **P0** ⏸ Política pública de privacidade: requisitos técnicos estão em `docs/privacy.md`, mas publicação depende de identidade/contato do controlador, finalidades/bases legais, retenção/exclusão, provedores/regiões, canal do titular e revisão jurídica.
- [x] **P0** Rate limit/abuse protection corrigido em `workspace/provision|recover` com limiter distribuído e controle concorrente.
- [x] **P0** Storage remoto corrigido: capability, prefixo por `workspaceId`, proteção contra path traversal e fail-closed sem S3.
- [x] **P0** Rotas diretas `projects/layers/features` permanecem desabilitadas em production, preservando o caminho por sync.
- [x] **P0** `PATCH /features/:id` com schema, optimistic concurrency e tratamento tipado fora de production.
- [ ] **P1** Definir assinatura/release Android para distribuição.
- [ ] **P1** Definir signing/provisioning iOS para distribuição.
- [ ] **P1** 🟡 Deploy web:
  - [ ] 🟡 site `markmap.mtsferreira.dev`: implementação de instalação em mesma origem pronta em `main` (`/app/` + manifest/service worker + CTA de instalação); publicação do HEAD atual pendente por limite diário da Vercel Free. Produção anterior continua disponível;
  - [x] app `appmarkmap.mtsferreira.dev` associado/verificado na Vercel; Cloudflare DNS-only atualizado para o alvo recomendado pela Vercel `b1fa89794ccd409d.vercel-dns-017.com`; HTTPS validado externamente;
  - [x] confirmado que `appmarkmap.mtferreira.dev` (sem `s`) não é o domínio configurado e não pertence à zona Cloudflare ativa; usar sempre `appmarkmap.mtsferreira.dev`;
  - [x] app fallback `markmap-app.vercel.app` validado;
  - [ ] API/sync remoto de production ainda não publicado/configurado.
- [ ] **P1** Release notes e versão candidata.
- [ ] **P2** Processo operacional pós-distribuição depende do ambiente real; runbook em `docs/release-runbook.md`.


## Auditoria 2026-10-09 — estado verificado (prevalece sobre os registros históricos abaixo)

**main:** `156d4e8`; **branch de desenvolvimento:** `feat/maps-engine-v2-offline`; **versão de trabalho:** `0.2.0-dev.0`.
**Situação:** MERGE PARA MAIN BLOQUEADO, por segurança funcional e para impedir publicação Vercel automática. Ambos os projetos Vercel (`markmap-site`, `markmap-app`) continuam ligados ao GitHub. Nenhum deploy Vercel nem CI GitHub foi iniciado manualmente nesta auditoria.

**Classificação:**
- **FUNCIONA (evidência histórica):** núcleo MapLibre/Terra Draw, operações locais IndexedDB/outbox, GeoPDF e PMTiles/PWA pré-existentes. Resultados históricos no gate são anteriores a esta auditoria.
- **PARCIAL:** gerador regional (agora exige arquivo PMTiles e manifest corretos, mas não gera tiles OSM); prompt PWA (correção de checagem de atualização, sem E2E novo); parsers GPX/KML, busca, roteamento, elevação e conteúdo offline (implementações no código sem comprovação completa em aparelho e distribuição regional).
- **BLOQUEADO:** instalador regional `MM-MAP-130` explicitamente desativado/fail-closed depois de identificar download simulado e ativação de staging vazio; gestão de atualização/reparo regional `MM-MAP-140` sem serviço real; gate `MM-MAP-940` ainda não satisfeito.
- **NÃO COMPROVADO:** renderização de PMTiles regional real, download resumível, pacote com glyphs/sprites locais, iOS build e testes físicos, navegação por voz/Android Auto/CarPlay e métricas de memória/bateria.

**Correções auditadas:** script `scripts/region-pipeline.mjs`, testes do pipeline/tipos, `ResumableInstaller`, `RegionManager` e `UpdatePrompt`. Agora rejeitam entradas incompletas e não alegam instalação/reparo realizado sem dados. **Validação atual executada sem CI:** `node --check`; **7/7 testes direcionados com Node**; parser TypeScript sem erros sintáticos nos 5 arquivos auditados. **Não executados nesta sessão:** pnpm lint/typecheck/Vitest/Playwright/build completo, iOS, testes em aparelhos físicos (workspace completo indisponível e dispositivo remoto offline). Portanto não é possível garantir que tudo funcionará em produção.

**Próximas tarefas prioritárias na ordem de dependências:** `MM-MAP-200` (OSM PBF → PMTiles real + glyphs/sprites + pacote testado); `MM-MAP-130` (download/Range/resume/checksum/staging/activate/rollback reais); `MM-MAP-140` (gestor/updates/reparo seguros); `MM-UPD-010/020` (versões PWA/Capacitor com compatibilidade/outbox e E2E); `MM-MAP-900/940` (perf/dispositivos/iOS + diff + qualidade local completa); depois habilitar PR para `main` apenas com deploy automático Vercel efetivamente bloqueado e validações verdes.

Os itens anteriores marcados como concluídos permanecem como **evidência histórica de desenvolvimento**, não como liberação atual para merge/release.

# FASE 8 — Maps Engine v2 offline

> PRD/Handoff executor: `docs/markmap-maps-engine-v2-prd-handoff.md`. Toda implementação desta iniciativa deve ocorrer na branch `feat/maps-engine-v2-offline` ou em branches curtas derivadas dela. PRs intermediários apontam para a branch de integração, nunca diretamente para `main`.

## M0 — Governança e baseline

- [ ] **MM-MAP-000 P0** Revalidar baseline da branch: HEAD, trabalho paralelo, lint, typecheck, testes e build aplicáveis; registrar FUNCIONA/PARCIAL/QUEBRADO/NÃO IMPLEMENTADO.
- [ ] **MM-MAP-010 P0** Fechar inventário de proveniência/licenças dos repositórios-modelo; não incorporar código GPL do `openstreetmap-website`; não redistribuir `.mwm/.bin` do Organic Maps.

## M1 — Atualizações do aplicativo

- [ ] **MM-UPD-010 P0** Criar version/build manifest público com versão, SHA, protocolo de shell, schema local e release notes curtas.
- [ ] **MM-UPD-020 P0** Evoluir `UpdatePrompt` para checagem periódica/conservadora, `Atualizar agora` + `Depois`, compatibilidade, outbox durável e reload após `controllerchange`.
- [ ] **MM-UPD-030 P1** Criar aviso equivalente de nova versão em builds Capacitor, abrindo o canal oficial de atualização da plataforma.
- [ ] **MM-UPD-040 P0** Criar atualização independente de pacotes de mapas com staging, checksum, resume, swap atômico e rollback.

## M2 — Storage e Region Package v2

- [ ] **MM-MAP-100 P0** Criar `DeviceStorageProfile` com quota/usage/persistência/backend e orçamento seguro por dispositivo.
- [ ] **MM-MAP-110 P0** Criar `LargeBlobStore` com fallback IndexedDB, OPFS na Web/PWA e filesystem Capacitor somente quando justificado.
- [ ] **MM-MAP-120 P0** Evoluir contrato de pacote offline para v2 com capabilities, componentes opcionais, compatibilidade, fontes/licenças e checksums por arquivo.
- [ ] **MM-MAP-130 P0** Implementar instalador resumível com staging, retry idempotente, validação e ativação atômica.
- [ ] **MM-MAP-140 P1** Criar gerenciador de regiões: versão, tamanho, data OSM, atualizar, reparar, remover e atribuições.

## M3 — Mapa OSM moderno

- [ ] **MM-MAP-200 P0** Criar pipeline regional reproduzível OSM PBF → artefatos MarkMap, sem depender de `tile.openstreetmap.org`.
- [ ] **MM-MAP-210 P0** Criar estilos MarkMap light/dark/outdoor com estradas, vias rurais, ciclovias, trilhas, footways, rios, áreas, POIs, picos e estações.
- [ ] **MM-MAP-220 P1** Criar catálogo/versionamento e atualização de regiões.

## M4 — GPX/KML/KMZ/GeoJSON

- [ ] **MM-MAP-300 P0** Implementar GPX import/export com waypoints, tracks, routes, elevação e timestamps quando presentes.
- [ ] **MM-MAP-310 P0** Implementar KML/KMZ import/export com validação contra path traversal/zip bomb.
- [ ] **MM-MAP-320 P0** Criar round-trip fixtures e garantir não regressão do GeoJSON existente.

## M5 — Busca offline

- [ ] **MM-MAP-400 P0** Criar builder de índice regional de nomes, endereços, refs, categorias POI, aliases e coordenadas.
- [ ] **MM-MAP-410 P0** Executar busca em Web Worker com normalização, prefix, fuzzy conservador, ranking, filtros e cancelamento.
- [ ] **MM-MAP-420 P1** Integrar UX de busca no mapa, histórico local, `perto de mim`, centralizar e navegar.

## M6 — Elevação e outdoor

- [ ] **MM-MAP-500 P0** Criar pipeline DEM/contours baseado em fontes licenciadas e metadata de resolução/licença.
- [ ] **MM-MAP-510 P1** Implementar altitude de ponto/cursor/waypoint offline.
- [ ] **MM-MAP-520 P0** Implementar perfil de elevação: distância, ganho, perda, mínimo, máximo e gráfico.
- [ ] **MM-MAP-530 P1** Adicionar contours/hillshade/picos ao estilo outdoor.

## M7 — Roteamento e navegação offline

- [ ] **MM-MAP-600 P0** Criar routing graph builder a partir do OSM com one-way, access, restrictions, surface, bicycle/foot/car.
- [ ] **MM-MAP-610 P0** Implementar router offline em worker para walk/bicycle/car.
- [ ] **MM-MAP-620 P0** Implementar manobras e instruções passo a passo.
- [ ] **MM-MAP-630 P0** Implementar progresso GPS, off-route, recálculo local, ETA e chegada.
- [ ] **MM-MAP-640 P1** Implementar orientação por voz/TTS local, pt-BR primeiro, sem serviço cloud obrigatório.

## M8 — Conteúdo e transporte

- [ ] **MM-MAP-700 P1** Adicionar conteúdo Wikipedia/Wikidata offline com pipeline, compactação, idioma e atribuição.
- [ ] **MM-MAP-710 P2** Adicionar estações/linhas de transporte/metro e busca; multimodal fica para fase posterior.

## M9 — Android Auto e CarPlay

- [ ] **MM-MAP-800 P2** Integrar Android Auto somente após M7 estável e validação das restrições da plataforma.
- [ ] **MM-MAP-810 P2** Integrar CarPlay somente após M7 estável e validação das restrições da plataforma.

## M10 — Hardening e gate de merge

- [ ] **MM-MAP-900 P0** Medir performance/storage/memória/bateria em aparelhos reais; definir budgets por evidência.
- [ ] **MM-MAP-910 P0** Testar corrupção, checksum, path traversal, zip bomb, resource exhaustion, pacote truncado e XSS/URLs externas.
- [ ] **MM-MAP-920 P0** Garantir convivência/migração v1→v2, compatibilidade e rollback.
- [ ] **MM-MAP-930 P0** Atualizar ADRs, arquitetura, guia, testes, privacidade, `THIRD_PARTY_NOTICES.md`, checklist e handoff.
- [ ] **MM-MAP-940 P0** Só então liberar PR da branch `feat/maps-engine-v2-offline` para `main`, com lint/typecheck/tests/build/E2E/mobile/licenças/documentação e evidências físicas aplicáveis verdes.

# Backlog transversal

- [x] Cliente HTTP legado auditado; operação principal é IndexedDB + `/sync/*`.
- [x] Textos/documentação obsoletos de backend/sync/GIS revisados em `cc2331d`.
- [x] Lighthouse/a11y, dependency audit e secret scan adicionados e verdes na baseline final.
- [x] `docs/release-checklist.md`, Handoff, status, GIS, segurança, privacidade e deployment sincronizados na consolidação anterior.
- [x] Runbook de release/rollback preparado em `docs/release-runbook.md`.
- [x] Checklist Mestre versionado no repositório em `docs/master-checklist.md`.
- [ ] Atualizar ADR quando decisão arquitetural vigente for substituída.
- [ ] Atualizar `THIRD_PARTY_NOTICES.md` e inventário ao incorporar código/biblioteca.
- [ ] Não adicionar dependência sem necessidade comprovada.
- [ ] Não executar migration destrutiva, publicação, release/tag, rotação de secrets ou force push sem autorização explícita.

# Próximo item livre

**Auditoria 2026-10-09:** primeiro bloqueio funcional `MM-MAP-200` (tiles OSM reais), seguido de `MM-MAP-130` (instalação real). `MM-MAP-940` não está pronto; não mesclar em `main`.

Sequência obrigatória da trilha Maps Engine v2:

1. MM-MAP-000;
2. MM-MAP-010;
3. M1 — atualização do app;
4. M2 — storage + Region Package v2;
5. M3/M4 — mapa OSM + formatos;
6. M5/M6 — busca + elevação;
7. M7 — routing/navegação;
8. M8/M9 — conteúdo/transporte/automotive;
9. M10 — hardening e gate de PR para `main`.

A preparação da API Hono de production e os gates de release atuais continuam pendentes em paralelo, sem misturar implementação com a branch do Maps Engine v2.

# Regra para novas conversas/agentes

1. Ler a Fonte Principal do projeto.
2. Ler `docs/master-checklist.md`, `docs/handoff.md` e `docs/README.md` no HEAD atual.
3. Consultar o Checklist Mestre no Notion.
4. Verificar HEAD, PRs e tarefas/agentes em andamento.
5. Não duplicar trabalho.
6. Continuar pelo próximo item livre.
7. Ao mudar estado relevante, atualizar **Notion + `docs/master-checklist.md` + `docs/handoff.md`**.
