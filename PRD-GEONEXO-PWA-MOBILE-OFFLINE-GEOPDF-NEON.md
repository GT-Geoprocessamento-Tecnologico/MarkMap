# PRD — GeoNexo Mobile-First PWA + Offline + GeoPDF + Sincronização Neon

**Status:** EVOLUIR O QUE JÁ EXISTE  
**Prioridade:** P0 — usabilidade móvel, instalação PWA, offline real e GeoPDF  
**Aplicação atual:** `apps/admin` — React + Vite + TypeScript  
**Banco:** Neon PostgreSQL + PostGIS  
**Princípio:** preservar código funcional, reutilizar código permissivo e evitar reescrita desnecessária.

---

# 0. Meta do agente

Transformar o GeoNexo atual em uma aplicação web instalável e confiável em celular/tablet, com comportamento de app:

```text
abre rápido
↓
instala no dispositivo
↓
funciona online
↓
funciona offline
↓
usuário pode importar o próprio GeoPDF
↓
GPS aparece corretamente sobre o mapa
↓
ponto/linha/polígono continuam funcionando
↓
alterações são salvas localmente primeiro
↓
internet voltou
↓
sincroniza com API → Neon/PostGIS
↓
nova versão do GeoNexo chegou
↓
usuário recebe atualização sem perder trabalho
```

A experiência deve ser compreensível para uma pessoa sem conhecimento de GIS.

---

# 1. REGRA ABSOLUTA: AUDITAR ANTES DE ALTERAR

Antes de escrever código:

1. ler os PRDs existentes em `INTRUÇÕES/`;
2. ler `AGENTS.md`;
3. inspecionar o código atual;
4. executar a aplicação;
5. executar testes existentes;
6. identificar o que já funciona;
7. identificar somente as lacunas;
8. somente então alterar.

Classifique cada item:

```text
FUNCIONA — não mexer
FUNCIONA PARCIALMENTE — corrigir somente a lacuna
NÃO EXISTE — implementar
QUEBRADO — corrigir e adicionar teste
```

## Proibido

- refazer uma feature funcional apenas por preferência;
- trocar biblioteca que já resolve o problema sem motivo objetivo;
- criar uma segunda arquitetura offline;
- criar uma segunda camada GIS;
- criar tipos duplicados;
- duplicar API;
- mover arquivos em massa;
- refatorar o monorepo sem necessidade;
- alterar visual desktop que já funciona sem necessidade móvel;
- adicionar login nesta tarefa;
- fazer deploy na Vercel nesta tarefa.

---

# 2. SKILL OBRIGATÓRIA: `$pwa-executor`

Antes de implementar a fase PWA, execute a skill:

```text
$pwa-executor
```

Use a skill para revisar:

- instalação;
- manifest;
- service worker;
- cache;
- modo standalone;
- ícones;
- offline;
- atualização;
- comportamento Android/iOS;
- splash/theme;
- teste em dispositivo físico.

## Adaptação importante

O projeto é **Vite**, não Next.js.

Portanto:

- não converter o projeto para Next.js;
- não instalar `next-pwa`;
- usar os princípios da skill com **Vite + vite-plugin-pwa + Workbox**;
- preservar React/Vite atual.

---

# 3. AUDITORIA JÁ IDENTIFICADA NO REPOSITÓRIO

O agente deve confirmar no código local antes de agir.

## Stack atual encontrada

```text
React 18
Vite 5
TypeScript
TanStack Query
TanStack Router
MapLibre GL
Terra Draw
Hono
Drizzle
Neon Serverless
PostgreSQL/PostGIS
```

## PWA atual encontrada

Já existem:

```text
apps/admin/public/manifest.json
apps/admin/public/sw.js
apps/admin/public/icons/
apps/admin/index.html
```

O manifest já possui:

```text
name
short_name
start_url
scope
display=standalone
theme_color
background_color
192x192
512x512
maskable icons
```

O HTML já referencia o manifest e possui metatags Apple.

## Problemas arquiteturais atuais a revisar/corrigir

### P0 — service worker manual

O `sw.js` atual implementa um cache genérico para praticamente qualquer GET e, quando a rede falha, pode devolver `/` ou `/index.html` para requisições que não são navegação.

Isso pode gerar:

```text
API esperava JSON → recebe HTML
imagem esperava imagem → recebe HTML
asset esperava JS/CSS → recebe HTML
```

Substituir por estratégias explícitas.

### P0 — registro manual frágil

O registro atual depende de lógica manual no `index.tsx`.

Migrar para fluxo controlado por `vite-plugin-pwa`, sem manter dois mecanismos concorrentes.

### P0 — ausência de armazenamento offline de domínio

Na auditoria remota não foi encontrado um mecanismo explícito de:

```text
IndexedDB
outbox
fila de mutações
sync state
```

Confirmar localmente.

Sem isso, “offline” hoje é essencialmente cache de arquivos, não trabalho de campo offline real.

### P1 — atualização automática insegura

O SW atual usa ativação imediata.

Uma nova versão não deve recarregar o app enquanto o usuário:

```text
desenha
edita
importa arquivo
tem mutações pendentes
```

A atualização deve ser preparada e aplicada em momento seguro.

### P1 — fontes externas

O HTML atual carrega Google Fonts.

