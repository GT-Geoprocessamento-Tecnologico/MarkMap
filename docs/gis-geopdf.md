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

O repositório possui módulos para:

- metadata;
- OGC/LGIDict;
- ISO measure;
- transformações;
- registro de CRS;
- testes de viabilidade e GeoPDF real.

O frontend utiliza PDF.js localmente para preview/processamento.

## Estado

**FUNCIONA:** leitura de GeoPDF com georreferenciamento válido e reprojeção suportada.

**PARCIAL:** validação física com PDFs grandes ainda depende de aparelho real.

**NÃO IMPLEMENTADO:** calibração automática robusta de PDF sem georreferenciamento válido. O fallback manual deve ser preservado quando essa funcionalidade for adicionada.
