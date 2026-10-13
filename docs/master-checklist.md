# MarkMap — Checklist Mestre de Execução

## A67 — GPS atual e consentimento local (2026-10-13)

**Diagnóstico:** permissão nativa/MapLibre já funcionavam, e Configurações gravava status GPS no `offlineDB`, mas o mapa começava em coordenadas fixas/centro da região sem consultar o consentimento. O botão GPS do mapa não persistia escolha.

**Correção:** `apps/admin/src/lib/location-consent.ts` centraliza a preferência `permissions:gps = {status:"granted",autoCenter:true}` na base IndexedDB existente, **sem coordenadas**. `device-location-permission.ts` verifica permissão efetiva (Permissions API/Capacitor) **sem solicitar popup** na abertura web. Com permissão vigente, o mapa obtém um fix novo de `navigator.geolocation` (`maximumAge:0`) e posiciona o mapa + marcador; interação da pessoa, GeoPDF/dataset/feições explícitas e limites de pacotes offline têm prioridade. Se GPS/DB/SO falhar, mantém o mapa funcionando sem mover para posição fictícia. GPS por botão e Configurações passam a persistir preferência após sucesso. Não houve migração remota, histórico GPS, nova dependência ou alteração do tema/instalação PWA.

**Evidências:** Vitest isolado **18/18 PASS** para GPS/IndexedDB/Capacitor; Playwright Chromium **4/4 PASS** (Windows e Android emulados, autorização concedida/ausente, recarga offline com Service Worker). Smoke extra confirmou marcador centralizado a 13,5 px do centro do mapa online e offline; salvo somente status/autoCenter. Build Vercel com código de GPS `6a85a5819bd849ffdedd7e323cb53c1a4b98e90a` **READY** (`dpl_5VV1Wvbjvb19Rf2aoobVKvaQwJJQ`). E2E versionado em `apps/admin/e2e/gps-auto-center.spec.ts`. A última execução do GitHub Actions continuou falhando antes dos steps; não confundir com falha dos testes. Testes em Android/Windows físicos ainda pendentes; o sistema pode conceder permissão "somente desta vez" ou revogar, algo que o IndexedDB não pode contornar.

**Fonte e rollback:** `docs/MM-GPS-A67-local-permission-autocenter.md`. Reverter commits A67 com `git revert` se necessário; nunca sobrescrever dados locais/outbox ou realizar deploy manual. Browser MTS proibido.


## A66 — propagação completa do tema (2026-10-13)

**Problema confirmado:** mesmo após A65 (contraste), menu lateral, cabeçalho, ferramentas do mapa, fallback do mapa, viewport 3D, tela de instalação e cor inicial da PWA forçavam tons escuros no tema claro. **Estado:** QUEBRADO/PARCIAL → CORRIGIDO no código `main@3cca284ad77106f92a092a4dfd38610f1d3bb380`.

**Correção mínima:** `main.css` mantém estilo escuro existente sob `.dark` e adota superfícies semânticas no claro; `RootLayout` e `TopNavBar` usam classes dinâmicas; `MeshStudioPage` e `MeshCanvas` atualizam painel e fundo WebGL no evento de tema sem remontar câmera/arquivo; `index.html` aplica tema salvo antes de carregar React, inclusive modo standalone. Mapa: só UI e fundo sem tiles são tematizados, preservando conteúdo cartográfico externo/offline. Fluxo de instalação, frontend, sincronização, dados, APIs e domínios não foram alterados.

**QA executado:** 4/4 testes estáticos em sandbox, sintaxe TSX validada; build `markmap-app` no SHA de código acima observado **READY** (`dpl_H8RULaWgXFLSfQbGzVMNYejq2mBh`). Playwright Chromium real contra produção verificou a alternância escuro→claro em **16 combinações de tela** (8 rotas × Windows e Android emulados), incluindo header/sidebar/conteúdo, mapa e malha; também conferiu tela de instalação separada em tema claro. Tudo conforme critérios verificados. **Não equivale à homologação em dispositivos físicos, nem cobre todos os estados condicionais ou estilos dos tiles GIS**. Adicionados `scripts/theme-surfaces.test.mjs`, E2E `apps/admin/e2e/theme-surfaces.spec.ts` e gate do CI para regressão. GitHub Actions ainda bloqueado por cobrança; E2E adicionados mas pipeline não executou.

**Rollback:** git revert normal do commit de código, sem reset/force push. Browser MTS proibido; validação usou Playwright em sandbox. Proteger a separação de origens site/app, versão e autoria definidos anteriormente.


## UI-Contrast — textos visíveis em ambos os temas (2026-10-13)

**Diagnóstico (QUEBRADO → CORRIGIDO):** rótulos claros sobre gradientes ciano no tema claro; azul primário sobre superfícies escuras; texto ciano na aba ativa Android; controles de mapa fixamente escuro herdando texto preto no tema claro; etiquetas de status e aviso da malha 3D. Não havia necessidade de trocar os temas.

**Mudança em main:** `46d60629f25f3941412258a56c3378cc95077e74`; `apps/admin/src/styles/main.css` separa tinta dos acentos de fundos via `--color-primary-ink` e `--color-secondary-ink`, corrige contraste do gradiente preservando o azul/ciano, escopa tokens do mapa escuro e ajusta a aba móvel. `MeshStudioPage.tsx` torna legível o aviso sobre viewport escura. Novos testes `scripts/theme-contrast.test.mjs` e gate no workflow CI. Frontend, SW, banco, IndexedDB e lógica de sync intactos.

**Evidências:** script de contraste Node **3/3 PASS** em sandbox Vercel; build `markmap-app` para commit `46d6062` estado **READY**. Auditoria Chromium com **32 combinações** (8 rotas × Windows/Android emulado × claro/escuro), **1.149 elementos de texto verificados, 0 violações detectadas** por teste computacional WCAG AA 4,5:1 para texto normal/3:1 para texto grande com amostragem de gradientes. Verificado também abrir formulário de Novo Projeto e alternar tema via botão em Windows/Android emulados. Limites: ferramenta automatizada não cobre todas as telas condicionais, imagens no mapa, fontes em aparelho físico ou diferenças entre WebViews. Usuário confere em Windows e Android reais.

**Pendente:** GitHub Actions ainda bloqueado por faturamento/limite; QA visual final nos dispositivos e estados condicionais. Sem deploy manual ou alteração de domínios/PWA. Browser MTS permanece proibido.


## UI-PWA — Aviso de atualização do MarkMap (2026-10-13)

**Estado:** `main@786bc850ecc61b6abf04538b7f393f9ae4e6abf3`. Popup `apps/admin/src/components/pwa/UpdatePrompt.tsx` redesenhado com tokens do tema azul/ciano, ícone do `AppIcon`, título destacado, texto explicativo, mensagem de falha clara e botões `Atualizar agora` / `Depois`. CSS responsivo em `apps/admin/src/styles/main.css` (safe-area, mobile acima da barra inferior e respeito a `prefers-reduced-motion`). **Não houve mudança na ativação do Service Worker**, handshake de compatibilidade, verificação de escrita durável, IndexedDB/outbox, API ou design do restante do app.

