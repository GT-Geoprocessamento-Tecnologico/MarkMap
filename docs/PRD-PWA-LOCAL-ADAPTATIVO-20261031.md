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

### A202 — Escrita concorrente OPFS / memoria de fila (31/10/2026)

**Defeito reproduzido (RED):** 16 requisições simultâneas de cache derivado registraram 16 JSONs, ultrapassando o teto de **6**; todas observavam o contador antes de gravar. A primeira correção serializou as gravações, mas revelou outro risco real: fila ilimitada de Blobs em importação em rajada.

**Correção (GREEN):** escrita de PNG derivado passa por fila serial **por instância do módulo** e por `navigator.locks.request()` entre abas **quando suportado**. Fila pendente limitada ao próprio `MAX_ENTRIES=6`, sem manter dezenas de PNGs em memória; requisições excedentes são descartadas **somente do cache opcional** e podem ser geradas novamente a partir do original. Lock negado não bloqueia a operação principal. Sem Web Locks, a limitação permanece **por aba** (não existe garantia estrita entre múltiplas abas); o cache continua best-effort.

**Critérios de aceite:** até seis arquivos `.json` por sequência de imports simultâneos na mesma aba; escrita entre módulos/abas coordenada por Web Locks quando disponível; sem saída de armazenamento se lock negado; uma rajada de 60 imagens não pode enfileirar mais de 6 operações; dados do IndexedDB/outbox, GeoTIFF original, SW, API e banco permanecem inalterados. Não remover caches legados automaticamente.

**Evidência realmente executada:** Node 22.16.0 em árvore parcial, `node --experimental-strip-types --test` **97/97 PASS** (64 casos oficiais em MJS disponíveis + 33 casos isolados com mocks/stubs). RED reproduzido de **16>6** e de fila de 60 operações; GREEN após serialização + limite. Simulação cross-context de duas instâncias de módulo com Web Locks verificou exclusão mútua. Três checagens TypeScript isoladas com stubs PASS; GeoTIFF isolado com decoder simulado PASS. Testes Vitest oficiais adicionais versionados, **ainda não executados**.

**Pendente / rollback:** git CI Actions #45 segue sem runner; sem Vitest real, lint/typecheck/build do monorepo, E2E offline ou QA físico. Para rollback, reverter apenas alterações do cache derivado e seus testes/PRD na PR draft; nunca limpar IndexedDB/outbox ou remover dados do usuário. Não homologar até executar os gates.

### A203 — Liberar streams OPFS após erro de escrita derivada (31/10/2026)

**Falha reproduzida (RED):** os streams `FileSystemWritableFileStream` abertos para gravar PNG ou JSON derivados não eram explicitamente cancelados se `write()` falhasse (ex.: quota/IO). Os testes de falha de PNG e JSON registraram **0 abortos**, embora o stream tivesse sido aberto.

**Correção (GREEN):** helper `commitDerivedFile` executa `write()` + `close()` e, em caso de rejeição, tenta `stream.abort()` antes de propagar ao catch best-effort já existente. O próprio abort pode falhar se o stream já estiver encerrado; a exceção não pode bloquear edição offline nem a renderização do GeoTIFF. Metadata continua sendo gravada depois do PNG; original, IndexedDB/outbox e arquivos alheios permanecem intocados. Falha de escrita permite reconstrução posterior do cache opcional.

**Critérios de aceite:** falha simulada na escrita de PNG ou JSON chama abort; não comita payload incompleto; tentativa posterior volta a gravar sem apagar originais; resultado do cache inválido continua `null` até recriação; não realizar limpeza de dados ou novos serviços.

**Evidência realmente executada:** `node --experimental-strip-types --test qa-opfs-stream.test.mjs` — 2/2 testes RED antes do fix (abort esperado 1, observado 0), depois 2/2 PASS; suíte Node completa disponível em árvore parcial `node --experimental-strip-types --test ...` **99/99 PASS** (64 casos originais MJS disponíveis + 35 testes isolados com mocks); 3 `tsc --noEmit` em configurações isoladas (OPFS/GeoTIFF/overlay) PASS com declarações externas simuladas; GeoTIFF mock PASS. Blob do módulo de produção `56fd9b94255a3bcdb6965184f61fb41eeb5145ac` idêntico ao código local testado.

**Bloqueio:** regressões Vitest para stream abort adicionadas à PR, mas **não executadas no Vitest real**; build Vite, lint/typecheck monorepo, E2E/Android/iOS físico também pendentes (GitHub Actions #45 não atribui runner). Sem prova de que browsers reais tratam abort/QuotaExceededError de modo idêntico ao mock. PR DRAFT sem merge/deploy. Rollback: reverter apenas código/testes de cache derivado.

### A204 — Contagem de PNGs órfãos ao limitar cache derivado (31/10/2026)

**Defeito reproduzido (RED):** se o PNG opcional era gravado, mas o handle de metadados JSON falhava (quota/IO/interrupção), o limite de `MAX_ENTRIES=6` contava **somente JSONs**. Foram reproduzidos **20 PNGs órfãos** sem nenhum JSON; o limite anunciado deixava de controlar o uso real de OPFS. Nesse estado, recuperar uma entrada existente após lotar a pasta também precisava funcionar sem reservar uma nova vaga.

**Correção (GREEN):** contar **chaves únicas** derivadas das extensões `.png` **ou** `.json` na pasta exclusiva do cache, reconhecendo nomes SHA-256 hexadecimais de 64 dígitos. PNG+JSON da mesma chave ocupa **uma** vaga. Interrupções e arquivos órfãos ocupam vaga, impedindo crescimento adicional sem apagar dados. Uma chave já presente (com PNG órfão ou apenas JSON) pode ser regravada/reconstruída mesmo quando as seis vagas estão ocupadas. Contagem é interrompida no teto, reduzindo retenção de nomes em memória. Mantém fila serial e Web Locks da A202; se Web Locks não existe, a garantia continua por aba.

**Critérios e evidências:** suíte dedicada Node contra o módulo TypeScript real teve **2 FAIL/1 PASS antes** e **3 PASS/0 FAIL após** (20 falhas de metadata, recuperação de PNG com 6 slots e par completo contado uma vez). Suíte combinada da árvore parcial: **102/102 PASS**, sendo 64 testes oficiais Node MJS disponíveis e 38 testes isolados com mocks; 3 configurações `tsc --noEmit` isoladas PASS; `qa-geotiff.mjs` com geotiff stub PASS. Hash Git do módulo testado: `c2d0e88b59b9ef43c0d1c3d08b3cf0a93a222949`, verificado contra blob do PR. Regressões Vitest correspondentes adicionadas à PR **mas NÃO executadas com Vitest real**.

**Proteções e limitações:** não chamar `removeEntry()` nem limpar OPFS/IndexedDB/outbox; não editar GeoTIFF original, Service Worker, sync/Neon ou dados de campo. **Cache cheio de seis órfãos de originais indisponíveis pode impedir novas prévias em cache** até intervenção consentida, mas a decodificação do original continua funcionando (cache best-effort); não implementar limpeza automática sem política aprovada. Contagem entre abas sem Web Locks permanece best-effort. Falta validar em navegador e aparelho reais.

**Gates pendentes:** GitHub Actions issue #45 não executa jobs (sem runner); Vitest oficial, lint/tsc monorepo, build Vite, Playwright offline instalado e Android/iOS físicos não executados. PR permanece **DRAFT / NÃO HOMOLOGADA**. Rollback restrito aos arquivos derivados do PR, sem tocar dados locais.
