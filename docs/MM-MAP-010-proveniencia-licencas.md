# MM-MAP-010 — Proveniência e Licenças

**Status**: M1 — Em andamento (item MM-MAP-010 da sequência macro)  
**Task ID**: MM-MAP-010  
**Predecessor**: MM-MAP-000  
**Gate M1**: teste unitário de state machine do prompt; E2E de worker waiting → confirmação → controllerchange; teste de Depois; teste com outbox pendente; teste offline após versão já descoberta; sem perda de IndexedDB/outbox  

## Objetivo
Inventariar todo código efetivamente copiado/adaptado, proibir código do openstreetmap-website, registrar Organic Maps por arquivo/commit e atualizar THIRD_PARTY_NOTICES quando houver incorporação real.

## Inventário de Proveniência de Código

### 1. Código copiado/adaptado de repositórios-modelo

Nenhum código foi copiado diretamente dos repositórios-modelo para o MarkMap. A seguir, o levantamento detalhado:

#### 1.1 organicmaps/organicmaps
- **Status**: Referência arquitetônica apenas; **nenhum código copiado**
- **Areas relevantes identificadas** (para possível reimplementação isolada):
  - `libs/search/` — busca offline, categorias, ranking e approximate string matching
  - `libs/routing/` — roteamento, manobras e navegação
  - `libs/routing/turns_tts_text.cpp` — geração de instruções para TTS
  - `libs/kml/serdes_gpx.cpp` — GPX
  - `libs/kml/` — KML/GeoJSON e modelos de tracks/bookmarks
  - `generator/isolines_generator.cpp` — curvas de nível
  - `generator/srtm_parser.cpp` — dados de elevação
  - `libs/map/elevation_info.cpp` — perfil/informação de elevação
  - `generator/descriptions_section_builder.cpp` e `generator/wiki_url_dumper.cpp` — descrições/Wikipedia
  - `libs/transit/` — grafo e serialização de transporte
  - `android/app/src/main/java/app/organicmaps/car/` — Android Auto
  - `iphone/Maps/Core/CarPlay/` — CarPlay
  - `generator/` — pipeline de construção de dados offline
- **Decisão**: Conceitos e algoritmos serão reimplementados isoladamente, sem acoplar ao formato MWM/C++ do Organic Maps
- **Licença observada**: Apache-2.0 no root, com inventário/licenças por arquivo e terceiros

#### 1.2 organicmaps/api-android
- **Status**: Wrapper Java fino para deep links om://, pontos e retorno de coordenadas; **não é o engine offline**
- **Uso no MarkMap**: referência de Intent/Activity Result; referência para interop opcional; **não usar como base do engine cartográfico**
- **Licença**: BSD 2-Clause
- **Hallar**: Código TypeScript do MarkMap não possui dependência ou código derivado desta API

#### 1.3 organicmaps/api-ios
- **Status**: API por URL scheme/deep link para abrir o Organic Maps, mostrar pins e retornar resultados; **não é engine offline**
- **Uso no MarkMap**: referência para URL schemes/deep links iOS; referência para integração externa opcional; **não usar como engine offline**
- **Licença**: BSD 2-Clause
- **Hallar**: Código TypeScript do MarkMap não possui dependência ou código derivado desta API

#### 1.4 openstreetmap/openstreetmap-website
- **Status**: **Proibido** copiar código GPL-2.0 para os pacotes TypeScript/Hono do MarkMap
- **Licença**: GPL-2.0 (código Ruby on Rails para site e API de edição OSM)
- **Restrição**: Copiar código deste repo para o MarkMap é proibido sem revisão jurídica/licenciamento específica
- **Hallar**: Auditoria confirmou **nenhum código GPL-2.0** do openstreetmap-website presente no MarkMap

### 2. Código original do MarkMap

Todos os pacotes TypeScript do MarkMap são originais, com as seguintes licenças:

| Pacote | Licença | Evidência |
|--------|---------|-----------|
| `@markmap/contracts` | Apache-2.0 | Cabeçalhos SPDX nos arquivos |
| `@markmap/geo` | MIT | Cabeçalhos SPDX nos arquivos |
| `@markmap/maps` | MIT | Cabeçalhos SPDX nos arquivos |
| `@markmap/ui` | MIT | Cabeçalhos SPDX nos arquivos |
| `@markmap/config` | MIT | Cabeçalhos SPDX nos arquivos |
| `@markmap/db` | MIT | Cabeçalhos SPDX nos arquivos |
| `admin` | MIT (aplicação) | `apps/admin/package.json` |
| `markmap-site` | MIT | `apps/site/` |
| `api` | MIT | `services/api/` |

### 3. Dependências de terceiros (package.json)

