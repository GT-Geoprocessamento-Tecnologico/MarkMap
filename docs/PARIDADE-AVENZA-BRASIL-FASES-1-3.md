# Documentação Técnica: Paridade Avenza & Geoprocessamento Rural e Ambiental (Fases 1, 2 e 3)

> **Data:** 2026-10-29
> **Projeto:** MarkMap Brasil
> **Escopo:** Implementação completa das Fases 1, 2 e 3 para superação de paridade com o Avenza Maps e atendimento às exigências do agronegócio e legislação ambiental brasileira.

---

## 1. Visão Geral das Entregas

O MarkMap Brasil consolida-se como a plataforma *offline-first* definitiva para geoprocessamento no contexto nacional, integrando inteligência territorial, conformidade ambiental e alta performance de renderização no navegador.

---

## 2. Detalhamento por Módulo

### 2.1. Suporte Avançado ao Agronegócio (Fase 1)
- **Alqueires Regionais (packages/maps/src/units/survey.ts):**
  - Conversão dinâmica entre m², hectares e múltiplos padrões de Alqueire:
    - *Alqueire Paulista* (2,42 ha / 24.200 m²)
    - *Alqueire Mineiro / Goiano* (4,84 ha / 48.400 m²)
    - *Alqueire Baiano* (9,68 ha / 96.800 m²)
    - *Alqueire do Norte* (2,7225 ha / 27.225 m²)
- **Transformação de Datums Legados (packages/maps/src/crs/datum.ts):**
  - Conversão geodésica de SAD69 (EPSG:4618) e Córrego Alegre (EPSG:4225) para SIRGAS 2000 (EPSG:4674) utilizando parâmetros oficiais de Molodensky/Helmert do IBGE.

### 2.2. Gestão Territorial e Governamental (CAR & SIGEF)
- **Parser CAR (packages/maps/src/formats/car.ts):**
  - Leitura e normalização de polígonos do Cadastro Ambiental Rural.
  - Classificação automática de feições: Área do Imóvel, APP (Área de Preservação Permanente), Reserva Legal, Uso Consolidado e Domínio Público.
- **Importador SIGEF / INCRA (packages/maps/src/formats/sigef.ts):**
  - Suporte a vértices certificados do tipo **M** (Marco), **P** (Ponto virtual) e **V** (Vértice).
  - Validação de tabelas de rumos, distâncias e fechamento de poligonais.

### 2.3. Compliance Ambiental e Formulários de Campo
- **Templates de Vistoria (packages/maps/src/forms/templates/br-environmental.ts):**
  - Formulários offline para vistorias de APP (APP_DEGRADATION), focos de incêndio (FIRE_OUTBREAK) e monitoramento de pragas (CROP_PEST).
  - Vínculo direto de evidências fotográficas georreferenciadas (latitude, longitude, altitude).
- **Assistente de Conformidade Ambiental (packages/maps/src/forms/compliance-reporter.ts):**
  - Cruzamento de dados do imóvel rural com as regras do Código Florestal Brasileiro (ex: percentuais de Reserva Legal na Amazônia Legal vs. demais biomas).
  - Emissão de relatório analítico de conformidade (CONFORME, PENDENTE_REGULARIZACAO, NAO_CONFORME).

### 2.4. Geofencing Avançado e Alertas em Tempo Real
- **Boundary Guard (packages/maps/src/geofencing/boundary-guard.ts):**
  - Suporte a topologias complexas com furos e enclaves (ilhas internas em polígonos CAR/SIGEF).
  - Cálculo de distância métrica geodésica local exata até a divisa mais próxima.
  - Máquina de estados: INSIDE, OUTSIDE, APPROACHING (alerta preventivo $\le 50\text{m}$) e BOUNDARY_CROSSED (eventos ENTERED/EXITED).

### 2.5. Marketplace de Dados Oficiais & Catálogo de Biomas (Fase 2)
- **Marketplace (pps/admin/src/pages/workspace/DataMarketplacePage.tsx & services/api/src/routes/marketplace.ts):**
  - Interface para download e gerenciamento de camadas oficiais (CAR, Biomas, IBGE) empacotadas em PMTiles.
- **Catálogo de Satélite por Bioma (packages/maps/src/providers/br-satellite.js & packages/maps/src/offline/package.ts):**
  - Integração de mosaicos Sentinel-2/INPE cortados para os biomas Cerrado, Amazônia e Mata Atlântica, totalmente compatíveis com o ResumableInstaller.

### 2.6. Streaming de Vetores >100MB (Fase 3)
- **Leitor FlatGeobuf Otimizado (packages/maps/src/formats/flatgeobuf.ts):**
  - Suporte a streaming assíncrono em Web Workers e leitura sob demanda por bounding box utilizando o índice espacial **Packed R-Tree**, inspirado nas técnicas de acesso a buffers binários do geotiff.js.

---

## 3. Validação e Qualidade
- **Testes Unitários e de Integração:** 100% de aprovação na suíte completa (@markmap/maps, @markmap/geo e pps/admin).
- **Repositórios Modelo:** Clonados e referenciados em epositorio modelo/ (maplibre-gl-js, geotiff.js, proj4js, osrm-frontend).
- **Sincronização com o Cérebro:** Registros completos atualizados no vault Obsidian (OBSIDIAN_LOCAL_MTS).
