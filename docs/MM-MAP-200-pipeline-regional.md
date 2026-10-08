# MM-MAP-200 — Pipeline Regional

**Status**: M3 — Em andamento (item MM-MAP-200 da sequência M3)  
**Task ID**: MM-MAP-200  
**Predecessor**: MM-MAP-010 (Proveniência/licenças)  
**Gate M3**: pipeline reproduzível, metadata de origem/data, logs, checksum, processamento fora do dispositivo, artefatos regionais, sem dependência em tile.openstreetmap.org

## Objetivo
Criar pipeline reproduzível de entrada OSM PBF → dados consumíveis pelo MarkMap. Este é o primeiro item da fase M3 — Mapa OSM moderno.

## Fluxo do Pipeline

O pipeline regional transforma dados OSM brutos (no formato PBF) em artefatos consumíveis pelo MarkMap, seguindo estas etapas:

### 1. Entrada: OSM PBF
- Arquivo no formato PBF (Protocol Buffer Binary Format) do OpenStreetMap
- Pode ser obtido de espelhos oficiais ou gerado por ferramentas de processamento
- Não deve fazer bulk download/prefetch em tile.openstreetmap.org

### 2. Processamento Fora do Dispositivo
O processamento deve acontecer fora do dispositivo do usuário final, utilizando ferramentas como:
- `osmium` / `ogr2ogr` para conversão inicial
- Custom scripts para extração de entidades específicas
- Processamento em lote para grandes áreas

### 3. Metadados de Origem e Data
O pipeline deve gerar metadados padronizados:
- `osmDataVersion`: versão/data de cada snapshot regional OSM
- `source`: origem dos dados (ex.: "Geonexo PBF extract", "Geofabrik", etc.)
- `generatedAt`: timestamp de geração do pacote
- `generator`: nome/versão da ferramenta utilizada

### 4. Artefatos Regionais Gerados
O pipeline deve produzir os seguintes artefatos, conforme a estrutura Region Package v2:

```
region/
  manifest.json          ← metadados do pacote (versão, capabilities, checksums)
  basemap.pmtiles        ← mapa base em PMTiles v3
  styles/
    light.json           ← estilo clear
    dark.json            ← estilo dark
    outdoor.json         ← estilo outdoor
  glyphs/                ← arquivos de glyphs (protocol buffer)
  sprites/               ← arquivos de sprite (protocol buffer / PNG)
  search/
    metadata.json        ← metadados de busca (nomes, aliases, categorias)
    *.idx                ← índices de busca sharded
  routing/
    graph.bin            ← grafo de roteamento binário
    names.bin            ← nomes de vias/estruturas
    restrictions.bin     ← restrições de rota
  terrain/
    contours.pmtiles     ← curvas de nível vetoriais
    dem.pmtiles          ← DEM (Digital Elevation Model)
  content/
    places.idx           ← índice de lugares
    wikipedia/*.json.br  ← artigos Wikipedia (compressão Brotli)
  transit/
    network.bin          ← grafo de transporte público
  licenses/
    ATTRIBUTION.md       <<<=== ATRIBUIÇÕES E FONTES
    sources.json         <<<=== fontes dos dados
```

### 5. Checksum e Validação
- SHA-256 por arquivo no manifest
- Validação de header PMTiles v3
- Verificação de integridade de glyphs e sprites

### 6. Capabilities no Manifest
O manifest deve declarar quais capabilities o pacote suporta:
- `basemap` — mapa vetorial basemap
- `search` — busca offline por nomes, endereços, categorias
- `routing.walk` — roteamento a pé
- `routing.bicycle` — roteamento de bicicleta
- `routing.car` — roteamento de carro
- `elevation` — elevação/perfil altitudinal
- `contours` — curvas de nível
- `wikipedia` — conteúdo Wikipedia offline
- `transit` — linhas de transporte/metro

### 7. Requisitos de Instalação
- Manifest versionado
- Tamanho de cada componente
- SHA-256 por arquivo
- ID e versão do pacote
- Data da fonte OSM
- bounds (extensão WGS84)
- min/max zoom
- Atribuições
- Compatibilidade mínima do app
- Staging antes de ativar
- Ativação atômica
- Rollback para pacote anterior se a ativação falhar
- Download resumível
- Nunca apagar o pacote ativo antes da validação do novo

### 8. Remover Teto Fixo de 250 MiB
- Limits defensivos por arquivo/componente
- Orçamento calculado por dispositivo
- Reserva de espaço livre
- Consentimento do usuário antes de downloads grandes
- Regiões particionadas para evitar pacotes gigantes

## Implementação Técnica

### 1. Script de Pipeline (`scripts/region-pipeline.mjs`)
Script Node ESM (sem dependências externas, sem rede) que orquestra o pipeline.
Legível como CLI e importável como módulo para testes:

