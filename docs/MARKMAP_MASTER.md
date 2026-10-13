# MarkMap — Documento Mestre Único

## A60 — ignorar upserts históricos anteriores à base conhecida (2026-10-13)

A60 elimina falsos conflitos quando `applyServerPage` recebe upsert remoto com `change.version <= pending.baseVersion`; ACK exato e concorrência real continuam. Baseline 5/10 FAIL, depois 10/10 PASS. Commit `3deef67` [skip ci].

## A59 — conflitos monotônicos também no saveConflict do push (2026-10-13)

A59 protege `saveConflict` contra downgrade por push atrasado entre abas: só grava se `serverVersion` for estritamente maior que a versão já durável. Baseline 4/10 FAIL, depois 10/10 PASS. Commit `f8420bb` [skip ci].

## A58 — tombstones ambíguos sem ACK inferido (2026-10-13)

A58 preserva delete local cujo tombstone `baseVersion+1` não carrega operationId: **não inferir ACK**, deixar na outbox para push confirmar ou gerar conflito real; eventos históricos inferiores/iguais à base são ignorados. Baseline 5/10 FAIL, depois 10/10 PASS. Commit `40cf7ce` [skip ci]. **QA consolidado:** 75/75 testes Node locais A53–A60 PASS em três execuções, TypeScript strict isolado com stubs PASS e `node --check` PASS. PRDs A58/A59/A60 versionados, SHA de código e testes verificados. Full pnpm monorepo, PostgreSQL/Neon integrado, IndexedDB browser real, Android/iOS e duas instalações ainda não executados; RC A38 não aprovado, mas desenvolvimento continua. Sem CI GitHub, merge main, deploy ou alterações em produção.

## A57 — versões monotônicas dos conflitos no pull (2026-10-13)

A57 resolve downgrade de conflito de pull entre recriação remota e tombstone histórico. `writeConflict` em `apps/admin/src/lib/local-repositories/index.ts` compara `serverVersion` com conflito durável na mesma transação IndexedDB; nunca substitui versão maior/igual com evento antigo, preservando `use-server`, outbox e cursor. Baseline 3/7 falhas; após **10/10 regressões A57 e 45/45 testes Node A53–A57 PASS em três execuções**, TypeScript strict isolado com stubs PASS. Commit `df45018` [skip ci], arquivos SHA verificados; PRD `docs/MM-MAP-A57-monotonic-pull-conflicts.md`. Full monorepo, browser IndexedDB, Neon/PostGIS e Android/iOS ainda não testados, RC permanece não homologado sem bloquear desenvolvimento. A58: investigar tombstones próprios sem operationId wire antes de planejar alteração de contrato.

## A56 — conflitos válidos para predecessor inválido e entidade ausente (2026-10-12)

A56 conserta envelopes de conflito inválidos: `conflictFor` produzia `VERSION_CONFLICT serverVersion=0` para entidade não existente/precedessor inválido, rejeitado pela validação do contrato e capaz de causar 500 no `/sync/push`. Sem versão remota usa `SCOPE_REJECTED:0` sem payload do servidor; com versão positiva mantém `VERSION_CONFLICT`, sem novo enum. Operações idempotentes, outbox e tombstones preservados. Baseline 3/8 FAIL; após patch **8/8 A56 PASS, 11/11 A55 PASS e 35/35 backend A53–A56 PASS três vezes**; TypeScript strict isolado com stubs PASS. SHA dos três arquivos verificados no GitHub `8435d0d` [skip ci]. PRD `docs/MM-MAP-A56-predecessor-conflicts.md`; testes 257/257 da A54 são históricos, não repetidos. Gate RC A38 (Postgres real, full monorepo, Android/iOS) continua não homologado sem bloquear próximas correções. Sem CI remoto nem mudanças de produção.

## A55 — bloqueio de sobrescrita por baseVersion nula (2026-10-12)

**A55 implementada e validada localmente:** o backend rejeita criação/remoção com `baseVersion:null` sobre entidade remota já versionada; retorno `VERSION_CONFLICT` sem avanço de sequência/materialização. Versão explícita, predecessor validado, idempotência e isolamento de workspace permanecem. 3/9 regressões falhavam antes; após correção **11/11 A55 PASS**, **27/27 backend A53+A54+A55 PASS em três rodadas**, TS estrito isolado com stubs PASS. GitHub SHA código `5fb198e`, teste `641b860`; commits `cf61e2a`/`8221e91` [skip ci]. PRD `docs/MM-MAP-A55-null-base-guard.md`. 257/257 Node A54 históricos não reexecutados aqui. Risco de compatibilidade: operações legadas sem versão sobre registro remoto geram conflito explícito. A38/release continua pendente de banco real, build/lint/testes integrados e dispositivos, **sem bloquear novas correções**. Sem GitHub CI/deploy/main/migration.

## A54 — rejeição atômica de IDs duplicados por lote no backend (2026-10-12)

O backend rejeita agora lotes `POST /sync/push` que repetem `operationId`, **antes da primeira aplicação SQL**, respondendo 400 neutro. Corrigida ambiguidade entre recibos e efeitos parciais; idempotência legítima entre requisições permanece. PRD `docs/MM-MAP-A54-sync-batch-idempotency.md`, regressões em `scripts/backend-sync-batch-idempotency.test.mjs`. Baseline 3/7 FAIL, depois 7/7 PASS e **257/257 testes Node PASS em três rodadas**, TypeScript isolado/stubs PASS, SHA de código/teste iguais aos publicados em `dev/markmap-pwa-v2@967fe5d` [skip ci]. Full monorepo/Hono/Postgres/browser/Android/iOS e gate de RC permanecem não executados, **não bloqueiam desenvolvimento**. Nenhum CI GitHub ou alteração main/Neon/produção. A55: auditar baseVersion null sem alterar semântica sem comprovação.

## A53 — integridade do provisionamento workspace (2026-10-12)

O PostgreSQL pode lançar `23505` quando `workspaceId` existente recebe bootstrap proof diferente: `ON CONFLICT(proof_digest)` só cobre a constraint por prova, não a PK do workspace. Antes a API tratava como erro inesperado 500. A53 normaliza o SQLSTATE direto ou encapsulado em `cause` no DB e preserva o handler existente que devolve 409 neutro. Não altera contratos, tabela, migração, autenticação ou IndexedDB/outbox. Baseline 4/9 testes Node falhavam, depois 9/9 e regressão geral **250/250 PASS em duas rodadas**; typecheck estrito isolado PASS; SHA GitHub confere com QA. Commits dev `b28ae4c`/`0a042c0`, `[skip ci]`. PRD `docs/MM-MAP-A53-workspace-binding-409.md`. Integração PostgreSQL/Hono real e gates A38/RC permanecem pendentes, **sem bloquear próximas correções**; sem GitHub CI/produção.

## A52 — cursor assinado após renovação de capability (2026-10-12)

**A52 CÓDIGO + QA:** backend Hono assina o token de cursor com o hash da capability; após rotação de bearer, cursor anterior resultava em 400 e bloqueava pull. Cliente corrige por remoção atômica **somente** de `syncCursor` ao salvar nova capability em IndexedDB e retry apenas quando o cursor foi modificado por operação concorrente; erro 400 não relacionado não apaga checkpoint. `outbox`, dados, contratos Hono, Neon e esquema permanecem inalterados. 3/6 casos falhavam antes; depois 6/6 e **241/241 Node PASS três vezes**, TypeScript strict isolado PASS, 4 blobs conferidos contra GitHub. Commits `81389eb`/`af8cd02` [skip ci]. PRD `docs/MM-MAP-A52-signed-cursor-recovery.md`. RC ainda precisa de testes integrados e físicos, não bloqueantes para novas fases. Nenhuma ação CI remoto/produção.

## A50–A51 — bearer entre abas e edições durante sync ativo (2026-10-12)

A50 corrige recuperação desnecessária de capability entre abas quando IndexedDB já possui geração mais recente que a usada na requisição 401. A51 corrige perda de reexecução quando mutação local acontece durante sync single-flight: controlador agenda nova rodada somente quando a atual termina, agrega gatilhos e respeita offline/unmount. Ambos preservam contratos HTTP, IndexedDB/outbox, React/Vite/Hono/Neon existentes. Baseline A50 3/4 falhas, A51 2/4 falhas; depois **8/8 regressões novas e 235/235 Node PASS em 2 execuções**, TypeScript estrito isolado com stubs PASS, hashes dos 4 arquivos iguais aos testados. Branch `dev/markmap-pwa-v2` commits `0c711de` + `6628c02`, [skip ci]. PRD `docs/MM-MAP-A50-A51-sync-concurrency.md`. Full build/Vitest/E2E, browser IndexedDB real, Android/iOS e A38 RC continuam PENDENTES sem impedir o desenvolvimento. Sem GitHub CI disparado manualmente, sem operações de produção.

## A48–A49 — identidade de instalação e credenciais de sync atômicas (2026-10-12)

Duas abas PWA podiam inicializar diferentes provas de recuperação de workspace, com falha HTTP 409 reproduzida. A48 usa transação `meta` única para criar e reutilizar `installationId`/`workspaceBootstrapProof`. A49 protege a geração/bearer contra sobrescrita por resposta antiga na mesma transação, com validação de workspace. Sem alterações de schema, contratos HTTP, Neon ou outbox. Novo teste de 9 casos PASS; Node completo **227/227 PASS**, TypeScript isolado com stubs PASS; hashes de cinco arquivos confirmados no GitHub `3cf57b3` [skip ci]. PRD `docs/MM-MAP-A48-A49-atomic-bootstrap.md`. E2E browser/Android/iOS e release A38 continuam pendentes, **não bloqueiam desenvolvimento**. Nenhum CI GitHub/produção/merge main/deploy.

## A46–A47 — transações recuperáveis e retorno da PWA (2026-10-12)

**Implementado em código sem migração:** A46 remove referência de conexão IndexedDB encerrada silenciosamente quando `db.transaction` lança `InvalidStateError`, preserva dados/outbox e não reexecuta escrita; A47 reage à restauração BFCache/foco visível e atualiza queries para conflitos. Baseline 6/10 novos testes falharam, depois **10/10 PASS; Node completo 218/218 duas rodadas** e TypeScript isolado com stubs PASS; cinco blobs GitHub correspondem ao QA. Branch `dev/markmap-pwa-v2` commits `7261c8d` e `ebea8de`, `[skip ci]`. PRD `docs/MM-MAP-A46-A47-offline-resume.md`. Full lint/build/Vitest/E2E, IndexedDB em navegador real, Android/iOS e release A38 ainda não homologados, mas **não bloqueiam desenvolvimento incremental**. Nada em main/Neon/produção/CI remoto.


## A45 — recuperação de IndexedDB após falha/suspensão (2026-10-12)

**Código A45 e QA local:** falhas transitórias de abertura/transação e `versionchange` prendiam `IndexedLocalDb` em promessa rejeitada ou conexão fechada; `close()` podia disparar rejeição não tratada e abertura bloqueada permitia conexão tardia órfã. Corrigido com invalidacão de cache e fechamento de conexão obsoleta, sem migrations, limpeza de IndexedDB/outbox nem operações de rede. Baseline 5/6 falharam; após **6/6 PASS e Node total 208/208 PASS três rodadas**. TypeScript isolado (stubs) e JS check PASS, GitHub blob SHA idêntico aos arquivos locais testados; `dev/markmap-pwa-v2@a839446`, `[skip ci]`. PRD `docs/MM-MAP-A45-idb-recovery.md`. Browser real, monorepo lint/build/Vitest/E2E, aparelhos Android/iOS e gate RC seguem PENDENTES somente para release, não para próxima etapa de código. `main`, Vercel, Neon, secrets e CI remoto intocados.


## A44 — CAS do cursor pull entre abas (2026-10-12)

Correção A44 em código e teste local: `applyServerPage` exige cursor esperado dentro da transação de aplicação quando chamado pelo motor sync, impedindo rollback do checkpoint por resposta de outra aba atrasada; antes 3/5 regressões novas falhavam. QA Node **202/202 PASS em três rodadas + 202/202 após conferir blobs GitHub**, typescript isolado com stubs PASS. Branch dev commits `70789d3`/`0f97e29` `[skip ci]`, nenhuma migration, alteração IndexedDB schema/outbox, API ou servidor. Browser multiabas/Capacitor reais, build/Vitest/Playwright monorepo, Android/iOS e release A38 continuam não homologados (dívida não bloqueante para desenvolvimento). PRD `docs/MM-MAP-A44-sync-cursor-cas.md`.


## A41–A43 — timeout integral, ACK durável e QA determinística (2026-10-12)

**Corrigido em código com QA local:** timeout HTTP agora protege o corpo da resposta além dos headers, evitando inFlight preso quando a conexão para após 200; ACK recusada não anuncia progresso concluído; testes de Worker/React esperam eventos reais, evitando intermitência de 20/35 ms. Os testes novos falharam 4/7 antes do patch; após patch houve **197/197 PASS 3 vezes** e mais uma conferência **197/197 PASS** com hashes GitHub; TypeScript isolado com contratos stub PASS. Commits `79968dc`, `b7ac5c5`, `[skip ci]` em `dev/markmap-pwa-v2`. Sem contratos/schema/Neon/API/outbox alterados. **PENDENTE exclusivamente para homologar release:** full lint/build/Vitest/Playwright, MapLibre/IndexedDB browser, Android/iOS, sync físico, privacidade/signing/gate A38. Estes não bloqueiam próxima implementação. PRD `docs/MM-MAP-A41-A43-sync-durability.md`.


