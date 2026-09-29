# HANDOFF — agente GIS/maps (branch `agent/gis`)

Data: 2026-09-28. Escopo exclusivo respeitado: só `packages/maps/**`,
`packages/geo/**`, `docs/gis/**` e fixtures nesses paths. Nada em
`apps/admin`, `services/api`, `packages/db` ou `packages/contracts`.

## O que foi entregue

- `@geonexo/geo`: `crs` (EPSG:4326/4674, SIRGAS 2000 via Proj4, transforms),
  `validate` (validação leve RFC 7946), `bbox` (compute/parse/intersect,
  incluindo parser de `?bbox=minLng,minLat,maxLng,maxLat`), `measure`
  (área/distância/centroide via Turf), `geojson` (tipos + helpers, properties
  sempre objeto).
- `@geonexo/maps`: `providers` (registry OpenFreeMap configurável),
  `controller` (criar/destruir, basemap, source/layer, visibility, fitBounds,
  seleção, fallback), `draw-adapter` (modos point/line/polygon + eventos
  create/update/delete em GeoJSON estável), `fallback` (estilo local quando o
  basemap externo falha), `maplibre` + `terra` (wiring isolado, nunca
  importado por testes).
- Testes unitários só do nosso código (fakes, sem WebGL/DOM): 5 suites em
  geo, 5 em maps. Nenhum teste de internals de MapLibre/Turf.
- Fixtures: `packages/geo/fixtures/*.geojson` (point, linestring, polygon,
  polygon-with-hole) e `packages/maps/fixtures/sample-features.geojson`.
- Docs: `docs/gis/` (README, providers, drawing, performance).

## Decisões que divergem do scaffold da foundation (justificadas)

1. Removidas `leaflet`, `react-leaflet`, `@maplibre/maplibre-gl-leaflet` de
   `packages/maps`: biblioteca não aprovada no PRD (stack aprovada é
   MapLibre GL JS direto) e duplicava o motor de render.
2. Removidas deps não usadas (`@geonexo/ui`, `zod`, `@geonexo/contracts` dos
   pacotes GIS): sem valor, só acoplamento.
3. `terra-draw` fixado em `^1.13.0` em vez de `^2.0.0`, e adicionado
   `terra-draw-maplibre-gl-adapter` (oficial, MIT): verificado no instalado
   (`terra-draw@1.35.0`) que o core **não** exporta
   `TerraDrawMapLibreGLAdapter` — o adapter vive no pacote companion
   (v1.4.1 na instalação). `src/terra.ts` usa imports estáticos tipados
   contra a API real (`ChangeListener`, `FinishListener`, construtores de
   modo sem argumentos obrigatórios), o que ainda corrigiu dois bugs do
   draft inicial (`finish` recebe `(id, { mode })`, não `(ids, string)`).
   Quem rodar `pnpm install` deve confirmar e ajustar se 2.x for real.
4. `tsconfig` autocontido nos dois pacotes (não estende
   `@geonexo/config/tsconfig/*`): a base compartilhada está quebrada
   (ver docs/api/README.md do backend, defeitos 1/7/8/9). Quando o config
   for corrigido, voltar a estender.
5. Build por `tsc` (igual a `packages/contracts`), não `vite build` sem
   config: sem `vite.config.ts` nos pacotes, o build Vite falharia.

## Para o BACKEND (contratos necessários — ownership deles)

Lacunas já mapeadas em `docs/api/README.md` que o GIS precisa:

1. `bboxSchema` + query `GET /layers/:id/features?bbox=&limit=` (P1);
2. `VERSION_CONFLICT` estável + 409 (P0);
3. envelope de erro `{ error: { code, message, requestId } }` (P0);
4. geometria GeoJSON válida como tupla `[lng, lat, alt?]` incl. Multi*
   (P1) — `packages/geo` já valida assim no cliente; o contrato precisa
   acompanhar. `feature.ts` atual nem aceita Polygon aninhado
   (`coordinates: z.array(z.number())`).

## Para o FRONTEND (como consumir)

- `createBasemapRegistry()` + `createGeoNexoMap({ map, registry })`;
- mapa real via `createMapLibreMap({ container, basemap })` (só no browser);
- desenho via `createTerraDrawEngine` + `createDrawAdapter`;
- medidas/CRS via `@geonexo/geo`. Não importar `maplibre-gl` nem
  `terra-draw` direto nas páginas.

## Validação — EXECUTADA (shell voltou no 2º turno)

Comandos (todos verdes, 2026-09-28, Node v24.16.0, pnpm 10.33.0):

```bash
pnpm install --no-frozen-lockfile   # ok (terra-draw@1.35.0, maplibre-gl@4.7.1,
                                    # @turf/turf@7.4.0, proj4@2.22.0)
pnpm --filter @geonexo/geo typecheck    # ok
pnpm --filter @geonexo/maps typecheck   # ok (após 4 correções reais: tupla no
                                        # teste, overloads em object literal,
                                        # cast de Record, attributionControl v4)
pnpm --filter @geonexo/geo test     # 5 suites, 27 testes, ok
pnpm --filter @geonexo/maps test    # 6 suites, 22 testes, ok
pnpm --filter @geonexo/geo lint     # limpo
pnpm --filter @geonexo/maps lint    # limpo
pnpm --filter @geonexo/geo build    # ok
pnpm --filter @geonexo/maps build   # ok
node smoke em packages/geo/dist/src/index.js:
  computeBbox -> [-48,-16,-47,-15]; SRID_CANONICAL -> 4674;
  parseBboxParam -> [-48,-16,-47,-15]
```

Limites honestos do escopo:

- Gates rodados **com escopo nos pacotes GIS** (`--filter`), não o `turbo`
  raiz: o lint/typecheck raiz continua quebrado por pacotes de outros donos
  (defeitos 1/4-15 de `docs/api/README.md`, fora do meu ownership).
- Lint usa `eslint.config.js` local mínimo (`eslint` + `typescript-eslint`,
  `no-explicit-any: error`) em cada pacote GIS, pois o config compartilhado
  está quebrado; revisitar quando quality/security o corrigirem.
- `pnpm install` atualizou `pnpm-lock.yaml` (arquivo raiz, mas atualização
  rotineira de lock por novas deps dos pacotes GIS; sem mudança estrutural).
- Repositório ainda **sem nenhum commit** (todo o tree é `??` em
  `agent/foundation`); branch `agent/gis` só faz sentido após o commit da
  foundation — não commitei nada (sem solicitação explícita).

**Pronto para merge? SIM (escopo GIS)** — todos os critérios de aceite do
brief passam com testes verdes; o merge efetivo depende do commit/branch da
foundation e dos contratos do backend listados acima.