Para experiência offline consistente:

- preferir fontes locais já disponíveis;
- ou self-host;
- ou garantir fallback visual correto.

A aplicação não pode depender da internet para parecer utilizável.

### P1 — ícones maskable

Os arquivos `icon-maskable-*` atualmente parecem corresponder aos mesmos assets dos ícones normais.

O agente deve verificar visualmente a safe zone maskable e gerar assets adequados se necessário.

---

# 4. REPOSITÓRIOS MODELO — REUTILIZAR O MÁXIMO

Todos devem ser procurados primeiro em:

```text
REPOSITORIOS MODELOS/
```

## Regra de reutilização

Ordem:

```text
1. código existente do GeoNexo
2. package já instalado
3. package oficial do repositório modelo
4. copiar/adaptar função/componente permissivo
5. escrever código novo somente quando necessário
```

Não copiar um projeto inteiro para dentro do GeoNexo.

Copiar somente:

- algoritmo;
- parser;
- componente isolado;
- hook;
- worker;
- teste;
- fixture;
- padrão de UX;
- estratégia de cache.

## Repositórios prioritários

### TacMap — MIT

Usar fortemente como referência/código portável para:

```text
GeoPDF
LGIDict
/VP /Measure /GPTS
calibração de PDF sem georreferenciamento
transformação affine
GPS sobre PDF
medição
camadas
test vectors
```

Como o código é Swift/Kotlin, portar o algoritmo para TypeScript quando não houver equivalente atual.

Manter atribuição.

### Mozilla PDF.js — Apache-2.0

Usar como dependência oficial para:

```text
parse/render PDF
worker
page viewport
rasterização
```

Não escrever renderer PDF próprio.

### pdf-lib — MIT

Usar quando facilitar:

```text
inspeção de objetos PDF
metadados
dicionários
estruturas internas
```

Não duplicar funções que PDF.js já fornece adequadamente.

### GeoLibre — MIT

Copiar/adaptar padrões que ajudem diretamente:

```text
layout responsivo
mobile map UX
painéis sobre mapa
bottom sheets
toolbar
arquivos locais
Web Workers
MapLibre
datasets grandes
```

Não incorporar o projeto inteiro.

### deck.gl — MIT

Usar somente para volume que justifique GPU especializada.

Não trocar MapLibre por deck.gl.

Deck.gl entra como camada complementar.

### Supercluster — ISC

Usar para muitos pontos.

Não renderizar milhares de markers DOM individuais.

### FlatGeobuf — BSD-2-Clause

Usar para vetores grandes, streaming e leitura espacial parcial quando GeoJSON deixar de ser eficiente.

### React Virtuoso — MIT

Usar em listas realmente grandes:

```text
features
camadas
imports
arquivos
resultados
```

### use-gesture — MIT

Usar para gestos de UI que MapLibre não resolve:

```text
bottom sheet
painel arrastável
swipe
drag
pinch de componentes auxiliares
```

Não interferir nos gestos nativos do MapLibre.

### kerilla-map

**Somente referência**, a menos que uma licença permissiva seja encontrada no checkout local.

Aproveitar ideias de:

```text
tile pyramid
GPS
mapa grande
raster viewport
```

Não copiar código sem licença válida.

---

# 5. REPOSITÓRIOS NOVOS RECOMENDADOS

Se ainda não estiverem em `REPOSITORIOS MODELOS/`, baixar:

```text
https://github.com/vite-pwa/vite-plugin-pwa
https://github.com/GoogleChrome/workbox
https://github.com/dexie/Dexie.js
https://github.com/dirtybirdnj/gellyscape
```

Uso:

```text
vite-plugin-pwa → instalação, manifest, build, SW lifecycle
Workbox         → estratégias de cache
Dexie.js        → IndexedDB e migrations locais
GellyScape      → GeoPDF JS: VP, Measure, GPTS/LPTS, LGIDict, raster/vector
```

Licenças observadas:

```text
vite-plugin-pwa  MIT
Workbox          MIT
Dexie.js         Apache-2.0
GellyScape       ISC
```

Antes de copiar código, confirmar o `LICENSE` do checkout local e atualizar:

```text
THIRD_PARTY_NOTICES.md
```

---

# 6. PWA — INSTALAÇÃO DEVE FUNCIONAR DE VERDADE

## Implementação

Usar:

```text
vite-plugin-pwa
+
Workbox
```

Preferência:

```text
VitePWA
strategies: injectManifest
registerType: prompt
```

Motivo: o GeoNexo precisa de controle fino sobre:

- tiles;
- API;
- arquivos locais;
- atualização;
- offline;
- navegação SPA.

## Não manter dois service workers

Depois da migração:

```text
um único SW
uma única fonte de configuração
um único mecanismo de atualização
```

Remover o `sw.js` manual antigo somente depois que o substituto estiver validado.

---

# 7. MANIFEST — REVISÃO OBRIGATÓRIA

Preservar o que já está correto e completar.

O manifest final deve possuir no mínimo:

```json
{
  "id": "/",
  "name": "GeoNexo",
  "short_name": "GeoNexo",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "theme_color": "...",
  "background_color": "...",
  "lang": "pt-BR"
}
```

Além de:

```text
192x192
512x512
maskable 192x192
maskable 512x512
```

## Verificar