## A39/A40 — confiabilidade incremental do sync (2026-10-11)

**CORRIGIDO/QA LOCAL:** push+pull tinham falhas reproduzidas: `hasMore` com cursor repetido/cíclico causava requests redundantes e checkpoints repetidos; erro após ACK/página já persistida retornava progresso 0 e impedia invalidação do cache React. `sync-engine.ts` agora recusa cursor regressivo antes de mutar e emite contagem efetivamente aplicada mesmo com status `error`. Regresso de 3 falhas antes da correção, 8/8 novos e 189/189 Node totais após correção PASS no recorte fiel do HEAD (TypeScript isolado e JS check PASS). **SEM HOMOLOGAÇÃO:** full monorepo lint/build/Vitest/Playwright, IndexedDB/WebGL reais, Android/iOS físico, duas instalações, política de privacidade e RC continuam pendentes mas **NÃO BLOQUEIAM PRÓXIMAS ETAPAS DE CÓDIGO**. Branch `dev/markmap-pwa-v2@a9eae4c`, `main` intocada, nenhum CI/deploy/Neon/migration/tag/release. PRD `docs/MM-MAP-A39-A40-sync-resilience.md`.


## A35–A38 — hardening nativo e sincronização (2026-10-11)

Implementados **ajustes de readiness** (não homologação física): manifesto Android não aceita permissões só citadas em comentários; Info.plist iOS passa a gravar alterações de chaves existentes e usa marca MarkMap; push A37 rejeita receipts fora do lote, duplicados e sem progresso, e mantém status pendente até outbox esvaziar. Baseline A34 164 testes + 17 regressões A35–A37 = **181/181 Node PASS** no recorte fiel do HEAD; `tsc` isolado com stubs passou. Entrega em `dev/markmap-pwa-v2` até `ca5766b`, `[skip ci]`, sem GitHub CI. **NÃO EXECUTADO:** full lint/typecheck/build/Vitest/Playwright, browser/PMTiles/WebGL/IndexedDB reais, Android/iOS APK/App físico, duas instalações reais/Neon, auditoria pública legal/segurança, assinatura e RC. `docs/privacy.md` informa dez itens obrigatórios indefinidos. Sem deploy, release, main, migrations ou lojas.


## A34 — leitores offline presos à geração ativa (2026-10-11)

**Falha comprovada e corrigida:** quatro consumidores regionais liam metadados de uma geração e blobs potencialmente de outra após atualização simultânea; exceções internas da busca, Wikipedia e altitude podiam vazar detalhes locais na UI. Busca, rota, conteúdo e DEM agora vinculam o mesmo `installed.generation` através das funções já existentes do IndexedDB (`getActiveRevision` + `assetAtRevision`) e fazem checagem final de geração antes de publicar. Mensagens UI de origem não confiável foram sanitizadas por allowlist. Contratos, IndexedDB/outbox, projetos e Neon preservados.

**Evidência local:** 164/164 testes Node aprovados com 14 novos cenários; 4 módulos TypeScript passaram typecheck **isolado com stubs**, CommandCenterPage passou parsing TSX. Commits `6db152f`, `17ba3c7`, `3e11fb7`, todos `[skip ci]`. Sem GitHub Actions e sem consumir CI. **Ainda NÃO HOMOLOGADO:** build/lint/typecheck/Vitest/E2E completos, IndexedDB/MapLibre/WebGL em navegador real (Chrome bloqueado), Android/iOS, sync físico e Release Candidate. Revisão externa/privacy/legal continua pendente; sem ações de produção.


## A32/A33 — auditoria e mensagens seguras no worker de rotas (2026-10-11)
- [x] A32 Node: 144/144 testes versionados no HEAD original; ciclo MapLibre, leases e worker auditados no código.
- [x] A33: erro bruto no worker reproduzido com token; alterado para allowlist de mensagens conhecidas e resposta genérica. Após a correção: 150/150 testes Node PASS (6 novos), declaração TypeScript e parsing sintático PASS.
- [ ] A32/A34: monorepo lint/typecheck/build/Vitest/Playwright e WebGL/PMTiles/IndexedDB reais pendentes por ausência de checkout, dependências e DNS npm/GitHub.
- [ ] A35–A38: Android/iOS físico, PWA instalada, dois dispositivos, política de privacidade e RC pendentes. Nenhuma homologação de release.
- [ ] Sem alterar main, Neon, migrations, deploy, CI remoto, tags, lojas ou dados locais.

## A30/A31 — readiness da fonte ativa e recuperação do aviso WebGL (2026-10-10)

**A30 IMPLEMENTADO EM CÓDIGO:** `createOfflineStyleLifecycle` agora consulta `getSource('local-dataset')` antes de `isSourceLoaded('local-dataset')` após hidratar. Fontes já carregadas concluem readiness mesmo sem novo `sourcedata`; eventos atrasados e fontes recarregando não podem validar a geração atual. Em exceção/troca de estilo adota fallback conservador; adapters anteriores sem métodos seguem compatíveis. **A31 IMPLEMENTADO EM CÓDIGO:** alerta temporário de WebGL perdido é removido só após render atual bem-sucedido; falhas reais de PMTiles, glyph, estilo e recursos permanecem visíveis e podem substituir aviso transitório. Retentativa manual, orçamento de remount A27 e dados operacionais offline-first preservados.

**QA LOCAL REAL:** Node v22.16.0 `node --test scripts/*.test.mjs` **147/147 PASS**, incluindo 14 novos testes A30/A31, em recorte histórico reconstruído do HEAD. Primeiro teste do recorte falhou 5 casos A8/A9 por cópia local antiga do downloader; substituída por SHA exata do GitHub (`739fbb8`) e a suíte completa reexecutada 147/147 PASS. `node --check` JS, `tsc --strict --noEmit` isolado das declarations e `typescript.transpileModule` TSX PASS. **NÃO EXECUTADO:** full lint/typecheck/build/Vitest/Playwright do monorepo, IndexedDB/MapLibre/WebGL/PMTiles reais e Android/iOS. QA física não impede novas fases de código mas release/homologação continuam separados. Sem CI remoto, main, Vercel, Neon, migration, release/tag, lojas ou exclusão. PRD: `docs/MM-MAP-A30-A31-source-readiness.md`.

---


## A28/A29 — readiness de estilo MapLibre e reparo de overlays offline (2026-10-10)

**IMPLEMENTADO EM CÓDIGO (QA DIRECIONADA):** a visualização controla uma geração de `style.load` e associa o status `mapReady` ao `sourcedata`/próximo `render` daquela geração. Eventos repetidos não criam callbacks duplicados; render pendente de estilo anterior é removido em nova `style.load`, perda WebGL ou unmount. Fontes GeoJSON que concluem sincronamente durante a hidratação também são consideradas. Em restaurações WebGL consecutivas, esgotado o orçamento automático da A27, tenta reparar o estilo já carregado **sem remount infinito**. **A29:** overlays `local-dataset`, `geopdf-overlay`, `draw-preview`, contornos, trânsito e rota passam a reparar **camadas individualmente**, mesmo se a fonte persistiu; não substituem geometrias, projetos, dados de campo, IndexedDB/outbox ou seleção.

**EVIDÊNCIA LOCAL:** Node v22.16.0, recorte A10–A29 **93/93 testes Node versionados PASS** (76 anteriores + 17 novos A28/A29); **101/101 PASS** se incluído harness legado local A22 PMTiles transpilado com stubs (**não versionado**). `node --check`, `tsc --strict --noEmit` isolado em declarações e smoke das assinaturas, e `typescript.transpileModule` da tela TSX sem diagnósticos: PASS. **NÃO EXECUTADO:** lint/typecheck/build integral do monorepo, Vitest/Playwright e MapLibre/WebGL/IndexedDB/Capacitor reais. Não há homologação de release; essa dívida não bloqueia novas fases de desenvolvimento. Sem CI remoto, merge `main`, Vercel, Neon/migração, release/tag ou exclusão. PRD: `docs/MM-MAP-A28-A29-style-hydration.md`.

---


## A26/A27 — cancelamento por lease e recuperação WebGL controlada (2026-10-10)

**IMPLEMENTADO EM CÓDIGO, NÃO HOMOLOGADO EM BROWSER:** cada view MapLibre agora vincula os requests PMTiles e `geonexo-package` ao AbortController próprio do lease e ao controller externo do MapLibre. `release()` aborta imediatamente as leituras pendentes de sua view, sem cancelar outros mapas; listener externo é removido em sucesso/erro/abort. O resultado tardio não pode ser aplicado. **A27:** mapa observa `webglcontextlost`/`webglcontextrestored`, apresenta erro local e agenda no máximo uma reconstrução automática por seleção/revisão/GeoPDF, mesmo através de remounts. Foreground não força retry enquanto WebGL está perdido; cleanup tolera exceções de teardown sem prender protocolos. Seleção, pacotes IndexedDB, projetos, desenhos, GeoPDF e outbox preservados; sem rede automática.

**QA EXECUTADA:** Node v22.16.0 **76/76 testes Node versionados PASS** no recorte A10–A27; **84/84 PASS** no mesmo recorte mais harness A22 transpilado com stubs `pmtiles` (8 casos locais, NÃO versionados). 13 testes novos versionados nesta rodada (7 A26 e 6 A27). `node --check` dos helpers, `tsc --strict --noEmit` isolado das declarações e `transpileModule` de TSX PASS. **NÃO EXECUTADO:** lint/typecheck/build monorepo, Vitest/MapLibre real, Playwright, IndexedDB navegador, contexto WebGL perdido fisicamente, Android/iOS. Testes externos não bloqueiam novas fases de desenvolvimento por orientação vigente, mas não autorizam release. Sem CI remoto, deploy, merge `main`, Neon, migration, release/tag, alteração de secrets ou exclusão. PRD: `docs/MM-MAP-A26-A27-webgl-lifecycle.md`.

---


## A24/A25 — posse dos protocolos MapLibre e cleanup de mapas incompletos (2026-10-10)

**IMPLEMENTADO EM CÓDIGO / QA NODE DIRECIONADA:** os esquemas globais `pmtiles` e `geonexo-package` agora são registrados uma vez por documento e gerenciados por leases de identidade exclusiva por montagem. `CommandCenterPage` reescreve estilo/PMTiles/glyphs/sprites com alias temporário `mk...`, sempre vinculado à geração do pacote offline. Desmontar mapa antigo apenas libera seu lease, sem remover handlers usados por uma nova montagem. Requests obsoletos/abortados não podem retornar dados de outro mapa. `createMapLibreMap` remove instância WebGL parcial quando algum controle ou listener lança durante setup síncrono; initializer também limpa mapa/lease no erro. Mantidos GeoPDF, projetos, dados de campo, IndexedDB/outbox, retry e modo neutro A20.

**EVIDÊNCIA LOCAL:** Node `v22.16.0`, **70/70 testes Node PASS** em recorte local A10–A25 (60 anteriores + 10 novos A24/A25), zero skips/falhas. `node --check` helpers e `tsc --noEmit --strict` isolado das duas declarações TypeScript: PASS. Revisão estática dos blobs TS/TSX e vínculo de URLs de estilo: sem falhas identificadas. **Teste Vitest adicional de alias criado, mas NÃO EXECUTADO.** Sem full lint/typecheck/build do monorepo, PMTiles/MapLibre/browser/WebView real ou testes físicos. Essas pendências não travam novas fases de desenvolvimento por decisão vigente, mas não autorizam release. Sem CI remoto, merge main, Vercel, Neon, migrações, tag/release ou exclusões. PRD `docs/MM-MAP-A24-A25-protocol-lifecycle.md`.

---


## A22/A23 — protocolos offline seguros e diagnóstico de erros (2026-10-10)

**IMPLEMENTADO EM CÓDIGO:** PMTiles passa a rejeitar offset/length inválidos, bytes além do arquivo e leituras truncadas (limite anterior de 4 MiB preservado). Protocolo de glyph/sprite/style verifica Blob e contagem exata de bytes e agora remove listeners de AbortSignal em todos os encerramentos; cancelamento do resolver é observado imediatamente. Tipos e códigos de erro estáveis sem URL/path. A interface MapLibre distingue AbortError normal, ausência de recurso, pacote incompleto, atualização concorrente, WebGL/rede e erro desconhecido sem ecoar mensagens brutas potencialmente sensíveis. Retry e fundo simples A20/A21 preservados. Não toca IndexedDB, projetos, outbox, selection ou backend.

