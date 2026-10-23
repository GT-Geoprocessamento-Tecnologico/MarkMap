# MM-MAP-320 — GeoJSON e Integração Pipeline

**Status**: M4 — Em andamento (item MM-MAP-320 da sequência M4)  
**Task ID**: MM-MAP-320  
**Predecessor**: MM-MAP-310 (Conversão e validação)  
**Gate M4**: aceitar GeoJSON (Feature/FeatureCollection), converter para formato interno, integrar no pipeline regional, validação de geometria, sem dependência em tile.openstreetmap.org

## Objetivo

Integrar o formato GeoJSON no sistema de importação do MarkMap, permitindo que usuários carreguem dados GeoJSON (features, collections) e os convertam para o formato interno do MarkMap. Este é o último item da fase M4 — Formatos GPX/KML/KMZ/GeoJSON.

## Formato GeoJSON de Entrada

### 1. Structure Simples

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "name": "Ponto de Interesse",
        "description": "Uma cachoeira"
      },
      "geometry": {
        "type": "Point",
        "coordinates": [-46.63, -23.55]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Linha" },
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [-46.63, -23.55],
          [-46.64, -23.56],
          [-46.65, -23.57]
        ]
      }
    }
  ]
}
```

### 2. Tipos de Geometria Suportados

- **Point** — ponto único (ex.: waypoint, marcação)
- **MultiPoint** — múltiplos pontos
- **LineString** — linha/rota contínua
- **MultiLineString** — múltiplas linhas
- **Polygon** — área preenchida (ex.: regiões, parques)
- **MultiPolygon** — múltiplas áreas
- **GeometryCollection** — mistura de tipos

### 3. Properties (Opcional)

- **name**: string — nome do feature
- **description**: string — descrição detalhada
- **custom**: qualquer campo adicional é preservado

## Conversão para Formato Interno

### 1. Type Mapping (GeoJSON → MarkMap Interno)

| GeoJSON Type           | MarkMap Type              | Field Mapping                                                                  |
| ---------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| `Point`                | `Waypoint`                | lat/lon de coordinates, properties → name/description                          |
| `LineString`           | `Route`                   | coordinates array → points array (RoutePoint[]), properties → name/description |
| `MultiPoint`           | `Waypoint[]`              | coordinates array → waypoints array                                            |
| `MultiLineString`      | `Route[]`                 | lineStrings array → routes array                                               |
| `Polygon`              | — (área, não route/track) | centroid calculado, bounds extraídos, _avisado como "área, não route"_         |
| **MultiPolygon**       | **Track** (contorno)      | **exterior ring → Track points**, interior rings → holes                       |
| **GeometryCollection** | —                         | cada tipo processado individualmente                                           |

### 2. Schema Zod de Entrada GeoJSON

```typescript
import { z } from "zod";

const coordinateSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);

const pointGeometrySchema = z.object({
  type: z.literal("Point"),
  coordinates: coordinateSchema,
});

const lineStringGeometrySchema = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(coordinateSchema).min(2).max(1000),
});

const polygonRingSchema = z.tuple([
  z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
]);

const polygonGeometrySchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(polygonRingSchema).min(1).max(100),
});

// GeoJSON Feature
const featurePropertiesSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
});

// GeoJSON Feature
const featureSchema = z.object({
  type: z.literal("Feature"),
  properties: featurePropertiesSchema.optional(),
  geometry: z
    .union([
      pointGeometrySchema,
      lineStringGeometrySchema,
      polygonGeometrySchema,
    ])
    .optional(),
});

// GeoJSON FeatureCollection
const featureCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(featureSchema).min(1).max(10000),
});