**Evidência:** testes do componente em ambiente isolado Vercel + React/jsdom/Vitest: **6/6 PASS**; build automático Vercel `markmap-app` para o commit exato `786bc85` = **READY** (`dpl_6e1TLDgz19W6BgknwihsyGLnuXEw`). Checagem visual do aviso em PWA instalada permanece **NÃO EXECUTADA** (o aviso só aparece com novo Service Worker aguardando ativação); não confundir testes de componente com homologação física. GitHub Actions permanece bloqueado por cobrança/limite de gastos.

**Regra de continuidade:** manter popup consistente com cores/tokens do MarkMap e sem ativação automática ou perda de alterações offline. Browser MTS foi expressamente vetado pelo responsável; **não utilizar** esse conector em QA futuro. Usar Playwright/TinyFish e testes automatizados quando aplicável, sem inventar resultados.


## A64 — fronteira permanente site/app, autoria e versão (2026-10-13)

**Decisão vigente:** `apps/site` (vitrine) e `apps/admin` (PWA operacional) ficam no mesmo monorepo, porém em **origens/subdomínios e deployments separados**. Endereços concretos pertencem às configurações, não à regra documental. Contrato obrigatório em `docs/site-app-boundaries.md` e `AGENTS.md`; referência adicionada ao `README.md` e índice `docs/README.md`. O botão do site segue para `?install=1` da origem do app; a autorização do navegador/standalone e IndexedDB permanecem exclusivos do app.

**Auditoria e correções:** a vitrine ainda trazia manifest instalável antigo, código de instalação morto, estilos sem uso e rewrites que serviam assets do app no endereço do site. Foram removidos o manifest e módulos obsoletos, os rewrites de assets/fonte/shell; substituído ícone dependente do app por SVG próprio do site. Redirecionamentos históricos `/app*` e SW de migração foram mantidos para evitar regressão em instalações antigas. Frontend operacional, contratos de sync, cache offline do app e estilo escolhido preservados.

**Assinatura/versão:** `apps/admin/src/lib/app-credits.ts` centraliza **Desenvolvido por MtsFerreira** e a versão real de `apps/admin/package.json` (atualmente `v0.2.0-dev.0`). O rodapé lateral `RootLayout` e o componente `AppFooter` mostram **Desenvolvido por MtsFerreira · v0.2.0-dev.0**; Settings já exibia versão. A interface publicada confirmou o texto no menu lateral em navegação real. A regra de comentários passa a documentar decisões/contratos; não se inseriram comentários artificiais em centenas de arquivos, e módulos legados grandes permanecem dívida técnica de refatoração incremental.

**Gates:** novo teste Node `scripts/pwa-product-boundaries.test.mjs`, teste JSX `apps/admin/src/test/app-credits.test.tsx` e etapa de verificação no CI. Execução desses testes **NÃO OCORREU** no GitHub Actions: job abortado antes de etapas por cobrança/limite da conta, confirmado na anotação do CI atual. Compilação+build automatizados Vercel: site código `1d83f7a` **READY**; app código/teste `c4b24b9` **READY**. Navegação publicada: site com CTA para origem dedicada, `/app/` antigo redirecionando corretamente, manifest antigo da vitrine HTTP 404, app mostrando versão ao lado da assinatura. Testes físicos/instalação real não executados.

**Próximo:** regularizar GitHub Actions para rodar as novas regressões, testar instalação standalone no dispositivo e refatorar módulos legados grandes sem tocar em design/funcionalidade comprovada. Não houve deploy manual, migration, release/tag ou force push.


## A63 — autorização nativa para instalar MarkMap (2026-10-13)

**Origem operacional:** `https://appmarkmap.mtsferreira.dev/`; o site permanece apenas vitrine em `https://markmap.mtsferreira.dev/`. **Fluxo implantado:** `?install=1` mostra tela dedicada de instalação, não monta workspace nem sincronizador; ao clicar em **Instalar aplicativo**, usa `BeforeInstallPromptEvent.prompt()` na mesma interação (navegadores que suportam). Aceite/cancelamento/erro tratados; `appinstalled` não é desfeito por `userChoice` tardio. Após autorização, página confirma o pedido e orienta abrir pelo ícone; PWA instalada mantém manifest `start_url=/`, `display=standalone`. Não existe API web confiável para forçar launch automático da janela instalada ou para apresentar prompt nativo em Safari/iOS; fallback oferece orientação manual. Visual do workspace, IndexedDB, SW offline, Neon e backend preservados.

**Evidências executadas:** Vitest isolado em sandbox Vercel Node/React/jsdom: **8/8 PASS** (4 testes originais/ampliados de ciclo de instalação + 4 UI). Vercel build automático do app no commit `fa0c6a7f75450df14a76d17f4adb1177581f7469` `READY` (`dpl_BRL9AWSq83E8Q7PUav1dUhW99T1r`). TinyFish renderizou `/?install=1` como tela exclusiva **Instalar MarkMap**, sem workspace, e `/` como aplicativo operacional. **Não é prova** de prompt nativo ou instalação física; testes físicos e CI GitHub completos permanecem pendentes. PRD: `docs/MM-PWA-A63-native-install-consent.md`. Rollback: `git revert` sem force push.


## A62 — PWA instalada abre o aplicativo operacional (2026-10-13)

**Incidente confirmado:** `https://markmap.mtsferreira.dev/app/` retornava HTTP 404 no teste HTTP renderizado TinyFish, enquanto `https://appmarkmap.mtsferreira.dev/` carregava a interface funcional de projetos. A vitrine instalava seu próprio manifest com `start_url=/app/` e identidade errada. **Correção na main:** CTA do marketing agora usa link direto para `https://appmarkmap.mtsferreira.dev/?install=1`; `apps/site` não registra novo SW nem vincula manifest instalável; suas rotas `/app*` redirecionam para a origem operacional; worker legado redireciona acessos de ícones antigos e descarta cache da vitrine, sem tocar IndexedDB. App `apps/admin` conserva manifest próprio, `start_url=/`, scope e service worker offline, e oferece ajuda de instalação. UI visual principal não modificada. Testes de contrato de site atualizados; **execução automatizada e deploy ainda a validar**. Usuários com ícone antigo instalado na origem de marketing devem reinstalar o app a partir da origem canônica para obter identidade PWA correta; não é possível transferir automaticamente a instalação entre origens. PRD `docs/MM-PWA-A62-canonical-install-origin.md`. Sem migração de dados/Neon ou alteração de domínio Vercel.


## A61 — impedir conflitos ressuscitados por push atrasado (2026-10-13)

