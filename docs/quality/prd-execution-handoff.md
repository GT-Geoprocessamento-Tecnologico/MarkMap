# GeoNexo PRD Execution Handoff

**Date:** 2026-09-30  
**PRD:** `PRD-GEONEXO-PWA-MOBILE-OFFLINE-GEOPDF-NEON.md`  
**Checkout:** `main`, `a80586a5f2e8aca8c21ff88a661e21e7f61c941e` (HEAD unchanged)  
**Result:** **NÃO PRONTO — os gates de produto abaixo continuam abertos.**

**Atualização 2026-09-30:** as especificações GeoPDF P1 e restante local-first/PWA passaram em revisão independente. `P1-GEO-API` passou revisão independente após corrigir o cap/validação da Neatline, o limite configurável, erros tipados e tipos canônicos; o PDF real de Araguaína declara EPSG:3857 e é rejeitado pelo allowlist P1 atual, sem inferir coordenadas incompatíveis. C1 confirmou que os tipos wire vêm de `@geonexo/contracts`. L6 passou revisão independente após reparar monotonicidade de acknowledgements e imutabilidade de blobs, com smoke Chromium de reload/outbox. W0 passou de forma limitada à fonte/licença, render temporário e validador estrutural; W1 passou revisão de código, mas cold-offline profundo e integração raiz seguem pendentes. D2 está em segundo reparo e aguarda revisão. Para W2, PMTiles 4.5.0 está pinado com integridade, notice BSD-3 e instalação congelada aprovada; implementação do pacote/protocolo está em andamento. `P1-PDF-RUNTIME` mantém pendente a atribuição do lockfile amplo porque ele já estava dirty sem snapshot anterior; por isso o worker PDF.js ainda está gated. O PRD permanece NÃO PRONTO até integração, sincronização local/Neon aprovada, cold offline, testes móveis e demais gates deste handoff passarem.

## 1. Auditoria inicial

| Área | Estado encontrado | O que faltava | Ação/evidência desta execução |
|---|---|---|---|
| PWA | Worker manual; sem precache completo dos assets Vite, sem update seguro; installability só parcialmente configurada | cold offline, update handshake, prova Android/iOS | Skill `pwa-executor` executada; review mantém FAIL/PENDING. E2E de páginas passa, mas cold offline e atualização continuam sem aceite. |
| Offline/local-first | IndexedDB genérico e fluxos GeoJSON/GLB locais; projetos/camadas/feições não usam um modelo local-first com outbox durável | CRUD GIS offline, outbox, cursor, conflito e reconexão | Nada apresentado como sync implementado. Source feasibility de basemap passou, sem instalador/protocolo no produto. |
| Sync | API existente para CRUD/paginação; nenhum workspace capability + sync push/pull completo | provisioning, isolamento, idempotência, tombstones, pull/cursor, resolução de conflitos | G0.2 fechou apenas contratos/design. Runtime e round-trip permanecem ausentes. |
| GeoPDF | Feasibility P0 passou para subconjunto ISO/OGC controlado; PDF.js worker renderizou amostras offline | GeoPDF real com georreferência utilizável, transformação LGIDict, calibração manual, integração do worker e limites de recursos | G0.3 PASS somente para viabilidade. Araguaína renderiza, mas declara EPSG:3857/Web Mercator com `/GPTS` em faixa de graus; o adapter rejeita `Unsupported CRS` e não posiciona automaticamente. Produto continua PENDING. |
| Mobile touch | Layout responsivo, safe areas, navegação e controles testados por emulação desktop | instalação, GPS/sensores e aceitação em dispositivos físicos | Navegação passou em viewports 320×568 a 1920×1080; hardware/instalação continuam NÃO TESTADOS. |
| Performance | Bundle grande e sem medições em dispositivos móveis | pan/pinch, long tasks, memória, listas/PDF pesados | Build mantém aviso de chunk >500 kB; performance móvel não medida. |
| Neon | Branch `production` sem schema de aplicação nem PostGIS/pgcrypto | migração aprovada, schema real, runtime com Neon isolado e round-trip | Metadata audit read-only completa. G0.4 remote BLOCKED/PENDING; nenhum write ou migration remoto. Local PostGIS descartável passou 16/16. |

