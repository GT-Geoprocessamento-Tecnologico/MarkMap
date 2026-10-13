# MM-MAP-530 — Relevo (Contours, Hillshade, Picos, Outdoor Style)

**Status**: M6 — Concluído
**Task ID**: MM-MAP-530
**Predecessor**: MM-MAP-520 (Perfil de elevação)
**Gate M6**: toda consulta funciona sem rede com pacote compatível

## Objetivo
Exibir relevo no mapa: contours vetoriais, hillshade quando suportado, picos e estilo outdoor.

## Fontes de Inspiração (conceitos, não código copiado)
- `generator/isolines_generator.cpp` — geração de isolinhas via marching squares (conceito: classificação de célula 2×2)

## Estrutura de Dados

```typescript
// packages/contracts/src/elevation.ts
export const contourSchema = z.object({
  elevation: z.number().finite(),
  interval: z.number().positive(),
  isMajor: z.boolean().true(),
  geometry: z.array(z.tuple([z.number(), z.number()])), // [lon, lat]
});

export const contourLayerSchema = z.object({
  interval: z.number().positive(),
  majorInterval: z.number().positive(),
  minElevation: z.number(),
  maxElevation: z.number(),
  contours: z.array(contourSchema),
});
```

## Implementação

```typescript
// packages/maps/src/elevation/contours.ts
export function generateContours(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  interval: number,      // ex: 20
  majorInterval: number, // ex: 100
): ContourLayer
```

Algoritmo marching squares:
1. Para cada nível entre `ceil(min/interval)` e `floor(max/interval)`, classifica cada célula 2×2 em índice 0–15 a partir de quais cantos ≥ nível.
2. Descarta índices 0 e 15 (sem cruzamento) e células com `noDataValue`.
3. Interpola as posições das interseções nas bordas da célula.
4. Emite 1 ou 2 segmentos por célula conforme a tabela de 16 casos.
5. Marca `isMajor` quando `level % majorInterval === 0`.

## Relevo no runtime (MM-MAP-530)

| Recurso | Implementação |
|---|---|
| Contours | Camada MapLibre `line` a partir de `ContourLayer.contours` (major mais espessa) |
| Hillshade | `hillshade` raster-layer do MapLibre sobre o DEM empacotado (quando o pacote expõe raster) |
| Picos | Picos extraídos do DEM (máximos locais acima de limiar) + tags OSM `natural=peak` |
| Outdoor style | Extensão do `adaptOfflineStyle` com camadas de relevo + rótulos de altitude |

## Evidência Concreta
- ✅ `generateContours()` — marching squares completo (16 casos)
- ✅ `marchingSquares()` com filtro de `noDataValue`
- ✅ Intervalo base + intervalo mestre (major)
- ✅ Contours vetoriais prontos para camada MapLibre
- ✅ Teste: `packages/maps/tests/elevation/elevation.test.ts`
- ✅ Tudo local, sem rede (aceite global #8)

---

*Entregável do MM-MAP-530. Fecha o Gate M6.*
