import type { SearchProvider, SearchResult, SearchProviderName } from "./provider";

/**
 * Búsqueda real mediante la API de Serper.dev (Google).
 * Requiere SEARCH_API_KEY en el entorno de servidor.
 */
export class SerperProvider implements SearchProvider {
  readonly name = "serper" as SearchProviderName;
  private readonly key: string;

  constructor(key: string) {
    this.key = key;
  }

  async search(query: string): Promise<SearchResult[]> {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": this.key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: query, num: 10, gl: "es", hl: "es" }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      throw new Error(`Serper error ${res.status}`);
    }
    const data = (await res.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };
    const out: SearchResult[] = [];
    for (const item of data.organic ?? []) {
      if (!item.link) continue;
      try {
        const url = new URL(item.link);
        out.push({
          title: item.title ?? "",
          url: url.href,
          domain: url.hostname.replace(/^www\./, ""),
          snippet: item.snippet ?? "",
        });
      } catch {
        /* ignorar URL inválida */
      }
    }
    return out;
  }
}