**EVIDÊNCIA LOCAL:** Node v22.16.0 **60/60 testes PASS** no recorte A10–A23, incluindo 11 novos Node versionados e 7 smoke de protocolo TS transpilado com stubs de pmtiles/package (harness local), mais 42 regressões. `tsc --strict --noEmit` isolado do `protocol.ts` com types de stub e declarações auxiliares: PASS; `node --check` nos novos JS: PASS. Regressões históricas exigindo strings `too large`/`invalid offline package asset URL` conferidas com stub. **Vitest real adicionado mas NÃO EXECUTADO**, assim como lint/typecheck/build monorepo, E2E MapLibre, WebView ou aparelho físico. Pendências não bloqueiam próximas fases de código e não equivalem a homologação. Sem CI remoto, main, Neon, Vercel, migração, tag ou release. PRD: `docs/MM-MAP-A22-A23-protocol-recovery.md`.

---


## A20/A21 — recuperação visual do mapa regional (2026-10-10)

**IMPLEMENTADO EM CÓDIGO / QA DIRECIONADA:** `CommandCenterPage` agora oferece `Tentar novamente` em erros cartográficos locais, remontando MapLibre e protocolos a partir dos mesmos dados offline. Um controlador sem timers permite **no máximo uma recuperação automática por contexto** ao voltar do background enquanto houver falha, evitando loops de carregamento. Eventos de mapas cancelados são ignorados e erros em rajada não geram sucessivas mensagens. **A21:** botão `Usar fundo simples offline` apresenta o estilo neutro `createFallbackStyle` local sem tiles remotos, preservando escolha de região no localStorage, arquivos IndexedDB, GeoPDF, feições de projeto, desenhos e outbox. Há indicação de fundo simples e `Voltar ao mapa regional`; troca de região/revisão invalida a alternativa da geração anterior.

**EVIDÊNCIA:** Node 22.16.0 no recorte A10–A21 **42/42 testes PASS** (36 anteriores + 6 novos), `node --check` no helper e `tsc --strict --noEmit` isolado da declaração auxiliar: PASS. Conferências estáticas do componente React concluídas. **NÃO EXECUTADO:** build/lint/typecheck monorepo, MapLibre/React/IndexedDB E2E, WebGL/context-loss/Capacitor/Android/iOS físicos; isso NÃO bloqueia desenvolvimento, mas não equivale à homologação. Limitação: fundo simples ainda depende de WebGL funcionando. Nenhum deploy Vercel, GitHub CI, merge main, Neon/migration, tag/release, exclusão ou mudança de stack. PRD: `docs/MM-MAP-A20-A21-map-recovery.md`.

---


## A18/A19 — reconciliação após suspensão + leitura de assets por geração (2026-10-10)

**IMPLEMENTADO EM CÓDIGO / QA DIRECIONADA:** mapa passa a verificar a geração ativa no IndexedDB ao receber `focus`, `pageshow`, `visibilitychange` visível ou aviso A15 da região selecionada. `createRegionRevisionReconciler` evita rebuild quando a geração não mudou, colapsa despertares concorrentes e ignora resultados obsoletos; `selected-offline-map.mjs` recupera `storage` perdido no retorno do WebView. Configurações atualiza catálogo local no foreground, sem fetch, polling nem perda de checkpoints. **A19:** `OfflineMapStore.assetAtRevision` lê marcador ativo e Blob na mesma transação readonly. `CommandCenterPage` fixa a geração ao carregar PMTiles, estilo, contornos e protocolos de recursos, recusando misturas após atualização concorrente. GeoPDF, desenhos, projetos e outbox preservados.

**EVIDÊNCIA LOCAL:** Node 22.16.0, suite direcionada A10–A19 `node --test scripts/*.test.mjs` **36/36 PASS**, zero skipped/fail; `node --check` módulos JS e `tsc --noEmit --strict` de declarações auxiliares + fachada de seleção PASS. **NÃO EXECUTADO:** lint/typecheck/build monorepo, React/MapLibre/IndexedDB E2E, WebView multiabas e aparelho físico; não representam gate de release, mas **não bloqueiam novas fases de desenvolvimento**. Nenhuma alteração de stack/IndexedDB schema ou contrato, CI remoto, Neon, Vercel, `main`, tag/release ou produção. PRD: `docs/MM-MAP-A18-A19-foreground-generation.md`.

---


## A16/A17 — Seleção e interface cartográfica reativas (2026-10-10)

**IMPLEMENTADO EM CÓDIGO, QA LOCAL DIRECIONADA:** a seleção offline mantém a chave histórica de localStorage e passa a emitir evento na aba atual e observar `storage` de outras abas. `SettingsPage` deixa de espelhar manualmente o state e usa `useSyncExternalStore`. `CommandCenterPage` usa o mesmo snapshot de seleção para basemap MapLibre, busca, conteúdo, elevação e roteamento; sinais de catálogo A15 da **região selecionada** acionam reconstrução de protocolos/fontes, descartando workers e caches de UI dependentes da geração anterior. Seleção removida é invalidada sem apagar pacotes/projetos/outbox. GeoPDF mantém precedência; operações offline continuam locais.

**EVIDÊNCIA:** Node 22.16.0 **5/5 testes novos PASS** (eventos mesma aba e entre abas simuladas, sanitização, storage indisponível e separação de catálogo); `node --check` e `tsc --strict --noEmit` isolados na declaração/fachada da seleção verdes. Regressões A10–A15 **17/17 PASS** em execução separada; não equivalem à suíte monorepo. **NÃO EXECUTADO:** lint/typecheck/build E2E completos, MapLibre/IndexedDB/browser multiabas e Android/iOS físico, sem travar próximas fases de código por decisão vigente. Fase posterior: reconciliar revisão de geração na volta de aba suspensa quando evento BroadcastChannel não chega. Sem GitHub CI, deploy Vercel, `main`, Neon, migrations, tags ou release. PRD: `docs/MM-MAP-A16-A17-reactive-map-selection.md`.

---


## A14/A15 — CAS de geração e estado multiabas (2026-10-10)

**IMPLEMENTADO EM CÓDIGO / QA DIRECIONADA:** atualizações regionais passam a identificar o ativo por **geração IndexedDB**, além de versão/origem/fingerprint. `RegionManager` usa snapshot local consistente; `ResumableInstaller` reconfirma a geração sob Web Lock antes do download; `OfflineMapStore.stage()` e `activate()` aplicam compare-and-swap dentro das transações readwrite. Se outra aba ativar um mapa entre a consulta e o commit, a atualização antiga é rejeitada sem sobrescrever o novo ativo; staging da tentativa é descartado por geração exata em cleanup best-effort. **A15:** broadcast apenas de ID de região após commit/removal; Configurações invalida aceites anteriores e relê IndexedDB. Sem BroadcastChannel o CAS continua autoritativo. Sem alteração de schema, API, outbox ou banco.

**EVIDÊNCIA LOCAL:** Node 22.16.0 **17/17 testes PASS** (6 novos A14/A15, 11 dirigidos anteriores A10–A13), `node --check` em helpers, `tsc --strict --noEmit` nas declarações, `transpileModule` sintático TS/TSX sem erros. Harness IndexedDB simulado com código `OfflineMapStore.activate()` transpilado confirmou rejeição antes de mutação quando a geração diverge. **NÃO EXECUTADO:** lint/typecheck/build completo, browser IndexedDB real, multiabas WebView, E2E, Android/iOS e testes físicos. São pendências de homologação **sem travar novas fases de código**; não há autorização de merge/release/deploy. Sem CI remoto, Vercel, main, Neon/migrações ou alterações em produção. PRD: `docs/MM-MAP-A14-A15-cross-tab-consistency.md`.

---


## A12/A13 — Recuperação ao navegar e atualização regional fixada (2026-10-10)

**IMPLEMENTADO EM CÓDIGO / QA NODE DIRECIONADA:** Configurações recupera URL pública sanitizada na mesma aba por sessionStorage, ou a URL instalada da região selecionada. Não baixa nem toca checkpoints automaticamente. URLs com credenciais/query/hash e HTTP externo nunca são gravadas. Rascunho é limpo na instalação bem-sucedida. O gerenciador de regiões entrega ao botão de atualização a identidade completa do manifest consultado (SHA-256 canônico), origem HTTPS e versão local; ao confirmar, refaz consulta e recusa se algum desses dados mudou. A UI invalida aceite antigo após erro ou mudança de lista instalada. Sem alterar mapas ativos, IndexedDB/outbox ou contrato.

**EVIDÊNCIAS:** Node 22.16.0, **14/14 testes direcionados aprovados** (6 novos A12/A13 + 8 A10/A11), `node --check` dos helpers e `tsc --strict --noEmit` isolado de registry/declarations; sintaxe TSX verificada via `transpileModule`. **NÃO EXECUTADO:** full lint/typecheck/build/e2e, validação em navegador/Capacitor, mapa grande ou aparelho físico. Não bloqueiam continuidade de desenvolvimento; release/merge/deploy seguem não autorizados. PRD: `docs/MM-MAP-A12-A13-region-continuity.md`. Sem CI, Vercel, Neon, tag/release, alteração da main ou migração.

---


## A10/A11 — UX de retomada e quota (2026-10-10)

**IMPLEMENTADO EM CÓDIGO, QA LOCAL DIRECIONADA:** `SettingsPage` expõe consulta read-only de progresso salvo por URL/manifest, tamanho da região, blocos completos, retomada, estágios com barra acessível e confirmação explícita antes de substituir checkpoints de outra versão. O cancelamento alcança a consulta do manifest (AbortSignal), o pré-download e o fluxo de chunks; a UI não oferece cancelamento quando a ativação transacional já começou. Saída da tela cancela transferência não observada, sem excluir blocos persistidos. `ResumableInstaller.checkResume` compara assinatura de versão + SHA de todos os arquivos; quota real/estimada é categorizada sem limpar dados. Mensagens distinguem cancelamento, rede, quota, checksum, versão e concorrência de abas.

**EVIDÊNCIA REAL LOCAL:** Node 22.16.0, 8/8 testes isolados (3 históricos do manifest + 5 novos sobre Cancel/Quota/HTTP), `node --check` JS e `typescript.transpileModule` sintático nos dois arquivos TSX/TS, sem erros. **NÃO EXECUTADO:** suíte completa 53+ testes reexecutada nesta rodada, lint/typecheck/build monorepo, Playwright, IndexedDB/browser/WebView real e dispositivos físicos. Testes físicos continuam **não bloqueantes para fases de desenvolvimento**, mas nenhum recurso é declarado homologado. Limite agregado local 250 MiB continua sujeito à quota real. Sem alteração `main`, Neon, Vercel, CI GitHub, tag/release/deploy. Documento: `docs/MM-MAP-A10-A11-remote-install-ux.md`.

---


## A8/A9 — memória por Blob + recuperação segura (2026-10-10)

**Branch dev:** `dev/markmap-pwa-v2` após A7 (`716f112`). **A8 IMPLEMENTADO EM CÓDIGO:** chunks novos são salvos como Blob no IndexedDB e o downloader monta arquivo a partir de Blob parts persistidas; valida hash do conteúdo efetivamente lido e mantém compatibilidade com checkpoints antigos ArrayBuffer sem migração. Evita reter `Uint8Array[]` de até 250 MiB no JS, mas **não garante limite de RAM físico**, a depender do browser.

**A9 IMPLEMENTADO EM CÓDIGO:** contagem para retomada aceita só offsets alinhados e chunks completos conforme `sha256/size` do manifest; sessions novas registram tamanhos sem alterar versão do DB. Sessões legadas podem retomar na instalação, porém contagem incerta não é anunciada. Limpeza transacional `finishSession` mantém hashes referenciados por outras regiões. Se Range virar HTTP 200 no meio da retomada, recomeça montagem/hash do início sem duplicar bytes nem regredir porcentagem.

**EVIDÊNCIA LOCAL:** Node 22.16.0, `node --test scripts/*.test.mjs apps/admin/src/lib/storage/*.test.mjs apps/admin/scripts/*.test.mjs` **53/53 PASS** (46 anteriores + 7 testes A8/A9), checks JS `node --check` verdes; `tsc --strict --noEmit` isolado do módulo `region-download-checkpoints.ts` sem erros e TS sintático do wrapper sem erros. **NÃO EXECUTADO:** monorepo lint/typecheck/build/Vitest/Playwright, IndexedDB/WebView multiabas real, medição RAM, pacote 250 MiB em aparelho. São dívidas de homologação, **não bloqueios de desenvolvimento**. `main`, Neon, Vercel, GitHub CI, release/tag preservados. PRD/evidência: `docs/MM-MAP-A8-A9-checkpoint-recovery.md`.

---


## A7 — Instalação regional coordenada entre abas (2026-10-10)

**IMPLEMENTADO EM CÓDIGO, NÃO HOMOLOGADO NO BROWSER:** instalador agora tem guard local síncrono `installing` e coordena operações para a mesma região com Web Locks API (`ifAvailable`, modo exclusivo). Quando a região já está ocupada em outra aba, retorna `install-busy-other-tab` com retry; em browsers sem Web Locks, preserva o caminho anterior com identificação de geração ao ativar, sem alegar exclusividade. Nenhum IndexedDB schema, SW, outbox, banco ou API alterados. **QA LOCAL:** 3 novos testes com Web Locks simulado (concorrência, erro/liberação, fallback) e regressão A5/A6/M10: **46/46 Node aprovados**. `node --check` e sintaxe TypeScript do wrapper sem erros. Testes de navegador/dispositivo, lint/typecheck/build completos continuam pendentes e **não bloqueiam próxima fase de desenvolvimento**, pela decisão vigente do responsável. Não foi feito deploy/CI/merge/tag/Neon. Handoff `docs/MM-MAP-A7-concurrent-installs.md`.

