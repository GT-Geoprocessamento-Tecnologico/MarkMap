# MM-MAP-510 — Consulta de Altitude

**Status**: M6 — Concluído
**Task ID**: MM-MAP-510
**Predecessor**: MM-MAP-500 (Pipeline DEM/contours)
**Gate M6**: toda consulta funciona sem rede com pacote compatível

## Objetivo

Fornecer consulta de altitude no cursor/local, em ponto capturado e em waypoint, com cache local e sem chamadas de rede.

## Fontes de Inspiração (conceitos, não código copiado)

- `generator/srtm_parser.cpp` — leitura de grid DEM (conceito: indexação por bounds + resolução)

## Implementação

### 1. Amostragem de altitude (nearest e bilinear)

```typescript
// packages/maps/src/elevation/dem.ts
export function sampleDem(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  lon: number,
  lat: number,
): number | null;
export function sampleDemBilinear(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  lon: number,
  lat: number,
): number | null;
```

- `sampleDem`: nearest-neighbor; retorna `null` fora de bounds ou em `noDataValue`.
- `sampleDemBilinear`: interpolação bilinear entre os 4 vizinhos; cai para `sampleDem` se qualquer canto for noData.
- Ambos protegidos contra acesso a índice fora do grid (`strict noUncheckedIndexedAccess`).

### 2. Pontos de consulta no runtime

| Consulta                    | Entrada                 | Saída            |
| --------------------------- | ----------------------- | ---------------- |
| Altitude no cursor          | `[lon, lat]` do pointer | `number \| null` |
| Altitude em ponto capturado | ponto salvo             | `number \| null` |
| Altitude em waypoint        | waypoint GPX/importado  | `number \| null` |

### 3. Cache local

- DEM é carregado uma vez por região e mantido em memória (typed array).
- Cache LRU de coordenada → altitude evita recomputação em mousemove.
- Sem rede: consulta usa exclusivamente o DEM do pacote offline (aceite global #8).

## Evidência Concreta

- ✅ `sampleDem()` — lookup nearest com guardas de bounds/noData
- ✅ `sampleDemBilinear()` — interpolação suave com fallback
- ✅ Consulta sem rede a partir do DEM empacotado
- ✅ Tipagem estrita: retorna `number | null` (sem valores fantasma)

---

_Entregável do MM-MAP-510. Prepara MM-MAP-520 (Perfil de elevação)._
