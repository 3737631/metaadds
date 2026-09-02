import { getPipelineData } from "@/lib/repository";
import { PageHeader, Card, SectionTitle } from "@/components/ui";
import { formatDate, formatNumber } from "@/lib/ui";

export default async function AdvertisersPage() {
  const data = await getPipelineData();
  const { advertisers, normalizedAds } = data;

  const advertiserStats = advertisers.map((adv) => {
    const advAds = normalizedAds.filter((a) => a.advertiser.id === adv.id);
    const active = advAds.filter((a) => a.isActive).length;
    return { adv, count: advAds.length, active };
  });
  advertiserStats.sort((a, b) => b.count - a.count);

  return (
    <div className="pb-16">
      <PageHeader
        title="Advertisers"
        subtitle={`${advertisers.length} distinct advertisers identified from observed ad pages.`}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {advertiserStats.map(({ adv, count, active }) => (
          <Card key={adv.id} className="p-5">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-text">{adv.name}</div>
                <div className="text-xs text-faint">{adv.pageName}</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs text-dim">
              <span>{formatNumber(count)} ads</span>
              <span className={active ? "text-emerald-300" : "text-faint"}>
                {formatNumber(active)} active
              </span>
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-faint">
              <span>First seen {formatDate(adv.firstSeen)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
