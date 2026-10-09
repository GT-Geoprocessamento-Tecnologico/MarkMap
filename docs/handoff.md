# Handoff de continuidade

> Documento mestre único da iniciativa Maps Engine v2: `docs/MARKMAP_MASTER.md`.
> Versão baseline em `main`: `0.1.0`. Linha de desenvolvimento ativa: `0.2.0-dev.0`.

Atualizado em 2026-10-08.

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

Na iniciativa Maps Engine v2, as fases M0→M10 estão concluídas em `feat/maps-engine-v2-offline` (docs, código de M3→M10 e suítes verdes); o próximo item executável é fechar as pendências do gate `MM-MAP-940` — evidência em aparelho físico, baseline de performance `MM-MAP-900` e revisão de diff — e só então abrir o PR para `main`. A ordem da iniciativa segue registrada em `docs/MARKMAP_MASTER.md`. O trabalho de API Hono production continua pendente em paralelo e não deve ser misturado nessa branch.

## Próximo passo de release

Para o main: obter os dados/autorizações externos acima e executar o preflight de `docs/release-runbook.md`. Para a iniciativa Maps Engine v2 offline, o próximo passo é concluir o planejamento (branch + PRD) e iniciar o MM-MAP-000.

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
