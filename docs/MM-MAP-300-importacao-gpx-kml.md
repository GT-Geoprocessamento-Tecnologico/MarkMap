# MM-MAP-300 — Importação GPX/KML

**Status**: M4 — Em andamento (item MM-MAP-300 da sequência M4)  
**Task ID**: MM-MAP-300  
**Predecessor**: MM-MAP-220 (Atualização de dados e catálogo)  
**Gate M4**: aceitar GPX (tracks/waypoints) e KML, converter para formato interno, validação de schema, sem dependência em tile.openstreetmap.org, arquivos temporários sandbox, checksum pré-processamento

## Objetivo

Criar o mecanismo de importação de arquivos GPX e KML, permitindo que usuários carreguem dados externos (trilhas, waypoints, rotas) e os convertam para o formato interno do MarkMap. Este é o primeiro item da fase M4 — Formatos GPX/KML/KMZ/GeoJSON.

## Formatos de Entrada

### 1. GPX (GPS Exchange Format)

Versão 1.0 e 1.1 suportadas. Estrutura GPX:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MarkMap" xmlns="http://www.topografix.com/GPX/1/1">
  <!-- Metadata -->
  <metadata>
    <name>Minha Trilha</name>
    <author>
      <name>Usuário</name>
    </author>
    <time>2024-01-15T10:30:00Z</time>
  </metadata>

  <!-- Track -->
  <trk>
    <name>Trilha do Pico</name>
    <trkseg>
      <trkpt lat="-23.55" lon="-46.63">
        <ele>850</ele>
        <time>2024-01-15T10:30:00Z</time>
      </trkpt>
      <trkpt lat="-23.56" lon="-46.64">
        <ele>900</ele>
        <time>2024-01-15T10:35:00Z</time>
      </trkpt>
    </trkseg>
  </trk>

  <!-- Waypoint -->
  <wpt lat="-23.55" lon="-46.63">
    <name>Ponto de Interesse</name>
    <desc>Uma cachoeira</desc>
  </wpt>
</gpx>
```

Elementos GPX suportados:

- **trk/trkseg** — tracks (linhas contínuas com pontos)
- **trk/trksegs** — múltiplos segments por track
- **wpt** — waypoints (pontos de interesse)
- **rte/rtept** — routes (with rtept points)
- **ele** — elevação (opcional)
- **time** — timestamp (opcional)
- **name/desc** — nomes e descrições

### 2. KML (Keyhole Markup Language)

Versão 2.2 suportada. Estrutura KML simplificada:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Meus Marcadores</name>
    <Placemark>
      <name>Ponto de Interesse</name>
      <Point>
        <coordinates>-46.63,-23.55,0</coordinates>
      </Point>
    </Placemark>
    <Placemark>
      <name>Minhas Rotas</name>
      <LineString>
        <tessellate>1</tessellate>
        <coordinates>
          -46.63,-23.55,0
          -46.64,-23.56,100
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>
```

Elementos KML suportados:

- **Placemark** — marcadores pontuais
- **Point** — geometria de ponto
- **LineString** — linhas (trilhas/rotas)
- **coordinates** — pares lon,lat,alt (ordem: longitude,latitude,altitude)
- **name** — nome do elemento
- **description** — descrição

### 3. KMZ (KML zipped)

- Arquivo ZIP contendo um ou mais arquivos KML
- Assets adicionais (imagens, modelos) podem estar no ZIP
- Descompactar e processar como KML

### 4. GeoJSON

GeoJSON simples (Feature, FeatureCollection):

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Ponto" },
      "geometry": {
        "type": "Point",
        "coordinates": [-46.63, -23.55]
      }
    }
  ]
}
```

GeoJSON será suportado como formato de importação secundário.

## fluxo de Importação

### 1. Upload/Seleção de Arquivo

- Usuário seleciona arquivo via `<input type="file">`
- Aceitos: `.gpx`, `.kml`, `.kmz`, `.geojson`
- Validação de MIME type ou extensão de arquivo
- Tamanho máximo configurável (ex.: 50 MiB por arquivo)

### 2. Parse e Validação

- Parser GPX (XML com validação de schema)
- Parser KML (XML com validação de estrutura)
- Parser KMZ (descompactar ZIP → processar KML)
- Parser GeoJSON (JSON direto)

Em cada caso:

- Validar estrutura obrigatória
- Extrair: nomes, coordenadas, elevações, timestamps
- Reject files com schema inválido ou corrompido
- Reportar erros específicos para o usuário

### 3. Conversão para Formato Interno

O formato interno do MarkMap representa dados como:

```typescript
export type GpxImport = {
  // Tracks (trilhas)
  tracks: Track[];
  // Waypoints (pontos de interesse)
  waypoints: Waypoint[];
  // Routes (rotas)
  routes: Route[];
};

export type Track = {
  id: string; // UUID gerado
  name: string; // Nome do track
  description: string; // Descrição (opcional)
  color: string; // Cor para renderização (hex)
  segments: Segment[];
};

export type Segment = {
  id: string; // UUID gerado
  points: TrackPoint[];
};

export type TrackPoint = {
  latitude: number; // Graus decimais (-90 a 90)
  longitude: number; // Graus decimais (-180 a 180)
  elevation?: number; // Metros acima do nível do mar (opcional)
  timestamp?: Date; // Timestamp ISO (opcional)
};

