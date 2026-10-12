# Handoff de continuidade


## A34 — leitores offline presos à geração ativa (2026-10-11)

**Base confirmada:** `dev/markmap-pwa-v2@bca6b28`; código e testes A34 versionados nos commits `6db152f`, `17ba3c7`, `3e11fb7`, sempre `[skip ci]`. **QUEBRADO EM CONTROLE DE FLUXO:** busca, worker de rota, painel Wikipedia/transporte e altitude liam manifest via `get()` e recurso via `asset()` em transações distintas, permitindo mistura entre gerações durante update concorrente; busca/conteúdo/altitude ecoavam exceções internas no UI. **CORRIGIDO:** agora usam `getActiveRevision` e `assetAtRevision`, verificam geração final e só apresentam mensagens allowlist ou genéricas. Sem alteração em `OfflineMapStore`, schema, IndexedDB/outbox, sync, MapLibre ou rede.

**TESTES EXECUTADOS SEM CI GITHUB:** Node v22.16.0, `node --test scripts/*.test.mjs` **164/164 PASS**, incluindo 14 regressões A34 com mocks do Worker/React. `tsc --noEmit --strict` de quatro módulos com stubs isolados **4/4 PASS**, parsing TSX da página sem diagnósticos e JS check PASS. Não equivalem ao build completo. Browser real inviabilizado: Chromium local bloqueia localhost/file/data por `ERR_BLOCKED_BY_ADMINISTRATOR` e IndexedDB em about:blank lança SecurityError. `git ls-remote` falha por DNS; monorepo completo, pnpm, Vitest, Playwright, desempenho e dispositivos NÃO TESTADOS. A32/A34 **PARCIAL**, A35–A38/RC **PENDENTES**.

**PRÓXIMO:** gate integral e E2E real quando houver checkout/dependências e navegador autorizado; sem impedir desenvolvimento seguro e sem usar quota de CI do GitHub. Não alterar `main`, Vercel, Neon, releases/lojas ou dados reais. Rollback por revert isolado dos commits A34 (sem migration).


## A32/A33 — auditoria e mensagens seguras no worker de rotas (2026-10-11)
- [x] A32 Node: 144/144 testes versionados no HEAD original; ciclo MapLibre, leases e worker auditados no código.
- [x] A33: erro bruto no worker reproduzido com token; alterado para allowlist de mensagens conhecidas e resposta genérica. Após a correção: 150/150 testes Node PASS (6 novos), declaração TypeScript e parsing sintático PASS.
- [ ] A32/A34: monorepo lint/typecheck/build/Vitest/Playwright e WebGL/PMTiles/IndexedDB reais pendentes por ausência de checkout, dependências e DNS npm/GitHub.
- [ ] A35–A38: Android/iOS físico, PWA instalada, dois dispositivos, política de privacidade e RC pendentes. Nenhuma homologação de release.
- [ ] Sem alterar main, Neon, migrations, deploy, CI remoto, tags, lojas ou dados locais.

## Continuidade A30/A31 — readiness do GeoJSON e aviso de WebGL recuperado (2026-10-10)

**HEAD-base auditado:** `dev/markmap-pwa-v2@6b8b613`, `main@156d4e8`, sem PRs/issues abertas. **A30 EM CÓDIGO:** a fonte `local-dataset` já carregada pode completar readiness após `style.load` mesmo sem novo evento. `Map.getSource` valida existência antes de `Map.isSourceLoaded` para não gerar `ErrorEvent` por ID ausente; valida novamente o estado do source ao receber `sourcedata` e antes do `render` posterior, evitando resposta antiga/carga reiniciada. Adapters antigos continuam aceitos. **A31 EM CÓDIGO:** mensagem conhecida de contexto WebGL perdido só desaparece com pintura concluída; erro real de recursos após restauração substitui banner antigo com texto seguro. Não mexe em pacotes, worker global, sync, GeoPDF, campo, IndexedDB, outbox ou banco.

**EVIDÊNCIA EXECUTADA:** Node 22.16.0, recorte de testes Node recuperados do HEAD **147/147 PASS** incluindo 14 novos A30/A31. Um falso negativo inicial (142/147) decorreu de downloader A6 anterior copiado para workspace; corrigido somente ambiente de teste para Blob SHA `739fbb8` do HEAD e executada a suíte integral novamente. `node --check`, `tsc --strict --noEmit` isolado .d.mts e `transpileModule` TSX PASS. **NÃO EXECUTADO:** full lint/typecheck/build/CI, Vitest, Playwright, MapLibre/PMTiles/WebGL/IndexedDB reais e dispositivos. Homologação separada, não bloqueia desenvolvimento. PRD: `docs/MM-MAP-A30-A31-source-readiness.md`.

**Próximo foco:** auditar HEAD para eventos de renderização, requisições e workers reais sem presumir falhas e sem duplicar A24–A31; sem CI remoto, merge main, deploy Vercel, Neon, migrations, tag/release, secret, publicação ou ações irreversíveis.

---


## Continuidade A28/A29 — estilos e overlays após restauração WebGL (2026-10-10)

**HEAD-base auditado:** `dev/markmap-pwa-v2@f93d9bb`; `main@156d4e8`; zero PRs/issues abertos na auditoria inicial. **A28 IMPLEMENTADO:** `createOfflineStyleLifecycle` controla eventos `style.load`, `sourcedata` e `render` por geração; impede callbacks atrasados, duplicação de readiness, perda de evento síncrono e operações em mapa removido/sem contexto WebGL. Integrado à `CommandCenterPage`, com reporte de falha seguro A23 e preservação do orçamento de recuperação A27. **A29 IMPLEMENTADO:** `ensureOfflineSourceLayers` repara camadas ausentes mesmo se a fonte existe; integrado a dataset, preview de desenho, GeoPDF, contornos, trânsito e rota sem substituir dados de campo. Modo neutro, GeoPDF e offline-first preservados.

**TESTES REALMENTE EXECUTADOS:** Node v22.16.0 **93/93 PASS** em arquivos Node versionados A10–A29; **101/101 PASS** incluindo harness A22 local não versionado; 17 novos testes (11 A28, 6 A29). JS `node --check`, `tsc --strict --noEmit` isolado de declarations e typing smoke, parsing TSX: PASS. **NÃO EXECUTADO:** monorepo full build/lint/typecheck, Vitest, MapLibre real/WebGL, IndexedDB/WebView, Playwright e Android/iOS físico; homologação pendente, desenvolvimento não bloqueado. PRD: `docs/MM-MAP-A28-A29-style-hydration.md`. **Próximo desenvolvimento:** reauditar HEAD para fluxos reais de renderização/recuperação de worker ou transições de estilos que ainda apresentem lacunas comprovadas, sem duplicar funcionalidades existentes.

**SEGURANÇA/GIT:** commit `[skip ci]` somente em dev, sem mudar schemas, Hono, Neon, outbox, Vercel, `main` ou produção. Sem CI remoto, tag/release, deploy, publicação ou operações destrutivas.

---


## Continuidade A26/A27 — requests abortados e restauração do WebGL (2026-10-10)

**HEAD-base auditado:** `dev/markmap-pwa-v2@f042a88`; `main@156d4e8` intocada. Sem PRs/issues abertos na auditoria. **A26 IMPLEMENTADO:** dispatch de protocolo liga cada request a AbortController da sua instância; release do lease cancela requests pendentes, remove listeners e não aborta dados de outra view. Cancelamento propaga prontamente até o chamador mesmo quando I/O de baixo nível não coopera. **A27 IMPLEMENTADO:** eventos MapLibre de perda/restauração WebGL marcam indisponibilidade e tentam reconstrução só uma vez por região/revisão (orçamento permanece entre remounts). Foreground é suspenso enquanto contexto perdido; erros de `map.remove` não impedem descarte do lease e restauração de outra view. GeoPDF, campo, projetos e IndexedDB/outbox preservados.