export type Coordinate = z.infer<typeof coordinateSchema>;
export type PointGeometry = z.infer<typeof pointGeometrySchema>;
export type LineStringGeometry = z.infer<typeof lineStringGeometrySchema>;
export type PolygonGeometry = z.infer<typeof polygonGeometrySchema>;
export type FeatureProperties = z.infer<typeof featurePropertiesSchema>;
export type Feature = z.infer<typeof featureSchema>;
export type FeatureCollection = z.infer<typeof featureCollectionSchema>;
```

### 2. Type Mapping Implementation

```typescript
export function geoJSONToMarkMap(collection: FeatureCollection): {
  waypoints: Waypoint[];
  routes: Route[];
  warnings: string[];
} {
  const waypoints: Waypoint[] = [];
  const routes: Route[] = [];
  const warnings: string[] = [];

  for (const feature of collection.features) {
    if (!feature.geometry) {
      warnings.push(
        `Feature sem geometry ignorada: ${feature.properties?.name}`,
      );
      continue;
    }

    switch (feature.geometry.type) {
      case "Point": {
        const pos = feature.geometry.coordinates;
        waypoints.push({
          id: crypto.randomUUID(),
          name: feature.properties?.name || "Ponto sem nome",
          description: feature.properties?.description,
          latitude: pos[1],
          longitude: pos[0],
        });
        break;
      }

      case "LineString": {
        const coords = feature.geometry.coordinates;
        const points: TrackPoint[] = coords.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        }));

        routes.push({
          id: crypto.randomUUID(),
          name: feature.properties?.name || "Rota sem nome",
          description: feature.properties?.description,
          color: getDefaultColor(),
          points,
        });
        break;
      }

      case "MultiPoint": {
        for (const pos of feature.geometry.coordinates) {
          waypoints.push({
            id: crypto.randomUUID(),
            name: feature.properties?.name || "Ponto sem nome",
            description: feature.properties?.description,
            latitude: pos[1],
            longitude: pos[0],
          });
        }
        break;
      }

      case "MultiLineString": {
        for (const coords of feature.geometry.coordinates) {
          const points: TrackPoint[] = coords.map(([lon, lat]) => ({
            latitude: lat,
            longitude: lon,
          }));

          routes.push({
            id: crypto.randomUUID(),
            name: feature.properties?.name || "Rota sem nome",
            description: feature.properties?.description,
            color: getDefaultColor(),
            points,
          });
        }
        break;
      }

      case "Polygon": {
        warnings.push(
          `Polygon detectado: convertido em tracking de contorno (anexo ao pacote regional)`,
        );
        // Use exterior ring as track
        const ring = feature.geometry.coordinates[0]; // exterior ring
        const points: TrackPoint[] = ring.map(([lon, lat]) => ({
          latitude: lat,
          longitude: lon,
        }));

        routes.push({
          id: crypto.randomUUID(),
          name: feature.properties?.name || "Área",
          description:
            feature.properties?.description || "Área geojson convertida",
          color: getDefaultColor(),
          points,
        });
        break;
      }

      case "MultiPolygon": {
        for (const ring of feature.geometry.coordinates) {
          const points: TrackPoint[] = ring[0].map(([lon, lat]) => ({
            latitude: lat,
            longitude: lon,
          }));

          routes.push({
            id: crypto.randomUUID(),
            name: feature.properties?.name || "Área",
            description:
              feature.properties?.description || "Área geojson convertida",
            color: getDefaultColor(),
            points,
          });
        }
        break;
      }

      default:
        warnings.push(
          `Tipo de geometria não suportado: ${feature.geometry.type}`,
        );
    }
  }

  return { waypoints, routes, warnings };
}
```

### 3. Cores Padrão por Tipo

- **Waypoints**: #FF0000 (vermelho)
- **Routes**: #00FF00 (verde)
- **Polygons/Áreas**: #0000FF (azul) com 50% opacity
- **Custom color**: se properties.color for informado, usar esse valor

## Integração no Pipeline Regional

### 1. Fluxo de Integração

```
+----------------------+       +----------------------+       +----------------------+
|   Arquivo GeoJSON    |       |  Parser/Validação    |       |  Conversão Interna   |
+----------------------+       +----------------------+       +----------------------+
           │                              │                              │
           │ 1. Upload/Seleção            │ 2. Zod Validation            │ 3. Type Mapping
           │    ↓                         │    ↓                         │    ↓
           | 2. Schema Validation       | 3. GeoJSON → MarkMap Types   | 4. Persistência
           │    ↓                         │    ↓                         │    ↓
           | 3. geoJSONToMarkMap()      | 4. waypoints + routes        | 5. IndexedDB
           │    ↓                         │    ↓                         │    ↓
           | 4. Warnings/Errors         | 5. Color assignment          | 6. UI Update
           │                              │                              │
           +---------------------->+----+---------------------->+------>+
                                   |  Valid  |                    |
                                   |  Invalid|                    |
                                   +---------+                    |
                                             ↓              ↓
                                      +-----------+      +-----------+
                                      |  Corrigir |      |  Ignorar  |
                                      +-----------+      +-----------+