---


## A5/A6 — Integridade incremental e downloads maiores (2026-10-10)

**DECISÃO VIGENTE DO RESPONSÁVEL:** testes físicos, dados regionais externos e ambientes de homologação NÃO bloqueiam a continuidade do DESENVOLVIMENTO. Registrar validações faltantes com honestidade, sem assumir que passaram. Produção, release, `main` e deploy público continuam fora do escopo sem autorização específica.

**IMPLEMENTADO + QA DIRECIONADA NODE:** módulo SHA-256 incremental para blobs, sem `Blob.arrayBuffer()` integral. Validação de PMTiles usa só header de 127 bytes e hashes progressivos; JSON é materializado somente quando necessário. Downloader aceita streams HTTP 206 com limite exato e fallback HTTP 200 em chunks persistidos/validados, limpando checkpoints parciais no erro. Resumo dos checkpoints passa de `getAll` a cursor IndexedDB. Instalador remoto deixa de recusar arbitrariamente pacotes de 64 MiB e passa a observar o limite agregado já existente de **250 MiB**, respeitando espaço temporário/quota e preservando geração ativa. UI mostra o limite correto.

**EVIDÊNCIA:** Node `22.16.0`, suíte dirigida (37 anteriores + 6 novos) **43/43 testes aprovados**, `node --check` e sintaxe TS dos 3 arquivos ajustados sem erro (não equivale a typecheck completo). **NÃO EXECUTADO:** instalação browser real de 250 MiB, Android/iOS físico, Playwright, lint/build/typecheck do monorepo, benchmark de RAM, garantia de quota. Continuam como pendências de homologação, **não travam novas fases de código**. Riscos: `Blob` final ainda acumula chunks na memória, SHA-256 JS necessita revisão antes de release, fonte OSM real com data/licença confirmadas pendente. Sem Neon, CI, Vercel, main, tag ou release. PRD e critérios: `docs/MM-MAP-A5-A6-offline-streaming.md`.

---


## M10 — QA real parcial após A4 (2026-10-10)

**GATE `MM-MAP-900/940` AINDA BLOQUEADO.** Recuperados pelo GitHub os módulos Node do HEAD `86180b5` em ambiente local Linux/Node `22.16.0`. A primeira suíte real teve **25/29 passando**; 4 falhas eram fixtures antigas de PMTiles de 127 bytes sem tiles MVT reais, estilo inválido e assert `totalBytes` desatualizado após busca/grafo regional. Testes/fixtures corrigidos sem enfraquecer o runtime; acrescentados cenários de publicação anterior preservada, falha tardia sem saída parcial, prebuilt PMTiles válido, raster rejeitado, limite de 250 MiB e handshake de service worker simulado. **Reexecução: 37/37 testes Node passam, 0 skipped.** `node --check` dos módulos recuperados sem erro; typecheck isolado `search/index.ts` e `regional-shards.ts` passou.

**Smoke com OSM real:** fixture externa `bicycle-route.osm.pbf` (Overpass/OSM contributors, ODbL, sem incorporar o binário ao repo), SHA-256 `bad024f5f883d751365de707aafde722212daf3a275a6d78b566f11e195b8c1e`, processada localmente: 22 artefatos, 529.195 bytes no `manifest.totalBytes`, 21 hashes de arquivos conferidos, 7 tiles PMTiles gzip, 128 registros de busca, 1.534 nós/1.592 arestas de grafo walk+bicycle sem car. Busca encontrou vias reais pelos nomes. **Data da extração OSM não confirmada; `osmDataDate` no smoke foi placeholder — proibir distribuição desse pacote.** Detalhes e proveniência em `docs/MM-MAP-M10-qa-2026-10-10.md`.

**BLOQUEIOS:** `pnpm`/node_modules/turbo/vite/eslint indisponíveis; rede npm bloqueada. Portanto NÃO executados lint/typecheck/build/Vitest/Playwright completos. Chromium local negou `localhost` com `ERR_BLOCKED_BY_ADMINISTRATOR`; portanto nenhuma validação browser de IndexedDB/outbox/MapLibre/SW real nem Android/iOS físico. Hash/PMTiles também não verificados por biblioteca PMTiles independente. Não considerar `37/37` aprovação de release. Manter `main`, GitHub CI, Vercel, Neon, tags/releases intactos. Próximo: ambiente completo com dependências, dados com timestamp/licença verificáveis, E2E/dispositivos e gate final.

---


## A4 — Publicação consistente e importação Blob (2026-10-10)

**PARCIAL EM CÓDIGO, NÃO VALIDADO:** `region-pipeline.mjs` deixa de expor arquivos na pasta final enquanto o pipeline ainda pode falhar. A execução é realizada em pasta temporária única; antes de publicar, confere caminhos, tamanhos e SHA-256 de cada artefato gerado, depois promove a pasta completa por `rename` no mesmo diretório pai. Destino não vazio é recusado com `OUTPUT_NOT_EMPTY`; diretório vazio continua suportado para compatibilidade com fixtures anteriores. Em falha, somente staging desta execução é limpo. `OfflineMapStore.stage` reutiliza fontes `Blob` existentes sem segunda materialização ao montar o objeto persistido; SHA-256 do instalador continua obrigatório.

**LIMITAÇÕES:** hash do `Blob` no navegador ainda consome memória; isso NÃO significa instalação móvel de pacotes de 250 MiB. Pipeline direto PBF continua em 32 MiB, download por URL no app limitado a 64 MiB. Fontes cartográficas reais redistribuíveis e validação independente de PMTiles seguem ausentes. Reinício abrupto pode deixar staging órfão não publicado. Nenhum lint/typecheck/test/build/Playwright/Android/iOS foi executado nesta etapa por decisão vigente; M10 `MM-MAP-900/940` continua pendente. Sem GitHub Actions, deploy Vercel, merge/tag, migration, alteração Neon ou produção. Fonte: `docs/MM-MAP-A4-publisher-atomic-handoff.md`.

---


## A3 — PMTiles regional e busca OSM offline (2026-10-10)

**MM-MAP-200/210/400/430: PARCIAL EM CÓDIGO, NÃO VALIDADO.** Branch única `dev/markmap-pwa-v2`, base auditada `7cbfdf8` (A2); `main@156d4e8` intocada. O pipeline passa a tratar PMTiles v3 vetorial **pré-gerado** (até 250 MiB, respeitando o limite do pacote) com cópia temporária, checagem de header/diretório/bounds/zoom, SHA-256 em stream e publicação atômica do arquivo de saída. Não faz conversão direta de `osm.pbf` grande: o builder integrado mantém **32 MiB** e exige pré-gerador externo adequado para áreas maiores.

- **Busca real de atributos OSM, ainda não testada em extrato real:** fallback de PBF pequeno passa a indexar ruas/vias nomeadas e nós com `addr:street` + `addr:housenumber`, além de POIs existentes; posições de vias são vértices realmente presentes no arquivo, não endereços estimados. Até 25 mil registros, com slots preservados para vias. Publicador com `places.json` mantém precedência e IDs duplicados são rejeitados.
- **Segurança do empacotamento:** shards são dimensionados antes da escrita; excesso em derivação opcional não derruba o basemap; estilos externos são recusados; sprites/glyphs locais fornecidos são empacotados com SHA, extensões/paths/arquivos/bytes limitados, symlinks recusados. Estilo gerado diferencia trilhas e ciclovias sem criar labels sem fonte. Geometrias fora dos bounds são descartadas no builder pequeno e o arquivo PBF é limitado antes de entrar em RAM.
- **Ainda PENDENTE:** validar o PMTiles gerado/empacotado num leitor independente, inspeção das tiles e vetor de bytes reais; conferir licenças ODbL e redistribuição dos extratos e fontes; E2E de busca e mapa após reinstalação offline; cobertura de glyphs/sprites; quota de instalação no dispositivo, build e performance. Instalar pacote grande por URL continua limitado no instalador a 64 MiB; importação por pasta ainda materializa bytes e precisa de hardening/QA antes de anúncio de suporte a mapas grandes no aparelho.
- **NÃO EXECUTADO:** lint, typecheck, tests Node/Vitest, build, Playwright, CI e dispositivos (somente gate `MM-MAP-900/940` por decisão vigente). Nunca afirmar capacidade pronta, navegar com rotas não verificadas ou fazer deploy sem gate. Sem mutation Neon/Vercel, release/tag/merge.

**Handoff detalhado:** `docs/MM-MAP-A3-regional-pmtiles-search.md`.

---


## A2 — Atualização segura da PWA (MM-UPD-030/040; 2026-10-09)

**PARCIAL EM CÓDIGO, NÃO VALIDADO:** `UpdatePrompt` deixou de recarregar a página sempre que o navegador muda o controller; o reload agora requer aceite explícito da atualização nesta aba, com leitura prévia da outbox e handshake de compatibilidade. O prompt ignora registration com escopo incompatível e recusa se o worker em espera mudar enquanto a validação está em andamento. O service worker do app só atende `SKIP_WAITING` vindo de cliente da mesma origem que realizou `CHECK_COMPATIBILITY` recentemente. A atualização continua opt-in e não limpa IndexedDB/outbox.

**PARCIAL/PENDENTE:** worker do site same-origin possui escopo e cache distintos; não foi alterado. Não há prova ainda de multiabas, duas registrations, atualização offline ou schema migration. Os checks de persistência cobrem leitura da outbox, não dados de formulário ainda não salvos. **NÃO EXECUTADO:** lint, typecheck, testes, build, E2E e dispositivo (gate final `MM-MAP-900/940`). Sem CI, deploy, main, Neon ou tags. **Próximo:** A3 — MM-MAP-200/210/400/430, pipeline cartográfico regional e busca sem rede.

---


## A1 — Robustez do instalador regional (MM-MAP-135/140/145; 2026-10-09)

**PARCIAL EM CÓDIGO — NÃO VALIDADO.** Em `dev/markmap-pwa-v2`, `OfflineMapStore` agora descarta staging obsoleto da mesma região na transação IndexedDB de escrita, sem apagar a geração ativa, e `install()` só ativa a geração exata produzida por seu staging. O orçamento agregado permanece 250 MiB; o instalador remoto prevê o pico temporário de chunks restantes mais pacote novo e recusa cedo se não houver espaço estimado. `DeviceStorageProfile` passa a considerar `navigator.storage.estimate().usage` para evitar subestimar outros dados da origem; a UI explica a reserva temporária.

**Risco ainda aberto:** quotas e eviction por navegador, atomicidade sob fechamento/quota/concorrrência entre abas, cancelamento, retomada e durabilidade da outbox demandam QA de navegador. **NÃO EXECUTADO:** lint, typecheck, unit, build, E2E e dispositivos, reservados para `MM-MAP-900/940` por decisão do responsável. Próxima etapa: **A2 — MM-UPD-030/040**, atualização PWA opt-in e protocolo SW. Sem GitHub CI, merge/main, deploy Vercel, alterações Neon, release, tag ou migração.

---

**MM-UPD-030 (código, não validado):** comparação de `minimumCompatibleVersion` dos pacotes regionais é feita com a versão REAL declarada em `apps/admin/package.json` (atualmente `0.2.0-dev.0`), e não contra a versão mínima de um pacote anterior. Configurações exibe a versão instalada. Commit `c8e48b4`; sem teste até gate final.

## M8 — GTFS estático regional e ajustes de segurança (2026-10-09; PREVALECE)

**Branch:** `dev/markmap-pwa-v2`, código `98785e5`, versão de desenvolvimento `0.2.0-dev.0`. **IMPLEMENTADO EM CÓDIGO, NÃO VALIDADO**. `main` e Vercel intocados; testes integrais somente depois de concluídas as implementações.

