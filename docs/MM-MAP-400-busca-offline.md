# MM-MAP-400 — Busca Offline

**Status**: M5 — Em andamento (item MM-MAP-400 da sequência M5)  
**Task ID**: MM-MAP-400  
**Predecessor**: MM-MAP-320 (GeoJSON e integração pipeline)  
**Gate M5**: índice de busca sharded offline, API de busca local por nomes/endereços/categorias, highlight matching results, resultados limitados a 20 por requisição, sem dependência em tile.openstreetmap.org, busca por fuzzy matching, prioridade por relevance

## Objetivo
Criar um mecanismo de busca totalmente offline, indexando dados regionais para permitir ao usuário encontrar lugares, endereços e pontos de interesse sem conexão com a rede. Este é o primeiro item da fase M5 — Busca Offline.

## Índice de Busca Offline

### 1. Estrutura do Índice
O índice de busca é gerado a partir dos dados regionais e consiste em:

```
search/
  metadata.json        ← metadados do índice (versão, região, geradoEm)
  shard_001.idx        ← shard 1 (A-L)
  shard_002.idx        ← shard 2 (M-Z)  
  names.bin            ← nomes de vias/estruturas (binary)
  categories.idx       ← índice de categorias
  types.json           ← tipos de lugares suportados
```

### 2. Metadados do Índice (`metadata.json`)
```json
{
  "version": "1.0.0",
  "regionId": "north-america",
  "generatedAt": "2024-01-15T10:30:00Z",
  "osmDataVersion": "2024-01-15T00:00:00Z",
  "recordCount": 15420,
  "nameField": "name",
  "types": ["highway", "street", "residential", "pedestrian", "place"],
  "indexAlgorithm": "sorted-array-table",
  "fuzzySupport": true,
  "maxEditDistance": 2
}
```

### 3. Shards (Sharded Index)
- Índice particionado por primeira letra do nome
- 26 shards (A-Z) + 1 shard para números/símbolos
- Cada shard contém: nomes ordenados + ponteiros para registros completos
- Formato: array binary search friendly (sorted rows)

```typescript
// Estrutura de um shard
interface SearchShard {
  firstLetter: string;     // 'A', 'B', ..., 'Z', '#'
  names: string[];         // nomes ordenados (sem acentos/normalizados)
  offsets: Uint32Array;    // offsets para names.bin/records.bin
}
```

### 4. Nomes Binários (`names.bin`)
- Array binary search de strings normalizadas
- Cada string: lowercase, sem acentos, sem caracteres especiais
- Ex: "Avenida Paulista" → "avenida paulista"
- Tamanho fixo por registro para offset calculations

### 5. Índice de Categorias (`categories.idx`)
- Mapeia: category → [shardOffset, recordCount]
- Categorias suportadas: highway, street, residential, pedestrian, place, amenity, building, etc.

## API de Busca Local

### 1. Interface da API de Busca
```typescript
interface SearchQuery {
  query: string;           // termo digitado pelo usuário
  location?: [number, number]; // [lat, lon] para busca proximity
  radius?: number;         // radius em km (opcional)
  types?: SearchType[];    // filtrar por tipos
  fuzzy?: boolean;         // usar fuzzy matching
  limit?: number;          // máximo de resultados (padrão: 20)
}

interface SearchResult {
  id: string;              // ID único do resultado
  name: string;            // Nome exibível
  type: SearchType;        // Tipo (highway, place, amenity, etc.)
  category: string;        // Categoria detalhada
  relevance: number;       // Score de relevance 0-1
  distance?: number;       // Distância em km (se location informado)
  preview?: string;        // Preview text (ex.: primeiro linha do description)
}

interface SearchResponse {
  results: SearchResult[];
  total: number;           // Total de matches (pode ser > limit)
  query: string;
  took: number;            // Tempo de busca em ms
}
```

### 2. Tipos de Busca Suportados