**Estado final validado:** `main@96f753e78833aa836f24a983a4210a6dc9d79af2`; PRD `docs/MM-MAP-A61-late-push-conflict-after-resolution.md`. **QUEBRADO→CORRIGIDO:** `saveConflict` podia persistir respostas tardias para `operationId` excluído após ACK ou `resolveConflict`, reabrindo decisões antigas e podendo afetar operações sucessoras. Agora outbox/ACK/conflito são verificados na mesma transação, e entity/base precisam coincidir. **FUNCIONA:** conflitos atuais, versionamento monotônico, preservação de sucessores, operações offline e cursor sem alteração de contrato. **QA REAL:** 12/12 testes Node no sandbox isolado Vercel PASS após corrigir apenas uma comparação de arrays de realms distintos; 0 skips/falhas. Build automatizado `markmap-app` para o commit exato `96f753e`: **READY** (`dpl_7QetUTVfGmJw27KNaWcFtwdEBPWS`). Não representa suíte integral do monorepo nem teste de IndexedDB browser.

**Branches:** seis referências além de main ainda existem, todas com `ahead_by=0` contra main e totalmente ancestrais. Exclusão por conector ainda não disponível, não declarar limpeza concluída. **Gates release:** GitHub Actions bloqueado por cobrança/limite; navegador offline instalado/duas instalações/Neon integrado/Android-iOS físicos, signing e privacidade pública ainda pendentes. Nenhum deploy manual, release, migration ou force push.


## Consolidação de código para main — QA limitado (2026-10-13)

**Base:** `dev/markmap-pwa-v2` sobre `main@156d4e8`, cinco branches históricas comprovadamente ancestrais, PR #5 integrado em `main@224a2bfd1f06062e0a040585df434929ee7d2054` (2026-10-13). O frontend escolhido foi mantido; React/Vite, MapLibre/Terra Draw, IndexedDB/outbox, Hono/Neon/PostGIS e Capacitor não foram substituídos.

**FUNCIONA no código (não homologado em execução):** rotas SPA definidas em `apps/admin/src/router.tsx`; Service Worker agora limita interceptação a essas rotas (inclusive `/mesh` e montagem `/app`) e serve shell em queda de rede sem persistir documentos de navegação. **CORRIGIDO:** `apps/admin/public/sw.js`. Novos testes Node em `apps/admin/scripts/sw-navigation-cache.test.mjs`, novo gate `pwa-smoke` em `ci.yml`; testes Vitest antigos de `UpdatePrompt` realinhados com handshake de compatibilidade e scope. Nenhuma mudança de layout ou contratos de sync/backend.

**PARCIAL / NÃO HOMOLOGADO:** 5 workflows GitHub Actions (CI, Build, E2E, PostGIS Integration, Quality and Security) foram disparados no PR #5, porém o GitHub exibiu **"The job was not started because recent account payments have failed or your spending limit needs to be increased"**. Os jobs falharam antes de executar passos, inclusive o smoke Node. Nenhum resultado vermelho representa teste de código executado; nenhum gate recebeu PASS nesta rodada. Container disponível não consegue resolver `github.com` para clonar repositório privado.

**LIMPEZA DE REFS PENDENTE:** as seis branches adicionais ainda existem, todas integradas historicamente; exclusão segura não disponível no conector. **PENDENTE para distribuição:** corrigir cobrança/limite do GitHub Actions e reexecutar gates completos; PWA instalada/navegador real, Android/iOS físico e duas instalações, Hono/Neon integrado remoto, signing/provisioning, política de privacidade pública aprovada e URL/domínio final. Não houve deploy, tag/release, migration nem publicação. **Código integrado em main não homologa distribuição.**


## A60 — ignorar upserts históricos anteriores à base conhecida (2026-10-13)
- [x] **A60 REPRODUZIDA/CORRIGIDA:** upsert histórico `change.version <= pending.baseVersion` não cria falso conflito; ACK exato, predecessor e conflito de versão realmente superior continuam válidos. Antes 5/10 FAIL, depois 10/10 PASS. Commit `3deef67` [skip ci], PRD `docs/MM-MAP-A60-stale-upsert-pull-guard.md`.

## A59 — conflitos monotônicos também no saveConflict do push (2026-10-13)
- [x] **A59 REPRODUZIDA/CORRIGIDA:** `saveConflict` não rebaixa versão durável por resposta atrasada de push (v5 para v3/v0), mantém payload antigo contra replay de mesma versão; transação local e outbox preservadas. Antes 4/10 FAIL, depois 10/10 PASS. Commit `f8420bb` [skip ci], PRD `docs/MM-MAP-A59-monotonic-push-conflict-receipts.md`.

## A58 — tombstones ambíguos sem ACK inferido (2026-10-13)
- [x] **A58 REPRODUZIDA/CORRIGIDA:** tombstone sem operationId, exatamente `baseVersion+1` de `delete` pendente, não gera ACK falso nem conflito precoce; preserva outbox para push autoritativo. Tombstone obsoleto `<=baseVersion` não trava operação; tombstone efetivamente nova conflita. Antes 5/10 FAIL, depois 10/10 PASS. Commit `40cf7ce` [skip ci], PRD `docs/MM-MAP-A58-pending-tombstone-authoritative-ack.md`.
- [x] **QA LOCAL CONSOLIDADO, SEM GitHub CI:** A58 55/55 PASS 2 rodadas, A59 65/65 PASS, A60 **75/75 PASS em 3 execuções** do recorte A53–A60, TS strict isolado com stubs PASS, `node --check` PASS; hashes fonte final/testes GitHub iguais aos validados.
- [ ] **GATE A38/RC NÃO APROVADO:** full lint/typecheck/build/Vitest/Playwright monorepo, Postgres/Neon/Hono real, browser IndexedDB/PWA instalada, Android/iOS físico e 2 instalações, política e signing pendentes. **Não bloqueia próximas fases de código.**
- [x] **GOVERNANÇA:** nenhuma GitHub Actions/CI remoto, merge main, deploy Vercel, alteração Neon/produção/migration, force push, secrets, tags/releases/lojas ou exclusões.
- [ ] **A61 LIVRE:** auditar encadeamento de operações locais e resolução após ACK tardio; corrigir só regressão reproduzida.