- arquivo existe;
- HTTP 200;
- MIME correto;
- ícones realmente têm dimensões declaradas;
- maskable possui safe area;
- `start_url` funciona diretamente;
- rotas SPA funcionam ao abrir pelo ícone instalado;
- atalhos só apontam para rotas reais.

---

# 8. TESTE LOCAL EM CELULAR — HTTPS É PARTE DO REQUISITO

Instalação PWA precisa de origem válida.

## Android — desenvolvimento

Preferência prática:

```bash
adb reverse tcp:5173 tcp:5173
```

Abrir no celular:

```text
http://localhost:5173
```

Assim o celular usa `localhost`.

## iPhone/iPad

Usar uma origem HTTPS válida para teste:

- túnel HTTPS temporário;
- ou certificado local confiável instalado no aparelho.

Não aceitar “funciona no desktop” como validação.

---

# 9. UX DE INSTALAÇÃO PARA PESSOA LEIGA

Não esperar que o usuário descubra o menu do navegador.

## Android/Chromium

Quando `beforeinstallprompt` estiver disponível, mostrar:

```text
┌────────────────────────────┐
│ Instalar GeoNexo           │
│ Use como um aplicativo.    │
│ Funciona também offline.   │
│                            │
│ [Agora não] [Instalar]     │
└────────────────────────────┘
```

Não mostrar repetidamente depois que o usuário negar.

## iOS

Não existe o mesmo prompt programático.

Mostrar tutorial simples:

```text
1. Toque em Compartilhar
2. Toque em “Adicionar à Tela de Início”
3. Confirme “Adicionar”
```

Detectar iOS e só mostrar essa instrução quando aplicável.

---

# 10. ATUALIZAÇÃO DO APLICATIVO

A aplicação deve aceitar atualizações sem reinstalação.

Usar o fluxo do `vite-plugin-pwa`:

```text
nova versão detectada
↓
download do novo SW
↓
mostrar aviso
↓
usuário confirma
↓
verificar se há trabalho não salvo
↓
ativar
↓
recarregar
```

UI:

```text
Nova versão do GeoNexo disponível

[Depois] [Atualizar agora]
```

## Nunca atualizar no meio de

- desenho em andamento;
- edição dirty;
- importação;
- sincronização crítica;
- upload;
- mutação local ainda não gravada no IndexedDB.

Se houver risco:

```text
“Atualização pronta. Termine ou salve o trabalho para atualizar.”
```

---

# 11. CACHE — ESTRATÉGIA OBRIGATÓRIA

Não usar uma estratégia global para tudo.

## App shell / assets versionados

```text
precache
```

## Navegação SPA

```text
NetworkFirst curto
→ fallback para app shell
```

Somente para `request.mode === navigation`.

## JS/CSS/fontes locais

```text
CacheFirst / precache
```

## Basemap e tiles públicos

```text
CacheFirst
+ expiração
+ limite de entradas
```

Não cachear o planeta inteiro.

## APIs GET

Preferência:

```text
NetworkFirst
```

Mas o estado de domínio offline deve vir do IndexedDB, não depender do cache HTTP.

## APIs POST/PATCH/DELETE

```text
NetworkOnly no SW
```

A aplicação salva a intenção no **outbox local**.

## Nunca fazer

```text
falhou /api/features
→ responder index.html
```

---

# 12. OFFLINE REAL — DEXIE / INDEXEDDB

O GeoNexo deve ser **local-first**.

Adicionar um package ou módulo pequeno, por exemplo:

```text
packages/offline/
```

Não colocar IndexedDB espalhado nas páginas.

## Banco local

Usar Dexie.

Stores conceituais:

```text
projects
maps
layers
features
assets
outbox
syncState
settings
```

Adapte aos contratos existentes.

Não duplicar modelos: usar tipos de `packages/contracts`.

## Regra de ouro

Toda edição do usuário:

```text
UI
↓
IndexedDB
↓
UI confirma localmente
↓
outbox
↓
sincroniza depois
```

Não:

```text
UI
↓
espera Neon/API
↓
só então salva
```

---

# 13. OUTBOX DE SINCRONIZAÇÃO

Estrutura conceitual:

```ts
{
  id: UUID,
  entityType,
  entityId,
  operation,
  payload,
  baseVersion,
  createdAt,
  attempts,
  lastError
}
```

Cada operação deve ter um ID estável/idempotente.

Se a conexão cair e a mesma requisição for enviada duas vezes:

```text
servidor não pode duplicar a operação
```

## Eventos que iniciam sync

```text
app abriu online
evento "online"
app voltou ao foreground
usuário tocou “Sincronizar”
timer leve enquanto app está aberto
```

Não depender exclusivamente de Background Sync API.

---

# 14. CONFLITOS

`features.version` já existe no schema atual.

Preservar optimistic concurrency.

Fluxo:

```text
local baseVersion=4
servidor version=5
↓
409 VERSION_CONFLICT
```

Nunca sobrescrever automaticamente.

Para pessoa leiga:

```text
Este item foi alterado em outro dispositivo.

[Ver mudanças]
[Manter minha versão]
[Usar versão do servidor]
```

Se for seguro duplicar:

```text
[Salvar como cópia]
```

Nenhuma escolha pode apagar trabalho local silenciosamente.

---

