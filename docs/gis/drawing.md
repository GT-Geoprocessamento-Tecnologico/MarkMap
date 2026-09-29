# Desenho e seleção

## Modos

```ts
import { createDrawAdapter, createTerraDrawEngine } from '@geonexo/maps';

const engine = createTerraDrawEngine({ map: maplibreInstance });
const draw = createDrawAdapter(engine, (event) => {
  // event: { type: 'create' | 'update' | 'delete', features, ids }
  // features são GeoJSON estáveis do @geonexo/geo
});

draw.setMode('point'); // | 'linestring' | 'polygon' | 'select'
```

Internals do Terra Draw (modos, snapshot, adapter MapLibre) ficam confinados
em `packages/maps/src/terra.ts`. Páginas importam apenas o adapter.

## Seleção

```ts
map.selectFeature(feature); // ou null para limpar
map.getSelectedId(); // string | null — alimenta o inspector do admin
```

Seleção é estado do controller + callback `onSelectFeature`; não emite
evento de desenho.

## Persistência (fluxo recomendado pelo PRD 21)

```text
editar localmente -> estado dirty -> salvar via API -> resposta -> commit visual
```

Em erro de save: manter a geometria dirty e oferecer retry. Nunca descartar
desenho silenciosamente.
