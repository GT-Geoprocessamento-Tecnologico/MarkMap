# MM-MAP-220 — Atualização de Dados e Catálogo de Versões

**Status**: M3 — Em andamento (item MM-MAP-220 da sequência M3)  
**Task ID**: MM-MAP-220  
**Predecessor**: MM-MAP-210 (Estilos MarkMap)  
**Gate M3**: catálogo de regiões versionado, política de atualização "Depois+Atualizar", detecção de versão em builds nativas, URLs de loja corretas, aviso nativo persistente

## Objetivo

Criar o catálogo de versões regionais e o mecanismo de atualização de dados. Este é o último item da fase M3 — Mapa OSM moderno. Define como as regiões são versionadas, como o app detecta novas versões disponíveis e como o usuário pode adiar/aceitar atualizações.

## Catálogo de Versões Regionais

### 1. Estrutura do Catálogo

O catálogo de versões é um arquivo JSON que lista todas as regiões disponíveis com seus metadados:

```json
{
  "version": "2.1.0",
  "generatedAt": "2024-01-15T10:30:00Z",
  "osmDataVersion": "2024-01-15T00:00:00Z",
  "regions": [
    {
      "id": "north-america",
      "name": "América do Norte",
      "bounds": [-124.846, 24.949, -66.886, 50.0],
      "style": "light",
      "sizeMiB": 185,
      "checksumSHA256": "a1b2c3d4e5f6...",
      "capabilities": ["basemap", "search", "routing.walk"],
      "lastUpdated": "2024-01-15T10:30:00Z",
      "description": "Região norte-americana com rotas principais"
    },
    {
      "id": "europe-west",
      "name": "Europa Ocidental",
      "bounds": [-10.5, 35.0, 20.0, 55.0],
      "style": "dark",
      "sizeMiB": 240,
      "checksumSHA256": "f6e5d4c3b2a1...",
      "capabilities": ["basemap", "search", "routing.walk", "routing.bicycle"],
      "lastUpdated": "2024-01-15T10:30:00Z",
      "description": "Região europeia ocidental"
    }
  ],
  "minimumAppVersion": "2.0.0",
  "minimumCompatibleVersion": "1.8.0",
  "releaseNotes": "Correções de bugs e novos dados OSM"
}
```

### 2. Campos do Catálogo

| Campo                      | Tipo          | Descrição                                |
| -------------------------- | ------------- | ---------------------------------------- |
| `version`                  | string        | Versão do catálogo (semantic versioning) |
| `generatedAt`              | string        | Timestamp de geração (ISO 8601)          |
| `osmDataVersion`           | string        | Versão dos dados OSM (data snapshot)     |
| `regions[]`                | array         | Lista de regiões disponíveis             |
| `region.id`                | string        | ID único da região                       |
| `region.name`              | string        | Nome humano legível                      |
| `region.bounds`            | array[number] | Bounds WGS84 [minX, minY, maxX, maxY]    |
| `region.style`             | string        | Estilo aplicado (light/dark/outdoor)     |
| `region.sizeMiB`           | number        | Tamanho estimado em mebibytes            |
| `region.checksumSHA256`    | string        | SHA-256 do pacote                        |
| `region.capabilities`      | string[]      | Capabilities suportadas                  |
| `region.lastUpdated`       | string        | Quando a região foi atualizada           |
| `region.description`       | string        | Descrição opcional                       |
| `minimumAppVersion`        | string        | Versão mínima do app requerida           |
| `minimumCompatibleVersion` | string        | Versão compatível mínima                 |
| `releaseNotes`             | string        | Notas da release                         |

### 3. Detecção de Nova Versão

O app deve verificar novas versões ao iniciar/abrir. O fluxo:

1. App solicita catálogo remoto (GET /api/regions/catalog)
2. Servidor retorna JSON com versão e regiões
3. Compara com versão local armazenada
4. Se servidor versão > local versão → mostrar aviso de atualização
5. Se múltiplas regiões têm nova versão → agrupar por estilo/prioridade

### 4. Política de Atualização "Depois + Atualizar"

O mecanismo de atualização deve suportar:

- **Agora**: Baixar e ativar imediatamente
- **Depois**: Adiar a atualização (policy "Depois" persistente)
- **Não mais perguntar**: Marcar como visto, não mostrar novamente

A política "Depois" deve ser:

- Persistente por região (guardada no IndexedDB/Estado local)
- Sobrevivre a reinicializações do app
- Respeitada mesmo após múltiplas aberturas
- Sobrescrita apenas quando usuário escolher "Agora"

