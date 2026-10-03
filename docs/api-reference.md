# Referência da API

Base principal: raiz ou prefixo `/api/v1`.

## Rotas públicas/infra

| Método | Rota | Estado |
|---|---|---|
| GET | `/health` | implementada |
| GET | `/api/v1` | implementada |
| GET | `/storage/presign/put?key=...` | implementada como indisponível (503) |
| GET | `/storage/presign/get?key=...` | implementada como indisponível (503) |

As rotas de storage validam a chave, mas a capability remota ainda não está disponível.

## Workspace

| Método | Rota | Função |
|---|---|---|
| POST | `/workspace/provision` | cria/vincula capability anônima de workspace |
| POST | `/workspace/recover` | recupera/rotaciona capability por bootstrap proof |

O bearer bruto não é armazenado no banco; o servidor guarda digest/hash.

## Sincronização

As rotas abaixo usam middleware de capability:

| Método | Rota | Função |
|---|---|---|
| POST | `/sync/push` | aplica lote de operações |
| GET | `/sync/pull` | retorna mudanças/tombstones após cursor |

### Push

Aceita até 500 operações por contrato. Resposta separa:

- `accepted`
- `alreadyApplied`
- `conflicts`

### Pull

Parâmetros:

- `cursor` opcional;
- `limit` de 1 a 500, padrão 200.

Retorna:

- `changes`
- `tombstones`
- `nextCursor`
- `hasMore`

## Rotas de domínio

No código atual, rotas diretas de projects/layers/features só são registradas quando `NODE_ENV !== "production"`.

Principais rotas:

- `GET/POST /projects`
- `GET /projects/:id`
- `GET/POST /projects/:projectId/layers`
- `GET/POST /layers`
- `GET/DELETE /layers/:id`
- `GET/POST /layers/:layerId/features`
- `GET/POST /features`
- `GET/DELETE /features/:id`

Observação: o frontend contém cliente para `PATCH /features/:id`, mas essa rota não está presente no arquivo de rotas atual. Em `mock` isso não afeta a API real; em modo `live` deve ser tratado como **gap de contrato** até implementação comprovada.

## Notifications

`GET /notifications` abre SSE e atualmente emite eventos demonstrativos de ping/alerta. Não deve ser tratado como telemetria ou notificação de produção.