## A57 — versões monotônicas dos conflitos no pull (2026-10-13)
- [x] **BUG REPRODUZIDO:** exclusão v2 podia sobrescrever conflito de upsert remoto mais novo v3 (mesma página ou próxima); `use-server` podia marcar como deletada uma recriação remota.
- [x] **A57 CORRIGIDA:** conflito por operationId só avança em serverVersion, em transação local; versões inferiores/iguais não substituem. Tombstone realmente mais nova substitui upsert, sem apagar outbox.
- [x] **QA REAL LOCAL SEM CI:** baseline 3/7 falhas, após patch **10/10 novos PASS** e **45/45 testes Node A53–A57 PASS em três rodadas**, TS strict isolado com stubs e `node --check` PASS; SHA dos 3 arquivos versionados iguais aos testados. Commit `df45018` [skip ci]. PRD `docs/MM-MAP-A57-monotonic-pull-conflicts.md`.
- [ ] **RC A38 NÃO HOMOLOGADO:** full lint/typecheck/build/Vitest/Playwright, IndexedDB real multiabas, Hono/Neon/PostGIS integrados, 2 instalações e Android/iOS físicos, privacidade/signing. Não bloquear código por testes físicos.
- [x] **GOVERNANÇA:** `dev/markmap-pwa-v2` apenas; main/produção, Neon, CI remoto, deploy e releases intocados.
- [ ] **A58 LIVRE:** auditar conciliação de tombstones de operações locais pendentes (contrato sem operationId), reproduzir antes de qualquer mudança.

## A56 — conflitos válidos para predecessor inválido e entidade ausente (2026-10-12)
- [x] **BUG REPRODUZIDO:** predecessor inválido ou versão explícita positiva sobre entidade ausente retornava `VERSION_CONFLICT` com `serverVersion:0`, envelope recusado por `syncConflictSchema`.
- [x] **CORRIGIDO SEM MUDAR CONTRATO:** sem versão remota retorna `SCOPE_REJECTED` versão 0 e nenhum serverPayload; com versão positiva continua `VERSION_CONFLICT`; mantém idempotência, isolamento, tombstones e reativação por predecessor válido.
- [x] **QA LOCAL SEM GitHub CI:** baseline 3/8 FAIL; após 8/8 A56 PASS, 11/11 A55 PASS, **35/35 backend A53–A56 PASS em três execuções**. `node --check` PASS e TS strict isolado/stubs PASS; SHA código `ef0082d`, teste `fadbc67` e PRD `6c7ee59` conferidos no GitHub. Commit `8435d0d` [skip ci]. Não reexecutou 257/257 histórico do monorepo.
- [ ] **A38/RC NÃO HOMOLOGADO:** build/lint/typecheck/Vitest/Playwright integrais, Postgres/PostGIS/Neon real, navegador IndexedDB, Android/iOS físicos, dois dispositivos, privacidade e signing pendentes; **desenvolvimento liberado**.
- [x] **GOVERNANÇA:** sem GitHub Actions remoto, merge main, deploy Vercel, Neon/migration, secrets, tag/release, force push, lojas ou operações destrutivas.
- [ ] **A57 LIVRE:** auditar consistência de tombstones/pull e contrato de API com bugs reproduzidos; preservar stack offline-first.

## A55 — bloqueio de sobrescrita por baseVersion nula (2026-10-12)
- [x] **A55 BUG REPRODUZIDO/CORRIGIDO:** `baseVersion:null` permitia overwrite/delete cego da versão remota, inclusive quando outra instalação já havia criado registro. Agora só aceita como criação sem versão anterior (versão 0); retorna `VERSION_CONFLICT` em versão remota positiva **antes de qualquer escrita**.
- [x] **COMPATIBILIDADE PRESERVADA:** versão explícita atualiza/deleta, predecessor confirmado encadeia, replay exato retorna `already_applied`, workspace isolado, outbox e dados locais não descartados. Risco documentado: cliente legado sem versão passa a precisar resolver conflito.
- [x] **QA LOCAL EXECUTADO SEM CI:** baseline 3/9 falhas; 11/11 regressões A55 PASS; **27/27 testes Node backend A53+A54+A55 em três rodadas**, TS `strict` isolado com stubs e `node --check` PASS. SHA dos 2 arquivos versionados comparados com os testados. `257/257` da A54 são resultado histórico, não reexecutado agora. PRD `docs/MM-MAP-A55-null-base-guard.md`, commits `cf61e2a`/`8221e91`/`eca3dfe`, [skip ci].
- [ ] **A38/RC NÃO HOMOLOGADO:** monorepo full lint/typecheck/build/Vitest/Playwright, banco Neon/PostGIS/Hono real, duas instalações em navegador/aparelho, WebView Android/iOS, política e signing. **Não travar novas fases por homologação física.**
- [x] **GIT/SEGURANÇA:** `main`, produção, Neo/PostGIS, schema, deploy e secrets intactos; nenhum GitHub Actions, migration, tag/release, force push, loja ou exclusão.
- [ ] **A56 LIVRE:** auditar replays de predecessor inválido e tombstones; implementar somente com evidência e QA.

## A54 — rejeição atômica de IDs duplicados por lote no backend (2026-10-12)
- [x] **A54 QUEBRADO→CORRIGIDO:** `/sync/push` podia aplicar um prefixo do lote antes de perceber operationId duplicado. Agora verifica todos os IDs após Zod e responde `400 VALIDATION_ERROR` antes de qualquer chamada à camada DB.
- [x] **PRESERVADO:** lote único retorna ACKs na ordem, replay do ID numa requisição **posterior** segue idempotente, conflitos continuam explícitos, lote vazio não escreve, outbox local nunca é descartada.
- [x] **QA LOCAL, SEM CI:** 3/7 regressões falharam no baseline; após patch 7/7 PASS e `node --test scripts/*.test.mjs` **257/257 PASS, 3 rodadas**; TS estrito isolado/stubs e `node --check` PASS. Hash do código/teste versionado verificado. Branch `dev/markmap-pwa-v2@967fe5d` [skip ci]; PRD `docs/MM-MAP-A54-sync-batch-idempotency.md`.
- [ ] **A38/RELEASE NÃO HOMOLOGADO:** full lint/typecheck/build/Vitest/Playwright, Hono/Postgres/Neon reais, browser IndexedDB, Android/iOS, sync 2 dispositivos, privacidade e signing pendentes; **não impedem próximas fases de desenvolvimento**.
- [x] **GIT/SEGURANÇA:** nenhum GitHub Actions/CI remoto, merge main, Vercel, Neon/migration, secrets, tag/release, force push, lojas ou operação destrutiva.
- [ ] **PRÓXIMO LIVRE A55:** auditar `baseVersion:null` do backend sob concorrência e avaliar risco de sobrescrita, com contrato e reprodução antes de qualquer mudança.

## A53 — integridade do provisionamento workspace (2026-10-12)
- [x] **A53 BUG REPRODUZIDO (mock SQLSTATE):** `workspaces.id` tem unicidade independente; `ON CONFLICT(proof_digest)` não captura colisão de ID com outra prova, causando `23505` e HTTP 500 na rota em vez de 409.
- [x] **CORRIGIDO:** query classifica `23505` (inclusive `DrizzleQueryError.cause`), preserva detalhes SQL fora do cliente; erros DB não únicos não são mascarados. Nenhuma alteração de schema, migrations, API ou dados offline.
- [x] **QA SEM GITHUB CI:** baseline 4/9 falhando, após 9/9 PASS; **250/250 testes Node PASS duas rodadas**; `node --check` e typecheck TS estrito isolado (stubs Drizzle e sync/PWA) PASS. Blobs SHA GitHub iguais às versões testadas. Commits `b28ae4c`, `0a042c0` [skip ci], PRD `docs/MM-MAP-A53-workspace-binding-409.md`.
- [ ] **A38/RC PENDENTE:** Neon/Postgres e Hono reais, full lint/typecheck/build/Vitest/Playwright, browser IndexedDB, Android/iOS, duas instalações, privacidade e assinatura NÃO EXECUTADOS. **Desenvolvimento continua.**
- [x] **GOVERNANÇA:** somente `dev/markmap-pwa-v2`; sem CI GitHub, main, deploy, alterações Neon, migrações, segredos, tags, releases, publicação ou exclusão de dados.