# 15. ESTADO ONLINE / OFFLINE

Mostrar indicador discreto:

```text
Online
Offline — trabalho salvo neste aparelho
Sincronizando…
3 alterações pendentes
Erro ao sincronizar — tentar novamente
```

Evitar alertas técnicos.

Nunca mostrar:

```text
NetworkError
fetch failed
SQL error
ECONNRESET
```

---

# 16. GEOLOCATION / GPS

GPS deve continuar sendo simples:

```text
[◎ Minha localização]
```

Ao tocar:

1. pedir permissão;
2. localizar;
3. mostrar precisão;
4. centralizar somente se solicitado;
5. permitir modo seguir;
6. não roubar o mapa quando o usuário estiver explorando manualmente.

Estados:

```text
Localizando…
Precisão: 8 m
GPS indisponível
Permissão negada
```

GPS funciona independentemente do basemap online.

---

# 17. MOBILE-FIRST TOUCH

A interação principal será tela touch.

## Regras

- controles primários: mínimo aproximado de 44–48 px;
- não depender de hover;
- botões críticos acessíveis ao polegar;
- evitar menu com alvos pequenos;
- usar safe areas:
  - `env(safe-area-inset-top)`
  - `env(safe-area-inset-bottom)`
- mapa ocupa a maior área possível;
- ferramentas aparecem sobre o mapa, sem esmagá-lo;
- preferir bottom sheet em mobile;
- desktop mantém painel lateral quando houver espaço;
- toque longo não pode disparar enquanto usuário arrasta mapa;
- feedback visual instantâneo no toque;
- haptic somente futuramente via wrapper nativo, não bloquear esta tarefa.

## Viewport

Não bloquear o zoom de acessibilidade da página globalmente.

Evitar depender de:

```html
user-scalable=no
maximum-scale=1
```

Controle conflitos de gesto com `touch-action` apenas nas superfícies que precisam, especialmente mapa e componentes arrastáveis.

---

# 18. PERFORMANCE — NÃO TRAVAR O CELULAR

## Regra

Nunca renderizar dados grandes como milhares de componentes React.

### Pontos

```text
Supercluster
```

### Vetores grandes

```text
FlatGeobuf / MVT
```

### Camadas realmente pesadas

```text
deck.gl
```

### Listas grandes

```text
React Virtuoso
```

### Operações CPU pesadas

```text
Web Worker
```

### Mapa

```text
MapLibre/WebGL
```

## React

- evitar estado React por frame de pan/zoom;
- não copiar GeoJSON gigante para vários stores;
- memoizar somente onde medição comprovar necessidade;
- cancelar requests obsoletas;
- lazy-load módulos pesados:
  - PDF.js;
  - GeoPackage;
  - Shapefile;
  - deck.gl;
- não carregar parser de GeoPDF na tela inicial.

---

# 19. GEOREFERENCED PDF / “GeoPDF”

O usuário deve conseguir escolher um PDF próprio.

Fluxo simples:

```text
[Adicionar mapa]

Escolha um arquivo:
mapa.pdf

GeoNexo analisa automaticamente…

✓ Mapa georreferenciado encontrado
✓ Coordenadas reconhecidas
✓ Pronto para usar

[Abrir mapa]
```

Não mostrar `GPTS`, `LPTS`, `EPSG` para usuário comum.

Esses dados ficam em:

```text
Detalhes técnicos
```

---

# 20. FORMATOS GEOESPACIAIS PDF

Suportar em ordem:

## P0

```text
/VP
/Measure
/Subtype /GEO
/GPTS
/LPTS
/GCS
```

## P0

```text
LGIDict
```

## P1

```text
Optional Content Groups / layers do PDF
```

Quando existirem camadas, futuramente permitir ligar/desligar.

---

# 21. IMPLEMENTAÇÃO GEOREFERENCIADA

Usar código/algoritmos de:

```text
TacMap
GellyScape
PDF.js
pdf-lib
Proj4
```

## Não escrever parser PDF completo

Preferir:

```text
PDF.js/pdf-lib
+
parser geoespacial pequeno
```

## Saída do parser

Estrutura conceitual:

```ts
{
  page,
  crs,
  controlPoints,
  bounds,
  transform,
  format: 'vp-measure' | 'lgidict' | 'calibrated',
  residualMeters?,
  layers?
}
```

Adaptar ao contrato existente.

---

# 22. PDF SEM GEOREFERENCIAMENTO

Se o PDF for comum:

```text
Este PDF não possui localização no mapa.

Deseja posicioná-lo?

[Agora não] [Posicionar mapa]
```

Wizard para leigo:

```text
Ponto 1
→ toque no PDF
→ informe/localize o ponto real

Ponto 2
→ repita

Ponto 3
→ repita
```

Permitir:

```text
usar minha localização
digitar latitude/longitude
selecionar no mapa conhecido
```

Depois:

```text
Mapa posicionado ✓
Precisão estimada: ...
```

Usar o affine fitter do TacMap como base, portado para TypeScript.

Para 4+ pontos, calcular residual/RMS.

---

# 23. RENDER DO PDF — NUNCA UM CANVAS GIGANTE

O PDF deve se comportar como mapa.

Arquitetura:

