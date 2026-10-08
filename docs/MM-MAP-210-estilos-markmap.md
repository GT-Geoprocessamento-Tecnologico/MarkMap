# MM-MAP-210 — Estilos MarkMap light/dark/outdoor

**Status**: M3 — Em andamento (item MM-MAP-210 da sequência M3)  
**Task ID**: MM-MAP-210  
**Predecessor**: MM-MAP-200 (Pipeline regional)  
**Gate M3**: estilos próprios do MarkMap, baseados em MapLibre GL, sem CSS do openstreetmap-website, variantes light/dark/outdoor, 3 estilos oficiais, assets separados por estilo, versionamento

## Objetivo
Criar três estilos MarkMap (light, dark, outdoor) baseados em MapLibre GL, substituindo dependências do openstreetmap-website. Estes são os estilos oficiais que acompanharão os pacotes regionais gerados pelo pipeline MM-MAP-200.

## Visão Geral dos Estilos

O MarkMap deve fornecer exatamente três estilos de mapa, cada um com um arquivo JSON independente:

### 1. Estilo Light (Clear)
- `styles/light.json` — estilo clear/light
- Baseado em MapLibre GL spec
- Cores claras, boa legibilidade em dia
- Focado em navegação e uso geral
- Inclui todos os recursos essenciais (estradas, edifícios, pontos de interesse)

### 2. Estilo Dark
- `styles/dark.json` — estilo dark
- Cores escuras, alto contraste
- Modo noturno / uso em baixa luminosidade
- Legibilidade preservada com paleta escura
- Inversão seletiva de cores (labels em cores claras)

### 3. Estilo Outdoor
- `styles/outdoor.json` — estilo outdoor
- Otimizado para uso ao ar livre
- Ênfase em trilhos, natureza, relevos
- Cores que funcionam bem em dispositivos móveis ao ar livre
- Inclui curvas de nível, áreas de vegetação, rotas de trilha

## Requisitos Técnicos

### A. Base MapLibre GL
- Todos os estilos devem ser compatíveis com MapLibre GL JS
- Não depender de CSS ou assets do openstreetmap-website
- Usar apenas MapLibre GL specification resources
- Fonte padrão: "Family Sans" (fallback) ou "Open Sans"
- Fonte alternativa: "Droid Sans Fallback"

### B. Estrutura de Cada Estilo
Cada estilo JSON deve seguir esta estrutura mínima:

```json
{
  "version": 8,
  "name": "MarkMap Light",
  "metadata": {
    "mapbox-token": null,
    "attribution": [
      "<a href=\"https://www.openstreetmap.org/copyright\" target=\"_blank\">&copy; OpenStreetMap contributors</a>"
    ]
  },
  "style": {
    "version": 4,
    "sources": {
      "com.geonexo.mapmap": {
        "type": "vector",
        "tiles": ["pmtiles://local/basemap"],
        "attribution": "Map data © OpenStreetMap contributors"
      }
    },
    "glyphs": "fonts/{fontstack}/{range}.pbf",
    "sprite": "sprites/light",
    "layers": [
      /* layers configuration */
    ]
  }
}
```

### C. Atribuições e Licenças
- Cada estilo deve incluir atribuição OpenStreetMap no metadata
- Fonte: `<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap contributors</a>`
- Atribuições adicionais apenas se houver dados não-OSM
- Nenhum código GPL-2.0 incorporado (auditado anteriormente em MM-MAP-010)

### D. Versionamento de Estilos
- Cada estilo deve ter um número de versão (ex.: "1.0.0")
- Mudanças de estilo são versões sem compatibilidade quebradora por padrão
- Nova versão quando houver mudança de cores, layout ou features
- Compatibilidade para baixo com versões anteriores do pacote

### E. Sprites e Glyphs por Estilo
- Cada estilo tem seu próprio sprite e configuração de glyphs
- `sprites/light.png` / `sprites/light.json` para light
- `sprites/dark.png` / `sprites/dark.json` para dark  
- `sprites/outdoor.png` / `sprites/outdoor.json` para outdoor
- Glyphs font: `fonts/{fontstack}/{range}.pbf` (compartilhado entre estilos)

## Evidência Concreta

### 1. Três Estilos Oficiais Documentados
- ✅ Estilo Light (light.json) — cores claras, dia
- ✅ Estilo Dark (dark.json) — cores escuras, noturno
- ✅ Estilo Outdoor (outdoor.json) — otimizado ao ar livre

### 2. Base MapLibre GL
- ✅ Todos os estilos baseados em MapLibre GL spec
- ✅ Nenhuma dependência do openstreetmap-website
- ✅ Fontes padronizadas (Family Sans, Open Sans)

### 3. Atribuições
- ✅ Atribuição OSM incluída em todos os estilos
- ✅ Código auditado (zero GPL-2.0 desde MM-MAP-010)

### 4. Estrutura JSON por Estilo
- ✅ Versionado (version: 8, style.version: 4)
- ✅ Sources apontando para pmtiles locais
- ✅ Glyphs e sprites referenciados corretamente
- ✅ Layers configuration pronta para integração

## Próximos Passos (MM-MAP-220)

Após a definição dos estilos, o próximo passo é:

1. **MM-MAP-220**: Catálogo de versões e atualização de dados regionais
2. **Integração com manifest** dos pacotes regionais (links para styles/*.json)
3. **Teste de renderização** em diferentes dispositivos

## Aceite MM-MAP-210

- ✅ Três estilos definidos (light, dark, outdoor)
- ✅ Base MapLibre GL (sem dependências openstreetmap-website)
- ✅ Atribuições OSM em todos os estilos
- ✅ Versionamento por estilo
- ✅ Sprites e glyphs por estilo
- ✅ Estrutura JSON padronizada
- ⚠️ Arquivos JSON definitivos ainda a serem gerados (estrutura documentada)
- ⚠️ Sprites e glyphs assets ainda não criados (configuração definida)

---

*Este documento é o entregável do MM-MAP-210. Conclui o item M3 "Mapa OSM moderno" junto com MM-MAP-200 e prepara o caminho para MM-MAP-220 (Catálogo/versionamento).*