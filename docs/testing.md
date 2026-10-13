# Testes e qualidade

## Gates do monorepo

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## CI

Workflows ativos:

- `ci.yml`: lint, typecheck e unit tests;
- `build.yml`: build de todos os pacotes;
- `e2e.yml`: desktop/Android, iOS/WebKit e duas instalações isoladas;
- `integration.yml`: offline sync → PostGIS → pull;
- `android-apk.yml`: APK debug;
- `ios-app.yml`: build debug iOS;
- `quality-security.yml`:
  - `pnpm audit --prod --audit-level=high`;
  - scanner de secrets em arquivos rastreados;
  - Lighthouse em `/` e `/projects`;
  - acessibilidade mínima 0,90;
  - best-practices mínima 0,85;
  - performance e SEO monitorados como warning.

CI usa Node 22.

## PWA

Automação cobre:

- manifest standalone e ícones normal/maskable;
- service worker controlando a página;
- app shell em reload totalmente offline;
- upgrade IndexedDB v1→v2;
- preservação de workspace, entidade e outbox.

## Sync em duas instalações

Dois contextos Chromium isolados executam o app em modo live contra servidor determinístico do teste. O fluxo cobre:

- provision/recovery;
- criação offline;
- commit seguido de erro e retry;
- idempotência por `operationId`;
- pull após reconexão real da segunda instalação;
- edições concorrentes;
- `VERSION_CONFLICT`;
- resolução explícita sem sobrescrita silenciosa.

Persistência/materialização real continua coberta pelo PostGIS Integration.

## GIS/GeoPDF

Testes unitários da auto-calibração cobrem:

- grade geográfica consistente aceita;
- grade inconsistente rejeitada;
- grade SIRGAS/UTM 22S aceita e convertida para WGS84;
- quantidade insuficiente de rótulos rejeitada.

## Maps Engine v2 offline

Suítes novas da iniciativa `feat/maps-engine-v2-offline`, todas em
`environment: node` e rolando sem rede:

| Suíte | Pacote | Cobre |
| --- | --- | --- |
| `tests/search` | `@geonexo/maps` | normalização, sharding, prefixo binário, Levenshtein, relevância/fuzzy |
| `tests/elevation` | `@geonexo/maps` | `sampleDem`/bilinear, perfil (ganho/perda/min/máx), marching squares |
| `tests/routing` | `@geonexo/maps` | snap, restrições de acesso/perfil, Dijkstra, manobras |
| `tests/security` | `@geonexo/maps` | path traversal, checksum, limites, XML depth, zip bomb, sanitização |
| `tests/pipeline` | `@geonexo/maps` | pipeline regional ponta a ponta, sharding de saída, manifest v2, erros de args |
| `tests/offline` + `tests/fixtures/offline` | `@geonexo/maps` | validação de pacote, manifest v2, rejeição de URL remota |
| `tests/gpx`, `tests/kml` | `@geonexo/geo` | parsers GPX/KML, waypoints/tracks/rotas, entrada malformada |

Gate executável da iniciativa:

```bash
npx turbo run lint build test --filter='./packages/*' --force
```

Resultado registrado em `docs/MM-MAP-940-gate-pr.md` (15/15 tarefas).
Obs.: parte das suítes tem cases marcados como skipped quando o fixture exige
binário grande; eles contam como skipped, não como falha.

## Segurança automatizada

O scanner de secrets é intencionalmente de alta precisão: recusa arquivos `.env` rastreados (exceto templates) e padrões inequívocos de chaves privadas/tokens. Ele não imprime o valor detectado.

## Limites

Automação **não substitui** instalação PWA física, GPS/force-stop/storage do SO, testes físicos Android/iOS ou smoke autorizado contra production.

## Evidência

Uma tarefa só é marcada concluída quando o gate relevante está verde ou a limitação está explicitamente registrada.
