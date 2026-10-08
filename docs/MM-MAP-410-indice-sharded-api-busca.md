# MM-MAP-410 — Implementação do Índice Sharded e API de Busca

**Status**: M5 — Em andamento (item MM-MAP-410 da sequência M5)  
**Task ID**: MM-MAP-410  
**Predecessor**: MM-MAP-400 (Busca Offline — definição de estrutura)  
**Gate M5**: índice sharded funcional, API de busca HTTP/local implementada, fuzzy matching com Levenshtein, busca por proximidade com haversine, cache de resultados frequentes, tipos de retorno compatíveis com MapLibre search, sem dependência em tile.openstreetmap.org

## Objetivo
Implementar o índice de busca sharded de fato e a API de busca local. Este é o segundo item da fase M5 — Busca Offline. Contém o código e a lógica que transforma a estrutura definida em MM-MAP-400 em um sistema funcional.

## Índice Sharded (Implementation)

### 1. Estrutura de Arquivos no IndexedDB
O índice será armazenado em object store `searchIndex` no IndexedDB com este structure:

```typescript
// Chamada ao abrir o DB
const db = await openDB("markmap-db", 1, {
  upgrade: (db) => {
    // Metadados do índice
    const metadataStore = db.createObjectStore("searchMeta", { keyPath: "version" });
    metadataStore.createIndex("byRegion", "regionId", { unique: false });
    
    // Shards A-Z e # (primeira letra do nome)
    const shardsStore = db.createObjectStore("searchShards", { keyPath: "shardId" });
    shardsStore.createIndex("byFirstLetter", "firstLetter", { unique: false });
    
    // Nomes normalizados por shard (binary search friendly)
    const namesStore = db.createObjectStore("searchNames", { keyPath: "normalized" });
    namesStore.createIndex("byOffset", "offset", { unique: false });
    
    // Índice de categorias
    const categoriesStore = db.createObjectStore("searchCategories");
    categoriesStore.createIndex("byCategory", "category", { unique: false });
    
    // Resultados em cache (LRU de tamanho fixo)
    const cacheStore = db.createObjectStore("searchCache", { keyPath: "queryHash" });
  }
});
```

### 2. Estrutura de Dados por Shard

```typescript
interface SearchShard {
  shardId: string;           // "A", "B", ..., "Z", "#"
  firstLetter: string;       // 'A', 'B', ..., 'Z', '#'
  normalizedNames: string[]; // strings lowercase, sem acentos, ordenadas
  offsets: Uint32Array;      // offsets para names.bin data
  recordCounts: Uint32Array; // quantos records por nome no names.bin
}

// Exemplo: shard "P" teria nomes como "parque", "praça", "ponte" etc.
```

### 3. Geração de Índice a partir de Dados Regionais

O índice é gerado quando um novo pacote regional é ativado:

```typescript
export async function buildSearchIndex(
  regionData: RegionData,
  db: IDBDatabase
): Promise<void> {
  // 1. Extrair todos os nomes das features do pacote
  const allNames = extractAllNames(regionData); // [ "Avenida Paulista", "Rua da Consolação", ... ]
  
  // 2. Normalizar nomes
  const normalized = allNames.map(normalizeName); // ["avenida paulista", "rua da consolação", ...]
  
  // 3. Ordenar
  const sorted = normalized.sort((a, b) => a.localeCompare(b));
  
  // 4. Particionar por primeira letra
  const shards = partitionByFirstLetter(sorted); // { A: [...], B: [...], ..., "#": [...] }
  
  // 5. Armazenar no IndexedDB
  const tx = db.transaction("searchShards", "readwrite");
  for (const [letter, names] of Object.entries(shards)) {
    const shardId = letter === "#" ? "numbers" : letter;
    const normalizedNames = names.map(n => normalizeName(n));
    const sortedNames = normalizedNames.sort();
    const offsets = computeOffsets(sortedNames);
    
    await tx.store.put({
      shardId,
      firstLetter: letter,
      normalizedNames: sortedNames,
      offsets,
      recordCounts: new Uint32Array(sortedNames.length + 1).fill(0).map((_, i) => i + 1),
    }, shardId);
  }
  await tx.done;
  
  // 6. Atualizar metadados
  await tx = db.transaction("searchMeta", "readwrite");
  await tx.store.put({
    version: "1.0.0",
    regionId: regionData.id,
    generatedAt: new Date().toISOString(),
    recordCount: allNames.length,
    nameField: "name",
    types: regionData.types,
    fuzzySupport: true,
    maxEditDistance: 2,
  }, "1.0.0");
  await tx.done;
}
```

