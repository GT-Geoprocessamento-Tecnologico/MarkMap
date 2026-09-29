# GeoNexo - Pacote de PRDs

## Ordem de uso

1. Todos os agentes leem `00-MASTER-PRD.md` e `50-CONTRATOS-DE-INTEGRACAO.md`.
2. `@frontend-prd-handoff` executa `20-FRONTEND-PRD-HANDOFF.md` primeiro e cria a fundacao.
3. A fundacao e mergeada.
4. Em paralelo:
   - `@backend-visionario` -> `10-BACKEND-VISIONARIO-PRD.md`
   - `@frontend-visionario` -> `21-FRONTEND-VISIONARIO-PRD.md`
   - `@seguranca-visionario` -> `30-SEGURANCA-VISIONARIO-PRD.md`
   - `@qualidade-visionario` -> `40-QUALIDADE-VISIONARIO-PRD.md`
5. Todos respeitam ownership e contratos.

## Resultado esperado da primeira fase

Um admin web local que cria projeto, camada e geometria, persiste no Neon/PostGIS e recarrega corretamente.

## Nao fazer agora

- login;
- PWA;
- app mobile;
- deploy Vercel;
- site institucional;
- billing;
- realtime;
- GNSS externo.

## Links de repositorios uteis

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

## APIs/fontes gratuitas planejadas

- OpenFreeMap: https://openfreemap.org/
- OpenStreetMap/Nominatim: https://operations.osmfoundation.org/policies/nominatim/
- TerraBrasilis/INPE: https://terrabrasilis.dpi.inpe.br/
- TerraBrasilis WFS: https://terrabrasilis.dpi.inpe.br/geoserver/ows

## Nota

Os PRDs definem arquitetura e execucao. Antes de copiar codigo de qualquer repositorio, confirmar a LICENSE da versao/commit realmente usado.
