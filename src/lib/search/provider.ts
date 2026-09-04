/**
 * Capa de búsqueda web real, independiente de la IA.
 * La IA solo genera consultas y clasifica resultados; nunca inventa URLs.
 */

export interface SearchResult {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

export type SearchProviderName = "serper" | "duckduckgo" | "none";

export interface SearchProvider {
  readonly name: SearchProviderName;
  search(query: string): Promise<SearchResult[]>;
}

export const SEARCH_PROVIDERS: Record<SearchProviderName, string> = {
  serper: "Serper (Google, requiere SEARCH_API_KEY)",
  duckduckgo: "DuckDuckGo (gratis, sin clave)",
  none: "ninguno",
};

export function isBlockedDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    const blocked = [
      "amazon.", "amzn.", "aliexpress", "temu.", "ebay.", "pinterest.",
      "tiktok.", "instagram.", "facebook.", "youtube.", "etsy.com",
      "walmart.com", "shein.com", "wish.com", "shopify.dev",
    ];
    if (host === "shopify.com") return true;
    for (const b of blocked) {
      if (host.includes(b)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function normalizeSearchUrl(url: string): string {
  let u = url.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    // Quitar parámetros de tracker/página de búsqueda típicos
    const allowed = ["utm_source", "utm_campaign", "utm_medium", "srsltid", "gclid", "ref", "sca_ref"];
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (!allowed.includes(key)) parsed.searchParams.delete(key);
    }
    const host = parsed.hostname.replace(/^www\./, "");
    return `https://${host}${parsed.pathname === "/" ? "" : parsed.pathname}`;
  } catch {
    return u;
  }
}
