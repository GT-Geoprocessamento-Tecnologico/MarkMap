# Design tokens — GeoNexo

Fonte única: `packages/ui/src/styles/tokens.css` (export `@geonexo/ui/styles.css`).
Paleta reversível com identidade mineral/territorial (PRD Frontend Visionario, seção "Design tokens"): cores default do Tailwind **não** são a identidade do produto.

## Variáveis

| Variável | Papel | Valor |
| --- | --- | --- |
| `--gn-color-background` | fundo de página (cinza muito claro neutro) | `#f4f5f3` |
| `--gn-color-surface` | superfície (branco/off-white) | `#ffffff` |
| `--gn-color-surface-elevated` | superfície elevada (tom neutro leve) | `#e9ebe7` |
| `--gn-color-text-primary` | texto principal (grafite) | `#1f2328` |
| `--gn-color-text-secondary` | texto secundário (cinza médio) | `#5b6169` |
| `--gn-color-primary` | primário (verde mineral/territorial) | `#1e6b4a` |
| `--gn-color-primary-contrast` | texto/ícone sobre primário ou erro | `#ffffff` |
| `--gn-color-accent` | destaque (amarelo técnico) | `#f0c419` |
| `--gn-color-error` | erro (vermelho funcional) | `#c13b2e` |
| `--gn-color-warning` | aviso (âmbar) | `#9c6300` |
| `--gn-color-success` | sucesso (verde funcional) | `#1e7a3f` |
| `--gn-color-border` | borda sutil | `#cdd1ca` |
| `--gn-font-sans` | tipografia funcional | `'Geist', 'Inter', system-ui, sans-serif` |
| `--gn-font-mono` | coordenadas, IDs e valores técnicos | `'Geist Mono', ui-monospace, 'SFMono-Regular', monospace` |
| `--gn-radius-sm` | raio pequeno (inputs, tags) | `4px` |
| `--gn-radius-md` | raio médio (botões, cards internos) | `6px` |
| `--gn-radius-lg` | raio grande (diálogos) | `10px` |
| `--gn-shadow-elevated` | sombra de popover/dialog/toast | `0 1px 2px …, 0 12px 32px …` |
| `--gn-focus-ring` | anel de foco (outline) | `2px solid var(--gn-color-primary)` |
| `--gn-motion-fast` | microinteração | `180ms` |
| `--gn-motion-base` | transição estrutural | `240ms` |

## Regras de uso

1. Referenciar sempre por `var(--gn-…)`; não duplicar hex em componentes, Tailwind config ou páginas.
2. Texto sobre `--gn-color-background` / `--gn-color-surface` / `--gn-color-surface-elevated` com `text-primary`, `text-secondary`, `primary`, `error`, `warning` ou `success` mantém contraste ≥ 4.5:1. Não criar pares novos sem revalidar contraste.
3. `--gn-color-accent` é cor de destaque/fundo: usar com `--gn-color-text-primary`, nunca com texto branco.
4. `--gn-color-primary-contrast` só sobre `--gn-color-primary` ou `--gn-color-error`.
5. `--gn-font-mono` apenas para coordenadas, IDs e valores técnicos; resto da UI em `--gn-font-sans`.
6. Foco visível é obrigatório em controle interativo: `outline: var(--gn-focus-ring)` + `outline-offset: 2px` em `:focus-visible`.
7. Animações curtas com `--gn-motion-fast` / `--gn-motion-base` (ver `motion.md`).

Importação:

```css
@import '@geonexo/ui/styles.css';      /* tokens */
@import '@geonexo/ui/components.css';  /* classes .gn-* dos componentes */
```

O barrel `@geonexo/ui` já carrega ambos automaticamente.