Fontes detalhadas: [PWA review](pwa-executor-review.md), [GeoPDF feasibility](../maps/geopdf-feasibility.md), [Neon drift](../database/neon-schema-drift.md), [offline map source proof](../maps/offline-package-source.md), [frontend audit](2026-09-30-frontend-main-evidence.md).

## 2. Reuso de código e dados

| Repositório/fonte | Arquivo/função | Licença/proveniência | Código copiado/adaptado | Destino/alterações |
|---|---|---|---|---|
| MapLibre GL JS 6.11.2 já presente no projeto | `Map`, `setWorkerUrl`, `maplibre-gl-worker.mjs?worker&url` | BSD-3-Clause; dependência 6.11.2 já existente, sem alteração de versão | Não. Consumo da API oficial | `packages/maps/src/maplibre.ts`: URL do worker agora passa pelo pipeline Vite; build emite worker versionado. |
| Protomaps build `20260930.pmtiles` + OpenStreetMap | recorte HTTP range de Brasília/entorno, estilo, glyphs e sprites DPR 1/2 | dados ODbL 1.0/atribuição OSM; proveniência/licenças de estilo e assets registradas em `offline-package-source.md` | Nenhum código copiado. Archive/assets ficaram em diretório OS temp e não foram adicionados ao produto | prova temporária de 4,300,633 bytes; manifesto de 5,244,214 bytes; render MapLibre offline. |
| Mozilla PDF.js 6.3.289 | abertura/render de fixture gerada e amostra USGS | Apache-2.0, checado no metadata do pacote; pacote e canvas ficaram em temp | Nenhum código copiado ou instalado no workspace | prova de renderização somente; não comprova integração do produto ou worker de browser. |
| TacMap modelo local | `GeoPdfParser.kt`, `AffineTransform2D.swift`, `PDFTiler.swift` e `PdfTiler.kt` | MIT no `LICENSE`; árvores locais sem `.git`, origin/tag/commit não verificados; licença inclui nota MIT do `mgrs-ios` vendorizado | Nenhum código copiado neste P0. `PORT`/`ADAPT` seletivo permitido com atribuição e testes independentes | candidato futuro para calibração least-squares e parser/registration; implementação Android/iOS/PDFKit não é reutilizável como runtime web. |
| `kerilla-map` modelo local | `src/geopdf.mjs` regex/text parser | Nenhum LICENSE/COPYING/NOTICE local identificado | Não copiado; `REFERENCE_ONLY` | sem limites de parser, validação CRS/eixo ou licença verificável. |
| Google Material Symbols subset já existente | subconjunto local de 46 glyphs | Apache-2.0; notice/licença já estão em `apps/admin/public/fonts/` | Artefato pré-existente neste checkout; nenhuma nova cópia nesta execução | Self-hosted font preservada nos fluxos UI; precache de cold offline ainda não existe. |

No produto, PDF.js não foi adicionado como dependência nem bundled. O spike
GeoNexo usa `pdf-lib@1.17.1` como devDependency experimental; a validação de
licença/modelos não copiou código TacMap nem alterou dependências nesta etapa.

## 3. Código existente preservado

