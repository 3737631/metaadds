"use client";

import Link from "next/link";
import { Users, Megaphone, Globe2, Images } from "lucide-react";
import type { ScoredProduct } from "@/lib/types";
import { CategoryBadge, SaturationBadge } from "@/components/badges";
import ScoreRing from "@/components/score-ring";
import WatchlistToggle from "@/components/watchlist-toggle";
import { toneClasses, categoryTone } from "@/lib/ui";

export default function ProductCard({ item }: { item: ScoredProduct }) {
  const { product, score, advertisers, adCount, activeAds, marketCount, creativeCount } = item;
  const tone = toneClasses[categoryTone(score.category)];
  const cover = product.imageUrls[0] ?? null;

  return (
    <Link
      href={`/products/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint">
            <Images className="h-8 w-8" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <CategoryBadge category={score.category} />
        </div>
        <div className="absolute bottom-2 right-2">
          <ScoreRing value={score.winnerScore} size={44} stroke={4} color="#38c3f0" />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="text-sm font-semibold leading-snug text-text">
          {product.name}
        </div>
        <div className="mt-0.5 text-xs text-faint">{product.category}</div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SaturationBadge level={score.saturationLevel} />
          <span className={"text-[11px] font-medium " + tone.text}>
            {score.confidence}% conf
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[11px] text-dim">
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-faint" />
            {advertisers.length} advertisers
          </div>
          <div className="flex items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5 text-faint" />
            {activeAds}/{adCount} active ads
          </div>
          <div className="flex items-center gap-1.5">
            <Globe2 className="h-3.5 w-3.5 text-faint" />
            {marketCount} markets
          </div>
          <div className="flex items-center gap-1.5">
            <Images className="h-3.5 w-3.5 text-faint" />
            {creativeCount} creatives
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-faint">Since {product.firstSeen}</span>
          <div onClick={(e) => e.preventDefault()} aria-hidden>
            <WatchlistToggle productId={product.id} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export function ProductRow({ item }: { item: ScoredProduct }) {
  const { product, score, advertisers, adCount, activeAds, marketCount } = item;
  const tone = toneClasses[categoryTone(score.category)];
  return (
    <Link
      href={`/products/${product.id}`}
      className="grid grid-cols-12 items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-border-strong"
    >
      <div className="col-span-5 min-w-0">
        <div className="truncate text-sm font-semibold text-text">{product.name}</div>
        <div className="truncate text-xs text-faint">{product.category}</div>
      </div>
      <div className="col-span-2"><CategoryBadge category={score.category} /></div>
      <div className="col-span-1 text-center">
        <span className={"text-sm font-semibold " + tone.text}>{score.winnerScore}</span>
      </div>
      <div className="col-span-1 text-center text-xs text-dim">{advertisers.length}</div>
      <div className="col-span-1 text-center text-xs text-dim">{activeAds}/{adCount}</div>
      <div className="col-span-1 text-center text-xs text-dim">{marketCount}</div>
      <div className="col-span-1 text-right">
        <div onClick={(e) => e.preventDefault()} aria-hidden>
          <WatchlistToggle productId={product.id} />
        </div>
      </div>
    </Link>
  );
}