- [x] `scripts/gtfs-static.mjs` converte **GTFS Schedule extraído localmente**, de operador autorizado, para `content/transit.json`, sem serviços externos. Entradas `gtfs/stops.txt`, `routes.txt`, `trips.txt`, `stop_times.txt`, `agency.txt` opcional e `gtfs-source.json` obrigatório com `attribution`, `license`, `sourceUrl` HTTPS e `version?`. GTFS deve ser previamente extraído com segurança pelo publicador; não ler ZIP arbitrário nem distribuir base sem licença.
- [x] Contratos regionais existentes validam limite de 2 MiB, 12 mil estações, mil linhas, referências, coordenadas/bounds e atribuição. Reaproveita fluxo de hash, manifest, instalação, IndexedDB e painel/overlay existentes. `transit.json` original do publicador **sempre tem prioridade**; não sobrepor.
- [x] Apenas pontos/linhas lógicas de estação: os IDs de linhas não são geometria de trilhos, nem horários, frequências, tarifas ou navegação de transporte público. Modos GTFS suportados: 0–4 (bonde, metrô, trem, ônibus e ferry); tipos avançados fora do escopo parcial.
- [x] OSM sempre recebe crédito `OpenStreetMap contributors` no manifesto, mesmo ao combinar DEM/GTFS. Atualização por importação de pasta remove URL HTTPS antiga do mesmo ID. Popup de atualização do shell encerra canais de mensagem; o gerador OSM não abandona caminho a pé quando apenas regra de bicicleta é ambígua.
- [ ] **Gate final pendente:** alimentar GTFS/DEM/OSM reais licenciados; validar CSV contra GTFS oficial, CSV malformado, cobertura, conflitos, duplicatas, SHA, caches, workbox/SW e outbox em cenário offline. Sem testes/lint/typecheck/build/Playwright nesta rodada por pedido do responsável.
- [ ] Próximos: regiões grandes, pacote de distribuição real, horários/shape GTFS opcionais COM dado fornecido, gráficos de elevação oficiais, cálculo automotivo/restrições legais (não anunciar). `MM-MAP-900/940` e QA de navegador somente no fim.

---


## M8 incremental — camada visual de estações regionais (2026-10-09)

**Código:** `e905ebc` em `dev/markmap-pwa-v2`. `OfflineKnowledge.tsx` reaproveita a validação local e SHA-256 já existentes, comunica as estações verificadas à página do mapa, que exibe círculos coloridos conforme a linha (`regional-transit`) e popups seguros no MapLibre sem chamadas de rede. A limpeza de seleção remove os marcadores. **Não desenhar vias de metrô inventadas:** o contrato transit atual fornece IDs de estação, nomes/cores e coordenadas de estações, mas não a geometria real dos trilhos.

- [x] M8 — marcadores de estações locais em MapLibre após leitura de pack verificado (**código**).
- [ ] M8 — geometria oficial de vias/linhas e fontes GTFS reais licenciadas, com dados de movimento/horários apropriados.
- [ ] M8 — QA final de overlay, mudança de região e popup (adiada por decisão do responsável).

---


## Continuidade ativa — 2026-10-09: M6 DEM, M2 pacotes, M1 atualização PWA e M7 OSM (PREVALECE)

**Produto:** MarkMap PWA-first, `0.2.0-dev.0` (sem tag). **Branch única:** `dev/markmap-pwa-v2`.
**HEAD de código desta sequência:** `2a91716` (quatro commits sobre `0c827b3`: `6384c62`, `409a777`, `ae767f2`, `2a91716`). **`main@156d4e8` intocada.**
**Estado:** IMPLEMENTADO EM CÓDIGO; NÃO VALIDADO. O responsável adiou TODOS os testes para a etapa final. Não declarar funcionalidades prontas para release até `MM-MAP-940`.

### MM-MAP-500/520/530 — Grade altimétrica realmente offline (M6 parcial)

- Fonte: `dem.json` licenciado e validado OU pasta `srtm/*.hgt` (1–4 arquivos HGT de 1201²/3601² amostras, big-endian) com `srtm.json` contendo `attribution`, `license`, `sourceUrl`, `width?`, `height?`. Dados brutos precisam ser obtidos e licenciados por quem cria o pacote; **nenhuma coleta automática de dados ou elevação inventada**.
- `scripts/srtm-hgt.mjs` amostra o HGT por quadrícula WGS84 e produz `elevation/dem.json`. Saída limitada a 256×256 amostras, 2 MiB, valores int16 e marcador `-32768` para no-data; `metadata.resolutionMeters` corresponde à resolução EFETIVA da grade regional, não presume 30 m quando ela foi reduzida.
- `packages/maps/src/elevation/regional-dem.mjs`: valida regionId, bounds, tipo, origem, URL HTTPS, licença/atribuição, amostras reais, limites; perfil e subidas/descidas ignoram trechos sem dados e expõem cobertura. Arquivo `.d.mts` fornece tipos ao front.
- `demGrid?` e `capabilities: elevation` entram no manifest e no checksum/limite de bytes. Pipeline, download por URL, importação de pasta, IndexedDB e verificador de integridade passam a incluir o DEM antes da ativação. `OfflineElevation.tsx` mostra perfil da rota sem rede e aviso de trechos incompletos.
- Resolução, datum vertical, licenças e direitos de distribuição precisam de revisão por fonte. Copernicus GLO-30 tem condições de crédito e acesso próprias; não combinar com SRTM por pressuposição.

### MM-MAP-140 / MM-MAP-700 — Atualização de regiões (M2 parcial)

- Após instalar por HTTPS, apenas a URL pública `manifest.json` validada é guardada em `localStorage` para futuras consultas; nenhuma credencial, mapa ou posição GPS nesse registry. Importação por pasta fica totalmente offline e sem URL de atualização.
- O usuário toca **Ver atualizações**, compara versões SemVer e o limite mínimo de compatibilidade com a região atual, e pode tocar **Atualizar região**. Nada atualiza automaticamente. `ResumableInstaller` obtém os bytes por HTTPS, verifica tamanhos/SHA-256, ativa via IndexedDB apenas após validação e usa rollback implícito de falha de staging. Necessita espaço temporário; não prometer rollback posterior à ativação.
- Mapa ativo e outbox não são deliberadamente removidos. Pacote de origem desconhecida não apresenta botão de atualização; upgrade incompatível ou sem rede é recusado.

### MM-UPD-020 — Popup de atualização de PWA (M1 parcial)

- Worker em espera passa a responder `CHECK_COMPATIBILITY` via `MessageChannel` com protocolos de shell/local/region (1/1/2). Antes de enviar `SKIP_WAITING`, popup verifica leitura durável da outbox e handshake do worker. Falha de compatibilidade deixa app atual ativo e apresenta erro; usuário decide **Atualizar agora** ou **Depois**.
- Nenhum deploy ou habilitação de SW em produção foi executado. Migrações futuras precisarão evoluir protocolos, testes de dados antigos e backup; o handshake não garante que um formulário não salvo esteja persistido.

### MM-MAP-600 — Segurança OSM (M7 parcial)

- Fallback de rotas OSM pequeno exclui, por padrão, áreas/trechos propostos, abandonados, condicionais e acessos restritos ou de serviço privado ambíguo; limite de nós conta apenas novos IDs. Carro, relações OSM e acessos jurídicos complexos continuam DESABILITADOS nesse fallback.

### Checklist sequencial (implementar e depois validar, sem duplicar trabalho)

- [x] M6: inserir dados DEM reais SOMENTE quando operador fornecer arquivos/licença, com validação e hash, e mostrar altimetria offline no mapa (**código**).
- [x] M2: revisão segura de versões de mapas regionais e atualização opt-in via HTTPS (**código**).
- [x] M1: handshake de compatibilidade antes do botão de atualização PWA (**código**).
- [x] M7: reforçar filtros de acessos OSM e gestão de limite de nós (**código**).
- [ ] M6: adquirir amostras DEM legalmente redistribuíveis, verificar cobertura/no-data, georreferenciamento, datum e atribuição em pacotes reais.
- [ ] M3/M7: pipeline OSM completo para regiões maiores, nomes/labels/relações/restrições, carro somente após regras completas e revisão de segurança.
- [ ] M2/M8: avaliar quota de atualização de mapas grandes, catálogo assinado/de confiança, conteúdo Wikipedia/GTFS real e licenças.
- [ ] M9: Android Auto/CarPlay dependem de integração nativa; PWA pura não oferece APIs equivalentes. Não bloquear PWA operacional por esse item.
- [ ] MM-MAP-900/940 **ETAPA FINAL SOLICITADA**: pnpm lint/typecheck/test/build, Playwright Chromium/WebKit/Firefox, PWA offline instalada, GPS simulado, outbox/rollback/IndexedDB, SRTM/HGT e OSM reais, acessibilidade/perf, privacidade e licenças; sem GitHub CI.
- [ ] 5 ramos legados continuam sem exclusão: conector não expõe delete branch; verificar ancestralidade e PR antes de ação remota. Sem apagar trabalho de agentes.
- [ ] Só após gates verdes + autorização, criar PR para main, verificar bloqueio de deploy automático Vercel. Nunca publicar/taguear/mergear aqui.

**Arquivos centrais alterados nesta sequência:**
`packages/maps/src/elevation/{regional-dem.mjs,regional-dem.d.mts}`,
`scripts/{srtm-hgt.mjs,region-pipeline.mjs,region-pipeline.d.mts,osm-graph-search.mjs}`,
`packages/contracts/src/offline-map.ts`, `packages/maps/src/offline/package.ts`,
`apps/admin/src/{App.tsx,components/map/OfflineElevation.tsx,components/pwa/UpdatePrompt.tsx,pages/settings/SettingsPage.tsx,pages/workspace/CommandCenterPage.tsx,lib/storage/region-manager.ts,lib/storage/region-source-registry.ts,lib/storage/region-version.ts,lib/storage/offline-map-store.ts,lib/storage/resumable-installer.ts}`,
`apps/admin/public/sw.js`, mais checklist/handoff.

**Riscos/rollback:** não foram realizados migrations, deploy, alteração de banco, tag ou merge. Reverter commits isolados após preservar IndexedDB; novos manifests DEM são opcionais para mapas legados. Previamente executados apenas testes históricos, NENHUM teste nesta rodada. Próximo agente: auditar HEAD + Notion, trabalhar **somente** no mesmo ramo; não anunciar release.

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


> **Fonte operacional única para a iniciativa Maps Engine v2.** Este arquivo consolida PRD, roadmap/checklist, handoff e política de versões. O Checklist Mestre do Notion continua sendo a visão colaborativa obrigatória e deve permanecer sincronizado.

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

## Controle de versão do produto

**Versão estável de referência observada em `main`:** `0.1.0`  
**Linha de desenvolvimento ativa:** `0.2.0-dev.0`  
**Branch:** `feat/maps-engine-v2-offline`  
**Base da branch:** `main@156d4e819d6d876c6150969057f2fc3b9afdad45`  
**Status:** implementação parcial auditada em 2026-10-09; merge/main e deploy bloqueados até MM-MAP-940.  
**Próximo Task ID prioritário:** `MM-MAP-200` (seguido de `MM-MAP-130`)

### Regra de versionamento

Usar Semantic Versioning no formato `MAJOR.MINOR.PATCH[-PRERELEASE]`.

- `0.1.0`: baseline atual do app antes da iniciativa Maps Engine v2.
- `0.2.0-dev.0`: início formal da linha Maps Engine v2.
- após concluir M0: `0.2.0-dev.1`;
- após concluir M1: `0.2.0-dev.2`;
- após concluir M2: `0.2.0-dev.3`;
- continuar incrementando `dev.N` a cada gate de milestone concluído com evidência;
- após M10/MM-MAP-940 verde: candidato `0.2.0-rc.1`;
- `0.2.0` somente após autorização explícita de release.

**Não criar tag/release Git automaticamente.** Tags oficiais continuam exigindo autorização explícita.

### Fontes de versão que precisam ser normalizadas

- `apps/admin/package.json` atualmente declara `0.1.0` e é a evidência mais próxima de versão do app Web/PWA.
- o projeto iOS ainda possui `MARKETING_VERSION = 1.0` e `CURRENT_PROJECT_VERSION = 1`; isso é legado e não deve ser tratado como versão canônica do produto.
- `MM-UPD-010` deve criar uma fonte única de versão/build e sincronizar Web/PWA/Capacitor sem depender de valores divergentes.

### Versões independentes

Além da versão do aplicativo, manter:

- `shellProtocolVersion`: inteiro para compatibilidade do service worker/app shell;
- `localSchemaVersion`: inteiro para schema IndexedDB;
- `regionPackageSchemaVersion`: inteiro; atual legado = v1, alvo Maps Engine = v2;
- `regionDataVersion`: versão/data de cada snapshot regional OSM;
- `buildSha`: commit Git exato do build.

### Ledger de versões

| Versão | Estado | Referência | Observação |
|---|---|---|---|
| `0.1.0` | baseline atual | `main@156d4e8` | aplicação anterior ao Maps Engine v2 |
| `0.2.0-dev.0` | desenvolvimento ativo | `feat/maps-engine-v2-offline` | implementação parcial; próximo MM-MAP-200; sem release |
| `0.2.0-rc.1` | futuro | após MM-MAP-940 | somente com todos os gates verdes |
| `0.2.0` | futuro | release autorizado | não criar sem autorização explícita |

---

# Parte A — PRD / Roadmap / Manual de implementação

# MarkMap — PRD/Handoff: Maps Engine v2 Offline

**Status:** aprovado para implementação em ramo isolado  
**Branch de integração:** `feat/maps-engine-v2-offline`  
**Base auditada:** `main@156d4e819d6d876c6150969057f2fc3b9afdad45`  
**Data da auditoria:** 2026-10-07  
**Objetivo do documento:** ser o manual executável para agentes que vão evoluir mapa, dados offline, busca, importação/exportação, elevação, roteamento, conteúdo de lugares e atualização do MarkMap sem reescrever a arquitetura vigente.