- Arquitetura Vite/React, Hono, Drizzle/Postgres e MapLibre; nenhuma migração para outro framework.
- Sem tela de login nova. A UUID de instalação continua não sendo tratada como autorização.
- Fluxos atuais de projetos/paginação, importação/exportação/exclusão GeoJSON, importação e render GLB, popups de texto seguro, visibilidade/filtros de camadas, CRS/tema e layout mobile foram mantidos.
- A configuração preexistente `showUserHeading: true` foi preservada como opção legada tipada; isso não prova que MapLibre v6 apresente indicador de rumo.
- O worker v2 continua evitando cache de API, métodos mutáveis e origem externa; não foi substituído por uma política ampla de cache.
- Os fluxos listados passaram na regressão E2E indicada abaixo. Isso não demonstra sincronização, instalação, offline cold start ou suporte GeoPDF.
- Capturas preexistentes em `docs/quality/screenshots/` foram guardadas e restauradas byte a byte após E2E: 10 arquivos, hashes iguais.

## 4. Mudanças

O checkout já estava amplamente dirty quando a execução começou. Nenhum reset, clean, stage, commit ou push foi feito. Por isso a lista integral ao final deste handoff é um snapshot de arquivos efetivamente diferentes/não rastreados no checkout, não uma atribuição individual de autoria deste turno. Mudanças diretas adicionais neste trecho incluem:

- `packages/maps/src/maplibre.ts` e `packages/maps/src/vite-env.d.ts`: worker MapLibre configurado para Vite; opção legada de rumo preservada com tipo explícito, sem alegar suporte visual no v6.
- `packages/contracts/src/offline-map.ts` e `packages/contracts/tests/sync.test.ts`: caminho POSIX permite `@` de sprite `@2x`, mantendo restrições contra traversal/URL; segurança revisou a delta e aprovou.
- `PRD-GEONEXO-PWA-MOBILE-OFFLINE-GEOPDF-NEON.md`: aceite parcial marcado com evidência e resultado NÃO PRONTO.
- `docs/superpowers/decisions/2026-09-30-g0.2-anonymous-workspace-and-sync.md`, planos e task brief: status finais G0.2/G0.3/G0.4/G0.5 e worker.
- `docs/quality/prd-execution-handoff.md`: este handoff obrigatório.
- `docs/maps/offline-package-source.md`: resultado W0/G0.5 e render DPR 2, somente relatório; artefatos permanecem temporários.

### Inventário completo do checkout

Este inventário é obtido de `git status --short --untracked-files=all` após o handoff. Inclui trabalho pré-existente preservado e todo o conteúdo não rastreado visível no workspace. Nenhum desses itens foi staged ou commitado.

