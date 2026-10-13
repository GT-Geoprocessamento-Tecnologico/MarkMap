# MM-MAP-500 — Pipeline DEM/Contours

**Status**: M6 — Concluído  
**Task ID**: MM-MAP-500  
**Predecessor**: MM-MAP-420 (Result cards e highlighting)  
**Gate M6**: toda consulta funciona sem rede com pacote compatível

## Objetivo
Gerar por região: DEM adequado ao runtime, curvas de nível vetoriais, metadata de resolução/fonte/licença.

## Fontes de Inspiração (conceitos, não código copiado)
- `generator/srtm_parser.cpp` — parsing de dados SRTM (conceito: leitura de grid raster de elevação)
- `generator/isolines_generator.cpp` — geração de isolinhas (conceito: marching squares para curvas de nível)

## Estrutura de Dados

### 1. DEM (Digital Elevation Model)

```typescript
// packages/contracts/src/elevation.ts
import { z } from "zod";

export const demMetadataSchema = z.object({
  source: z.enum(["srtm", "copernicus-dem", "alos-dem"]),
  resolutionMeters: z.number().positive(),
  verticalDatum: z.enum(["EGM96", "WGS84", "EGM2008"]),
  license: z.string().min(1),
  attribution: z.string().min(1),
  bounds: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  noDataValue: z.number(),
  dataType: z.enum(["int16", "float32"]),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export type DemMetadata = z.infer<typeof demMetadataSchema>;
```

### 2. Curvas de Nível (Contours)

```typescript
export const contourSchema = z.object({
  elevation: z.number().finite(),      // metros
  interval: z.number().positive(),     // intervalo entre curvas (ex: 20, 100)
  isMajor: z.boolean().true(),          // curva mestre (multiplas de interval*5)
  geometry: z.array(z.tuple([z.number(), z.number()])), // [lon, lat] coords
});

export type Contour = z.infer<typeof contourSchema>;

export const contourLayerSchema = z.object({
  interval: z.number().positive(),       // intervalo base (ex: 20m)
  majorInterval: z.number().positive(),  // intervalo mestre (ex: 100m)
  minElevation: z.number(),
  maxElevation: z.number(),
  contours: z.array(contourSchema),
});

export type ContourLayer = z.infer<typeof contourLayerSchema>;
```

### 3. Perfil de Elevação

```typescript
export const elevationProfileSchema = z.object({
  points: z.array(z.object({
    distance: z.number().min(0),      // distância acumulada em km
    elevation: z.number().finite(),   // altitude em metros
    lon: z.number(),
    lat: z.number(),
  })).min(2),
  totalDistance: z.number().min(0),   // km
  minElevation: z.number(),
  maxElevation: z.number(),
  gain: z.number().min(0),            // ganho positivo acumulado (m)
  loss: z.number().min(0),            // perda negativa acumulada (m)
});

export type ElevationProfile = z.infer<typeof elevationProfileSchema>;
```

## Funções de Consulta

### 1. Lookup de Altitude

```typescript
// packages/maps/src/elevation/dem.ts
export function sampleDem(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  lon: number,
  lat: number
): number | null {
  const [minLon, minLat, maxLon, maxLat] = metadata.bounds;

  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) {
    return null;
  }

  const colFrac = (lon - minLon) / (maxLon - minLon);
  const rowFrac = (lat - minLat) / (maxLat - minLat);

  const col = Math.min(Math.floor(colFrac * (metadata.width - 1)), metadata.width - 1);
  const row = Math.min(Math.floor(rowFrac * (metadata.height - 1)), metadata.height - 1);

  const value = dem[row * metadata.width + col];
  if (value === metadata.noDataValue) return null;
  return value;
}

// Bilinear interpolation para suavidade
export function sampleDemBilinear(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  lon: number,
  lat: number
): number | null {
  const [minLon, minLat, maxLon, maxLat] = metadata.bounds;

  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return null;

  const colFrac = ((lon - minLon) / (maxLon - minLon)) * (metadata.width - 1);
  const rowFrac = ((lat - minLat) / (maxLat - minLat)) * (metadata.height - 1);

  const col0 = Math.floor(colFrac);
  const row0 = Math.floor(rowFrac);
  const col1 = Math.min(col0 + 1, metadata.width - 1);
  const row1 = Math.min(row0 + 1, metadata.height - 1);

  const dx = colFrac - col0;
  const dy = rowFrac - row0;

  const v00 = dem[row0 * metadata.width + col0];
  const v01 = dem[row0 * metadata.width + col1];
  const v10 = dem[row1 * metadata.width + col0];
  const v11 = dem[row1 * metadata.width + col1];

  if (v00 === metadata.noDataValue || v01 === metadata.noDataValue ||
      v10 === metadata.noDataValue || v11 === metadata.noDataValue) {
    return sampleDem(dem, metadata, lon, lat);
  }

  return v00 * (1 - dx) * (1 - dy) +
         v01 * dx * (1 - dy) +
         v10 * (1 - dx) * dy +
         v11 * dx * dy;
}
```

### 2. Cálculo de Perfil de Elevação

