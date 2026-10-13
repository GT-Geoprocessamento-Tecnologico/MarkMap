# MarkMap - MM-MAP-200/400/600: fallback regional a partir de OSM PBF

**Branch:** `dev/markmap-pwa-v2`  
**Data:** 2026-10-09  
**Estado:** implementado em codigo, sem teste nesta etapa por solicitacao do responsavel.

## Objetivo e contexto

O gerador de mapas regional tinha a capacidade de montar PMTiles basicos de pequenos extratos OSM, mas a busca offline dependia de `places.json` externo e as rotas dependiam de `graph.json`. Este incremento reaproveita o decoder OSM ja existente, sem criar dependencia de internet ou alteracao da arquitetura.

## Escopo de codigo

- `scripts/osm-graph-search.mjs`: ler extratos PBF ate 32 MiB usando `decodeOsmPbf` do projeto. Extrair POIs nomeados dentro dos bounds (ate 25.000). Produzir grafo de ruas/caminhos com nos e arestas dentro da regiao (limites: 30.000 nos, 70.000 arestas, 8 MiB de JSON).
- `scripts/region-pipeline.mjs`: se `places.json` e/ou `graph.json` nao existirem, tentar derivar os dados opcionais do arquivo `osm.pbf`. Arquivos fornecidos pelo publicador tem prioridade absoluta. Erros da derivacao opcional nao impedem a instalacao do mapa basico: recursos derivados simplesmente nao sao anunciados.
- Publicar perfis `walk` e `bicycle` somente conforme acessos interpretaveis. **Nao gerar nem anunciar `car`.**
- Excluir de derivacao as ruas com acessos condicionais ou direcionalidade que o contrato nao modela. `turnRestrictions` vazio porque o decoder atual nao interpreta relations; nenhum false claim de navegacao de carro.
- Validar o grafo contra o contrato compartilhado antes de inserir em `routing/graph.json`. Checksums e instalacao/IndexedDB/Worker existentes sao reutilizados sem mudanca.

## Fora do escopo

- Regioes grandes e dados globais, edges de alta resolucao, relation-based restrictions, estradas condicionais, timezone/feriados, bike lanes complexas, transito e rotas confiaveis para veiculos motorizados.
- Normalizacao oficial de OSM, mapa topografico real, DEM ou fontes de dados online; nenhuma rede e usada pelo builder.
- Distribuicao de mapas ou rotas ao publico antes de dados reais e QA final.

## Seguranca/licencas

- OSM e ODbL: atribuicao no manifest, compartilhar derivacoes conforme obrigacoes de licenca quando distribuido, validar dados provenientes de terceiro.
- Nunca inventar grafo se faltar informacao ou exceder limites; fallback sem rota/busca e permitido.
- Proibido incorporar codigo GPL de openstreetmap-website, dados binarios Organic Maps ou licencas incompatíveis.
- Acesso `private/no`, `oneway` e `oneway:bicycle` interpretados conservadoramente. Regras dependem da legislacao local; resultados ainda sao orientacao preliminar, nao instrucao critica de seguranca.

## Criterios de aceite para QA final (NAO EXECUTAR AGORA)

1. PBF regional pequeno real com vias e POIs nomeados gera manifest com `searchShards` e `routingGraph` opcionais, corretos e auditaveis, sem rede.
2. Quando existem `graph.json` ou `places.json`, usar os respectivos arquivos originais sem sobrescrever.
3. Quando faltam vias, dados suficientes ou o budget estoura, retornar avisos claros e **nao** anunciar a funcionalidade.
4. Caminhada nao herda oneway de veiculos; bicicletas respeitam one-way e excecoes declaradas no subconjunto suportado, sem falsas rotas de carro.
5. PMTiles gerado tem leitura valida por cliente independente, todos os artefatos fecham SHA-256/bytes e persistem apos reinicio do PWA.
6. Comparar referencias de OSM reais e referencias do provedor de mapas; registrar as vias ignoradas e cobertura antes de release.
7. Fazer verificacoes de licencas, quota/memoria/CPU, experiencia PWA Android/iOS e nunca substituir a outbox local.

## Verificacao e QA

- **Nenhum teste executado por pedido do responsavel.** Nao inventar status verde.
- Rodada final MM-MAP-900/940: lint, typecheck, testes Node/Vitest, build, E2E Web offline/IndexedDB e pacote PBF real independentemente validado.

## Arquivos / Regras Git / Rollback

- `scripts/osm-graph-search.mjs` (novo), `scripts/region-pipeline.mjs`, este PRD e espelhos de checklist/handoff.
- Apenas `dev/markmap-pwa-v2`, sem nova branch, Github CI, deploy, merge main ou release. Rollback por revert isolado deste incremento, sem migracoes.
- Relatorio final deve conter: commit/HEAD, escopo, QA realmente executada, bloqueios, fontes/licencas, riscos, proxima tarefa.

**Proximo passo:** revisar conjunto de restricoes completas e catalogo/licenciamento para pacotes reais; desenvolvimento de interface/seguranca prossegue antes do gate de testes final.
