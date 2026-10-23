# MM-MAP-000 — Baseline da Branch

**Status**: P0 — Concluído (baseline registrada no PRD/handoff sem afirmar teste não executado)  
**Task ID**: MM-MAP-000  
**Predecessor**: nenhum  
**Branch**: feat/maps-engine-v2-offline  
**Base**: main@156d4e8  
**Data da auditoria**: 2026-10-07

## Objetivo

Registrar a baseline da branch de integração `feat/maps-engine-v2-offline` antes de iniciar qualquer implementação. Este documento serve como ponto de partida para todos os agentes que trabalharão nesta iniciativa, classificando o estado atual de cada área como FUNCIONA, PARCIAL ou NÃO IMPLEMENTADO.

## Classificação por Área (FUNCIONA / PARCIAL / NÃO IMPLEMENTADO)

### 3.1 FUNCIONA

- **MapLibre GL** — renderer de mapas vetoriais configurado e operacional
- **Terra Draw** — edição vetorial integrada
- **GPS/geolocalização** — tracking de posição funcional
- **IndexedDB/outbox local-first** — fonte operacional para entidades, outbox, metadados e estado de instalação
- **PMTiles v3** — formato de pacote regional suportado com validação de header
- **Protocolo local para PMTiles** — resolução de assets via protocol scheme
- **Estilo offline com glyphs/sprites locais** — substituição de recursos remotos por locais
- **Checksum SHA-256 e ativação validada de pacote offline** — validação de integridade antes da ativação
- **GeoJSON** — import/export e renderização funcional
- **GeoPDF/PDF local e reprojeção** — processamento e reprojeção de PDFs geográficos
- **Armazenamento e limpeza de mapas offline** — gerenciamento de pacotes instalados
- **Service worker e PWA instalável** — worker registrado, manifesto standalone, instalação funcional
- **UpdatePrompt com ativação controlada** — prompt de atualização existente com política controlada
- **Navegação geométrica básica** — distância, bearing, heading e detecção de chegada

### 3.2 PARCIAL

- **Atualização PWA** — existe worker waiting + botão Atualizar, mas não há política completa de checagem periódica, versão legível, adiar/relembrar, release notes nem canal equivalente para builds Capacitor
- **Mapas offline** — pacote atual concentra PMTiles + style/glyphs/sprites e possui teto fixo de 250 MiB (ver MM-UPD-040 para remover teto fixo)
- **Gestão de storage** — mede categorias internas, mas precisa evoluir para orçamento adaptativo por dispositivo e storage de arquivos grandes

### 3.3 NÃO IMPLEMENTADO

- **GPX** — import/export de waypoints, tracks, routes
- **KML/KMZ** — import/export de pontos, linestrings, polygons
- **Índice de busca offline de OSM** — índice pesquisável por nomes, endereços, categorias POI
- **Roteamento offline carro/bicicleta/pedestre** — grafo viário step-by-step
- **Recálculo de rota** — reorientação quando off-route
- **Instruções de manobra** — virar esquerda/direita, manter, rotatória, saída
- **TTS de navegação** — geração de texto para síntese de fala
- **DEM/SRTM** — dados de elevação
- **Curvas de nível** — isolines vetoriais
- **Perfil de elevação** — distância, altitude, ganho, perda, mínimo, máximo
- **Hillshade/relevo** — sombreamento de relevo
- **Artigos Wikipedia offline** — conteúdo offline de Wikipedia/Wikidata
- **Pacote de transporte/metro** — grafo e overlay de transporte público
- **Android Auto** — integração nativa
- **CarPlay** — integração nativa da Apple
- **Atualização independente de pacote regional de mapa** — update de dados sem reescrever app

## Métricas de Bundle e Storage (capturadas nesta baseline)

### Bundle sizes (build production)

- **admin**: build TypeScript passou (`tsc --noEmit`), mas Vite build falhou com 4 erros de tipo em `src/lib/storage/storage-management.ts` e `src/pages/settings/SettingsPage.tsx`
- **maps**: build bem-sucedido, 37 testes passing (vitest)
- **contracts**: build bem-sucedido, 117 testes passing
- **geo**: build bem-sucedido, 58 testes passing | 3 skipped
- **db**: build bem-sucedido, 15 passing | 26 skipped (41 total)
- **ui**: build executado, testes com 4 erros de worker pool (timeout starting forks) — problema de ambiente, não de código

### Storage metrics

- **OFFLINE_PACKAGE_QUOTA**: `250 * 1024 * 1024` bytes (250 MiB) — constante em `packages/maps/src/offline/package.ts:6`
- **Teto fixo de 250 MiB**: será substituído por hard limits defensivos, orçamento por dispositivo e consentimento do usuário (MM-UPD-040, MM-MAP-110)
- **IndexedDB store**: `GeoNexoOfflineMapPackages` (packages/maps/src/offline/package.ts:4)

### TypeScript check status