```text
PDF original
↓
PDF.js Worker
↓
georreferenciamento
↓
renderização por viewport/tile
↓
cache local
↓
MapLibre source/layer
```

## Obrigatório

- não manter bitmap integral de um mapa enorme na memória;
- renderizar somente partes/níveis necessários;
- cachear tiles derivados;
- descartar canvases temporários;
- limitar concorrência;
- pausar trabalho invisível;
- mostrar progresso no primeiro processamento;
- permitir cancelar.

## Resultado

Pan/pinch/zoom devem continuar responsivos enquanto o mapa é usado.

---

# 24. ARQUIVO GEOREFERENCIADO OFFLINE

Depois que o usuário importar o PDF:

```text
ele deve continuar abrindo sem internet
```

Armazenamento:

```text
metadados     → IndexedDB
PDF local     → OPFS quando suportado, com fallback controlado
tiles/cache   → Cache Storage ou armazenamento local apropriado
```

Antes de copiar um arquivo grande:

```text
navigator.storage.estimate()
```

Quando disponível e apropriado:

```text
navigator.storage.persist()
```

Se faltar espaço:

```text
“Não há espaço suficiente para manter este mapa offline.”
```

Não deixar o navegador falhar silenciosamente.

---

# 25. DADOS GRANDES

Não armazenar PDF/GeoTIFF/PMTiles grande dentro de uma linha Postgres.

## Neon/Postgres

Guardar:

```text
metadados
hash
bounds
CRS
status
storage key
relações
```

## Arquivo

Guardar em object storage quando houver sincronização em nuvem.

O projeto já usa AWS S3 SDK na API. Reutilizar a abstração atual se ela estiver funcional.

Neon também possui Object Storage S3-compatible; usar somente se estiver habilitado no projeto e fizer sentido após inspeção.

Não criar dois sistemas de arquivos remotos concorrentes.

---

# 26. NEON — ESTADO ATUAL IDENTIFICADO NO CÓDIGO

No código do repositório existem schemas para:

```text
projects
maps
layers
features
map_sources
imports
audit_events
```

## `features`

Já possui:

```text
UUID
layer_id
geometry PostGIS
SRID 4674 / SIRGAS 2000
properties JSONB
version
created_at
updated_at
deleted_at
GiST geometry index
layer_id index
```

Isso é adequado para optimistic concurrency e consultas por bbox.

**Preservar.**

## `layers`

Já possui:

```text
project_id
kind
geometry_type
srid=4674
style
metadata
visible_by_default
sort_order
deleted_at
```

Preservar.

## `maps`

Já possui:

```text
project_id
name
description
default center
default zoom
timestamps
```

## `map_sources`

Já prevê:

```text
xyz
style
wms
wfs
pmtiles
geojson
```

Não adicionar provider novo se GeoPDF for convertido/adaptado para um source já existente.

## `imports`

Já registra:

```text
project
target layer
original name
format
status
row count
error
```

Reutilizar para importações vetoriais.

GeoPDF/raster grande não deve ser guardado em `imports` como blob.

## `audit_events`

Já existe e deve continuar registrando alterações críticas.

Não usar `audit_events` como fila offline do cliente.

---

# 27. NEON LIVE — BLOQUEIO IDENTIFICADO

A conexão Neon disponibilizada para esta revisão está **não escopada** e exige `project_id`.

Não foi possível inspecionar o banco remoto sem esse ID.

Portanto:

```text
[PENDENTE] validar schema real do Neon contra o schema Drizzle.
```

O agente NÃO deve assumir que o banco remoto é idêntico ao código.

---

# 28. CHECKLIST NEON OBRIGATÓRIO PARA O AGENTE

Antes de qualquer migration remota:

1. obter o `project_id` correto;
2. descrever o projeto;
3. resolver a branch default;
4. listar databases;
5. listar tabelas;
6. descrever:
   - projects
   - maps
   - layers
   - features
   - map_sources
   - imports
   - audit_events
7. verificar extensões:
   - postgis
   - pgcrypto se utilizada;
8. verificar índices;
9. comparar com `packages/db/src/schema`;
10. produzir relatório de drift.

Nenhum SQL destrutivo deve ser executado sem aprovação.

Para migrations:

```text
migration versionada no Git
↓
branch Neon temporária
↓
teste
↓
aprovação
↓
aplicação
```

---

# 29. EVOLUÇÃO DE BANCO PROPOSTA PARA OFFLINE/SYNC

Somente criar se ainda não existir equivalente.

## `assets`

Uma tabela genérica para arquivos:

```text
id UUID
project_id UUID
map_id UUID nullable
kind
original_name
mime_type
byte_size
sha256
storage_key nullable
bounds geometry(Polygon, 4674) nullable
georef jsonb
metadata jsonb
status
created_at
updated_at
deleted_at
```

`kind` pode representar:

```text
geopdf
pdf
geotiff
pmtiles
photo
attachment
other
```

Não duplicar tabela específica para cada arquivo.

## `mutation_receipts`

Idempotência de sync:

```text
client_mutation_id UUID UNIQUE
entity_type
entity_id
operation
result_version
processed_at
```

Se já existir mecanismo idempotente na API, reutilizar em vez dessa tabela.

## `sync_changes`

Cursor robusto para pull incremental:

```text
seq BIGSERIAL PRIMARY KEY
project_id
entity_type
entity_id
operation
server_version
changed_at
```

