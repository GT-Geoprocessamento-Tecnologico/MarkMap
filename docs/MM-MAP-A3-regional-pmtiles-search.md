# A3 — PMTiles regionais e busca OSM local (MM-MAP-200/210/400/430)

**Data:** 2026-10-10  
**Branch:** `dev/markmap-pwa-v2` (base auditada: `7cbfdf8`)  
**Estado:** PARCIAL EM CÓDIGO; QA M10 deliberadamente adiada. Nenhum release.

## Objetivo e contexto
Aumentar a capacidade do publicador de mapas offline, sem inventar dados nem trocar a stack. Operação principal continua MapLibre/IndexedDB/outbox totalmente local. `Neon` é apenas sync/backup. O gerador interno OSM PBF não suporta regiões grandes; um publicador pode fornecer PMTiles v3 vetorial pré-gerado e arquivos de busca a partir de fonte autorizada.

## Auditoria do HEAD anterior
- **FUNCIONA EM CÓDIGO (sem gate recente):** manifest v2 com hashes, importação regional por pasta e por HTTPS, busca em shards, Web Worker, geração pequena PBF→PMTiles e fallback de POIs.
- **PARCIAL:** PBF até 32 MiB / 250 mil nós / 40 mil vias; labels e glyphs regionais ausentes no estilo gerado. Instalador remoto até 64 MiB e runtime pode materializar o pacote em RAM.
- **QUEBRADO/POTENCIAL:** pré-gerado era carregado integralmente via `readFile` no publicador; endereço/rua nomeada do PBF não entrava no índice automático. Não afirmar falha reproduzida no navegador.
- **NÃO IMPLEMENTADO:** conversor planetário/região PBF grande embutido, relação/multipolígonos completos, busca endereçável com interpolação, routing carro confiável, distribuição de fonte licenciada real.

## Escopo do incremento
1. **PMTiles pré-gerado:** copiar por arquivo temporário, validar extensão de conteúdo MVT v3, seção de tiles/diretório, bbox/zoom, comparar cobertura declarada e calcular SHA-256 em streaming. O manifest continua usando o mesmo `package.pmtiles`.
2. **Sidecars de estilo:** copiar arquivos locais em `sprites/` e `glyphs/` com nomes seguros, limites por arquivo, até 256 arquivos, sem symlinks; empacotar hashes no manifest. Rejeitar fontes de mapa remotas e exigir o sprite PNG+JSON referenciado. Não declarar cobertura tipográfica sem fonte real.
3. **Busca OSM limitada:** indexar POIs existentes, nomes de vias/caminhos/edifícios e `addr:street` + `addr:housenumber` quando presentes nas tags. As coordenadas representam nós/vértices existentes, não posições postais calculadas. Até 25 mil registros, com reserva parcial para vias.
4. **Segurança/memória:** limitar tamanho PBF antes da leitura, vértices por via e filtro espacial; rejeitar IDs duplicados em `places.json`. Pré-verificar orçamento de shards (2 MiB individual, 12 MiB agregado, até 64); derivação opcional excessiva não deve bloquear basemap.
5. **Estilo básico:** diferenciar visualmente caminhos a pé e ciclovias quando essas classes constarem do extrato, sem dados de rotas simulados.

## Fora do escopo
Não fazer fetch de extratos OSM, GTFS ou SRTM; não obter licenças presumidas; não elevar o limite do gerador interno PBF acima de 32 MiB; não habilitar routing de carro, turn restrictions, ruas estimadas, labels inexistentes, atualização automática ou deploy. Não alterar API/Neon/produção.

## Arquivos
- `scripts/region-pipeline.mjs` — empacotamento PMTiles externo, sidecars, validação local e shards.
- `scripts/osm-pbf-pmtiles.mjs` — limite de entrada, tags de endereço, culling por bbox e estilo.
- `scripts/osm-graph-search.mjs` — fallback de índice de vias e endereços.
- `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md` — estado canônico.

## Segurança, licenças e consistência
- Exigir proveniência, direito de redistribuição e atribuição OSM/ODbL e de cada fonte de sprites/glyphs. Não redistribuir conteúdo GPL de `openstreetmap-website` nem arquivos Organic Maps.
- Todo arquivo empacotado recebe checksum SHA-256. Rejeitar symlinks, traversal e dependências remotas de mapa.
- PMTiles pré-gerado **não é** prova de MVT completo: validação atual é de header/limites. Reader independente deve verificar diretório, tiles amostrados, compressão e camada efetivamente renderizada.
- Não apagar IndexedDB, outbox, projetos, regiões instaladas nem alterar credenciais do navegador.

## Critérios de aceite para M10 (AINDA NÃO EXECUTADOS)
- Dado um PMTiles v3 MVT válido de >32 MiB gerado externamente, quando publicar localmente, então copiar sem ler arquivo todo na RAM, gerar SHA igual aos bytes de saída e manifest coerente.
- Dado PMTiles falso/corrupto, tipo raster, bbox incompatível ou arquivo acima do orçamento, então falhar com erro; não declarar sucesso.
- Dado `osm.pbf` real pequeno autorizado com `name`, `highway`, `addr:street` e `addr:housenumber`, então índices offline contêm nomes/endereço corretos sem valores inventados; pesquisa Worker encontra após restart sem rede.
- Dado `places.json` explícito, ele prevalece; duplicatas e shards acima de limites devem ser recusados.
- Dado estilo de terceiros sem recursos locais ou com URL externa, falhar; com glyphs/sprites reais licenciados, compor pacote completo e validar renderização.
- Dado falha de atualização, mapa ativo, projetos e outbox devem permanecer íntegros; medir consumo real de RAM/quota em Android/iOS/Safari/Chromium.

## Plano de testes e QA
**NÃO EXECUTADOS nesta fase por decisão expressa do responsável.** Executar ao chegar ao M10: lint, typecheck, testes Node/Vitest, build, Playwright WebKit/Chromium/Firefox, instalação/cold offline, verificação IndexedDB/outbox e fixtures PMTiles com leitor independente e OSM real. Não afirmar `MM-MAP-940` verde.

## Git e proibições
Trabalhar exclusivamente na branch `dev/markmap-pwa-v2`; confirmar HEAD/PRs antes de escrever; usar `[skip ci]` em commits. Proibidos: GitHub CI, deployment Vercel, merge main, publicação, tag/release, force-push, excluir branches de agentes, migração ou mutation Neon production sem autorização.

## Riscos, rollback e relatório
- Risco: arquivo pré-gerado até 250 MiB é limite de **publicação**, não garantia de instalação móvel; instalador HTTPS atual limita 64 MiB e validação no navegador ainda materializa bytes.
- Risco: geometria/endereços dependem da cobertura do extrato; glyphs não garantem todas as faixas Unicode por existir um arquivo.
- Risco: decoder PBF não lê relações e não valida condições legais de trânsito.
- Reversão: revert isolado do commit de código da A3, sem modificar dados no dispositivo ou branch `main`.
- Relatório esperado do gate M10: HEAD, arquivo/dado real+licença, comandos, resultados e falhas, screenshots/trace, medição memória/storage, riscos residuais, checklist/handoff atualizados.