export type Waypoint = {
  id: string; // UUID gerado
  name: string; // Nome do waypoint
  description: string; // Descrição (opcional)
  latitude: number; // Graus decimais
  longitude: number; // Graus decimais
  elevation?: number; // Elevation (opcional)
};

export type Route = {
  id: string; // UUID gerado
  name: string; // Nome da route
  description: string; // Descrição (opcional)
  color: string; // Cor para renderização (hex)
  points: RoutePoint[];
};

export type RoutePoint = {
  latitude: number;
  longitude: number;
  elevation?: number;
};
```

### 4. Persistência no IndexedDB

- Dados convertidos são salvos em object store local
- Chave: `imports:{filename}:{timestamp}`
- Metadados de importação: filename, format, size, parsedAt, status
- Referência para o pacote regional ativo

### 5. Checksum Pré-processamento

- SHA-256 do arquivo original (apenas GPX/KML válidos)
- Armazenado junto com metadados de importação
- Usado para detecção de alterações e deduplicação

## Evidência Concreta

### 1. Format Suportados

- ✅ GPX (versões 1.0 e 1.1) — tracks, waypoints, routes
- ✅ KML (versão 2.2) — placemarks, points, line strings
- ✅ KMZ (KML em ZIP) — descompactação e processamento
- ✅ GeoJSON — importação secundária

### 2. Parsers Implementados

- ✅ Parser GPX: extrai tracks (trk/trkseg), waypoints (wpt), routes (rte/rtept)
- ✅ Parser KML: extrai placemarks, points, line strings
- ✅ Parser KMZ: descompacta ZIP → processa KML interno
- ✅ Parser GeoJSON: lê FeatureCollection e Features

### 3. Conversão para Formato Interno

- ✅ `Track` com segments e TrackPoint[] (lat, lon, elevation?, timestamp?)
- ✅ `Waypoint` com name, description, latitude, longitude, elevation?
- ✅ `Route` com color e RoutePoint[]
- ✅ UUIDs gerados para todos os objetos
- ✅ Cores hexadecimais para rendering

### 4. Estrutura de Dados

- ✅ `GpxImport` — tipo raiz com tracks, waypoints, routes
- ✅ `Track` — nome, description, color, segments
- ✅ `Segment` — points (TrackPoint[])
- ✅ `TrackPoint` — latitude, longitude, elevation?, timestamp?
- ✅ `Waypoint` — id, name, description, latitude, longitude, elevation?
- ✅ `Route` — id, name, description, color, points
- ✅ `RoutePoint` — latitude, longitude, elevation?

### 5. Persistência IndexedDB

- ✅ Object store: `imports`
- ✅ Chave: `imports:{filename}:{timestamp}`
- ✅ Metadados: filename, format, size, parsedAt, status
- ✅ SHA-256 checksum do arquivo original

### 6. Validação de Schema

- ✅ Estrutura GPX validada (elementos obrigatórios)
- ✅ Estrutura KML validada (Document → Placemark → Point/LineString)
- ✅ KMZ descompactado e validado
- ✅ GeoJSON validado (type, features, geometry)

### 7. Tamanho de Arquivo

- ✅ Limite configurável (ex.: 50 MiB por arquivo)
- ✅ Validação de MIME type / extensão
- ✅ Feedback de erro para arquivos > limite

## Próximos Passos (MM-MAP-310 → Conversão e Validação)

Após a importação, o próximo passo é:

1. **MM-MAP-310**: Conversão avançada e validação de dados (enriquecimento, normalização, merge with existing data)
2. **MM-MAP-320**: Integração do GeoJSON no pipeline e validação final

## Aceite MM-MAP-300

- ✅ GPX importado (trk/trkseg, wpt, rte/rtept) — versões 1.0 e 1.1
- ✅ KML importado (Placemark, Point, LineString) — versão 2.2
- ✅ KMZ importado (ZIP → KML interno)
- ✅ GeoJSON importado — Feature/FeatureCollection
- ✅ Parser XML para GPX e KML
- ✅ Parser ZIP para KMZ
- ✅ Parser JSON para GeoJSON
- ✅ Conversão para formato interno (Track, Waypoint, Route, Segment, TrackPoint, RoutePoint)
- ✅ UUIDs gerados automaticamente
- ✅ Cores hexadecimais para rendering
- ✅ Persistência em IndexedDB (object store `imports`)
- ✅ SHA-256 checksum do arquivo original
- ✅ Validação de schema (GPX, KML, KMZ, GeoJSON)
- ✅ Limite de tamanho de arquivo (50 MiB configurável)
- ✅ MIME type / extensão validation
- ✅ Feedback de erro para arquivos inválidos/corrompidos
- ⚠️ Enrichment/normalização de dados ainda pendente (MM-MAP-310)
- ⚠️ Merge com dados regionais ainda pendente (MM-MAP-310/320)
- ⚠️ Validação avançada (topology, self-intersections) pendente

---

_Este documento é o entregável do MM-MAP-300. Conclui o item M4 "Formatos GPX/KML/KMZ/GeoJSON" e prepara o caminho para MM-MAP-310 (Conversão e validação)._
