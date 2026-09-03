import { getAIService } from "@/lib/ai/providers/ai-service";
import { buildStoreGenerateSystemPrompt, buildStoreGenerateUserPrompt, buildStoreEditSystemPrompt, buildStoreEditUserPrompt } from "./prompts";
import type { StoreAnalysis, StoreTheme } from "./types";

function repairJson(raw: string): unknown | null {
  let cleaned = raw.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  const a = cleaned.indexOf("{");
  const b = cleaned.lastIndexOf("}");
  if (a >= 0 && b > a) cleaned = cleaned.slice(a, b + 1);
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

const WRAPPER_KEYS = ["tienda", "theme", "store", "result", "data"];

/**
 * Algunos modelos envuelven el tema en una clave extra, p. ej.
 * { "tienda": { ...theme... } }. Si el objeto solo contiene una de esas
 * claves, usamos el valor interno para obtener el tema real.
 */
function unwrapTheme(raw: unknown): unknown {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    for (const key of WRAPPER_KEYS) {
      const inner = obj[key];
      if (inner && typeof inner === "object" && key in obj && Object.keys(obj).length === 1) {
        return inner;
      }
    }
  }
  return raw;
}

/**
 * Garantiza las secciones mínimas que el editor/preview necesita. Si la IA
 * omite o trunca alguna parte, usamos valores seguros en vez de romper la UI.
 */
function normalizeTheme(raw: unknown): StoreTheme {
  const t = (unwrapTheme(raw) ?? {}) as Record<string, unknown>;
  const hero = (t.hero ?? {}) as Record<string, unknown>;
  const header = (t.header ?? {}) as Record<string, unknown>;
  const product = (t.product ?? {}) as Record<string, unknown>;
  const footer = (t.footer ?? {}) as Record<string, unknown>;

  return {
    name: (t.name as string) ?? "Mi Tienda",
    brandName: (t.brandName as string) ?? (t.name as string) ?? "Mi Tienda",
    tagline: (t.tagline as string) ?? "",
    primaryColor: (t.primaryColor as string) ?? "#000000",
    secondaryColor: (t.secondaryColor as string) ?? "#ffffff",
    backgroundColor: (t.backgroundColor as string) ?? "#ffffff",
    textColor: (t.textColor as string) ?? "#111111",
    accentColor: (t.accentColor as string) ?? "#e11d48",
    fontFamily: (t.fontFamily as string) ?? "sans-serif",
    header: {
      logoText: (header.logoText as string) ?? (t.brandName as string) ?? "Mi Tienda",
      menu: Array.isArray(header.menu) ? (header.menu as string[]) : [],
    },
    hero: {
      headline: (hero.headline as string) ?? "",
      subheadline: (hero.subheadline as string) ?? "",
      ctaLabel: (hero.ctaLabel as string) ?? "Comprar ahora",
      ctaHref: (hero.ctaHref as string) ?? "#",
      showImage: typeof hero.showImage === "boolean" ? hero.showImage : false,
    },
    homeSections: Array.isArray(t.homeSections) ? (t.homeSections as StoreTheme["homeSections"]) : [],
    product: {
      title: (product.title as string) ?? "",
      price: typeof product.price === "number" ? product.price : 0,
      compareAtPrice:
        product.compareAtPrice === null || product.compareAtPrice === undefined ? null : (product.compareAtPrice as number),
      description: (product.description as string) ?? "",
      benefits: Array.isArray(product.benefits) ? (product.benefits as string[]) : [],
      ctaLabel: (product.ctaLabel as string) ?? "Añadir al carrito",
      badge: (product.badge as string) ?? null,
      currency: (product.currency as string) ?? "EUR",
    },
    footer: {
      about: (footer.about as string) ?? "",
      links: Array.isArray(footer.links) ? (footer.links as { text: string; href: string }[]) : [],
      newsletter: typeof footer.newsletter === "boolean" ? footer.newsletter : true,
    },
  };
}

export async function generateStoreTheme(opts: {
  url: string;
  analysis: StoreAnalysis | null;
  productName?: string;
  brandName?: string;
  preferences?: string;
}): Promise<StoreTheme | null> {
  const service = getAIService();
  if (!service.available) return null;

  const result = await service.generate({
    systemPrompt: buildStoreGenerateSystemPrompt(),
    userPrompt: buildStoreGenerateUserPrompt(opts.analysis, opts.productName ?? "", opts.brandName ?? "", opts.preferences ?? ""),
    responseFormat: "json",
    temperature: 0.7,
    maxTokens: 2000,
  });

  const json = repairJson(result.content);
  if (!json) return null;
  return normalizeTheme(json);
}

export async function editStoreTheme(opts: {
  theme: StoreTheme;
  instruction: string;
}): Promise<StoreTheme | null> {
  const service = getAIService();
  if (!service.available) return null;

  const result = await service.generate({
    systemPrompt: buildStoreEditSystemPrompt(),
    userPrompt: buildStoreEditUserPrompt(opts.theme, opts.instruction),
    responseFormat: "json",
    temperature: 0.5,
    maxTokens: 2200,
  });

  const json = repairJson(result.content);
  if (!json) return null;
  return normalizeTheme(json);
}
