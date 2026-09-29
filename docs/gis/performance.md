# Performance GIS

## Regra atual

- **Pequeno/médio:** GeoJSON direto (`addGeoJsonSource`).
- **Grande:** NÃO carregar GeoJSON gigante no browser. O caminho está aberto
  via `kind: 'vector-tile'` em `LayerEntry` + `GET /layers/:id/features?bbox=`
  (a implementar no backend) + Martin/PMTiles.

## Carregamento por bbox (admin deve implementar)

```text
map moveend -> debounce -> bbox atual -> query features da layer visível
-> TanStack Query -> addGeoJsonSource
```

Sem refetch por frame; sem optimistic update destrutivo em geometria.

## Baselines (medir após primeiro build real)

[Pendente — definir após a primeira medição, conforme PRD 40.]

- bootstrap do admin;
- abertura do workspace;
- render com 100 / 1k / 10k features;
- bundle do mapa.
