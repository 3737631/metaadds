import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { getPipelineData } from "@/lib/repository";
import { Card, SectionTitle } from "@/components/ui";
import { CategoryBadge, SaturationBadge } from "@/components/badges";
import ScoreRing from "@/components/score-ring";
import WatchlistToggle from "@/components/watchlist-toggle";
import {
  toneClasses,
  categoryTone,
  saturationTone,
  formatDate,
} from "@/lib/ui";
import { WEIGHTS } from "@/lib/intelligence/signalEngine";
import type { ScoreBreakdown } from "@/lib/types";

export async function generateStaticParams() {
  const data = await getPipelineData();
  return data.scored.map((s) => ({ id: s.product.id }));
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getPipelineData();
  const item = data.scored.find((s) => s.product.id === id);
  if (!item) notFound();

  const { product, score, advertisers, adCount, activeAds } = item;
  const tone = toneClasses[categoryTone(score.category)];

  return (
    <div className="pb-16 pt-6">
      <Link href="/discover" className="inline-flex items-center gap-1.5 text-xs font-medium text-dim hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Discover
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-text">{product.name}</h1>
            <CategoryBadge category={score.category} />
          </div>
          <p className="mt-1 text-sm text-dim">{product.category} · first tracked {formatDate(product.firstSeen)}</p>
        </div>
        <WatchlistToggle productId={product.id} />
      </div>

      {/* Hero scoring */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="flex items-center justify-between p-6 lg:col-span-1">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-faint">Winner Score</div>
            <div className={"mt-1 text-4xl font-semibold tracking-tight " + tone.text}>{score.winnerScore}</div>
            <div className="mt-1 text-xs text-dim">{score.category}</div>
          </div>
          <ScoreRing value={score.winnerScore} size={72} stroke={7} color="#38c3f0" />
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="grid grid-cols-3 gap-4 text-center">
            <RingStat label="Confidence" value={score.confidence} color="#7c5cff" />
            <RingStat label="Saturation" value={score.saturation} color="#fb7185" />
            <RingStat label="Data quality" value={score.dataQuality} color="#34d399" />
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <SaturationBadge level={score.saturationLevel} />
            <span className="text-[11px] text-dim">market saturation level</span>
          </div>
        </Card>
      </div>

      {/* Overview stats */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MiniStat label="Advertisers" value={advertisers.length} />
        <MiniStat label="Ads tracked" value={adCount} />
        <MiniStat label="Active now" value={activeAds} />
        <MiniStat label="Markets" value={item.marketCount} />
      </div>

      {/* Score breakdown */}
      <div className="mt-8">
        <SectionTitle title="Score breakdown — every point explained" />
        <div className="grid gap-4 lg:grid-cols-2">
          <SignalBreakdown breakdown={score.signalBreakdown} />
          <div className="space-y-4">
            <Card className="p-5">
              <SectionTitle title="Penalties applied" />
              {score.penalties.length === 0 ? (
                <p className="text-sm text-dim">No penalties applied to this product.</p>
              ) : (
                <div className="space-y-2">
                  {score.penalties.map((pl) => (
                    <div key={pl.name} className="flex items-start justify-between gap-3 rounded-lg bg-surface-2 p-3 ring-1 ring-border">
                      <div>
                        <div className="text-xs font-semibold text-text">{pl.name}</div>
                        <div className="mt-0.5 text-[11px] text-dim">{pl.reason}</div>
                      </div>
                      <span className="text-sm font-semibold text-rose-300">-{pl.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <SectionTitle title="Advertisers" />
              <div className="space-y-2">
                {advertisers.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border">
                    <span className="text-sm text-text">{a.name}</span>
                    <span className="text-[11px] text-faint">{a.pageName}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Product details */}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Landing pages" />
          <ul className="space-y-1.5">
            {product.landingPages.map((l) => (
              <li key={l} className="truncate text-xs text-dim">{l}</li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {product.domains.map((d) => (
              <span key={d} className="rounded-md bg-surface-2 px-2 py-1 text-[11px] text-dim ring-1 ring-border">{d}</span>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Markets" />
          <div className="flex flex-wrap gap-1.5">
            {product.markets.map((m) => (
              <span key={m} className="rounded-md bg-surface-2 px-2 py-1 text-[11px] text-dim ring-1 ring-border">{m}</span>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-2 text-[11px] text-faint">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Only observable signals (ad existence, dates, creator, creative assets, markets) are used. No
            ROAS, CPA, sales or conversion metrics are fabricated.
          </p>
        </Card>
      </div>

      {/* Creative gallery */}
      {product.imageUrls.length > 0 && (
        <div className="mt-8">
          <SectionTitle title="Observed creative assets" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {product.imageUrls.map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <div key={u + i} className="aspect-square overflow-hidden rounded-lg border border-border bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" loading="lazy" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RingStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <ScoreRing value={value} size={54} stroke={4.5} color={color} />
      <span className="text-[11px] font-medium text-dim">{label}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-1 text-xl font-semibold text-text">{value}</div>
    </div>
  );
}

function SignalBreakdown({ breakdown }: { breakdown: ScoreBreakdown }) {
  const rows: Array<{ key: keyof ScoreBreakdown; label: string; hint: string; weight: number }> = [
    { key: "advertiserDiversity", label: "Advertiser diversity", hint: "Different brands running ads", weight: WEIGHTS.advertiserDiversity },
    { key: "advertiserMomentum", label: "Advertiser momentum", hint: "New brands scaling in", weight: WEIGHTS.advertiserMomentum },
    { key: "adMomentum", label: "Ad momentum", hint: "Rising number of recent ads", weight: WEIGHTS.adMomentum },
    { key: "longevity", label: "Longevity", hint: "How long the product has been advertised", weight: WEIGHTS.longevity },
    { key: "creativeDiversity", label: "Creative diversity", hint: "Different ads/creatives used", weight: WEIGHTS.creativeDiversity },
    { key: "marketDiversity", label: "Market diversity", hint: "Distinct markets targeted", weight: WEIGHTS.marketDiversity },
    { key: "newAdvertiserEntry", label: "New advertiser entry", hint: "Fresh brands appearing recently", weight: WEIGHTS.newAdvertiserEntry },
    { key: "creativePersistence", label: "Creative persistence", hint: "Same creative kept alive over time", weight: WEIGHTS.creativePersistence },
  ];
  const baseScore = rows.reduce((acc, r) => acc + breakdown[r.key] * r.weight, 0);

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-text">Signal mix</span>
        <span className="text-xs text-dim">base score {Math.round(baseScore)}/100</span>
      </div>
      <div className="space-y-3">
        {rows.map((r) => {
          const val = breakdown[r.key];
          const weighted = val * r.weight;
          const pct = Math.round(r.weight * 100);
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-text">{r.label}</span>
                <span className="text-faint">
                  {Math.round(val)} <span className="mx-0.5">·</span> {pct}% · {Math.round(weighted)}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-dim">{r.hint}</div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent/80"
                  style={{ width: `${Math.min(100, val)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-4 flex items-start gap-1.5 text-[11px] text-faint">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
        Each bar shows the signal value (0–100) and its weighted contribution to the base score.
      </p>
    </Card>
  );
}