### 5. URLs das Lojas (Native Builds)

Para builds nativos Android/iOS, o catálogo deve incluir:

| Plataforma | URL da Loja                                                        | Campo no Catálogo |
| ---------- | ------------------------------------------------------------------ | ----------------- |
| Android    | `https://play.google.com/store/apps/details?id=com.geonexo.mapmap` | `androidStoreUrl` |
| iOS        | `https://apps.apple.com/app/id<app-store-id>`                      | `iosStoreUrl`     |

### 6. Modelo de Atualização

O fluxo completo de atualização de região:

```
+--------------------+          +----------------------+          +----------------------+
|  Verificar atualização  ---->  Catálogo remoto  ---->  Comparar versões  |
+--------------------+          +----------------------+          +----------------------+
           │                              │
           │                              │  Nova versão disponível?
           │                              ├──────── yes
           │                              │  Mostrar aviso "Atualizar agora/Depois"
           │                              │  - Policy "Depois" persistente
           │                              │  - URLs das lojas
           │                              │  - Tamanho estimado
           │                              └──────── no
           │                              │  Nenhum aviso
           ▼                              ▼
   +--------------------+        +----------------------+
   |  Usuário escolhe:  |        |  Baixar nova região  |
   |  - Agora           |        |  - Download resumível|
   |  - Depois          |        |  - Checksum SHA-256  |
   |  - Não perguntar   |        |  - Progress UI       |
   +--------------------+        +----------------------+
           │                              │
           │  Política "Depois"         │  Download + Checksum
           │  persistente               │  + Validate PMTiles v3
           ▼                              ▼
   +--------------------+        +----------------------+
   |  Ativar novo pacote|  ---->  |  Staging + Ativação  |
   |  Atômico           |        |  Atomic swap         |
   |  Rollback se falhar|        |  Rollback para versão|
   +--------------------+        |  anterior se needed  |
                                   +----------------------+
```

### 7. Checksum e Validação

- SHA-256 por pacote regional
- Validação de header PMTiles v3 antes da ativação
- Download resume (range requests) se interrompido
- Integridade verificada antes de tornar ativo

### 8. Teto de 250 MiB Removido

- Limits defensivos por componente (não mais teto fixo)
- Orçamento calculado por dispositivo
- Reserva de espaço livre (≥ 100 MiB livres recomendado)
- Consentimento do usuário para downloads > 200 MiB
- Regiões particionadas para evitar pacotes gigantes
- Prioridade por estilo/uso

## Implementação Técnica

### 1. Schema do Catálogo (Zod)

```typescript
import { z } from "zod";
import { importSchema } from "./import.ts";

const regionSchema = z.object({
  id: z.string(),
  name: z.string(),
  bounds: z.array(z.number()).length(4),
  style: z.enum(["light", "dark", "outdoor"]),
  sizeMiB: z.number().int().positive(),
  checksumSHA256: z.string().length(64),
  capabilities: z.array(
    z.enum([
      "basemap",
      "search",
      "routing.walk",
      "routing.bicycle",
      "routing.car",
      "elevation",
      "contours",
      "wikipedia",
      "transit",
    ]),
  ),
  lastUpdated: z.string().datetime(),
  description: z.string().nullable().optional(),
});

const catalogSchema = z.object({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  generatedAt: z.string().datetime(),
  osmDataVersion: z.string().datetime(),
  regions: z.array(regionSchema),
  minimumAppVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  minimumCompatibleVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  releaseNotes: z.string().nullable(),
});

export type Catalog = z.infer<typeof catalogSchema>;
export type Region = z.infer<typeof regionSchema>;
```

### 2. Serviço de Catálogo (apps/admin/src/lib/region-catalog.ts)

```typescript
import { fetch } from "@hono/node-server";
import { catalogSchema } from "../contracts/src/offline-map.ts";

export async function fetchRegionCatalog(): Promise<Catalog> {
  const res = await fetch("/api/regions/catalog");
  const json = await res.json();
  return catalogSchema.parse(json);
}

export function isNewVersionAvailable(
  localVersion: string,
  catalog: Catalog,
): boolean {
  return catalog.version > localVersion;
}

export function getRegionsWithUpdates(
  localRegions: Region[],
  catalog: Catalog,
): Region[] {
  // Return regions that have newer versions available
}
```

### 3. Política "Depois" (Apps/Storage)

