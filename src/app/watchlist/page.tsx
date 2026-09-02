"use client";

import { useEffect, useState } from "react";
import { Bookmark, PackageSearch } from "lucide-react";
import { getPipelineData, LocalWatchlist } from "@/lib/repository";
import { PageHeader } from "@/components/ui";
import ProductCard from "@/components/product-card";
import type { PipelineResult } from "@/lib/repository";

export default function WatchlistPage() {
  const [data, setData] = useState<PipelineResult | null>(null);
  const [watchIds, setWatchIds] = useState<string[]>([]);

  useEffect(() => {
    getPipelineData().then(setData);
    setWatchIds(new LocalWatchlist().read().productIds);
  }, []);

  const watched = (data?.scored ?? []).filter((s) => watchIds.includes(s.product.id));

  return (
    <div className="pb-16">
      <PageHeader
        title="Watchlist"
        subtitle="Products you are tracking. Saved locally in your browser."
      />

      {data && watched.length === 0 ? (
        <div className="mt-16 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface p-12 text-center">
          <PackageSearch className="h-10 w-10 text-faint" />
          <h3 className="mt-4 text-base font-semibold text-text">Your watchlist is empty</h3>
          <p className="mt-1 max-w-sm text-sm text-dim">
            Bookmark any product from Discover or Winners to keep it here for quick monitoring.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {watched.map((p) => (
            <ProductCard key={p.product.id} item={p} />
          ))}
        </div>
      )}
    </div>
  );
}