**VALIDAÇÃO LOCAL:** Node v22.16.0, **76/76 testes do recorte versionado A10–A27 PASS**, zero fail/skipped; incluindo harness legado de protocolo com stub não versionado **84/84 PASS**. Novos testes versionados A26 (7), A27 (6). `node --check` JS, `tsc --noEmit --strict` isolado `.d.mts` e parsing TSX PASS. **NÃO EXECUTADO:** full lint/typecheck/build/Vitest/Playwright monorepo, MapLibre real, WebGL context lost real, WebView/Android/iOS. Não alegar homologação física. PRD: `docs/MM-MAP-A26-A27-webgl-lifecycle.md`.

**Próxima fase de desenvolvimento:** auditar limites de worker/estilo após múltiplas restaurações e diagnóstico de retry manual/fundo neutro com base no HEAD real. Manter única branch dev, nenhum CI/deploy/merge/tag/migration ou operação Neon sem autorização separada.

---


## Continuidade A24/A25 — protocolos globais por leases e rollback WebGL (2026-10-10)

**Base auditada:** `dev/markmap-pwa-v2@dcc8b93`, `main@156d4e8`; sem PRs/issues abertos. **A24 IMPLEMENTADO:** add/remove dos protocolos `pmtiles`/`geonexo-package` migrou da vida de cada componente para gerenciador compartilhado com IDs exclusivos por view, roteando PMTiles/style/glyph/sprite para a geração correta. Liberação não afeta mapas que permanecem montados; requests tardios são abortados. APIs com ID antigo mantidas como defaults de compatibilidade para consumidores existentes. **A25 IMPLEMENTADO:** rollback de configuração síncrona do mapa/controles, preservação de exceção original e limpeza de mapa parcial e lease na falha. Sem mudanças em dados operacionais, sync, outbox, quota ou Neon.

**QA DIRECIONADA REAL:** Node v22.16.0 **70/70 PASS** no recorte A10–A25, incluindo 10 novos Node de simultaneidade, requests tardios e rollback; `node --check` e `tsc --noEmit --strict` em declarations auxiliares PASS. Teste Vitest adicional foi escrito mas **não executado**. Typecheck/lint/build monorepo, React/MapLibre/PMTiles no browser, WebView multiaberta e testes físicos NÃO EXECUTADOS; continuam dívida de homologação **sem bloquear novas fases de implementação**. PRD `docs/MM-MAP-A24-A25-protocol-lifecycle.md`.

**Próxima prioridade de código:** revisar o estado e teardown de workers/PMTiles durante requests realmente concorrentes e eventos WebGL context-lost, com base no HEAD real. Não realizar CI remoto, merge main, deploy Vercel, alterações Neon, tag/release, força de push, exclusão de dados ou loja.

---


## Continuidade A22/A23 — limites de recursos e diagnóstico MapLibre (2026-10-10)

**HEAD-base auditado:** `dev/markmap-pwa-v2@82d4de0`; `main@156d4e8`; sem PRs ou issues abertas antes da intervenção. **A22 EM CÓDIGO:** `OfflinePackageSource` valida offset/length contra `File.size`, rejeita resposta truncada; `createOfflineAssetProtocol` limita blob a 4 MiB, rejeita dados inválidos, usa abort com listener removido em sucesso, falha ou cancelamento e mantém strings de erro testadas anteriormente. **A23 EM CÓDIGO:** diagnóstico seguro de recursos MapLibre e falhas de inicialização, ignora AbortError ao trocar mapas e não exibe URL/token/path cru na interface. A20 retry/fundo simples e integridade A14/A19 preservados.

**QA LOCAL REAL:** 60/60 testes Node PASS no recorte A10–A23 (42 anteriores, 11 novos tests versionados, 7 smoke com pmtiles/package simulados); 2 asserções de mensagens legadas sob o mesmo stub PASS. `tsc --noEmit --strict` do protocolo com stub dos tipos e declarações e `node --check` novos helpers PASS; sintaxe TS do novo teste Vitest verificada, mas o **Vitest real NÃO FOI EXECUTADO**. Ainda não foi executado o build/lint/typecheck completo, React/MapLibre E2E, IndexedDB/WebView e dispositivos reais. Não declarar homologação nem bloquear próximas fases por QA física. PRD: `docs/MM-MAP-A22-A23-protocol-recovery.md`.

**Próxima fase de desenvolvimento:** investigar ciclo de protocolos durante remount rápido e perda de contexto WebGL, com auditoria do HEAD e do Checklist Mestre antes de alterar. Não executar merge/main, CI remoto, deploy Vercel, migrações Neon, publicação, tag, reset ou exclusões.

---


## Continuidade A20/A21 — retry controlado e fundo simples offline (2026-10-10)

**HEAD auditado antes de executar:** `dev/markmap-pwa-v2@55bd506`, `main@156d4e8` preservada. PRs/issues abertos 0. **A20 CÓDIGO:** tratamento de erro cartográfico mostra botão para reinicializar MapLibre sem remover pacote ou dados. Foreground tenta automaticamente só uma vez por contexto local com erro; sem polling/timer; usuário pode repetir manualmente. Erros de tile em rajada são coalescidos; eventos após cleanup não contaminam a nova tela. **A21 CÓDIGO:** modo fundo simples já disponível na biblioteca passa a ser opção para pacote regional com erro, usando estilo em data URI sem rede; dados de projeto e outbox não são alterados, a seleção original é mantida e pode ser reativada. GeoPDF preserva precedência. Quando a região muda, modo neutro anterior não é transferido para outra região.

**TESTES REAIS LOCAIS:** `node --test scripts/*.test.mjs` em workspace de regressão A10–A21 **42/42 verdes** (6 novos + 36 anteriores). `node --check` helper e TS tipo isolado `tsc --noEmit --strict` verdes. **NÃO EXECUTADOS:** typecheck/lint/build completo, React/MapLibre E2E, WebGL/context-loss, IndexedDB browser e dispositivos físicos; nenhuma homologação alegada. Testes físicos não bloqueiam próxima fase de desenvolvimento. PRD `docs/MM-MAP-A20-A21-map-recovery.md`. Próximo foco: observar erros de protocolo e comportamento de UI após retry em browser quando ambiente permitir, sem impedir funcionalidades. `main`, Vercel, Neon e produção intactos; sem CI remoto ou release.

---


## Continuidade A18/A19 — reconciliação foreground e assets por geração (2026-10-10)

**HEAD-base auditado:** `dev/markmap-pwa-v2@8a986d3`, `main@156d4e8`; PRs/issues abertos: 0 antes da intervenção. **A18 IMPLEMENTADO:** janela e documento revalidam seleção e geração apenas quando retornam visíveis (focus/pageshow/visibilitychange), sem polling/rede. Mudança de geração aciona reinit MapLibre já existente; atualização nula de IndexedDB não é interpretada como exclusão. `SettingsPage` relê catálogo local ao despertar; seleção persistida recupera evento `storage` perdido. **A19 IMPLEMENTADO:** ativo + Blob agora são lidos em uma transação IndexedDB readonly com geração explícita. PMTiles/estilo/contornos/recursos MapLibre não misturam gerações após troca concorrente. GeoPDF continua dominante; projetos, desenhos e outbox não são removidos.

