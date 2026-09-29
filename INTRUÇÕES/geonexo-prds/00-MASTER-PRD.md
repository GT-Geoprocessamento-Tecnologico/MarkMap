# GeoNexo - PRD Mestre de Execucao Paralela

## 1. Objetivo

Criar a primeira versao web do GeoNexo como plataforma GIS operacional para administracao, visualizacao, edicao e gerenciamento de dados geoespaciais, com base no relatorio tecnico do Avenza Maps e preparado para evoluir futuramente para campo, site institucional, APIs publicas e outros produtos relacionados.

O foco desta fase e construir o nucleo web principal. Nao implementar login agora. Nao implementar PWA agora. Nao implementar deploy na Vercel agora. Tudo deve funcionar localmente primeiro.

## 2. Track

CRIAR DO ZERO

## 3. FATO

- Repositorio GitHub ja existe: `mmatteuus/geonexo`.
- No momento da inspecao, o repositorio esta vazio e ainda nao possui branch principal inicializada.
- O projeto sera monorepo.
- Banco gerenciado escolhido: Neon PostgreSQL.
- Banco deve usar PostGIS para dados espaciais.
- Deploy futuro sera na Vercel, mas apenas depois de validacao local.
- Aplicacao inicial sera somente web.
- Nao implementar tela de login nesta fase.
- Nao implementar PWA nesta fase.
- O produto deve ser preparado para crescer sem reescrita estrutural.

## 4. Decisao arquitetural

### Monorepo

Usar:

- pnpm workspaces
- Turborepo
- TypeScript strict
- Node LTS

Estrutura alvo:

```text
geonexo/
  apps/
    admin/                 # produto principal nesta fase
    field/                 # reservado, sem implementar agora
    website/               # reservado, sem implementar agora
  services/
    api/                   # API HTTP
  packages/
    ui/                    # design system compartilhado
    maps/                  # MapLibre, Terra Draw, sources, layers
    geo/                   # Turf, Proj4, conversoes, validacoes espaciais
    db/                    # Drizzle schema, migrations, client
    contracts/             # Zod schemas + tipos compartilhados
    config/                # eslint, tsconfig, prettier, env helpers
    observability/         # logger e helpers
  infra/
    docker/
    martin/
    scripts/
  docs/
    adr/
    api/
    database/
    runbooks/
  frontend/
    audit/
    prd/
    contracts/
    tasks/
    checklists/
    configs/
    templates/
    inspirations/
    handoff/
```

## 5. Stack principal

### Frontend admin

- React
- Vite
- TypeScript
- TanStack Router
- TanStack Query
- Zustand apenas para estado local global necessario
- shadcn/ui + Radix UI
- Tailwind CSS com tokens proprios
- MapLibre GL JS
- Terra Draw
- Turf.js
- Proj4js
- Zod
- React Hook Form

### Backend

- Hono
- TypeScript
- Zod
- Drizzle ORM
- Neon PostgreSQL
- PostGIS
- OpenAPI gerado a partir de contratos quando pratico

### GIS

- MapLibre GL JS: renderizacao do mapa
- Terra Draw: criacao/edicao de ponto, linha e poligono
- Turf.js: area, distancia, centroide, buffer, bbox e operacoes leves no cliente
- Proj4js: transformacao de coordenadas
- PMTiles: formato futuro para tiles offline/estaticos e grandes conjuntos
- GeoTIFF.js: leitura raster no browser quando necessario
- GeoPackage.js: leitura/escrita GeoPackage quando necessario
- Martin: tile server para PostGIS/MBTiles/PMTiles em desenvolvimento e futuras implantacoes
- Tippecanoe: pipeline opcional para gerar vector tiles de grandes GeoJSON

### Qualidade

- Vitest
- Testing Library
- Playwright
- ESLint
- Prettier
- TypeScript strict
- GitHub Actions futuramente

## 6. Regra de reutilizacao de codigo

Prioridade absoluta:

