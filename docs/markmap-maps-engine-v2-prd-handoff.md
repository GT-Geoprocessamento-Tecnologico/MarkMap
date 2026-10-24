# MarkMap — PRD/Handoff: Maps Engine v2 Offline

**Status:** aprovado para implementação em ramo isolado  
**Branch de integração:** `feat/maps-engine-v2-offline`  
**Base auditada:** `main@156d4e819d6d876c6150969057f2fc3b9afdad45`  
**Data da auditoria:** 2026-10-07  
**Objetivo do documento:** ser o manual executável para agentes que vão evoluir mapa, dados offline, busca, importação/exportação, elevação, roteamento, conteúdo de lugares e atualização do MarkMap sem reescrever a arquitetura vigente.

---

## 1. Objetivo

Transformar o MarkMap em uma aplicação de campo com experiência cartográfica moderna e realmente offline, inspirada nas capacidades do Organic Maps, preservando a arquitetura atual:

- React + Vite + TypeScript;
- MapLibre GL como renderer;
- Terra Draw como edição vetorial;
- IndexedDB/outbox como fonte operacional local;
- Hono + Neon/PostgreSQL/PostGIS para sync/backup/consultas remotas;
- Capacitor para Android/iOS;
- PMTiles para mapas regionais offline.

A aplicação deve continuar útil sem internet depois que o usuário baixar os pacotes necessários.

---

## 2. Resultado esperado

Ao final desta iniciativa, o MarkMap deve oferecer, conforme a região baixada:

- mapa vetorial detalhado baseado em OpenStreetMap;
- ruas, estradas, estradas rurais, ciclovias, trilhas e caminhos de pedestres;
- POIs e lugares;
- tema claro, escuro e outdoor;
- download de regiões para uso totalmente offline;
- atualização segura e resumível dos mapas regionais;
- busca offline por lugares, endereço, categoria, referência e coordenadas;
- importação/exportação GPX, KML/KMZ e GeoJSON;
- curvas de nível, relevo, altitude e perfil de elevação;
- roteamento offline a pé, bicicleta e carro;
- instruções de manobra e orientação por voz;
- conteúdo offline de Wikipedia/Wikidata quando licenciado e disponível;
- transporte/linhas de metrô onde houver dados;
- integração posterior com Android Auto e CarPlay;
- popup de atualização do aplicativo e dos pacotes de mapas;
- operação principal independente da conectividade.

---

## 3. Estado atual auditado

### 3.1 FUNCIONA

- MapLibre GL.
- Terra Draw.
- GPS/geolocalização.
- IndexedDB/outbox local-first.
- PMTiles v3.
- protocolo local para PMTiles.
- estilo offline com glyphs/sprites locais.
- checksum SHA-256 e ativação validada de pacote offline.
- GeoJSON.
- GeoPDF/PDF local e reprojeção.
- armazenamento e limpeza de mapas offline.
- service worker e PWA instalável.
- UpdatePrompt com ativação controlada.
- navegação geométrica básica: distância, bearing, heading e detecção de chegada.

### 3.2 PARCIAL

- atualização PWA: existe worker waiting + botão Atualizar, mas não há política completa de checagem periódica, versão legível, adiar/relembrar, release notes nem canal equivalente para builds Capacitor;
- mapas offline: pacote atual concentra PMTiles + style/glyphs/sprites e possui teto fixo de 250 MiB;
- navegação: não existe grafo viário/roteamento passo a passo;
- gestão de storage: mede categorias internas, mas precisa evoluir para orçamento adaptativo por dispositivo e storage de arquivos grandes.

### 3.3 NÃO IMPLEMENTADO

- GPX;
- KML/KMZ;
- índice de busca offline de OSM;
- roteamento offline carro/bicicleta/pedestre;
- recálculo de rota;
- instruções de manobra;
- TTS de navegação;
- DEM/SRTM;
- curvas de nível;
- perfil de elevação;
- hillshade/relevo;
- artigos Wikipedia offline;
- pacote de transporte/metro;
- Android Auto;
- CarPlay;
- atualização independente de pacote regional de mapa.

---

## 4. Repositórios-modelo auditados

### 4.1 organicmaps/organicmaps

Repo: https://github.com/organicmaps/organicmaps

Uso: referência principal de arquitetura e algoritmos offline.

Áreas relevantes:

- `libs/search/`: busca offline, categorias, ranking e approximate string matching;
- `libs/routing/`: roteamento, manobras e navegação;
- `libs/routing/turns_tts_text.cpp`: geração de instruções para TTS;
- `libs/kml/serdes_gpx.cpp`: GPX;
- `libs/kml/`: KML/GeoJSON e modelos de tracks/bookmarks;
- `generator/isolines_generator.cpp`: curvas de nível;
- `generator/srtm_parser.cpp`: dados de elevação;
- `libs/map/elevation_info.cpp`: perfil/informação de elevação;
- `generator/descriptions_section_builder.cpp` e `generator/wiki_url_dumper.cpp`: descrições/Wikipedia;
- `libs/transit/`: grafo e serialização de transporte;
- `android/app/src/main/java/app/organicmaps/car/`: Android Auto;
- `iphone/Maps/Core/CarPlay/`: CarPlay;
- `generator/`: pipeline de construção de dados offline.

Decisão: reutilizar conceitos e, quando compatível/licenciado, portar trechos isolados. Não portar o app inteiro nem substituir MapLibre/Terra Draw.

### 4.2 organicmaps/api-android

Repo: https://github.com/organicmaps/api-android

É um wrapper Java fino para deep links `om://`, pontos e retorno de coordenadas. Não é o engine offline do Organic Maps.

Uso no MarkMap:

- referência de Intent/Activity Result;
- referência para interop opcional com Organic Maps;
- não usar como base do engine cartográfico.

Licença observada no README: BSD 2-Clause.

### 4.3 organicmaps/api-ios

Repo: https://github.com/organicmaps/api-ios

É uma API por URL scheme/deep link para abrir o Organic Maps, mostrar pins e retornar resultados.

Uso no MarkMap:

- referência para URL schemes/deep links iOS;
- referência para integração externa opcional;
- não usar como engine offline.

Licença observada no README: BSD 2-Clause.

### 4.4 openstreetmap/openstreetmap-website

Repo: https://github.com/openstreetmap/openstreetmap-website

É a aplicação Ruby on Rails que alimenta o site e a API de edição do OpenStreetMap. O próprio README deixa claro que tile servers e geocoding dependem de outros serviços.

Uso no MarkMap:

- referência de comportamento da API OSM e GPX;
- eventual referência para contribuição/edição OSM;
- não usar como servidor de tiles;
- não copiar código para o MarkMap.

Licença: GPL-2.0. Copiar código desse repo para o MarkMap é proibido nesta iniciativa sem uma revisão jurídica/licenciamento específica.

---

## 5. Política obrigatória de licença e proveniência

### 5.1 Código Organic Maps

O repositório principal aponta para Apache-2.0 no root, porém o projeto usa inventário/licenças por arquivo e terceiros. Antes de copiar qualquer trecho:

1. conferir SPDX/cabeçalho do arquivo;
2. conferir `LICENSES/`, `NOTICE` e dependências;
3. registrar origem, commit e arquivo em `THIRD_PARTY_NOTICES.md`;
4. preservar avisos exigidos;
5. preferir reimplementação limpa quando a integração direta for acoplada a MWM/C++.

### 5.2 Dados Organic Maps

Não redistribuir `.mwm`, `packed_polygons.bin` ou outros Data Files do Organic Maps no MarkMap.

A licença de dados é separada e exige atribuição Organic Maps + OpenStreetMap e possui condição específica para white-label/rebranding.

### 5.3 OpenStreetMap

Usar dados OpenStreetMap como fonte primária dos pacotes MarkMap, respeitando ODbL e atribuição visível.

Nunca fazer bulk download/prefetch em `tile.openstreetmap.org`.

### 5.4 openstreetmap-website

Não copiar código GPL-2.0 para os pacotes TypeScript/Hono do MarkMap.

### 5.5 Wikipedia/Wikidata/elevação

Antes de distribuir conteúdo:

- registrar fonte;
- registrar versão/data;
- registrar licença;
- incluir atribuição no app;
- permitir consulta das atribuições por pacote regional.

---

## 6. Arquitetura-alvo

```text
                    PIPELINE DE DADOS (fora do dispositivo)
OpenStreetMap PBF ────────────────────────────────┐
DEM/SRTM/ASTER ──────────────────────────────────┤
Wikipedia/Wikidata ──────────────────────────────┤
GTFS/transit opcional ───────────────────────────┘
                         │
                         ▼
                MarkMap Region Builder
                         │
                         ▼
                 Region Package v2
       ┌─────────────────┼──────────────────┐
       │                 │                  │
       ▼                 ▼                  ▼
 basemap.pmtiles     search shards     routing graph
 contours/DEM        place content     transit metadata
       │                 │                  │
       └─────────────────┼──────────────────┘
                         ▼
              MarkMap Web/PWA/Capacitor
                         │
            ┌────────────┼─────────────┐
            ▼            ▼             ▼
         MapLibre     Web Workers   IndexedDB/outbox
                         │
                 large-file storage
              OPFS / native filesystem
```

