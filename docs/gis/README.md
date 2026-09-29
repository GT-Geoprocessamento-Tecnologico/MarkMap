# GIS — núcleo reutilizável do GeoNexo

Dois pacotes, sem dependência de páginas do admin:

- `@geonexo/geo` — CRS, validação leve, bbox, medidas e tipos/helpers GeoJSON.
  Puro TypeScript, roda em Node e no browser.
- `@geonexo/maps` — controller MapLibre, registry de basemaps, adapter Terra
  Draw e fallback de estilo. O admin consome mapa sem conhecer provider nem
  motor de desenho.

Regras de import (conforme `50-CONTRATOS-DE-INTEGRACAO`):

```text
apps/admin   -> packages/maps, packages/geo
packages/maps -> packages/geo
browser      -/-> DATABASE_URL (nunca)
```

Documentos:

- `providers.md` — como trocar o basemap por configuração.
- `drawing.md` — modos de desenho e eventos.
- `performance.md` — GeoJSON pequeno/médio hoje, tiles/PMTiles/Martin amanhã.
- `HANDOFF-GIS.md` — o que frontend e backend precisam saber.