```text
 M .gitignore
 M apps/admin/eslint.config.js
 M apps/admin/index.html
 M apps/admin/package.json
 M apps/admin/playwright.config.ts
 M apps/admin/public/sw.js
 M apps/admin/src/components/TopNavBar.tsx
 M apps/admin/src/components/dashboard/DesktopDashboard.tsx
 M apps/admin/src/components/dashboard/MobileDashboard.tsx
 M apps/admin/src/components/layout/RootLayout.tsx
 M apps/admin/src/index.tsx
 M apps/admin/src/lib/errors.ts
 M apps/admin/src/lib/hooks/layers.ts
 M apps/admin/src/lib/hooks/projects.ts
 M apps/admin/src/lib/storage/offline-db.ts
 M apps/admin/src/lib/store/layout.ts
 M apps/admin/src/pages/dashboard/AnalyticsPage.tsx
 M apps/admin/src/pages/dashboard/CoordinateSystemsPage.tsx
 M apps/admin/src/pages/imports/ImportsPage.tsx
 M apps/admin/src/pages/projects/ProjectPage.tsx
 M apps/admin/src/pages/projects/ProjectsPage.tsx
 M apps/admin/src/pages/settings/SettingsPage.tsx
 M apps/admin/src/pages/workspace/CommandCenterPage.tsx
 M apps/admin/src/pages/workspace/MeshStudioPage.tsx
 M apps/admin/src/router.tsx
 M apps/admin/src/styles/main.css
 M apps/admin/src/test/layout-store.test.ts
 M apps/admin/vite.config.ts
 M package.json
 M packages/config/eslint.config.js
 M packages/config/package.json
 M packages/contracts/__tests__/geometry.test.ts
 M packages/contracts/__tests__/layers.test.ts
 M packages/contracts/__tests__/project.existence.test.ts
 M packages/contracts/errors.ts
 M packages/contracts/eslint.config.js
 M packages/contracts/feature.ts
 M packages/contracts/geometry-helpers.ts
 M packages/contracts/geometry.ts
 M packages/contracts/layer.ts
 M packages/contracts/package.json
 M packages/contracts/project.ts
 M packages/contracts/src/errors.ts
 M packages/contracts/src/feature.ts
 M packages/contracts/src/generated/feature.ts
 M packages/contracts/src/generated/geometry.ts
 M packages/contracts/src/generated/layer.ts
 M packages/contracts/src/generated/project.ts
 M packages/contracts/src/geometry.ts
 M packages/contracts/src/import.ts
 M packages/contracts/src/index.ts
 M packages/contracts/src/layer.ts
 M packages/contracts/src/pagination.ts
 M packages/contracts/src/project.ts
 M packages/contracts/tests/contracts.test.ts
 M packages/contracts/tests/import.test.ts
 M packages/contracts/tests/project-layer.test.ts
 M packages/contracts/vitest.config.ts
 M packages/db/drizzle.config.ts
 M packages/db/eslint.config.js
 M packages/db/package.json
 M packages/db/src/client.ts
 M packages/db/src/errors.ts
 M packages/db/src/index.ts
 M packages/db/src/pagination.ts
 M packages/db/src/queries/audit-events.ts
 M packages/db/src/queries/features.ts
 M packages/db/src/queries/index.ts
 M packages/db/src/queries/layers.ts
 M packages/db/src/queries/projects.ts
 M packages/db/src/queries/spatial.ts
 M packages/db/src/schema/audit-events.ts
 M packages/db/src/schema/checks.ts
 M packages/db/src/schema/errors.js
 M packages/db/src/schema/features.ts
 M packages/db/src/schema/geometry.ts
 M packages/db/src/schema/imports.ts
 M packages/db/src/schema/index.ts
 M packages/db/src/schema/layers.ts
 M packages/db/src/schema/map-sources.ts
 M packages/db/src/schema/maps.ts
 M packages/db/src/schema/projects.ts
 M packages/db/tests/integration/postgis.test.ts
 M packages/db/tests/unit/cursor.test.ts
 M packages/db/vitest.config.ts
 M packages/geo/eslint.config.js
 M packages/geo/package.json
 M packages/maps/eslint.config.js
 M packages/maps/package.json
 M packages/maps/src/maplibre.ts
 M packages/maps/src/track-buffer.ts
 M packages/ui/eslint.config.js
 M packages/ui/package.json
 M packages/ui/src/components/Select.tsx
 M packages/ui/tests/toast.test.tsx
 M pnpm-lock.yaml
 M pnpm-workspace.yaml
 M services/api/eslint.config.js
 M services/api/package.json
 M services/api/src/app.ts
 M services/api/src/env.ts
 M services/api/src/index.ts
 M services/api/src/lib/db.ts
 M services/api/src/lib/errors.ts
 M services/api/src/lib/pagination.ts
 M services/api/src/middleware/cors.ts
 M services/api/src/middleware/error-handler.ts
 M services/api/src/middleware/logger.ts
 M services/api/src/middleware/request-id.ts
 M services/api/src/middleware/validation.test.ts
 M services/api/src/middleware/validation.ts
 M services/api/src/routes/features.ts
 M services/api/src/routes/health.ts
 M services/api/src/routes/layers.ts
 M services/api/src/routes/notifications.ts
 M services/api/src/routes/projects.ts
 M services/api/src/routes/storage.ts
 M services/api/src/server.ts
 M services/api/src/storage.ts
 M services/api/tests/api.test.ts
 M services/api/tests/middleware.error-handler.test.ts
 M services/api/tests/pagination.test.ts
 M services/api/vitest.config.ts
 M turbo.json
?? PRD-GEONEXO-PWA-MOBILE-OFFLINE-GEOPDF-NEON.md
?? apps/admin/e2e/frontend-flows.spec.ts
?? apps/admin/e2e/smoke.spec.ts
?? apps/admin/public/fonts/LICENSE-material-symbols.txt
?? apps/admin/public/fonts/NOTICE-material-symbols.md
?? apps/admin/public/fonts/material-symbols-outlined.woff2
?? apps/admin/src/components/mesh/MeshCanvas.tsx
?? apps/admin/src/lib/datasets/dataset-store.test.ts
?? apps/admin/src/lib/datasets/dataset-store.ts
?? apps/admin/src/lib/hooks/use-dialog-focus.ts
?? apps/admin/src/lib/mesh/mesh-store.ts
?? apps/admin/src/lib/mesh/validation.ts
?? apps/admin/src/pages/dashboard/TelemetryPage.tsx
?? apps/admin/src/pages/workspace/map-data.test.ts
?? apps/admin/src/pages/workspace/map-data.ts
?? apps/admin/src/pages/workspace/property-popup.ts
?? apps/admin/src/test/fixtures/triangle.glb
?? apps/admin/src/test/frontend-settings.test.tsx
?? apps/admin/src/test/mesh-validation.test.ts
?? apps/admin/src/test/mobile-dashboard.test.tsx
?? apps/admin/src/test/offline-db.test.ts
?? apps/admin/src/test/project-pagination.test.tsx
?? apps/admin/src/test/property-popup.test.ts
?? apps/admin/src/test/service-worker-policy.test.ts
?? docs/api/sync-protocol.md
?? docs/database/disposable-test-targets.md
?? docs/database/neon-schema-drift.md
?? docs/maps/geopdf-feasibility.md
?? docs/maps/offline-package-source.md
?? docs/quality/2026-09-30-baseline-evidence.md
?? docs/quality/2026-09-30-frontend-main-evidence.md
?? docs/quality/prd-execution-handoff.md
?? docs/quality/pwa-executor-review.md
?? docs/quality/screenshots/frontend-1024x768.png
?? docs/quality/screenshots/frontend-1440x900.png
?? docs/quality/screenshots/frontend-1920x1080.png
?? docs/quality/screenshots/frontend-320x568.png
?? docs/quality/screenshots/frontend-375x812.png
?? docs/quality/screenshots/frontend-667x320.png
?? docs/quality/screenshots/frontend-768x1024.png
?? docs/quality/screenshots/mesh-320x568.png
?? docs/quality/screenshots/mesh-restored.png
?? docs/quality/screenshots/mesh-solid.png
?? docs/security/anonymous-workspace.md
?? docs/superpowers/decisions/2026-09-30-g0.2-anonymous-workspace-and-sync.md
?? docs/superpowers/plans/2026-09-30-frontend-audit-main.md
?? docs/superpowers/plans/2026-09-30-geonexo-localfirst-geopdf.md
?? docs/superpowers/plans/2026-09-30-geopdf-map.md
?? docs/superpowers/plans/2026-09-30-local-persistence-neon-sync.md
?? docs/superpowers/plans/2026-09-30-pwa-offline-maps-sensors.md
?? docs/superpowers/specs/2026-09-29-geonexo-localfirst-geopdf.md
?? docs/superpowers/tasks/2026-09-29-geonexo-localfirst-geopdf.md
?? docs/superpowers/tasks/2026-09-30-frontend-audit-main.md
?? packages/contracts/src/map.ts
?? packages/contracts/src/offline-map.ts
?? packages/contracts/src/pdf.ts
?? packages/contracts/src/sync.ts
?? packages/contracts/src/workspace.ts
?? packages/contracts/tests/sync.test.ts
?? packages/contracts/tsconfig.eslint.json
?? packages/db/tests/client.test.ts
?? packages/geo/src/pdf/experimental/geopdf-spike.ts
?? packages/geo/tests/pdf/fixtures/README.md
?? packages/geo/tests/pdf/fixtures/generate-geopdf.ts
?? packages/geo/tests/pdf/geopdf-feasibility.test.ts
?? packages/maps/src/vite-env.d.ts
?? services/api/tests/env.test.ts
?? services/api/tests/input-validation.test.ts
?? services/api/tests/nested-routes.test.ts
?? services/api/tests/projects-route.test.ts
?? services/api/tests/server.test.ts
```

