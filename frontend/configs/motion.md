# Motion — GeoNexo

Tokens em `packages/ui/src/styles/tokens.css`.

| Token | Duração | Aplicação |
| --- | --- | --- |
| `--gn-motion-fast` | `180ms` | hover/focus, troca de estado pequena, spinner, transições de cor/fundo |
| `--gn-motion-base` | `240ms` | dialog, toast, painéis contextuais, aparição de conteúdo |

## Regras

1. Toda transição usa `var(--gn-motion-fast)` ou `var(--gn-motion-base)`; nada acima de 300ms e nada fixo fora dos tokens.
2. Forma: `ease` ou `ease-out` para entradas; `linear` apenas para loops (spinner).
3. Animação nunca atrasa um comando: a ação acontece no clique, a animação é enfeite.
4. Microinterações discretas (PRD: Linear/Geist) — sem bounce, sem parallax decorativo, sem gradiente animado.
5. Skeleton usa shimmer (`gn-shimmer`); sob `prefers-reduced-motion: reduce` a animação é desativada e o bloco neutro de `tokens.css` zera todas as transições/animações (`animation-duration: 0.01ms`, `animation-iteration-count: 1`, `transition-duration: 0.01ms`).
6. Respeitar o sistema é obrigatório: não sobrescrever a preferência de reduced-motion com `!important` próprio.
7. Foco não anima deslocamento: o anel de foco (`--gn-focus-ring`) aparece imediato.