**TESTES LOCAIS:** Node `v22.16.0` no recorte local A10–A19, **36/36 PASS** (8 novos testes A18 + 5 A19 + 1 caso A18 seleção e 22 regressões); JS `node --check`, TypeScript `tsc --noEmit --strict` isolado de tipos e fachada PASS. **NÃO EXECUTADO:** build/lint/typecheck do monorepo, React/MapLibre/IndexedDB E2E e Android/iOS; registrar como pendência não bloqueante de desenvolvimento, nunca como aprovado. Documentação técnica: `docs/MM-MAP-A18-A19-foreground-generation.md`. **Próxima prioridade:** auditar UX/erros em retomadas e qualidade integrada quando possível, sem efetuar publicação. `main`, Neon, Vercel, CI remoto, release/tag e lojas intocados.

---


## Continuidade A16/A17 — seleção única e refresh regional (2026-10-10)

**HEAD-base:** `dev/markmap-pwa-v2@7e1339a`, `main@156d4e8`, PRs/issues abertos: 0 na auditoria. **A16 EM CÓDIGO:** `selected-offline-map.mjs` usa chave histórica `geonexo:selected-offline-map-package`, avisa mesmo documento e observa storage de outra aba; fachada TS preserva imports. `SettingsPage` usa `useSyncExternalStore` sem state espelho; nenhuma migração ou rede. **A17 EM CÓDIGO:** `CommandCenterPage` passa a ler seleção observável e sinal A15 de catálogo (somente região selecionada); reinicializa MapLibre/protocolos ao trocar ID/geração, recarrega índice offline e remonta OfflineKnowledge/OfflineElevation/OfflineRouting/OfflineSearch, limpa rota/trânsito obsoletos e ignora mudanças regionais enquanto GeoPDF domina. Região removida zera seleção obsoleta sem excluir dados.

**QA REAL LOCAL:** 5/5 testes novos Node PASS; `node --check` e `tsc --noEmit --strict` para helper/fachada PASS. Separadamente, regressões A10–A15 17/17 PASS. **NÃO EXECUTADO:** build/lint/typecheck monorepo, React/MapLibre E2E, IndexedDB/WebView multiabas e dispositivos reais; não marcar homologação. Testes físicos não bloqueiam continuidade de implementação. **Próximo foco:** reconciliação segura após aba suspensa ou eventos de catálogo perdidos, sem trocar a arquitetura offline-first. `main`, Neon, Vercel, CI, tag/release e produção intactos. PRD `docs/MM-MAP-A16-A17-reactive-map-selection.md`.

---


## Continuidade A14/A15 — consistência de geração entre abas (2026-10-10)

**Base auditada:** `dev/markmap-pwa-v2@b739b11`, `main@156d4e8`, sem PRs/issues abertas no momento da auditoria. **A14 IMPLEMENTADO:** o preview tem `installedGeneration`; atualização revalida origem, base local, manifest e geração; o instalador verifica sob Web Lock e transfere a condição ao armazenamento. A ativação somente promove staging se a mesma geração ainda estiver ativa na transação IndexedDB; falha `stale-active-generation` pede nova consulta. Se ativação falhar, cleanup best-effort restringe-se à geração staging própria. Mapa ativo, outbox e projeto são preservados. **A15 IMPLEMENTADO:** BroadcastChannel entre abas notifica apenas ID da região após ativação/remoção; Configurações limpa consentimentos antigos e atualiza a lista lendo IndexedDB. Sem BroadcastChannel, a aplicação continua com CAS obrigatório.

**TESTES REAIS DIRECIONADOS:** Node 22.16.0 `17/17` verdes (6 novos + 11 regressões), JS check, tipos auxiliares `tsc --noEmit`, TS/TSX syntax e execução controlada da rejeição CAS no store com IndexedDB simulado: sem erros. **NÃO TESTADO (sem bloquear desenvolvimento):** full monorepo lint/typecheck/build, IndexedDB e múltiplas abas reais, WebKit/Capacitor, Android/iOS físico e performance. Não declarar homologação. Documentação detalhada `docs/MM-MAP-A14-A15-cross-tab-consistency.md`. Sem CI/deploy/merge/tag/migração/Neon. **Próximo desenvolvimento:** avaliar a atualização de seleção/mapa visível fora de Configurações e persistência após suspensão, sem duplicar store existente.

---


## Continuidade A12/A13 — recuperação de URL e identidade do update (2026-10-10)

**Base auditada:** `dev/markmap-pwa-v2@6cb65ca`, `main@156d4e8` intacta, sem PRs/issues abertos na auditoria. **A12 CÓDIGO:** URL pública do manifest salva somente em `sessionStorage` após sanitização e restaurada ao reentrar em Configurações; caso não exista, carrega origem associada à região selecionada. Nenhum fetch silencioso. Rascunho inválido ou instalação bem-sucedida elimina a URL temporária, sem apagar checkpoints. **A13 CÓDIGO:** confirmação de atualização carrega preview preso à origem, versão local e fingerprint canônico SHA-256 de todos os campos do manifest; mudança entre consulta e confirmação obriga consultar novamente. State stale invalidado ao atualizar lista/erro. Nenhuma mudança de banco/outbox/Neon.

**QA REAL LOCAL:** 14/14 testes Node direcionados (6 novos + 8 históricos de manifest/feedback), checagem JS e TS isolado sem erros, TSX parse sem erros. **QA NÃO EXECUTADA, SEM TRAVAR CÓDIGO:** build/lint/typecheck/testes completos, browser E2E, IndexedDB/WebView e hardware real. PRD `docs/MM-MAP-A12-A13-region-continuity.md`. Próximo foco: verificar fonte/update e consistência entre abas com testes de contrato e usar o próximo item livre, preservando arquitetura offline-first. Nenhum deploy/CI/release/merge/main/migration foi feito.

---


## A10/A11 — Consulta de retomada e recuperação de quota (2026-10-10)

**HEAD-base auditado:** `dev/markmap-pwa-v2@b753278`; `main@156d4e8` preservada, PRs/issues abertos: 0 no início. **A10 EM CÓDIGO:** Settings usa AbortController da leitura do manifest até downloads e preflight; permite consultar progresso salvo sem gravar, exibe retomada e fases, exige clique explícito para trocar versão de checkpoints, e cancela operação ao sair da tela. Cancelar indisponível depois que ativação começa. **A11 EM CÓDIGO:** classificador de quota e mensagens por tipo de falha com instrução de revisar armazenamento, sem apagar mapa, projetos, outbox ou blocos completos. Nenhum novo serviço/backend/DB e a execução offline existente é mantida.

**EVIDÊNCIA LOCAL:** 8/8 testes Node executados nesta rodada (3 históricos, 5 novos); sintaxe TS/TSX + JS dos módulos alterados sem erros. **SEM HOMOLOGAÇÃO:** React/E2E browser, IndexedDB real, Full Typecheck/Lint/Build, WebView e aparelho. Não confundir testes de sintaxe com build. Testes reais/físicos não bloqueiam desenvolvimento por orientação atual, mas tampouco autorizam release público. PRD detalhado: `docs/MM-MAP-A10-A11-remote-install-ux.md`. **Próxima ação:** revisar recuperação de estado do instalador entre navegações e alertas de fonte remota, apenas se houver lacuna no HEAD real; não reescrever fluxo funcional. Manter `main`, Neon/Vercel, CI, tags, release e branches alheios intactos.

---


## Continuidade MarkMap A8/A9 — código + Node (2026-10-10)

**HEAD-base auditado:** `dev/markmap-pwa-v2@716f112`; `main@156d4e8` intocada. Sem PRs/issues abertos no momento da auditoria. **IMPLEMENTADO A8:** download por Blob parts de IndexedDB ao invés de reter arrays completos; adapter antigo ArrayBuffer preservado sem schema migration. **IMPLEMENTADO A9:** só contar checkpoint alinhado/com tamanho exato, sessões novas incluem sha+size; limpeza transacional protege hashes compartilhados; HTTP 200 sem Range durante retomada reinicia digest e arquivo, sem duplicar prefixo. Resguarda download offline já persistido, mapa ativo e outbox.

