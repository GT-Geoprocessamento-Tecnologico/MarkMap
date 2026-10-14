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