---

## 1. Objetivo

Transformar o MarkMap em uma aplicação de campo com experiência cartográfica moderna e realmente offline, inspirada nas capacidades do Organic Maps, preservando a arquitetura atual:

- React + Vite + TypeScript;
- MapLibre GL como renderer;
- Terra Draw como edição vetorial;
- IndexedDB/outbox como fonte operacional local;
- Hono + Neon/PostgreSQL/PostGIS para sync/backup/consultas remotas;
- Capacitor para Android/iOS;
- PMTiles para mapas regionais offline.

A aplicação deve continuar útil sem internet depois que o usuário baixar os pacotes necessários.

---

## 2. Resultado esperado

Ao final desta iniciativa, o MarkMap deve oferecer, conforme a região baixada:

- mapa vetorial detalhado baseado em OpenStreetMap;
- ruas, estradas, estradas rurais, ciclovias, trilhas e caminhos de pedestres;
- POIs e lugares;
- tema claro, escuro e outdoor;
- download de regiões para uso totalmente offline;
- atualização segura e resumível dos mapas regionais;
- busca offline por lugares, endereço, categoria, referência e coordenadas;
- importação/exportação GPX, KML/KMZ e GeoJSON;
- curvas de nível, relevo, altitude e perfil de elevação;
- roteamento offline a pé, bicicleta e carro;
- instruções de manobra e orientação por voz;
- conteúdo offline de Wikipedia/Wikidata quando licenciado e disponível;
- transporte/linhas de metrô onde houver dados;
- integração posterior com Android Auto e CarPlay;
- popup de atualização do aplicativo e dos pacotes de mapas;
- operação principal independente da conectividade.

---

## 3. Estado atual auditado

### 3.1 FUNCIONA

- MapLibre GL.
- Terra Draw.
- GPS/geolocalização.
- IndexedDB/outbox local-first.
- PMTiles v3.
- protocolo local para PMTiles.
- estilo offline com glyphs/sprites locais.
- checksum SHA-256 e ativação validada de pacote offline.
- GeoJSON.
- GeoPDF/PDF local e reprojeção.
- armazenamento e limpeza de mapas offline.
- service worker e PWA instalável.
- UpdatePrompt com ativação controlada.
- navegação geométrica básica: distância, bearing, heading e detecção de chegada.

### 3.2 PARCIAL

- atualização PWA: existe worker waiting + botão Atualizar, mas não há política completa de checagem periódica, versão legível, adiar/relembrar, release notes nem canal equivalente para builds Capacitor;
- mapas offline: pacote atual concentra PMTiles + style/glyphs/sprites e possui teto fixo de 250 MiB;
- navegação: não existe grafo viário/roteamento passo a passo;
- gestão de storage: mede categorias internas, mas precisa evoluir para orçamento adaptativo por dispositivo e storage de arquivos grandes.

### 3.3 NÃO IMPLEMENTADO

- GPX;
- KML/KMZ;
- índice de busca offline de OSM;
- roteamento offline carro/bicicleta/pedestre;
- recálculo de rota;
- instruções de manobra;
- TTS de navegação;
- DEM/SRTM;
- curvas de nível;
- perfil de elevação;
- hillshade/relevo;
- artigos Wikipedia offline;
- pacote de transporte/metro;
- Android Auto;
- CarPlay;
- atualização independente de pacote regional de mapa.

---

## 4. Repositórios-modelo auditados

### 4.1 organicmaps/organicmaps

Repo: https://github.com/organicmaps/organicmaps

Uso: referência principal de arquitetura e algoritmos offline.

Áreas relevantes:

- `libs/search/`: busca offline, categorias, ranking e approximate string matching;
- `libs/routing/`: roteamento, manobras e navegação;
- `libs/routing/turns_tts_text.cpp`: geração de instruções para TTS;
- `libs/kml/serdes_gpx.cpp`: GPX;
- `libs/kml/`: KML/GeoJSON e modelos de tracks/bookmarks;
- `generator/isolines_generator.cpp`: curvas de nível;
- `generator/srtm_parser.cpp`: dados de elevação;
- `libs/map/elevation_info.cpp`: perfil/informação de elevação;
- `generator/descriptions_section_builder.cpp` e `generator/wiki_url_dumper.cpp`: descrições/Wikipedia;
- `libs/transit/`: grafo e serialização de transporte;
- `android/app/src/main/java/app/organicmaps/car/`: Android Auto;
- `iphone/Maps/Core/CarPlay/`: CarPlay;
- `generator/`: pipeline de construção de dados offline.

Decisão: reutilizar conceitos e, quando compatível/licenciado, portar trechos isolados. Não portar o app inteiro nem substituir MapLibre/Terra Draw.

### 4.2 organicmaps/api-android

Repo: https://github.com/organicmaps/api-android

É um wrapper Java fino para deep links `om://`, pontos e retorno de coordenadas. Não é o engine offline do Organic Maps.

Uso no MarkMap:

- referência de Intent/Activity Result;
- referência para interop opcional com Organic Maps;
- não usar como base do engine cartográfico.

Licença observada no README: BSD 2-Clause.

### 4.3 organicmaps/api-ios

Repo: https://github.com/organicmaps/api-ios

É uma API por URL scheme/deep link para abrir o Organic Maps, mostrar pins e retornar resultados.

Uso no MarkMap:

- referência para URL schemes/deep links iOS;
- referência para integração externa opcional;
- não usar como engine offline.

Licença observada no README: BSD 2-Clause.

### 4.4 openstreetmap/openstreetmap-website

Repo: https://github.com/openstreetmap/openstreetmap-website

É a aplicação Ruby on Rails que alimenta o site e a API de edição do OpenStreetMap. O próprio README deixa claro que tile servers e geocoding dependem de outros serviços.

Uso no MarkMap:

- referência de comportamento da API OSM e GPX;
- eventual referência para contribuição/edição OSM;
- não usar como servidor de tiles;
- não copiar código para o MarkMap.

Licença: GPL-2.0. Copiar código desse repo para o MarkMap é proibido nesta iniciativa sem uma revisão jurídica/licenciamento específica.

---

## 5. Política obrigatória de licença e proveniência

### 5.1 Código Organic Maps

O repositório principal aponta para Apache-2.0 no root, porém o projeto usa inventário/licenças por arquivo e terceiros. Antes de copiar qualquer trecho:

1. conferir SPDX/cabeçalho do arquivo;
2. conferir `LICENSES/`, `NOTICE` e dependências;
3. registrar origem, commit e arquivo em `THIRD_PARTY_NOTICES.md`;
4. preservar avisos exigidos;
5. preferir reimplementação limpa quando a integração direta for acoplada a MWM/C++.

### 5.2 Dados Organic Maps

Não redistribuir `.mwm`, `packed_polygons.bin` ou outros Data Files do Organic Maps no MarkMap.

A licença de dados é separada e exige atribuição Organic Maps + OpenStreetMap e possui condição específica para white-label/rebranding.

### 5.3 OpenStreetMap

Usar dados OpenStreetMap como fonte primária dos pacotes MarkMap, respeitando ODbL e atribuição visível.

Nunca fazer bulk download/prefetch em `tile.openstreetmap.org`.

### 5.4 openstreetmap-website

Não copiar código GPL-2.0 para os pacotes TypeScript/Hono do MarkMap.

### 5.5 Wikipedia/Wikidata/elevação

Antes de distribuir conteúdo:

- registrar fonte;
- registrar versão/data;
- registrar licença;
- incluir atribuição no app;
- permitir consulta das atribuições por pacote regional.

---

## 6. Arquitetura-alvo

```text
                    PIPELINE DE DADOS (fora do dispositivo)
OpenStreetMap PBF ────────────────────────────────┐
DEM/SRTM/ASTER ──────────────────────────────────┤
Wikipedia/Wikidata ──────────────────────────────┤
GTFS/transit opcional ───────────────────────────┘
                         │
                         ▼
                MarkMap Region Builder
                         │
                         ▼
                 Region Package v2
       ┌─────────────────┼──────────────────┐
       │                 │                  │
       ▼                 ▼                  ▼
 basemap.pmtiles     search shards     routing graph
 contours/DEM        place content     transit metadata
       │                 │                  │
       └─────────────────┼──────────────────┘
                         ▼
              MarkMap Web/PWA/Capacitor
                         │
            ┌────────────┼─────────────┐
            ▼            ▼             ▼
         MapLibre     Web Workers   IndexedDB/outbox
                         │
                 large-file storage
              OPFS / native filesystem
```

### Regra de arquitetura

- IndexedDB continua sendo fonte operacional para entidades, outbox, metadados e estado de instalação.
- arquivos grandes e imutáveis devem usar um `LargeBlobStore` abstrato;
- Web/PWA: OPFS quando disponível, fallback seguro para IndexedDB;
- Capacitor: filesystem nativo quando o uso real justificar plugin nativo;
- Neon nunca vira requisito para trabalho de campo;
- MapLibre e Terra Draw não são substituídos.

---

## 7. Region Package v2

O pacote regional deixa de ser somente um PMTiles.

Estrutura lógica:

```text
region/
  manifest.json
  basemap.pmtiles
  styles/
    light.json
    dark.json
    outdoor.json
  glyphs/
  sprites/
  search/
    metadata.json
    *.idx
  routing/
    graph.bin
    names.bin
    restrictions.bin
  terrain/
    contours.pmtiles
    dem.pmtiles
  content/
    places.idx
    wikipedia/*.json.br
  transit/
    network.bin
  licenses/
    ATTRIBUTION.md
    sources.json
```

Nem todos os módulos são obrigatórios. O manifest deve declarar capabilities:

```text
basemap
search
routing.walk
routing.bicycle
routing.car
elevation
contours
wikipedia
transit
```

### Requisitos de instalação

- manifest versionado;
- tamanho de cada componente;
- SHA-256 por arquivo;
- ID e versão do pacote;
- data da fonte OSM;
- bounds;
- min/max zoom;
- atribuições;
- compatibilidade mínima do app;
- staging antes de ativar;
- ativação atômica;
- rollback para pacote anterior se a ativação falhar;
- download resumível;
- nunca apagar o pacote ativo antes da validação do novo.

### Remover teto fixo de 250 MiB

O limite atual de 250 MiB deve ser substituído por:

- hard limits defensivos por arquivo/componente;
- orçamento calculado por dispositivo;
- reserva de espaço livre;
- consentimento do usuário antes de downloads grandes;
- regiões particionadas para evitar pacotes gigantes.

Não permitir uso ilimitado de storage.

---

## 8. Uso máximo e seguro dos recursos do dispositivo

### 8.1 Storage

Web/PWA:

- chamar `navigator.storage.persist()` em contexto apropriado;
- usar `navigator.storage.estimate()`;
- manter pelo menos uma reserva de segurança;
- preferir OPFS para grandes arquivos regionais;
- IndexedDB mantém metadados, índice de pacotes e domínio local.

Capacitor:

- avaliar e, se necessário, adicionar `@capacitor/filesystem`;
- armazenar pacotes grandes no filesystem privado do app;
- não expor arquivos internos publicamente;
- manter metadados e outbox em IndexedDB.

### 8.2 CPU

Criar workers dedicados:

- `search.worker.ts`;
- `routing.worker.ts`;
- `elevation.worker.ts`;
- worker de parsing/importação quando arquivo for grande.

Política:

- reservar a thread principal para UI/MapLibre;
- usar `navigator.hardwareConcurrency` como sinal, nunca como obrigação de saturar CPU;
- limitar paralelismo em mobile;
- cancelar tarefas antigas por AbortSignal;
- priorizar navegação ativa sobre indexação/background.

### 8.3 Memória

- nunca carregar região inteira na RAM;
- range reads para PMTiles/arquivos binários;
- índices sharded;
- LRU com orçamento adaptativo;
- streaming/chunking de importação;
- liberar buffers após uso;
- medir heap quando API estiver disponível, sem depender dela.

### 8.4 Energia

- não recalcular rota continuamente sem deslocamento significativo;
- pausar tarefas secundárias quando app está background;
- evitar polling agressivo;
- atualizações de mapas são iniciadas/confirmadas pelo usuário.

---

## 9. Sistema de atualização do aplicativo

O MarkMap já possui `UpdatePrompt`; ele deve ser evoluído, não reescrito do zero.

### MM-UPD-010 — Build/version manifest

Criar metadata pública de versão contendo:

- appVersion;
- buildSha;
- buildTime;
- shellProtocolVersion;
- localSchemaVersion;
- minimumCompatibleVersion;
- releaseNotes curtas.

### MM-UPD-020 — Checagem PWA

O app deve chamar `registration.update()`:

- após `serviceWorker.ready`;
- quando voltar a ficar online;
- quando a janela voltar ao foreground/focus;
- periodicamente enquanto online, com intervalo conservador.

Quando houver worker `waiting`, mostrar popup/modal:

**Nova versão do MarkMap disponível**

Ações:

- `Atualizar agora`;
- `Depois`.

Antes de atualizar:

- confirmar que transações locais terminaram;
- confirmar outbox durável;
- confirmar compatibilidade de schema/protocolo;
- não interromper edição em andamento;
- ativar waiting worker;
- recarregar somente depois de `controllerchange`.

