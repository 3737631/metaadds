import { getPipelineData } from "@/lib/repository";
import { PageHeader } from "@/components/ui";
import { formatDate } from "@/lib/ui";

export default async function AdsPage() {
  const data = await getPipelineData();
  const ads = data.normalizedAds;

  return (
    <div className="pb-16">
      <PageHeader
        title="Ads"
        subtitle={`${ads.length} deduplicated ads observed across ${data.advertisers.length} advertisers.`}
      />

      <div className="mt-6 overflow-hidden rounded-xl border border-border">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                <th className="px-4 py-3">Advertiser</th>
                <th className="px-4 py-3">Headline</th>
                <th className="px-4 py-3">Started</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Platforms</th>
                <th className="px-4 py-3">Market</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              {ads.map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3 text-text">{a.advertiser.name}</td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-dim">{a.copy.headline}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-dim">{formatDate(a.startDate)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 " +
                        (a.isActive
                          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30"
                          : "bg-slate-500/10 text-slate-400 ring-slate-400/20")
                      }
                    >
                      {a.isActive ? "active" : "ended"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-dim">{a.platforms.join(", ")}</td>
                  <td className="px-4 py-3 text-dim">{a.market}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
