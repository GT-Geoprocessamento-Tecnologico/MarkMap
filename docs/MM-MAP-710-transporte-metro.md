# MM-MAP-710 — Transporte/Metro

**Status**: M8 — Concluído
**Task ID**: MM-MAP-710
**Predecessor**: MM-MAP-700 (Wikipedia/Wikidata offline)
**Gate M8**: conteúdo de lugares e transporte disponível offline

## Objetivo
MVP de transporte: estações, linhas, cor/nome, overlay no mapa e busca por estação. Roteamento multimodal somente depois de evidência de necessidade e dados suficientes (explicitamente fora do MVP).

## Fontes de Inspiração (conceitos, não código copiado)
- `libs/transit/` — modelo estação/linha/rede (conceito; **nenhum código GPL copiado**)

## Estrutura de Dados

```typescript
// packages/contracts/src/content.ts
export const transitStationSchema = z.object({
  id: z.string(),
  name: z.string(),
  lon: z.number(),
  lat: z.number(),
  lines: z.array(z.string()),     // ids de linhas que servem a estação
  networkId: z.string().optional(),
});

export const transitLineSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),              // ex: "#FF0000"
  networkId: z.string().optional(),
  stationIds: z.array(z.string()),
});

export const transitNetworkSchema = z.object({
  id: z.string(),
  name: z.string(),
  stations: z.array(transitStationSchema),
  lines: z.array(transitLineSchema),
  attribution: z.string(),
});
```

## Runtime

```typescript
// packages/maps/src/content/transit.ts
export class TransitStore {
  load(network: TransitNetwork): void
  getStation(id: string): TransitStation | undefined
  getLine(id: string): TransitLine | undefined
  searchStations(query: string, limit?: number): TransitStation[]
  getLinesForStation(stationId: string): TransitLine[]
  getStationsNearby(lon: number, lat: number, radiusKm: number): TransitStation[]
}
```

### MVP coberto

| Requisito | Status |
|---|---|
| Estações | ✅ `TransitStation` com coordenadas |
| Linhas | ✅ `TransitLine` com cor/nome |
| Cor/nome | ✅ `color` (hex) + `name` |
| Overlay no mapa | ✅ Camada MapLibre de pontos/linhas a partir do `TransitNetwork` |
| Busca por estação | ✅ `searchStations()` (substring, case-insensitive) |
| Roteamento multimodal | ⏸ Fora do MVP (por decisão do PRD) |

## Evidência Concreta
- ✅ Schemas `transitStationSchema`, `transitLineSchema`, `transitNetworkSchema`
- ✅ `TransitStore` com índices de estação/linha + busca + nearby
- ✅ `getLinesForStation()` — resolução estação→linhas
- ✅ Overlay e busca offline (sem rede)
- ✅ Multimodal explicitamente deferido (conforme PRD)

---

*Entregável do MM-MAP-710. Fecha o Gate M8.*
