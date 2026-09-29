# GeoNexo - PRD Backend Visionario

## Track

CRIAR DO ZERO

## Missao

Construir o backend inicial do GeoNexo de forma enxuta, espacialmente correta e preparada para crescimento, sem criar camadas redundantes. O backend deve permitir CRUD de projetos, camadas e features geoespaciais, persistindo em Neon PostgreSQL com PostGIS.

## FATO

- Monorepo definido no PRD mestre.
- API: `services/api`.
- Banco: Neon PostgreSQL.
- Extensao espacial: PostGIS.
- ORM: Drizzle.
- Framework HTTP: Hono.
- Contratos: Zod compartilhado em `packages/contracts`.
- Sem autenticacao nesta fase.
- Deploy Vercel somente no futuro.

## SUPOSICAO REVERSIVEL

- Uma unica organizacao implicita enquanto nao existe auth.
- Volume inicial baixo, mas schema deve suportar 100k+ features sem remodelagem basica.
- GeoJSON sera o formato principal da API.

## Objetivo tecnico

Entregar uma API pequena, consistente e testavel:

```text
HTTP -> validation -> application function -> repository/query -> PostGIS
```

Evitar:

```text
route -> controller -> service -> manager -> repository -> adapter -> helper
```

Se uma camada nao adiciona regra, nao criar.

## Estrutura alvo

```text
services/api/src/
  app.ts
  server.ts
  env.ts
  middleware/
    request-id.ts
    error-handler.ts
    cors.ts
    logger.ts
  routes/
    health.ts
    projects.ts
    layers.ts
    features.ts
    imports.ts
    map-sources.ts
  modules/
    projects/
      queries.ts
      commands.ts
    layers/
      queries.ts
      commands.ts
    features/
      queries.ts
      commands.ts
      spatial.ts
    imports/
      commands.ts
  lib/
    errors.ts
    pagination.ts
```

`packages/db`:

```text
packages/db/
  src/
    client.ts
    schema/
      projects.ts
      maps.ts
      layers.ts
      features.ts
      map-sources.ts
      imports.ts
      audit-events.ts
    queries/
  drizzle/
  drizzle.config.ts
```

## Banco - extensoes

Migration inicial deve executar de forma idempotente:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

Nao executar automaticamente contra producao futura sem plano de migration.

## Schema minimo

### projects

- id uuid PK
- name varchar(160) NOT NULL
- description text NULL
- status varchar(32) NOT NULL DEFAULT 'active'
- created_at timestamptz NOT NULL
- updated_at timestamptz NOT NULL
- deleted_at timestamptz NULL

Indexes:
- status onde fizer sentido apenas quando query real existir
- deleted_at nao precisa indice inicialmente salvo listagens exigirem

### maps

- id uuid PK
- project_id uuid FK projects
- name
- description
- default_center jsonb ou colunas numericas simples
- default_zoom numeric
- created_at
- updated_at

### layers

- id uuid PK
- project_id uuid FK
- name varchar(160)
- kind enum logico: point|line|polygon|mixed|raster|remote
- geometry_type nullable
- srid integer NOT NULL DEFAULT 4674
- style jsonb NOT NULL DEFAULT '{}'
- metadata jsonb NOT NULL DEFAULT '{}'
- visible_by_default boolean NOT NULL DEFAULT true
- sort_order integer NOT NULL DEFAULT 0
- created_at
- updated_at
- deleted_at

Indexes:
- `(project_id, sort_order)`

### features

Preferir uma tabela unificada no inicio.

- id uuid PK
- layer_id uuid FK
- geometry geometry(Geometry, 4674) NOT NULL
- properties jsonb NOT NULL DEFAULT '{}'
- version integer NOT NULL DEFAULT 1
- created_at timestamptz
- updated_at timestamptz
- deleted_at timestamptz NULL

Indexes:
- GiST `geometry`
- btree `layer_id`
- composto `(layer_id, updated_at)` apenas quando necessario

Constraints:
- geometry nao vazia
- SRID 4674 no armazenamento
- validar compatibilidade com geometry_type da layer na camada de aplicacao

### map_sources

- id uuid
- project_id nullable
- name
- provider_type: xyz|style|wms|wfs|pmtiles|geojson
- url_template
- attribution
- config jsonb
- enabled boolean
- created_at
- updated_at

Nunca armazenar token sensivel dentro de `config`.

### imports

- id uuid
- project_id
- target_layer_id nullable
- original_name
- format
- status: queued|processing|completed|failed
- row_count nullable
- error_code nullable
- error_message nullable e sanitizada
- created_at
- completed_at nullable

### audit_events

Desde ja registrar alteracoes criticas mesmo sem usuario.

- id uuid
- entity_type
- entity_id uuid
- action
- actor_type default 'system'
- actor_id nullable
- request_id uuid
- before jsonb nullable
- after jsonb nullable
- created_at

Nao registrar blobs grandes, arquivos ou segredos.

## CRS e geometria

### Regra

Banco canonico: EPSG:4674.

API publica GeoJSON: coordenadas WGS84-style conforme ecossistema web. Ao receber geometria, converter explicitamente quando necessario.

Nao confiar em SRID enviado livremente pelo cliente.

### Funcoes PostGIS permitidas inicialmente

- ST_GeomFromGeoJSON
- ST_AsGeoJSON
- ST_Transform
- ST_IsValid
- ST_MakeValid apenas quando politica estiver definida
- ST_Area
- ST_Length
- ST_Intersects
- ST_Envelope

Nao fazer geoprocessamento pesado no cliente quando o resultado for persistente ou autoritativo.

## API contracts

### Paginacao

Nao retornar listas ilimitadas.

