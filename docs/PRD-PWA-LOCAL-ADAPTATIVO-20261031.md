# PRD — Desempenho local adaptativo do MarkMap

**Estado:** candidata isolada, sem deploy; baseline `main@92dfbffa77d4707820ef9124e97d7b6cf066e260` (v0.5.21).

## Objetivo e contexto
Melhorar a fluidez GIS em Web/PWA e Capacitor sem conhecer previamente o modelo do aparelho, preservar operação offline-first e reduzir alocações de GPU/CPU/memória. Usar capacidade observável (`hardwareConcurrency`, `deviceMemory`, `devicePixelRatio`, APIs disponíveis), com fallback conservador em dispositivos sem sinais.

## Escopo
- Reaproveitar o worker MapLibre existente, configurando concorrência, cache de tiles, DPR e canvas antes do primeiro mapa.
- GeoTIFF: decodificação em Web Worker com fallback, `readRGB()` redimensionado por orçamento de pixels **e dimensão máxima de cada eixo do canvas**, inclusive GeoTIFF extremamente alongado; preservar original, CRS e georreferenciamento.
- OPFS: **somente cache limitado de PNG derivado de GeoTIFF pequeno**, chaveado pelo SHA-256 do original e validando SHA-256 integral do PNG derivado, integridade do metadado de georreferenciamento, cabeçalho e limites de pixels/dimensão da prévia; se API ausente, cache inválido ou quota insuficiente, decodificar do original.
- Persistência: manter UI existente em Configurações > Proteger dados, com permissão real do navegador, sem solicitar permissão silenciosamente.
- Testar limites e fallback, versões do shell e cenários offline; aferir antes/depois em hardware real.

## Fora do escopo
- Nenhuma migração de IndexedDB, `outbox`, bancos antigos, GeoPDF, pacotes/arquivos GIS originais ou backup.
- Nada de processamento nativo específico de fabricante, root, permissões implícitas, telemetria de dispositivo, sync remoto, serviços de terceiros ou troca da stack.
- Não ativar WebAssembly/threads/SIMD em produção sem kernel real, benchmarks e fallback seguro. Avaliar separadamente.

## Áreas afetadas e arquitetura
`packages/maps/src/formats/geotiff.ts`, `packages/maps/src/maplibre.ts`, política adaptativa MJS e testes; `apps/admin/src/workers/geotiff-overlay.worker.ts`, `apps/admin/src/lib/geotiff/geotiff-overlay.ts`, cache derivado `apps/admin/src/lib/storage/geotiff-preview-opfs.ts`; `apps/admin/package.json` e `CHANGELOG.md` apenas quando versão de candidata for reservada.

## Regras de negócio e segurança
- Fonte de verdade continua IndexedDB/outbox; backup não confunde cache derivado OPFS com dado preservado.
- Cache é opcional e de capacidade fixa: até seis prévias de entradas até 8 MiB; cada PNG até 12 MiB e JSON de metadados até 4 KiB; não tocar arquivos OPFS de outras funcionalidades.
- Sem descarte automático de original, cache de mapa, objeto local, identidade, outbox, preferências, shell aprovado nem metadados de sync.
- Não alterar o protocolo `sw.js` de consentimento/recuperação; se uma API falhar, caminho anterior continua funcionando.
- Não utilizar user-agent, fabricante ou modelo para decisões; `navigator.deviceMemory` é um indício opcional, não um valor garantido.

## Critérios de aceite
1. CPU/GPU de aparelho com sinais fracos usa limites conservadores; alto desempenho usa limites maiores; sinais ausentes têm fallback.
2. GeoTIFF pequeno EPSG:4326 mantém bounds/CRS e original; preview grande (inclusive com apenas 1 pixel em um eixo) respeita `maxPreviewPixels` **e o limite de largura/altura do canvas** sem materializar RGBA de 100 MP.
3. Falha de Worker e ausência de OPFS não bloqueiam renderização; cache corrompido não é considerado válido.
4. Abrir app em modo avião não solicita rede, não substitui shell aprovado nem remove dados existentes.
5. Publicação posterior só após versão, SHA e deploy verificados e consentimento de atualização.

## Testes e QA
- `pnpm --filter @markmap/maps test` (Vitest adaptativo/GeoTIFF) e `pnpm --filter admin test` (cache OPFS/overlay); incluir raster 8192×1 e 1×8192, cache maior que limite do eixo e Worker com preview inconsistente; executar typecheck/lint/build do monorepo na branch candidata.
- Playwright WebKit/Chromium, offline, reabertura, GeoTIFF de tamanho pequeno e grande, atualização consentida, sem limpeza de storage.
- Em Android baixo custo e Android/iOS com recursos maiores, medir abertura/gestos, memória, PNG/GPU, bateria/temperatura e sobrevivência offline. Não inferir QA físico a partir de emulação.
- Comparar outputs GIS, erros, métricas e tolerâncias; recuar otimizações sem ganho ou com regressão.

