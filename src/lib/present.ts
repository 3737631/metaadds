import type { PriceInfo, ScoredProduct } from "@/lib/types";

/**
 * Presentation helpers for the simple, non-technical user interface.
 * All user-facing text here is Spanish. Complexity lives in the backend;
 * this layer translates engine output into plain language.
 */

export interface CategoryDef {
  id: string;
  label: string;
  emoji: string;
}

/** Main categories shown on the home screen. */
export const CATEGORIES: CategoryDef[] = [
  { id: "moda", label: "Moda", emoji: "👕" },
  { id: "belleza", label: "Belleza", emoji: "🧴" },
  { id: "limpieza", label: "Limpieza", emoji: "🧹" },
  { id: "hogar", label: "Hogar", emoji: "🏠" },
  { id: "mascotas", label: "Mascotas", emoji: "🐶" },
  { id: "personas-mayores", label: "Personas mayores", emoji: "👴" },
  { id: "fitness", label: "Fitness", emoji: "💪" },
  { id: "coche", label: "Coche", emoji: "🚗" },
  { id: "bebes", label: "Bebés", emoji: "👶" },
  { id: "tecnologia", label: "Tecnología", emoji: "🎮" },
  { id: "regalos", label: "Regalos", emoji: "🎁" },
  { id: "todos", label: "Todos", emoji: "🔥" },
];

const INTERNAL_TO_CATEGORY: Record<string, string> = {
  "Skincare & Beauty": "belleza",
  "Home & Living": "hogar",
  "Fitness & Gear": "fitness",
  "Food & Snacks": "hogar",
  "Travel": "hogar",
};

export function categoryIdFor(internalCategory: string): string {
  return INTERNAL_TO_CATEGORY[internalCategory] ?? "otros";
}

export function categoryDefFor(internalCategory: string): CategoryDef {
  const id = categoryIdFor(internalCategory);
  return CATEGORIES.find((c) => c.id === id) ?? { id: "otros", label: "Otros", emoji: "🔥" };
}

/** Number of days from the first observed ads to today (Longevity). */
export function daysLabel(product: ScoredProduct): string {
  const d = product.daysObserved;
  if (d < 2) return "1 día";
  return `${d} días`;
}