Inicial:

```json
{
  "items": [],
  "nextCursor": null
}
```

Features devem permitir bbox:

```text
GET /layers/:id/features?bbox=minLng,minLat,maxLng,maxLat&limit=500
```

Objetivo: nunca baixar 100k features para o browser por acidente.

### Criar feature

Request:

```json
{
  "geometry": { "type": "Polygon", "coordinates": [] },
  "properties": {}
}
```

Response:

```json
{
  "id": "uuid",
  "layerId": "uuid",
  "geometry": {},
  "properties": {},
  "version": 1,
  "createdAt": "ISO",
  "updatedAt": "ISO"
}
```

### Concorrencia futura

Usar `version` desde agora.

PATCH aceita `version` esperado. Se registro foi alterado, retornar 409 `VERSION_CONFLICT`.

Isso evita reescrita quando colaboracao chegar.

## Erros

Classes pequenas:

- AppError
- NotFoundError
- ValidationError
- ConflictError

Formato unico conforme PRD mestre.

Codigos estaveis:

- PROJECT_NOT_FOUND
- LAYER_NOT_FOUND
- FEATURE_NOT_FOUND
- INVALID_GEOMETRY
- GEOMETRY_TYPE_MISMATCH
- VERSION_CONFLICT
- IMPORT_UNSUPPORTED_FORMAT
- INTERNAL_ERROR

Nao retornar mensagem SQL ao frontend.

## Neon

### Desenvolvimento

- `DATABASE_URL` server-side apenas.
- Preferir pooled connection quando indicado pelo provider.
- Uma branch dev inicial.
- Migrations no git sao fonte de verdade.

### Futuro

Preparar scripts para:
- branch por PR;
- reset de branch de teste;
- schema diff;
- snapshot antes de migration critica.

Nao implementar automacao de branch agora.

## Martin

Martin sera um servico separado.

Nesta fase:
- adicionar config e compose;
- validar que consegue ler PostGIS;
- nao substituir endpoint CRUD por tile server;
- usar Martin quando camada atingir volume em que GeoJSON deixa de ser adequado.

Regra de promocao sugerida:
- ate alguns milhares de features visiveis: GeoJSON filtrado por bbox;
- volumes maiores: vector tiles.

Nao hardcodar um numero como limite de negocio sem benchmark.

## Imports

Primeira etapa pode suportar:

1. GeoJSON
2. KML
3. Shapefile ZIP

GeoPackage e GeoTIFF entram depois do nucleo.

Pipeline:

```text
upload -> detect -> validate -> parse -> normalize CRS -> transaction -> summary
```

Nunca confiar em extensao de arquivo apenas.

Aplicar limites de tamanho configuraveis.

## APIs externas

Nao chamar diretamente APIs externas dentro de queries de dominio.

Criar adapters somente quando usados:

```text
services/api/src/integrations/
  geocoder/
  terrabrasilis/
  ibge/
```

Nao criar pasta vazia para dezenas de integracoes futuras.

## Cache

Nao adicionar Redis no MVP.

Para geocoding publico:
- cache em tabela simples ou memoria local durante dev;
- depois migrar se demanda justificar.

Evitar infraestrutura antecipada.

## Observabilidade

Logger estruturado:

- requestId
- route
- method
- status
- latencyMs
- entityId quando aplicavel

Nunca logar:
- DATABASE_URL
- tokens
- arquivo inteiro de upload
- payload completo sem necessidade
- coordenadas sensiveis quando futuramente classificadas como evidencia restrita

## Seguranca sem auth

- bind local por padrao;
- CORS allowlist via env;
- payload size limit;
- Zod em body, params e query;
- SQL parametrizado;
- nenhuma query montada concatenando filtro do usuario;
- URLs externas validadas para evitar SSRF futuro;
- uploads fora de pasta publica;
- MIME e magic bytes quando houver upload.

## Testes backend

### Unit

- validacao de geometry type
- parsing bbox
- pagination cursor
- error mapping
- CRS helpers

### Integration

Com banco PostGIS real de teste:
- cria projeto
- cria camada
- cria feature
- bbox encontra feature
- update incrementa version
- version antiga retorna 409
- delete logico some da listagem
- audit_event criado

Nao mockar PostGIS para testes espaciais.

## Migracoes

Regra expand/contract desde o primeiro dia.

Cada migration deve ter:
- objetivo
- impacto
- rollback logico documentado
- compatibilidade com codigo anterior quando aplicavel

Proibido renomear coluna critica em uma migration futura sem estrategia expand/contract.

## Performance

Queries criticas devem ser desenhadas para:

```sql
WHERE layer_id = ?
AND geometry && ST_MakeEnvelope(...)
AND deleted_at IS NULL
```

Usar operador bbox para aproveitar GiST antes de funcoes mais caras.

Nao usar `SELECT *` em endpoints de lista.

Nao retornar geometry pesada quando a tela precisa apenas metadata.

## Definition of Done

- API inicia com um comando.
- `/health` funciona.
- Neon conecta.
- PostGIS validado.
- migrations idempotentes no ambiente limpo.
- CRUD projects/layers/features funcionando.
- bbox query funcionando.
- area e distancia autoritativas calculaveis.
- audit trail basico.
- erros normalizados.
- testes integracao PostGIS verdes.
- nenhuma dependencia backend desnecessaria.

## Handoff para frontend

Backend deve publicar no repositorio:

- contratos Zod
- exemplos de request/response
- codigos de erro
- seed minimo de desenvolvimento
- comando para subir API
- variavel `VITE_API_URL` esperada pelo admin, sem segredo

Frontend nao deve esperar implementacao interna do backend; apenas contratos.
