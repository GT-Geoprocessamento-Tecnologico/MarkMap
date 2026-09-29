# GeoNexo - PRD Frontend Visionario

## Track

CRIAR DO ZERO

## Missao

Construir o admin web do GeoNexo com uma experiencia GIS moderna, rapida e objetiva. O mapa e o produto; menus existem para apoiar o trabalho espacial, nao para competir com ele.

## FATO

- React + Vite + TypeScript.
- MapLibre.
- Terra Draw.
- Turf.js.
- Sem login nesta fase.
- Sem PWA.
- Backend via `/api/v1`.

## Principio de UX

Um usuario deve conseguir em poucos segundos:

1. abrir projeto;
2. entender quais camadas estao ativas;
3. localizar-se no mapa;
4. criar ou selecionar uma feature;
5. editar propriedades;
6. salvar sem ambiguidade.

## Direcao visual

Profissional, cartografica, densa sem ser poluida.

Evitar:
- cards gigantes;
- dashboard SaaS generico;
- gradientes decorativos excessivos;
- sidebar com 20 itens;
- excesso de modal.

Preferir:
- canvas amplo;
- paineis contextuais;
- icones claros;
- tipografia funcional;
- legenda e camada proximas;
- comandos rapidos.

## Design tokens

Criar tokens proprios. Nao usar cor default de Tailwind como identidade.

Paleta inicial reversivel:

```text
background: cinza muito claro neutro
surface: branco/off-white
surface-elevated: tom neutro leve
text-primary: grafite
text-secondary: cinza medio
primary: verde mineral/territorial
accent: amarelo tecnico para destaque
error: vermelho funcional
warning: ambar
success: verde funcional
```

Nao fixar hexadecimal sem teste de contraste e validacao visual.

Tipografia:
- Geist Sans ou equivalente open source funcional;
- monospace apenas para coordenadas, IDs e valores tecnicos.

## Paginas

### 1. Dashboard

Objetivo: entrada operacional, nao BI complexo.

Conteudo:
- projetos recentes;
- total de projetos;
- total de camadas;
- importacoes recentes;
- CTA `Novo projeto`.

Sem graficos vazios apenas para decorar.

### 2. Projetos

- tabela/lista;
- busca local/server conforme volume;
- status;
- ultima atualizacao;
- abrir workspace;
- criar projeto.

### 3. Workspace cartografico

Tela mais importante.

```text
+----------------------------------------------------+
| topbar: projeto | busca | comandos                 |
+----------+----------------------------+------------+
| layers   |                            | inspector  |
|          |            MAPA            | contextual |
|          |                            |            |
+----------+----------------------------+------------+
| coords | escala | CRS | status de save            |
+----------------------------------------------------+
```

#### Sidebar esquerda

- basemap;
- layers;
- visibilidade;
- ordem;
- tipo;
- menu contextual;
- criar layer.

Nao permitir reorder complexo ate existir necessidade real.

#### Toolbar mapa

Ferramentas iniciais:

- select
- point
- line
- polygon
- edit
- measure distance
- measure area
- fit bounds
- locate/browser GPS futuro, nao obrigatorio agora

#### Inspector direito

Ao selecionar feature:
- ID discreto;
- propriedades;
- geometria tipo;
- area/comprimento quando aplicavel;
- updatedAt;
- salvar;
- excluir com confirmacao.

#### Statusbar

- cursor lng/lat;
- UTM/SIRGAS no futuro;
- zoom;
- escala;
- connection state API;
- save state.

## Componentes

### UI compartilhado

`packages/ui`:
- Button
- IconButton
- Input
- Select
- Checkbox
- Dialog
- Drawer
- Sheet
- Tooltip
- DropdownMenu
- Toast
- EmptyState
- ErrorState
- Skeleton
- DataTable primitives

Reusar shadcn/Radix. Nao reimplementar primitives.

### Maps

`packages/maps`:

```text
MapCanvas
MapControls
LayerManager
LayerItem
DrawToolbar
FeatureSelection
FeatureInspector bridge
BasemapSwitcher
MapStatus
```

MapLibre instance deve ficar encapsulada no pacote, sem cada pagina manipular `map.addLayer` diretamente.

Criar registry:

```text
source registry
layer registry
interaction registry
```

Mas manter simples e funcional.

## Terra Draw

Usar Terra Draw para modos de desenho e edicao.

Nao criar algoritmo proprio para:
- desenhar poligono;
- mover vertice;
- editar linha;
- criar ponto.

