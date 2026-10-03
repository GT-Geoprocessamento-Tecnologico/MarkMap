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