1. usar biblioteca mantida e permissiva;
2. copiar/adaptar exemplos oficiais da propria biblioteca;
3. extrair padrao arquitetural de projetos GPL/AGPL sem copiar codigo incompatvel;
4. escrever codigo proprio somente quando nao houver componente reutilizavel adequado.

Nao reinventar:

- renderizacao de mapas;
- edicao geometrica;
- calculo geoespacial basico;
- transformacao de CRS;
- parsing de GeoTIFF;
- leitura de GeoPackage;
- vector tiles;
- clustering;
- validacao de schema;
- componentes UI basicos;
- tabela, formulario, modal, drawer, toast, command palette.

## 7. Repositorios aprovados para reaproveitamento

Uso direto preferencial:

- https://github.com/maplibre/maplibre-gl-js
- https://github.com/JamesLMilner/terra-draw
- https://github.com/Turfjs/turf
- https://github.com/proj4js/proj4js
- https://github.com/protomaps/PMTiles
- https://github.com/geotiffjs/geotiff.js
- https://github.com/ngageoint/geopackage-js
- https://github.com/maplibre/martin
- https://github.com/felt/tippecanoe
- https://github.com/mapbox/geojson-vt
- https://github.com/mapbox/supercluster
- https://github.com/hyperknot/openfreemap
- https://github.com/visgl/react-map-gl
- https://github.com/calvinmetcalf/shapefile-js

Referencia arquitetural, sem copiar codigo incompatvel sem revisar licenca:

- QField
- Mergin Maps
- SMASH
- ODK Collect
- GratisGIS
- StreetComplete
- MapComplete

## 8. Fontes de mapa e APIs gratuitas

### Basemap inicial

Usar OpenFreeMap como basemap inicial de desenvolvimento.

Fonte:
- https://openfreemap.org/
- estilo exemplo: `https://tiles.openfreemap.org/styles/liberty`

Motivo: sem chave, sem cadastro e compativel com MapLibre. Deve existir adapter para trocar provider sem alterar componentes de mapa.

Nao usar `tile.openstreetmap.org` como dependencia de producao para trafego relevante. OSM publica politica de uso e pode bloquear abuso.

### Geocoding

Nominatim publico somente para desenvolvimento e baixo volume.

Regras obrigatorias:
- maximo absoluto de 1 requisicao por segundo;
- cache;
- proxy backend;
- User-Agent/Referer identificavel;
- provider deve ser substituivel por configuracao.

Nunca implementar autocomplete direto no Nominatim publico.

### Dados ambientais e governamentais

Preparar adapters, sem implementar tudo nesta fase:

- INPE TerraBrasilis via WMS/WFS/GeoServer
- IBGE geoservicos e dados territoriais
- OpenStreetMap/OpenFreeMap

TerraBrasilis WFS documentado:
`https://terrabrasilis.dpi.inpe.br/geoserver/ows`

## 9. Modelo de dados inicial

Entidades minimas:

- projects
- maps
- layers
- features
- feature_properties
- map_sources
- imports
- audit_events

Autenticacao e usuarios ficam fora da primeira entrega, mas schema deve permitir adicionar `organization_id`, `created_by` e `updated_by` depois sem refazer tabelas.

### Geometria

- SRID canonico de armazenamento: EPSG:4674 (SIRGAS 2000) para dados institucionais brasileiros quando aplicavel.
- API pode aceitar/retornar GeoJSON em EPSG:4326 por interoperabilidade web.
- Transformacoes devem ser explicitas.
- PostGIS deve possuir indice GiST nas geometrias consultadas espacialmente.

## 10. API inicial

Prefixo: `/api/v1`

Rotas minimas:

```text
GET    /health
GET    /projects
POST   /projects
GET    /projects/:id
PATCH  /projects/:id
GET    /projects/:id/layers
POST   /projects/:id/layers
GET    /layers/:id
PATCH  /layers/:id
DELETE /layers/:id
GET    /layers/:id/features
POST   /layers/:id/features
GET    /features/:id
PATCH  /features/:id
DELETE /features/:id
GET    /map-sources
POST   /imports
GET    /imports/:id
```

Toda resposta de erro deve seguir contrato unico:

```json
{
  "error": {
    "code": "STRING_ESTAVEL",
    "message": "mensagem segura",
    "requestId": "uuid"
  }
}
```

## 11. Admin - paginas da primeira fase

1. Dashboard simples
2. Projetos
3. Projeto / workspace cartografico
4. Camadas
5. Importacoes
6. Configuracoes tecnicas basicas

### Workspace cartografico

Layout principal:

```text
Topbar
Sidebar esquerda: projetos/camadas
Mapa central
Toolbar de desenho
Painel direito contextual
Statusbar inferior: coordenadas, zoom, escala
```

Capacidades do primeiro milestone:

- abrir basemap;
- ligar/desligar camada;
- criar ponto;
- criar linha;
- criar poligono;
- editar geometria;
- excluir geometria;
- editar propriedades simples;
- calcular comprimento e area;
- persistir no PostGIS;
- recarregar e manter dados.

## 12. Primeiro marco funcional

O projeto so considera a fundacao validada quando este fluxo funcionar:

```text
abrir admin local
-> criar projeto
-> abrir workspace
-> adicionar camada vetorial
-> desenhar poligono no mapa
-> salvar via API
-> persistir no Neon/PostGIS
-> recarregar pagina
-> geometria reaparece correta
-> editar geometria
-> salvar novamente
-> auditoria registra a alteracao
```

## 13. Infra local e containers

Docker Compose deve ser opcional, nao obrigatorio para cada comando de desenvolvimento.

Servicos previstos:

```text
admin     -> Vite dev server
api       -> Hono
martin    -> tile server
```

Banco principal continua Neon remoto.

Adicionar profile opcional `local-db` no Docker Compose com PostgreSQL + PostGIS para:
- testes sem internet;
- CI futuro;
- reproducao de bugs;
- evitar dependencia total do ambiente remoto.

Nunca manter dois schemas diferentes. A mesma pasta de migrations deve inicializar Neon e local PostGIS.

## 14. Estrategia Neon

Nesta fase:

- uma branch Neon de desenvolvimento;
- PostGIS habilitado;
- migration versionada no repositorio;
- nenhuma alteracao manual permanente fora de migration.

Futuro:

- branch Neon por PR;
- staging derivado de producao;
- snapshots antes de migrations de alto risco.

Neon suporta branching e Postgres extensions, incluindo PostGIS. Validar versao disponivel antes de fixar dependencia de extensao especifica.

## 15. Regras para trabalho paralelo

### Fase 0 - fundacao curta e sequencial

Responsavel: `@frontend-prd-handoff`

Deve criar somente:

- estrutura monorepo;
- workspaces;
- configs compartilhados;
- pastas vazias/reservadas;
- contratos iniciais;
- README de desenvolvimento;
- scripts raiz.

Depois disso, todos trabalham em paralelo.

### Ownership de arquivos

`@backend-visionario`
- `services/api/**`
- `packages/db/**`
- backend de `packages/contracts/**`
- `docs/api/**`
- `docs/database/**`

`@frontend-visionario`
- `apps/admin/**`
- `packages/ui/**`
- `packages/maps/**`
- `packages/geo/**`
- frontend de `packages/contracts/**`
- `frontend/**`

`@seguranca-visionario`
- `.github/security/**`
- `docs/security/**`
- headers/config de seguranca em arquivos previamente combinados
- scripts de scan

`@qualidade-visionario`
- testes compartilhados
- `e2e/**`
- configs Vitest/Playwright
- `.github/workflows/**` quando CI for ativado
- `docs/quality/**`

Arquivos raiz compartilhados nao podem ser alterados sem registrar a mudanca em `docs/adr/` ou coordenar no handoff.

## 16. Branches para agentes

Como o trabalho sera paralelo, usar branches separadas:

- `agent/foundation`
- `agent/backend`
- `agent/frontend`
- `agent/security`
- `agent/quality`

Nao fazer cinco agentes editarem `main` simultaneamente.

Fluxo:

1. foundation cria base;
2. merge foundation;
3. demais branches partem da main atualizada;
4. cada agente respeita ownership;
5. merge por dependencia, nao por ordem de conclusao.