Pode ser alimentado pela camada de aplicação.

Não criar triggers complexos se a API já controla todas as escritas.

---

# 30. API DE SYNC

Preferência simples:

```text
POST /sync/push
GET  /sync/pull?cursor=...
```

## Push

Entrada:

```text
clientMutationId
entity
operation
baseVersion
payload
```

Resposta:

```text
ack
serverVersion
entity
```

## Pull

Resposta:

```text
changes[]
nextCursor
```

Não enviar toda a base a cada reconexão.

---

# 31. NEON SERVERLESS

O backend já usa:

```text
@neondatabase/serverless
Drizzle
```

Preservar arquitetura:

```text
PWA
↓
API Hono
↓
Neon
```

Não colocar `DATABASE_URL` no frontend.

Não conectar o browser diretamente ao banco nesta fase.

## Atenção

A versão instalada do driver deve ser auditada antes de qualquer upgrade.

Não atualizar dependência crítica “só porque existe versão nova”.

Se atualizar:

```text
tests
↓
branch Neon de teste
↓
benchmark
↓
merge
```

---

# 32. GEOREFERENCIAMENTO E SRID

Persistência vetorial do GeoNexo continua canônica em:

```text
EPSG:4674 — SIRGAS 2000
```

Um GeoPDF pode chegar em outro CRS.

Fluxo:

```text
GeoPDF CRS original
↓
parse
↓
Proj4
↓
WGS84/SIRGAS conforme necessidade
↓
renderização
```

Overlays persistidos:

```text
PostGIS SRID 4674
```

O raster/PDF não precisa ser reprojetado e salvo como geometria.

Guardar apenas:

```text
bounds
transform
CRS
metadata
storage reference
```

---

# 33. IMPORTAÇÃO LEGADA EXISTENTE

Preservar o PRD anterior:

```text
Avenza KML
Avenza KMZ
fotos KMZ
GPX
GeoJSON
Shapefile
GeoPackage
```

Não reimplementar se o agente anterior já entregou.

A nova feature GeoPDF deve entrar no mesmo conceito:

```text
Adicionar dados
├── Mapa PDF/GeoPDF
├── KML/KMZ
├── GPX
├── GeoJSON
├── Shapefile
└── GeoPackage
```

Para usuário leigo, esconder nomes técnicos em “Mais formatos” quando necessário.

---

# 34. UX — TELA “ADICIONAR MAPA”

Fluxo ideal:

```text
Adicionar mapa
│
├── Escolher arquivo do dispositivo
│
├── Usar mapa já salvo
│
└── Mais opções
```

Após escolher:

```text
mapa.pdf

Analisando mapa…
██████████

✓ Localização encontrada
✓ 1 página
✓ Pronto para usar

[Usar agora]
```

Erro:

```text
Não conseguimos localizar este PDF automaticamente.

Você pode posicioná-lo manualmente.

[Posicionar mapa]
```

Nunca:

```text
Missing /GPTS object
Affine transform singular
```

---

# 35. TELA MAPA MOBILE

Prioridade visual:

```text
┌──────────────────────────────┐
│            MAPA              │
│                              │
│                       [◎]    │
│                       [+]    │
│                       [-]    │
│                              │
│ [status offline/sync]        │
├──────────────────────────────┤
│ Localizar  Ponto  Medir  ⋯  │
└──────────────────────────────┘
```

Ferramentas avançadas:

```text
bottom sheet
```

Não exibir 20 botões pequenos ao mesmo tempo.

---

# 36. ESTADOS DE ERRO PARA LEIGOS

Traduzir erros técnicos.

Exemplos:

```text
Sem conexão
→ “Sem internet. Seu trabalho continua salvo neste aparelho.”

Banco indisponível
→ “Não foi possível sincronizar agora. Tentaremos novamente.”

PDF não georreferenciado
→ “Este PDF não possui localização. Você pode posicioná-lo.”

Storage cheio
→ “O dispositivo não tem espaço suficiente para salvar este mapa offline.”

GPS negado
→ “Ative a localização do navegador para mostrar sua posição.”
```

Guardar erro técnico apenas em log de desenvolvimento/telemetria apropriada.

---

# 37. PROTEÇÃO CONTRA PERDA DE DADOS

Antes de:

- atualizar PWA;
- fechar import;
- trocar projeto;
- limpar cache;
- remover mapa;
- descartar conflito;

verificar:

```text
dirty state
outbox
upload pendente
draw ativo
```

Nenhum botão pode apagar trabalho offline silenciosamente.

---

# 38. NÃO USAR `localStorage` PARA DADOS GIS

`localStorage` pode ser usado somente para preferências pequenas.

Dados de domínio:

```text
IndexedDB
```

Arquivos grandes:

```text
OPFS / storage apropriado
```

Nunca:

```text
GeoJSON grande em localStorage
PDF base64 em localStorage
```

---

# 39. WEB WORKERS

Mover para worker quando aplicável:

```text
PDF parse/render pesado
Shapefile
GeoPackage
FlatGeobuf decode pesado
simplificação/transformações grandes
```

Não mover tudo para worker.

Medir primeiro.

O objetivo é manter:

```text
pan
pinch
scroll
tap
```

responsivos.

---

# 40. TESTES PWA

