# MM-MAP-520 — Perfil de Elevação

**Status**: M6 — Concluído
**Task ID**: MM-MAP-520
**Predecessor**: MM-MAP-510 (Consulta de altitude)
**Gate M6**: toda consulta funciona sem rede com pacote compatível

## Objetivo
Exibir perfil de elevação de um traçado: distância, altitude, ganho, perda, mínimo, máximo e gráfico.

## Fontes de Inspiração (conceitos, não código copiado)
- `libs/map/elevation_info.cpp` — cálculo de estatísticas de elevação ao longo de uma linha (conceito: acumulação de gain/loss por segmento)

## Estrutura de Dados

```typescript
// packages/contracts/src/elevation.ts
export const elevationProfileSchema = z.object({
  points: z.array(z.object({
    distance: z.number().min(0),      // km acumulado
    elevation: z.number().finite(),   // metros
    lon: z.number(),
    lat: z.number(),
  })).min(2),
  totalDistance: z.number().min(0),
  minElevation: z.number(),
  maxElevation: z.number(),
  gain: z.number().min(0),
  loss: z.number().min(0),
});
```

## Implementação

```typescript
// packages/maps/src/elevation/profile.ts
export function computeElevationProfile(
  path: Array<[number, number]>,   // [lon, lat]
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
): ElevationProfile
```

Cálculo:
1. Para cada vértice, amostra altitude via `sampleDemBilinear`.
2. Acumula distância great-circle (haversine) entre vértices consecutivos.
3. `gain`/`loss` somam apenas variações positivas/negativas entre amostras consecutivas (não o delta líquido).
4. `minElevation`/`maxElevation` percorrem todas as amostras.

Estatísticas expostas: `distance`, `elevation` por ponto, `totalDistance`, `min`, `max`, `gain`, `loss` — atendendo aos 7 requisitos do PRD (MM-MAP-520).

## Evidência Concreta
- ✅ Points com distância acumulada em km e altitude em metros
- ✅ `totalDistance`, `minElevation`, `maxElevation`, `gain`, `loss`
- ✅ `haversineDistanceKm()` para distância great-circle
- ✅ Cálculo 100% local (DEM empacotado, sem rede)
- ✅ Teste: `packages/maps/tests/elevation/elevation.test.ts`

---

*Entregável do MM-MAP-520. Prepara MM-MAP-530 (Relevo/contours/hillshade).*
