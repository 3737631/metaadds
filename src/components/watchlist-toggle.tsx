"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import { LocalWatchlist } from "@/lib/repository";

export default function WatchlistToggle({ productId }: { productId: string }) {
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    setWatched(new LocalWatchlist().isWatched(productId));
  }, [productId]);

  const onClick = () => {
    const store = new LocalWatchlist().toggle(productId);
    setWatched(store.productIds.includes(productId));
  };

  return (
    <button
      onClick={onClick}
      aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
      aria-pressed={watched}
      className={
        "flex h-9 w-9 items-center justify-center rounded-lg ring-1 transition-colors " +
        (watched
          ? "bg-accent/20 text-accent ring-accent/40"
          : "bg-surface text-dim ring-border hover:text-text hover:ring-border-strong")
      }
    >
      <Bookmark className={"h-4 w-4 " + (watched ? "fill-current" : "")} />
    </button>
  );
}