### Matriz de homologação futura — **PENDENTE (sem deploy)**
1. Em checkout autenticado do SHA exato do PR: `pnpm install --frozen-lockfile`, `pnpm ci:local --strict-version --base-ref main`, `pnpm --filter admin build` e `pnpm --filter admin test:e2e`; registrar códigos de saída sem flags `--skip-*`.
2. Importar GeoTIFF EPSG:4326 normal e rasters 8192×1/1×8192 em perfis de baixa, média e alta capacidade; confirmar limites de canvas, georreferenciamento, original/exportação byte a byte e fallback com Worker/OPFS indisponíveis.
3. Reabrir a PWA instalada offline após consentimento prévio do shell; conferir projetos, edições, outbox, dados originais e mapas locais. A atualização posterior não deve acontecer sem aceite.
4. Comparar com v0.5.21 em Android restrito e mais capaz e iOS/WebKit físicos: tempo de renderização/gestos, memória, falhas GPU e bateria; métricas sem limiar fictício, documentar baseline real.
5. Não aprovar o PR com falha de lint/tipos/Vitest/build/E2E, perda de dados ou teste físico ausente. GitHub Actions #45 sem runner não é aprovação.

## Git, coordenação e riscos
- Branch/PR **draft** isolado, sem merge/deploy/tag/release/force push; conferir HEAD/PRs antes de promover, evitar alterações em funções já em desenvolvimento.
- Riscos: políticas de quota/evicção diferentes; Web Worker bloqueado por WebView/CSP; custo de hash OPFS em arquivos muito grandes; qualidade de preview em baixo DPI; WebAssembly sem benchmark.
- Rollback: reverter somente os arquivos deste PR, preservando os armazenamentos locais; nunca limpar IndexedDB/CacheStorage para corrigir deploy.

## Relatório final esperado / handoff
Arquivos e SHA, comportamento preservado, classes FUNCIONA/PARCIAL/NÃO IMPLEMENTADO, gates PASS/FAIL/BLOCKED e comandos executados, QA físico restante, riscos e próximo responsável. Registrar em Obsidian `02-PROJECTS/MARKMAP/`, Notion e PR; não declarar concluído sem evidência.


### A201 — Auditoria preventiva de integridade offline (31/10/2026)

- **FALHA reproduzida (RED):** metadados OPFS em versão 2 aceitavam `coordinates` geografica e sintaticamente válidas modificadas sem alteração do PNG ou de seu SHA-256. Assim a prévia poderia ser exibida em um local incorreto.
- **CORREÇÃO (GREEN):** cache derivado usa metadados **v3** e digest SHA-256 do conjunto `chave original + versão + dimensões + coordenadas + SHA do PNG + timestamp`. O hash detecta alteração acidental de metadata ou arquivos cruzados, mas **não é assinatura contra adversário que controla a gravação OPFS**. Entradas v2 deixam de ser reutilizadas e são regeneradas do original, sem excluir arquivos derivados anteriores nem tocar IndexedDB/outbox.
- **FALHA adicional (RED):** leitura de JSON derivado corrompido sem teto podia carregar metadados muito grandes na memória antes da validação. **GREEN:** recusar arquivo JSON de metadados fora de 32 B a 4 KiB **antes** de `text()`.
- **Evidências executadas:** 93/93 testes Node PASS em árvore parcial (64 testes originais de repositório + 29 casos de harness isolado com mocks), incluindo RED/GREEN das duas falhas e testes para metadata v2, troca de chave, alteração de timestamp, reserva de quota, GeoTIFF Worker e regressões de shell PWA. `tsc --noEmit` para OPFS, overlay e GeoTIFF em configs isoladas com stubs PASS. `qa-geotiff.mjs` com decoder simulado PASS.
- **Auditoria do diff PR:** mudanças concentradas em MapLibre/GeoTIFF/OPFS/shell tests/version docs, **sem modificações de código IndexedDB/outbox, sync engine ou do próprio `apps/admin/public/sw.js`**. Isso comprova ausência de alterações nesses arquivos, **não** a execução de todos fluxos fim a fim.
- **PENDENTE:** versão 3 de metadados no Vitest oficial, lint, typecheck monorepo, Vite build, E2E offline instalado, Android/iOS reais, zero perda de dados em teste end-to-end; GitHub Actions #45 sem runner continua bloqueado. Não liberar PR enquanto faltem.