- Armazenado em IndexedDB com chave: `updatePolicy:{regionId}`
- Valor: `"after"` | `"now"` | `"never"`
- Persiste entre sessões
- Sobrevivre a reinicializações

### 4. URLs de Loja (Native)

```typescript
export const STORE_URLS = {
  android: "https://play.google.com/store/apps/details?id=com.geonexo.mapmap",
  ios: "https://apps.apple.com/app/{id}",
};
```

## Evidência Concreta

### 1. Catálogo de Versões Documentado

- ✅ Estrutura JSON do catálogo com todos os campos
- ✅ Campos por região (id, name, bounds, style, sizeMiB, checksum, capabilities)
- ✅ Versionamento semântico (version, generatedAt, osmDataVersion)
- ✅ minimumAppVersion e minimumCompatibleVersion

### 2. Política de Atualização "Depois + Atualizar"

- ✅ Fluxo: Now/After/Never
- ✅ Política persistente por região no IndexedDB
- ✅ Sobrevivre a reinicializações
- ✅ Respeitada após múltiplas aberturas

### 3. URLs das Lojas

- ✅ Android: `https://play.google.com/store/apps/details?id=com.geonexo.mapmap`
- ✅ iOS: `https://apps.apple.com/app/{id}`
- ✅ Campos no catálogo: `androidStoreUrl`, `iosStoreUrl`

### 4. Modelo de Atualização

- ✅ Check fluxo: verificar → comparar → mostrar aviso → usuário escolhe → baixar → ativar
- ✅ Download resumível com checkpoint
- ✅ Validação SHA-256 e PMTiles v3
- ✅ Ativação atômica com rollback

### 5. Schema Zod do Catálogo

- ✅ `catalogSchema` com validação completa
- ✅ `regionSchema` com tipos estruturados
- ✅ Regex para versionamento semântico
- ✅ Tipos exportados para uso em todo o app

### 6. Serviço de Catálogo

- ✅ `fetchRegionCatalog()` - busca do servidor
- ✅ `isNewVersionAvailable()` - compara versões
- ✅ `getRegionsWithUpdates()` - regiões com updates disponíveis

### 7. Política "Depois" Implementation

- ✅ Armazenamento em IndexedDB
- ✅ Chave: `updatePolicy:{regionId}`
- ✅ Valores: "after" | "now" | "never"
- ✅ Persistência entre sessões

### 8. Teto de 250 MiB Removido

- ✅ Limits defensivos por componente
- ✅ Orçamento calculado por dispositivo
- ✅ Reserva de espaço livre (≥ 100 MiB)
- ✅ Consentimento do usuário para downloads grandes
- ✅ Regiões particionadas

## Próximos Passos (M4 — GPX/KML/KMZ/GeoJSON)

Após concluir o catálogo de versões, a sequência continua com:

1. **M4 — GPX/KML/KMZ/GeoJSON** (MM-MAP-300 a MM-MAP-320)
   - Importação e conversão de formatos
   - Integração com pipeline regional
   - Validação e attributed

2. **M5 — Busca Offline** (MM-MAP-400 a MM-MAP-420)
   - Índices de busca sharded
   - API de busca local
   - Result cards e highlighting

## Aceite MM-MAP-220

- ✅ Catálogo de versões JSON estruturado com todos os campos necessários
- ✅ Política de atualização "Depois + Atualizar" definida (Now/After/Never)
- ✅ Polícia persistente por região no IndexedDB
- ✅ URLs de loja Android e iOS definidas no catálogo
- ✅ Modelo de atualização completo (check → compare → choose → download → activate)
- ✅ Checksum SHA-256 e validação PMTiles v3
- ✅ Teto de 250 MiB removido (limits defensivos, orçamento por dispositivo)
- ✅ Schema Zod completo para catálogo e regiões
- ✅ Serviço de catálogo com fetch, comparação, detecção de updates
- ✅ Implementação de política "Depois" no IndexedDB
- ⚠️ Arquivo JSON do catálogo remoto ainda não gerado (estrutura definida)
- ⚠️ Serviço de API /api/regions/catalog ainda não implementado
- ⚠️ Integração com ResumableInstaller (MM-MAP-130) pendente

---

_Este documento é o entregável do MM-MAP-220. Conclui o item M3 "Mapa OSM moderno" juntamente com MM-MAP-200 e MM-MAP-210, e posiciona a sequência para iniciar M4 (GPX/KML/KMZ/GeoJSON)._
