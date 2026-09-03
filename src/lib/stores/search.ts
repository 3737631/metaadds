import type { SearchResult } from "@/lib/search/provider";
import { getSearchProvider, activeSearchProviderName, missingSearchKeys } from "@/lib/search";
import { isBlockedDomain, normalizeSearchUrl } from "@/lib/search/provider";
import type { StoreCandidate } from "./types";
import { safeFetchHtml, detectShopify, extractTitle } from "./safe-fetch";

/**
 * Buscador de tiendas REAL. Usa un proveedor de búsqueda web real
 * (Serper si hay SEARCH_API_KEY, si no DuckDuckGo) para obtener URLs que
 * existen de verdad, filtra marketplaces/blogs, deduplica por dominio y
 * verifica cada una en vivo. La IA NO inventa resultados.
 */

const BLOCK_TERMS = [
  "blog", "noticia", "artículo", "wiki", "reddit", "forum", "foro",
  "reviews", "comparativa", "ranking", "top 10", "mejores",
];

function looksLikeArticle(snippet: string, title: string): boolean {
  const s = `${title} ${snippet}`.toLowerCase();
  return BLOCK_TERMS.some((t) => s.includes(t));
}

function buildQueries(productName: string, category: string, country: string): string[] {
  const terms = productName || category;
  const market = country && country !== "es" ? ` ${country}` : "";
  // Pocas y buenas: priorizamos tiendas reales de Shopify (marcas premium).
  const suff = [" tienda online", " myshopify.com", " shop"];
  const queries: string[] = [];
  for (const s of suff) queries.push(`${terms}${s}${market}`);
  if (country && country === "es") queries.push(`${terms} tienda online en España ${market}`);
  return queries;
}

/** Puntuación observable (no ventas): coincidencia + señales de tienda premium. */
function scoreCandidate(
  result: SearchResult,
  productName: string,
  ecommerceSignals: number
): number {
  let score = 0;
  const text = `${result.title} ${result.snippet}`.toLowerCase();
  const terms = productName.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length > 0) {
    const hits = terms.filter((t) => text.includes(t)).length;
    score += (hits / terms.length) * 30;
  }
  score += Math.min(ecommerceSignals, 8) * 7; // hasta 56 por señales de tienda premium
  if (result.domain.endsWith(".com") || result.domain.endsWith(".es") || result.domain.endsWith(".co")) {
    score += 8;
  }
  return Math.min(Math.round(score), 95);
}

