# MM-MAP-800 — Android Auto

**Status**: M9 — Concluído
**Task ID**: MM-MAP-800
**Predecessor**: MM-MAP-710 (Transporte/metro) — Gate M8
**Pré-requisito do PRD**: executar somente depois de M7 estável
**Gate M9**: integração automotiva com escopo aprovado

## Objetivo
Implementar integração Android Auto (mapa, navegação turn-by-turn, busca, destinos, voz) com escopo aprovado, usando padrões de Intent/deep link.

## Fontes de Inspiração (conceitos, não código copiado)
- `android/app/src/main/java/app/organicmaps/car/` — padrões de templates de carro (conceito)
- `organicmaps/api-android` — **apenas** padrões de Intent/deep link (conceito)

> Regra: nenhum código GPL do Organic Maps é copiado. Integração nativa Capacitor somente com escopo aprovado.

## Implementação

```typescript
// packages/maps/src/automotive/index.ts
export interface AutomotiveSession {
  platform: "android-auto" | "carplay";
  connected: boolean;
  appVersion: string;
  templateType: "map" | "list" | "navigation" | "place";
  capabilities: Array<"turn-by-turn" | "search" | "destinations" | "voice">;
}

export interface AutomotiveNavigationState {
  active: boolean;
  distanceToNextManeuver: number;
  nextManeuverType: string;
  nextRoadName?: string;
  totalDistanceRemaining: number;
  etaSeconds: number;
  currentSpeedKph: number;
  offRoute: boolean;
}

export interface AutomotiveAdapter {
  isSupported(): boolean;
  startSession(): Promise<AutomotiveSession>;
  endSession(): Promise<void>;
  updateNavigation(state: AutomotiveNavigationState): void;
  showDestination(lon: number, lat: number, name: string): void;
  onManeuverChange(callback: (state: AutomotiveNavigationState) => void): void;
}

export class AndroidAutoAdapter implements AutomotiveAdapter { ... }
```

### Fluxo

1. `isSupported()` — detecta ponte Android Auto (`window.androidAuto` / plugin Capacitor).
2. `startSession()` — cria sessão com templates (`map`, `navigation`, `list`, `place`) e capabilities.
3. `updateNavigation()` — publica estado (distância à manobra, ETA, velocidade, off-route) para o template de navegação.
4. `showDestination()` — envia destino via ponte/deep link.
5. `endSession()` — encerra e limpa estado.

### Templates e capabilities

| Template | Uso |
|---|---|
| `map` | Mapa em tela do carro |
| `navigation` | Turn-by-turn ativo |
| `list` | Lista de destinos/busca |
| `place` | Detalhe de lugar |

Capabilities: `turn-by-turn`, `search`, `destinations`, `voice`.

## Evidência Concreta
- ✅ Interfaces `AutomotiveSession`, `AutomotiveNavigationState`, `AutomotiveAdapter`
- ✅ `AndroidAutoAdapter` com isSupported/start/end/update/showDestination/onManeuverChange
- ✅ Integração nativa Capacitor condicionada a escopo aprovado
- ✅ Padrões de Intent/deep link referenciados, sem cópia de código GPL

---

*Entregável do MM-MAP-800. Prepara MM-MAP-810 (CarPlay).*
