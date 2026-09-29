# Basemap providers

O provider padrão é **OpenFreeMap** (https://openfreemap.org), sem chave e
compatível com MapLibre. Ele entra por **registry/configuração**, nunca
hardcoded em página.

## Uso pelo admin

```ts
import { createBasemapRegistry, createGeoNexoMap } from '@geonexo/maps';

const registry = createBasemapRegistry(); // já vem com liberty/bright/positron
registry.register({
  id: 'prefeitura-tiles',
  label: 'Base institucional',
  styleUrl: 'https://tiles.exemplo.gov.br/styles/base',
  attribution: 'Fonte institucional',
});

const map = createGeoNexoMap({ map: maplibreInstance, registry });
map.setBasemap('prefeitura-tiles'); // troca sem refactor
```

## Falha do basemap externo

Se o estilo remoto falhar (rede, 5xx, DNS), o controller aplica um estilo
local em branco (`createFallbackStyle`) e emite status `fallback`. Desenho,
seleção e camadas GeoJSON continuam funcionando offline. Erros isolados de
tile (404 de um source) **não** disparam fallback.

## Futuro (sem mudar páginas)

- self-host: registrar o `styleUrl` próprio;
- PMTiles: registrar estilo + adicionar source `pmtiles://`;
- Martin/vector tiles: camadas com `kind: 'vector-tile'` (passam
  `source-layer` automaticamente).