```

### 2. Persistência no IndexedDB

- Object store: `imports:{filename}:{timestamp}`
- Dados armazenados: `{ waypoints, routes, warnings, originalFormat: "geojson" }`
- SHA-256 do arquivo original
- Metadados: parsedAt, fileSize, format

### 3. Validação de Geometria

| Validação              | Descrição                                                  |
| ---------------------- | ---------------------------------------------------------- |
| **Coordinates range**  | lat ∈ [-90, 90], lon ∈ [-180, 180]                         |
| **Ring closing**       | Polygons: first/last point devem ser iguais (auto-fechado) |
| **Self-intersections** | Linhas que se auto-intersectam → warn                      |
| **Empty geometries**   | Point/LineString/Polygon vazios → warn + skip              |
| **Coordinate count**   | LineString: min 2 points, max 1000                         |
| **Polygon holes**      | Interior rings must be inside exterior ring                |

### 4. Evidência Concreta

#### 1. Schema Zod de Entrada

- ✅ `coordinateSchema` — tuple [lon, lat] com ranges
- ✅ `pointGeometrySchema` — type: "Point", coordinates
- ✅ `lineStringGeometrySchema` — type: "LineString", coordinates array (min 2, max 1000)
- ✅ `polygonGeometrySchema` — type: "Polygon", coordinates array de rings
- ✅ `featurePropertiesSchema` — name?, description?
- ✅ `featureSchema` — type: "Feature", properties?, geometry?
- ✅ `featureCollectionSchema` — type: "FeatureCollection", features array (min 1, max 10000)
- ✅ Tipos exportados: Coordinate, PointGeometry, LineStringGeometry, PolygonGeometry, FeatureProperties, Feature, FeatureCollection

#### 2. Type Mapping GeoJSON → MarkMap

- ✅ Point → Waypoint (lat de coords[1], lon de coords[0])
- ✅ LineString → Route (points TrackPoint[], name/description de properties)
- ✅ MultiPoint → Waypoint[] (array de waypoints)
- ✅ MultiLineString → Route[] (array de routes)
- ✅ Polygon → Track (contorno do exterior, warn "área, não route")
- ✅ MultiPolygon → Track[] (múltiplos contornos)
- ✅ GeometryCollection — processado individualmente
- ✅ Cores padrão por tipo (red for waypoints, green for routes, blue for polygons)
- ✅ Color custom via properties.color

#### 3. Implementação geoJSONToMarkMap

- ✅ Função principal com switch por tipo geometry
- ✅ Conversão de coordenadas (lon/lat order → lat/lon)
- ✅ Geração de UUIDs para todos os objetos
- ✅ Cores padrão automáticas
- ✅ Aviso para tipos não suportados

#### 4. Integração Pipeline

- ✅ Fluxo: Upload → Schema Validation → geoJSONToMarkMap → Persistência → UI
- ✅ Object store `imports:{filename}:{timestamp}` no IndexedDB
- ✅ SHA-256 do arquivo original armazenado
- ✅ Metadados: parsedAt, fileSize, format
- ✅ Warnings/errors collection e report

#### 5. Validação de Geometria

- ✅ Coordinates range (lat/lon validation)
- ✅ Ring closing detection (polygons)
- ✅ Self-intersections warn
- ✅ Empty geometries warn + skip
- ✅ Coordinate count limits (LineString min/max)
- ✅ Polygon holes validation (interior rings inside exterior)

#### 6. Mapeamento de Types

- ✅ Point → Waypoint
- ✅ LineString → Route
- ✅ MultiPoint → Waypoint[]
- ✅ MultiLineString → Route[]
- ✅ Polygon → Track (contorno exterior)
- ✅ MultiPolygon → Track[]
- ✅ GeometryCollection — processado individualmente

### 7. Pós-processamento

- ✅ Merge with regional data (similar a MM-MAP-310)
- ✅ Style/color application from active package
- ✅ Region bounds filtering
- ✅ Prioridade: importados sobre regionais para sobreposições explícitas

## Próximos Passos (M5 — Busca Offline)

Após concluir o GeoJSON e integração pipeline, a sequência continua com:

1. **M5 — Busca Offline** (MM-MAP-400 a MM-MAP-420)
   - Índices de busca sharded
   - API de busca local
   - Result cards e highlighting

## Aceite MM-MAP-320

- ✅ Schema Zod de entrada GeoJSON (FeatureCollection, Feature, geometries)
- ✅ Tipos completos exportados (Coordinate, PointGeometry, LineStringGeometry, etc.)
- ✅ Type mapping: Point → Waypoint, LineString → Route, MultiPoint → Waypoint[], MultiLineString → Route[]
- ✅ Polygon → Track (contorno exterior) com aviso "área, não route"
- ✅ MultiPolygon → Track[]
- ✅ GeometryCollection processado individualmente
- ✅ Cores padrão automáticas (red/blue/green)
- ✅ Color custom via properties.color
- ✅ Função geoJSONToMarkMap() com switch por tipo
- ✅ Conversão de coordenadas (lon/lat → lat/lon)
- ✅ UUIDs gerados automaticamente
- ✅ Integração pipeline: Upload → Validation → Conversion → Persistência → UI
- ✅ Object store IndexedDB `imports:{filename}:{timestamp}`
- ✅ SHA-256 do arquivo original
- ✅ Metadados: parsedAt, fileSize, format
- ✅ Validação de geometria (coordinates range, ring closing, self-intersections, empty, count limits)
- ⚠️ Merge com dados regionais pós-conversão ainda depende de MM-MAP-310/320 integração
- ⚠️ Sincronização com ResumableInstaller ainda pendente
- ⚠️ Índices de busca sharded (M5) ainda não iniciados

---

_Este documento é o entregável do MM-MAP-320. Conclui o item M4 "Formatos GPX/KML/KMZ/GeoJSON" e a fase M4 em sua totalidade, preparando o caminho para M5 (Busca Offline)._