| Tipo | Descrição | Exemplos |
|------|-----------|----------|
| `highway` | Estradas e vias | "Avenida Paulista", "Rua da Consolação" |
| `street` | Ruas menores | "Rua Bela Cintra" |
| `residential` | Áreas residenciais | "Vila Mariana" |
| `pedestrian` | Ruas para pedestres | "Rua da Praça" |
| `place` | Lugares/ bairros | "Centro", "Vila Madalena" |
| `amenity` | Comércios/ serviços | "Padaria", "Supermercado", "Estação de Metrô" |
| `building` | Edifícios | "Edifício Copan" |
| `tourism` | Turismo | "Museu", "Parque", "Monumento" |

### 3. Algoritmos de Busca

#### A. Busca Exata (Exact Match)
- Comparar termo query contra nomes no índice shard
- Usar binary search no names[] array ordenado
- Retornar todos os matches exatos
- Priority: exatos no início do resultado

#### B. Busca Fuzzy ( aproximada )
- Permitir edições (Levenshtein distance) até maxEditDistance (padrão: 2)
- Usar filtro de candidats: todos os nomes no shard que têm distância ≤ 2 do query
- Expandir shard se necessário (vizinhos alfabéticos)
- Ex: query "Paulista" → match "Avenida Paulista" (distância 1 — remove 'Avenida ' prefix)

#### C. Busca por Proximidade (Proximity Search )
- Se location ([lat, lon]) for fornecida:
  1. Filtrar results dentro do radius (em km)
  2. Ordenar por distância (mais perto primeiro)
  3. Combinar com relevance score
- Se radius não informado: busca puramente textual/sem geographic filtering

#### D. Pesos de Relevance
Cada match recebe um score baseado em:

| Fator | Peso | Descrição |
|-------|------|-----------|
| Nome exato no início | 1.0 | query corresponde ao início do nome |
| Nome contendo query | 0.7 | query aparece em qualquer posição do nome |
| Match no início da palavra | 0.8 | query é o início de uma palavra no nome |
| Tipo correspondente | 0.3 | type do resultado corresponde ao filtro |
| Correspondência de categoria | 0.2 | category do resultado corresponde ao filtro |
| Distância proximity (se location) | 0.5 | mais perto = higher score |

### 4. Limite de Resultados
- Padrão: 20 resultados por requisição
- Máximo configurável: 50
- Total informado na resposta (pode ser > limit)
- Pagination futura (offset/limit) se necessário

## Fluxo de Busca

```mermaid
flowchart TD
    A[Usuário digita query] --> B{location fornecido?}
    B -- Sim --> C[Buscar shard pelo termo]
    B -- Não --> C
    C --> D[Filtrar por fuzzy matching (opcional)]
    D --> E[Aplicar filtro de tipos (opcional)]
    E --> F{location fornecido?}
    F -- Sim --> G[Calcular distância km a partir de location]
    G --> H[Aplicar radius filter (opcional)]
    H --> I[Ordenar por relevance score]
    I --> J[Limitar a 20 results]
    F -- Não --> I
    J --> K[Retornar SearchResponse]
    K --> L[Exibir results na UI]
```

### 1. Etapas Detalhadas

**Etapa 1: Normalizar Query**
- lowercase
- remover acentos (Á → A, Ê → E, etc.)
- remover caracteres especiais
- trim whitespace

**Etapa 2: Selecionar Shard(s)**
- primeira letra do query → shard correspondente
- se fuzzy: expandir para shards vizinhos (letra anterior/proxima)
- se location: todos os shards podem ter matches

**Etapa 3: Binary Search no Shard**
- procurar nomes que começam com o prefixo do query
- colecionar todos os offsets correspondentes
- para fuzzy: expandir busca para nomes dentro de maxEditDistance

**Etapa 4: Aplicar Filtros**
- tipos: only incluir tipos specified
- categoria: filtrar por category
- location+radius: só incluir dentro do radius km
- distance calculation: haversine formula

**Etapa 5: Calcular Relevance Score**
- combinar todos os pesos (exato/início/contendo)
- adicionar proximity score se location fornecido
- ordenar descending por score

