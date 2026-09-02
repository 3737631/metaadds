import { getPipelineData } from "@/lib/repository";
import { PageHeader, SectionTitle } from "@/components/ui";
import ProductCard from "@/components/product-card";
import { formatNumber } from "@/lib/ui";

export default async function DiscoverPage() {
  const data = await getPipelineData();
  const { scored, products } = data;

  const categoryCounts = new Map<string, number>();
  for (const p of products) {
    categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
  }
  const categories = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1]);

  return (
    <div className="pb-16">
      <PageHeader
        title="Discover"
        subtitle="Every tracked product, ranked by winner score from observable advertising signals."
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-faint">Products</div>
          <div className="mt-2 text-2xl font-semibold">{formatNumber(products.length)}</div>
        </div>
        {categories.map(([cat, count]) => (
          <div key={cat} className="rounded-xl border border-border bg-surface p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-faint">Category</div>
            <div className="mt-2 flex items-center justify-between">
              <span className="truncate text-sm font-semibold text-text">{cat}</span>
              <span className="text-sm text-dim">{count}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <SectionTitle title="All products" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {scored.map((p) => (
            <ProductCard key={p.product.id} item={p} />
          ))}
        </div>
      </div>
    </div>
  );
}