**VALIDAÇÃO REAL LOCAL:** Node 22.16.0 **53/53 testes PASS (0 falhas/skips)** incluindo 7 novos; `node --check` JS e `tsc --strict --noEmit` isolado do checkpoint store sem erros; `transpileModule` sintático de módulos TS. **NÃO EXECUTADO:** lint/typecheck/build/E2E monorepo e dispositivo real; não afirmar medição de memória, nem homologação Android/iOS, nem 250 MiB garantidos em browser. Testes físicos/externos não bloqueiam novas etapas de implementação por ordem expressa do responsável.

**Próximo:** melhorar UX de retomada/erro e quota sem alterar stack. Não abrir branch extra; `main`, Vercel, Neon, CI GitHub, tag/release, migrations, deleção de branches e deploy proibidos sem autorização separada. PRD detalhado `docs/MM-MAP-A8-A9-checkpoint-recovery.md`.

---


## A7 — Continuidade entre abas (2026-10-10)

**Branch única `dev/markmap-pwa-v2`, base A5/A6 `459ef22`.** Código implementado: `withRegionInstallLock` usa Web Locks por ID de região para evitar concorrência em abas do mesmo origin, `ResumableInstaller.startInstall` tem guarda `installing` síncrona e retorna `install-busy-other-tab` quando lock indisponível. Sem suporte Web Locks o sistema mantém o fluxo anterior, com a proteção de geração no IndexedDB e sem promessa de exclusividade. **QA dirigida real Node 46/46 verdes** (43 anteriores + 3 novos), sintaxe de helper/wrapper verificada. **Browser multiabas, performance, device, build e typecheck completos NÃO EXECUTADOS**, seguem dívida de homologação sem bloquear implementação. `main`, Neon, Vercel, release/CI/deploy intocados. PRD: `docs/MM-MAP-A7-concurrent-installs.md`.

**Próxima ação de código:** reduzir pico de RAM na montagem do Blob final ou ampliar recuperação segura dos checkpoints; continuar a partir de HEAD real, sem apagar trabalho de agentes. Testes físicos não são condição para novas fases por decisão do usuário.

---


## Continuidade A5/A6 — desenvolvimento sem gate físico (2026-10-10)

**Decisão do responsável:** não travar próximas fases por avaliações físicas ou testes reais. Continuar implementação em `dev/markmap-pwa-v2` com checks locais quando disponíveis; resultados não executados permanecem explicitamente pendentes. Isso NÃO é aprovação de release, nem autorização para alterar `main`, Vercel, Neon ou publicar em loja.

**Base auditada:** `1de7c48`; nenhum PR ou issue aberto. **A5/A6 IMPLEMENTADOS EM CÓDIGO, VALIDADO SOMENTE POR NODE:** SHA-256 incremental em slices de Blob (sem materialização de archive inteiro); header PMTiles lido parcialmente, parsing JSON seletivo, downloads HTTP 206 e fallback HTTP 200 limitados por stream, checkpoints progressivos e contagem com cursor IndexedDB, limite remoto unificado ao orçamento agregado de 250 MiB com preflight de quota. Tela de Configurações atualizada. Foram executados **43/43 testes Node (37 regressões + 6 novos), 0 falhas**, sintaxe JS e 3 arquivos TS checada. Não executados typecheck/lint/build/E2E completos, benchmark em aparelho ou distribuição real acima de 64 MiB. A integridade não é autenticação da fonte.

**PENDENTE MAS NÃO BLOQUEANTE AO DESENVOLVIMENTO:** validação Android/iOS/WebView, volumes regionais reais, gestão de memória e quota, PMTiles independente e cache offline end-to-end. **PRÓXIMA PRIORIDADE FUNCIONAL:** revisão do uso de memória na criação do `Blob` final e tratamento de concorrência de download entre abas, mantendo mapa ativo e outbox; homologação/release só com evidência adequada e autorização separada. PRD `docs/MM-MAP-A5-A6-offline-streaming.md`.

---


## Continuidade M10 — testes locais parciais e pacote OSM real (2026-10-10)

**Base verificada:** `dev/markmap-pwa-v2@86180b5`, `main@156d4e8`. **NÃO APROVAR MM-MAP-940.** Execução Node `22.16.0`: inicial 25/29 (4 fixtures antigas inválidas/desatualizadas); após corrigir somente testes e incluir casos A3/A4/SW, **37/37 verdes**, sem skipped. `node --check` sem erro e TypeScript isolado da busca regional sem erros. Testado PBF real externo de ciclismo NL (SHA-256 `bad024f5f883d751365de707aafde722212daf3a275a6d78b566f11e195b8c1e`), gerou 22 artefatos, 21 hashes/bytes verificados, 7 tiles PMTiles, 128 nomes, grafo walk+bicycle. O `osmDataDate` do smoke foi placeholder NÃO verificado; pacote não é distribuível.

**Bloqueios do gate integral:** falta `pnpm` e workspace `node_modules` sem acesso npm (lint/typecheck/Vitest/build não executados). Chromium `localhost` bloqueado por `ERR_BLOCKED_BY_ADMINISTRATOR`; nenhum Playwright browser real, IndexedDB/outbox pós-reload, SW real, Android/iOS ou perf do aparelho foi validado. Testes SW em `node:vm` não são E2E. Biblioteca externa PMTiles/MapLibre também não validada. Relatório reproduzível em `docs/MM-MAP-M10-qa-2026-10-10.md`. Somente QA adicionada, sem edição de módulos de produção; trabalho na mesma branch, `[skip ci]`. Não alterar `main`, Vercel, Neon, ações CI, release/tag ou migrations. **Próximo:** completar QA em workspace com dependências/rede local e dispositivos, com fontes/data reais licenciadas.

---


## Continuidade A4 — publicação atômica de pacote (2026-10-10)

**Branch:** `dev/markmap-pwa-v2` baseada em `014aeff`; `main@156d4e8` preservada. **PARCIAL EM CÓDIGO, NÃO VALIDADO:** o publicador agora constrói e verifica todos os arquivos (SHA-256 em streaming, tamanho e caminho) em diretório temporário exclusivo antes de mover o conjunto para a pasta final. Saída não vazia gera erro `OUTPUT_NOT_EMPTY` sem alterar arquivos; saída vazia é compatível. Falhas removem somente o staging da execução. `OfflineMapStore.stage` deixa de materializar novamente `Blob` já imutável ao gravar no IndexedDB. Não altera outbox nem contratos ou limite de downloads.

**QA NÃO EXECUTADA** (gate M10 conforme orientação): Node/Vitest, lint, typecheck, build, Playwright e dispositivos. Persistem: fonte PMTiles/OSM real licenciada, revisão independente do pacote, simulação de falha/concorrência, consumo real de memória móvel, teste de reinstalação offline e integridade IndexedDB/outbox. Próximo passo: obter insumos regionais com autorização de redistribuição e iniciar `MM-MAP-900/940` somente quando autorizado o QA final. Sem CI, Vercel, release/tag, migration, main ou Neon. Handoff detalhado: `docs/MM-MAP-A4-publisher-atomic-handoff.md`.

---


## Continuidade A3 — PMTiles pré-gerado maior + busca offline (2026-10-10)