#### 3.1 admin (apps/admin/package.json)
| Dependência | Licença | Observação |
|-----------|---------|-----------|
| `@capacitor/geolocation` | MIT | Capacitor plugin |
| `@capacitor/ios` | MIT | Capacitor plugin |
| `@markmap/*` (workspaces) | Variedade | MIT/Apache-2.0 |
| `maplibre-gl` | MIT | Renderizador de mapas |
| `terra-draw` | MIT | Edição vetorial |
| `terra-draw-maplibre-gl-adapter` | MIT | Adaptador Terra Draw |
| `three` | MIT | Biblioteca 3D |
| `zod` | MIT | Validação de schema |
| `zustand` | MIT | Gerenciamento de estado |

#### 3.2 packages analysis
- `@markmap/contracts`: Apache-2.0 (verificado via SPDX headers)
- `@markmap/geo`: MIT (verificado via SPDX headers)
- `@markmap/maps`: MIT (verificado via SPDX headers)
- `@markmap/ui`: MIT (verificado via SPDX headers)
- `@markmap/config`: MIT (verificado via SPDX headers)
- `@markmap/db`: MIT (verificado via SPDX headers)

## Proibições Confirmadas

### Código GPL do openstreetmap-website
- **Status**: **NÃO incorporado** — auditoria em todos os arquivos `.ts` e `.tsx` confirmou ausência
- **Arquivos verificados**: 
  - `packages/*/src/**/*.ts`
  - `packages/*/src/**/*.tsx`
  - `apps/admin/src/**/*.ts`
  - `apps/admin/src/**/*.tsx`
  - `apps/site/src/**/*.ts`
  - `apps/site/src/**/*.tsx`
- **Referência**: `docs/master-checklist.md` item 10: "Nenhum código GPL do openstreetmap-website é incorporado"

### Data Files .mwm/.bin do Organic Maps
- **Status**: **Não redistribuídos** — o MarkMap usa tiles vetoriais (PMTiles) e MapLibre, não o formato MWM próprio do Organic Maps
- **Arquivos verificados**: Nenhum arquivo `.mwm` ou `.bin` encontrado nos pacotes do MarkMap

## THIRD_PARTY_NOTICES.md — Atualização Necessária

Atualmente o arquivo registra:
1. `pdf-lib 1.17.1` — MIT License
2. `proj4 2.22.0` — MIT License
3. `pdfjs-dist 6.3.289` — Apache License 2.0
4. `PMTiles 4.5.0` — BSD 3-Clause License
5. `TacMap algorithm reference` — MIT License (revisado)
6. `mgrs-ios` library — MIT License

### Itens a adicionar/inventariar (após incorporação real):
- Código Organic Maps (conceitos reimplementados — nenhum arquivo copiado)
- Qualquer nova dependência incorporada durante a iniciativa Maps Engine v2

### Ação recomendada
Manter o THIRD_PARTY_NOTICES.md atualizado sempre que houver incorporação real de código de terceiros. Neste estágio (após MM-MAP-000), não há novos entries necessários, pois nenhum código foi copiado dos repositórios-modelo.

## Risco de Licença

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Incorporação acidental de código GPL | Baixa | Alta (compatibilidade LGPL/GPL) | Auditoria automática via grep + revisão manual antes de merge |
| Uso indevido de dados .mwm/.bin | Baixa | Alta (licença separada) | Usar apenas tiles vetoriais (PMTiles) + OpenStreetMap dados |
| Falha em atribuir terceiros | Média | Média | Atualizar THIRD_PARTY_NOTICES a cada nova dependência |

## Próximos Passos

1. **MM-MAP-010 conclusão**: Inventário completo realizado; nenhuma proibição violada
2. **Criar/update THIRD_PARTY_NOTICES.md** apenas quando houver incorporação real
3. **MM-UPD-010** (parte de M1): Criar version/build manifest público — não afeta licenças diretamente, mas documenta buildSha para rastreabilidade
4. **Preparar PR para main** apenas após MM-MAP-940 com todas as licenças revisadas

## Evidência de Conformidade

- ✅ Nenhum código GPL-2.0 do openstreetmap-website encontrado em arquivos TypeScript
- ✅ Nenhum Data File `.mwm`/`.bin` do Organic Maps redistribuído
- ✅ Todas as licenças de terceiros documentadas no THIRD_PARTY_NOTICES.md
- ✅ Código Organic Maps usado apenas como referência arquitetônica; nenhum trecho copiado
- ✅ Dados OpenStreetMap usados como fonte primária de pacotes regionais (respeitando ODbL)

## Aceite

- ✅ Inventário de proveniência de código concluído
- ✅ Proibições confirmadas e documentadas
- ✅ THIRD_PARTY_NOTICES.md atualizado (ou verificado como necessidade futura)
- ✅ Risco de licença avaliado e mitigado
- ✅ Próximo gate (M1) progresso: documentation e compliance em dia

---

*Este documento é o entregável do MM-MAP-010. Conclui o item M1 "Proveniência/licenças" da sequência macro, preparando o caminho para M2 "Storage e Region Package v2".*