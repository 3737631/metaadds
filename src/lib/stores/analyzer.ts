import { getAIService } from "@/lib/ai/providers/ai-service";
import { safeFetchHtml, extractTitle, detectShopify } from "./safe-fetch";
import { buildStoreAnalysisSystemPrompt, buildStoreAnalysisUserPrompt } from "./prompts";
import type { StoreAnalysis } from "./types";

/**
 * Puntuación de similitud (0-100) entre la tienda de referencia y el producto.
 * Es una estimación heurística, no una verdad matemática absoluta.
 */
export function calculateStoreSimilarity(opts: {
  title: string;
  snippet: string;
  category: string;
  productName: string;
  productDescription: string;
}): { score: number; reason: string } {
  const haystack = (opts.title + " " + opts.snippet).toLowerCase();
  const product = (opts.productName + " " + opts.productDescription).toLowerCase();
  const categoryWords = opts.category
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  let score = 5;
  const reasons: string[] = [];

  // Coincidencia por palabras del producto
  const productTokens = product.split(/\s+/).filter((w) => w.length > 3);
  let productHits = 0;
  for (const t of productTokens) {
    if (haystack.includes(t)) productHits++;
  }
  if (productTokens.length > 0) {
    const ratio = productHits / productTokens.length;
    score += ratio * 45;
    if (ratio > 0.3) reasons.push("Varias palabras del producto aparecen en la tienda");
  }

  // Coincidencia por categoría
  let catHits = 0;
  for (const w of categoryWords) if (haystack.includes(w)) catHits++;
  if (categoryWords.length > 0) {
    score += (catHits / categoryWords.length) * 25;
    if (catHits > 0) reasons.push("Comparte vocabulario de la categoría");
  }

  // Señales de tienda especializada
  if (opts.category && haystack && opts.category.toLowerCase().split(/\s+/).some((w: string) => w && haystack.includes(w))) {
    score += 15;
    reasons.push("Tienda centrada en el mismo nicho");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  if (reasons.length === 0) {
    reasons.push("Coincide con el nicho general del producto");
  }

  return {
    score,
    reason: `Similitud estimada por texto (${reasons[0]}). No es una medición exacta.`,
  };
}

/**
 * Análisis mínimo y honesto, construido únicamente a partir del HTML accesible
 * (sin inventar nada). Se devuelve cuando no hay IA disponible o ésta falla,
 * para que el usuario nunca reciba un error engañoso de "no pudimos acceder".
 */
function partialAnalysis(url: string, domain: string, title: string, html: string): StoreAnalysis {
  return {
    url,
    domain,
    shopify: detectShopify(html),
    title,
    description: null,
    brand: { logoUrl: null, colors: [], fontFamily: null, style: "—" },
    home: { hero: null, benefits: [], socialProof: false, productCount: null, hasFaq: false, hasCta: false, sections: [] },
    product: { title: null, price: null, currency: "EUR", offer: null, variantsCount: null, description: null, hasReviews: false, guarantee: null, cta: null },
    conversion: { offerClarity: 0, socialProofScore: 0, trustScore: 0, ctaClarity: 0, structureScore: 0, urgency: false, valueProp: null, strengths: [], weaknesses: [] },
    rawExcerpt: html.slice(0, 2000),
  };
}

export async function analyzeStore(url: string): Promise<StoreAnalysis | null> {
  const fetched = await safeFetchHtml(url);
  if (!fetched || !fetched.ok || !fetched.html) return null;

  const title = extractTitle(fetched.html);
  const snippet = "";
  const domain = fetched.finalHost;

  const service = getAIService();
  if (!service.available) {
    return partialAnalysis(fetched.finalUrl, domain, title, fetched.html);
  }

  try {
    const result = await service.generate({
      systemPrompt: buildStoreAnalysisSystemPrompt(),
      userPrompt: buildStoreAnalysisUserPrompt(fetched.html, fetched.finalUrl, domain, snippet),
      responseFormat: "json",
      temperature: 0.3,
      maxTokens: 1800,
    });

    const parsed = JSON.parse(result.content);
    return {
      url: fetched.finalUrl,
      domain,
      shopify: detectShopify(fetched.html),
      title: parsed.title ?? title,
      description: parsed.description ?? null,
      brand: parsed.brand ?? { logoUrl: null, colors: [], fontFamily: null, style: "—" },
      home: parsed.home ?? { hero: null, benefits: [], socialProof: false, productCount: null, hasFaq: false, hasCta: false, sections: [] },
      product: parsed.product ?? { title: null, price: null, currency: "EUR", offer: null, variantsCount: null, description: null, hasReviews: false, guarantee: null, cta: null },
      conversion: parsed.conversion ?? { offerClarity: 0, socialProofScore: 0, trustScore: 0, ctaClarity: 0, structureScore: 0, urgency: false, valueProp: null, strengths: [], weaknesses: [] },
      rawExcerpt: fetched.html.slice(0, 2000),
    };
  } catch (err) {
    console.warn("[storeAnalyze] AI falló, devolviendo análisis parcial honesto:", err);
    return partialAnalysis(fetched.finalUrl, domain, title, fetched.html);
  }
}
