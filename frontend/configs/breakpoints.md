# Breakpoints — GeoNexo

Faixas do handoff frontend. Mobile-first: escrever base para mobile e subir com `min-width`.

| Nome | Faixa | Media query | Uso típico |
| --- | --- | --- | --- |
| mobile | `< 768px` | base | consulta em campo, uso estreito |
| tablet | `768px – 1279px` | `@media (min-width: 768px)` | leitura e inspeção |
| desktop | `≥ 1280px` | `@media (min-width: 1280px)` | trabalho cartografico completo |

## Regras

1. Não usar largura de device como unidade de medida; px puro nas media queries.
2. Shell do admin deve ser responsivo em todas as faixas (Definition of Done do PRD).
3. Workspace cartográfico (PRD 21): no desktop, `layers` à esquerda + `inspector` à direita + mapa central; abaixo de 1280px os painéis contextuais encolhem/sobrepõem; abaixo de 768px viram painéis acessíveis por comando, sem empilhar sidebar de 20 itens.
4. Mapa é a superfície principal: chrome de UI (topbar, statusbar, ferramentas) nunca deve reduzir o canvas a menos da metade da largura em desktop.
5. Tabelas densas (`DataTable`) mantêm densidade; em mobile, rolagem horizontal do container em vez de quebrar colunas.
6. Breakpoints pertencem à aplicação (Tailwind config / CSS da app); `packages/ui` não fixa breakpoint — componentes usam layout fluido (`width: 100%`, `max-width`).
7. Alvos de toque em mobile: mínimo ~40px de altura interativa (botões `md` já atendem).
