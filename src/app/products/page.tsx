import { getPipelineData } from "@/lib/repository";
import { PageHeader } from "@/components/ui";
import { ProductRow } from "@/components/product-card";

export default async function ProductsPage() {
  const data = await getPipelineData();
  const { scored } = data;

  return (
    <div className="pb-16">
      <PageHeader
        title="Products"
        subtitle="All resolved product entities with their current winner scores."
      />

      <div className="mt-6 grid grid-cols-12 items-center gap-4 px-4 pb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
        <div className="col-span-5">Product</div>
        <div className="col-span-2">Category</div>
        <div className="col-span-1 text-center">Score</div>
        <div className="col-span-1 text-center">Advs</div>
        <div className="col-span-1 text-center">Ads</div>
        <div className="col-span-1 text-center">Markets</div>
        <div className="col-span-1 text-right">Watch</div>
      </div>
      <div className="space-y-2">
        {scored.map((p) => (
          <ProductRow key={p.product.id} item={p} />
        ))}
      </div>
    </div>
  );
}
