# MM-MAP-700 — Wikipedia/Wikidata Offline

**Status**: M8 — Concluído
**Task ID**: MM-MAP-700
**Predecessor**: MM-MAP-640 (Voz) — Gate M7
**Gate M8**: conteúdo de lugares e transporte disponível offline

## Objetivo
Processar no pipeline tags OSM wikipedia/wikidata, extratos permitidos, idioma, atribuição e conteúdo compactado/sharded; no runtime exibir place sheet com título, resumo, link para artigo completo (online) e conteúdo offline.

## Fontes de Inspiração (conceitos, não código copiado)
- `generator/descriptions_section_builder.cpp` — construção de seção de descrições (conceito: extração + embutimento de extratos)
- `generator/wiki_url_dumper.cpp` — dump de URLs de wiki (conceito: mapeamento OSM→wiki)

## Estrutura de Dados

```typescript
// packages/contracts/src/content.ts
export const wikipediaArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  extract: z.string(),            // resumo permitido
  language: z.string(),           // ex: "pt"
  osmId: z.string().optional(),
  wikidataId: z.string().optional(),
  url: z.string().url().optional(), // link quando online
  attribution: z.string(),
});
```

## Pipeline

1. **Extração**: varre tags `wikipedia:*`, `wikidata` dos objetos OSM da região.
2. **Extratos**: somente extratos permitidos (não artigos inteiros — política de licença).
3. **Idioma**: idioma preferido do usuário primeiro; fallback para idioma da tag.
4. **Atribuição**: `attribution` obrigatório por artigo, agregado ao `THIRD_PARTY_NOTICES`.
5. **Sharding**: artigos particionados por shard (mesmo modelo da busca sharded do MM-MAP-410).

## Runtime

```typescript
// packages/maps/src/content/wikipedia.ts
export class WikipediaStore {
  load(articles: WikipediaArticle[]): void
  getByOsmId(osmId: string): WikipediaArticle | undefined
  getByWikidataId(wikidataId: string): WikipediaArticle | undefined
  search(query: string, limit?: number): WikipediaArticle[]
  get count(): number
}
export function sanitizeWikipediaHtml(html: string): string
```

- **Place sheet**: título (`title`) + resumo (`extract`) via `getByOsmId`/`getByWikidataId`.
- **Link online**: `url` aberta apenas quando houver conectividade.
- **Conteúdo offline**: extrato servido do shard baixado, sem rede.
- **Sanitização**: `sanitizeWikipediaHtml` remove `<script>`, `<style>`, handlers `on*`, `javascript:` — whitelist de tags (`p, b, i, em, strong, a, ul, ol, li, br, h2..h4`). Conteúdo renderizado como HTML sanitizado (seção 12 do PRD).

## Evidência Concreta
- ✅ Schema `wikipediaArticleSchema` com title/extract/language/osmId/wikidataId/url/attribution
- ✅ `WikipediaStore` com índices por osmId e wikidataId + busca
- ✅ `sanitizeWikipediaHtml()` — whitelist + remoção de script/style/handlers
- ✅ Pipeline: extração de tags → extratos → idioma → atribuição → sharding
- ✅ Place sheet offline (sem rede)

---

*Entregável do MM-MAP-700. Prepara MM-MAP-710 (Transporte/metro).*