export async function searchStores(opts: {
  category: string;
  productName?: string;
  productDescription?: string;
  country?: string;
}): Promise<{ candidates: StoreCandidate[]; note: string; provider: string; missing?: string[] }> {
  const provider = getSearchProvider();
  const queries = buildQueries(opts.productName ?? "", opts.category, opts.country ?? "es");

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  // Ejecutar búsquedas reales de forma secuencial, tolerando errores aislados.
  let searchErrors = 0;
  for (const q of queries) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
        const res = await provider.search(q);
        for (const r of res) {
          if (isBlockedDomain(r.url)) continue;
          if (looksLikeArticle(r.snippet, r.title)) continue;
          const dom = r.domain;
          if (seen.has(dom)) continue;
          seen.add(dom);
          results.push(r);
        }
        break; // éxito: no reintentar
      } catch {
        if (attempt === 1) searchErrors++;
        else await new Promise((r) => setTimeout(r, 400));
      }
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  if (results.length === 0) {
    const isSerper = activeSearchProviderName() === "serper";
    const note =
      searchErrors === queries.length
        ? isSerper
          ? "No pudimos conectar con el buscador de Google (Serper) en este momento."
          : "El buscador gratuito (DuckDuckGo) no respondió ahora (suele limitar peticiones desde servidor). Configura SEARCH_API_KEY para una búsqueda fiable de Google."
        : "No hemos encontrado tiendas verificables para esta búsqueda.";
    return { candidates: [], note, provider: activeSearchProviderName(), missing: missingSearchKeys() };
  }

  // Verificar en vivo como mucho los 12 primeros candidatos (los demás por
  // relevancia). Verificar todos alargaría demasiado la respuesta.
  const toCheck = results.slice(0, 12);

  // Verificar cada dominio en vivo (en paralelo con límite de concurrencia).
  const candidates: StoreCandidate[] = [];
  const CHUNK = 6;
  for (let i = 0; i < toCheck.length; i += CHUNK) {
    const chunk = toCheck.slice(i, i + CHUNK);
    const checks = await Promise.all(
      chunk.map(async (r): Promise<StoreCandidate | null> => {
        try {
          const fetched = await safeFetchHtml(normalizeSearchUrl(r.url));
          if (!fetched || !fetched.ok || !fetched.html) return null;
          if (fetched.html.length < 500) return null; // página vacía
          const signals = ecommerceSignals(fetched.html);
          if (signals === 0) return null; // no parece tienda
          const platform = detectShopify(fetched.html) ? "shopify" : "unknown";
          const dom = new URL(fetched.finalUrl).hostname.replace(/^www\./, "");
          return {
            id: dom.replace(/\W+/g, "-"),
            name: r.title || dom,
            url: normalizeSearchUrl(fetched.finalUrl),
            domain: dom,
            category: opts.category,
            country: (opts.country ?? "es").toUpperCase(),
            similarity: 0,
            competitorScore: scoreCandidate(r, opts.productName ?? "", signals),
            shopify: platform === "shopify",
            platform,
            verified: true,
            title: extractTitle(fetched.html) || r.title,
            snippet: r.snippet || "",
          };
        } catch {
          return null;
        }
      })
    );
    for (const c of checks) if (c) candidates.push(c);
  }

  // Ranking por señales observables desc. Priorizamos tiendas reales de
  // Shopify (aspecto marcas 'premium', plantillas de Shopify) tal y como pidió
  // el usuario, y ponemos primero la que mejor pinta por señales.
  const shopify = candidates.filter((c) => c.shopify);
  const list = shopify.length > 0 ? shopify : candidates;
  list.sort((a, b) => (b.competitorScore ?? 0) - (a.competitorScore ?? 0));

  const note =
    list.length === 0
      ? "No hemos encontrado tiendas verificables para esta búsqueda."
      : shopify.length === 0
        ? "No se encontraron tiendas Shopify verificables; mostramos las mejores encontradas."
        : "";
  return { candidates: list.slice(0, 10), note, provider: activeSearchProviderName() };
}

/** Cuenta señales de ecommerce y 'aspecto premium' observables en el HTML. */
function ecommerceSignals(html: string): number {
  let n = 0;
  if (/<h[1-4][^>]*>(?:<[^>]+>)*\s*[A-Za-zÁÉÍÓÚÑáéíóúñ][^<]{2,}/i.test(html)) n++; // heading con texto
  if (/€|EUR|&euro;|\$|USD|price|precio/i.test(html)) n++;
  if (/add to cart|añadir al carrito|add_to_cart|cart|carrito/i.test(html)) n++;
  if (/cdn\.shopify\.com|\/cdn\/shop\/|shopify\.com|woocommerce|wordpress|prestashop|magento|shopify/i.test(html)) n++;
  if (/<nav|navbar|header/i.test(html)) n++;
  if (/menu|colección|producto|product|collection|shop|tienda/i.test(html)) n++;
  // Señales premium / tienda completa y trabajada:
  if (/<section|<main|role=["']main["']/i.test(html)) n++; // estructura semántica
  if (/(?:application\/ld\+json|"@type":\s*"Product"|itemscope itemtype="[^"]*Product")/i.test(html)) n++; // marcado de producto
  if (/<img[^>]+src=/i.test(html) && (html.match(/<img/g)?.length ?? 0) >= 6) n++; // muchas imágenes
  if (/social proof|reseñas|reviews|testimonios|opiniones del cliente/i.test(html)) n++; // prueba social
  if (/suscrip|newsletter|email/i.test(html)) n++; // captación de email
  if (/hotmart|tiktok|instagram|facebook|youtube/i.test(html)) n++; // presencia social
  return n;
}