## A52 — cursor assinado após renovação de capability (2026-10-12)
- [x] **A52 CORRIGIDA:** cursor antigo assinado com capability anterior provocava HTTP 400 após renovação. Transação `saveWorkspaceCapability` invalida apenas `syncCursor` junto com bearer novo; não apaga dados/outbox, não regride generation.
- [x] **RETOMADA SEGURA:** `pull` detecta mudança concorrente de cursor (incluindo rotação enquanto a chamada está em voo), repete com cursor persistido; erro 400 genuinamente inválido continua falhando fechado, sem reset arbitrário.
- [x] **QA LOCAL SEM CI:** baseline 3/6 falhas; após patch 6/6 direcionados PASS e **241/241 testes Node PASS em 3 rodadas**, `node --check` PASS, TS strict isolado com stubs de sync/PWA PASS; hashes SHA dos 4 arquivos versionados iguais aos testados. Commits `81389eb` e `af8cd02` [skip ci].
- [ ] **GATE A38/RC PENDENTE:** lint/typecheck/build/Vitest/Playwright monorepo, navegador IndexedDB real, Hono/PostGIS integrado, Android/iOS físicos, 2 instalações, privacidade e signing ainda não executados. Não declarar release pronto; **desenvolvimento liberado**.
- [x] **GOVERNANÇA:** branch `dev/markmap-pwa-v2`, `main` e produção intactas; sem GitHub Actions/CI, deploy, Neon/migrations, secrets, tag/release, lojas, force push ou exclusões de dados. PRD `docs/MM-MAP-A52-signed-cursor-recovery.md`.

## A50–A51 — bearer entre abas e edições durante sync ativo (2026-10-12)
- [x] **A50 reproduzida/corrigida:** outro tab já rotacionou bearer? Após 401, `withCapability` lê token novo do IndexedDB, tenta uma vez e evita /workspace/recover desnecessário; se falhar 401 ou não existir, mantém recovery normal. Sem rebaixar generation.
- [x] **A51 reproduzida/corrigida:** edição local durante sync ativo não fica esperando 60 segundos: flag de nova rodada ao finalizar; múltiplos gatilhos são coalescidos; offline e unmount não disparam rede.
- [x] **QA local (nenhum CI remoto executado por nós):** antes A50 **3/4 falhas** e A51 **2/4 falhas**; depois 8/8 novos PASS; **235/235 Node PASS duas execuções**; `node --check` PASS; TS estrito isolado com stubs `tsconfig.qa.json`/`tsconfig.foreground.qa.json` PASS; SHA dos 4 arquivos GitHub corresponde ao testado. Commits `0c711de`/`6628c02`, [skip ci], branch `dev/markmap-pwa-v2`.
- [ ] **A38/RC HOMOLOGAÇÃO:** monorepo lint/typecheck/build/Vitest/Playwright completo, navegador real IndexedDB/PWA/MapLibre, dois dispositivos Android/iOS e política/assinatura permanecem não executados. Não promover release; desenvolvimento contínuo.
- [x] **Sem alterações de produção:** main, Neon, migrations, deploy, releases, secrets, lojas, force push e operações destrutivas intocados. PRD `docs/MM-MAP-A50-A51-sync-concurrency.md`.

## A48–A49 — identidade de instalação e credenciais de sync atômicas (2026-10-12)
- [x] **A48 REPRODUZIDA/CORRIGIDA:** `installationId` e `workspaceBootstrapProof` antes eram lidos/gravados separados; duas abas podiam enviar provas diferentes e uma receber 409. Agora único par gerado/persistido atomicamente sob `readwrite`; valores existentes permanecem estáveis.
- [x] **A49 CORRIGIDA:** resposta HTTP tardia não regride bearer/generation; valida workspace e grava somente quando a versão não é inferior, com compare-and-set transacional.
- [x] **QA REAL LOCAL, SEM GitHub CI:** 9/9 novas regressões e **227/227 Node PASS**, reconferência após commits com cinco blobs SHA idênticos; TypeScript estrito isolado com stubs (sync e PWA/IDB) e JS check PASS. HEAD `dev/markmap-pwa-v2@3cf57b3`; PRD `docs/MM-MAP-A48-A49-atomic-bootstrap.md`.
- [ ] **GATE A38/RC AINDA BLOQUEADO:** full monorepo lint/typecheck/build/Vitest/Playwright, browser IndexedDB real multiabas, Android/iOS físicos, duas instalações, privacidade/signing; não marcar homologado nem bloquear próxima fase de implementação.
- [x] **GOVERNANÇA:** apenas branch dev e commits `[skip ci]`, sem Github Actions, merge main, Vercel, Neon, migração, segredos, release/tag, force push ou publicação.

## A46–A47 — transações recuperáveis e retorno da PWA (2026-10-12)
- [x] **A46 REPRODUZIDO/CORRIGIDO:** `InvalidStateError` na criação da transação por conexão fechada sem `versionchange` permanecia cacheado. Cache invalidado somente para esse handle, nova tentativa reabre banco e mantém workspace/dados; callback de gravação não é reexecutado silenciosamente.
- [x] **A47 REPRODUZIDO/CORRIGIDO:** retorno por `pageshow.persisted`/foco visível agora dispara sync, mas não ao estar hidden/offline; `result.conflicts>0` invalida consultas React; listeners removidos no unmount.
- [x] **QA REAL LOCAL SEM CI:** baseline 6/10 falharam; depois **10/10 novos PASS + 218/218 testes Node PASS duas vezes**; `tsc --strict --noEmit` isolado com stubs e `node --check` PASS; hashes de 5 arquivos confirmados no GitHub. Branch `dev/markmap-pwa-v2`, commits `7261c8d`/`ebea8de` `[skip ci]`; PRD `docs/MM-MAP-A46-A47-offline-resume.md`.
- [ ] **RELEASE A38/MM-MAP-940 ainda NÃO HOMOLOGADO:** full monorepo lint/typecheck/build/Vitest/Playwright, browser IndexedDB/BFCache, Android/iOS, 2 instalações e política/signing. Não travar próximas fases de código por esses testes físicos.
- [x] **GOVERNANÇA:** sem GitHub Actions, merge main, deploy, Neon/PostGIS/migration, secrets, força push, release/tag ou publicação.


