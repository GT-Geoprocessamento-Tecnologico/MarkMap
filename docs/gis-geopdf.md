# GIS e GeoPDF

## Núcleo GIS

- MapLibre GL para visualização;
- Terra Draw para desenho/edição;
- `@geonexo/geo` para utilitários geoespaciais;
- PostGIS para persistência/consultas remotas.

## CRS

O banco usa **EPSG:4674 / SIRGAS 2000** como SRID canônico de geometrias.

O pacote `@geonexo/geo` inclui transformação CRS com `proj4` e suporte a sistemas projetados usados no Brasil.

## GeoPDF

O repositório possui módulos para metadata, OGC/LGIDict, ISO measure, transformações, registro de CRS e validação com PDFs reais. O frontend usa PDF.js localmente para preview/processamento.

### Georreferenciamento existente

GeoPDF com metadados válidos continua sendo resolvido diretamente e convertido para a referência canônica usada pelo app.

### Auto-calibração sem georreferenciamento válido

Quando não há referência embutida válida, o app pode analisar **offline** o texto da primeira página em busca de grade cartográfica:

- coordenadas geográficas com hemisfério;
- grade SIRGAS 2000 / UTM em zonas brasileiras do hemisfério sul;
- no mínimo três rótulos independentes por eixo;
- ajuste linear por eixo;
- R² mínimo de 0,995;
- residual normalizado máximo de 0,015;
- cobertura mínima de 35% da página;
- confiança mínima de 0,88;
- validação espacial do ajuste antes de persistir.

Grades UTM são transformadas para WGS84 e rejeitadas quando produzem coordenadas incompatíveis com o Brasil.

A referência automática só é salva quando todos os critérios passam. Caso contrário, a interface informa o motivo e mantém **posicionamento manual** como fallback.

## Estado

**FUNCIONA:** GeoPDF com referência válida, CRS projetado/SIRGAS e auto-calibração por grade textual com limiar de confiança.

**PARCIAL:** PDFs sem grade textual reconhecível dependem do fallback manual; PDF grande ainda requer validação em aparelho físico.

### Regra de alinhamento de GeoPDF (A68)

- ISO `/VP /BBox` descreve a **area geografica do mapa** na folha, independente dos `/LPTS` usados como pontos de ajuste. Nao extrapolar a folha inteira como mapa.
- Rasterizar localmente com PDF.js, recortar a janela georreferenciada em pixels apos aplicar CropBox e rotacao, e converter **os mesmos quatro cantos** do recorte para longitude/latitude via `pageToLonLat` antes de enviar para o MapLibre.
- Manter a escolha manual e referencia salva quando houver; nao substituir pontos corrigidos pelo usuario silenciosamente.
- Em arquivos com CRS incompatível, viewport ambiguo ou metadados errados, nao inventar localizacao. Validar com GeoPDF real antes de prometer alinhamento absoluto.


## Visualização responsiva no módulo Dados (A71)

`PdfPreview` continua trabalhando com o Blob original offline. O canvas PDF.js conserva suas dimensões de rasterização (com o orçamento já existente de 16 milhões de pixels), mas a **apresentação** é limitada pela largura e altura do dispositivo, mantendo a proporção, sem cortar a carta. O controle **Ampliar para ler / Ajustar à tela** permite examinar o original com rolagem; a escala CSS não modifica arquivo, metadados, referência geográfica, nem os pontos de calibração, que são posicionados proporcionalmente à imagem exibida.

## Verificação da posição GPS ao abrir GeoPDF (A73)

- A imagem é posicionada exclusivamente pela referência geográfica do próprio PDF ou pela calibração previamente salva. Não ajustar a carta artificialmente para coincidir com uma posição de GPS.
- Ao abrir com permissão de geolocalização, a centralização automática exige precisão informada pelo dispositivo de até 100 m e posição dentro do quadrilátero rasterizado. O controle GPS continua disponível para consulta manual.
- GPS de Windows baseado em Wi-Fi ou IP pode indicar incerteza em quilômetros (círculo azul grande). Informar a precisão, não atribuir esse desvio ao PDF automaticamente.
- O GeoPDF é enquadrado uma única vez por carregamento; a seleção de outras feições não deve sobrescrever esse enquadramento. Movimento manual do usuário cancela recentralização GPS pendente.
- A posição absoluta e a cobertura da carta **ainda precisam ser conferidas com o GeoPDF real e GPS físico de precisão conhecida**. Testes sintéticos não comprovam alinhamento milimétrico. Offline/IndexedDB/Blob e georreferências salvas permanecem intocados.

