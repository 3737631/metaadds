import type { SearchProvider, SearchResult, SearchProviderName } from "./provider";

/**
 * Búsqueda real mediante el HTML de DuckDuckGo (sin API key).
 * Funciona desde funciones serverless de Vercel.
 */
export class DuckDuckGoProvider implements SearchProvider {
  readonly name = "duckduckgo" as SearchProviderName;

  async search(query: string): Promise<SearchResult[]> {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(25000),
    });
    if (res.status !== 200) {
      // DuckDuckGo responde 202 cuando limita por ritmo/anti-bot desde un
      // servidor. Lo tratamos como error para que el llamador lo cuente.
      throw new Error(`DuckDuckGo no disponible (${res.status})`);
    }
    const html = await res.text();
    const out: SearchResult[] = [];
    // Clases típicas de resultados de DuckDuckGo HTML
    const reTitle = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const reSnippet = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

    const titles: Array<{ url: string; text: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = reTitle.exec(html)) !== null) {
      let href = m[1];
      // DDG redirige con uddg
      const uddg = href.match(/uddg=([^&]+)/);
      if (uddg) href = decodeURIComponent(uddg[1]);
      const text = m[2].replace(/<[^>]+>/g, "").trim();
      titles.push({ url: href, text });
    }
    const snippets: string[] = [];
    while ((m = reSnippet.exec(html)) !== null) {
      snippets.push(m[1].replace(/<[^>]+>/g, "").trim());
    }

    titles.forEach((t, i) => {
      if (!t.url || !/^https?:\/\//.test(t.url)) return;
      try {
        const u = new URL(t.url);
        if (out.some((o) => o.domain === u.hostname.replace(/^www\./, ""))) return;
        out.push({
          title: t.text || u.hostname,
          url: u.href,
          domain: u.hostname.replace(/^www\./, ""),
          snippet: snippets[i] ?? "",
        });
      } catch {
        /* ignorar */
      }
    });
    return out;
  }
}