## 5. Banco

```text
Neon project: GEONEXO (`cold-bonus-98807676`)
branch: production (`br-delicate-base-b4a2d3rl`)
database: neondb
drift encontrado: ausentes tabelas de aplicação, PostGIS, pgcrypto e índices esperados; migration local não cria `layers_project_created_at_id_idx` declarado pelo schema Drizzle.
migrations criadas: nenhuma nesta execução.
migrations aplicadas: nenhuma no Neon; a integração local executou a migration existente de zero em `geonexo_localfirst_test` descartável e passou 16/16.
```

Não há URL, senha ou endpoint de conexão neste relatório. Nenhuma branch/database Neon foi criada; não houve migration, insert ou update remoto.

## 6. PWA

```text
Android install: FAIL / NÃO TESTADO EM DISPOSITIVO
iOS Add to Home Screen: NÃO TESTADO
Standalone em dispositivo: NÃO TESTADO
Offline cold start: FAIL (assets hashed não entram no precache inicial)
Update flow: FAIL/PENDING (skipWaiting sem aceite/handshake de dados sujos)
Offline map package no produto: FAIL/PENDING (prova de origem/render passou; instalador/protocolo/seleção ausentes)
```

## 7. GeoPDF

```text
G0.3 feasibility: PASS para o subconjunto documentado após revisão independente
VP/Measure: FAIL/PENDING no produto (fixtures geradas passam; parser não integrado)
Araguaína: PDF.js worker render OK, mas `/GCS` EPSG:3857 conflita com valores `/GPTS` em faixa de grau; parser retorna `Unsupported CRS`, sem posicionamento automático
Accuracy P0: fixture projetada sintética compara controles com referência pyproj 3.8.0 / PROJ 9.8.1, erro máximo 0.00153 m; a comparação Adobe anterior é excluída por CRS/GPTS inconsistente
Harness descartável: rejeições verificadas para entrada 26 MiB antes da leitura, viewport 25 MP antes do canvas e 101 páginas após o parse; não é limite de produto
LGIDict: FAIL/PENDING (sem `/CTM`/`/Display`/`/LGIT:Info` e pontos de registro)
calibração manual: FAIL/PENDING (não implementada)
offline reopen: FAIL/PENDING no produto (PDF.js ainda só foi sondado em temp)
```