**MM-MAP-200/210/400/430 PARCIAL EM CÓDIGO, NÃO VALIDADO.** Na branch `dev/markmap-pwa-v2`, base `7cbfdf8`, o pipeline passou a copiar PMTiles regional pré-gerado (até 250 MiB) sem carregá-lo inteiro no Node, checando header/bounds/zoom e SHA-256 em stream; empacota sprites/glyphs locais limitados e exige fontes MapLibre locais. O PBF integrado segue limitado a 32 MiB, agora com filtro espacial, limite de vértices e estilo diferenciado para trilhas/ciclovias. O índice OSM derivado inclui vias nomeadas e endereços de tags reais, valida orçamento antes de escrever e respeita o `places.json` do publicador.

**Bloqueios:** QA final não executada por decisão vigente; PMTiles independente, dados OSM reais licenciados, busca regional IndexedDB/Worker offline, detalhes de fontes, cache e quota grandes pendentes. Limite de download remoto de 64 MiB no dispositivo permanece; não interpretar arquivo de até 250 MiB gerado no computador como instalação de 250 MiB garantida na PWA. **Próxima prioridade:** fontes/dados reais autorizados e gate M10 `MM-MAP-900/940`, sem apagar branches legadas. Docs técnicas: `docs/MM-MAP-A3-regional-pmtiles-search.md`.

**Regras:** não rodar GitHub CI, não mergear `main`, não fazer deploy Vercel, tag, release, migration, exclusão ou force-push; nunca tocar Neon production nesta etapa.

---


## Continuidade A2 — atualização PWA segura (2026-10-09)

**MM-UPD-030/040 PARCIAL EM CÓDIGO, NÃO VALIDADO:** controle `controllerchange` só recarrega a aba que aceitou atualização; antes de `SKIP_WAITING`, verifica persistência, compatibilidade, escopo e identidade do worker em espera. No service worker, ativação exige handshake recente de cliente same-origin. Dados locais, IndexedDB e outbox não são excluídos. Site `apps/site` permanece intacto por ter escopo separado.

**QA ainda pendente:** nenhuma suíte lint/typecheck/test/build/E2E executada (M10 reservado); testes de duas abas, atualização offline, cache, worker site/app e fluxo real de dados após atualização necessários antes de release. **Branch:** `dev/markmap-pwa-v2` sobre `10a5642`; `main` intacta. **Próxima fase A3:** MM-MAP-200/210/400/430 (mapa OSM regional maior e busca offline). Sem CI/Actions, Vercel, merge, release/tag ou banco.

---


## Continuidade A1 — 2026-10-09

**MM-MAP-135/140/145 PARCIAL EM CÓDIGO, NÃO VALIDADO:** staging regional obsoleto da mesma região descartado transacionalmente; a geração ativa fica preservada até commit da substituta e `install()` exige identidade da geração. Limite agregado 250 MiB + preflight de espaço temporário de download e atualização; perfil de espaço considera uso efetivo estimado da origem. UI esclarece reserva temporária. Base da branch: `dev/markmap-pwa-v2@f029bda`; versão `0.2.0-dev.0`.

**VALIDAÇÃO NÃO EXECUTADA:** lint, typecheck, testes, build e Playwright reservados ao gate `MM-MAP-900/940`. QA de quota/rollback, duas abas, abort/resume e IndexedDB/outbox continua pendente. **PRÓXIMO A2 — MM-UPD-030/040**, ciclo de atualização PWA opt-in. `main`, Vercel, GitHub CI, Neon, tags/releases e migrações não foram alterados nesta etapa.

---

- `MM-UPD-030` PARCIAL EM CÓDIGO: `region-manager.ts` passou a confrontar pacote com a versão canônica `apps/admin/package.json`; `SettingsPage.tsx` exibe essa versão; commit `c8e48b4`, não testado. Sem main/deploy/CI.

## Continuidade — GTFS Schedule estático regional + hardening (2026-10-09)

**Branch/HEAD confirmado antes do commit docs:** `dev/markmap-pwa-v2@98785e5`; `main@156d4e8`. Sem CI, Vercel, release/tag, migrations e sem QA nesta etapa. `0.2.0-dev.0` não é release.

- M8 PARCIAL EM CÓDIGO: `scripts/gtfs-static.mjs` + `region-pipeline.mjs` aceitam GTFS extraído em `gtfs/`, exigem `gtfs-source.json` com attribution/license/sourceUrl HTTPS, geram pacote estático limitado a 2 MiB; `transit.json` explícito tem precedência.
- M8 segurança: CSV delimitado/aspas com limites de tamanho/linhas, referências de stop/route/trip, bounds e ID; shapefiles/horários em tempo real NÃO existem nem são simulados.
- M3/M2/M1/M7 correções: OSM atribuição sempre visível, importação manual invalida fonte remota velha, porta do SW fechada ao concluir compatibilidade, a pé não desaparece se bicicleta indefinida.
- PENDENTE: feeds GTFS licitamente redistribuíveis, validação no browser, mapa real, outbox, offline PWA, DEM real, carro/restrições; limpeza dos 5 branches antigos com acesso apropriado.
- QA adiada expressamente até M10/MM-MAP-900/940. Não marcar concluído, não mergear main nem fazer deploy.

---


## Novo incremento M8 — 2026-10-09

**`e905ebc`** no ramo `dev/markmap-pwa-v2`: camada de estações com dados regionais comprovadamente instalados/verificados, círculos por linha e popup sem HTML remoto. Sem geometria real de linhas, dados de horários ou validação E2E; fica **PARCIAL EM CÓDIGO**. Nenhum teste executado por pedido do responsável. `main` e Vercel intactos.

---


## Estado operacional 2026-10-09 — M6/M2/M1/M7 contínuos (PREVALECE)

**HEAD de desenvolvimento auditado no início:** `0c827b3`; **commits novos:** `6384c62` (SRTM DEM + contrato/pacote), `409a777` (UI perfil + atualização opt-in de regiões), `ae767f2` (popup SW seguro), `2a91716` (filtros OSM). **Branch:** `dev/markmap-pwa-v2`. **Main:** `156d4e8` sem mudança. **Versão:** `0.2.0-dev.0` sem release.

- **Implementado em código, PARCIAL:** SRTM HGT local para grade regional atribuída/licenciada de até 256×256, no-data explícito, SHA-256 em todos os caminhos, perfil altimétrico de rota no dispositivo.
- **Implementado em código, PARCIAL:** atualização de região somente por HTTPS configurado após instalação remota, comparação SemVer, confirmação por botão e validação integral antes da ativação. Pacotes instalados por pasta não recebem fonte remota arbitrária.
- **Implementado em código, PARCIAL:** popup PWA com handshake de versão do Worker + leitura da outbox antes de skipWaiting. Versão antiga sem handshake não é ativada manualmente.
- **Implementado em código, PARCIAL:** rotas OSM fallback ignoram vias com acesso ou status ambíguos; correção limite de nós.
- **NÃO EXECUTADO:** testes, lint, typecheck, build, Playwright, verificações em navegador, dados reais e dispositivo físico nesta rodada (pedido expresso do responsável). Não afirmar que passou.
- **PENDÊNCIAS:** dados de terreno e OSM licenciados reais, cobertura, perfis carro completos, catálogo/atualizações grandes, limites de armazenamento/rollback e gate de QA final `MM-MAP-940`. Cinco branches antigos ainda não excluídos; nada na main/Vercel.
- **A seguir:** concluir módulos restantes de PWA offline viáveis em código; depois executar apenas na fase final `pnpm lint/typecheck/test/build` + E2E/GPS/IndexedDB/atribuições. Atualizar Checklist Notion e este arquivo ao mudar fase.

**Fonte de escopo detalhado e riscos:** `docs/MARKMAP_MASTER.md`. Seguir somente na `dev/markmap-pwa-v2`, não duplicar trabalho paralelo; `[skip ci]` em commits; sem CI GitHub, deploy, merge, tag, migrations, alterações irreversíveis.

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
> Versão baseline em `main`: `0.1.0`. Linha de desenvolvimento ativa: `0.2.0-dev.0`.