## A45 — recuperação de IndexedDB após falha/suspensão (2026-10-12)
- [x] **BUG REPRODUZIDO:** 5/6 regressões falharam no HEAD A44: falha transitória de `indexedDB.open`, exceção ao criar transação de workspace, `versionchange` com conexão fechada cacheada, `close()` após rejeição e `onblocked` seguido de abertura tardia.
- [x] **CORRIGIDO sem migrations:** cache `dbPromise` e `workspacePromise` invalidado em erro/versão; conexão tardia bloqueada fechada; `close()` não cria `unhandledRejection`; mantém ID workspace e outbox. Não envia dados nem toca nas entidades por recuperação.
- [x] **QA realmente executado:** alvo 6/6 PASS, `node --test scripts/*.test.mjs` **208/208 PASS em três execuções**; `node --check` e `tsc --strict --noEmit` isolado de local-db e sync (stubs) PASS. Blobs code/tests do GitHub batem com QA. Novo `scripts/local-db-reopen.test.mjs`; PRD `docs/MM-MAP-A45-idb-recovery.md`; branch dev commit `a839446` [skip ci].
- [ ] **HOMOLOGAÇÃO A38/Release:** lint/typecheck/build/Vitest/Playwright monorepo, IndexedDB/Capacitor real, Android/iOS físico, duas instalações e política/signing NÃO EXECUTADOS, portanto release BLOQUEADO. Não bloquear desenvolvimento por QA física.
- [x] **GOVERNANÇA:** sem GitHub Actions, merge main, deploy Vercel, Neon/migrations, secrets, force push, tag/release, lojas, exclusão de dados.

## A44 — CAS do cursor pull entre abas (2026-10-12)
- [x] **BUG REPRODUZIDO:** duas abas em paralelo podiam escrever cursores remotos fora de ordem: aba atrasada sobrescrevia um `syncCursor` já avançado, causando replays/requisições desnecessárias.
- [x] **CORREÇÃO ATÔMICA:** `LocalRepository.applyServerPage` compara `expectedCursor` com `meta.syncCursor` na mesma transação IndexedDB `readwrite` ANTES de inserir entidades/ACKs/tombstones. `sync-engine.pull` envia cursor utilizado na requisição; chamada legada com três argumentos segue compatível. Não alterar schemas, dados, backend ou outbox.
- [x] **QA sem GitHub CI:** caso novo 3/5 falhando antes do patch. Após: 5/5 PASS e **202/202 testes Node em três execuções**, mais **202/202 PASS** no HEAD conferido via hashes GitHub. `node --check` PASS, `tsc --strict --noEmit` isolado com stubs PASS.
- [x] **GIT:** `dev/markmap-pwa-v2`, commits `70789d3` e `0f97e29` [skip ci]. PRD `docs/MM-MAP-A44-sync-cursor-cas.md`. Sem GitHub Actions, merge main, Vercel deploy, Neon, migration, publicação, tag/release ou remoções.
- [ ] **GATE A38 BLOQUEADO SOMENTE PARA RELEASE:** full lint/typecheck/build/Vitest/Playwright, navegador IndexedDB multiabas real, Android/iOS físicos, dois dispositivos e privacidade/signing pendentes. Não interromper desenvolvimento seguinte.

## A41–A43 — timeout integral, ACK durável e QA determinística (2026-10-12)
**Base:** `dev/markmap-pwa-v2@16906cd` verificada com Notion, HEAD e PRs/issues 0; mudança em dois commits `79968dc` e `b7ac5c5`, sempre `[skip ci]`.
- [x] **A41 — QUEBRADO → CORRIGIDO:** timeout HTTP de 15 s encerrava depois dos headers, deixando body lento prender a promessa única `syncNow`. O timeout agora abrange `fetch` + `response.text()` + parse. Respostas HTTP não OK não aguardam/parseiam body; refresh 401 continua funcionando.
- [x] **A42 — QUEBRADO → CORRIGIDO:** retorno `false`/`undefined` do `LocalRepository.acknowledge` era contado como push aceito. Agora somente `true` confirmado gera `pushed`; falha preserva outbox, resultado de erro e possibilidade de retry. Mock Vitest passa a refletir contrato booleano.
- [x] **A43 — PARCIAL → QA ESTÁVEL:** testes A34 de Worker/React tinham esperas fixas 20/35 ms e falhavam esporadicamente durante execução paralela. Esperam condição observável com deadline 3 s, sem sleeps arbitrários.
- [x] **QA sem CI remoto:** baseline novo 4/7 falhando; após patch **197/197 Node PASS em 3 execuções consecutivas** e nova repetição do código recuperado do GitHub **197/197 PASS**. TypeScript sync `tsc --strict --noEmit` isolado com stubs PASS; hashes de blobs confirmados no GitHub.
- [ ] **Dívida de homologação não bloqueante ao desenvolvimento:** monorepo full lint/typecheck/build/Vitest/Playwright e WebGL/IndexedDB reais, Android/iOS físico e sync 2 instalações continuam NÃO EXECUTADOS. A38/Release Candidate não aprovado.
- [x] **Governança:** `main`, produção, Neon, migrations, CI GitHub, Vercel, secrets, releases, tags e lojas intocados. PRD `docs/MM-MAP-A41-A43-sync-durability.md`.

## A39/A40 — sync pull e progresso parcial (2026-10-11)
- [x] **A39 código:** cursor repetido ou cíclico com `hasMore=true` causa erro seguro ANTES de reaplicar página; página final com cursor inalterado é válida; limite de 50 páginas mantido.
- [x] **A40 código:** ACKs/conflitos e páginas remotas já persistidas contam no resultado mesmo se outra página falhar; `SyncController` pode invalidar consultas sem dizer `synced`.
- [x] **QA real local sem GitHub Actions:** 3/6 regressões novas inicialmente falharam no código antigo (reprodução), após a correção 8/8 novos PASS e regressão `node --test scripts/*.test.mjs` **189/189 PASS**, `node --check` e TypeScript isolado com stubs PASS. HEAD de código `a9eae4c1834bc25367b5ffdc6927d2ab26eb3884`.
- [ ] **HOMOLOGAÇÃO NÃO BLOQUEANTE PARA CODAR:** full lint/typecheck/build/Vitest/Playwright, browser WebGL/IndexedDB/PMTiles, devices Android/iOS, 2 instalações reais, privacidade final/segurança e gate RC ainda pendentes. Não declarar PASS sem execução.
- [x] **Governança:** `dev/markmap-pwa-v2`, `[skip ci]`; sem CI remoto, deploy, `main`, Neon, migrations, tag/release, secret, force push ou remoções. PRD `docs/MM-MAP-A39-A40-sync-resilience.md`.


