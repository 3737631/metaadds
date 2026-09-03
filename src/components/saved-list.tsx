"use client";

import type { ScoredProduct } from "@/lib/types";
import ProductCard from "@/components/product-card";
import { useSavedIds } from "@/lib/watchlist-store";

export default function SavedList({ scored }: { scored: ScoredProduct[] }) {
  const ids = useSavedIds();
  const saved = scored.filter((p) => ids.includes(p.product.id));

  return (
    <div className="flex flex-col gap-4">
      {saved.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-dim">
          No tienes productos guardados todavía. Toca el ❤ en cualquier producto para guardarlo.
        </p>
      ) : (
        saved.map((p, i) => <ProductCard key={p.product.id} item={p} rank={i + 1} />)
      )}
    </div>
  );
}