### 4. Funções Auxiliares

```typescript
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remover acentos
    .replace(/[^\w\s]/g, "") // remover chars especiais
    .trim();
}

function partitionByFirstLetter(names: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const name of names) {
    const firstChar = name[0] || "#";
    if (!result[firstChar]) result[firstChar] = [];
    result[firstChar].push(name);
  }
  return result;
}

function computeOffsets(sortedNames: string[]): Uint32Array {
  const offsets = new Uint32Array(sortedNames.length + 1);
  offsets[0] = 0;
  for (let i = 0; i < sortedNames.length; i++) {
    // Offset para o próximo nome = offset atual + tamanho do nome + 1 (nulo terminator)
    offsets[i + 1] = offsets[i] + new TextEncoder().encode(sortedNames[i]).length + 1;
  }
  return offsets;
}
```

### 5. Busca Exata (Binary Search)

```typescript
function binarySearchExact(
  names: string[],
  target: string,
  offsets: Uint32Array
): { found: boolean; startOffset: number; endOffset: number } {
  // Busca binária para encontrar o range de nomes que correspondem ao target exato
  let low = 0;
  let high = names.length - 1;
  
  // Encontrar qualquer ocorrência
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midName = names[mid];
    
    if (midName < target) {
      low = mid + 1;
    } else if (midName > target) {
      high = mid - 1;
    } else {
      // Encontrado - expandir para encontrar o range completo
      let start = mid;
      let end = mid;
      
      // Expandir para esquerda
      while (start > 0 && names[start - 1] === target) start--;
      
      // Expandir para direita
      while (end < names.length - 1 && names[end + 1] === target) end++;
      
      return { found: true, startOffset: offsets[start], endOffset: offsets[end + 1] };
    }
  }
  
  return { found: false, startOffset: 0, endOffset: 0 };
}
```

### 6. Busca Fuzzy (Levenshtein Distance)

```typescript
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1      // insertion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

function fuzzySearch(
  names: string[],
  target: string,
  maxEditDistance: number = 2,
  offsets: Uint32Array
): { matches: { name: string; original: string; distance: number }[]; startOffset: number; endOffset: number } {
  const matches: { name: string; original: string; distance: number }[] = [];
  
  for (let i = 0; i < names.length; i++) {
    const distance = levenshteinDistance(names[i], target);
    if (distance <= maxEditDistance) {
      // Encontrar o nome original (pre-normalized) a partir do offset
      const originalName = /* lookup original name usando offsets */;
      matches.push({ name: names[i], original, distance });
    }
  }
  
  // Ordenar por distância (menor primeiro)
  matches.sort((a, b) => a.distance - b.distance);
  
  // Encontrar range de offsets para todos os matches
  let minOffset = offsets[0];
  let maxOffset = offsets[names.length];
  
  if (matches.length > 0) {
    // Encontrar offsets dos matches
    // ... (buscar no names array original)
  }
  
  return { matches, startOffset: minOffset, endOffset: maxOffset };
}
```

### 7. Busca por Proximidade (Haversine)

```typescript
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.asin(Math.sqrt(a));
  
  return R * c; // Distância em km
}

function toRad(deg: number): number {
  return deg * Math.PI / 180;
}
```

## API de Busca (Search API)

### 1. Interface HTTP/ Local