### Conferência com a carta real de Araguaína (2026-10-13)

- PDF original disponibilizado somente para análise local (16.634.115 bytes, 1 página, gerado em QGIS 3.40.4). **Não incluído no repositório.**
- Metadados: viewport `/BBox [16.1558, 21.4360, 1672.1258, 1178.8802]`; `/GPTS` em graus de latitude/longitude, apesar de `/GCS` declarar EPSG:3857. `reconcileIsoCrs` já reconhece essa inconsistência na implementação existente.
- Extensão calculada com transformação afim: oeste -48.230591°, leste -48.208367°, norte -7.194191°, sul -7.209602°; área aproximada 2,45 km × 1,70 km, **não abrange a cidade inteira**.
- O controle GPS nativo do MapLibre informa posição com incerteza fornecida pelo navegador; a etapa A73 o ocultou temporariamente no GeoPDF. A etapa A74 restaura o botão e informa a precisão, sem alterar o georreferenciamento da carta.
- Não é possível provar a localização física do dispositivo a partir da captura: apenas o sistema operacional do usuário fornece posição/precisão. Sem GPS físico, não declarar alinhamento métrico absoluto.

## A74 — GeoPDF sobre mapa-base e GPS visível (reversão da regressão)

- **Causa**: a abertura do PDF forçava `createFallbackStyle()` mesmo conectado. Isso ocultava ruas/cidades ao redor. A correção A73 também executava `map.removeControl(geolocate)`, removendo o botão nativo no canto direito. O botão da barra inferior permanecia, mas recusava mostrar a posição se a precisão fosse >100 m ou se estivesse fora do recorte.
- **Novo comportamento**: com conexão, renderizar o GeoPDF como imagem georreferenciada sobre o estilo-padrão OpenFreeMap; o botão nativo de localização permanece visível e acionável, independentemente de a posição estar dentro do recorte da carta. Exibir precisão reportada pelo dispositivo e aviso de posição fora/imprecisa, sem deslocar o raster.
- Sem conexão e sem pacote de ruas previamente disponível, o GeoPDF continua visível no fundo neutro — **não inventar mapa-base offline**. Offline-first, integridade do PDF e IndexedDB/outbox mantidos. No mapa base remoto indisponível, o lifecycle mantém o GeoPDF e os dados locais.
- QA: verificar a chamada ao estilo online com o PDF aberto; botão `.maplibregl-ctrl-geolocate` visível e clicável; GPS dentro/fora da carta; não afetar visualização fora do PDF; teste real Windows/Android ainda necessário.

## A75 — Referência aprovada no Android e iOS: não alterar GeoPDF/GPS

**Teste físico informado pelo responsável em 2026-10-15:** o GeoPDF encaixa corretamente no mapa-base e a localização GPS é exibida sobre a carta nos dois sistemas. Comportamento protegido: só pode mudar mediante autorização específica e QA de regressão.

- Não deslocar os quatro cantos calculados por `georeferencedRasterWindow` / `pageToLonLat` nem modificar calibração, CRS, corte, raster e sobreposição.
- Preservar mapa-base ao redor do raster, botões de GPS nativo e "Minha localização", precisão do sensor, enquadramento, pan/zoom, operação offline e IndexedDB/outbox.
- CODEOWNERS e `scripts/gis-gps-guard.test.mjs` sinalizam alterações em CI; `apps/admin/e2e/gps-geopdf-alignment.spec.ts` cobre os caminhos Android/iOS simulados. **O teste físico foi realizado pelo usuário, não executado pelo agente neste PR.**
