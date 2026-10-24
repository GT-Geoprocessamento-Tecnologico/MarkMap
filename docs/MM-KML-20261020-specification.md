# MM-KML-20261020 — importação e sobreposição georreferenciada

Status: **SPECIFICATION GATE — DONE.** Correção reservada como `0.3.1` (PATCH), sujeita ao Root atualizar pacote e `CHANGELOG.md` conforme a política vigente. Builders só iniciam após este gate.

## Objetivo

Fazer KML/KMZ, GeoJSON e GPX importados aparecerem sobre o MapLibre com suas coordenadas WGS 84, no mesmo fluxo local e persistente já usado pelos datasets e pelo overlay de GeoPDF. O arquivo privado `Q11 teste kml.kml` é apenas referência de auditoria e permanece fora do commit; a regressão versionada deve espelhar sua estrutura com dados genéricos. Ele contém namespace KML 2.2, `<Placemark id="…">`, `Folder`, `Style`, `ExtendedData`, `MultiGeometry` e polígonos com coordenadas reais de Araguaína.

## Auditoria atual e causa observada

- `ImportsPage.tsx` aceita `.geojson`, `.gpx`, `.kml` e `.kmz`, chama `parseDatasetFile`, salva o `DatasetRecord` em IndexedDB e oferece link para `/workspace?datasetId=…`.
- `dataset-store.ts` normaliza GPX/KML/KMZ para FeatureCollection, valida geometria WGS 84 e persiste o original junto com o GeoJSON. `CommandCenterPage.tsx` lê datasets, combina o selecionado em `activeGeoJson`, instala a fonte `local-dataset` e ajusta o enquadramento pelos bounds.
- `packages/geo/src/kml.ts` usa regex de texto. O padrão atual exige literalmente `<Placemark>` sem atributos; o fixture usa `<Placemark id="quadras_aux.1">`, portanto nenhum placemark é encontrado e a importação termina sem feições compatíveis. O parser também não deve depender de tags sem prefixo quando KML válido usar namespace prefixado.
- A renderização MapLibre já aceita Point, LineString e Polygon/MultiGeometry normalizados; a lacuna primária é parser → GeoJSON. Estilo KML arbitrário, imagens/NetworkLink e semântica visual não devem ser inventados; o overlay pode usar o estilo local seguro existente e preservar propriedades para popup.

## Contrato de implementação

1. Aceitar KML 2.2 com atributos em `Placemark`, namespace default ou prefixado, `Folder`, `Point`, `LineString`, `Polygon`, `MultiGeometry`, anéis externos/internos, `name`, `description` e `ExtendedData` limitada a propriedades escalares. Converter coordenadas `[longitude, latitude, altitude?]` para FeatureCollection WGS 84.
2. Preservar `Placemark id` como `Feature.id` quando válido e incluir nome/descrição/atributos em `properties`; não permitir XML externo, DTD, ENTITY, NetworkLink ou fetch de recursos referenciados.
3. Manter o limite de 25 MiB, 10.000 feições, 100.000 posições e os limites de profundidade já aplicados pelo `dataset-store`. Rejeitar coordenadas não finitas/fora de longitude-latitude, anéis inválidos, geometria vazia e arquivos incompatíveis com mensagem segura.
4. KMZ deve continuar extraindo somente a entrada KML autorizada, com proteção de path traversal, zip bomb, CRC e limites já existentes. A correção não deve ampliar o leitor para arquivos arbitrários do ZIP.
5. O `DatasetRecord` continua guardando o original e o GeoJSON normalizado. Após salvar, a navegação para `/workspace?datasetId=` deve selecionar o dataset, atualizar `local-dataset`, ajustar bounds uma vez e manter a camada após `style.load`/reabertura offline. Não criar backend, provider, nova store, schema, Service Worker ou dependência nativa.
6. O fluxo deve funcionar em WebView/Capacitor usando apenas o seletor de arquivo existente. Alterações de `Info.plist`, Android manifest ou ponte nativa são responsabilidade exclusiva do Root e só entram se QA reproduzir bloqueio de seleção fora do parser.

## Critérios de aceitação