Automatizar o máximo possível e validar manualmente em aparelho real.

## Instalação

- manifest 200;
- SW registrado;
- ícones 200;
- app instalável no Android suportado;
- modo standalone;
- deep link abre;
- atalho abre rota válida.

## Offline

1. abrir online;
2. importar mapa;
3. criar uma feature;
4. desligar Wi-Fi/dados;
5. fechar;
6. reabrir pelo ícone;
7. mapa abre;
8. feature existe;
9. editar;
10. criar nova feature;
11. recarregar;
12. tudo continua;
13. ligar internet;
14. sync ocorre;
15. Neon recebe sem duplicação.

---

# 41. TESTE DE ATUALIZAÇÃO

1. instalar build A;
2. criar trabalho offline;
3. publicar/servir build B;
4. reconectar;
5. app detecta update;
6. aviso aparece;
7. não recarrega sozinho se há edição;
8. usuário salva;
9. toca “Atualizar agora”;
10. build B abre;
11. IndexedDB permanece;
12. outbox permanece;
13. dados permanecem.

---

# 42. TESTES GEOREFERENCED PDF

Fixtures:

```text
QGIS /VP + Measure + GPTS/LPTS
LGIDict
PDF normal sem georef
PDF grande
PDF corrompido
PDF multi-page
```

Testar:

```text
import
detecção
bounds
CRS
pixel → geo
geo → pixel
GPS → posição visual
zoom
pinch
rotate
reload
offline
```

Usar golden vectors do TacMap quando aplicável.

---

# 43. TESTE COM PDF REAL DO PROJETO

Se o arquivo enviado pelo usuário estiver disponível localmente para o agente, usá-lo como teste manual.

Não commitá-lo no repositório sem autorização/licença clara.

Registrar somente resultados:

```text
formato detectado
CRS
bounds
erro residual
tempo de abertura
uso aproximado de memória
```

---

# 44. PERFORMANCE GATES

O agente deve medir em modo mobile.

## Rejeitar implementação que

- cria um canvas enorme permanente;
- congela pan/zoom;
- renderiza milhares de DOM markers;
- baixa dataset inteiro sem necessidade;
- duplica GeoJSON gigante na memória;
- recalcula geometria inteira em cada frame;
- bloqueia UI durante import sem progresso;
- deixa worker/processamento continuar depois do cancelamento.

## Aceite

Durante uso normal:

```text
pan/pinch continua responsivo
nenhum crescimento contínuo de memória
listas grandes continuam roláveis
ações touch respondem imediatamente
```

Long tasks devem ser investigadas e reduzidas, especialmente durante interação.

---

# 45. REDE LENTA / INSTÁVEL

Simular:

```text
offline
Slow 3G
perda de rede no meio de sync
timeout
HTTP 500
HTTP 409
upload interrompido
```

O app deve:

```text
não perder dado
não duplicar
não travar
não bloquear mapa
```

---

# 46. ACESSIBILIDADE

Mesmo sendo GIS:

- labels em botões;
- `aria-label` em controles de ícone;
- foco visível;
- dialogs acessíveis;
- contraste;
- texto mínimo legível;
- não depender somente de cor;
- respeitar reduced motion;
- permitir zoom da interface para acessibilidade.

---

# 47. SEGURANÇA

## Arquivos

PDF e formatos GIS são input não confiável.

Prever:

```text
limite de tamanho
timeout
cancelamento
parse em worker quando possível
sem eval
sem execução de JS do PDF
sem fetch arbitrário de links embutidos
```

## Service Worker

Não cachear:

- secrets;
- DATABASE_URL;
- responses privadas indiscriminadamente;
- erros;
- uploads;
- mutation responses sem necessidade.

## Banco

Browser não recebe credencial Postgres.

---

# 48. ARQUIVOS QUE O AGENTE DEVE EVITAR ALTERAR SEM NECESSIDADE

- schema já funcional;
- contratos públicos já consumidos;
- engine MapLibre funcional;
- desenho Terra Draw funcional;
- importadores já entregues;
- UI desktop funcional.

Quando precisar mudar contrato:

1. documentar;
2. fazer a menor mudança;
3. atualizar consumidores;
4. adicionar teste.

---

# 49. ESTRUTURA SUGERIDA

Apenas se equivalentes não existirem:

```text
apps/admin/src/
  pwa/
    register.ts
    update-controller.ts
    install-controller.ts

packages/
  offline/
    db.ts
    outbox.ts
    sync-engine.ts
    storage.ts

  geo/
    geopdf/
      parser.ts
      affine.ts
      calibration.ts
      types.ts
      worker.ts

  maps/
    geopdf-source.ts
```

Não criar essa estrutura se o projeto já tiver módulos equivalentes.

---

# 50. ORDEM DE EXECUÇÃO

## Fase 1 — Auditoria

```text
código atual
PWA atual
offline atual
GeoPDF atual
banco/schema atual
```

Produzir matriz antes de editar.

## Fase 2 — PWA instalável

Corrigir:

```text
manifest
SW
registro
HTTPS local
install UX
iOS instructions
```

Validar em dispositivo.

## Fase 3 — offline local-first

```text
Dexie
outbox
sync state
features offline
```

## Fase 4 — sync API/Neon

```text
idempotência
push
pull
version conflict
```