### Regra de arquitetura

- IndexedDB continua sendo fonte operacional para entidades, outbox, metadados e estado de instalação.
- arquivos grandes e imutáveis devem usar um `LargeBlobStore` abstrato;
- Web/PWA: OPFS quando disponível, fallback seguro para IndexedDB;
- Capacitor: filesystem nativo quando o uso real justificar plugin nativo;
- Neon nunca vira requisito para trabalho de campo;
- MapLibre e Terra Draw não são substituídos.

---

## 7. Region Package v2

O pacote regional deixa de ser somente um PMTiles.

Estrutura lógica:

```text
region/
  manifest.json
  basemap.pmtiles
  styles/
    light.json
    dark.json
    outdoor.json
  glyphs/
  sprites/
  search/
    metadata.json
    *.idx
  routing/
    graph.bin
    names.bin
    restrictions.bin
  terrain/
    contours.pmtiles
    dem.pmtiles
  content/
    places.idx
    wikipedia/*.json.br
  transit/
    network.bin
  licenses/
    ATTRIBUTION.md
    sources.json
```

Nem todos os módulos são obrigatórios. O manifest deve declarar capabilities:

```text
basemap
search
routing.walk
routing.bicycle
routing.car
elevation
contours
wikipedia
transit
```

### Requisitos de instalação

- manifest versionado;
- tamanho de cada componente;
- SHA-256 por arquivo;
- ID e versão do pacote;
- data da fonte OSM;
- bounds;
- min/max zoom;
- atribuições;
- compatibilidade mínima do app;
- staging antes de ativar;
- ativação atômica;
- rollback para pacote anterior se a ativação falhar;
- download resumível;
- nunca apagar o pacote ativo antes da validação do novo.

### Remover teto fixo de 250 MiB

O limite atual de 250 MiB deve ser substituído por:

- hard limits defensivos por arquivo/componente;
- orçamento calculado por dispositivo;
- reserva de espaço livre;
- consentimento do usuário antes de downloads grandes;
- regiões particionadas para evitar pacotes gigantes.

Não permitir uso ilimitado de storage.

---

## 8. Uso máximo e seguro dos recursos do dispositivo

### 8.1 Storage

Web/PWA:

- chamar `navigator.storage.persist()` em contexto apropriado;
- usar `navigator.storage.estimate()`;
- manter pelo menos uma reserva de segurança;
- preferir OPFS para grandes arquivos regionais;
- IndexedDB mantém metadados, índice de pacotes e domínio local.

Capacitor:

- avaliar e, se necessário, adicionar `@capacitor/filesystem`;
- armazenar pacotes grandes no filesystem privado do app;
- não expor arquivos internos publicamente;
- manter metadados e outbox em IndexedDB.

### 8.2 CPU

Criar workers dedicados:

- `search.worker.ts`;
- `routing.worker.ts`;
- `elevation.worker.ts`;
- worker de parsing/importação quando arquivo for grande.

Política:

- reservar a thread principal para UI/MapLibre;
- usar `navigator.hardwareConcurrency` como sinal, nunca como obrigação de saturar CPU;
- limitar paralelismo em mobile;
- cancelar tarefas antigas por AbortSignal;
- priorizar navegação ativa sobre indexação/background.

### 8.3 Memória

- nunca carregar região inteira na RAM;
- range reads para PMTiles/arquivos binários;
- índices sharded;
- LRU com orçamento adaptativo;
- streaming/chunking de importação;
- liberar buffers após uso;
- medir heap quando API estiver disponível, sem depender dela.

### 8.4 Energia

- não recalcular rota continuamente sem deslocamento significativo;
- pausar tarefas secundárias quando app está background;
- evitar polling agressivo;
- atualizações de mapas são iniciadas/confirmadas pelo usuário.

---

## 9. Sistema de atualização do aplicativo

O MarkMap já possui `UpdatePrompt`; ele deve ser evoluído, não reescrito do zero.

### MM-UPD-010 — Build/version manifest

Criar metadata pública de versão contendo:

- appVersion;
- buildSha;
- buildTime;
- shellProtocolVersion;
- localSchemaVersion;
- minimumCompatibleVersion;
- releaseNotes curtas.

### MM-UPD-020 — Checagem PWA

O app deve chamar `registration.update()`:

- após `serviceWorker.ready`;
- quando voltar a ficar online;
- quando a janela voltar ao foreground/focus;
- periodicamente enquanto online, com intervalo conservador.

Quando houver worker `waiting`, mostrar popup/modal:

**Nova versão do MarkMap disponível**

Ações:

- `Atualizar agora`;
- `Depois`.

Antes de atualizar:

- confirmar que transações locais terminaram;
- confirmar outbox durável;
- confirmar compatibilidade de schema/protocolo;
- não interromper edição em andamento;
- ativar waiting worker;
- recarregar somente depois de `controllerchange`.

Se o usuário escolher `Depois`, relembrar no próximo lançamento/foco ou depois de um intervalo; cada nova versão deve gerar novo aviso.

### MM-UPD-030 — Capacitor Android/iOS

Service worker não substitui atualização de binário nativo.

Quando online:

- consultar version manifest;
- comparar com versão do bundle nativo;
- exibir o mesmo padrão visual de popup;
- botão deve abrir o canal oficial de atualização/distribuição definido para a plataforma;
- não implementar auto-update nativo fora das políticas de distribuição sem autorização específica.

### MM-UPD-040 — Atualização de pacotes de mapa

Separar update do app e update de dados.

Exemplo:

> Mapa Tocantins: atualização disponível — dados OSM de 2026-10-07.

Ações:

- `Atualizar mapa`;
- `Depois`;
- detalhes/tamanho.

Fluxo:

1. baixar em staging;
2. resumir após interrupção;
3. validar checksum;
4. validar manifest/compatibilidade;
5. ativar atomicamente;
6. manter pacote antigo até sucesso;
7. remover antigo somente depois da ativação e confirmação.

---

## 10. Roadmap executável

Os IDs abaixo definem a ordem. Um agente não deve iniciar um item bloqueado por predecessor.

# M0 — Governança, baseline e benchmark

### MM-MAP-000 — Baseline da branch

**Predecessor:** nenhum.

- confirmar HEAD da integração;
- confirmar ausência de trabalho paralelo duplicado;
- rodar lint/typecheck/test/build aplicáveis antes de alterar;
- registrar métricas de bundle, storage e mapa;
- auditar tests existentes de offline maps/PWA;
- criar relatório FUNCIONA/PARCIAL/QUEBRADO/NÃO IMPLEMENTADO.

**Aceite:** baseline registrada no PRD/handoff sem afirmar teste não executado.

### MM-MAP-010 — Proveniência/licenças

- inventariar todo código efetivamente copiado/adaptado;
- proibir código do `openstreetmap-website`;
- registrar Organic Maps por arquivo/commit;
- atualizar THIRD_PARTY_NOTICES quando houver incorporação real.

---

# M1 — Atualizações do app

### MM-UPD-010
Implementar build/version manifest.

### MM-UPD-020
Evoluir UpdatePrompt PWA.

### MM-UPD-030
Adicionar detecção de nova versão em Capacitor.

### MM-UPD-040
Criar modelo de atualização de Region Package.

**Gate M1:**

- teste unitário de state machine do prompt;
- E2E de worker waiting → confirmação → controllerchange;
- teste de `Depois`;
- teste com outbox pendente;
- teste offline após versão já descoberta;
- sem perda de IndexedDB/outbox.

---

# M2 — Storage e Region Package v2

### MM-MAP-100 — DeviceStorageProfile

Criar módulo que informa:

- quota;
- usage;
- persistent granted;
- backend disponível;
- limite seguro calculado.

### MM-MAP-110 — LargeBlobStore

Interface comum para:

- IndexedDB fallback;
- OPFS;
- filesystem Capacitor quando adotado.

Operações mínimas:

- create staging;
- append/write range;
- read range;
- checksum;
- commit/activate;
- rollback;
- delete explícito;
- enumerate.

### MM-MAP-120 — Manifest v2

Evoluir `packages/contracts/src/offline-map.ts` com:

- componentes opcionais;
- capabilities;
- fontes/licenças;
- versionamento;
- compatibilidade;
- checksums individuais;
- tamanho total;
- data OSM.

Compatibilidade: packages v1 existentes não podem quebrar silenciosamente.

### MM-MAP-130 — Instalador resumível

- download com Range quando servidor suportar;
- checkpoint;
- retry idempotente;
- staging;
- validação;
- atomic activate.

### MM-MAP-140 — Gerenciador de regiões

UI:

- regiões instaladas;
- espaço usado;
- tamanho;
- versão;
- data do mapa;
- update disponível;
- remover;
- reparar;
- detalhes/licenças.

