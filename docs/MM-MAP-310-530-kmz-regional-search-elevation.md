# MarkMap — MM-MAP-310/400/420/520: KMZ, busca regional e perfil altimétrico

**Data:** 2026-10-09. **Branch:** `agent/MM-MAP-310-420-offline-packages` a partir de `agent/MM-MAP-300-400-pwa-integration@706650b`. **Versão de desenvolvimento:** `0.2.0-dev.0` (não é release/tag).

## Objetivo e contexto

Fechar lacunas offline da M4/M5 e oferecer uma fatia útil de M6 sem mudar React/Vite/TypeScript, MapLibre, IndexedDB/outbox, Hono ou Neon. A operação não usa internet depois de os dados estarem no dispositivo.

## Auditoria antes da mudança

| Área | Classificação anterior | Alteração nesta branch | Estado após |
| --- | --- | --- | --- |
| KMZ | NÃO IMPLEMENTADO | Extração local de `doc.kml` ou único KML de arquivo ZIP controlado; reusa validação GeoJSON | PARCIAL: importação implementada, sem round-trip KMZ gerado |
| Busca regional OSM | PARCIAL, shards produzidos mas descartados na instalação | `searchShards` opcional no contrato, validado por SHA-256+conteúdo, persistido na geração ativa e carregado no Worker do mapa | PARCIAL: integração implementada sem QA E2E IndexedDB/OSM real |
| Perfil de elevação | PARCIAL, DEM/profile utilitário não exposto no fluxo de dados | Perfil local a partir de trilhas com altitude importada, métricas e gráfico na tela Dados | PARCIAL: não substitui DEM/contours |

## Arquivos principais

- Contrato: `packages/contracts/src/offline-map.ts` — `searchShards?`, compatibilidade com pacotes legados e capability `search` consistente.
- Pipeline: `scripts/region-pipeline.mjs` e `.d.mts`; inclui shards no manifesto, tamanho total e capability, com limites de 25.000 registros, 64 arquivos, 2 MiB/shard e 12 MiB para busca.
- Armazenamento: `packages/maps/src/offline/package.ts`, `packages/maps/src/search/regional-shards.ts`, `apps/admin/src/lib/storage/{offline-map-store,resumable-installer}.ts`, tela Configurações. Shards são validados antes de ativar a geração no IndexedDB.
- Busca PWA: `apps/admin/src/lib/search/regional-package-search.ts`, `apps/admin/src/components/map/OfflineSearch.tsx`, `apps/admin/src/workers/map-search.worker.ts`, `apps/admin/src/pages/workspace/CommandCenterPage.tsx`.
- KMZ: `packages/geo/src/kmz.ts`, entrypoint geo, `apps/admin/src/lib/datasets/dataset-store.ts` e `apps/admin/src/pages/imports/ImportsPage.tsx`.
- Altimetria: `apps/admin/src/lib/elevation/track-elevation.ts`, componente `TrackElevationProfile.tsx` e interface Dados.
- Testes novos: `packages/geo/tests/kmz.test.ts`, `packages/maps/tests/search/installed-regional-shards.test.ts`, `apps/admin/src/lib/search/regional-package-search.test.ts`, `apps/admin/src/lib/elevation/track-elevation.test.ts`; suites anteriores atualizadas para a nova capability.

## Segurança e licenças

- KMZ usa diretório central ZIP, caminhos relativos, sem entradas duplicadas, sem link simbólico, sem criptografia, sem ZIP64 ou discos múltiplos. No máximo 25 MiB comprimido, 128 entradas, 64 MiB expandido e 8 MiB de KML. Verificação de integridade CRC32, rejeição de `../`, `C:` e dados truncados, `DecompressionStream('deflate-raw')` local. O KML passa pelo bloqueio DTD/ENTITY e pela validação existente de GeoJSON.
- Índices OSM nunca são tratados como comandos de execução; cada shard é conferido por hash/tamanho/estrutura/limites/coordenadas antes de ativar. A instância anterior do pacote permanece ativa até o commit da transação de substituição.
- Não foram copiadas bibliotecas GPL/Organic Maps. OSM permanece sujeito à atribuição e licença ODbL: https://www.openstreetmap.org/copyright.
- `DecompressionStream` exige navegador compatível; falha explicitamente no import KMZ quando não disponível. Referência: https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream.

