# GeoNexo API — Contratos, validação e pendências

Documento do agente **Backend**. Escopo: o que existe em `services/api` e
`packages/contracts`, o que foi validado, e o que ainda bloqueia a API.

## 0. Resumo do estado

| Gate | `services/api` | `packages/contracts` |
|---|---|---|
| `tsc --noEmit` | **passa** (0 erros) | **passa** (0 erros) |
| `vitest run` | **24/24 passa** | **45/45 passa** |
| `esbuild` build | **passa** (185.3 kb) | n/a |
| `eslint` | **falha** (config compartilhado, L1) | idem |
| `pnpm lint/typecheck/test/build` na raiz | **falha** — `turbo` não instalado (R1) |

Ainda **não implementados**: `GET/POST /projects`, `PATCH /projects/:id`,
`GET/POST /projects/:id/layers`, `GET/PATCH/DELETE /layers/:id`,
`GET/POST /layers/:id/features` com `bbox`, `GET/PATCH/DELETE /features/:id`,
`imports`, `map-sources` e os módulos `modules/{projects,layers,features,imports}`.
Todos dependem de `packages/db`, que está vazio e é read-only para o Backend
(seção 3).

## 1. `services/api` — núcleo HTTP entregue

| Arquivo | Responsabilidade |
|---|---|
| `src/app.ts` | monta o app: request-id → CORS → log → rotas, uma única fronteira de erro |
| `src/server.ts` | sobe em `HOST`/`PORT` (padrão `127.0.0.1:3000`) |
| `src/index.ts` | entrypoint; default export para `hono dev` |
| `src/env.ts` | env validado com Zod; `DATABASE_URL` opcional para o `/health` responder antes das migrations |
| `src/lib/errors.ts` | `AppError`, `NotFoundError`, `ValidationError`, `ConflictError` + mapa `code -> status` |
| `src/middleware/request-id.ts` | aceita `x-request-id` só se for UUID válido, senão gera um |
| `src/middleware/logger.ts` | log JSON com `requestId`, `method`, `path`, `status`, `latencyMs` |
| `src/middleware/cors.ts` | allowlist via `CORS_ORIGINS`, sem wildcard, sem credentials |
| `src/middleware/error-handler.ts` | único ponto que transforma qualquer erro no envelope |
| `src/routes/health.ts` | `/health` e `/api/v1` |
| `src/lib/pagination.ts` | paginação por cursor opaco (keyset em `createdAt,id`); `toPage` usa a linha extra como prova de próxima página, sem `COUNT` |
| `tests/api.test.ts` | mapeamento de erro, envelope, request-id, vazamento de segredo |
| `tests/pagination.test.ts` | round trip de cursor, opacidade, rejeição de cursor adulterado, `toPage` |

Segurança coberta (brief, "Segurança mínima"): envelope único, request id,
logger sem corpo/segredo, CORS restrito, sem stack trace no cliente,
`DATABASE_URL` nunca sai em resposta. Há teste que injeta
`postgres://user:secret@host/db` no erro e confirma que a resposta não contém
o segredo.

**Pendência de código:** `src/lib/errors.ts` duplica os códigos que já existem
em `packages/contracts/src/errors.ts`. Assim que houver dono único de
`packages/contracts`, o backend deve importar de lá e remover a cópia.

## 2. `packages/contracts` — corrigido e validado

O que foi corrigido (bugs reais encontrados por teste, não por leitura):

1. **`positionSchema` rejeitava todo GeoJSON 2D.** Era
   `z.tuple([n, n, n.optional()])`; nesta versão do Zod `.optional()` **não**
   relaxa o mínimo, então exigia 3 elementos e `[-45,-15]` falhava com
   `too_small, minimum: 3`. Agora é `z.union` de tupla de 2 e de 3.
2. **`featureSchema.geometry` não era GeoJSON.** Era
   `{ type, coordinates: z.array(z.number()) }`, então um `Polygon` real
   (coordenadas aninhadas) era rejeitado. Agora usa `geometrySchema`.
3. **Envelope de paginação rejeitava o formato documentado.**
   `nextCursor: z.string().optional()` recusava `{items:[], nextCursor:null}`.
   Agora é `z.string().nullable()` e obrigatório.
4. **Envelope de erro sem wrapper.** Era só o objeto interno; agora existe
   `errorResponseSchema` com `{ error: { code, message, requestId, details? } }`.
5. **Códigos de erro divergiam do PRD.** `NOT_FOUND`, `CONFLICT`,
   `GEOMETRY_INVALID` foram trocados pelos códigos estáveis da seção
   318-329 do PRD, com `httpStatusByErrorCode` (inclui 409 para
   `VERSION_CONFLICT`).
6. **`any` em contratos.** `z.record(z.any())` e `z.array(z.any())` foram
   substituídos por `z.record(z.unknown())` / `z.array(z.unknown())`.
7. **Duplicação.** `geometryTypeSchema` estava em `geometry.ts` **e**
   `layer.ts`; ficou só em `geometry.ts`.
8. **Faltavam `bbox` e versionamento.** Adicionados `bboxSchema`,
   `listFeaturesQuerySchema` e `version` obrigatório em `updateFeatureSchema`
   com refine exigindo `geometry` ou `properties`.
9. **Anéis de polígono.** `linearRingSchema` agora exige 4 posições e
   fechamento (primeira igual à última), conforme RFC 7946. Validade de área
   continua sendo do PostGIS (`ST_IsValid`).
10. **`MultiPoint`/`MultiLineString`/`MultiPolygon` aceitos.** Antes
    `geometryTypeSchema` os listava mas `geometrySchema` recusava.

Cobertura: 45 testes em `tests/contracts.test.ts`.

### Pendências conhecidas dos contratos