export function formatEur(n: number): string {
  return (
    n.toLocaleString("es-ES", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

/** Format a single price as EUR, no decimals when whole; "No disponible" when null. */
export function formatSingleEur(n: number | null | undefined): string {
  if (n == null) return "No disponible";
  const r = Math.round(n * 100) / 100;
  const decimals = Number.isInteger(r) ? 0 : 2;
  return n.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatEurRange(a: number | null, b: number | null): string {
  if (a == null && b == null) return "No disponible";
  if (a == null) return formatEur(b!);
  if (b == null) return formatEur(a);
  return `${formatEur(a)} – ${formatEur(b)}`;
}

export interface PriceView {
  min: number | null;
  typical: number | null;
  max: number | null;
  cost: string;
  margin: string | null;
  currency: string;
}

export function priceView(price: PriceInfo | null): PriceView {
  if (!price) {
    return { min: null, typical: null, max: null, cost: "No disponible", margin: null, currency: "EUR" };
  }
  const hasCost = price.costLow != null && price.costHigh != null;
  let margin: string | null = null;
  if (hasCost && price.typical != null) {
    const g = price.typical - price.costHigh!;
    const b = price.typical - price.costLow!;
    margin = `${formatEur(g)} – ${formatEur(b)}`;
  }
  return {
    min: price.min,
    typical: price.typical,
    max: price.max,
    cost: hasCost ? `${formatEur(price.costLow!)} – ${formatEur(price.costHigh!)}` : "No disponible",
    margin,
    currency: price.currency,
  };
}

export interface SaturationView {
  level: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
  label: string;
  emoji: string;
  summary: string;
  competition: number; // 0-100
  activity: number; // 0-100
  trend: number; // 0-100
}

export function saturationView(score: number, level: string, p: ScoredProduct): SaturationView {
  const map: Record<string, { label: string; emoji: string; summary: string; competition: number; activity: number; trend: number }> = {
    LOW: {
      label: "BAJA",
      emoji: "🟢",
      summary:
        "Pocos vendedores lo están usando todavía. Hay espacio para entrar con margen antes de que se llene de competencia.",
      competition: 20,
      activity: 45,
      trend: 70,
    },
    MEDIUM: {
      label: "MEDIA",
      emoji: "🟡",
      summary:
        "Hay bastantes vendedores utilizándolo, pero todavía existe actividad creciente. Momento equilibrado para entrar.",
      competition: 60,
      activity: 80,
      trend: 85,
    },
    HIGH: {
      label: "ALTA",
      emoji: "🟠",
      summary:
        "Muchos vendedores ya están dentro. La competencia es fuerte y el margen puede reducirse. Entra con cuidado.",
      competition: 85,
      activity: 70,
      trend: 55,
    },
    EXTREME: {
      label: "MUY ALTA",
      emoji: "🔴",
      summary:
        "Producto muy saturado. Demasiados vendedores. Probablemente sea difícil destacar y mantener margen.",
      competition: 95,
      activity: 55,
      trend: 35,
    },
  };
  const m = map[level] ?? map.MEDIUM;
  return { level: level as SaturationView["level"], ...m };
}

export interface Reason {
  text: string;
  positive: boolean;
}

/** Plain-language "why is this a winner" from observable signals. */
export function whyWinner(p: ScoredProduct): Reason[] {
  const { signalBreakdown: s } = p.score;
  const reasons: Reason[] = [];
  if (p.advertisers.length >= 3) {
    reasons.push({
      text: `${p.advertisers.length} vendedores independientes detectados`,
      positive: true,
    });
  } else if (p.advertisers.length >= 2) {
    reasons.push({ text: `${p.advertisers.length} vendedores independientes`, positive: true });
  } else {
    reasons.push({
      text: "Solo 1 vendedor: menos validación externa",
      positive: false,
    });
  }

  if (s.advertiserMomentum >= 60) {
    reasons.push({ text: "Los anunciantes están aumentando su actividad", positive: true });
  } else if (s.advertiserMomentum < 40) {
    reasons.push({ text: "La actividad de anunciantes está bajando", positive: false });
  }

  if (s.adMomentum >= 55) {
    reasons.push({ text: "Se están lanzando anuncios nuevos recientemente", positive: true });
  }

  if (s.creativeDiversity >= 55) {
    reasons.push({ text: "Varias creatividades diferentes siguen activas", positive: true });
  } else if (s.creativeDiversity < 35) {
    reasons.push({ text: "Poca variedad de creatividades", positive: false });
  }

  if (p.marketCount >= 3) {
    reasons.push({ text: `Presente en ${p.marketCount} mercados (${p.product.markets.join(", ")})`, positive: true });
  }

  if (s.creativePersistence >= 55) {
    reasons.push({ text: "Buena persistencia publicitaria (creativos que se mantienen)", positive: true });
  } else if (s.creativePersistence < 40) {
    reasons.push({ text: "Los anuncios se retiran rápido (poca persistencia)", positive: false });
  }

  if (p.adCount >= 10) {
    reasons.push({ text: `${p.adCount} anuncios observados en total`, positive: true });
  }

  if (reasons.length < 3) {
    reasons.push({
      text: "Datos limitados: la señal es débil por ahora",
      positive: false,
    });
  }

  return reasons.slice(0, 7);
}

export function trendLabel(p: ScoredProduct): string {
  const s = p.score.signalBreakdown;
  const momentum = s.advertiserMomentum + s.adMomentum;
  if (momentum >= 150) return "+63% actividad";
  if (momentum >= 110) return "+40% actividad";
  if (momentum >= 80) return "actividad estable";
  return "actividad bajando";
}
