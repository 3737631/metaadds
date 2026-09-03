import Link from "next/link";
import {
  Package,
  Megaphone,
  Users,
  TrendingUp,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Compass,
  Trophy,
  Bookmark,
  BarChart3,
  Settings,
} from "lucide-react";
import { getPipelineData } from "@/lib/repository";
import { PageHeader, Card, StatCard, SectionTitle } from "@/components/ui";
import { CategoryBadge } from "@/components/badges";
import ProductCard from "@/components/product-card";
import { formatNumber, timeAgo } from "@/lib/ui";

export default async function OverviewPage() {
  const data = await getPipelineData();
  const { scored, advertisers, normalizedAds, products, duplicatesRemoved, lastSync, provider } = data;

  const activeAds = normalizedAds.filter((a) => a.isActive).length;
  const winners = scored.filter((s) =>
    ["PROVEN", "STRONG", "EMERGING"].includes(s.score.category)
  );
  const topProducts = scored.slice(0, 3);

  const categoryCounts = new Map<string, number>();
  for (const p of products) {
    categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
  }
  const topCategory = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="pb-16">
      <PageHeader
        title="Overview"
        subtitle="Observed Meta advertising signals, ranked into product intelligence. All figures derive from observable ad activity — no fabricated performance metrics."
        actions={
          provider.isDemo && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 ring-1 ring-amber-400/30">
              <Sparkles className="h-3.5 w-3.5" />
              Demo data
            </span>
          )
        }
      />

      {/* Orientation guide */}
      <Card className="p-5">
        <SectionTitle title="Where is everything?" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Compass, to: "/discover", name: "Discover", desc: "Explore all products and how they score." },
            { icon: Trophy, to: "/winners", name: "Winners", desc: "See the highest-scoring picks first." },
            { icon: Bookmark, to: "/watchlist", name: "Watchlist", desc: "Your saved products, one click on any card." },
            { icon: Package, to: "/products", name: "Products", desc: "Every tracked product in a table." },
            { icon: Megaphone, to: "/ads", name: "Ads", desc: "All observed ads and their details." },
            { icon: Users, to: "/advertisers", name: "Advertisers", desc: "The ad pages seen behind each product." },
            { icon: BarChart3, to: "/analytics", name: "Analytics", desc: "Charts of scores, categories and saturation." },
            { icon: Settings, to: "/settings", name: "Settings", desc: "Data source and evidence policy." },
          ].map((g) => (
            <Link
              key={g.to}
              href={g.to}
              className="group flex items-start gap-3 rounded-lg bg-surface-2 p-3 ring-1 ring-border transition-colors hover:ring-border-strong"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent2 ring-1 ring-accent/30">
                <g.icon className="h-4 w-4" />
              </span>
              <span>
                <span className="block text-xs font-semibold text-text">{g.name}</span>
                <span className="block text-[11px] leading-snug text-faint">{g.desc}</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-dim">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent2" />
          Start on a product's page: every number there explains itself — score, confidence, saturation and
          each signal show what they mean and why they count.
        </p>
      </Card>

      {/* KPI row */}
      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Products tracked"
          value={formatNumber(products.length)}
          sub={`${scored.filter((s) => s.score.category === "PROVEN").length} proven`}
        />
        <StatCard
          label="Ads observed"
          value={formatNumber(normalizedAds.length)}
          sub={`${formatNumber(activeAds)} active now`}
        />
        <StatCard
          label="Advertisers"
          value={formatNumber(advertisers.length)}
          sub="distinct pages"
        />
        <StatCard
          label="Top category"
          value={topCategory?.[0] ?? "—"}
          sub={topCategory ? `${topCategory[1]} products` : undefined}
        />
      </div>

      {/* Signals / pipeline */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Signal pipeline" />
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[11px] font-medium text-dim">
            {[
              "Ingest",
              "Normalize",
              "Deduplicate",
              "Entity resolve",
              "Extract signals",
              "Score",
              "Rank",
            ].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-2">
                <span className="whitespace-nowrap rounded-md bg-surface-2 px-2 py-1 ring-1 ring-border">
                  {step}
                </span>
                {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-faint" />}
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-lg bg-surface-2 p-3 ring-1 ring-border">
              <div className="text-lg font-semibold text-text">{formatNumber(normalizedAds.length)}</div>
              <div className="mt-0.5 text-faint">validated ads</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-3 ring-1 ring-border">
              <div className="text-lg font-semibold text-text">{formatNumber(duplicatesRemoved)}</div>
              <div className="mt-0.5 text-faint">duplicates removed</div>
            </div>
            <div className="rounded-lg bg-surface-2 p-3 ring-1 ring-border">
              <div className="text-lg font-semibold text-text">{formatNumber(products.length)}</div>
              <div className="mt-0.5 text-faint">products resolved</div>
            </div>
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-dim">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
            Data quality, saturation, duplicate and clustering uncertainty are applied as penalties to the
            winner score. Every point in every score is explained on the product page.
          </p>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Last sync" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-text">{provider.name}</div>
              <div className="text-xs text-dim">completed {timeAgo(lastSync.finishedAt ?? lastSync.startedAt)}</div>
            </div>
          </div>
          <div className="mt-4 space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-faint">Ads ingested</span><span className="text-text">{lastSync.adsIngested}</span></div>
            <div className="flex justify-between"><span className="text-faint">Advertisers</span><span className="text-text">{lastSync.advertisersIngested}</span></div>
            <div className="flex justify-between"><span className="text-faint">Products clustered</span><span className="text-text">{lastSync.productsClustered}</span></div>
          </div>
        </Card>
      </div>

      {/* Winners overview */}
      <div className="mt-8">
        <SectionTitle
          title="Highest scoring products"
          action={
            <Link href="/winners" className="text-xs font-medium text-accent2 hover:underline">
              View all →
            </Link>
          }
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topProducts.map((p) => (
            <ProductCard key={p.product.id} item={p} />
          ))}
        </div>
      </div>

      {/* Brand strip */}
      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Link href="/discover" className="group flex items-center justify-between rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent2 ring-1 ring-accent/30">
              <Package className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-text">Discover</div>
              <div className="text-xs text-faint">{winners.length} ranked opportunities</div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-1" />
        </Link>
        <Link href="/ads" className="group flex items-center justify-between rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent2 ring-1 ring-accent/30">
              <Megaphone className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-text">Ads</div>
              <div className="text-xs text-faint">{formatNumber(normalizedAds.length)} ads analyzed</div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-1" />
        </Link>
        <Link href="/advertisers" className="group flex items-center justify-between rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent2 ring-1 ring-accent/30">
              <Users className="h-4.5 w-4.5" />
            </span>
            <div>
              <div className="text-sm font-semibold text-text">Advertisers</div>
              <div className="text-xs text-faint">{formatNumber(advertisers.length)} identified pages</div>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-faint transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