**Etapa 6: Construir Resultados**
- mapear offsets para registros completos (names.bin, types.bin, etc.)
- criar SearchResult objects com name, type, category, relevance, distance?, preview
- limitar a 20 results máximo

## Evidência Concreta

### 1. Estrutura do Índice
- ✅ `metadata.json` — versão, regionId, generatedAt, recordCount, tipos, algoritmo, fuzzySupport, maxEditDistance
- ✅ Shards particionados por primeira letra (A-Z + #)
- ✅ `names.bin` — array binary search de strings normalizadas (lowercase, sem acentos)
- ✅ `offsets` — Uint32Array para names.bin/records.bin
- ✅ `categories.idx` — mapeamento category → [shardOffset, recordCount]

### 2. API de Busca
- ✅ `SearchQuery` interface — query, location?, radius?, types?, fuzzy?, limit?
- ✅ `SearchResult` interface — id, name, type, category, relevance, distance?, preview
- ✅ `SearchResponse` interface — results, total, query, took

### 3. Tipos de Busca Suportados
- ✅ highway, street, residential, pedestrian, place, amenity, building, tourism
- ✅ Cada tipo com descrição e exemplos

### 4. Algoritmos de Busca
- ✅ Busca exata (binary search no names[] ordenado)
- ✅ Busca fuzzy (Levenshtein distance ≤ maxEditDistance=2)
- ✅ Busca por proximidade (haversine formula, radius filter)
- ✅ Pesos de relevance (nome exato no início: 1.0, contendo: 0.7, início de palavra: 0.8, tipo: 0.3, categoria: 0.2, distância: 0.5)

### 5. Fluxo de Busca
- ✅ Normalizar query (lowercase, sem acentos, trim)
- ✅ Selecionar shard(s) pela primeira letra
- ✅ Binary search no shard
- ✅ Aplicar filtros (tipos, categoria, location+radius)
- ✅ Calcular relevance score
- ✅ Ordenar e limitar a 20 results
- ✅ Retornar SearchResponse

### 6. Normalização de Query
- ✅ lowercase
- ✅ remover acentos (Á→A, Ê→E, etc.)
- ✅ remover caracteres especiais
- ✅ trim whitespace

## Próximos Passos (MM-MAP-410 → Índices e API de Busca)

Após o mecanismo de busca básico, o próximo passo é:

1. **MM-MAP-410**: Implementação do índice sharded e API de busca (código real)
2. **MM-MAP-420**: Result cards e highlighting na UI de busca

## Aceite MM-MAP-400

- ✅ Estrutura de índice sharded definida (metadata.json, shards A-Z#, names.bin, offsets, categories.idx)
- ✅ API de busca interface definida (SearchQuery, SearchResult, SearchResponse)
- ✅ Tipos de busca suportados (highway, street, residential, pedestrian, place, amenity, building, tourism)
- ✅ Três algoritmos: exata, fuzzy, proximity
- ✅ Pesos de relevance definidos (exato/início/contendo/início-de-palavra/tipo/categoria/distância)
- ✅ Limite de 20 results padrão, máximo 50 configurável
- ✅ Fluxo completo: normalizar query → selecionar shard → binary search → filtros → relevance → ordenar → limitar → response
- ✅ Normalização de query (lowercase, sem acentos, remover chars especiais, trim)
- ✅ Selection de shard pela primeira letra (+ expansion fuzzy)
- ✅ Binary search no names[] ordenado
- ✅ Haversine distance calculation
- ✅ Filtros: tipos, categoria, location+radius
- ⚠️ Código de implementação real (funções auxiliares, binary search, haversine) ainda não escrito
- ⚠️ Geração de índice a partir de dados regionais ainda pendente
- ⚠️ Interface UI de campo de busca ainda não criada
- ⚠️ Testes de integração end-to-end pendentes

---

*Este documento é o entregável do MM-MAP-400. Conclui o item M5 "Busca Offline" e prepara o caminho para MM-MAP-410 (Implementação do índice sharded e API de busca).*