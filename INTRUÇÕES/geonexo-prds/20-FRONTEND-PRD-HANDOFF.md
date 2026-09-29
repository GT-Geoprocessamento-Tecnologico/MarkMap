# GeoNexo - Frontend PRD Handoff

## Trilha escolhida

CRIAR DO ZERO

## Missao

Criar a fundacao executavel do frontend e documentar contratos para que os demais agentes trabalhem sem tomar decisoes conflitantes.

Este agente e o primeiro a rodar por um curto periodo. Depois do scaffold, backend, frontend, seguranca e qualidade trabalham em paralelo.

## FATO

- App inicial: `apps/admin`.
- Web apenas.
- Sem login.
- Sem PWA.
- React + Vite + TypeScript.
- MapLibre como engine.
- Backend separado em `services/api`.
- Footer obrigatorio em paginas: `Desenvolvido por MtsFerreira` com link seguro para `https://mtsferreira.dev`.

## F0 - Fundacao

Criar:

```text
package.json
pnpm-workspace.yaml
turbo.json
.gitignore
.editorconfig
.env.example
README.md
apps/admin
services/api
packages/ui
packages/maps
packages/geo
packages/db
packages/contracts
packages/config
infra
docs
frontend
```

Nao implementar regras de negocio do backend.
Nao criar telas completas alem de shell basico.

## Scripts raiz

Padrao obrigatorio:

```text
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm format
```

Cada workspace deve obedecer os scripts relevantes.

## Estrutura /frontend obrigatoria

```text
frontend/
  audit/
    current-state.md
    issues-ranked.md
  prd/
    track-decision.md
    product-requirements.md
    page-specs/
  contracts/
    routes.md
    data-contracts.md
    ui-states.md
    integrations.md
  tasks/
    index.md
  checklists/
    pre-release.md
    page-checks.md
    qa-matrix.md
  configs/
    design-tokens.md
    breakpoints.md
    motion.md
    testing-strategy.md
    observability.md
  templates/
    task-template.md
  inspirations/
    index.md
    felt.md
    geist.md
    linear.md
  handoff/
    implementation-order.md
    final-handoff.md
```

## Rotas do admin

Primeira fase:

```text
/                       -> dashboard
/projects               -> lista de projetos
/projects/:projectId     -> overview/workspace do projeto
/projects/:projectId/map -> workspace cartografico principal
/imports                 -> historico de importacoes
/settings                -> configuracoes locais/tecnicas basicas
```

Nao criar `/login`.

## Contratos compartilhados

`packages/contracts` deve conter Zod e tipos inferidos.

Frontend jamais copia interface manualmente se ja existe schema compartilhado.

Arquivos iniciais:

```text
project.ts
layer.ts
feature.ts
geometry.ts
import.ts
pagination.ts
errors.ts
```

## Estado

### TanStack Query

Usar para:
- projects
- layers
- features
- imports
- mutations API

### Zustand

Somente para estado de interface compartilhado que nao pertence ao servidor:
- layer visibility local
- painel aberto/fechado
- ferramenta de desenho ativa
- selecao atual

Nao duplicar dado da API em Zustand.

### Estado local React

Usar para:
- formulario temporario
- popover
- toggle local
- input ainda nao submetido

## Data fetching

Criar uma unica camada cliente HTTP pequena:

```text
apps/admin/src/lib/api-client.ts
```

Responsabilidades:
- base URL
- parse JSON
- mapear erro padrao
- requestId
- abort signal

Nao criar SDK gigante no MVP.

## Estados obrigatorios

Toda tela de dados:

- loading
- success
- empty
- partial
- error

Mapa:
- loading style
- style error
- source error
- sem features
- erro API
- WebGL indisponivel

## Regras de responsividade

### Desktop >= 1280

- sidebar esquerda fixa/redimensionavel
- mapa central
- inspector direito condicional

### Tablet 768-1279

- sidebar colapsavel
- inspector em drawer
- toolbar compacta

### Mobile < 768

Nao e produto de campo ainda, mas admin nao pode quebrar.
- mapa ocupa viewport
- camadas em bottom sheet/drawer
- controles com touch targets adequados
- tabelas viram cards ou scroll controlado

## Acessibilidade

- todos botoes com nome acessivel;
- toolbar navegavel por teclado;
- focus visivel;
- modais prendem foco;
- Escape fecha overlays;
- draw tools devem ter alternativa textual ou instrucoes;
- status de save via aria-live;
- nao depender apenas de cor para layer status.

## Motion

Motion deve informar, nao decorar.

- drawer: 180-240ms
- painel contextual: fade/slide curto
- toast: curto
- respeitar `prefers-reduced-motion`

Nao animar mapa ou sidebar de modo que prejudique trabalho tecnico.

## SEO

Admin privado futuro nao depende de SEO.
Mesmo sem auth agora:
- title correto
- noindex deve ser considerado quando houver deploy interno
- site institucional futuro fica em app separado

## Footer

Toda pagina normal deve conter:

`Desenvolvido por MtsFerreira`

Link:
`https://mtsferreira.dev`

Target:
`_blank`

Rel:
`noopener noreferrer`

No workspace de mapa fullscreen, o footer pode existir como item discreto no menu Sobre/Ajuda ou statusbar, mas deve permanecer acessivel.

## Inspiracoes documentadas

### Felt

Referencia: https://www.felt.com/platform/web-gis

Usar como inspiracao para:
- mapa como canvas principal;
- ferramentas espaciais acessiveis;
- dados e layers proximos do mapa;
- reduzir complexidade GIS visual.

Nao copiar identidade visual.

### Vercel Geist

Referencia: https://vercel.com/font

Usar como inspiracao para:
- tipografia funcional;
- densidade limpa;
- hierarquia tipografica.

### Linear

Referencia: https://linear.app

Usar como inspiracao conceitual para:
- command-first interface;
- densidade profissional;
- atalhos e microinteracoes.

## Entregavel inicial desse agente

Somente scaffold e contratos.

Nao criar CRUD completo.
Nao criar banco.
Nao criar auth.
Nao configurar Vercel.

## Criterio para liberar paralelismo

Quando estes comandos rodarem:

```text
pnpm install
pnpm typecheck
pnpm lint
pnpm build
```

E existir:

- admin shell renderizando;
- API placeholder/health isolado;
- packages importaveis;
- contratos compartilhados;
- aliases consistentes;
- ownership documentado.

A partir dai, merge foundation e liberar os demais agentes.

## Handoff

Publicar em `frontend/handoff/final-handoff.md`:

- paths criados;
- scripts;
- aliases;
- contratos disponiveis;
- arquivos que outros agentes nao devem mover;
- pendencias reais.