No momento em que este handoff foi escrito, ainda não havia PDF real do projeto
fornecido. Em 2026-09-30 o usuário colocou `geopdf de araguaina.pdf` no root
para teste. O diagnóstico atualizado está em
[`geopdf-feasibility.md`](../maps/geopdf-feasibility.md): arquivo de
16,634,115 bytes, hash `B83914BE45385B71ED9667D4381991952B60DCC8C3504294E969CDA3723CA1E1`,
uma página, render local sem rede em `1684 x 1191` (document-open `103.3 ms`,
render `191.4 ms` nesse run), mas `/GCS` EPSG:3857 conflita
com `/GPTS` de magnitude de grau. O parser fecha com `Unsupported CRS`; não há
bounds geográficos nem residual aprovados. O arquivo original não foi copiado
para fixtures nem staged.

## 8. Testes e verificações

| Comando | Resultado |
|---|---|
| `pnpm exec turbo run lint --force --concurrency=1` | exit 0; 7/7; 24 warnings `any`, zero errors |
| `pnpm exec turbo run typecheck --force --concurrency=1` | exit 0; 7/7 |
| `pnpm exec turbo run test --force --concurrency=1` | exit 0; 12/12 tarefas; 296 passaram; 16 integrações PostGIS skip porque essa execução não recebeu URL de teste |
| `pnpm exec turbo run build --force --concurrency=1` | exit 0; 7/7; inclui `maplibre-gl-worker-*.js` (~510.62 kB). Permanece aviso de bundle admin >500 kB e aviso Turbo de output vazio em `@geonexo/ui#build`. |
| `pnpm --filter @geonexo/db exec vitest run tests/integration/postgis.test.ts --maxWorkers=1` com `TEST_DATABASE_URL` process-only para alvo local descartável | exit 0; 1 arquivo / 16 testes passaram |
| `pnpm --filter admin exec playwright test --workers=1` (`CI=true`, build + preview do config, três browsers, recursos externos bloqueados) | exit 0; 37 passaram / 2 skip deliberados (render GLB WebGL somente Chromium). Ambos os fluxos de mapa que falhavam passaram em Chromium, Firefox e WebKit. |
| `pnpm --filter admin exec playwright test --workers=1 --grep 'GeoJSON local|camada real do projeto'` (`CI=true`, após preservar a opção GPS legada) | exit 0; 6/6 passaram nos três browsers. A revisão técnica independente final da correção do worker foi PASS; o rumo continua sem prova de suporte visual no v6. |
| Revisão independente do relatório W0/G0.5 após correção das notas temporais | PASS: evidência e diretório temporário coerentes; PASS limitado a fonte, ativos e render sem rede. Instalador/protocolo/ativação/quota continuam pendentes. |
| `pnpm audit --audit-level=moderate` | exit 0; “No known vulnerabilities found” |
| `git -c core.safecrlf=false diff --check` | exit 0; sem erros de whitespace |