## Fase 5 — GeoPDF

```text
parser
render
tiles
GPS
persistência local
calibração manual
```

## Fase 6 — performance touch

```text
virtualização
cluster
worker
lazy load
bottom sheets
touch targets
```

## Fase 7 — atualização PWA

```text
nova versão
prompt
safe reload
preservação local
```

## Fase 8 — testes finais

Android + iOS quando disponível.

---

# 51. CRITÉRIO DE ACEITE FINAL

A tarefa está pronta somente quando:

- [x] agente executou `$pwa-executor`;
- [ ] funcionalidade existente foi preservada;
- [ ] PWA instala em Android suportado;
- [ ] instrução correta de instalação aparece no iOS;
- [ ] app abre standalone;
- [ ] app reabre offline;
- [ ] mapa importado continua disponível offline;
- [ ] ponto/linha/polígono podem ser criados offline;
- [ ] refresh não perde alterações;
- [ ] outbox persiste;
- [ ] reconexão sincroniza;
- [ ] retry não duplica mutações;
- [ ] conflito de versão não perde trabalho;
- [ ] GeoPDF `/VP/Measure/GPTS/LPTS` funciona;
- [ ] LGIDict funciona;
- [ ] PDF sem georef oferece calibração simples;
- [ ] PDF grande não vira canvas monolítico;
- [ ] pan/pinch permanece fluido;
- [ ] listas grandes são virtualizadas quando necessário;
- [ ] nova versão PWA é detectada;
- [ ] update não apaga IndexedDB;
- [ ] update não interrompe trabalho sujo;
- [x] `pnpm lint` passa (verificação forçada e uncached via Turbo; 7/7 tarefas, 24 avisos `any`);
- [x] `pnpm typecheck` passa (forçado e uncached; 7/7 tarefas);
- [x] `pnpm test` passa (forçado e uncached; 296 aprovados, com 16 integrações PostGIS skip nessa execução e aprovadas separadamente);
- [x] `pnpm build` passa (forçado e uncached; 7/7 tarefas; o aviso de chunk grande permanece);
- [ ] testes E2E críticos passam;
- [ ] `THIRD_PARTY_NOTICES.md` atualizado;
- [x] metadados reais do Neon foram comparados ao Drizzle; o branch de produção não contém as tabelas/extensions/indexes da aplicação;
- [x] nenhuma migration foi aplicada remotamente nem ação destrutiva foi feita no Neon sem aprovação.

**Resultado desta execução (2026-09-30): NÃO PRONTO — gates de runtime/local-first, PWA instalada/cold-offline, GeoPDF e round-trip Neon continuam pendentes.** O handoff detalhado da seção 52 está em [`docs/quality/prd-execution-handoff.md`](docs/quality/prd-execution-handoff.md).

---

# 52. HANDOFF OBRIGATÓRIO

Ao terminar, entregar:

## 1. Auditoria inicial

| Área | Estado antes | O que faltava | Ação |
|---|---|---|---|
| PWA | ... | ... | ... |
| Offline | ... | ... | ... |
| Sync | ... | ... | ... |
| GeoPDF | ... | ... | ... |
| Mobile touch | ... | ... | ... |
| Performance | ... | ... | ... |
| Neon | ... | ... | ... |

## 2. Reuso de código

Para cada reutilização:

```text
Repositório:
Arquivo/função:
Licença:
Código copiado/adaptado:
Destino:
Alterações feitas:
```

## 3. Código existente preservado

Listar explicitamente.

## 4. Mudanças

Listar somente arquivos realmente alterados.

## 5. Banco

```text
Neon project:
branch:
database:
drift encontrado:
migrations criadas:
migrations aplicadas:
```

Não expor connection string.

## 6. PWA

```text
Android install: PASS/FAIL
iOS Add to Home Screen: PASS/FAIL/NÃO TESTADO
Offline cold start: PASS/FAIL
Update flow: PASS/FAIL
```

## 7. GeoPDF

```text
VP/Measure: PASS/FAIL
LGIDict: PASS/FAIL
calibração manual: PASS/FAIL
offline reopen: PASS/FAIL
```

## 8. Testes

Comando + resultado.

## 9. Pendências reais

Sem TODO genérico.

## 10. Status

```text
PRONTO PARA INTEGRAÇÃO
```

ou:

```text
NÃO PRONTO — motivo objetivo
```

---

# 53. NÃO IMPLEMENTAR NESTA TAREFA

- login;
- permissões avançadas;
- billing;
- marketplace;
- site institucional;
- deploy final Vercel;
- app nativo Capacitor;
- push notifications;
- GNSS Bluetooth;
- chat/realtime;
- refactor geral.

Preparar a arquitetura para esses itens sem implementá-los.

---

# 54. DECISÕES DE PRODUTO

A experiência deve seguir:

```text
usuário não precisa saber o que é CRS
usuário não precisa saber o que é PostGIS
usuário não precisa saber o que é cache
usuário não precisa saber o que é IndexedDB
usuário não precisa saber o que é GeoJSON
```

Ele precisa apenas saber:

```text
Adicionar mapa
Usar offline
Minha localização
Adicionar ponto
Desenhar
Medir
Salvar
Sincronizar
Atualizar
```

**Esse é o critério principal do produto.**
