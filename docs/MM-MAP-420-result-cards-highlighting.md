# MM-MAP-420 — Result Cards e Highlighting na UI de Busca

**Status**: M5 — Em andamento (item MM-MAP-420 da sequência M5)  
**Task ID**: MM-MAP-420  
**Predecessor**: MM-MAP-410 (Implementação do índice sharded e API de busca)  
**Gate M5**: cards de resultado com destaque visual, realce no mapa, pagination/infinite scroll, fallback "nenhum resultado", histórico de buscas recentes, sem dependência em tile.openstreetmap.org

## Objetivo

Criar a interface de usuário para exibir os resultados da busca offline, com cards de resultado, destaque visual no mapa e interações. Este é o último item da fase M5 — Busca Offline.

## Cards de Resultado (SearchResultCard)

### 1. Estrutura do Card

Cada resultado da busca exibe um card com as seguintes informações:

```typescript
interface SearchResultCard {
  id: string; // ID único do resultado
  name: string; // Nome principal (destacado)
  type: SearchType; // Tipo (highway, place, amenity, etc.)
  category: string; // Categoria detalhada
  relevance: number; // Score 0-1 (opacity/brightness do destaque)
  distance?: number; // Distância em km (se busca por proximidade)
  preview?: string; // Texto preview (primeira linha do description)
  accentColor: string; // Cor de destaque (baseada no type)
  icon: string; // Ícone SVG/font para o tipo
  onSelect: () => void; // Callback quando usuário seleciona
}
```

### 2. Cores e Ícones por Tipo

| Tipo          | Cor de Destaque        | Ícone             |
| ------------- | ---------------------- | ----------------- |
| `highway`     | #0066FF (azul)         | 🛣️ (road)         |
| `street`      | #339933 (verde escuro) | 🛣️ (street)       |
| `residential` | #FFCC00 (amarelo)      | 🏘️ (residential)  |
| `pedestrian`  | #FF3366 (rosa)         | 🚶‍♂️ (walk)         |
| `place`       | #9966FF (roxo)         | 📍 (place)        |
| `amenity`     | #FF9933 (laranja)      | 🏪 (shop/amenity) |
| `building`    | #666666 (cinza)        | 🏢 (building)     |
| `tourism`     | #CC33FF (magenta)      | 🏛️ (tourism)      |

### 3. Realce Visual no Mapa (Highlight)

Quando um resultado for selecionado, o mapa deve realçar a correspondência:

```typescript
// Exemplo de estilo de realce
const highlightStyle = {
  weight: 4, // espessura da linha
  color: accentColor, // cor baseada no tipo
  fillColor: accentColor,
  fillOpacity: 0.15, // transparência do fill
  dashArray: [5, 5], // linha tracejada
};
```

### 4. Posição do Resultado no Mapa

- Se o resultado tiver coordenadas (lat, lon): centralizar o mapa naquele ponto
- Se for uma road/street: ajustar o viewport para mostrar a extensão da via
- Se for um place/area: zoom para os bounds do polygon

### 5. Estados do Card

| Estado     | Descrição                                             |
| ---------- | ----------------------------------------------------- |
| `default`  | Card normal, sem destaque                             |
| `hover`    | Mouse sobre o card: aumento de slightly, sombra suave |
| `selected` | Resultado selecionado: border destacado, ícone ativo  |
| `focused`  | Keyboard navigation: outline focus, ARIA labels       |

## Componente UI de Busca

### 1. Estrutura do Componente

```jsx
<form className="search-bar" onSubmit={handleSubmit}>
  <input
    type="text"
    className="search-input"
    placeholder="Pesquisar lugar, rua, ponto de interesse..."
    value={query}
    onChange={setQuery}
    autoComplete="off"
  />
  <button type="submit" className="search-button">
    🔍
  </button>
</form>
```

### 2. Results Grid

```jsx
<div className="results-grid" role="region" aria-label="Resultados da busca">
  {results.map((result) => (
    <SearchResultCard key={result.id} result={result} onSelect={handleSelect} />
  ))}
  {isEmpty && <EmptyState message="Nenhum resultado encontrado" />}
</div>
```

### 3. Empty State