## A35–A38 — hardening nativo e sincronização (2026-10-11)
- [x] **A35 código:** script Android identifica permissões realmente declaradas (não comentários/atributos não relacionados), recusa manifesto incompleto e permanece idempotente.
- [x] **A36 código:** script iOS agora persiste correções em chaves existentes, evita duplicação/chaves inválidas e utiliza o nome MarkMap. `Info.plist` nativo atual permaneceu byte a byte inalterado e foi validado com `plistlib`.
- [x] **A37 código:** motor de push só aceita receipts dos IDs enviados uma única vez, interrompe falta de progresso e não anuncia `synced` com outbox ainda pendente; preserva conflitos para resolução explícita.
- [x] **QA local sem CI:** HEAD do código e dos testes relido do GitHub, SHA conferido. Node v22.16.0 `node --test scripts/*.test.mjs` **181/181 PASS**, 17 regressões novas. `tsc --strict --noEmit` do motor de sync com contratos stub isolados PASS. 1 teste de falsa sincronização falhou no código anterior e passou após correção.
- [ ] **A35 Android real:** APK instalado, GPS, GeoPDF, offline/cold start, background, RAM/energia e permissões em aparelhos não executados (ADB/SDK ausentes).
- [ ] **A36 iOS real:** Xcode/macOS/iPhone, armazenamento e localização no WebView, force stop e reinstalação offline não executados.
- [ ] **A37 dois dispositivos reais:** sync/workspace, conflito e recuperação em duas instalações/contas físicas ainda pendentes; mocks locais NÃO homologam integração real.
- [ ] **A38 e RC:** lint/typecheck/build/Vitest/Playwright monorepo, integração PostGIS/Neon autorizada, privacidade pública aprovada (`docs/privacy.md` lista 10 itens abertos), revisão final de segurança, signing, domínio e publicações pendentes. **Release Candidate NÃO APROVADO.**
- [x] **Governança:** somente `dev/markmap-pwa-v2`, commits `[skip ci]`; nenhum GitHub Actions disparado, sem merge main, deploy, Neon, migração, tag/release, publicação ou operação destrutiva.


## A34 — leitores offline presos à geração ativa (2026-10-11)
- [x] **CÓDIGO:** busca regional, roteamento Worker, Wikipedia/transporte e DEM passam a vincular manifest e Blob por `getActiveRevision` + `assetAtRevision`. Revalidam a geração antes de publicar resultados e recusam mistura após atualização concorrente.
- [x] **SEGURANÇA:** erros inesperados de IndexedDB/JSON/engine não exibem URL, path ou token na UI regional. Mensagens conhecidas de recuperação permanecem úteis.
- [x] **QA LOCAL, SEM CI:** Node 22.16.0 `node --test scripts/*.test.mjs`: **164/164 PASS** (150 anteriores +14 novos). Testes reproduziram falhas antes da correção, cobrem atualização entre leituras, dados antigos e vazamentos. `tsc --strict --noEmit` com stubs isolados de quatro módulos: **4/4 PASS**; parsing TSX de CommandCenterPage: PASS. Código/testes versionados até `3e11fb7`.
- [ ] **GATE INTEGRAL BLOQUEADO:** sem checkout/dependências por DNS; lint, typecheck, build, Vitest, Playwright monorepo e IndexedDB/MapLibre/PMTiles/WebGL verdadeiros não executados. Chromium local recusa navegação com `ERR_BLOCKED_BY_ADMINISTRATOR` e about:blank nega IndexedDB.
- [ ] **A35–A38:** Android/iOS físico, PWA instalada, sync entre duas instalações, política de privacidade/assinatura e RC continuam pendentes. Não marcar homologação.
- [x] **GOVERNANÇA:** commits somente em `dev/markmap-pwa-v2` com `[skip ci]`, **nenhum GitHub Actions/CI utilizado**, main, Neon, Vercel, migrations e releases intocados.

## A32/A33 — auditoria e mensagens seguras no worker de rotas (2026-10-11)
- [x] A32 Node: 144/144 testes versionados no HEAD original; ciclo MapLibre, leases e worker auditados no código.
- [x] A33: erro bruto no worker reproduzido com token; alterado para allowlist de mensagens conhecidas e resposta genérica. Após a correção: 150/150 testes Node PASS (6 novos), declaração TypeScript e parsing sintático PASS.
- [ ] A32/A34: monorepo lint/typecheck/build/Vitest/Playwright e WebGL/PMTiles/IndexedDB reais pendentes por ausência de checkout, dependências e DNS npm/GitHub.
- [ ] A35–A38: Android/iOS físico, PWA instalada, dois dispositivos, política de privacidade e RC pendentes. Nenhuma homologação de release.
- [ ] Sem alterar main, Neon, migrations, deploy, CI remoto, tags, lojas ou dados locais.

## A30/A31 — fonte cartográfica pronta e aviso WebGL sincronizados (2026-10-10)

- [x] **A30 CÓDIGO:** consultar existência e estado `Map.isSourceLoaded('local-dataset')` da fonte atual após hidratação; aceitar fonte pronta sem novo `sourcedata`, sem polling nem requisição remota.
- [x] **A30 CÓDIGO:** recusar evento antigo se fonte atual não carregou e revalidar antes do frame renderizado; fontes ausentes/troca com erro não provocam readiness falso; compatibilidade com adapters legados.
- [x] **A31 CÓDIGO:** no paint recuperado, limpar somente mensagem temporária de contexto WebGL; preservar falhas reais e deixar recurso inválido substituir aviso antigo; retry e fundo simples mantidos.
- [x] **QA NODE EXECUTADA:** `node --test scripts/*.test.mjs` **147/147 PASS** no recorte A10–A31 após restaurar downloader exato do HEAD; `node --check`, `tsc --strict --noEmit` isolado e TSX syntax PASS. 14 novos testes versionados.
- [ ] **HOMOLOGAÇÃO PENDENTE, NÃO BLOQUEANTE PARA CONTINUAR CODANDO:** full pnpm lint/typecheck/test/build/Vitest, E2E/Playwright, MapLibre/PMTiles/IndexedDB reais, WebGL context lost/restored e Android/iOS físico. Nunca declarar gate de release aprovado sem execução.
- [ ] **PRÓXIMO:** inspecionar HEAD real para novos problemas de eventos de estilo/worker e resolver apenas lacunas reproduzíveis, sem reescrever fluxo funcional.
- [ ] **SEM PRODUÇÃO:** sem GitHub CI remoto, Vercel deploy, merge main, Neon/migration, tag/release/loja ou exclusões. PRD `docs/MM-MAP-A30-A31-source-readiness.md`.


## A28/A29 — estilo MapLibre e camadas locais recuperáveis (2026-10-10)