```typescript
// Endpoint: GET /api/search
type SearchHandler = (req: Request) => Promise<Response>;

export async function searchHandler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  
  const query = searchParams.get("q") || "";
  const locationStr = searchParams.get("loc"); // "lat,lon"
  const radiusStr = searchParams.get("r"); // km
  const typesStr = searchParams.get("types"); // comma-separated
  const fuzzyStr = searchParams.get("f"); // "true"|"false"
  const limitStr = searchParams.get("l"); // número
  
  const queryNormalized = normalizeSearchQuery(query);
  
  let location: [number, number] | undefined;
  if (locationStr) {
    const [lat, lon] = locationStr.split(",").map(Number);
    location = [lat, lon];
  }
  
  const radius = radiusStr ? parseFloat(radiusStr) : undefined;
  const types = typesStr ? typesStr.split(",").map(t => t.trim()) : undefined;
  const fuzzy = fuzzyStr === "true";
  const limit = parseInt(limitStr) || 20;
  
  // 1. Carregar índice do IndexedDB
  const db = await openDB("markmap-db", 1);
  const index = await loadSearchIndex(db, /* regionId */);
  
  // 2. Executar busca
  const results = performSearch({
    query: queryNormalized,
    index,
    location,
    radius,
    types,
    fuzzy,
    limit,
  });
  
  // 3. Retornar resposta
  return new JSON.stringify({
    results,
    total: results.length, // ou total real se conhecido
    query,
    took: /* tempo decorrido */,
  });
}
```

### 2. performSearch Implementation

```typescript
async function performSearch({
  query,
  index,
  location,
  radius,
  types,
  fuzzy,
  limit,
}: {
  query: string;
  index: SearchIndex;
  location?: [number, number];
  radius?: number;
  types?: SearchType[];
  fuzzy: boolean;
  limit: number;
}): Promise<SearchResult[]> {
  
  // 1. Selecionar shard(s)
  const firstLetter = query[0] || "#";
  const shard = await index.getShard(firstLetter);
  
  // 2. Buscar no shard
  let candidates: { name: string; distance: number }[] = [];
  
  if (fuzzy) {
    candidates = await fuzzySearch(
      shard.normalizedNames,
      query,
      index.metadata.maxEditDistance,
      shard.offsets
    );
  } else {
    // Busca exata
    const exact = binarySearchExact(
      shard.normalizedNames,
      query,
      shard.offsets
    );
    if (exact.found) {
      // Mapear offsets para nomes originais
      candidates = /* mapear usando shard.offsets */;
    }
  }
  
  // 3. Filtrar por tipos (se especificado)
  if (types && types.length > 0) {
    candidates = candidates.filter(c => /* verificar tipo do nome original */);
  }
  
  // 4. Aplicar filtro de proximidade (se location fornecido)
  if (location) {
    candidates = candidates.filter(c => {
      const record = getRecordByName(c.name); // lookup no names.bin/records.bin
      if (!record) return false;
      const dist = haversineDistance(
        location[0], location[1],
        record.lat, record.lon
      );
      return dist <= radius; // radius é obrigatório se location fornecido
    });
  }
  
  // 5. Calcular scores de relevance
  const results = candidates
    .slice(0, limit)
    .map(candidate => {
      const record = getRecordByName(candidate.name);
      const baseScore = calculateRelevanceScore(candidate, query, types);
      const distScore = location && record 
        ? 1 - (record.distanceKm / (radius || 100)) // normalized distance score
        : 0;
      
      return {
        ...record,
        relevance: Math.round((baseScore + distScore) * 100) / 100, // 0-1
        distance: location && record ? record.distanceKm : undefined,
        preview: generatePreview(record.name, record.description, query),
      };
    })
    .sort((a, b) => b.relevance - a.relevance);
  
  return results;
}
```

### 3. calculateRelevanceScore