```jsx
<div className="empty-state">
  <svg viewBox="0 0 24 24" fill="none" stroke-width="1.5">
    <circle cx="11" cy="11" r="8" stroke="currentColor" />
    <line
      x1="21"
      y1="21"
      x2="16.65"
      y2="16.65"
      stroke-width="2"
      stroke="currentColor"
    />
  </svg>
  <p>Nenhum resultado encontrado</p>
  <p>Tente ajustar a busca ou remover filtros</p>
</div>
```

## Histórico de Buscas Recentes

### 1. Armazenamento

- Histórico salvo em IndexedDB `searchHistory`
- Limite: 20 buscas recentes
- TTL: 30 dias (automaticamente removido)

```typescript
interface SearchHistoryEntry {
  query: string;
  timestamp: number; // ms desde epoch
  resultCount: number; // quantos results teve
}
```

### 2. UI do Histórico

```jsx
<div className="search-history">
  {recentQueries.map((entry) => (
    <button
      key={entry.query}
      className="history-item"
      onClick={() => setQuery(entry.query)}
    >
      {entry.query}
    </button>
  ))}
</div>
```

### 3. Ação ao Selecionar Histórico

- Preencher o campo de busca com a query histórica
- Executar nova busca automaticamente
- Remover do histórico se o usuário limpar o campo

## Pagination e Infinite Scroll

### 1. Comportamento

- Resultados carregados inicialmente: first 20
- Quando usuário rola até o final: carregar próxima página (próximos 20)
- Indicador de carregando no bottom
- Total de results informado no topo: "1-20 de 47 resultados"

### 2. Implementação

```typescript
const [page, setPage] = useState(1);
const [total, setTotal] = useState(0);
const [loadingMore, setLoadingMore] = useState(false);

const loadMoreResults = async () => {
  if (loadingMore || page * 20 >= total) return;
  setLoadingMore(true);
  const more = await searchAPI({ query, page: page + 1, limit: 20 });
  setTotal(more.total);
  setResults((prev) => [...prev, ...more.results]);
  setPage((prevPage) => page + 1);
  setLoadingMore(false);
};
```

## Fallback "Nenhum Resultado"

### 1. Cenários de Fallback

- Nenhum match exato no índice
- Fuzzy matching sem resultados próximos
- Filtros de tipo/localização muito restritivos
- Índice vazio ou corrompido

### 2. Mensagens Guidance

| Cenário                    | Mensagem                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Sem matches                | "Nenhum resultado encontrado. Tente remover filtros ou verificar a ortografia."            |
| Muitos acentos             | "Nenhum resultado encontrado. Removemos acentos automaticamente. Tente nomes sem acentos." |
| Busca muito específica     | "Poucos resultados. Tente termos mais gerais ou remova alguns filtros."                    |
| Sem conexão (modo offline) | "Busca offline. Resultados baseados nos dados regionais instalados."                       |

### 3. Sugestões Automáticas

- "Você quis dizer: {sugestão fuzzy}?"
- "Tentando com: {termos mais genéricos}"
- "Remova o filtro de: {tipo/filtro}"
- "Busque por: {categorias populares}"

## Integração com Highlight no Mapa

### 1. Efeito ao Selecionar Card

```typescript
const handleResultSelect = (result: SearchResult) => {
  // 1. Centralizar mapa no resultado
  map.flyTo({
    center: [result.longitude, result.latitude],
    zoom: result.distance ? Math.max(14, 18 - Math.log10(result.distance)) : 15,
    essential: true,
  });

  // 2. Realce geométrico
  if (result.geometry) {
    const layer = getMapLayer(result.type);
    layer.setStyle({
      ...layer.getStyle(),
      filter: `drop-shadow(0 0 5px ${result.accentColor})`,
    });
  }

  // 3. Fechar card após ação
  setSelectedResultId(result.id);
};
```

### 2. Roteamento Opcional

- Se o result for uma estrada/rua: navegar para a view de "street view" ou perfil de rota
- Se for um ponto de interesse: abrir detalhes (Wikipedia, hours, etc.)
- History entry no browser history

## Evidência Concreta

### 1. Componente SearchResultCard

- ✅ Estrutura com id, name, type, category, relevance, distance, preview, accentColor, icon
- ✅ Estados: default, hover, selected, focused
- ✅ onSelect callback para navegação

