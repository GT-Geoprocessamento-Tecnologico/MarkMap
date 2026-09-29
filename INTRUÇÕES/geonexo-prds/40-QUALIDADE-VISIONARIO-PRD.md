# GeoNexo - PRD Qualidade Visionario

## Track

IMPLEMENTAR TESTES DO ZERO

## Missao

Criar uma camada de qualidade que permita cinco agentes trabalharem em paralelo sem quebrar contratos, GIS ou banco. Priorizar testes que detectam falhas reais e evitar cobertura artificial.

## FATO

- Monorepo pnpm + Turborepo.
- React/Vite admin.
- Hono API.
- Neon/PostGIS.
- MapLibre/Terra Draw.
- Deploy futuro, nao agora.

## Principio

Testar nosso comportamento e nossos contratos, nao internals de bibliotecas maduras.

## Fluxos criticos P0

### Fluxo GIS principal

```text
criar projeto
-> criar camada
-> abrir mapa
-> desenhar poligono
-> salvar
-> recarregar
-> feature continua presente
-> editar
-> salvar
```

### Persistencia espacial

- geometry chega como GeoJSON;
- backend converte corretamente;
- PostGIS armazena SRID esperado;
- API devolve geometria correta.

### Conflito de versao

- editar feature;
- enviar versao antiga;
- API retorna 409;
- frontend nao perde edicao silenciosamente.

### Erro de API

- falha de save;
- frontend mantem estado dirty;
- usuario consegue retry.

## Piramide

### Unit 55-65%

Testar:
- schemas Zod;
- bbox parser;
- CRS helpers;
- formatacao de coordenadas;
- calculos utilitarios proprios;
- state reducers/stores;
- error mapping.

Nao testar Turf internamente.
Nao testar MapLibre internamente.

### Integration 25-35%

Backend com PostGIS real:
- migrations;
- CRUD;
- spatial queries;
- audit events;
- constraints.

Frontend:
- API client;
- TanStack Query hooks;
- forms;
- state transitions.

### E2E 10-15%

Playwright:
- milestone GIS;
- erro save;
- empty project;
- layer visibility;
- desenho basico.

## Banco para testes

Nao usar mock para testes espaciais.

Preferencia local:
- container Postgres + PostGIS via profile `local-db`.

CI futuro:
- container PostGIS ou Neon branch efemera.

Nao apontar teste destrutivo para branch compartilhada Neon.

## Contract tests

`packages/contracts` e fonte de verdade.

Criar testes que garantam:
- request aceito pelo frontend e backend usa mesmo schema;
- error envelope consistente;
- enums iguais;
- version field obrigatorio onde esperado.

## Map tests

### Unit/Integration

Testar adapter GeoNexo:
- registrar source;
- alternar visibility;
- mapear feature selecionada;
- converter draw event em contract.

Nao depender de screenshot pixel-perfect do MapLibre.

### E2E

Usar browser real.

Testar:
- canvas existe;
- basemap carrega ou fallback aparece;
- draw toolbar muda modo;
- desenhar gera feature local;
- save persiste.

Mocks de tiles podem ser usados para reduzir flakiness, desde que um smoke manual valide provider real.

## Testes de performance

Baselines iniciais devem ser medidos, nao inventados.

Medir:
- tempo de bootstrap admin;
- tempo de abertura workspace;
- render com 100, 1k, 10k features simplificadas;
- bbox API;
- insert/update feature;
- tamanho bundle mapa.

[PENDENTE] Definir budgets numericos depois da primeira medicao real.

## Dataset de benchmark

Criar fixtures:

```text
tiny: 10 features
small: 500 features
medium: 5k features
large: 50k features
```

Nao carregar large em GeoJSON no frontend por padrao. Ele existe para detectar quando deve entrar vector tile.

## Casos geoespaciais obrigatorios

- Point;
- LineString;
- Polygon;
- Polygon com buraco;
- MultiPolygon futuro;
- geometry vazia rejeitada;
- self-intersection documentada;
- coordenada fora de faixa rejeitada;
- bbox cruza limite esperado;
- area e length consistentes.

## Browser matrix inicial

- Chromium desktop: obrigatorio;
- Firefox desktop: smoke;
- WebKit: smoke antes de release externa;
- viewport tablet;
- viewport mobile para garantir que admin nao quebra.

## Acessibilidade

Automatizar com axe onde pratico.

Manual:
- tab navigation;
- Escape em dialogs;
- focus visivel;
- toolbar nomeada;
- feature list acessivel;
- contraste;
- reduced motion.

Mapa precisa de alternativa textual para features selecionaveis.

## CI futuro

Nao precisa ser ativado antes do scaffold local estabilizar, mas preparar workflow.

Gates:

```text
install --frozen-lockfile
lint
typecheck
unit
integration
build
e2e smoke
security audit
```

Nao executar E2E completo em cada commit se ficar caro; usar smoke em PR e suite completa nightly/final quando necessario.

## Flakiness

Proibido resolver teste instavel com retry infinito.

Se teste flaky:
1. identificar fonte;
2. estabilizar wait/fixture;
3. no maximo retry pequeno em browser se causa externa inevitavel;
4. nao mascarar erro real.

## Observabilidade em teste

Em falha E2E salvar:
- screenshot;
- trace;
- console errors;
- network errors.

Nunca salvar secrets nos artifacts.

## Quality gates locais

Antes de merge:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Quando fluxo GIS existir:

```text
pnpm test:e2e
```

## Riscos previstos

### P0 - agentes quebram contratos
Mitigacao: shared Zod + contract tests.

### P0 - migration passa em mock mas falha no PostGIS
Mitigacao: integration test com PostGIS real.

### P1 - E2E depende do basemap externo
Mitigacao: mock/fallback para teste e smoke separado no provider real.

### P1 - testes de mapa lentos
Mitigacao: testar adapter em unit e somente fluxos criticos no browser.

### P1 - bundle cresce silenciosamente
Mitigacao: registrar baseline de bundle depois do primeiro build e observar crescimento.

## Definition of Done

- Vitest configurado;
- Playwright configurado;
- integration DB test reproduzivel;
- fluxo GIS principal E2E;
- contract tests;
- a11y baseline;
- comandos unificados na raiz;
- nenhum teste flaky conhecido;
- relatorio de falha util para debug.