Atualizado em 2026-10-09.

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

## Estado atual

- Baseline funcional anterior validado: `cc2331d`.
- HEAD funcional publicado do PWA: `038deb9f` (instalação PWA corrigida e publicada); frontends atuais seguem READY na Vercel.
- Branches relevantes: `main` e branch isolada de integração `feat/maps-engine-v2-offline` para a iniciativa Maps Engine v2.
- Arquitetura preservada: React/Vite/TypeScript + Hono + Neon/PostgreSQL/PostGIS + MapLibre + Terra Draw + IndexedDB/outbox.
- Experiência principal instalável: PWA.
- Capacitor permanece somente como empacotamento opcional.
- Deploy Web/Vercel autorizado e executado em 2026-10-06; nenhum release/tag, migration de production, publicação em loja ou rotação de secrets foi executado.
- Checklist Mestre agora também é versionado em `docs/master-checklist.md`.

## Sincronização de continuidade

Para qualquer mudança relevante de fase, arquitetura, bloqueio, evidência ou próximo passo, atualizar na mesma execução:

1. Checklist Mestre no Notion;
2. `docs/master-checklist.md`;
3. este `docs/handoff.md`.

O Notion é a visão operacional colaborativa; o arquivo no repositório é o espelho auditável/versionado. Em caso de divergência, confirmar primeiro o HEAD real e a evidência mais recente antes de reconciliar os dois.

## Concluído com evidência

- local-first IndexedDB/outbox;
- PWA installability, service worker, cold offline e upgrade de IndexedDB;
- sync push/pull + dois contextos isolados com reconexão real, retry, idempotência e conflito explícito;
- PostGIS/SRID 4674;
- rate limit distribuído;
- storage workspace-scoped;
- GeoPDF válido + auto-calibração de grade geográfica/UTM com confidence gate e fallback manual;
- lint/typecheck/unit/build/E2E/PostGIS;
- dependency audit, secret scan e Lighthouse/a11y;
- builds debug Android/iOS;
- site `markmap.mtsferreira.dev` publicado/validado;
- app `appmarkmap.mtsferreira.dev` publicado/configurado e validado por HTTPS.

## Bloqueios externos/release

- política pública de privacidade precisa de identidade/contato/retenção/provedores reais e revisão jurídica;
- API Hono/sync remoto de production ainda precisa ser publicada/configurada; o app continua operacional local-first sem depender disso;
- smoke production exige autorização;
- testes físicos/PWA instalada;
- signing/publicação mobile.

## Próximo item executável

A auditoria de 2026-10-09 substitui a afirmação anterior de conclusão: `MM-MAP-200` e `MM-MAP-130` seguem BLOQUEADOS/PARCIAIS e `MM-MAP-940` não passou; implementar/validar antes de PR para `main`. Trabalho remoto da API Hono continua separado.

## Próximo passo de release

Para a iniciativa Maps Engine v2: executar MM-MAP-200 e MM-MAP-130, depois a auditoria/QA física e de build. Não publicar nem mesclar até todos os gates verdes e proteção de deploy automático.

## Rebranding MarkMap — 2026-10-05

- marca pública alterada de GeoNexo para **MarkMap — Planejamento Inteligente**;
- `apps/site` criado como site público React/Vite independente do app operacional;
- `apps/admin` recebeu identidade visual MarkMap preservando offline-first, GIS, sync e contratos existentes;
- PWA e Capacitor passam a exibir MarkMap;
- nome visível mobile passa a MarkMap; identificadores nativos existentes permanecem estáveis para preservar continuidade de instalação e dados locais;
- namespaces internos `@geonexo/*` e identificadores históricos de infraestrutura permanecem por compatibilidade até uma migração específica e validada;
- nenhum deploy, release ou publicação em loja foi executado;
- repositório GitHub renomeado para `mmatteuus/MarkMap`.
- PR #3 integrado em `main`.
- branch `feat/markmap-rebrand-site` não contém trabalho exclusivo após o merge e pode ser removida.
- PR #4 integrado em `main`, unificando a direção visual aprovada entre `apps/site` e `apps/admin`; Android/iOS herdam o mesmo frontend via Capacitor.
- revalidação completa do HEAD pós-merge segue pendente; as últimas tentativas de GitHub Actions encerraram novamente **antes de iniciar steps** (steps vazios), sem evidência de regressão de código. A validação automatizada do HEAD atual segue pendente por runner/infra.


## Refinamento frontend — 2026-10-05

- auditoria visual classificada como **AUDITAR E MELHORAR**;
- site: botão voltar ao topo deixa de sobrepor o crédito "Desenvolvido por MtsFerreira", com ajuste responsivo junto ao footer;
- site: persistência/bootstrap do tema protegidos quando `localStorage` estiver indisponível;
- app: dependência visual de Material Symbols removida dos componentes React; menus lateral, mapa, topo, navegação móvel, imports e CRS usam ícones nativos/emoji centralizados em `AppIcon`;
- app: ações primárias e estados de hover/contraste refinados para os tokens MarkMap `#0075D6` / `#00D6DB`;
- app: mapa, projetos, imports, malhas, analytics, settings, sync e PDF receberam ajustes de consistência sem alterar regras de negócio;
- arquitetura offline-first, GIS, sync, IndexedDB/outbox e Capacitor preservados;
- GitHub Actions do HEAD refinado foram reexecutados uma vez, mas os jobs encerraram novamente **antes de qualquer step** (steps vazios), sem evidência de regressão de código. A validação automatizada do HEAD atual segue pendente por runner/infra.


## Console/browser hardening — 2026-10-05

- `mobile-web-app-capable=yes`;
- conflito `aria-hidden` em elemento focável removido;
- filtros numéricos nullable do OpenFreeMap protegidos;
- fallback de sprites ausentes via `styleimagemissing`;
- nenhum prompt PWA forçado foi introduzido.

## Correção de menus — 2026-10-05

- ícones emoji dos menus foram substituídos por SVG inline autocontido em `AppIcon`, eliminando dependência da disponibilidade de fontes/emoji do navegador ou WebView;
- correção cobre sidebar, navegação móvel, header e ferramentas do mapa que já consomem `AppIcon`;
- teste de regressão `apps/admin/src/test/app-icon.test.tsx` garante renderização SVG sem texto/glyph;
- workflows do HEAD atual foram disparados e estavam em fila no momento deste registro.


## Maps Engine v2 offline — iniciativa isolada (2026-10-07 → 2026-10-08)

Esta seção documenta a iniciativa Maps Engine v2 offline (Parte C), mantida em branch separada.

- branch: `feat/maps-engine-v2-offline`, criada a partir de `main@156d4e8`.
  - **Correção de HEAD real:** o HEAD atual da branch é `62242032` (`62242032849695bf07fed8f72da5c746e68a12f7` — `fix(site): cleanup remaining site and doc changes`), não `156d4e8`. A discrepância entre a base de criação declarada (`156d4e8`) e o HEAD real (`62242032`) está registrada aqui para evitar confusão em futuros handoffs.
- PRD/Handoff executor: `docs/markmap-maps-engine-v2-prd-handoff.md`.
- **Não implementar esta iniciativa diretamente em `main`.** Tudo o que for feito deve ocorrer na branch `feat/maps-engine-v2-offline` e chegar a `main` apenas via PR de integração.
- PRs de agentes paralelos apontam para a branch de integração (`feat/maps-engine-v2-offline`), não para `main` diretamente.

### Progresso por fase (M0 → M10)