**Gate M2:** pacote regional continua funcionando após force-stop/reload e sem rede.

---

# M3 — Mapa OSM moderno

### MM-MAP-200 — Pipeline regional

Criar pipeline reproduzível de entrada OSM PBF → dados consumíveis pelo MarkMap.

Requisitos:

- build determinístico;
- metadata de origem/data;
- logs;
- checksum;
- processamento fora do dispositivo;
- artefatos regionais;
- sem dependência em `tile.openstreetmap.org`.

A escolha do gerador de vector tiles deve ser fechada apenas após benchmark/licença no início deste item.

### MM-MAP-210 — Estilos MarkMap

Criar estilos:

- light;
- dark;
- outdoor.

Renderizar com prioridade adequada:

- estradas;
- vias locais/rurais;
- `highway=path`;
- `footway`;
- `cycleway`;
- `track`;
- trilhas;
- rios/lagos;
- parques;
- limites;
- buildings quando justificável;
- POIs;
- picos;
- estações;
- nomes locais/ref.

### MM-MAP-220 — Atualização de dados

Pipeline deve gerar versão nova por região e catálogo de versões.

Não fazer delta no MVP se ele aumentar risco; download resumível + troca atômica é obrigatório. Delta pode entrar depois que houver benchmark real.

---

# M4 — GPX/KML/KMZ/GeoJSON

### MM-MAP-300 — GPX

Importar:

- waypoints;
- tracks;
- routes;
- elevação;
- timestamps quando presentes;
- nomes/descrições.

Exportar dados compatíveis sem inventar campos ausentes.

### MM-MAP-310 — KML/KMZ

Importar/exportar:

- Point;
- LineString;
- Polygon;
- MultiGeometry relevante;
- estilos básicos;
- ExtendedData segura;
- KMZ com validação contra zip bomb/path traversal.

### MM-MAP-320 — Round-trip

Testes fixture → import → persist local → export → reimport.

**Gate M4:** GeoJSON existente não regride.

---

# M5 — Busca offline

### MM-MAP-400 — Search index builder

Inspirar-se no desenho do `libs/search/` do Organic Maps, sem acoplar a MWM.

Indexar por região:

- name;
- alt_name;
- official_name;
- short_name;
- ref;
- addr:housenumber;
- addr:street;
- addr:place;
- postcode quando disponível;
- place/admin;
- categorias POI;
- coordenadas.

Suportar:

- normalização Unicode;
- case folding;
- prefix;
- tokens;
- aliases;
- ranking por classe/importância/proximidade;
- fuzzy conservador.

### MM-MAP-410 — Search worker

- busca totalmente offline;
- resposta progressiva;
- cancelamento de query anterior;
- não bloquear UI;
- filtro por categoria;
- `perto de mim`;
- coordenadas digitadas.

### MM-MAP-420 — UX

- search box no mapa;
- histórico local;
- recentes/favoritos;
- ação centralizar;
- ação navegar;
- exibir fonte/atribuição quando aplicável.

**Gate M5:** busca por POI/endereço conhecido funciona com modo avião.

---

# M6 — Elevação e outdoor

### MM-MAP-500 — Pipeline DEM/contours

Inspirar-se em:

- `generator/srtm_parser.cpp`;
- `generator/isolines_generator.cpp`.

Gerar por região:

- DEM adequado ao runtime;
- curvas de nível vetoriais;
- metadata de resolução/fonte/licença.

### MM-MAP-510 — Consulta de altitude

- altitude no cursor/local;
- altitude em ponto capturado;
- altitude em waypoint;
- cache local.

### MM-MAP-520 — Perfil de elevação

Inspirar-se em `libs/map/elevation_info.cpp`.

Exibir:

- distância;
- altitude;
- ganho;
- perda;
- mínimo;
- máximo;
- gráfico do perfil.

### MM-MAP-530 — Relevo

- contours;
- hillshade quando suportado pelo pacote/MapLibre;
- picos;
- outdoor style.

**Gate M6:** toda consulta funciona sem rede com pacote compatível.

---

# M7 — Roteamento offline e navegação

### MM-MAP-600 — Routing graph builder

Gerar grafo regional a partir de OSM.

Deve considerar:

- one-way;
- access;
- turn restrictions;
- surface;
- tracktype;
- bicycle/foot access;
- ferry quando suportado;
- velocidade/perfil;
- bridges/tunnels relevantes.

### MM-MAP-610 — Runtime router

Executar em Web Worker.

Perfis:

- walk;
- bicycle;
- car.

