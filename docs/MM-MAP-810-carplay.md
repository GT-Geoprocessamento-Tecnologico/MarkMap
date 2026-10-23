# MM-MAP-810 — CarPlay

**Status**: M9 — Concluído
**Task ID**: MM-MAP-810
**Predecessor**: MM-MAP-800 (Android Auto)
**Pré-requisito do PRD**: executar somente depois de M7 estável
**Gate M9**: integração automotiva com escopo aprovado

## Objetivo

Implementar integração CarPlay respeitando templates e restrições de segurança da Apple.

## Fontes de Inspiração (conceitos, não código copiado)

- `iphone/Maps/Core/CarPlay/` — padrões de templates CarPlay (conceito)
- `organicmaps/api-ios` — **apenas** padrões de URL scheme/deep link (conceito)

> Regra: nenhum código GPL do Organic Maps é copiado. Respeitar templates/restrições de segurança da Apple.

## Implementação

```typescript
// packages/maps/src/automotive/index.ts
export class CarPlayAdapter implements AutomotiveAdapter { ... }
```

### Ponte iOS

- `isSupported()` detecta `window.webkit.messageHandlers.carPlay` (ou plugin Capacitor correspondente).
- Sessão CarPlay usa `templateType` compatível com os templates da Apple (`CPMapTemplate`, `CPListTemplate`, `CPTurnByTurnNavigationCardTemplate`, `CPPlaceTemplate` — mapeados pelos tipos do adapter).
- `showDestination()` via URL scheme/app link aprovado.

### Restrições de segurança Apple

| Restrição                          | Adoção                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------- |
| Somente templates aprovados        | `map`, `navigation`, `list`, `place` (sem UI customizada fora dos templates) |
| Sem exibição de webview arbitrário | Place sheet usa conteúdo sanitizado (MM-MAP-700)                             |
| URLs externas controladas          | Apenas deep links aprovados via `sanitizeExternalUrl`                        |
| Background/voz                     | TTS via sistema, sem serviço cloud (MM-MAP-640)                              |

## Evidência Concreta

- ✅ `CarPlayAdapter` implementando `AutomotiveAdapter`
- ✅ Templates restritos aos tipos suportados pela Apple
- ✅ URL scheme/deep link referenciados apenas como padrão (sem cópia GPL)
- ✅ Sanitização de URLs compartilhada com o runtime web

---

_Entregável do MM-MAP-810. Fecha o Gate M9._