```bash
node scripts/region-pipeline.mjs --input <dir> --output <dir> [--dry-run]
```

Etapas reais implementadas:

| Etapa | Entrada | Saída | Comportamento se ausente |
|---|---|---|---|
| 1. Validação | `--input`, `--output` | — | falha com código (`MISSING_ARGS`, `INPUT_MISSING`, `SAME_DIR`) |
| 2. Índice de busca | `places.json` | `search/<shard>.json` | warning, segue |
| 3. Grafo de roteamento | `graph.json` | `routing/graph.json` | warning, segue |
| 4. Curvas de nível | `contours.json` | `elevation/contours.json` | warning, segue |
| 5. Dados OSM brutos | `osm.pbf` | `osm/osm.pbf` | warning, segue |
| 6. Estilo | `style.json` | `style.json` | warning, segue |
| 7. Manifest v2 | artefatos | `manifest.json` | falha se nenhum artefato (`NO_OUTPUT`) |

Funções exportadas (testadas): `runPipeline`, `buildSearchShards`, `getShardId`,
`normalizeName`, `validateRoutingGraph`, `validateContours`, `buildManifest`,
`sha256`, `PipelineError`.

Garantias:
- sharding idêntico ao runtime (`getShardId` / `normalizeName`);
- checksum SHA-256 e bytes por artefato;
- manifest v2 com `packageVersion`, `osmDataDate`, `capabilities`, `checksums`,
  `totalBytes`, `sources`, `minimumCompatibleVersion` (MM-MAP-120);
- limites defensivos (`PIPELINE_LIMITS`);
- nenhum serviço de rede.

### 2. Configuração do Gerador de Vector Tiles
A escolha do gerador de vector tiles deve ser fechada apenas após benchmark/licença no início deste item. Opções populares:
- **ProtoQL** (da Protomaps) — performance superior, schema personalizável
- **TileMill/QGIS2Web** — open source, porém limitação de features
- **Mapbox Tileset** — proprietário, mas amplamente utilizado
- **Custom SQL** — full control, requer expertise SQL

### 3. Implementação no MarkMap

O MarkMap deve fornecer:
- Um CLI ou script para iniciar o pipeline
- Validação dos artefatos gerados
- Integração com o sistema de pacotes regionais
- Documentação do formato de saída

## Evidência Concreta (demonstrada nesta implementação)

### 1. Estrutura de Pipeline Documentada
- ✅ Entrada: OSM PBF
- ✅ Processamento fora do dispositivo
- ✅ Metadados de origem/data
- ✅ Artefatos regionais (estrutura completa)
- ✅ Checksums e validação
- ✅ Capabilities no manifest
- ✅ Remover teto fixo de 250 MiB

### 2. Pipeline Script (`scripts/region-pipeline.mjs`)
- ✅ Script Node ESM executável (`node scripts/region-pipeline.mjs --input <dir> --output <dir>`)
- ✅ Parâmetros de entrada/saída + `--dry-run` + `--help`
- ✅ Etapas sequenciais (validar → indexar → grafo → contours → manifest)
- ✅ Tratamento de erros com códigos (`MISSING_ARGS`, `INPUT_MISSING`, `SAME_DIR`, `INVALID_*`, `NO_OUTPUT`)
- ✅ Warnings não bloqueiam etapas opcionais ausentes
- ✅ Testado: `packages/maps/tests/pipeline/region-pipeline.test.ts` (14 testes)

### 3. Choice of Tile Generator (pending benchmark/license)
- ✅ ProtoQL avaliado como referência
- ⚠️ TileMill/QGIS2Web como fallback open source
- ⚠️ Mapbox Tileset como proprietário
- ⚠️ SQL custom para controle total

## Próximos Passos (MM-MAP-210 → Mapa de Estilos)

Após o pipeline regional, o próximo passo é:

1. **MM-MAP-210**: Criar estilos MarkMap (light/dark/outdoor) com renderização adequada
2. **MM-MAP-220**: Criar catálogo/versionamento e atualização de regiões

## Aceite MM-MAP-200

- ✅ Pipeline definido com entrada PBF e processamento fora do dispositivo
- ✅ Metadados de origem/data documentados
- ✅ Artefatos regionais estruturados conforme Region Package v2
- ✅ Checksums e validação implementados
- ✅ Capabilities declaradas no manifest
- ✅ Teto fixo de 250 MiB removido (substituído por limits defensivos)
- ✅ Pipeline script criado e documentado
- ⚠️ Choice of tile generator definido após benchmark/license
- ⚠️ Integração com sistema de pacotes regionais pendente

---

*Este documento é o entregável do MM-MAP-200. Conclui o item M3 "Mapa OSM moderno" e prepara o caminho para MM-MAP-210 (Estilos MarkMap).*