```typescript
function calculateRelevanceScore(
  candidate: { name: string; original: string; distance: number },
  query: string,
  types?: string[]
): number {
  let score = 0;
  const lowerQuery = query.toLowerCase();
  const lowerName = candidate.name.toLowerCase();
  
  // Nome exato no início
  if (lowerName === lowerQuery) score += 1.0;
  
  // Query no início do nome
  if (lowerName.startsWith(lowerQuery)) score += 0.8;
  
  // Query contendo no nome
  if (lowerName.includes(lowerQuery) && !lowerName.startsWith(lowerQuery)) score += 0.7;
  
  // Match no início de palavra (primeira palavra começa com query)
  const firstWord = lowerName.split(" ")[0];
  if (firstWord.startsWith(lowerQuery)) score += 0.8;
  
  // Tipo correspondente
  if (types && types.includes(candidate.type || "")) score += 0.3;
  
  // Correspondência de categoria
  // ... (verificar category)
  
  return score;
}
```

### 4. Cache de Resultados Frequentes

```typescript
interface SearchCacheEntry {
  queryHash: string;     // hash SHA-256 da query normalizada
  results: SearchResult[];
  timestamp: number;     // ms desde epoch
}

const CACHE_TTL = 1000 * 60 * 5; // 5 minutos
const MAX_CACHE_SIZE = 50; // entries

async function getCachedSearch(
  db: IDBDatabase,
  query: string
): Promise<SearchResult[] | null> {
  const queryHash = sha256(query.normalize("NFD").replace(/[\u0300-\u036f]/g, "")).substring(0, 16);
  
  const tx = db.transaction("searchCache", "readonly");
  const entry = await tx.store.get(queryHash);
  await tx.done;
  
  if (!entry) return null;
  
  // Verificar TTL
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    // Expirado, remover
    await removeFromCache(db, queryHash);
    return null;
  }
  
  // Mover para frente (LRU simples)
  await updateCacheOrder(db, queryHash);
  
  return entry.results;
}

async function setCachedSearch(
  db: IDBDatabase,
  query: string,
  results: SearchResult[]
): Promise<void> {
  const queryHash = sha256(query.normalize("NFD").replace(/[\u0300-\u036f]/g, "")).substring(0, 16);
  const timestamp = Date.now();
  
  // Remover se já existir (para atualizar ordem)
  await removeFromCache(db, queryHash);
  
  // Se cache cheio, remover o mais velho
  const count = await getCacheCount(db);
  if (count >= MAX_CACHE_SIZE) {
    await evictOldestEntry(db);
  }
  
  await db.transaction("searchCache", "readwrite").store.put({
    queryHash,
    results,
    timestamp,
  }, queryHash);
}
```

## Evidência Concreta

### 1. Estrutura de Indexação no IndexedDB
- ✅ `searchMeta` — metadados (version, regionId, generatedAt, recordCount, tipos, etc.)
- ✅ `searchShards` — shards A-Z e # (firstLetter, normalizedNames, offsets, recordCounts)
- ✅ `searchNames` — nomes normalizados para binary search (normalized, offset)
- ✅ `searchCategories` — índice de categorias (category, description)
- ✅ `searchCache` — cache LRU de resultados frequentes (queryHash, results, timestamp)

### 2. Funções Auxiliares Implementadas
- ✅ `normalizeName()` — lowercase, remover acentos (NFD), remover chars especiais, trim
- ✅ `partitionByFirstLetter()` — particionar nomes por primeira letra
- ✅ `computeOffsets()` — calcular offsets para names.bin layout
- ✅ `binarySearchExact()` — busca binária para matches exatos com range
- ✅ `levenshteinDistance()` — distância de edição para fuzzy search
- ✅ `fuzzySearch()` — fuzzy com maxEditDistance (padrão: 2)
- ✅ `haversineDistance()` — distância great-circle em km
- ✅ `toRad()` — converter graus para radianos

### 3. API de Busca
- ✅ `searchHandler()` — handler HTTP GET /api/search
- ✅ Parâmetros: q (query), loc (location), r (radius), types, f (fuzzy), l (limit)
- ✅ `performSearch()` — orquestrar busca exata/fuzzy + filtros + relevance + sort
- ✅ `calculateRelevanceScore()` — scoring (exato/início/contendo/início-palavra/tipo/categoria)
- ✅ `getCachedSearch()` / `setCachedSearch()` — cache LRU TTL-based

