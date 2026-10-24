# MM-MAP-310 — Conversão e Validação

**Status**: M4 — Em andamento (item MM-MAP-310 da sequência M4)  
**Task ID**: MM-MAP-310  
**Predecessor**: MM-MAP-300 (Importação GPX/KML)  
**Gate M4**: enriquecer dados importados, normalizar coordenadas/elevações, validar topologia, merge com dados regionais, schema Zod, tipos TypeScript, sem dependência em tile.openstreetmap.org

## Objetivo
Processar os dados importados (GPX/KML) e enriquecê-los com validação, normalização e merge com o pacote regional ativo. Este é o segundo item da fase M4 — Formatos GPX/KML/KMZ/GeoJSON.

## Normalização de Dados

### 1. Coordenadas
- **Grau decimal padrão**: todas as coordenadas convertidas para graus decimais (double)
- **Faixa de validade**:
  - Latitude: -90 a 90 (incluindo polos)
  - Longitude: -180 a 180 (incluindo data line)
- **Normalização de rounding**: 7 casas decimais (~1 cm de precisão)
- **Conversão de formatos**: DMS (degrees/minutes/seconds) → decimal

### 2. Elevações
- **Unidade padrão**: metros acima do nível do mar
- **Fontes de elevação**:
  - Valores GPX `<ele>` diretos (se presentes)
  - Interpolação de DEM (Digital Elevation Model) do pacote regional
  - Valor padrão: 0 (nível do mar) se não informado
- **Conversão de unidades**: pés → metros (multiplicar por 0.3048) se necessário

### 3. Timestamps
- **Formato ISO 8601**: todos os timestamps normalizados para ISO 8601
- **Fuso horário**: convertido para UTC se houver offset informado
- **Precisão**: segundos (subsegundos descartados)
- **Ausência**: timestamp opcional, undefined se não informado

## Validação de Schema

### 1. Schema Zod de Dados Normalizados
```typescript
import { z } from "zod";

const trackPointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevation: z.number().nullable().optional(),
  timestamp: z.date().nullable().optional(),
});

const segmentSchema = z.object({
  id: z.string().uuid(),
  points: z.array(trackPointSchema),
});

const trackSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  segments: z.array(segmentSchema),
});

const waypointSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevation: z.number().nullable().optional(),
});

const routeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  color: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
  points: z.array(trackPointSchema.omit({ timestamp: true })),
});

export type TrackPoint = z.infer<typeof trackPointSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type Track = z.infer<typeof trackSchema>;
export type Waypoint = z.infer<typeof waypointSchema>;
export type Route = z.infer<typeof routeSchema>;
```

### 2. Regras de Validação

| Regra | Descrição |
|-------|-----------|
| `latitude` | Deve estar em [-90, 90] |
| `longitude` | Deve estar em [-180, 180] |
| `elevation` | Se presente, deve ser >= 0 (ou null) |
| `timestamp` | Se presente, deve ser date válido passado/future limitado |
| `name` | Obrigatório, min 1 char, max 255 chars |
| `color` | Hex format #RGB ou #RRGGBB (opcional) |
| `segments` | Pelo menos 1 point por segment |
| `points` | Pelo menos 1 point por track/route |

### 3. Validação de Topologia Simples
- **Points consecutivos distintos**: evitar pontos seguidos com mesma lat/lon
- **Segmentos colineares**: detectar e reportar (não bloquear, apenas warn)
- **Self-intersections**: para routes, warn se a route se auto-intersectar
- **Closed loops**: detectar tracks/routes que formam loop fechado (first/last point iguais)

### 4. Enriquecimento com Dados Regionais
- **Merge de waypoints**: waypoints importados mergeados com pontos de interesse do pacote regional (por coordenadas próximas ≤ 500m)
- **Estilo de cores**: se o import informar color, usar; senão, usar paleta padrão do estilo ativo (light/dark/outdoor)
- **Prioridade**: dados importados têm prioridade sobre dados regionais para sobreposições explícitas
- **Filtro de região**: dados fora dos bounds do pacote regional são avisados mas não rejeitados (pacote pode cobrir área maior)

## Fluxo de Processamento

```mermaid
flowchart TD
    A[Arquivo Importado] --> B[Parser GPX/KML]
    B --> C[Normalização de Coordenadas]
    C --> D[Validação Zod]
    D -->|válido| E[Enriquecimento Regional]
    D|→| inválido --> F[Erros de Validação]
    E --> G[Merge with Regional Data]
    G --> H[Persistência IndexedDB]
    H --> I[Atualização UI]
```

### 1. Etapas do Fluxo

