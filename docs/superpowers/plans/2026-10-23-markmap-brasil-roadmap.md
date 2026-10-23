# Plano de Implementação: MarkMap Brasil - Funcionalidades de Domínio Rural e Ambiental

> **Goal:** Transformar o MarkMap no aplicativo offline-first de referência no mercado brasileiro para geoprocessamento rural, agronomia, georreferenciamento e conformidade ambiental, mantendo sua arquitetura PWA leve, ágil e baseada em PMTiles/MapLibre.

---

## Fase 1: Suporte ao Agronegócio e Unidades Regionais Brasileiras

### Tarefa 1.1: Módulo de Conversão e Suporte Nativo a Alqueires

- **Arquivos:** `packages/maps/src/units/survey.ts`, `packages/maps/tests/units/survey.test.ts`
- **Funcionalidade:**
  - Adicionar suporte aos tipos de Alqueire:
    - `alqueire_paulista` (24.200 m² / 2,42 ha)
    - `alqueire_mineiro` / `alqueire_goiano` (48.400 m² / 4,84 ha)
    - `alqueire_baiano` (96.800 m² / 9,68 ha)
    - `alqueire_do_norte` (27.225 m² / 2,7225 ha)
  - Implementar cálculo dinâmico de conversão de área GeoJSON/Polígono em Hectares e no Alqueire regional configurado.

### Tarefa 1.2: Conversão de Datums Legados (SAD69 / Córrego Alegre → SIRGAS 2000)

- **Arquivos:** `packages/maps/src/crs/datum.ts`, `packages/maps/tests/crs/datum.test.ts`
- **Funcionalidade:**
  - Mapear parâmetros de transformação de Helmert / Molodensky para SAD69 (EPSG:4618) e Córrego Alegre (EPSG:4225) para SIRGAS 2000 (EPSG:4674).
  - Permitir a seleção de Datum de Origem durante a importação de Shapefiles ou KMLs antigos sem estragar o georreferenciamento.

---

## Fase 2: Integração com Dados Governamentais e Gestão Territorial Brasileira

### Tarefa 2.1: Parser e Leitor de Camadas do CAR (Cadastro Ambiental Rural)

- **Arquivos:** `packages/maps/src/formats/car.ts`, `packages/maps/tests/formats/car.test.ts`
- **Funcionalidade:**
  - Extração e identificação de geometrias de imóveis rurais (Área Imóvel, APP, Reserva Legal, Uso Restrito, Consolidação).
  - Normalização de atributos para exibição estilizada de conformidade ambiental (código do imóvel, status do cadastro).

### Tarefa 2.2: Suporte a Parcelas Certificadas pelo INCRA / SIGEF

- **Arquivos:** `packages/maps/src/formats/sigef.ts`, `packages/maps/tests/formats/sigef.test.ts`
- **Funcionalidade:**
  - Importador dedicado de parcelas georreferenciadas do SIGEF (Shapefile/GeoPackage).
  - Validação de vértices do tipo M (Marco), P (Ponto virtual) e V (Vértice).

---

## Fase 3: Formulários de Campo & Compliance Ambiental

### Tarefa 3.1: Templates de Formulários Ambientais e Agronômicos

- **Arquivos:** `packages/maps/src/forms/templates/br-environmental.ts`
- **Funcionalidade:**
  - Criar formulários pré-configurados para inspeção em campo:
    - Vistoria Ambiental (Preservação, APP, Sinais de degradação).
    - Ocorrência de Queimada / Foco de Incêndio.
    - Registro de Pragas em Lavoura.
  - Vínculo direto de fotos tiradas no dispositivo às coordenadas e ao polígono do imóvel.

---

## Fase 4: Geofencing Avançado e Catálogo de Mapas Regionais

### Tarefa 4.1: Alerta de Invasão/Desvio de Limite de Propriedade

- **Arquivos:** `packages/maps/src/geofencing/boundary-guard.ts`
- **Funcionalidade:**
  - Extensão do `GeofenceEngine` para monitoramento de travessia e proximidade dos limites do CAR/SIGEF.
  - Emissão de alerta sonoro/visual quando o operador se aproxima do limite cadastrado durante a demarcação de cercas ou plantio.

### Tarefa 4.2: Provedores e Pacotes Regionais de Imagens de Satélite (INPE / Sentinel)

- **Arquivos:** `packages/maps/src/providers/br-satellite.ts`
- **Funcionalidade:**
  - Indexação de tiles e suporte a downloads `.pmtiles` pré-cortados por biomas e regiões brasileiras (Cerrado, Amazônia, Mata Atlântica).