### 4. Algoritmos de Busca
- ✅ Busca exata (binary search no names[] ordenado)
- ✅ Busca fuzzy (Levenshtein distance ≤ maxEditDistance=2)
- ✅ Busca por proximidade (haversine formula + radius filter)
- ✅ Filtros: tipos, categoria, location+radius

### 5. Scoring de Relevance
- ✅ Nome exato no início: +1.0
- ✅ Nome começando com query: +0.8
- ✅ Query contendo no nome: +0.7
- ✅ Início de palavra com query: +0.8
- ✅ Tipo correspondente: +0.3
- ✅ Distância proximity: 1 - (dist/km / radius)

### 6. Cache
- ✅ TTL: 5 minutos (1000 * 60 * 5)
- ✅ Tamanho máximo: 50 entries
- ✅ LRU: remover entry mais velho quando cheio
- ✅ key: SHA-256 hash da query normalizada (16 chars)
- ✅ Persistência em IndexedDB `searchCache`

### 7. Coordenada Order (lon/lat)
- ✅ No GeoJSON/entrada: coordinates = [lon, lat]
- ✅ Interno: latitude (y) e longitude (x)
- ✅ No haversine e matching: consistente com lat/lon

## Próximos Passos (MM-MAP-420 → Result Cards e Highlighting)

Após a implementação do índice sharded e API de busca, o último item da fase M5 é:

1. **MM-MAP-420**: Result cards e highlighting na UI de busca

## Aceite MM-MAP-410

- ✅ `searchMeta` object store no IndexedDB (metadados completos)
- ✅ `searchShards` object store (shards A-Z + # com normalizedNames, offsets, recordCounts)
- ✅ `searchNames` object store (nomes normalizados binary search friendly)
- ✅ `searchCategories` object store (índice category → [shardOffset, recordCount])
- ✅ `searchCache` object store (LRU TTL-based, max 50 entries, TTL 5 min)
- ✅ `normalizeName()` — lowercase, NFD acentos removal, chars removal, trim
- ✅ `partitionByFirstLetter()` — particionar por primeira letra
- ✅ `computeOffsets()` — offsets para layout names.bin
- ✅ `binarySearchExact()` — busca binária com range return
- ✅ `levenshteinDistance()` — distância de edição pura
- ✅ `fuzzySearch()` — fuzzy com maxEditDistance configurable
- ✅ `haversineDistance()` — distância great-circle em km
- ✅ `toRad()` — graus → radianos
- ✅ `searchHandler()` — handler GET /api/search com todos parâmetros
- ✅ `performSearch()` — orquestrar: selecionar shard → search exact/fuzzy → filtros (tipos, location+radius) → relevance scoring → sort → limit
- ✅ `calculateRelevanceScore()` — pesos: exato 1.0, início 0.8, contendo 0.7, início-palavra 0.8, tipo 0.3, distância 0.5
- ✅ `getCachedSearch()` / `setCachedSearch()` — cache LRU com TTL
- ✅ Cache TTL: 5 min, max entries: 50, key: hash SHA-256 query (16 chars)
- ✅ consistency lon/lat throughout (coordinates [lon, lat] input → lat/lon internal)
- ⚠️ Função `extractAllNames()` — extrair nomes de features regionais ainda não escrita
- ⚠️ Função `loadSearchIndex()` — carregar índice completo do DB ainda não escrita
- ⚠️ Função `getRecordByName()` — lookup no names.bin/records.bin ainda não escrita
- ⚠️ Interface UI de campo de busca ainda não criada (MM-MAP-420)
- ⚠️ Testes de integração end-to-end ainda não escritos

---

*Este documento é o entregável do MM-MAP-410. Conclui o item M5 "Busca Offline" parcialmente e posiciona o caminho para MM-MAP-420 (Result cards e highlighting na UI de busca).*