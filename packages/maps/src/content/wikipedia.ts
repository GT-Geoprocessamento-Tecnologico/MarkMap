import type { WikipediaArticle } from "@geonexo/contracts";

export class WikipediaStore {
  private articles = new Map<string, WikipediaArticle>();
  private byOsmId = new Map<string, string>();
  private byWikidataId = new Map<string, string>();

  load(articles: WikipediaArticle[]): void {
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
    const q = query.toLowerCase();
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

export function sanitizeWikipediaHtml(html: string): string {
  const allowed = new Set(["p", "b", "i", "em", "strong", "a", "ul", "ol", "li", "br", "h2", "h3", "h4"]);
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript\s*:/gi, "")
    .replace(/<(\w+)[^>]*>/g, (match, tag) => {
      return allowed.has(tag.toLowerCase()) ? match : "";
    })
    .replace(/<\/(\w+)>/g, (match, tag) => {
      return allowed.has(tag.toLowerCase()) ? match : "";
    });
}
