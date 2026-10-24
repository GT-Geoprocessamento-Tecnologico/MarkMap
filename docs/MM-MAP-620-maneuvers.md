# MM-MAP-620 — Maneuvers

**Status**: M7 — Concluído
**Task ID**: MM-MAP-620
**Predecessor**: MM-MAP-610 (Runtime router)
**Gate M7**: rota completa a pé/bike/carro em aparelho sem internet

## Objetivo
Gerar manobras de navegação: vire esquerda/direita, mantenha, rotatória, saída, continue e chegada.

## Fontes de Inspiração (conceitos, não código copiado)
- `libs/routing/` — geração de manobras a partir de mudança de bearing entre arestas (conceito; **nenhum código GPL copiado**)

## Estrutura de Dados

```typescript
// packages/contracts/src/routing.ts
export const maneuverSchema = z.object({
  type: z.enum([
    "depart", "continue", "turn_left", "turn_right",
    "roundabout", "roundabout_exit", "u_turn", "arrive",
  ]),
  location: z.tuple([z.number(), z.number()]),
  distance: z.number(),
  duration: z.number(),
  roadName: z.string().optional(),
  modifier: z.enum([
    "slight_left", "left", "sharp_left",
    "slight_right", "right", "sharp_right",
    "uturn", "straight",
  ]).optional(),
});
```

## Implementação

```typescript
// packages/maps/src/routing/router.ts (interno)
function generateManeuver(edges, index, request): Maneuver
```

### Regras de classificação (bearing delta entre aresta anterior e atual)

| Delta de bearing | Tipo | Modifier |
|---|---|---|
| ±0–15° | `continue` | `straight` |
| 15–45° direita | `turn_right` | `slight_right` |
| 45–135° direita | `turn_right` | `right` |
| 135–165° direita | `turn_right` | `sharp_right` |
| 15–45° esquerda | `turn_left` | `slight_left` |
| 45–135° esquerda | `turn_left` | `left` |
| 135–165° esquerda | `turn_left` | `sharp_left` |
| >165° | `u_turn` | `uturn` |
| Início da rota | `depart` | — |
| Último segmento | `arrive` | — |

- **Roundabout**: detectado por `highwayType: "roundabout"`/`junction: roundabout` na aresta → tipo `roundabout` + `roundabout_exit` na saída.
- **Nome de via**: `roadName` propagado a partir de `edge.name`.

## Evidência Concreta
- ✅ Tipos: depart, continue, turn_left/right, roundabout (+exit), u_turn, arrive
- ✅ Modifiers: slight/sharp/straight/uturn
- ✅ Classificação por faixas de bearing
- ✅ `roadName` preenchido a partir da aresta
- ✅ Teste: `packages/maps/tests/routing/routing.test.ts`

---

*Entregável do MM-MAP-620. Prepara MM-MAP-630 (Navegação).*