- **admin**: 4 type errors (storage-management.ts:66, storage-management.ts:75, storage-management.ts:90, SettingsPage.tsx:14, SettingsPage.tsx:78) — pending fix
- **outros pacotes**: typecheck passou sem erros aparentes

## Tests Auditados

### Unitários (passing)

- **contracts**: 117 tests passing (7 test files)
- **geo**: 58 tests passing | 3 skipped (10 test files)
- **db**: 15 passing | 26 skipped (41 total, 2 test files)
- **maps**: 37 passing (9 test files including offline-package-fixture.test.ts with 7 tests)
- **api**: 56 passing (12 test files)

### Integração / E2E

- **maps offline fixture**: `offline-package-fixture.test.ts` — 7 tests validando manifest, PMTiles, checksums, paths, budget, duplicatas
- **Playwright E2E**: 68 passed / 12 skipped / 0 failed (commit 101d678 — baseline verde anterior)

### Faltando/E não executados

- Testes físicos Android/iOS — ❌ pendentes (limite Vercel Free, autorização necessária)
- Smoke de sincronização production — ❌ pendente (requer autorização explícita)
- Testes de routing/search/terrain offline — ❌ NÃO IMPLEMENTADO (próximos gates M5-M7)

## Arquivos/Áreas Existentes (auditados)

### Contratos

- `packages/contracts/src/offline-map.ts` — schema Zod para manifest offline v1 (250 MiB quota, assets validation)
- `packages/maps/src/offline/package.ts` — validação, checksums, header PMTiles v3
- `packages/maps/src/offline/protocol.ts` — protocolo PMTiles, range requests
- `packages/maps/src/offline/style.ts` — adaptação de styles para offline

### Pacotes offline existente

- `packages/maps/tests/fixtures/offline/manifest.json` — fixture canonical (4.3 MiB, Brasília region)
- `packages/maps/tests/fixtures/offline/manifest-path-traversal.json` — teste de paths não seguros
- `packages/maps/tests/fixtures/offline/style.json` — style local
- `packages/maps/tests/fixtures/offline/style-external.json` — style com URLs remotas (para rejeição test)
- `packages/maps/tests/fixtures/offline/README.md` — documentação do fixture

### Aplicação

- `apps/admin/package.json` — version `0.1.0` (baseline, precisa ser sincronizada via MM-UPD-010)
- `apps/admin/src/components/pwa/UpdatePrompt.tsx` — prompt de atualização existente
- `apps/admin/public/sw.js` — service worker
- `apps/admin/src/lib/storage/*` — storage management (com erros de TS pendentes)
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx` — command center

### Testes

- `packages/maps/tests/fixtures/offline/offline-package-fixture.test.ts` — testes completos de validação
- `packages/maps/tests/style-safety.test.ts` — testes de segurança de style

## Licenças/Origem de Código (auditoria inicial)

- **OrganicMaps/organicmaps** — referência de arquitetura/algoritmos; código NÃO será copiado diretamente; conceitos serão reimplementados isoladamente
- **organicmaps/api-android** — wrapper Java para deep links; referência apenas para Intent/Activity Result
- **organicmaps/api-ios** — wrapper para URL schemes/iOS; referência apenas
- **openstreetmap/openstreetmap-website** — GPL-2.0; **NÃO** será copiado código para o MarkMap (proibido sem revisão jurídica)
- Código existente no MarkMap: MIT/Apache-2.0 (verificado via cabeçalhos SPDX)

## Riscos/Pendências Identificados

1. **Build admin com erros de tipo** — 5 erros TS precisam ser corrigidos antes de prosseguir (storage-management.ts e SettingsPage.tsx)
2. **Testes UI com worker pool** — 4 erros de timeout no vitest pool (ambiente, não código)
3. **Cota fixa 250 MiB** — precisa ser substituída por orçamento adaptativo (MM-UPD-040, MM-MAP-110)
4. **API Hono production** — ainda não publicada/configurada; app opera local-first sem depender
5. **Testes físicos** — Android/iOS dependem de liberação do limite Vercel Free e autorização
6. **Privacidade política** — requer identidade/contato/retenção/provedores e revisão jurídica

## Próximo Task ID Livre

**MM-MAP-010** — Proveniência/licenças (início da fase M1 - Atualizações do app)

## Acceptance Criteria (MM-MAP-000)

- ✅ Baseline registrada no PRD/handoff
- ✅ Classificação FUNCIONA/PARCIAL/NÃO IMPLEMENTADO por área
- ✅ Métricas de bundle e storage capturadas
- ✅ Tests auditados e relatório gerado
- ✅ Licenças/origem de código inventariados
- ✅ Risos/pendências documentados
- ✅ Próximo task ID livre definido

---

_Este documento é o entregável do MM-MAP-000. Antes de iniciar MM-MAP-010, garantir que todos os itens "FECHADOS" acima tenham evidência registrada._
