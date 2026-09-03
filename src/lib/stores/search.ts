import { getAIService } from "@/lib/ai/providers/ai-service";
import type { StoreCandidate } from "./types";
import { safeFetchHtml, detectShopify, extractTitle } from "./safe-fetch";

type RawEntry = { name: string; url: string; snippet: string; category: string };

function extractList(raw: string): RawEntry[] | null {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  const arr = cleaned.match(/\[[\s\S]*\]/);
  if (arr) {
    const slice = cleaned.slice(cleaned.indexOf("["), cleaned.lastIndexOf("]") + 1);
    try {
      const v = JSON.parse(slice);
      if (Array.isArray(v)) return v as RawEntry[];
    } catch {
      /* intenta con objeto envoltorio */
    }
  }
  const obj = cleaned.match(/\{[\s\S]*\}/);
  if (obj) {
    try {
      const v = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1));
      if (v && Array.isArray(v.stores)) return v.stores as RawEntry[];
      if (v && Array.isArray(v.results)) return v.results as RawEntry[];
    } catch {
      /* no parseable */
    }
  }
  return null;
}

function buildSearchPrompt(category: string, productName: string, productDescription: string, country: string): string {
  const niche = productName || `tiendas online de ${category}`;
  return `Actúa como un investigador de dropshipping/ecommerce.
Menciona hasta 12 tiendas online REALES y bien conocidas o fiables que vendan productos del nicho «${niche}» ${
    productName ? `(producto concreto: ${productName})` : ""
  }
${country ? `enfocadas o activas en el mercado ${country.toUpperCase()}.` : ""}

Para cada una devuelve: nombre de la tienda, la URL de su dominio principal (sin https:// obligatorio, pero con dominio real), y un snippet corto que diga qué venden.

Devuelve SOLO JSON con esta forma:
[ { "name": string, "url": string, "snippet": string, "category": "${category}" } ]

IMPORTANTE: solo incluye tiendas que tengas alta confianza de que existen. No inventes dominios.`;
}

export async function searchStores(opts: {
  category: string;
  productName?: string;
  productDescription?: string;
  country?: string;
}): Promise<{ candidates: StoreCandidate[]; note: string }> {
  const service = getAIService();
  if (!service.available) {
    return { candidates: [], note: "No hay proveedores de IA configurados." };
  }

  const prompt = buildSearchPrompt(
    opts.category,
    opts.productName ?? "",
    opts.productDescription ?? "",
    opts.country ?? "es"
  );

  let rawList: RawEntry[] = [];
  try {
    const result = await service.generate({
      systemPrompt:
        "Devuelves listas de tiendas reales. Solo respondes con JSON vǭlido, sin markdown ni texto extra.",
      userPrompt: prompt,
      responseFormat: "json",
      temperature: 0.4,
      maxTokens: 1200,
    });
    const parsed = extractList(result.content);
    if (parsed) rawList = parsed;
  } catch (err) {
    console.warn("[storeSearch] AI fall::", err);
    return { candidates: [], note: "No pudimos buscar tiendas en este momento." };
  }

  if (rawList.length === 0) {
    return { candidates: [], note: "La IA no devolvió una lista válida." };
  }

  if (!Array.isArray(rawList)) {
    return { candidates: [], note: "La IA no devolvió una lista válida." };
  }

  // Verificar cada dominio en vivo: solo se incluyen tiendas reales que cargan.
  const candidates: StoreCandidate[] = [];
  for (const item of rawList.slice(0, 12)) {
    if (!item.url) continue;
    let url = item.url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;

    const fetched = await safeFetchHtml(url);
    if (!fetched || !fetched.ok || !fetched.html) {
      // Sin verificación en vivo: descartar como "no verificada" en lugar de falsa
      continue;
    }

    const dom = new URL(fetched.finalUrl).hostname;
    candidates.push({
      id: dom.replace(/\W+/g, "-") + "-" + candidates.length,
      name: item.name || dom,
      url: "https://" + dom,
      domain: dom,
      category: item.category || opts.category,
      country: (opts.country ?? "es").toUpperCase(),
      similarity: 0,
      shopify: detectShopify(fetched.html),
      verified: true,
      title: extractTitle(fetched.html),
      snippet: item.snippet || "",
    });
  }

  return {
    candidates,
    note: candidates.length === 0 ? "No se encontraron tiendas verificables para ese nicho." : "",
  };
}
