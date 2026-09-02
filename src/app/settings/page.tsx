import { getPipelineData, getProviders } from "@/lib/repository";
import { PageHeader, Card, SectionTitle } from "@/components/ui";
import { formatNumber } from "@/lib/ui";

export default async function SettingsPage() {
  const data = await getPipelineData();
  const providers = getProviders();

  return (
    <div className="pb-16">
      <PageHeader
        title="Settings"
        subtitle="Data sources, pipeline health and evidence policy."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Active data source" />
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 ring-1 ring-accent/30 text-accent2 text-lg">
              ◈
            </div>
            <div>
              <div className="text-sm font-semibold text-text">{data.provider.name}</div>
              <p className="mt-1 text-xs text-dim">{data.provider.description}</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-surface-2 p-3 text-xs text-dim ring-1 ring-border">
            <span className="font-medium text-amber-300">Demo data:</span> {data.provider.isDemo ? "Yes — illustrative, clearly marked." : "No"}
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="Available providers" />
          <div className="space-y-2">
            {providers.map((p) => (
              <div key={p.info.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 ring-1 ring-border">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text">{p.info.name}</span>
                  {p.info.id === data.provider.id && (
                    <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent2 ring-1 ring-accent/30">active</span>
                  )}
                </div>
                <span className="text-[11px] text-faint">{p.info.kind}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Mini label="Products" value={formatNumber(data.products.length)} />
        <Mini label="Ads analyzed" value={formatNumber(data.normalizedAds.length)} />
        <Mini label="Duplicates removed" value={formatNumber(data.duplicatesRemoved)} />
        <Mini label="Advertisers" value={formatNumber(data.advertisers.length)} />
      </div>

      <Card className="mt-6 p-5">
        <SectionTitle title="Evidence policy" />
        <ul className="list-inside list-disc space-y-1.5 text-sm text-dim">
          <li>All signals derive from observable advertising activity: ad existence, dates, creator, creative assets and markets.</li>
          <li>No ROAS, CPA, sales or conversion metrics are ever fabricated.</li>
          <li>Demo data is clearly flagged in the UI and reduced 10% in confidence scoring.</li>
          <li>The same scoring pipeline is used for demo and real providers.</li>
          <li>Every point of a score is explained on the product detail page.</li>
        </ul>
      </Card>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-xs text-faint">{label}</div>
      <div className="mt-1 text-xl font-semibold text-text">{value}</div>
    </div>
  );
}
