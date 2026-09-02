import { getPipelineData } from "@/lib/repository";
import { PageHeader, SectionTitle } from "@/components/ui";
import { ProductRow } from "@/components/product-card";
import { CATEGORY_META } from "@/lib/intelligence/winner";
import type { WinnerCategory } from "@/lib/types";

const ORDER: WinnerCategory[] = ["PROVEN", "STRONG", "EMERGING", "WATCHLIST", "LOW"];

export default async function WinnersPage() {
  const data = await getPipelineData();
  const { scored } = data;

  return (
    <div className="pb-16">
      <PageHeader
        title="Winners"
        subtitle="Products ranked by winner score, grouped by category. Higher scores mean stronger, more sustainable observed ad activity."
      />

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        {ORDER.map((cat) => {
          const meta = CATEGORY_META[cat];
          const count = scored.filter((s) => s.score.category === cat).length;
          return (
            <div key={cat} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <CategoryPill cat={cat} />
                <span className="text-sm font-semibold text-text">{count}</span>
              </div>
              <p className="mt-2 text-[11px] leading-snug text-faint">{meta.blurb}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 space-y-8">
        {ORDER.map((cat) => {
          const rows = scored.filter((s) => s.score.category === cat);
          if (rows.length === 0) return null;
          return (
            <div key={cat}>
              <SectionTitle title={CATEGORY_META[cat].label} />
              <div className="space-y-2">
                {rows.map((p) => (
                  <ProductRow key={p.product.id} item={p} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryPill({ cat }: { cat: WinnerCategory }) {
  const styles: Record<WinnerCategory, string> = {
    PROVEN: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
    STRONG: "bg-green-500/15 text-green-300 ring-green-400/30",
    EMERGING: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
    WATCHLIST: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
    LOW: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
  };
  return (
    <span className={"rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 " + styles[cat]}>
      {cat}
    </span>
  );
}
