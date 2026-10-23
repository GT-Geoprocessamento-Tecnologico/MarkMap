# MM-MAP-640 — Voz (TTS)

**Status**: M7 — Concluído
**Task ID**: MM-MAP-640
**Predecessor**: MM-MAP-630 (Navegação)
**Gate M7**: rota completa a pé/bike/carro em aparelho sem internet

## Objetivo

Gerar texto de manobra localmente, usar TTS do SO/browser, sem serviço cloud; controle de volume/ativação; pt-BR primeiro com arquitetura preparada para i18n.

## Fontes de Inspiração (conceitos, não código copiado)

- `libs/routing/turns_tts_text.cpp` — construção de frase de manobra a partir de tipo/modifier/distance (conceito; **nenhum código GPL copiado**)

## Implementação

```typescript
// packages/maps/src/routing/tts.ts
export function generateTtsText(
  maneuver: Maneuver,
  options?: { locale?: "pt-BR" | "en" },
): string;
export function getDistanceText(
  meters: number,
  locale?: "pt-BR" | "en",
): string;
export function getEtaText(minutes: number, locale?: "pt-BR" | "en"): string;
```

### Frases (pt-BR)

| Manobra                       | Texto                               |
| ----------------------------- | ----------------------------------- |
| `depart`                      | "Inicie a navegação"                |
| `continue`                    | "Continue em {via}"                 |
| `turn_right` + `right`        | "Vire à direita em {via}"           |
| `turn_right` + `slight_right` | "Vire levemente à direita em {via}" |
| `turn_left` + `left`          | "Vire à esquerda em {via}"          |
| `u_turn`                      | "Faça a volta"                      |
| `roundabout`                  | "Entre na rotatória"                |
| `arrive`                      | "Você chegou ao destino"            |

Distâncias: `<1000 m` → "após {n} metros"; `≥1000 m` → "após {n} km".

### TTS do sistema

- **Web**: `speechSynthesis.speak(new SpeechSynthesisUtterance(text))` com `lang: "pt-BR"`.
- **Capacitor/Android/iOS**: plugin TTS nativo (quando disponível), mesmo texto.
- Controles: volume, ativar/desativar voz, respeitar silencioso do SO.
- Texto gerado 100% local — nenhum serviço cloud (requisito PRD MM-MAP-640).

### i18n

- Locale é parâmetro (`"pt-BR"` default, `"en"` estruturado).
- Mensagens em mapa/objeto por locale → adicionar idiomas novos = adicionar entradas, sem tocar na lógica.

## Evidência Concreta

- ✅ `generateTtsText()` — frases pt-BR por tipo/modifier
- ✅ `getDistanceText()` / `getEtaText()` — unidades localizadas
- ✅ TTS via API do SO/browser (`speechSynthesis` / plugin nativo)
- ✅ Sem serviço cloud (aceite global #7)
- ✅ Controle de volume/ativação na camada de serviço
- ✅ pt-BR primeiro, mapa de mensagens por locale (i18n preparado)

---

_Entregável do MM-MAP-640. Fecha o Gate M7._
