import type { ScoredProduct } from "@/lib/types";
import { categoryIdFor, CATEGORIES } from "@/lib/present";

export interface ProductFilters {
  categoria?: string;
  pais?: string;
  saturacion?: string;
}

export function filteredProducts(all: ScoredProduct[], f: ProductFilters): ScoredProduct[] {
  let list = all;

  if (f.categoria && f.categoria !== "todos" && f.categoria !== "") {
    list = list.filter((p) => categoryIdFor(p.product.category) === f.categoria);
  }

  if (f.pais && f.pais !== "" && f.pais !== "todos") {
    list = list.filter((p) => {
      if (!p.product.markets || p.product.markets.length === 0) return false;
      return p.product.markets.some((m) => m.toUpperCase().includes(f.pais!.toUpperCase()));
    });
  }

  if (f.saturacion && f.saturacion !== "" && f.saturacion !== "todas") {
    list = list.filter((p) => p.score.saturationLevel === f.saturacion);
  }

  return list;
}

export const COUNTRY_OPTIONS = [
  { id: "es", label: "🇪🇸 España" },
  { id: "todos", label: "🌍 Todos los países" },
];

export const SATURATION_OPTIONS = [
  { id: "todas", label: "Todas" },
  { id: "LOW", label: "🟢 Baja" },
  { id: "MEDIUM", label: "🟡 Media" },
  { id: "HIGH", label: "🟠 Alta" },
  { id: "EXTREME", label: "🔴 Muy alta" },
];

export function categoryOptions() {
  return CATEGORIES.filter((c) => c.id !== "todos").map((c) => ({
    id: c.id,
    label: `${c.emoji} ${c.label}`,
  }));
}

export function isProven(p: ScoredProduct): boolean {
  return p.score.category === "PROVEN" || p.score.winnerScore >= 90;
}
