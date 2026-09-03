import Link from "next/link";
import { Users, Megaphone, Clock, TrendingUp, Globe2, Images } from "lucide-react";
import type { ScoredProduct } from "@/lib/types";
import { saturationView, priceView, daysLabel, trendLabel } from "@/lib/present";
import SaveButton from "@/components/save-button";

/**
 * Tarjeta de producto del ranking, en lenguaje sencillo (español).
 * Muestra solo los datos útiles para decidir.
 */
export default function ProductCard({ item, rank }: { item: ScoredProduct; rank?: number }) {
  const { product, score, advertisers, adCount, marketCount } = item;
  const sat = saturationView(score.saturation, score.saturationLevel, item);
  const price = priceView(item.price);
  const cover = product.imageUrls[0] ?? null;
  const isProven = score.category === "PROVEN";

  return (
    <Link
      href={`/productos/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-border-strong"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-faint">
            <Images className="h-8 w-8" />
          </div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          {rank != null && (
            <span className="rounded-lg bg-black/60 px-2 py-1 text-sm font-semibold text-white backdrop-blur">
              #{rank}
            </span>
          )}
          <span className="rounded-lg bg-black/60 px-2 py-1 text-sm font-semibold text-cyan-300 backdrop-blur">
            🔥 {score.winnerScore}/100
          </span>
        </div>
        {isProven && (
          <span className="absolute bottom-3 left-3 rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-black">
            Ganador
          </span>
        )}
        <div className="absolute right-3 top-3">
          <SaveButton productId={product.id} />
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="text-[15px] font-semibold leading-snug text-text">{product.name}</div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-dim">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5 text-faint" />
            {advertisers.length} vendedores
          </span>
          <span className="inline-flex items-center gap-1">
            <Megaphone className="h-3.5 w-3.5 text-faint" />
            {adCount} anuncios
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-faint" />
            {daysLabel(item)}
          </span>
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-faint" />
            {trendLabel(item)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Globe2 className="h-3.5 w-3.5 text-faint" />
            {marketCount} mercados
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-text">
            {price.typical != null
              ? `${(price.typical as number).toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}`
              : "Precio n/d"}
          </div>
          <span className={"text-[11px] font-semibold " + (sat.emoji === "🟢" ? "text-emerald-300" : sat.emoji === "🟡" ? "text-amber-300" : "text-rose-300")}>
            {sat.emoji} Saturación {sat.label}
          </span>
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <span className="inline-flex w-full items-center justify-center rounded-xl bg-accent/15 px-3 py-2 text-sm font-semibold text-accent2 ring-1 ring-accent/30 transition-colors group-hover:bg-accent/25">
            VER PRODUCTO
          </span>
        </div>
      </div>
    </Link>
  );
}
