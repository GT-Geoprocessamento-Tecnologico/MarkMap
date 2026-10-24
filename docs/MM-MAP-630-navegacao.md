# MM-MAP-630 — Navegação

**Status**: M7 — Concluído
**Task ID**: MM-MAP-630
**Predecessor**: MM-MAP-620 (Maneuvers)
**Gate M7**: rota completa a pé/bike/carro em aparelho sem internet

## Objetivo
GPS tracking, progresso da rota, detecção off-route, recálculo local, distância para próxima manobra, ETA, chegada e wake behavior apenas quando necessário.

## Fontes de Inspiração (conceitos, não código copiado)
- `libs/routing/` — progresso de rota e recálculo (conceito)

## Implementação

### 1. Estado de navegação (geo)

```typescript
// packages/geo/src/navigation.ts
export type ArrivalStatus = 'arrived' | 'possibly-arrived' | 'en-route';

export interface NavigationState {
  readonly current: Coordinate;
  readonly destination: Coordinate;
  readonly distanceM: number;
  readonly bearingDeg: number | null;
  readonly currentHeadingDeg: number | null;
  readonly turnAngleDeg: number | null;   // giro curto do heading ao bearing
  readonly arrivalRadiusM: number;
  readonly accuracyM: number | null;
  readonly estimatedInsideArrivalRadius: boolean;
  readonly arrived: boolean;
  readonly arrivalStatus: ArrivalStatus;
}
```

- **Chegada**: `arrivalRadiusM` padrão 10 m; usa `accuracyM` do GPS para `possibly-arrived` vs `arrived`.
- **Bearing/turn**: `initialBearingDeg` + ângulo assinado normalizado (positivo = horário).

### 2. Progresso da rota e off-route

| Conceito | Implementação |
|---|---|
| Route progress | Projeta posição atual sobre o polyline da rota; `distanceRemaining` = comprimento restante |
| Off-route | Desvio > limiar (ex.: 25 m + janela de amostras) → dispara `reroute` |
| Recálculo local | `findRoute(graph, { origin: posição atual, destination, profile })` — 100% offline |
| Distância à próxima manobra | Soma das arestas até o próximo `Maneuver` no `steps[]` |
| ETA | `duration` restante acumulado (custo-tempo do router) |
| Wake behavior | Wake lock solicitado somente durante navegação ativa e liberado na chegada/pausa |

### 3. Tracking

- Posição via `device-location.ts` (GPS do dispositivo).
- Throttling de update para não acordar bateria desnecessariamente.
- Sem rede: todo cálculo usa grafo e rota empacotados (aceite global #7).

## Evidência Concreta
- ✅ `NavigationState` com distance/bearing/turn/arrival
- ✅ `ArrivalStatus` de 3 estados (arrived/possibly-arrived/en-route)
- ✅ Cálculo geodésico local (`geodesicDistanceM`, `initialBearingDeg`)
- ✅ Progresso + ETA + próxima manobra a partir do `Route`
- ✅ Recálculo local via `findRoute` (sem API remota)
- ✅ Wake lock somente quando necessário

---

*Entregável do MM-MAP-630. Prepara MM-MAP-640 (Voz).*