## 17. Convencoes de codigo

- TypeScript strict.
- Proibido `any` sem justificativa documentada.
- Funcoes curtas e orientadas a responsabilidade unica.
- Evitar wrappers sem valor.
- Evitar classe quando funcao/composicao resolve.
- Nao duplicar tipos: contrato nasce em `packages/contracts`.
- Nao duplicar constantes de CRS, units ou geometry types.
- Nao criar abstractions prematuras.
- Nao criar generic repository pattern se Drizzle ja resolve.
- Nao criar service layer vazia que apenas chama outra funcao.
- Nao colocar regra de negocio em componente React.
- Nao colocar SQL diretamente em rota HTTP.

## 18. Versionamento de contratos

Contratos compartilhados devem ser fonte de verdade:

```text
packages/contracts
  project.ts
  layer.ts
  feature.ts
  geometry.ts
  import.ts
  errors.ts
```

Zod schema deve gerar/inferir TypeScript sempre que possivel.

Mudanca breaking em contrato exige:
- atualizacao backend;
- atualizacao frontend;
- teste de contrato;
- nota em ADR se estrutural.

## 19. Seguranca desde o inicio

Mesmo sem login:

- API somente em localhost no desenvolvimento quando possivel;
- CORS restrito ao admin local;
- Zod em toda entrada externa;
- queries parametrizadas;
- secrets somente em `.env` ignorado;
- `.env.example` sem valor real;
- nenhuma `DATABASE_URL` no frontend;
- limite de tamanho de payload;
- upload tratado como entrada hostil;
- logs sem conteudo sensivel;
- IDs UUID/ULID, nunca sequenciais expostos como requisito de seguranca;
- preparar audit trail.

Nao implementar auth agora, mas nao criar arquitetura que dependa de acesso anonimo para sempre.

## 20. Qualidade desde o inicio

Gates locais minimos:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Milestone GIS deve ter E2E:

```text
cria projeto
cria camada
abre mapa
cria feature
salva
recarrega
verifica feature
edita
salva
```

## 21. Riscos previstos

### RISCO P0 - divergencia de contrato entre agentes
Solucao: `packages/contracts` e ownership rigido.

### RISCO P0 - schema criado manualmente no Neon
Solucao: toda mudanca por migration versionada.

### RISCO P1 - geometria invalida no banco
Solucao: validar GeoJSON + PostGIS `ST_IsValid`/normalizacao quando aplicavel.

### RISCO P1 - CRS misturado
Solucao: registrar SRID em contrato e transformar na borda do sistema.

### RISCO P1 - mapa renderiza milhares de GeoJSON e trava
Solucao: limite inicial, clustering, simplificacao e migracao para vector tiles/Martin conforme volume.

### RISCO P1 - dependencia de provider gratuito
Solucao: interface `BasemapProvider` e `GeocoderProvider`, configuraveis por env.

### RISCO P1 - agentes alteram arquivos raiz simultaneamente
Solucao: Fase 0 + branches + ownership.

### RISCO P2 - abstractions demais atrasam MVP
Solucao: arquitetura modular, mas codigo direto. Extrair somente quando houver duas implementacoes reais ou regra compartilhada.

## 22. Fora do escopo desta fase

- autenticacao;
- autorizacao por perfil;
- PWA;
- offline completo;
- app mobile;
- deploy Vercel;
- site institucional;
- billing;
- colaboracao realtime;
- GNSS externo;
- assinatura digital;
- notificacoes;
- sync offline;
- rotas de campo.

Tudo deve poder ser adicionado depois sem reescrever o nucleo.

## 23. Definition of Done da primeira fase

- monorepo sobe localmente;
- admin carrega;
- API responde health;
- conexao Neon funciona;
- PostGIS ativo;
- migrations reproduziveis;
- workspace cartografico funcional;
- CRUD de projeto, camada e feature;
- edicao de ponto/linha/poligono;
- persistencia espacial;
- testes essenciais verdes;
- nenhum secret no repositorio;
- documentacao de setup em menos de 10 minutos para novo desenvolvedor.