Criar adapter GeoNexo em `packages/maps` para isolar biblioteca. Isso permite trocar versao/engine sem espalhar chamadas por toda UI.

## Turf

Usar apenas para calculos client-side imediatos:
- length preview;
- area preview;
- bbox;
- centroid visual;
- point-in-polygon leve.

Valor autoritativo persistido deve vir do backend quando necessario.

## Proj4

Criar helper central:

```text
packages/geo/src/crs.ts
```

Definir:
- EPSG:4326
- EPSG:4674
- UTM por zona quando necessario

Nao espalhar strings PROJ em componentes.

## Map sources

Provider inicial: OpenFreeMap.

Criar contrato:

```ts
interface BasemapDefinition {
  id: string
  label: string
  styleUrl: string
  attribution: string
}
```

Troca de provider deve ser configuracao, nao refactor.

## Geolocation web

Mesmo sem app mobile, browser Geolocation API pode ser adicionada depois.

Nesta fase:
- arquitetura nao deve impedir `navigator.geolocation`;
- nao implementar tracking continuo ainda;
- nao prometer background GPS em web.

## Data loading de features

Nunca carregar tudo sem limite.

Fluxo:

```text
map moveend
-> debounce
-> bbox atual
-> query features por layer visivel
-> TanStack Query
-> atualizar source GeoJSON
```

Evitar refetch em cada frame.

Quando volume crescer, backend troca source para vector tile via Martin sem mudar layout principal.

## Edicao otimista

Nao fazer optimistic update destrutivo no primeiro MVP de geometria.

Fluxo recomendado:

```text
editar localmente
-> estado dirty
-> salvar
-> resposta API
-> commit visual
```

Em erro:
- manter geometria local dirty;
- exibir retry;
- nunca descartar desenho silenciosamente.

## Atalhos futuros

Preparar sem implementar todos:
- V = select
- P = point
- L = line
- G = polygon
- Esc = cancelar
- Delete = excluir selecao com confirmacao

Atalhos nao devem conflitar com inputs.

## Estados

### Layer list

- loading
- empty
- error
- disabled
- active

### Feature save

- clean
- dirty
- saving
- saved
- error
- conflict

### Map

- initializing
- ready
- style error
- source error
- WebGL unsupported

## Performance

- lazy load de paginas secundarias;
- MapLibre carregado apenas onde usado;
- evitar rerender da arvore React por eventos de pointer move;
- coordenadas do mouse podem usar store/ref dedicado de baixa frequencia;
- nao armazenar objeto `Map` inteiro em estado React;
- debounce bbox queries;
- clustering para pontos quando necessario;
- `supercluster` apenas se MapLibre/source clustering nao atender.

## Acessibilidade GIS

Mapa nao sera 100% equivalente a uma tabela para screen reader, portanto fornecer:
- lista/tabela das features da layer selecionada;
- selecao sincronizada mapa <-> lista;
- operacoes principais acessiveis por teclado;
- labels em controles;
- focus management.

## Inspiracoes

### Felt

Fonte: https://www.felt.com/platform/web-gis

Adotar:
- simplicidade sobre GIS complexo;
- data table + layers + map;
- mapa como superficie principal.

### Geist/Vercel

Fonte: https://vercel.com/font

Adotar:
- clareza tipografica;
- densidade consistente;
- neutralidade funcional.

### Linear

Fonte: https://linear.app

Adotar:
- comandos compactos;
- microinteracoes discretas;
- keyboard-first onde fizer sentido.

## Testes frontend

- render project list;
- loading/empty/error;
- map initializes;
- layer visibility;
- select feature;
- draw mode creates local geometry;
- save mutation;
- API failure preserves unsaved geometry;
- keyboard focus.

Nao testar internals de MapLibre. Testar integracao e nosso adapter.

## Footer obrigatorio

`Desenvolvido por MtsFerreira`

`https://mtsferreira.dev`

Abrir em nova aba com `noopener noreferrer`.

## Definition of Done

- shell responsivo;
- projetos;
- workspace;
- MapLibre inicializa;
- OpenFreeMap exibe;
- layers carregam;
- ponto/linha/poligono desenham;
- edicao funciona;
- propriedades editam;
- salvar persiste via API;
- erro nao perde trabalho;
- footer presente;
- sem `any` injustificado;
- sem console.log de producao;
- build, lint, typecheck e testes verdes.
