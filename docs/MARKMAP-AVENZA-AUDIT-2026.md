# Auditoria de Competitividade: MarkMap vs. Avenza Maps (2026)

> **Data da Auditoria:** 23 de Outubro de 2026  
> **Escopo:** Comparativo exaustivo entre a arquitetura offline do **MarkMap** (`feat/maps-engine-v2-offline`) e o **Avenza Maps** (engine nativo `libpdfmaps.so` + React Native/Hermes).

---

## 1. Visão Geral Comparativa

| Domínio de Funcionalidade | Avenza Maps (Nativo C++ / GIS) | MarkMap (PWA / WebAssembly / TS) | Vantagem Atual | Status no MarkMap |
| :--- | :--- | :--- | :--- | :--- |
| **Leitura de Mapas Raster / PDFs** | C++ GDAL / PDFium (suporte completo a GeoPDF vetorial/raster ISO 32000) | Parser de metadados ISO 32000 + MapLibre Raster ImageSource | **Avenza** | Parcial (Parser implementado, renderização raster em andamento) |
| **Vetores Offline (.shp, .gpkg)** | GDAL/OGR OGRDataSource nativo altamente otimizado | Leitores parciais em TS (`shapefile.ts`, `geopackage.ts`) com limite de 25MB | **Avenza** | Em implementação (Fase 2) |
| **GNSS & Posicionamento** | Integração nativa com receptores NMEA via Bluetooth/Serial com RTK | Adaptadores Web Serial / Web Bluetooth e parser NMEA 0183 (`nmea.ts`) | **Empate Técnico** | Implementado (Fase 3) |
| **Sistemas de Projeção (CRS)** | Suporte completo a centenas de datums e projeções via PROJ | Projeções WGS84, Web Mercator, UTM e suporte a EPSG via stubs/helpers | **Avenza** | Parcial |
| **Unidades de Agrimensura** | Pés de agrimensura, correntes, varas, milhas náuticas, gon, mils | Módulos de conversão exatos implementados (`survey.ts`) | **Empate** | Implementado (Fase 4) |
| **Geofencing & Alertas** | Polígonos de alerta nativos com verificação contínua em background | Motor de geofencing offline com transições `ENTERED`/`EXITED` (`engine.ts`) | **Empate** | Implementado (Fase 4) |
| **Arquitetura & Execução** | Aplicativo nativo pesado (APK > 100MB, dependências binárias C++) | PWA leve, IndexedDB, PMTiles, sem dependências de app store | **MarkMap** (UX/Distribuição) | Consolidado |

---

## 2. Onde o Avenza Maps ainda está à frente (Lacunas a Fechar)

1. **Reprojeção Dinâmica em Tempo de Execução para Datums Locais Complexos:**
   * *Avenza:* Converte on-the-fly qualquer PDF georreferenciado em projeções locais obscuras (ex: SIRGAS 2000 UTM local, SAD69) usando o PROJ C++.
   * *MarkMap:* Depende de WGS84 / Web Mercator e conversões parciais UTM. Necessita integração completa do `proj4js` recém-baixado.
2. **Manipulação de Grandes Datasets Vetoriais (Shapefiles > 100MB):**
   * *Avenza:* Lê gigabytes de vetores via GDAL direto do disco sem carregar tudo na RAM.
   * *MarkMap:* Possui trava de segurança de 25MB para imports via zip para proteger a memória do navegador. Necessita streaming com chunks ou Web Worker com R-Tree index.
3. **Leitura Direta de Arquivos PDF/GeoPDF complexos com Múltiplas Camadas (OCG):**
   * *Avenza:* Extrai camadas opcionais do PDF (linhas de contorno, hidrografia, estradas) permitindo ligar/desligar individualmente.
   * *MarkMap:* Lê o BBox e metadados de calibração, mas ainda rasteriza a página como imagem única.

---

## 3. Plano de Ação Imediato para Liderança Tecnológica do MarkMap

- **Passo 1:** Integrar o `proj4js` recém-baixado para suportar qualquer código EPSG dinamicamente em `packages/maps/src/crs/`.
- **Passo 2:** Conectar o parser de PMTiles e vector tiles (`packages/maps/src/offline/package.ts`) com os vetores importados de `.gpkg` e `.shp`.
- **Passo 3:** Validar a suíte completa de testes unitários para garantir 100% de cobertura nos novos módulos implementados nas Fases 1 a 4.
