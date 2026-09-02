"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { getPipelineData } from "@/lib/repository";
import { PageHeader, Card, SectionTitle } from "@/components/ui";
import type { PipelineResult } from "@/lib/repository";
import { CATEGORY_META } from "@/lib/intelligence/winner";
import type { WinnerCategory } from "@/lib/types";

const CAT_COLORS: Record<WinnerCategory, string> = {
  PROVEN: "#34d399",
  STRONG: "#22c55e",
  EMERGING: "#fbbf24",
  WATCHLIST: "#38bdf8",
  LOW: "#64748b",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<PipelineResult | null>(null);

  useEffect(() => {
    getPipelineData().then(setData);
  }, []);

  if (!data) return <PageHeader title="Analytics" subtitle="Loading…" />;
  const { scored } = data;

  const dist = Array.from({ length: 10 }, (_, i) => {
    const lo = i * 10;
    const hi = lo + 10;
    const count = scored.filter((s) => s.score.winnerScore >= lo && s.score.winnerScore < hi).length;
    return { range: `${lo}–${hi}`, count };
  });

  const categoryRows = (Object.keys(CAT_COLORS) as WinnerCategory[]).map((cat) => ({
    name: cat,
    value: scored.filter((s) => s.score.category === cat).length,
    fill: CAT_COLORS[cat],
  }));

  const saturationRows = [
    { name: "LOW", value: scored.filter((s) => s.score.saturationLevel === "LOW").length, fill: "#34d399" },
    { name: "MEDIUM", value: scored.filter((s) => s.score.saturationLevel === "MEDIUM").length, fill: "#38bdf8" },
    { name: "HIGH", value: scored.filter((s) => s.score.saturationLevel === "HIGH").length, fill: "#fbbf24" },
    { name: "EXTREME", value: scored.filter((s) => s.score.saturationLevel === "EXTREME").length, fill: "#fb7185" },
  ].filter((r) => r.value > 0);

  return (
    <div className="pb-16">
      <PageHeader
        title="Analytics"
        subtitle="Distribution of winner scores and categories across all tracked products."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <SectionTitle title="Winner score distribution" />
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dist}>
                <XAxis dataKey="range" tick={{ fill: "#66707f", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#66707f", fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                <Tooltip
                  cursor={{ fill: "rgba(124,92,255,0.08)" }}
                  contentStyle={{ background: "#161b25", border: "1px solid #2a3342", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#e7ebf1" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {dist.map((d) => (
                    <Cell key={d.range} fill="#7c5cff" opacity={d.count > 0 ? 0.9 : 0.25} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle title="By category" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryRows} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2} stroke="none">
                  {categoryRows.map((c) => (
                    <Cell key={c.name} fill={c.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#161b25", border: "1px solid #2a3342", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#e7ebf1" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Legend data={categoryRows} />
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Saturation mix" />
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={saturationRows} dataKey="value" nameKey="name" innerRadius={40} outerRadius={65} paddingAngle={2} stroke="none">
                  {saturationRows.map((c) => (
                    <Cell key={c.name} fill={c.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#161b25", border: "1px solid #2a3342", borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <Legend data={saturationRows} />
        </Card>

        <Card className="p-5">
          <SectionTitle title="Category summary" />
          <div className="space-y-2">
            {(Object.keys(CAT_COLORS) as WinnerCategory[]).map((c) => {
              const count = scored.filter((s) => s.score.category === c).length;
              return (
                <div key={c} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2 ring-1 ring-border">
                  <span className="flex items-center gap-2 text-sm text-text">
                    <span className="h-2 w-2 rounded-full" style={{ background: CAT_COLORS[c] }} />
                    {CATEGORY_META[c].label}
                  </span>
                  <span className="text-sm font-semibold text-text">{count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Legend({ data }: { data: Array<{ name: string; value: number; fill: string }> }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {data.map((d) => (
        <span key={d.name} className="flex items-center gap-1.5 text-[11px] text-dim">
          <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
          {d.name} · {d.value}
        </span>
      ))}
    </div>
  );
}
