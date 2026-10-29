# Matriz Comparativa Atualizada: Avenza Maps vs. MarkMap Brasil (Pós-Fases 1, 2 e 3)

> **Data:** 2026-10-29
> **Escopo:** Comparativo definitivo entre as capacidades nativas do Avenza Maps e o estado atual do MarkMap Brasil após a implementação das frentes de agronegócio, CAR/SIGEF, geofencing, marketplace de dados e streaming de vetores.

---

## 1. Quadro Comparativo Direto

| Domínio Funcional / Técnico | Avenza Maps (Engine Nativa C++) | MarkMap Brasil (Atual / PWA + WASM) | Status de Paridade / Diferencial |
| :--- | :--- | :--- | :--- |
| **Arquitetura Base** | App nativo pesado (libpdfmaps.so $\ge$ 50MB) | PWA leve + Capacitor (offline-first via IndexedDB & PMTiles) | **Vantagem MarkMap:** Instalação instantânea, sem travas de lojas de apps. |
| **Renderização de Mapas Offline** | GeoPDF, GeoTIFF, MBTiles locais | PMTiles, GeoTIFF local (geotiff.js) e Tiles Vetoriais | **Paridade Alcançada** para visualização offline de alta performance. |
| **Leitura de Vetores Grandes** | Leitura direta via GDAL C++ (Shapefile/GPX/KMP) | **FlatGeobuf (FGB)** com streaming assíncrono e índice espacial Packed R-Tree | **Paridade Alcançada** (Fase 3): Suporte a datasets >100MB sem estouro de memória. |
| **Unidades de Medida Agrária** | Apenas Hectares e Acres padrão | **Alqueire Paulista (2,42 ha), Mineiro/Goiano (4,84 ha), Baiano (9,68 ha) e Norte (2,7225 ha)** | **Diferencial MarkMap (Fase 1):** Nativo para o agronegócio brasileiro. |
| **Conversão de Datums Históricos** | PROJ genérico | **SAD69 e Córrego Alegre $\rightarrow$ SIRGAS 2000** com parâmetros oficiais do IBGE | **Diferencial MarkMap (Fase 1):** Essencial para títulos de terras antigos. |
| **Gestão Territorial (CAR & INCRA)** | Não possui de forma nativa | **Parser CAR (APP, Reserva Legal) + Importador SIGEF (Vértices M, P, V)** | **Diferencial MarkMap (Fase 1):** Foco exclusivo na legislação brasileira. |
| **Geofencing e Alertas em Campo** | Básico (ponto em polígono) | **Boundary Guard com suporte a enclaves/furos, distância métrica e alerta $\le 50\text{m}$** | **Superação MarkMap (Fase 1):** Crítico para segurança em divisas rurais. |
| **Formulários de Campo & Compliance** | Formulários genéricos / atributos de feição | **Templates de Vistorias Ambientais (APP, Queimadas, Pragas) + Assistente Código Florestal** | **Superação MarkMap (Fase 2):** Automatiza laudos e auditoria ambiental. |
| **Catálogo de Dados Regionais** | Importação manual de arquivos avulsos | **Marketplace de Dados Oficiais + PMTiles de Satélite por Bioma (Cerrado, Amazônia, Mata Atlântica)** | **Diferencial MarkMap (Fase 2):** Acesso facilitado a bases oficiais offline. |

---

## 2. Conclusão da Análise

O **MarkMap Brasil** deixou de ser apenas um visualizador de mapas genérico e alcançou **paridade funcional e superação de nicho** frente ao Avenza Maps no ecossistema brasileiro:

1. **Onde o Avenza ainda lidera tecnicamente:** Capacidade de reabrir arquivos raster de formato proprietário e massivo via GDAL C++ puro sem adaptações de Web Workers.
2. **Onde o MarkMap Brasil supera o Avenza:** Inteligência regulatória e territorial nativa (CAR, SIGEF, Alqueires, Datums do IBGE, Compliance do Código Florestal, Geofencing com furos e Marketplace de Biomas).

O projeto atinge o objetivo de ser a ferramenta definitiva para engenheiros agrônomos, técnicos ambientais e produtores rurais no Brasil.