Requisitos:

- snap origem/destino à rede;
- rota;
- alternativas somente depois do MVP;
- cancelamento;
- limites de memória;
- resultado com geometria + segmentos + metadata.

### MM-MAP-620 — Maneuvers

Inspirar-se em `libs/routing/`.

Gerar:

- vire esquerda/direita;
- mantenha;
- rotatória;
- saída;
- continue;
- chegada.

### MM-MAP-630 — Navegação

- GPS tracking;
- route progress;
- off-route;
- recálculo local;
- distância para próxima manobra;
- ETA estimada;
- chegada;
- wake behavior somente quando necessário.

### MM-MAP-640 — Voz

Inspirar-se em `libs/routing/turns_tts_text.cpp`.

- gerar texto local;
- usar TTS do SO/browser;
- não depender de serviço cloud;
- controle de volume/ativação;
- pt-BR primeiro, arquitetura preparada para i18n.

**Gate M7:** rota completa a pé/bike/carro em aparelho sem internet.

---

# M8 — Conteúdo de lugares e transporte

### MM-MAP-700 — Wikipedia/Wikidata offline

Inspirar-se em:

- `generator/descriptions_section_builder.cpp`;
- `generator/wiki_url_dumper.cpp`.

Processar no pipeline:

- tags OSM `wikipedia`/`wikidata`;
- extratos permitidos;
- idioma;
- atribuição;
- conteúdo compactado/sharded.

Runtime:

- place sheet;
- título;
- resumo;
- link para abrir artigo completo quando online;
- conteúdo offline quando baixado.

### MM-MAP-710 — Transporte/metro

Inspirar-se em `libs/transit/`.

MVP:

- estações;
- linhas;
- cor/nome;
- overlay no mapa;
- busca por estação.

Roteamento multimodal somente depois de evidência de necessidade e dados suficientes.

---

# M9 — Android Auto e CarPlay

Executar somente depois de M7 estável.

### MM-MAP-800 — Android Auto

Referências:

- `android/app/src/main/java/app/organicmaps/car/`;
- `organicmaps/api-android` apenas para padrões de Intent/deep link.

Implementar integração nativa Capacitor somente com escopo aprovado.

### MM-MAP-810 — CarPlay

Referências:

- `iphone/Maps/Core/CarPlay/`;
- `organicmaps/api-ios` apenas para padrões de URL scheme/deep link.

Respeitar templates/restrições de segurança da Apple.

---

# M10 — Hardening e merge readiness

### MM-MAP-900 — Performance

Medir em aparelhos de referência:

- startup;
- mapa first-render;
- pan/zoom FPS;
- memória;
- busca p50/p95;
- rota curta/longa;
- tamanho de região;
- instalação/atualização;
- bateria em navegação prolongada.

Sem número-alvo inventado: registrar baseline e fechar budgets com evidência.

### MM-MAP-910 — Segurança

Testar:

- path traversal;
- zip bomb KMZ;
- manifest adulterado;
- checksum;
- pacote truncado;
- download interrompido;
- resource exhaustion;
- arquivos gigantes;
- XSS em properties/descrições;
- URLs externas;
- corrupção IndexedDB/storage.

### MM-MAP-920 — Compatibilidade

- migration package v1 → v2 ou convivência;
- app antigo não deve ativar package incompatível;
- app novo não deve apagar package antigo antes de confirmar novo;
- schema local preserva workspace/outbox;
- rollback documentado.

### MM-MAP-930 — Documentação/legal

Atualizar:

- `docs/architecture.md`;
- `docs/gis-geopdf.md` ou novo doc de maps engine;
- `docs/user-guide.md`;
- `docs/testing.md`;
- `docs/privacy.md` quando houver novos dados;
- `THIRD_PARTY_NOTICES.md`;
- ADR de package v2/storage/routing;
- checklist/handoff.

### MM-MAP-940 — Gate para PR contra main

Não abrir PR para `main` até:

- integração branch atualizada com main sem apagar trabalho;
- lint verde;
- typecheck verde;
- unit/integration verdes;
- build verde;
- E2E aplicável verde;
- testes offline aplicáveis verdes;
- Android APK aplicável verde;
- iOS build aplicável verde;
- diff revisado;
- licenças revisadas;
- documentação sincronizada;
- nenhuma ação irreversível pendente;
- evidência física registrada para recursos que exigem aparelho.

---

## 11. Arquivos/áreas esperados

Existentes:

- `packages/contracts/src/offline-map.ts`;
- `packages/maps/src/offline/*`;
- `packages/maps/src/providers.ts`;
- `packages/maps/src/maplibre.ts`;
- `packages/geo/src/*`;
- `apps/admin/src/lib/storage/*`;
- `apps/admin/src/lib/datasets/*`;
- `apps/admin/src/pages/imports/ImportsPage.tsx`;
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx`;
- `apps/admin/src/components/pwa/UpdatePrompt.tsx`;
- `apps/admin/public/sw.js`;
- `apps/admin/package.json`;
- mobile Capacitor somente quando necessário.

Novas áreas sugeridas:

- `packages/maps/src/search/`;
- `packages/maps/src/routing/`;
- `packages/maps/src/elevation/`;
- `packages/maps/src/offline-v2/` somente se não for possível evoluir `offline/` compatibilmente;
- `packages/geo/src/gpx.ts`;
- `packages/geo/src/kml.ts`;
- `apps/admin/src/workers/`;
- `tools/maps-pipeline/`;
- fixtures em `packages/*/fixtures/` e testes próximos aos módulos.

Não criar arquitetura paralela sem necessidade comprovada.

---

## 12. Segurança

Obrigatório:

- arquivos importados são não confiáveis;
- nenhum XML com resolução de entidade externa;
- nenhum unzip sem limites;
- nenhum caminho vindo do pacote pode escapar do diretório lógico;
- checksum antes de ativação;
- limites de tamanho por componente;
- abort/cancel em tarefas pesadas;
- URLs de conteúdo sanitizadas;
- conteúdo Wikipedia renderizado como texto seguro/HTML sanitizado conforme implementação;
- nenhuma credencial de banco no cliente;
- nenhum secret no pacote regional;
- telemetria não pode ser requisito para offline.

---

## 13. Critérios de aceite globais

1. O MarkMap abre e permite trabalhar em região previamente baixada com modo avião.
2. Dados de usuário continuam persistidos em IndexedDB/outbox.
3. Pacotes regionais grandes não bloqueiam a thread principal.
4. Atualização de app não perde edição/outbox.
5. Atualização de mapa é atômica e recuperável.
6. Busca offline não chama API remota.
7. Roteamento offline não chama API remota.
8. Elevação/contours offline não chamam API remota.
9. Licenças/atribuições são visíveis e rastreáveis.
10. Nenhum código GPL do openstreetmap-website é incorporado.
11. Nenhum Data File `.mwm/.bin` do Organic Maps é redistribuído.
12. Recursos existentes de GeoPDF, desenho, sync e PWA não regridem.

---

## 14. Testes obrigatórios

### Unit

- parsers;
- manifest;
- path safety;
- checksum;
- search normalization/ranking;
- graph restrictions;
- maneuver generation;
- elevation calculations;
- update state machines.

### Integration

- package staging → validation → activation;
- interrupted/resumed download;
- package v1 compatibility;
- import/export round-trip;
- search against real fixture;
- routing against real OSM fixture;
- terrain fixture.

### E2E

- instalar região;
- fechar/reabrir offline;
- buscar POI offline;
- visualizar trilha;
- importar GPX;
- gerar rota offline;
- receber popup de atualização;
- atualizar app preservando IndexedDB;
- atualizar região preservando dados de usuário.

### Physical

- Android offline;
- iOS offline;
- GPS/navigation;
- storage pressure;
- arquivo grande;
- update PWA instalada;
- native update notice quando canal mobile existir;
- Android Auto/CarPlay somente quando implementados.

---

## 15. QA por fase

Cada agente deve reportar:

```text
RESULTADO
ALTERAÇÕES
ARQUIVOS
VALIDAÇÃO EXECUTADA
VALIDAÇÃO NÃO EXECUTADA
LICENÇAS/ORIGEM DE CÓDIGO
RISCOS/PENDÊNCIAS
PRÓXIMO TASK ID LIVRE
```

Nunca usar “concluído” sem evidência.

---

## 16. Regras de Git e agentes paralelos

Branch de integração desta iniciativa:

```text
feat/maps-engine-v2-offline
```

Regras:

1. nunca implementar esta iniciativa diretamente em `main`;
2. antes de iniciar, verificar HEAD/PRs/checklist;
3. cada agente deve pegar somente o primeiro Task ID livre que não esteja bloqueado;
4. para trabalho paralelo, criar branch curta a partir da integração, por exemplo:
   `agent/MM-MAP-300-gpx`;
5. PR desses agentes deve apontar para `feat/maps-engine-v2-offline`, não para `main`;
6. não force-push;
7. não resetar/apagar mudanças alheias;
8. revisar diff antes de merge;
9. se a integração avançar, atualizar branch com método não destrutivo;
10. PR para `main` somente após MM-MAP-940.

---

## 17. Ações proibidas sem autorização explícita

- deploy público;
- publicação em loja;
- release/tag;
- migration destrutiva;
- DROP/TRUNCATE/DELETE production;
- rotação de secrets;
- custo recorrente relevante;
- force push;
- apagar branch/trabalho de agente;
- distribuir Data Files do Organic Maps;
- copiar código GPL do openstreetmap-website;
- alterar arquitetura central React/Vite/MapLibre/Terra Draw/IndexedDB/Hono/Neon sem ADR e evidência.

---

## 18. Riscos principais

### Storage

Regiões detalhadas podem ser grandes. Mitigação: particionamento, orçamento adaptativo, resumable download e escolha explícita do usuário.

### CPU/bateria

Roteamento e busca podem consumir recursos. Mitigação: workers, cancelamento, caches, perfis e medição física.

### Licença

Misturar código/dados de fontes diferentes pode gerar obrigação incompatível. Mitigação: proveniência por arquivo e gate legal antes de merge.

### Complexidade MWM

O core Organic Maps é fortemente integrado ao formato e ao C++ próprio. Mitigação: copiar conceitos/algoritmos isolados, não adotar MWM como formato do MarkMap.

### Mobile/PWA

APIs de storage variam entre browser e WebView. Mitigação: adapter de storage e testes físicos.

### Atualização

Ativação errada de novo shell/pacote pode quebrar operação offline. Mitigação: compat version, staging, atomic swap e rollback.

---

## 19. Fora do escopo desta primeira iniciativa

Até haver evidência específica:

- substituir MapLibre;
- substituir Terra Draw;
- migrar toda a aplicação para C++/Kotlin/Swift;
- usar `.mwm` como formato principal;
- hospedar clone do openstreetmap.org;
- edição colaborativa direta do OSM;
- tráfego em tempo real;
- roteamento cloud obrigatório;
- IA necessária para recursos básicos;
- publicação em loja;
- deploy production.

---

## 20. Handoff para o primeiro agente executor

### Tarefa inicial

Começar por **MM-MAP-000**, depois **MM-MAP-010**, e só então **M1**.

Não iniciar routing/search/terrain antes da fundação de storage/package v2 estar definida e testada.

### Prompt pronto

```text
Você está trabalhando no MarkMap.

Leia primeiro GEONEXO_FONTE_CHATGPT.md das Fontes do Projeto.
Depois consulte o Checklist Mestre do Notion e confira o HEAD/PRs atuais.

Esta iniciativa deve ser desenvolvida na branch de integração:
feat/maps-engine-v2-offline

Leia integralmente:
docs/markmap-maps-engine-v2-prd-handoff.md
docs/master-checklist.md
docs/handoff.md

Pegue somente o primeiro Task ID livre e não bloqueado.
Antes de editar, audite a área e classifique FUNCIONA, PARCIAL, QUEBRADO ou NÃO IMPLEMENTADO.
Não reescreva algo que funciona.

Preserve:
React + Vite + TypeScript
MapLibre
Terra Draw
IndexedDB/outbox
Hono
Neon/PostGIS
Capacitor

Operação principal deve continuar offline-first.

Não copie código de openstreetmap/openstreetmap-website.
Não redistribua .mwm/.bin do Organic Maps.
Todo trecho copiado/adaptado precisa de origem/licença registrada.

Antes de concluir, execute os gates aplicáveis e entregue:
RESULTADO
ALTERAÇÕES
ARQUIVOS
VALIDAÇÃO EXECUTADA
VALIDAÇÃO NÃO EXECUTADA
LICENÇAS/ORIGEM DE CÓDIGO
RISCOS/PENDÊNCIAS
PRÓXIMO TASK ID LIVRE

Não abra PR para main. PRs intermediários apontam para feat/maps-engine-v2-offline.
```

---

## 21. Definition of Done da iniciativa

A iniciativa só pode ser considerada pronta para request contra `main` quando:

- MM-MAP-940 estiver satisfeito;
- checklist do Notion e Git estiverem sincronizados;
- handoff estiver atualizado;
- documentação de uso offline estiver pronta;
- atribuições e THIRD_PARTY_NOTICES estiverem corretos;
- não houver gate vermelho conhecido;
- testes físicos necessários tiverem evidência;
- rollback/compatibilidade estiverem documentados;
- o responsável autorizar a abertura do PR para `main`.