| Fase | Escopo | Status |
|---|---|---|
| M0 | MM-MAP-000 baseline, MM-MAP-010 proveniência/licenças | ✅ Concluído |
| M1 | MM-UPD-010..040 (version manifest, UpdatePrompt, Capacitor, pacotes de mapa) | ✅ Concluído |
| M2 | MM-MAP-100..140 (DeviceStorageProfile, LargeBlobStore, Manifest v2, instalador, regiões) | ✅ Concluído |
| M3 | MM-MAP-200/210/220 (pipeline regional, estilos, atualização de dados) | ✅ Docs + código |
| M4 | MM-MAP-300/310/320 (importação GPX/KML, conversão/validação, GeoJSON) | ✅ Docs + código + testes |
| M5 | MM-MAP-400/410/420 (busca offline, índice sharded, result cards) | ✅ Docs + código + testes |
| M6 | MM-MAP-500..530 (DEM/contours, altitude, perfil, relevo) | ✅ Docs + código + testes |
| M7 | MM-MAP-600..640 (routing graph, router, maneuvers, navegação, TTS) | ✅ Docs + código + testes |
| M8 | MM-MAP-700/710 (Wikipedia offline, transporte/metro) | ✅ Docs + código |
| M9 | MM-MAP-800/810 (Android Auto, CarPlay) | ✅ Docs + código |
| M10 | MM-MAP-900..940 (performance, segurança, compat, documentação, gate) | ✅ Docs (gate com pendências listadas) |

### Documentação entregue (22 documentos `docs/MM-MAP-*.md`)

- M0: `MM-MAP-000-baseline`, `MM-MAP-010-proveniencia-licencas`
- M3: `MM-MAP-200-pipeline-regional`, `MM-MAP-210-estilos-markmap`, `MM-MAP-220-atualizacao-dados`
- M4: `MM-MAP-300-importacao-gpx-kml`, `MM-MAP-310-conversao-validacao`, `MM-MAP-320-geojson-integracao`
- M5: `MM-MAP-400-busca-offline`, `MM-MAP-410-indice-sharded-api-busca`, `MM-MAP-420-result-cards-highlighting`
- M6: `MM-MAP-500-pipeline-dem-contours`, `MM-MAP-510-consulta-altitude`, `MM-MAP-520-perfil-elevacao`, `MM-MAP-530-relevo-contours-hillshade`
- M7: `MM-MAP-600-routing-graph-builder`, `MM-MAP-610-runtime-router`, `MM-MAP-620-maneuvers`, `MM-MAP-630-navegacao`, `MM-MAP-640-voz-tts`
- M8: `MM-MAP-700-wikipedia-wikidata-offline`, `MM-MAP-710-transporte-metro`
- M9: `MM-MAP-800-android-auto`, `MM-MAP-810-carplay`
- M10: `MM-MAP-900-performance`, `MM-MAP-910-seguranca`, `MM-MAP-920-compatibilidade-v1-v2`, `MM-MAP-930-documentacao-legal`, `MM-MAP-940-gate-pr`

### Código real implementado (M3→M10)

**Contracts** (`packages/contracts/src/`):
- `elevation.ts` — demMetadata/contour/contourLayer/elevationProfile
- `routing.ts` — routingProfile/graphNode/graphEdge/turnRestriction/routingGraph/maneuver/routeStep/route/routeRequest
- `content.ts` — wikipediaArticle/transitStation/transitLine/transitNetwork

**Maps** (`packages/maps/src/`):
- `elevation/` — `dem.ts` (sampleDem/bilinear), `profile.ts` (computeElevationProfile), `contours.ts` (marching squares 16 casos)
- `routing/` — `router.ts` (Dijkstra+MinHeap, snap, adjacência, perfis walk/bicycle/car), `tts.ts` (TTS pt-BR/en)
- `search/` — sharded index, normalização, prefixo binário, Levenshtein, relevância
- `content/` — `wikipedia.ts` (store + sanitize HTML), `transit.ts` (store estação/linha)
- `automotive/` — AndroidAutoAdapter/CarPlayAdapter
- `security/` — path traversal, zip bomb, checksum, PMTiles header, XML depth, sanitize URL/input

**Geo** (`packages/geo/src/`):
- `gpx.ts`/`kml.ts`/`gpx-types.ts` — parsers regex (sem DOMParser/XXE, sem zod)

**Pipeline (M3)** (`scripts/`):
- `region-pipeline.mjs` — CLI ESM sem dependências: valida entrada, gera shards de busca,
  valida grafo/contours, copia OSM/style, calcula SHA-256 e grava manifest v2.
  Importável como módulo (tipos em `region-pipeline.d.mts`), executável com `--dry-run`/`--help`.

### Testes (suites novas)

- `packages/contracts`: 117 tests
- `packages/maps`: 126 tests (search, elevation, routing, security, offline, pipeline)
- `packages/geo`: 70 passed + 3 skipped (gpx, kml)
- `packages/ui`: 18 tests

**Evidência executada (2026-10-08):**
```
npx turbo run lint build test --filter='./packages/*' --force   → 15/15 successful
```

### Pendências conhecidas

1. `docs/handoff.md` — atualizado com M3→M10 nesta revisão ✅
2. ~~E2E (Playwright) do fluxo offline~~ — **concluído**: `pnpm test:e2e` em `apps/admin`
   → 95 passed / 20 skipped / 0 failed nos projetos chromium, firefox, webkit, pixel-7 e iphone-13.
3. Evidência física: Android/iOS offline, GPS/navigation, Android Auto/CarPlay
4. Baseline de performance em aparelho (MM-MAP-900)
5. ~~`THIRD_PARTY_NOTICES.md` + ADRs + guides (MM-MAP-930)~~ — **concluído**:
   `THIRD_PARTY_NOTICES.md` (fontes OSM/DEM/Wikipedia/transit + origem de código),
   `docs/adr/0004..0006`, `docs/architecture.md`, `docs/user-guide.md`,
   `docs/testing.md`, `docs/privacy.md`
6. ~~Commit desta sequência (M3→M10 + código + testes + docs)~~ — **concluído**: `5368bb8e`.
7. PR para `main` só após fechar o gate MM-MAP-940

- **próximo Task ID livre: FIM DA SEQUÊNCIA M10** (gate MM-MAP-940 com pendências).
- pilha preservada (sem alteração de arquitetura): React/Vite/TypeScript + Hono + Neon/PostGIS + MapLibre + Terra Draw + IndexedDB/outbox + Capacitor.
- objetivo: **offline-first** — everything works cold offline; sync é complemento, não pré-requisito.
- Data Files `.mwm`/`.bin` do **Organic Maps**: **não redistribuir**. Podem ser baixados sob demanda (cache local) ou substituídos por tiles vetoriais próprios; o bundle final não pode incluí-los.
- Código **GPL do openstreetmap-website**: **não incorporar**. Qualquer inspiração deve ser reescrita sob licença compatível com o projeto.
- **UpdatePrompt** deve evoluir para popup **Atualizar agora / Depois** com:
  - proteção de outbox (não descartar transações pendentes ao adiar);
  - compatibilidade com o fluxo de sync existente.
- builds Capacitor devem ter aviso próprio (sem depender do fluxo PWA principal).
- **Status (2026-10-08):** fases M0→M10 com docs entregues; código real de M3→M10 implementado em `packages/contracts`, `packages/maps`, `packages/geo`; suítes de teste novas verdes (lint/build/test 15/15). Sequência commitada em `5368bb8e`. MM-MAP-930 fechado (THIRD_PARTY + ADR-0004/0005/0006 + guides). `apps/admin` verde: lint 0, typecheck 0, build, 91 testes unitários e E2E Playwright 95 passed / 0 failed em 5 projetos (commit `f54656b1`). APK Android (`assembleDebug`) compilado, instalado e executando no emulador `Android_17` — requisito de JDK 21 documentado em `docs/troubleshooting.md`. Pendências restantes: evidência iOS/GPS em aparelho real, baseline de performance, revisão de diff, gate MM-MAP-940 antes de PR para `main`.
- Atualizado em 2026-10-08.