- `layerSchema` ainda usa `type` (Point/LineString/…) em vez de `kind`
  (point/line/polygon/mixed/raster/remote) + `geometryType` anulável, e não tem
  `srid`, `style`, `metadata`, `visibleByDefault`, `sortOrder`
  (PRD `10-BACKEND-VISIONARIO-PRD.md:143-149`). Sem `kind`, camadas `raster`
  e `remote` são impossíveis de representar.
- `projectSchema` não tem `status` (PRD: `status varchar(32) default 'active'`).
- `import.ts` usa `pending` (PRD: `queued`), importa por `source: z.string().url()`
  em vez de upload, e não tem `format`, `targetLayerId`, `originalName`,
  `rowCount`, `errorCode`, `errorMessage`.
- `GeometryCollection` não é modelado. O primeiro marco só produz
  Point/LineString/Polygon e Multi*, então ficou fora de propósito — mas
  precisa entrar antes de qualquer fonte que emita GeometryCollection.
- `bboxSchema` está defined e testado, mas **nenhum endpoint o consome** ainda.

## 3. Pendências bloqueantes

1. **`packages/db` está vazio** e é read-only para o Backend. Os 8 critérios
   de aceite dependem de persistência; o PRD proíbe duplicar schema Drizzle
   dentro de `services/api`. Enquanto isso, nenhum endpoint pode existir.
2. **Foundation não mergeada.** `.git/HEAD` continua em
   `refs/heads/agent/foundation`, não em `agent/backend`.
3. **Lint quebrado por config compartilhado** (seção 4, defeito L1).
4. **`turbo` não instalado** (seção 4, defeito R1): os 4 scripts da raiz são
   `turbo run …`, então `pnpm lint/typecheck/test/build` na raiz falha. Hoje só
   dá para validar por workspace.

## 4. Defeitos da foundation (verificados por execução)

| # | Arquivo | Problema | Efeito |
|---|---|---|---|
| **R0** | `pnpm-workspace.yaml` | usava `workspaces:` (sintaxe npm) em vez de `packages:` | **corrigido**: pnpm via 1 projeto em vez de 9, `pnpm install` instalava 0 pacotes e o lockfile ficava `importers: .: {}` |
| R1 | `package.json` (raiz) | sem `devDependencies` e sem `packageManager`; todo script chama `turbo` | `pnpm <gate>` na raiz falha: `'turbo' não é reconhecido` |
| R2 | `package.json:4-8` (raiz) | campo `workspaces` de npm em monorepo pnpm | redundante; origem dos arquivos corrompidos |
| R3 | `turbo.json:3` | `"pipeline"`, removido no Turborepo 2.x (agora `"tasks"`) | `turbo run` falha |
| R4 | `turbo.json:2` | `$schema` aponta `turborepo.org`; v2 usa `turborepo.com` | schema inválido |
| R5 | `packages/config/eslint.config.js:2,11` | `FlatCompat` e `join` importados e não usados | lint falha no próprio arquivo |
| R6 | `packages/config/eslint.config.js:47` | `project: ../../tsconfig.json` (raiz) — não existe | resolver do typescript-eslint quebra |
| R7 | `packages/config/eslint.config.js:50` | `paths: ../../src` — `packages/src` não existe | resolver node quebrado |
| R8 | `packages/config/eslint.config.js:74` | `react-refresh/react-only: error` em todo `**/*.ts` | falha em qualquer arquivo que não seja componente React |
| **L1** | `packages/config/package.json` | **sem dependências**, mas o `eslint.config.js` importa 9 plugins | `ERR_MODULE_NOT_FOUND: Cannot find package '@eslint/eslintrc' imported from packages/config/eslint.config.js` — **é o que trava `pnpm lint` hoje** |
| L2 | `packages/config/tsconfig/node.json:4` | `module: CommonJS` herdando `moduleResolution: bundler` | TS5095; `services/api` e `packages/contracts` não passam de typecheck por esse caminho |
| L3 | `packages/config/tsconfig/*` | `extends: "@geonexo/config/tsconfig/node"` não resolve | TS6053 `File '@geonexo/config/tsconfig/node' not found`. Contornado nos dois workspaces usando caminho relativo; a correção de verdade é no `packages/config` |

Além disso, 11 diretórios/arquivos lixo foram criados na raiz por um script que
usou caminho como nome de arquivo (`D?MATEUSDocumentosGitHubGeoNexo...`). Foram
removidos; estavam todos vazios. Vale revisar o script que os gerou, senão
voltam.

## 5. Handoff para o frontend

- **Contratos**: `@geonexo/contracts`. Consumir por
  `import { ... } from '@geonexo/contracts'`; nunca copiar tipos.
- **`VITE_API_URL`**: o admin espera esta variável, **sem segredo**, apontando
  para `http://127.0.0.1:3000` em desenvolvimento. A API responde em `/api/v1`.
  **Nenhuma `DATABASE_URL` pode ir para o browser.**
- **Envelope de erro**: `{ error: { code, message, requestId, details? } }`.
  Branch por `code`, nunca por `message`. Códigos e status estão em
  `httpStatusByErrorCode`.
- **Paginação**: `{ items, nextCursor }`, `nextCursor` sempre presente e anulável.
- **Conflito de edição**: `PATCH /features/:id` exige `version`; resposta
  `409` com `code: "VERSION_CONFLICT"`.
- **Ainda não consumir**: `bbox` (nenhum endpoint usa) e os campos `kind`/
  `srid`/`style` da camada (não existem no contrato ainda).
- **Exemplos de request/response**: bloqueados até os endpoints existirem.
- **Seed de desenvolvimento**: não criado (depende de `packages/db`).
- **Comando**: `pnpm --filter api dev`.