## Critérios de aceite e QA

- [x] Módulos puros compilam em `tsc --strict` isolado (KMZ, shards de busca, perfil de trilha).
- [x] Validação sintática/transpilação dos 22 arquivos TS/TSX alterados: sem diagnósticos.
- [x] Node runtime local: KMZ ZIP Deflate, ZIP Store, path traversal, ZIP bomb e CRC32 adulterado tratados; busca regional valida ID/path/coordenadas; reader retorna namespace de IDs e rejeita shard inválido; perfil não conecta segmentos distintos nem inventa altitude.
- [x] Script do pipeline passa `node --check` e emite manifesto com `capabilities=['basemap','search']` e refs de shards quando há `places.json`.
- [ ] Reexecutar Vitest, lint, typecheck, build e E2E Playwright WebKit/Chromium/Firefox em checkout completo; dependências/workspace não montados nesta sessão.
- [ ] Executar IndexedDB real: instalar pacote, fechar/reabrir PWA, confirmar busca OSM sem rede, substituir versão mantendo dados e exportar/reimportar KMZ/GeoJSON.
- [ ] Verificar extrato OSM real e performance (memória/storage/CPU), leitor PMTiles independente e Safari/iOS PWA.
- [ ] Corrigir evidências falhas antes de aprovar MM-MAP-940 para `main`.

## Fora do escopo / pendências

- KMZ complexos com KML em namespaces/estilos/MultiGeometry arbitrários, modelos e imagens referenciados; só é extraído e validado o KML principal. Não há geração de novo KMZ, mas o original permanece disponível para exportação.
- Elevação DEM/curvas de nível/altura de pontos sem Z, Wikipedia, mapas de metrô e navegação guiada continuam dependentes de dados/licenças/QA de pacotes regionais.
- `MM-MAP-600/610/620/630/640` ainda requer conexão do grafo versionado ao roteador e UI GPS/TTS com evidência offline; não declarar navegação pronta.
- PWA-first mantém teste físico como recomendação, sem bloquear desenvolvimento. Android Auto/CarPlay exigem app nativo e estão fora do gate PWA.

## Próximo agente / sequência

1. **MM-MAP-200/400**: validar dados OSM reais e instalar um pacote com índices regional e fontes/sprites; reproduzir reinício offline e atualização.
2. **MM-MAP-310/320**: round-trip e KMZ real de amostra com importação segura e exportação GeoJSON.
3. **MM-MAP-500/520/530**: DEM real versionado, curvas de nível e perfis sem altitude de arquivo.
4. **MM-MAP-600–640**: graph regional versionado, roteamento a pé/bicicleta/carro, manobras e voz/TTS local PWA.
5. **MM-MAP-900/940**: QA Web completo, orçamento de memória/armazenamento, compatibilidade e gate PR sem deploy.

## Regras Git, QA, documentação e ações proibidas

Nova implementação deve partir do HEAD, consultar Notion e checar trabalho paralelo. Sem CI GitHub, deploy Vercel, `main`, tag/release, publicação nas lojas, reset/force-push, alterações remotas destrutivas ou mudança de secrets sem autorização. Se o branch-base se mover, reavaliar diff antes de integrar. Registrar comandos e resultados reais; não converter código escrito em feature concluída sem teste.

**Relatório final esperado:** RESULTADO, STATUS por item, commits, arquivos, provas de QA, testes não executados, licenças, riscos e próximo ID livre. Handoff/Checklist Notion devem permanecer sincronizados.
