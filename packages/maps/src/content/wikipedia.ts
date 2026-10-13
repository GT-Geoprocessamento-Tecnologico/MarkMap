import type { WikipediaArticle } from "@geonexo/contracts";

export class WikipediaStore {
  private articles = new Map<string, WikipediaArticle>();
  private byOsmId = new Map<string, string>();
  private byWikidataId = new Map<string, string>();

  load(articles: WikipediaArticle[]): void {
    this.articles.clear();
    this.byOsmId.clear();
    this.byWikidataId.clear();
    for (const article of articles) {
      this.articles.set(article.id, article);
      if (article.osmId) this.byOsmId.set(article.osmId, article.id);
      if (article.wikidataId) this.byWikidataId.set(article.wikidataId, article.id);
    }
  }

  getByOsmId(osmId: string): WikipediaArticle | undefined {
    const id = this.byOsmId.get(osmId);
    return id ? this.articles.get(id) : undefined;
  }

  getByWikidataId(wikidataId: string): WikipediaArticle | undefined {
    const id = this.byWikidataId.get(wikidataId);
    return id ? this.articles.get(id) : undefined;
  }

  search(query: string, limit = 10): WikipediaArticle[] {
    const q = query.trim().toLocaleLowerCase('pt-BR');
    if (q.length < 2 || !Number.isSafeInteger(limit) || limit < 1) return [];
    limit = Math.min(50, limit);
    const results: WikipediaArticle[] = [];
    for (const article of this.articles.values()) {
      if (article.title.toLowerCase().includes(q)) {
        results.push(article);
        if (results.length >= limit) break;
      }
    }
    return results;
  }

  get count(): number {
    return this.articles.size;
  }
}

/**
 * Conservative HTML sanitizer: removes dangerous elements and ALL attributes.
 * Any article provided through regional packages is displayed as text by the UI.
 * Use this only for legacy content that explicitly expects inline formatting.
 */
export function sanitizeWikipediaHtml(html: string): string {
  if (typeof html !== 'string') return '';
  const allowed = new Set(['p', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'br', 'h2', 'h3', 'h4']);
  const withoutActive = html
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<(script|style|iframe|object|svg|math|template|form|textarea)\b[^>]*>[^]*?<\/\1\s*>/gi, '');
  const chunks = withoutActive.match(/<[^>]*>|[^<]+|</g) ?? [];
  return chunks.map(part => {
    const tag = /^<\s*(\/?)\s*([a-z][a-z0-9]*)\b[^>]*>$/i.exec(part);
    if (tag) {
      const name = tag[2]!.toLowerCase();
      return allowed.has(name) ? `<${tag[1] ? '/' : ''}${name}>` : '';
    }
    if (part.startsWith('<')) return '&lt;';
    return part.replace(/&/g, '&amp;').replace(/>/g, '&gt;');
  }).join('');
}