- ícones emoji substituídos por SVG inline autocontido em `AppIcon`;
- cobertura para sidebar, navegação móvel, header e ferramentas do mapa;
- teste de regressão em `apps/admin/src/test/app-icon.test.tsx`.

## Deploy Web/Vercel — 2026-10-06

- Vercel configurada com `markmap-site` (`apps/site`) e `markmap-app` (`apps/admin`);
- site: `markmap.mtsferreira.dev` via CNAME DNS-only para `markmap-site.vercel.app`, HTTPS validado;
- app: erros TypeScript de `storage-management.ts` corrigidos nos commits `4a22770` e `1332350c`;
- app: `appmarkmap.mtsferreira.dev` associado/verificado na Vercel; Cloudflare DNS-only atualizado para o alvo recomendado pela Vercel `b1fa89794ccd409d.vercel-dns-017.com`; HTTPS validado externamente;
- diagnóstico de acesso: `appmarkmap.mtferreira.dev` (sem `s`) não é o domínio configurado e não pertence à zona Cloudflare ativa; o domínio correto é `appmarkmap.mtsferreira.dev`;
- sync remoto de production permanece desativado até publicação/configuração da API Hono;
- nenhuma migration destrutiva, rotação de secret, release/tag ou publicação mobile foi executada.


## Correção de instalação PWA — 2026-10-06

- causa principal identificada: o `beforeinstallprompt` era capturado apenas dentro de Configurações, tarde demais em navegações onde o navegador disparava o evento antes da página montar;
- captura agora acontece globalmente antes do render do app e o mesmo estado é reutilizado pela UI de instalação e pela página de Configurações;
- service worker passa a registrar imediatamente em production, sem aguardar `window.load`;
- manifesto normalizado com `id: "/"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"` e `prefer_related_applications: false`;
- produção validada: `https://appmarkmap.mtsferreira.dev/`, `/manifest.json` e `/sw.js` respondem HTTP 200;
- deploy Vercel do HEAD funcional `038deb9f` está READY;
- confirmação física de instalação em Android/iOS segue pendente.

## Correção do fluxo “Baixar app” no site — 2026-10-06

- causa confirmada: o site público é SPA, mas o deploy Vercel não tinha rewrite para `index.html`; acessos diretos a `/baixar`, `/produto` e `/offline` retornavam 404;
- causa secundária: `siteConfig.appDownloadUrl` estava `null`, deixando a página de download sem destino real;
- CTAs “Baixar app” do header e landing agora apontam diretamente para `https://appmarkmap.mtsferreira.dev/`;
- `apps/site/vercel.json` adiciona rewrite SPA para preservar rotas públicas;
- produção validada após deploy READY do HEAD funcional `17afdb5`: `/baixar`, `/produto` e `/offline` respondem HTTP 200.

## Instalador PWA dedicado — 2026-10-06

- o CTA “Baixar app” do site não abre mais diretamente o dashboard operacional;
- os CTAs agora apontam para `https://appmarkmap.mtsferreira.dev/install`;
- `/install` é uma página dedicada, fora do shell do sistema, que usa `beforeinstallprompt` para solicitar instalação do PWA;
- Android/Chromium recebe botão “Instalar MarkMap” quando o navegador declara o PWA elegível;
- Safari iOS recebe a instrução nativa de Compartilhar → Adicionar à Tela de Início;
- navegadores exigem confirmação do usuário para instalar PWA; instalação silenciosa/cross-origin não é permitida;
- `apps/admin/vercel.json` adiciona fallback SPA para o instalador e demais rotas diretas.

## Refinamento PWA nativo — 2026-10-07

- experiência móvel refinada sem alterar IndexedDB/outbox, sync, GIS ou regras de negócio;
- adicionada navegação inferior global estilo app para telas <1024px: Mapa, Projetos, Dados e Ajustes;
- safe areas aplicadas a header, tab bar, overlays, instalador e prompts;
- status de sync foi deslocado acima da tab bar em mobile para evitar sobreposição;
- feedback curto de conectividade: offline continua salvando localmente e online informa reconexão;
- `navigator.storage.persist()` solicitado em best-effort após instalação do PWA;
- `launch_handler.client_mode = navigate-existing` adicionado ao manifest para reutilizar janela instalada em browsers compatíveis;
- `theme-color` acompanha tema claro/escuro para integrar chrome/status bar do sistema;
- preload/estilos antigos de Material Symbols removidos; ícones permanecem SVG inline;
- build de produção Vercel do HEAD funcional `e80097c` concluído READY, com `tsc --noEmit && vite build` verde;
- TinyFish validou o fluxo público site → `/install` sem links quebrados e o fluxo do app em produção sem falhas críticas; ambiente do teste final era desktop, então bottom tab bar e comportamento físico iOS/Android continuam pendentes de validação em aparelho/viewport real.

## Abertura do app instalado — 2026-10-06

- problema: instalações criadas a partir de `/install` podiam reabrir nessa rota em vez do início;
- manifest já mantém `start_url: "/"`; a correção adiciona uma guarda em modo instalado/standalone que substitui `/install` por `/` antes do render;
- a própria tela `/install` também aplica a mesma guarda caso seja alcançada por navegação dentro do app instalado;
- teste unitário cobre: app instalado em `/install` redireciona; app instalado em `/` não redireciona; navegador não instalado em `/install` continua no instalador;
- validação física Android/iOS continua pendente.

## Remoção da rota `/install` — 2026-10-07

- a página dedicada `/install` foi removida do código e do roteador;
- os CTAs “Baixar app” do site agora apontam diretamente para `https://appmarkmap.mtsferreira.dev/`;
- acessos legados a `/install` redirecionam para `/` no bootstrap, na Vercel e no service worker, cobrindo também abertura offline;
- o manifest mantém `start_url: "/"`, portanto o app instalado inicia no dashboard;
- build de produção do commit funcional `9ee5733` ficou READY na Vercel com `tsc --noEmit && vite build` verde;
- validação em navegador confirmou que abrir `/install` termina em `https://appmarkmap.mtsferreira.dev/` e exibe o dashboard, sem página intermediária.

## Instalação do app diretamente pelo site — 2026-10-07

- auditado: o CTA anterior apenas navegava para outro domínio; por isso não podia abrir o prompt nativo no mesmo clique;
- `apps/site` agora possui manifest e service worker próprios na origem `markmap.mtsferreira.dev`;
- todos os CTAs “Baixar app” do site foram convertidos para ação de instalação que retém `beforeinstallprompt` e chama `prompt()` no clique do usuário;
- Safari iOS usa fallback de instrução Compartilhar → Adicionar à Tela de Início, pois não expõe `beforeinstallprompt`;
- o app operacional é servido em `markmap.mtsferreira.dev/app/` por rewrite para `appmarkmap.mtsferreira.dev`, preservando o projeto/app atual;
- o router operacional detecta `/app` como basepath para manter navegação interna correta;
- assets do site foram isolados em `site-assets/`; `/assets`, `/icons` e `/fonts` ficam disponíveis para o bundle operacional proxied;
- o service worker do site pré-cacheia o shell operacional a partir de `shell-manifest.json`, preservando cold offline após instalação;
- teste de contrato foi adicionado para manifest `id/start_url = /app/` e rewrite de mesma origem;
- bloqueio atual: tentativa de deployment explícito recebeu HTTP 402 da Vercel por limite diário Free `api-deployments-free-per-day` (>100). Os commits estão em `main`, mas essa versão ainda não foi validada em produção.