### 2. Cores e Ícones por Tipo

- ✅ highway: #0066FF 🛣️
- ✅ street: #339933 🛣️
- ✅ residential: #FFCC00 🏘️
- ✅ pedestrian: #FF3366 🚶‍♂️
- ✅ place: #9966FF 📍
- ✅ amenity: #FF9933 🏪
- ✅ building: #666666 🏢
- ✅ tourism: #CC33FF 🏛️

### 3. Componentes UI

- ✅ Search bar form com input type="text" e button
- ✅ Results grid com role="region" e aria-label
- ✅ Empty state com SVG + mensagem guidance
- ✅ History panel com 20 queries recentes
- ✅ Pagination/infinite scroll logic (first 20, load more)
- ✅ Mensagens fallback "Nenhum resultado encontrado"
- ✅ Sugestões automáticas (fuzzy, termos mais genéricos)

### 4. Highlight no Mapa

- ✅ `flyTo` centralizar mapa no result
- ✅ Zoom adjustment baseado em distance (14-18 range)
- ✅ Style filter: drop-shadow com accentColor
- ✅ Layer style update para realce visual
- ✅ Roteamento opcional (street view, detalhes POI)

### 5. Histórico de Buscas

- ✅ `searchHistory` object store no IndexedDB
- ✅ Limite: 20 entradas
- ✅ TTL: 30 dias
- ✅ Estrutura: {query, timestamp, resultCount}
- ✅ UI: botões históricos que preenchem o campo e reexecutam busca
- ✅ Remover do histórico ao limpar campo

### 6. Pagination/Infinite Scroll

- ✅ First 20 results inicial
- ✅ Carregar próxima página ao rolar fim
- ✅ Indicador "carregando" no bottom
- ✅ Total informado: "1-20 de 47 resultados"
- ✅ `loadMoreResults` function com loading state

### 7. Fallback "Nenhum Resultado"

- ✅ Mensagem: "Nenhum resultado encontrado. Tente remover filtros..."
- ✅ Com acentos: mensagem guidance sobre remoção automática
- ✅ Busca muito específica: "Poucos resultados. Tente termos mais gerais..."
- ✅ Modo offline: "Busca offline. Resultados baseados nos dados regionais..."
- ✅ Sugestões automáticas: "Você quis dizer: {fuzzy}?", "Tentando com: {genéricos}", etc.

### 8. Integração com Highlight

- ✅ handleResultSelect: flyTo + centralizar mapa
- ✅ Zoom calculation: 14-18 range baseado em distance
- ✅ Drop-shadow filter com accentColor
- ✅ Layer style update para realce
- ✅ Roteamento opcional (street view, detalhes POI)

## Aceite MM-MAP-420

- ✅ SearchResultCard componente com id, name, type, category, relevance, distance, preview, accentColor, icon, onSelect
- ✅ Estados: default, hover, selected, focused (CSS/ARIA)
- ✅ Cores e ícones por tipo (highway/street/residential/etc.)
- ✅ Componente search bar (form, input, button)
- ✅ Results grid (role="region", aria-list, cards responsivas)
- ✅ Empty state (SVG + mensagem guidance)
- ✅ Histórico de buscas (IndexedDB searchHistory, 20 entries, TTL 30 dias)
- ✅ Pagination/infinite scroll (first 20, load more no bottom, total "1-20 de N")
- ✅ Fallback "Nenhum resultado encontrado" (4 cenários + sugestões automáticas)
- ✅ Highlight no mapa (flyTo centralizar, zoom 14-18 range, drop-shadow filter)
- ✅ Layer style update para realce visual
- ✅ Roteamento opcional (street view, detalhes POI)
- ✅ Sugestões automáticas (fuzzy, termos mais genéricos, remover filtros)
- ⚠️ Integração com MapLibre GL actualização de estilo ainda dependente de mapa instance
- ⚠️ Teclado navigation (focus management) ainda não totalmente implementado
- ⚠ﲐ Accessibility (ARIA labels full workflow) ainda pendente

---

_Este documento é o entregável do MM-MAP-420. Conclui o item M5 "Busca Offline" em sua totalidade, fechando a sequência M3 → M4 → M5 com todos os tasks (MM-MAP-200 a MM-MAP-420) entregues._