Se o usuário escolher `Depois`, relembrar no próximo lançamento/foco ou depois de um intervalo; cada nova versão deve gerar novo aviso.

### MM-UPD-030 — Capacitor Android/iOS

Service worker não substitui atualização de binário nativo.

Quando online:

- consultar version manifest;
- comparar com versão do bundle nativo;
- exibir o mesmo padrão visual de popup;
- botão deve abrir o canal oficial de atualização/distribuição definido para a plataforma;
- não implementar auto-update nativo fora das políticas de distribuição sem autorização específica.

### MM-UPD-040 — Atualização de pacotes de mapa

Separar update do app e update de dados.

Exemplo:

> Mapa Tocantins: atualização disponível — dados OSM de 2026-10-07.

Ações:

- `Atualizar mapa`;
- `Depois`;
- detalhes/tamanho.

Fluxo:

1. baixar em staging;
2. resumir após interrupção;
3. validar checksum;
4. validar manifest/compatibilidade;
5. ativar atomicamente;
6. manter pacote antigo até sucesso;
7. remover antigo somente depois da ativação e confirmação.

---

## 10. Roadmap executável

Os IDs abaixo definem a ordem. Um agente não deve iniciar um item bloqueado por predecessor.

# M0 — Governança, baseline e benchmark

### MM-MAP-000 — Baseline da branch

**Predecessor:** nenhum.

- confirmar HEAD da integração;
- confirmar ausência de trabalho paralelo duplicado;
- rodar lint/typecheck/test/build aplicáveis antes de alterar;
- registrar métricas de bundle, storage e mapa;
- auditar tests existentes de offline maps/PWA;
- criar relatório FUNCIONA/PARCIAL/QUEBRADO/NÃO IMPLEMENTADO.

**Aceite:** baseline registrada no PRD/handoff sem afirmar teste não executado.

### MM-MAP-010 — Proveniência/licenças

- inventariar todo código efetivamente copiado/adaptado;
- proibir código do `openstreetmap-website`;
- registrar Organic Maps por arquivo/commit;
- atualizar THIRD_PARTY_NOTICES quando houver incorporação real.

---

# M1 — Atualizações do app

### MM-UPD-010
Implementar build/version manifest.

### MM-UPD-020
Evoluir UpdatePrompt PWA.

### MM-UPD-030
Adicionar detecção de nova versão em Capacitor.

### MM-UPD-040
Criar modelo de atualização de Region Package.

**Gate M1:**

- teste unitário de state machine do prompt;
- E2E de worker waiting → confirmação → controllerchange;
- teste de `Depois`;
- teste com outbox pendente;
- teste offline após versão já descoberta;
- sem perda de IndexedDB/outbox.

---

# M2 — Storage e Region Package v2

### MM-MAP-100 — DeviceStorageProfile

Criar módulo que informa:

- quota;
- usage;
- persistent granted;
- backend disponível;
- limite seguro calculado.

### MM-MAP-110 — LargeBlobStore

Interface comum para:

- IndexedDB fallback;
- OPFS;
- filesystem Capacitor quando adotado.

Operações mínimas:

- create staging;
- append/write range;
- read range;
- checksum;
- commit/activate;
- rollback;
- delete explícito;
- enumerate.

### MM-MAP-120 — Manifest v2

Evoluir `packages/contracts/src/offline-map.ts` com:

- componentes opcionais;
- capabilities;
- fontes/licenças;
- versionamento;
- compatibilidade;
- checksums individuais;
- tamanho total;
- data OSM.

Compatibilidade: packages v1 existentes não podem quebrar silenciosamente.

### MM-MAP-130 — Instalador resumível

- download com Range quando servidor suportar;
- checkpoint;
- retry idempotente;
- staging;
- validação;
- atomic activate.

### MM-MAP-140 — Gerenciador de regiões

UI:

- regiões instaladas;
- espaço usado;
- tamanho;
- versão;
- data do mapa;
- update disponível;
- remover;
- reparar;
- detalhes/licenças.

**Gate M2:** pacote regional continua funcionando após force-stop/reload e sem rede.

---

# M3 — Mapa OSM moderno

### MM-MAP-200 — Pipeline regional

Criar pipeline reproduzível de entrada OSM PBF → dados consumíveis pelo MarkMap.

Requisitos:

- build determinístico;
- metadata de origem/data;
- logs;
- checksum;
- processamento fora do dispositivo;
- artefatos regionais;
- sem dependência em `tile.openstreetmap.org`.

A escolha do gerador de vector tiles deve ser fechada apenas após benchmark/licença no início deste item.

### MM-MAP-210 — Estilos MarkMap

Criar estilos:

- light;
- dark;
- outdoor.

Renderizar com prioridade adequada:

- estradas;
- vias locais/rurais;
- `highway=path`;
- `footway`;
- `cycleway`;
- `track`;
- trilhas;
- rios/lagos;
- parques;
- limites;
- buildings quando justificável;
- POIs;
- picos;
- estações;
- nomes locais/ref.

### MM-MAP-220 — Atualização de dados

Pipeline deve gerar versão nova por região e catálogo de versões.

Não fazer delta no MVP se ele aumentar risco; download resumível + troca atômica é obrigatório. Delta pode entrar depois que houver benchmark real.

---

# M4 — GPX/KML/KMZ/GeoJSON

### MM-MAP-300 — GPX

Importar:

- waypoints;
- tracks;
- routes;
- elevação;
- timestamps quando presentes;
- nomes/descrições.

Exportar dados compatíveis sem inventar campos ausentes.

### MM-MAP-310 — KML/KMZ

Importar/exportar:

- Point;
- LineString;
- Polygon;
- MultiGeometry relevante;
- estilos básicos;
- ExtendedData segura;
- KMZ com validação contra zip bomb/path traversal.

### MM-MAP-320 — Round-trip

Testes fixture → import → persist local → export → reimport.

**Gate M4:** GeoJSON existente não regride.

---

# M5 — Busca offline

### MM-MAP-400 — Search index builder

Inspirar-se no desenho do `libs/search/` do Organic Maps, sem acoplar a MWM.

Indexar por região:

- name;
- alt_name;
- official_name;
- short_name;
- ref;
- addr:housenumber;
- addr:street;
- addr:place;
- postcode quando disponível;
- place/admin;
- categorias POI;
- coordenadas.

Suportar:

- normalização Unicode;
- case folding;
- prefix;
- tokens;
- aliases;
- ranking por classe/importância/proximidade;
- fuzzy conservador.

### MM-MAP-410 — Search worker

- busca totalmente offline;
- resposta progressiva;
- cancelamento de query anterior;
- não bloquear UI;
- filtro por categoria;
- `perto de mim`;
- coordenadas digitadas.

### MM-MAP-420 — UX

- search box no mapa;
- histórico local;
- recentes/favoritos;
- ação centralizar;
- ação navegar;
- exibir fonte/atribuição quando aplicável.

**Gate M5:** busca por POI/endereço conhecido funciona com modo avião.

---

# M6 — Elevação e outdoor

### MM-MAP-500 — Pipeline DEM/contours

Inspirar-se em:

- `generator/srtm_parser.cpp`;
- `generator/isolines_generator.cpp`.

Gerar por região:

- DEM adequado ao runtime;
- curvas de nível vetoriais;
- metadata de resolução/fonte/licença.

### MM-MAP-510 — Consulta de altitude

- altitude no cursor/local;
- altitude em ponto capturado;
- altitude em waypoint;
- cache local.

### MM-MAP-520 — Perfil de elevação

Inspirar-se em `libs/map/elevation_info.cpp`.

Exibir:

- distância;
- altitude;
- ganho;
- perda;
- mínimo;
- máximo;
- gráfico do perfil.

### MM-MAP-530 — Relevo

- contours;
- hillshade quando suportado pelo pacote/MapLibre;
- picos;
- outdoor style.

**Gate M6:** toda consulta funciona sem rede com pacote compatível.

---

# M7 — Roteamento offline e navegação

### MM-MAP-600 — Routing graph builder

Gerar grafo regional a partir de OSM.

Deve considerar:

- one-way;
- access;
- turn restrictions;
- surface;
- tracktype;
- bicycle/foot access;
- ferry quando suportado;
- velocidade/perfil;
- bridges/tunnels relevantes.

### MM-MAP-610 — Runtime router

Executar em Web Worker.

Perfis:

- walk;
- bicycle;
- car.

Requisitos:

- snap origem/destino à rede;
- rota;
- alternativas somente depois do MVP;
- cancelamento;
- limites de memória;
- resultado com geometria + segmentos + metadata.

### MM-MAP-620 — Maneuvers

Inspirar-se em `libs/routing/`.

Gerar:

- vire esquerda/direita;
- mantenha;
- rotatória;
- saída;
- continue;
- chegada.

### MM-MAP-630 — Navegação

- GPS tracking;
- route progress;
- off-route;
- recálculo local;
- distância para próxima manobra;
- ETA estimada;
- chegada;
- wake behavior somente quando necessário.

### MM-MAP-640 — Voz

Inspirar-se em `libs/routing/turns_tts_text.cpp`.

- gerar texto local;
- usar TTS do SO/browser;
- não depender de serviço cloud;
- controle de volume/ativação;
- pt-BR primeiro, arquitetura preparada para i18n.

**Gate M7:** rota completa a pé/bike/carro em aparelho sem internet.

---

# M8 — Conteúdo de lugares e transporte

### MM-MAP-700 — Wikipedia/Wikidata offline

Inspirar-se em:

- `generator/descriptions_section_builder.cpp`;
- `generator/wiki_url_dumper.cpp`.

Processar no pipeline:

- tags OSM `wikipedia`/`wikidata`;
- extratos permitidos;
- idioma;
- atribuição;
- conteúdo compactado/sharded.

Runtime:

- place sheet;
- título;
- resumo;
- link para abrir artigo completo quando online;
- conteúdo offline quando baixado.

### MM-MAP-710 — Transporte/metro

Inspirar-se em `libs/transit/`.

MVP:

- estações;
- linhas;
- cor/nome;
- overlay no mapa;
- busca por estação.

Roteamento multimodal somente depois de evidência de necessidade e dados suficientes.

---

# M9 — Android Auto e CarPlay

Executar somente depois de M7 estável.

### MM-MAP-800 — Android Auto

Referências:

- `android/app/src/main/java/app/organicmaps/car/`;
- `organicmaps/api-android` apenas para padrões de Intent/deep link.

Implementar integração nativa Capacitor somente com escopo aprovado.

### MM-MAP-810 — CarPlay

Referências:

- `iphone/Maps/Core/CarPlay/`;
- `organicmaps/api-ios` apenas para padrões de URL scheme/deep link.

Respeitar templates/restrições de segurança da Apple.

---

# M10 — Hardening e merge readiness

### MM-MAP-900 — Performance

Medir em aparelhos de referência:

- startup;
- mapa first-render;
- pan/zoom FPS;
- memória;
- busca p50/p95;
- rota curta/longa;
- tamanho de região;
- instalação/atualização;
- bateria em navegação prolongada.

Sem número-alvo inventado: registrar baseline e fechar budgets com evidência.

### MM-MAP-910 — Segurança

Testar:

- path traversal;
- zip bomb KMZ;
- manifest adulterado;
- checksum;
- pacote truncado;
- download interrompido;
- resource exhaustion;
- arquivos gigantes;
- XSS em properties/descrições;
- URLs externas;
- corrupção IndexedDB/storage.

### MM-MAP-920 — Compatibilidade

- migration package v1 → v2 ou convivência;
- app antigo não deve ativar package incompatível;
- app novo não deve apagar package antigo antes de confirmar novo;
- schema local preserva workspace/outbox;
- rollback documentado.

### MM-MAP-930 — Documentação/legal

Atualizar:

- `docs/architecture.md`;
- `docs/gis-geopdf.md` ou novo doc de maps engine;
- `docs/user-guide.md`;
- `docs/testing.md`;
- `docs/privacy.md` quando houver novos dados;
- `THIRD_PARTY_NOTICES.md`;
- ADR de package v2/storage/routing;
- checklist/handoff.

### MM-MAP-940 — Gate para PR contra main

Não abrir PR para `main` até:

- integração branch atualizada com main sem apagar trabalho;
- lint verde;
- typecheck verde;
- unit/integration verdes;
- build verde;
- E2E aplicável verde;
- testes offline aplicáveis verdes;
- Android APK aplicável verde;
- iOS build aplicável verde;
- diff revisado;
- licenças revisadas;
- documentação sincronizada;
- nenhuma ação irreversível pendente;
- evidência física registrada para recursos que exigem aparelho.

---

## 11. Arquivos/áreas esperados

Existentes:

- `packages/contracts/src/offline-map.ts`;
- `packages/maps/src/offline/*`;
- `packages/maps/src/providers.ts`;
- `packages/maps/src/maplibre.ts`;
- `packages/geo/src/*`;
- `apps/admin/src/lib/storage/*`;
- `apps/admin/src/lib/datasets/*`;
- `apps/admin/src/pages/imports/ImportsPage.tsx`;
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx`;
- `apps/admin/src/components/pwa/UpdatePrompt.tsx`;
- `apps/admin/public/sw.js`;
- `apps/admin/package.json`;
- mobile Capacitor somente quando necessário.

Novas áreas sugeridas:

- `packages/maps/src/search/`;
- `packages/maps/src/routing/`;
- `packages/maps/src/elevation/`;
- `packages/maps/src/offline-v2/` somente se não for possível evoluir `offline/` compatibilmente;
- `packages/geo/src/gpx.ts`;
- `packages/geo/src/kml.ts`;
- `apps/admin/src/workers/`;
- `tools/maps-pipeline/`;
- fixtures em `packages/*/fixtures/` e testes próximos aos módulos.

Não criar arquitetura paralela sem necessidade comprovada.

---

## 12. Segurança

Obrigatório:

- arquivos importados são não confiáveis;
- nenhum XML com resolução de entidade externa;
- nenhum unzip sem limites;
- nenhum caminho vindo do pacote pode escapar do diretório lógico;
- checksum antes de ativação;
- limites de tamanho por componente;
- abort/cancel em tarefas pesadas;
- URLs de conteúdo sanitizadas;
- conteúdo Wikipedia renderizado como texto seguro/HTML sanitizado conforme implementação;
- nenhuma credencial de banco no cliente;
- nenhum secret no pacote regional;
- telemetria não pode ser requisito para offline.

---

## 13. Critérios de aceite globais

1. O MarkMap abre e permite trabalhar em região previamente baixada com modo avião.
2. Dados de usuário continuam persistidos em IndexedDB/outbox.
3. Pacotes regionais grandes não bloqueiam a thread principal.
4. Atualização de app não perde edição/outbox.
5. Atualização de mapa é atômica e recuperável.
6. Busca offline não chama API remota.
7. Roteamento offline não chama API remota.
8. Elevação/contours offline não chamam API remota.
9. Licenças/atribuições são visíveis e rastreáveis.
10. Nenhum código GPL do openstreetmap-website é incorporado.
11. Nenhum Data File `.mwm/.bin` do Organic Maps é redistribuído.
12. Recursos existentes de GeoPDF, desenho, sync e PWA não regridem.

---

## 14. Testes obrigatórios

### Unit

- parsers;
- manifest;
- path safety;
- checksum;
- search normalization/ranking;
- graph restrictions;
- maneuver generation;
- elevation calculations;
- update state machines.

### Integration

- package staging → validation → activation;
- interrupted/resumed download;
- package v1 compatibility;
- import/export round-trip;
- search against real fixture;
- routing against real OSM fixture;
- terrain fixture.

### E2E

- instalar região;
- fechar/reabrir offline;
- buscar POI offline;
- visualizar trilha;
- importar GPX;
- gerar rota offline;
- receber popup de atualização;
- atualizar app preservando IndexedDB;
- atualizar região preservando dados de usuário.

### Physical

- Android offline;
- iOS offline;
- GPS/navigation;
- storage pressure;
- arquivo grande;
- update PWA instalada;
- native update notice quando canal mobile existir;
- Android Auto/CarPlay somente quando implementados.

---

## 15. QA por fase

Cada agente deve reportar:

```text
RESULTADO
ALTERAÇÕES
ARQUIVOS
VALIDAÇÃO EXECUTADA
VALIDAÇÃO NÃO EXECUTADA
LICENÇAS/ORIGEM DE CÓDIGO
RISCOS/PENDÊNCIAS
PRÓXIMO TASK ID LIVRE
```

Nunca usar “concluído” sem evidência.

---

## 16. Regras de Git e agentes paralelos

Branch de integração desta iniciativa:

```text
feat/maps-engine-v2-offline
```

Regras:

1. nunca implementar esta iniciativa diretamente em `main`;
2. antes de iniciar, verificar HEAD/PRs/checklist;
3. cada agente deve pegar somente o primeiro Task ID livre que não esteja bloqueado;
4. para trabalho paralelo, criar branch curta a partir da integração, por exemplo:
   `agent/MM-MAP-300-gpx`;
5. PR desses agentes deve apontar para `feat/maps-engine-v2-offline`, não para `main`;
6. não force-push;
7. não resetar/apagar mudanças alheias;
8. revisar diff antes de merge;
9. se a integração avançar, atualizar branch com método não destrutivo;
10. PR para `main` somente após MM-MAP-940.

---

## 17. Ações proibidas sem autorização explícita

- deploy público;
- publicação em loja;
- release/tag;
- migration destrutiva;
- DROP/TRUNCATE/DELETE production;
- rotação de secrets;
- custo recorrente relevante;
- force push;
- apagar branch/trabalho de agente;
- distribuir Data Files do Organic Maps;
- copiar código GPL do openstreetmap-website;
- alterar arquitetura central React/Vite/MapLibre/Terra Draw/IndexedDB/Hono/Neon sem ADR e evidência.

---

## 18. Riscos principais

### Storage

Regiões detalhadas podem ser grandes. Mitigação: particionamento, orçamento adaptativo, resumable download e escolha explícita do usuário.

### CPU/bateria

Roteamento e busca podem consumir recursos. Mitigação: workers, cancelamento, caches, perfis e medição física.

### Licença

Misturar código/dados de fontes diferentes pode gerar obrigação incompatível. Mitigação: proveniência por arquivo e gate legal antes de merge.

### Complexidade MWM

O core Organic Maps é fortemente integrado ao formato e ao C++ próprio. Mitigação: copiar conceitos/algoritmos isolados, não adotar MWM como formato do MarkMap.

### Mobile/PWA

APIs de storage variam entre browser e WebView. Mitigação: adapter de storage e testes físicos.

### Atualização

Ativação errada de novo shell/pacote pode quebrar operação offline. Mitigação: compat version, staging, atomic swap e rollback.

---

## 19. Fora do escopo desta primeira iniciativa

Até haver evidência específica:

- substituir MapLibre;
- substituir Terra Draw;
- migrar toda a aplicação para C++/Kotlin/Swift;
- usar `.mwm` como formato principal;
- hospedar clone do openstreetmap.org;
- edição colaborativa direta do OSM;
- tráfego em tempo real;
- roteamento cloud obrigatório;
- IA necessária para recursos básicos;
- publicação em loja;
- deploy production.

---

## 20. Handoff para o primeiro agente executor

### Tarefa inicial

Começar por **MM-MAP-000**, depois **MM-MAP-010**, e só então **M1**.

Não iniciar routing/search/terrain antes da fundação de storage/package v2 estar definida e testada.

### Prompt pronto

```text
Você está trabalhando no MarkMap.

Leia primeiro GEONEXO_FONTE_CHATGPT.md das Fontes do Projeto.
Depois consulte o Checklist Mestre do Notion e confira o HEAD/PRs atuais.

Esta iniciativa deve ser desenvolvida na branch de integração:
feat/maps-engine-v2-offline

Leia integralmente:
docs/markmap-maps-engine-v2-prd-handoff.md
docs/master-checklist.md
docs/handoff.md

Pegue somente o primeiro Task ID livre e não bloqueado.
Antes de editar, audite a área e classifique FUNCIONA, PARCIAL, QUEBRADO ou NÃO IMPLEMENTADO.
Não reescreva algo que funciona.

Preserve:
React + Vite + TypeScript
MapLibre
Terra Draw
IndexedDB/outbox
Hono
Neon/PostGIS
Capacitor

Operação principal deve continuar offline-first.

Não copie código de openstreetmap/openstreetmap-website.
Não redistribua .mwm/.bin do Organic Maps.
Todo trecho copiado/adaptado precisa de origem/licença registrada.

Antes de concluir, execute os gates aplicáveis e entregue:
RESULTADO
ALTERAÇÕES
ARQUIVOS
VALIDAÇÃO EXECUTADA
VALIDAÇÃO NÃO EXECUTADA
LICENÇAS/ORIGEM DE CÓDIGO
RISCOS/PENDÊNCIAS
PRÓXIMO TASK ID LIVRE

Não abra PR para main. PRs intermediários apontam para feat/maps-engine-v2-offline.
```

---

## 21. Definition of Done da iniciativa

A iniciativa só pode ser considerada pronta para request contra `main` quando:

- MM-MAP-940 estiver satisfeito;
- checklist do Notion e Git estiverem sincronizados;
- handoff estiver atualizado;
- documentação de uso offline estiver pronta;
- atribuições e THIRD_PARTY_NOTICES estiverem corretos;
- não houver gate vermelho conhecido;
- testes físicos necessários tiverem evidência;
- rollback/compatibilidade estiverem documentados;
- o responsável autorizar a abertura do PR para `main`.

---

# Parte B — Checklist Mestre versionado

# MarkMap — Checklist Mestre de Execução

> Espelho versionado do **Checklist Mestre do Notion**.
>
> Notion: https://app.notion.com/p/3ed8e0bd0f4d81b6832bcf848c0ab504?pvs=204
>
> **Regra de sincronização:** qualquer mudança relevante de fase, arquitetura, bloqueio, evidência ou próximo passo deve atualizar, na mesma execução, este arquivo, o Checklist Mestre no Notion e `docs/handoff.md`. Não marcar item como concluído sem evidência.

**Snapshot:** 2026-10-07  
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

**Iniciativa Maps Engine v2 aberta em branch isolada.** O primeiro item livre para agentes desta trilha é **MM-MAP-000**.

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

---

# Parte C — Handoff de continuidade

# Handoff de continuidade

Atualizado em 2026-10-07.

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

## Maps Engine v2 offline — iniciativa isolada

- branch criada a partir de `main@156d4e8`: `feat/maps-engine-v2-offline`;
- PRD/Handoff executor: `docs/markmap-maps-engine-v2-prd-handoff.md`;
- não implementar esta iniciativa diretamente em `main`;
- PRs de agentes paralelos devem apontar para a branch de integração;
- primeiro Task ID livre: `MM-MAP-000`;
- sequência macro: baseline/licenças → atualização do app → storage/package v2 → OSM/formatos → busca/elevação → roteamento/voz → conteúdo/transporte → Android Auto/CarPlay → hardening/PR;
- MapLibre, Terra Draw, IndexedDB/outbox, Hono, Neon/PostGIS e Capacitor permanecem preservados;
- objetivo: maximizar uso offline seguro do dispositivo com storage adaptativo, workers, pacotes regionais, busca, routing, elevação e conteúdo local;
- Data Files `.mwm/.bin` do Organic Maps não devem ser redistribuídos;
- código GPL do `openstreetmap-website` não deve ser incorporado;
- `UpdatePrompt` existente será evoluído para popup explícito de nova versão com `Atualizar agora`/`Depois`, proteção de outbox e compatibilidade; builds Capacitor terão aviso próprio para abrir canal oficial de atualização;
- nenhuma implementação funcional desta trilha está marcada como concluída ainda; somente planejamento/branch/PRD foram criados.

## Bloqueios externos/release

- política pública de privacidade precisa de identidade/contato/retenção/provedores reais e revisão jurídica;
- API Hono/sync remoto de production ainda precisa ser publicada/configurada; o app continua operacional local-first sem depender disso;
- smoke production exige autorização;
- testes físicos/PWA instalada;
- signing/publicação mobile.

## Próximo item executável

Preparar/publicar o ambiente da API Hono de production e configurar `VITE_API_MODE=live`, `VITE_API_URL` e CORS, sem migration destrutiva. Smoke de sync real continua exigindo autorização explícita.

## Próximo passo de release

Obter os dados/autorizações externos acima e executar o preflight de `docs/release-runbook.md`.

## Rebranding MarkMap — 2026-10-05

- marca pública alterada de GeoNexo para **MarkMap — Planejamento Inteligente**;
- `apps/site` criado como site público React/Vite independente do app operacional;
- `apps/admin` recebeu identidade visual MarkMap preservando offline-first, GIS, sync e contratos existentes;
- PWA e Capacitor passam a exibir MarkMap;
- nome visível mobile passa a MarkMap; identificadores nativos existentes permanecem estáveis para preservar continuidade de instalação e dados locais;
- namespaces internos `@geonexo/*` e identificadores históricos de infraestrutura permanecem por compatibilidade até uma migração específica e validada;
- repositório GitHub renomeado para `mmatteuus/MarkMap`;
- PR #3 e PR #4 integrados em `main`.

## Refinamento frontend — 2026-10-05

- site: overlap footer/crédito MtsFerreira corrigido e tema protegido quando `localStorage` estiver indisponível;
- app: iconografia centralizada em `AppIcon`, consistência visual refinada e arquitetura offline-first/GIS/sync preservada;
- GitHub Actions do HEAD refinado encerraram antes dos steps; a baseline anterior permanece como evidência automatizada.

## Console/browser hardening — 2026-10-05

- `mobile-web-app-capable=yes`;
- conflito `aria-hidden` em elemento focável removido;
- filtros numéricos nullable do OpenFreeMap protegidos;
- fallback de sprites ausentes via `styleimagemissing`;
- nenhum prompt PWA forçado foi introduzido.

## Correção de menus — 2026-10-05

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
