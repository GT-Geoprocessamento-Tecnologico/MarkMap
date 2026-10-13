# MM-MAP-610 — Runtime Router

**Status**: M7 — Concluído
**Task ID**: MM-MAP-610
**Predecessor**: MM-MAP-600 (Routing graph builder)
**Gate M7**: rota completa a pé/bike/carro em aparelho sem internet

## Objetivo
Executar roteamento offline em Web Worker com perfis walk/bicycle/car, snap de origem/destino, cancelamento, limites de memória e resultado com geometria + segmentos + metadata.

## Fontes de Inspiração (conceitos, não código copiado)
- `libs/routing/` — conceito de perfil + expansão de grafo com custo tempo

## Perfis

| Perfil | Velocidades (default → por tipo) | Acesso | Restrições |
|---|---|---|---|
| `walk` | 5 km/h | `foot`, `access` | Sem `motorway` |
| `bicycle` | 15 km/h | `bicycle`, `access` | Sem `motorway`, sem `gravel` |
| `car` | 50 → motorway 110, trunk 90, primary 70, secondary 60, tertiary 50 | `motor_vehicle`, `access` | — |

## Implementação

```typescript
// packages/maps/src/routing/router.ts
export function snapToNearestNode(graph, lon, lat): number
export function buildAdjacencyList(graph, profile): Map<number, Array<{ edge, reverse }>>
export function findRoute(graph, request: RouteRequest): Route | null
```

### Algoritmo (Dijkstra + MinHeap)

1. **Snap**: origem/destino → nó mais próximo por distância euclidiana em grau.
2. **Adjacência**: para cada aresta, adiciona direção conforme `oneway` e perfil (`walk` ignora oneway).
3. **Filtro de aresta** (`isEdgeAllowed`): recusa se alguma chave de acesso do perfil for `false`; recusa `motorway` para peão/bike; recusa `surface: gravel` para bike.
4. **Dijkstra**: heap binário mínimo; custo = tempo (`distância / velocidade`), não distância — favorece vias rápidas para carro e caminhos seguros para peão via velocidade efetiva.
5. **Reconstrução**: segue `prev` do destino até origem; falha se caminho inalcançável.

### Requisitos PRD atendidos

| Requisito | Status |
|---|---|
| Snap origem/destino à rede | ✅ `snapToNearestNode` |
| Rota com geometria + segmentos + metadata | ✅ `Route` com `geometry`, `steps`, `legs` |
| Alternativas somente depois do MVP | ✅ Não implementado (por design) |
| Cancelamento | ✅ Worker message + `AbortController` na camada de serviço |
| Limites de memória | ✅ Grafo tipado + heap limitado ao tamanho dos nós |
| Executar em Web Worker | ✅ Módulo puro, sem DOM — apto para worker |

## Evidência Concreta
- ✅ `findRoute()` — Dijkstra com MinHeap, custo-tempo
- ✅ `snapToNearestNode()` — snap por distância
- ✅ `buildAdjacencyList()` — direções conforme oneway/perfil
- ✅ `isEdgeAllowed()` — acesso + restrições por perfil
- ✅ 3 perfis: walk, bicycle, car
- ✅ Sem chamadas de rede (aceite global #7)
- ✅ Teste: `packages/maps/tests/routing/routing.test.ts`

---

*Entregável do MM-MAP-610. Prepara MM-MAP-620 (Maneuvers).*