- `Q11 teste kml.kml` importa sem erro, produz pelo menos um Polygon com bounds próximos aos vértices do fixture e mantém `quadras_aux.1`, `quadra`, `bairro` e `source` em propriedades.
- KML com `<Placemark id>`, namespace default/prefixado, MultiGeometry e anel interno passa; XML com DTD/ENTITY, coordenada inválida, excesso de posições e KML vazio falha explicitamente.
- GeoJSON, GPX, KML simples e KMZ existente continuam passando seus testes e o original permanece exportável.
- No navegador desktop e, quando dispositivos físicos estiverem disponíveis, em Android/iOS, importar → salvar → abrir o link do dataset mostra a geometria sobre o mapa, enquadra seus bounds, mantém popup/propriedades e sobrevive a reload offline. Emulação não conta como validação física.
- A camada não consulta rede, não desloca coordenadas, não inventa altitude e não apaga projetos, datasets, outbox ou GeoPDF existentes.
- A release candidata usa `0.3.1`; Root registra versão, data, mudanças e evidência em `CHANGELOG.md`, sem workers paralelos bumparem o pacote.

## Grafo e ownership

| ID | Responsável | Arquivos próprios | Entrega | Dependência |
|---|---|---|---|---|
| KML-01 | Parser builder | `packages/geo/src/kml.ts`, `packages/geo/src/gpx-types.ts`, `packages/geo/src/tracks-geojson.ts`, testes `packages/geo/tests/**` | Placemark com atributos/namespaces, MultiGeometry/polígonos, propriedades escalares e limites; extensões opcionais `sourceId`/metadata preservam o contrato GPX existente | esta especificação |
| KML-02 | Import/map builder | `apps/admin/src/lib/datasets/**`, `ImportsPage`/CommandCenter somente se a reprodução exigir | Fixture real no pipeline, seleção, bounds, persistência e overlay offline | KML-01 |
| KML-03 | QA independente | testes de parser, Vitest/Playwright e matriz WebView | desktop + reload offline + Android/iOS real; evidência de posição e erros | KML-01/02 |
| KML-04 | Root | `apps/admin/package.json`, `CHANGELOG.md`, release guard/native quando aplicável | reservar/publicar `0.3.1` e integrar somente arquivos aprovados | KML-03 |

## Verificação obrigatória

Executar testes unitários do parser e dataset, typecheck, lint e build; usar o fixture real e comparar bounds/contagem/propriedades. Executar Playwright no app web com rede desligada após persistência. Repetir no cliente nativo Android e iOS com o seletor de arquivo, registrando se a falha é seleção WebView, parsing, IndexedDB ou camada MapLibre. Verificar ausência de requests externos durante parsing e reabertura. Root deve executar `node scripts/version-release-guard.mjs --base-ref <SHA-base>` e a variante `--dist apps/admin/dist` no SHA final.

## Riscos, limites e parada

Parar se o fixture exigir reprojeção que não esteja declarada, se KML depender de NetworkLink/estilo externo, se o ZIP exceder limites, se a camada sumir após `style.load`, ou se dados existentes forem alterados. O escopo não promete suporte completo a COLLADA, GroundOverlay raster, tours, modelos 3D, links remotos, simbologia KML pixel-perfect ou endereços. Não declarar “funciona no iOS/Android” sem executar o fluxo real nesses clientes.

## Atualização confirmada do contrato — seletor móvel

O usuário confirmou nesta execução que, no iOS e Android, o KML não aparece ou fica indisponível no seletor. Isso é uma falha anterior ao parser, e faz parte desta correção. O seletor principal existente deve permitir escolher arquivos sem filtro `accept` por extensão/MIME; os formatos continuam claramente indicados na tela e a aceitação real permanece nas validações locais de nome, conteúdo, geometria, tamanho e arquivo compactado. Não adicionar ponte nativa, permissões de armazenamento, outro layout ou um segundo seletor. Acrescentar teste de UI que confira a ausência do filtro e rejeite formato não suportado sem gravar dataset. A automação `setInputFiles` verifica o caminho do aplicativo, mas não comprova o seletor físico do iOS/Android; essa limitação deve constar na entrega.

Owner deste ajuste: KML-02, `ImportsPage.tsx` e teste de componente correspondente. A especificação e a atribuição estão autorizadas pelo esclarecimento explícito do usuário; os demais contratos permanecem vigentes.

Referências do contrato: [KML 2.2 — Placemark, MultiGeometry e ExtendedData](https://developers.google.com/kml/documentation/kmlreference) e [MDN — accept é uma indicação para o seletor, não validação](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept). A validação local continua obrigatória mesmo com o seletor sem filtro.