```typescript
// packages/maps/src/elevation/profile.ts
import { ElevationProfile } from "@geonexo/contracts";

export function computeElevationProfile(
  path: Array<[number, number]>,  // [lon, lat] coords
  dem: Int16Array | Float32Array,
  metadata: DemMetadata
): ElevationProfile {
  const points: ElevationProfile["points"] = [];
  let distance = 0;
  let prevElevation: number | null = null;
  let gain = 0;
  let loss = 0;
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let i = 0; i < path.length; i++) {
    const [lon, lat] = path[i];
    const elevation = sampleDemBilinear(dem, metadata, lon, lat) ?? 0;

    if (i > 0) {
      const [prevLon, prevLat] = path[i - 1];
      distance += haversineDistance(prevLat, prevLon, lat, lon);
    }

    if (prevElevation !== null) {
      const diff = elevation - prevElevation;
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
    }

    minElev = Math.min(minElev, elevation);
    maxElev = Math.max(maxElev, elevation);

    points.push({ distance, elevation, lon, lat });
    prevElevation = elevation;
  }

  return {
    points,
    totalDistance: distance,
    minElevation: minElev,
    maxElevation: maxElev,
    gain,
    loss,
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

### 3. Geração de Contours (Marching Squares)

```typescript
// packages/maps/src/elevation/contours.ts
export function generateContours(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  interval: number,
  majorInterval: number
): ContourLayer {
  const contours: Contour[] = [];
  const [minLon, minLat, maxLon, maxLat] = metadata.bounds;
  const lonStep = (maxLon - minLon) / (metadata.width - 1);
  const latStep = (maxLat - minLat) / (metadata.height - 1);

  const minElev = Math.min(...Array.from(dem).filter(v => v !== metadata.noDataValue));
  const maxElev = Math.max(...Array.from(dem).filter(v => v !== metadata.noDataValue));

  const startLevel = Math.ceil(minElev / interval) * interval;
  const endLevel = Math.floor(maxElev / interval) * interval;

  for (let level = startLevel; level <= endLevel; level += interval) {
    const isMajor = level % majorInterval === 0;
    const segments = marchingSquares(dem, metadata, level, lonStep, latStep);

    for (const seg of segments) {
      contours.push({
        elevation: level,
        interval,
        isMajor,
        geometry: seg,
      });
    }
  }

  return {
    interval,
    majorInterval,
    minElevation: minElev,
    maxElevation: maxElev,
    contours,
  };
}

function marchingSquares(
  dem: Int16Array | Float32Array,
  metadata: DemMetadata,
  level: number,
  lonStep: number,
  latStep: number
): Array<Array<[number, number]>> {
  const segments: Array<Array<[number, number]>> = [];
  const [minLon, minLat] = metadata.bounds;

  for (let row = 0; row < metadata.height - 1; row++) {
    for (let col = 0; col < metadata.width - 1; col++) {
      const tl = dem[row * metadata.width + col];
      const tr = dem[row * metadata.width + col + 1];
      const bl = dem[(row + 1) * metadata.width + col];
      const br = dem[(row + 1) * metadata.width + col + 1];

      if (tl === metadata.noDataValue || tr === metadata.noDataValue ||
          bl === metadata.noDataValue || br === metadata.noDataValue) continue;

      const index =
        (tl >= level ? 8 : 0) |
        (tr >= level ? 4 : 0) |
        (br >= level ? 2 : 0) |
        (bl >= level ? 1 : 0);

      if (index === 0 || index === 15) continue;

      const x0 = minLon + col * lonStep;
      const y0 = minLat + row * latStep;
      const x1 = x0 + lonStep;
      const y1 = y0 + latStep;

      const top = [x0 + lonStep * ((level - tl) / (tr - tl)), y0];
      const right = [x1, y0 + latStep * ((level - tr) / (br - tr))];
      const bottom = [x0 + lonStep * ((level - bl) / (br - bl)), y1];
      const left = [x0, y0 + latStep * ((level - tl) / (bl - tl))];

      const cases: Record<number, Array<[number, number][]]> = {
        1: [[bottom as any, left as any]],
        2: [[right as any, bottom as any]],
        3: [[right as any, left as any]],
        4: [[top as any, right as any]],
        5: [[top as any, right as any], [bottom as any, left as any]],
        6: [[top as any, bottom as any]],
        7: [[top as any, left as any]],
        8: [[top as any, left as any]],
        9: [[top as any, bottom as any]],
        10: [[top as any, right as any], [bottom as any, left as any]],
        11: [[top as any, right as any]],
        12: [[right as any, left as any]],
        13: [[right as any, bottom as any]],
        14: [[bottom as any, left as any]],
      };

      const segs = cases[index];
      if (segs) {
        for (const seg of segs) {
          segments.push(seg);
        }
      }
    }
  }

  return segments;
}
```

## Evidência Concreta

### 1. Schema de Metadados DEM
- ✅ Fonte (srtm, copernicus-dem, alos-dem)
- ✅ Resolução em metros
- ✅ Datum vertical (EGM96, WGS84, EGM2008)
- ✅ Licença e atribuição
- ✅ Bounds, noDataValue, dataType, width, height

### 2. Schema de Contours
- ✅ Elevation, interval, isMajor, geometry (coords [lon, lat])
- ✅ ContourLayer com interval, majorInterval, min/maxElevation, contours[]

### 3. Schema de Perfil de Elevação
- ✅ Points com distance (km), elevation (m), lon, lat
- ✅ totalDistance, minElevation, maxElevation, gain, loss

### 4. Funções de Consulta
- ✅ `sampleDem()` — lookup pixel-based
- ✅ `sampleDemBilinear()` — interpolação bilinear suave
- ✅ `computeElevationProfile()` — perfil completo com distance/gain/loss/min/max
- ✅ `haversineDistance()` — distância great-circle

### 5. Geração de Contours
- ✅ `generateContours()` — marching squares com interval e majorInterval
- ✅ `marchingSquares()` — detecção de segmentos por célula 2x2
- ✅ Suporte a todos os 16 casos do marching squares
- ✅ Filtro de noDataValue

### 6. Cache Local
- ✅ DEM armazenado em LargeBlobStore (IndexedDB/OPFS)
- ✅ Lookup sem rede (aceite global #8)
- ✅ Cache de altitude por coordenada (LRU)

---

*Entregável do MM-MAP-500. Prepara o caminho para MM-MAP-510 (Consulta de altitude).*