O preview Vite real em `http://127.0.0.1:4173/` e o asset `maplibre-gl-worker-B7LXXUkR.js` responderam HTTP 200 no loopback. O pedido para abrir o navegador do sistema foi rejeitado pela política automática; o preview permanece disponível nesse URL para abertura manual. Nenhum deploy foi feito.

## 9. Pendências reais

- Implementar stores locais de domínio e outbox transacional, capability workspace e middleware, isolamento por workspace, push/pull/cursor HMAC, replay idempotente, tombstones, conflitos e round-trip real pela API.
- Obter aprovação explícita e target Neon isolado antes de criar branch/schema/migrar/escrever; corrigir migration/index drift primeiro. Production branch foi somente observada e está sem schema de aplicação.
- Implementar instalação/armazenamento/validação/protocolo PMTiles com hashes, recuperação de pacote inválido, integração com UI e attribution. O recorte de 4.3 MB não foi adicionado ao repositório; ainda não há fixture reproduzível no workspace.
- Completar shell PWA com precache de todos os assets Vite, cold offline de primeira instalação e fluxo de atualização compatível com dados pendentes; validar Android e iOS em hardware real.
- Resolver a inconsistência de CRS/GPTS do PDF de Araguaína com uma fonte corrigida/declarada, ou calibrá-lo somente com controles explícitos; manter o parser de produção bloqueado até precisão independente. Depois, implementar perfil LGIDict, calibração, worker/cancelamento, limites de bytes/páginas/memória e reopen offline.
- Medir pan/pinch, long tasks, memória, listas e PDF em dispositivos alvo; reduzir ou particionar bundle conforme medição.
- Atualizar `THIRD_PARTY_NOTICES.md` quando dependências/artefatos aprovados forem efetivamente incorporados ao produto.

## 10. Status

```text
NÃO PRONTO — faltam local-first e sync runtime com workspace protegido; o Neon não tem schema de aplicação e não houve round-trip; GeoPDF/LGIDict/calibração e pacote offline integrado não existem no produto; cold offline, update e dispositivos físicos não passaram.
```

Não houve commit, push, deploy, criação ou mutation do Neon, nem alteração do banco local original.

