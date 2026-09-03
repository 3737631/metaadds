import type { StoreAnalysis } from "./types";

export function buildStoreAnalysisSystemPrompt(): string {
  return `Eres un analista de tiendas online experto en conversión y ecommerce.
Recibes el HTML de una tienda (puede estar parcialmente limpio). Debes extraer una tarea de análisis estructurada y objetiva.

Devuelve SOLO JSON válido con esta forma EXACTA:
{
  "brand": { "logoUrl": string|null, "colors": string[], "fontFamily": string|null, "style": string },
  "home": {
    "hero": string|null,
    "benefits": string[],
    "socialProof": boolean,
    "productCount": number|null,
    "hasFaq": boolean,
    "hasCta": boolean,
    "sections": [ { "type": string, "heading": string|null, "notes": string } ]
  },
  "product": {
    "title": string|null, "price": number|null, "currency": string, "offer": string|null,
    "variantsCount": number|null, "description": string|null, "hasReviews": boolean,
    "guarantee": string|null, "cta": string|null
  },
  "conversion": {
    "offerClarity": number, "socialProofScore": number, "trustScore": number,
    "ctaClarity": number, "structureScore": number, "urgency": boolean,
    "valueProp": string|null, "strengths": string[], "weaknesses": string[]
  },
  "rawExcerpt": string
}
Los scores son de 0 a 100. No inventes datos que no estén presentes: usa null para lo desconocido.`;
}

export function buildStoreAnalysisUserPrompt(html: string, url: string, domain: string, snippet: string): string {
  const safe = html.slice(0, 14000);
  return `Analiza esta tienda online.
URL: ${url}
DOMINIO: ${domain}
SNIPPET: ${snippet || "—"}

HTML (limitado a los primeros 14000 caracteres):
${safe}`;
}

export function buildStoreGenerateSystemPrompt(): string {
  return `Eres un diseñador y estratega de tiendas Shopify de alto nivel.
Recibes el análisis de una tienda de referencia y los datos de un producto.
Debes generar la estructura de una tienda ORIGINAL que imite el estilo, la jerarquía, los colores y la estrategia de conversión de la tienda de referencia, pero con copy, marca y detalles NUEVOS y mejores.

El tema generado debe;
- Ser ORIGINAL: NUNCA copiar logos, textos exactos ni branding de la fuente.
- Usar el nombre de marca que se indique (o generar uno nuevo).
- Mejorar pequeños detalles de la referencia.
- Contener secciones coherentes (hero, beneficios, producto destacado, testimonios, faq, cta, newsletter).

Devuelve SOLO JSON válido con esta forma EXACTA:
{
  "name": string,
  "brandName": string,
  "tagline": string,
  "primaryColor": string,
  "secondaryColor": string,
  "backgroundColor": string,
  "textColor": string,
  "accentColor": string,
  "fontFamily": string,
  "header": { "logoText": string, "menu": string[] },
  "hero": { "headline": string, "subheadline": string, "ctaLabel": string, "ctaHref": string, "showImage": boolean },
  "homeSections": [ { "type": string, "heading": string, "text": string, "ctaLabel"?: string, "ctaHref"?: string, "imageUrl"?: string, "items"?: [{ "title": string, "text": string }] } ],
  "product": { "title": string, "price": number, "compareAtPrice": number|null, "description": string, "benefits": string[], "ctaLabel": string, "badge": string|null, "currency": string },
  "footer": { "about": string, "links": [{ "text": string, "href": string }], "newsletter": boolean }
}
Los colores deben ser HEX (#RRGGBB). El texto en el idioma que se indique (español por defecto).`;
}

export function buildStoreGenerateUserPrompt(
  analysis: StoreAnalysis | null,
  productName: string,
  brandName: string,
  preferences: string
): string {
  const parts: string[] = [];
  if (analysis) {
    parts.push(`ANÁLISIS DE REFERENCIA:
${JSON.stringify(
  {
    title: analysis.title,
    brand: analysis.brand,
    homeSections: analysis.home.sections.map((s) => ({ type: s.type, heading: s.heading })),
    conversion: analysis.conversion.strengths,
    valueProp: analysis.conversion.valueProp,
  },
  null,
  2
)}`);
  }
  parts.push(`PRODUCTO: ${productName || "Producto genérico de la tienda"}`);
  if (brandName) parts.push(`MARCA PERSONAL: ${brandName}`);
  if (preferences) parts.push(`PREFERENCIAS DEL USUARIO: ${preferences}`);

  return parts.join("\n\n") + "\n\nGenera la tienda original basada en lo anterior.";
}

export function buildStoreEditSystemPrompt(): string {
  return `Eres el asistente de edición de una tienda Shopify.
Recibes el tema actual (JSON) y una instrucción de cambio en lenguaje natural.
Debes devolver SOLO el tema completo actualizado (la estructura JSON completa, sin omitir nada), aplicando únicamente los cambios solicitados.
No cambies nada que no esté relacionado con la instrucción. Mantén el mismo formato JSON.`;
}

export function buildStoreEditUserPrompt(theme: unknown, instruction: string): string {
  return `INSTRUCCIÓN DEL USUARIO: ${instruction}

TEMA ACTUAL (JSON):
${JSON.stringify(theme, null, 2)}

Devuelve el tema completo actualizado.`;
}
