# GeoNexo - Contratos de Integracao entre Agentes

Este arquivo e a regra anti-conflito do monorepo.

## 1. Fonte de verdade por assunto

| Assunto | Fonte |
|---|---|
| HTTP schemas | `packages/contracts` |
| Banco/schema | `packages/db` |
| UI primitives | `packages/ui` |
| Map engine adapters | `packages/maps` |
| CRS/calculos | `packages/geo` |
| API behavior | `services/api` |
| Pages | `apps/admin` |
| Testes E2E | `e2e` |
| ADRs | `docs/adr` |

## 2. Import rules

Permitido:

```text
apps/admin -> packages/ui
apps/admin -> packages/maps
apps/admin -> packages/geo
apps/admin -> packages/contracts
services/api -> packages/db
services/api -> packages/contracts
services/api -> packages/geo quando for codigo isomorfico seguro
packages/maps -> packages/geo
packages/maps -> packages/contracts
```

Proibido:

```text
packages/* -> apps/*
packages/db -> services/api
frontend -> services/api internals
admin -> packages/db
browser -> DATABASE_URL
```

## 3. Contract-first

Antes de backend e frontend implementarem feature nova:

1. contrato Zod em `packages/contracts`;
2. test do contrato;
3. backend implementa;
4. frontend consome.

Nao criar interface duplicada para ganhar tempo.

## 4. Identificadores

IDs expostos sao string UUID.

Frontend trata como opaque string.
Nao inferir ordem, timestamp ou tipo pelo ID.

## 5. Dates

API retorna ISO 8601 UTC.
Frontend formata localmente.
Banco usa timestamptz.

## 6. Geometry

API transporta GeoJSON.
Banco guarda PostGIS geometry.

Feature contract:

```text
id
layerId
geometry
properties
version
createdAt
updatedAt
```

`properties` e JSON object, nunca string JSON.

## 7. CRS

- banco canonico: EPSG:4674;
- browser/GeoJSON: contrato explicitamente documentado;
- conversao centralizada;
- nenhum componente cria proj string manualmente.

## 8. Error envelope

Todos endpoints:

```json
{
  "error": {
    "code": "STABLE_CODE",
    "message": "Safe message",
    "requestId": "uuid"
  }
}
```

Frontend decide comportamento por `code`, nao por texto de `message`.

## 9. Pagination

Nunca responder array ilimitado em recurso que pode crescer.

Padrao:

```json
{
  "items": [],
  "nextCursor": null
}
```

## 10. Mutations

Botao deve impedir submit duplicado.
Backend deve considerar idempotencia onde repeticao puder criar duplicata.

Feature update usa `version` para detectar conflito.

## 11. Map provider abstraction

Admin nunca hardcoda OpenFreeMap em pagina.

Provider nasce em configuracao/registry de `packages/maps`.

Objetivo: trocar provider por:
- self-host;
- PMTiles;
- outro vector tile provider;
- fonte institucional.

## 12. External data adapters

INPE/IBGE/geocoder entram por adapter backend ou map source documentada.

Nenhuma regra de negocio depende diretamente do host de terceiro.

## 13. Shared root files

Estes arquivos exigem coordenacao antes de editar em paralelo:

```text
package.json
pnpm-workspace.yaml
turbo.json
tsconfig base
eslint config
prettier config
docker compose
.env.example
```

O agente foundation cria a primeira versao.
Depois, qualquer mudanca estrutural deve ser pequena e justificada.

## 14. Merge order

1. foundation
2. contracts/db base
3. backend + frontend em paralelo
4. security
5. quality integration
6. fixes finais

Security e quality podem trabalhar em paralelo desde cedo, mas alteracoes em arquivos raiz entram depois de rebase na main atual.

## 15. Definition of compatible change

Mudanca e compativel quando:
- contrato antigo continua valido;
- migrations nao quebram codigo atual;
- frontend antigo nao recebe campo removido;
- API nao muda significado silenciosamente.

Breaking changes exigem ADR.
