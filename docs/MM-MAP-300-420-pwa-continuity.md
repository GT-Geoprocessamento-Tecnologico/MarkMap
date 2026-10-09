# MarkMap — Continuidade M4/M5 PWA-first (2026-10-09)

**Estado:** implementação parcial em branch isolada; não constitui aprovação de release. **Base:** `agent/MM-MAP-200-pwa-regions@e0dac95`. **Trabalho:** `agent/MM-MAP-300-400-pwa-integration`. **Versão:** `0.2.0-dev.0` (sem tag).

## Objetivo e contexto

Tornar os conversores GPX/KML existentes úteis no aplicativo PWA e oferecer pesquisa local no mapa sem internet. Não reescrever MapLibre, Terra Draw, IndexedDB/outbox ou API Hono/Neon. A plataforma nativa é opcional.

## Auditoria inicial

| Recurso | Antes | Depois desta alteração |
|---|---|---|
| Parsers GPX/KML | PARCIAL: implementados em `packages/geo/src`, mas não exportados pelo entrypoint e não usados pela interface | PARCIAL: exportados, melhor suporte a atributos GPX, elevação KML e polígonos KML |
| Importação de datasets | FUNCIONA para GeoJSON; GPX/KML rejeitados | PARCIAL: GPX/KML passam pelo mesmo validador GeoJSON, são persistidos localmente como datasets, e o original é retido |
| Busca por nome | PARCIAL: índice regional emitido em `search/a0.json` etc., mas runtime legado usa IDs `A`/`#`; buscas só iniciam pelo primeiro token | PARCIAL: helper de ID regional compatível, busca por palavras internas, proteção contra consulta vazia e limites de resultados |
| Busca na interface do mapa | NÃO IMPLEMENTADO para feições carregadas | PARCIAL: painel com Web Worker pesquisando nomes de datasets/feições já carregadas, sem chamadas remotas |
| Busca OSM regional instalada | NÃO IMPLEMENTADO de ponta a ponta | PENDENTE: shards regionais ainda não persistem junto ao pacote/manifest e não alimentam o novo painel |

## Escopo implementado

- GPX: pontos, rotas e segmentos de trilhas convertidos para `FeatureCollection` WGS84, altitude quando válida, validação de geometria e conservação do GPX original; correção de ordem arbitrária de atributos `lat`/`lon` em pontos/rotas.
- KML: pontos, linhas, polígonos simples e anéis internos convertidos, altitude quando presente, mesmo validador e conservação do KML original.
- UI Dados: seletor de GPX/KML, exportação GeoJSON validada, exportação separada do original, acesso no mapa existente.
- UI Mapa: consulta de feições do projeto e do dataset selecionado, em Worker local. A seleção centraliza o mapa; busca usa nomes/títulos/referências.
- Proteções: sem XML DTD/ENTITY, sem busca na rede, limite anterior de 25 MiB/10.000 feições, coordenadas válidas e cap de resultados.
- Suíte: testes novos Vitest para conversor, formulário/validação de formatos, índice, busca offline e seleção de feições; testes Node direcionados executados localmente.

## Fora do escopo e limitações reais

- **KMZ** não importado/exportado: não oferecer suporte falso enquanto não houver extração ZIP segura contra path traversal, arquivo expandido excessivo, número de arquivos e DTD/ENTITY.
- KML completo (MultiGeometry arbitrário, ExtendedData complexa, ícones/estilos, namespaces diversos), exportação GPX/KML reserializada e todos os timestamps por vértice ainda não estão implementados. O arquivo GPX/KML original é preservado para esses dados.
- Busca de POIs OSM do pacote regional não está integrada ao IndexedDB de mapas. O painel pesquisa **somente feições nomeadas já carregadas**; dados regionais adicionais não são anunciados como disponíveis.
- Sem otimizações/benchmark de índices regionais grandes; o Worker pesquisa no máximo 10.000 registros locais por montagem. Altitude DEM, roteamento, Wikipedia e metro dependem de insumos regionais validados.
- Nenhuma mudança em `main`, configuração Vercel, API production, migrations, releases ou lojas.

## Arquivos afetados

