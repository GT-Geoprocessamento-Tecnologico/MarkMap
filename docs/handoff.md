# Handoff de continuidade

Atualizado em 2026-10-08.

## Estado atual

- Baseline funcional anterior validado: `cc2331d`.
- HEAD funcional do design integrado: `9b4fb391` (refino visual do site e aplicação operacional; documentação atualizada em seguida).
- Branch remota esperada: somente `main`.
- Arquitetura preservada: React/Vite/TypeScript + Hono + Neon/PostgreSQL/PostGIS + MapLibre + Terra Draw + IndexedDB/outbox.
- Experiência principal instalável: PWA.
- Capacitor permanece somente como empacotamento opcional.
- Nenhum deploy, release/tag, migration de production, publicação em loja ou rotação de secrets foi executado.

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
- site markmap.mtsferreira.dev publicado/validado;
- app appmarkmap.mtsferreira.dev publicado/configurado e validado por HTTPS.

## Próximo item executável sem ação externa

Não há P0 funcional automatizável conhecido aberto após esta consolidação no main. O próximo trabalho interno é manutenção/otimização não bloqueante (ex.: tamanho de bundle) ou correções que surgirem dos testes. Paralelamente, a iniciativa Maps Engine v2 offline (branch feat/maps-engine-v2-offline) tem seu primeiro item executável: MM-MAP-000 (ver seção abaixo).

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

- funcional HEAD da correção: `58cafb64`;
- adicionado `mobile-web-app-capable=yes` mantendo compatibilidade iOS;
- removido `aria-hidden` do link focável da marca no sidebar, eliminando o conflito de foco/a11y reportado pelo Chromium;
- filtros numéricos nullable dos shields do OpenFreeMap agora são protegidos antes do uso em tiles;
- imagens de sprite conhecidamente ausentes (`sports_centre`, `swimming_pool`, `gate`, `office`) recebem fallback transparente via `styleimagemissing`, sem quebrar o mapa;
- o código fonte atual não possui handler `beforeinstallprompt` que chame `preventDefault()`; esse aviso do Chromium não foi tratado adicionando prompt PWA, para preservar a direção de produto de não forçar instalação;
- GitHub Actions foram executadas e reexecutadas uma vez para este HEAD; os jobs continuam encerrando antes de qualquer step (steps vazios), portanto não há evidência de falha de código nem validação verde do HEAD atual.


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
2. E2E (Playwright) do fluxo offline — quando aplicável
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
- **Status (2026-10-08):** fases M0→M10 com docs entregues; código real de M3→M10 implementado em `packages/contracts`, `packages/maps`, `packages/geo`; suítes de teste novas verdes (lint/build/test 15/15). Sequência commitada em `5368bb8e`. MM-MAP-930 fechado (THIRD_PARTY + ADR-0004/0005/0006 + guides). Pendências restantes: E2E, evidência de dispositivo, baseline de performance, gate MM-MAP-940 antes de PR para `main`.
- Atualizado em 2026-10-08.