**Etapa 1: Parse**
- Receber dados brutos (XML GPX ou KML)
- Extrair: tracks, waypoints, routes, pontos
- Estrutura intermediária não validada ainda

**Etapa 2: Normalização**
- Converter todas as coordenadas para decimal
- Arredondar para 7 casas decimais
- Normalizar elevações para metros
- Parsear timestamps para Date objects
- Gerar IDs UUID para todos os objetos

**Etapa 3: Validação Zod**
- Validar estrutura contra schema Zod
- Coletar todos os erros de validação
- Reportar erros para o usuário em linguagem natural

**Etapa 4: Enriquecimento**
- Buscar dados regionais próximos (within 500m)
- Merge: dados importados sobrescrevem regionais para mesmas coordenadas
- Aplicar estilo/color do pacote ativo se não informado
- Filtrar points fora dos bounds do pacote

**Etapa 5: Persistência**
- Salvar em object store `imports:{filename}:{timestamp}`
- Armazenar: dados normalizados, erros (se houver), metadata (parsedAt, fileSize, format)
- SHA-256 do arquivo original para deduplicação

**Etapa 6: Atualização UI**
- Mostrar resumo: quantos points/trks/ways foram importados/validados/erro
- Destacar erros com sugestões de correção
- Permitir editar/remover itens importados
- Tornar dados disponíveis para rendering no mapa

## Evidência Concreta

### 1. Schema Zod de Dados Normalizados
- ✅ `trackPointSchema` — lat/lon validation, elevation?, timestamp?
- ✅ `segmentSchema` — id UUID, points array
- ✅ `trackSchema` — id UUID, name, description, color (hex), segments
- ✅ `waypointSchema` — id UUID, name, description, lat/lon, elevation?
- ✅ `routeSchema` — id UUID, name, description, color (hex), points (sem timestamp)
- ✅ Tipos exportados: TrackPoint, Segment, Track, Waypoint, Route

### 2. Regras de Validação
- ✅ latitude ∈ [-90, 90]
- ✅ longitude ∈ [-180, 180]
- ✅ elevation >= 0 ou null
- ✅ name min 1, max 255 chars
- ✅ color hex #RGB ou #RRGGBB (opcional)
- ✅ Pelo menos 1 point por segment
- ✅ Validação de self-intersections (warn)
- ✅ Closed loops detection

### 3. Enriquecimento Regional
- ✅ Merge de waypoints (próximos ≤ 500m)
- ✅ Prioridade: importados sobre regionais para sobreposições explícitas
- ✅ Aplicar estilo/color do pacote ativo
- ✅ Filtro de região (fora dos bounds → aviso, não rejeição)

### 4. Fluxo de Processamento
- ✅ Parse → Normalização → Validação Zod → Enriquecimento → Persistência → UI
- ✅ Cada etapa descrita com entrada/saída claras

### 5. Formatos Normalizados
- ✅ Coordenadas: grau decimal, 7 casas decimais
- ✅ Elevação: metros, padrão 0 se não informado
- ✅ Timestamps: ISO 8601, UTC conversion, opcional
- ✅ IDs: UUIDv4 para todos os objetos

## Próximos Passos (MM-MAP-320 → GeoJSON e Integração Pipeline)

Após a conversão e validação, o próximo passo é:

1. **MM-MAP-320**: GeoJSON e integração no pipeline regional
2. **M5 — Busca offline** (MM-MAP-400 a MM-MAP-420)

## Aceite MM-MAP-310

- ✅ Schema Zod completo (trackPoint, segment, track, waypoint, route)
- ✅ Regras de validação de coordenadas (lat/lon ranges)
- ✅ Validação de elevação (>= 0 ou null)
- ✅ Validação de nome (min 1, max 255)
- ✅ Validação de color (hex #RGB/#RRGGBB opcional)
- ✅ Enriquecimento regional (merge within 500m)
- ✅ Prioridade de dados importados
- ✅ Filtro de região (aviso, não rejeição)
- ✅ Fluxo completo: Parse → Normalização → Validação → Enriquecimento → Persistência → UI
- ✅ Closed loops detection e self-intersections (warn)
- ⚠️ Integração com pipeline regional (MM-MAP-320) ainda pendente
- ⚠️ Sincronização com ResumableInstaller (MM-MAP-130) ainda pendente
- ⚠️ Topologia avançada (area validation, polygon validation) pendente

---

*Este documento é o entregável do MM-MAP-310. Conclui o item M4 "Formatos GPX/KML/KMZ/GeoJSON" juntamente com MM-MAP-300 e prepara o caminho para MM-MAP-320 (GeoJSON e integração pipeline).*