- `packages/geo/src/{index,gpx-types,gpx,kml,tracks-geojson}.ts` e `packages/geo/tests/tracks-geojson.test.ts`.
- `apps/admin/src/lib/datasets/{dataset-store.ts,dataset-import-formats.test.ts}` e `apps/admin/src/pages/imports/ImportsPage.tsx`.
- `packages/maps/src/search/index.ts`, `packages/maps/tests/search/regional-search.test.ts`.
- `apps/admin/src/lib/search/{local-map-search.ts,local-map-search.test.ts}`, `apps/admin/src/workers/map-search.worker.ts`, `apps/admin/src/components/map/OfflineSearch.tsx`, `apps/admin/src/pages/workspace/CommandCenterPage.tsx`.
- Checklist Mestre, Handoff, gate MM-MAP-940 e este documento.

## Testes e QA

**Executados localmente, sem GitHub CI:** `tsc --strict` isolado para `gpx/gpx-types/kml/tracks-geojson`, `search/index.ts` e `local-map-search.ts`; testes Node 20/20 verdes (incluindo baseline Node anterior) e parser/transpilação de 16 arquivos TS/TSX sem erro sintático.

**Não executados nesta execução:** lint e typecheck do monorepo completo, Vitest de todos os pacotes, build Vite, E2E Playwright Chrome/Firefox/WebKit, instalação real IndexedDB no navegador, testes com arquivo GPX/KML de usuário, instalação PWA física. Isso impede declarar as fases M4/M5 concluídas.

## Critérios de aceite do próximo gate

- [x] Conversão GPX/KML e busca local passam nos testes Node direcionados.
- [x] O código não faz chamadas à rede para converter ou pesquisar os dados locais.
- [ ] Testes Vitest dos novos módulos aprovados no monorepo completo.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e E2E PWA verdes no HEAD atualizado.
- [ ] Round-trip importação → persistência IndexedDB → exportação GeoJSON → reimportação validado em navegador.
- [ ] KMZ com parser e limites de extração definidos/implementados, se mantido no escopo M4.
- [ ] Armazenar shards OSM sob manifest versionado/checksums e alimentar o Worker sem rede.
- [ ] Checar renderização do PMTiles real produzido pelo pipeline da M3 e atualização sem perda de dados.
- [ ] Revisar acessibilidade/mobile, consumo de memória e segurança das entradas importadas.

## Riscos / mitigação

- **Memória:** GPX/KML grandes são lidos inteiramente para conversão; limites do dataset existentes evitam arquivos muito grandes, porém parser incremental/Worker de importação ainda é desejável.
- **Compatibilidade:** datasets antigos permanecem `GeoJSON`; novos guardam formato de origem e GeoJSON normalizado; sem migração de esquema ou exclusão automática.
- **Licenças:** nenhuma cópia de código GPL ou arquivos MWM/Organic Maps. O código alterado usa módulos próprios já presentes.
- **Offline:** a aplicação permanece local-first, sem acesso a APIs remotas para importação/pesquisa. Dados regionais OSM só ficarão offline após pacote instalado e validado.

## Git e ações proibidas

Branch de trabalho derivada da branch de mapa anterior; commits marcados `[skip ci]`; branch de integração `feat/maps-engine-v2-offline` e `main` não devem ser alteradas até qualidade completa. Não executar CI GitHub, deploy, release/tag, migrations destrutivas, operações irreversíveis, force push, alteração de secrets ou publicação em loja sem autorização explícita. Não sobrescrever arquivos editados em outro HEAD sem novo diff.

## Próximo passo recomendado

Primeiro, executar **MM-MAP-400/410** com persistência versionada dos shards regionais e integração ao painel local; depois fechar **MM-MAP-310/320** (KMZ e round-trip) e executar **MM-MAP-940** Web (lint, typecheck, Vitest, build, Playwright e revisão do diff). A validação em aparelhos físicos continua recomendada, não obrigatória para seguir desenvolvendo PWA. Aplicações nativas Android Auto/CarPlay permanecem fora do escopo PWA puro.

## Relatório final esperado

`RESULTADO`, `ALTERAÇÕES`, `ARQUIVOS`, `VALIDAÇÃO EXECUTADA`, `VALIDAÇÃO NÃO EXECUTADA`, `LICENÇAS`, `RISCOS/PENDÊNCIAS`, `PRÓXIMO TASK ID`.
