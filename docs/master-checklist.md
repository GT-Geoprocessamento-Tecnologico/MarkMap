# MarkMap — Checklist Mestre de Execução

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

## Atualização PWA-first — 2026-10-09
**Decisão vigente:** MarkMap é PWA instalável como experiência primária em Android, iOS e desktop; React/Vite/TypeScript, MapLibre, Terra Draw e IndexedDB/outbox permanecem. Capacitor é empacotamento opcional e Android Auto/CarPlay nativos saem do gate de PWA.
**Gate substituído:** testes em aparelhos físicos **não bloqueiam desenvolvimento nem integração PWA**; continuam recomendados para riscos específicos. O merge ainda depende de lint, typecheck, unit, build, E2E WebKit/Chromium/Firefox e simulações offline, com evidência no HEAD atual.
**Correções registradas:** `3f7852e` corrige cache de shell gerado a partir de conteúdo SHA-256 (antes só nomes) e estado falso de instalação em `beforeinstallprompt.userChoice` (instalado apenas com `appinstalled` ou standalone). Teste Node direcionado passou (1/1); Vitest completo pendente pois workspace Git não está montado localmente.
**Deploy:** nenhum deploy intencional, preview deployments desativados em `markmap-app` e `markmap-site` na Vercel. Push em `main` continua potencialmente ativando deploy de produção e permanece condicionado a bloqueio comprovado antes do merge.
**Próximo funcional:** integrar distribuição de regiões offline reais (OSM→PMTiles + glyphs/sprites), instalador resumível, checksum e rollback. Sem afirmar que mapa offline distribuído esteja concluído.

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