- [x] **A28 EM CÓDIGO:** eventos `style.load`/`sourcedata`/`render` coordenados por geração; um callback de paint por estilo, descarta renders atrasados após style swap, cancelamento e perda WebGL; não marca mapa antigo como pronto.
- [x] **A28 EM CÓDIGO:** mantém readiness para GeoJSON local carregado sincronamente; erro de hidratação não vira falso sucesso; após repetida restauração WebGL sem orçamento de remount, reidrata estilo vigente quando possível.
- [x] **A29 EM CÓDIGO:** reparar individualmente overlays dataset/GeoPDF/desenho/contornos/trânsito/rota sem duplicar fontes ou excluir dados de campo/IndexedDB/outbox.
- [x] **QA LOCAL REAL:** 93/93 testes Node versionados PASS (76 anteriores + 17 novos); 101/101 PASS incluindo harness legado local A22 com stub não versionado. `node --check`, `tsc --noEmit --strict` isolado de helper/declarations e parsing TSX PASS.
- [ ] **HOMOLOGAÇÃO NÃO BLOQUEANTE PARA CODAR:** lint/typecheck/build completo, Vitest/MapLibre/PMTiles/IndexedDB reais, Playwright, GPU/WebGL context-loss real, Android/iOS e medições.
- [ ] **PRÓXIMO CÓDIGO:** auditar estabilidade do worker/protocolo e gatilhos de `mapReady` em MapLibre real; corrigir somente lacunas comprovadas no HEAD.
- [ ] **SEM PUBLICAÇÃO/PRODUÇÃO:** nenhum CI remoto, deploy Vercel, merge main, Neon/migration, release/tag, exclusão ou force-push. PRD `docs/MM-MAP-A28-A29-style-hydration.md`.


## A26/A27 — cancelar I/O da view antiga e recuperar WebGL sem loops (2026-10-10)

- [x] **A26 EM CÓDIGO:** cada lease MapLibre rastreia seus requests e AbortControllers; release aborta leituras pendentes (PMTiles e assets), remove listeners e não afeta outros mapas. Requests atrasados continuam bloqueados; APIs existentes mantidas.
- [x] **A27 EM CÓDIGO:** eventos `webglcontextlost`/`webglcontextrestored` tratados com aviso, preventDefault e no máximo um remount automático por seleção/revisão; foregound não tenta retry enquanto WebGL está perdido. Teardown tolera falhas de remoção de marcador/mapa/GeoPDF e sempre libera lease.
- [x] **QA NODE DIRIGIDA:** **76/76 PASS** dos arquivos de teste versionados presentes no recorte A10–A27; com harness local A22 de parser TS sob stubs `pmtiles`, **84/84 PASS**. 13 testes A26/A27 novos versionados; `node --check`, declarations `tsc --strict --noEmit` e sintaxe TSX PASS.
- [ ] **HOMOLOGAÇÃO NÃO BLOQUEANTE PARA CÓDIGO:** testes reais de WebGL lost/restored, MapLibre e PMTiles/IndexedDB, Playwright/E2E, lint/typecheck/build monorepo, Android/iOS físico, RAM em aparelho. Não marcar gate de release como verde.
- [ ] **PRÓXIMO DESENVOLVIMENTO:** diagnosticar worker/protocol teardown após restaurações consecutivas e UX sem WebGL; avançar apenas onde existir lacuna comprovada no HEAD.
- [ ] **SEM AÇÕES DE PRODUÇÃO:** não executar CI GitHub, Vercel deploy, merge main, Neon/migration, tag/release, lojas ou exclusões. PRD `docs/MM-MAP-A26-A27-webgl-lifecycle.md`.


## A24/A25 — segurança do ciclo de protocolos MapLibre (2026-10-10)

- [x] **A24 EM CÓDIGO:** `pmtiles` e `geonexo-package` registrados globalmente com leases por montagem; URL de cada estilo/PMTiles/glyphs/sprites reescrita por alias exclusivo; nenhuma instância remove os protocolos de outra.
- [x] **A24 EM CÓDIGO:** requests antigos ou abortados falham sem acessar outra geração; rollback de registro parcial e release idempotente, com desregistro global só após último lease.
- [x] **A25 EM CÓDIGO:** `createMapLibreMap` envolve controles/listeners em rollback síncrono; falha pós-criação limpa WebGL e lease no `CommandCenterPage`, evitando retry preso a `mapRef`.
- [x] **QA NODE EXECUTADA:** 70/70 PASS (60 regressões do recorte anterior + 10 novos A24/A25), `node --check` dos novos helpers e `tsc --noEmit --strict` das declarations auxiliares PASS.
- [ ] **QA NÃO BLOQUEANTE PARA CODAR:** teste Vitest novo de estilo/alias escrito mas não executado, lint/typecheck/build integral, PMTiles/MapLibre reais em browser, E2E WebView/Capacitor e aparelhos físicos. Não declarar homologação.
- [ ] **PRÓXIMO CÓDIGO:** revisar eventos de perda WebGL e teardown de requisições concorrentes sem redesenhar a arquitetura.
- [ ] **SEM AUTORIZAÇÃO DE PRODUÇÃO:** não fazer CI GitHub, merge main, deploy Vercel, Neon/migration, tag/release/loja ou exclusões/force-push. PRD `docs/MM-MAP-A24-A25-protocol-lifecycle.md`.


## A22/A23 — integridade do protocolo e recuperação de erros locais (2026-10-10)

- [x] **A22 CÓDIGO:** validar intervalo PMTiles inteiro dentro de `File.size`, limite máximo 4 MiB, rejeitar bytes truncados; validar blobs do protocolo local e comprimento exato, sem alterar contratos.
- [x] **A22 CÓDIGO:** AbortSignal aplicado a resolver/leituras com remoção do listener em sucesso/erro/abort, códigos estáveis e mensagens legadas preservadas.
- [x] **A23 CÓDIGO:** `CommandCenterPage` mostra diagnóstico seguro/localizado por tipo de falha, evita expor URLs/tokens/paths e não transforma cancelamento normal em alerta. Botão retry e fundo neutro anteriores preservados.
- [x] **QA NODE DIRIGIDA:** 60/60 PASS no recorte local A10–A23 (42 regressões, 11 novos versionados, 7 smoke TS com stubs). TypeScript protocolo/declarations isolados e JS `node --check` PASS. Exigências legadas `too large` e `invalid offline package asset URL` testadas em stub.
- [ ] **QA NÃO BLOQUEANTE PARA DESENVOLVIMENTO:** executar novo teste Vitest real `packages/maps/tests/offline/offline-protocol-integrity.test.ts`, full monorepo lint/typecheck/build/E2E e navegação MapLibre/IndexedDB/WebView/Android/iOS em ambiente apto. Não marcar como PASS sem executar.
- [ ] **PRÓXIMA FASE DE CÓDIGO:** revisar remount de protocolos/recursos e perda de contexto gráfico, preservando local-first.
- [ ] **RELEASE/PRODUÇÃO NÃO AUTORIZADOS:** não houve CI, deploy, merge main, Neon/migration, tag/release/loja ou exclusões. PRD `docs/MM-MAP-A22-A23-protocol-recovery.md`.


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
