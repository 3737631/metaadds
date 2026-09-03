import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, Sparkles, Bot } from "lucide-react";
import { getPipelineData } from "@/lib/repository";
import { DemoBanner } from "@/components/demo-badge";
import { saturationView, priceView, whyWinner, daysLabel, trendLabel, formatSingleEur } from "@/lib/present";
import { isProven } from "@/lib/filter";

export async function generateStaticParams() {
  const data = await getPipelineData();
  return data.scored.map((s) => ({ id: s.product.id }));
}

function Bar({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-dim">{label}</span>
        <span className="text-faint">{value}%</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent/80" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default async function ProductoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPipelineData();
  const item = data.scored.find((s) => s.product.id === id);
  if (!item) notFound();

  const { product, score, advertisers, adCount, activeAds, marketCount } = item;
  const pv = priceView(item.price);
  const sat = saturationView(score.saturation, score.saturationLevel, item);
  const reasons = whyWinner(item);

  const ads = data.normalizedAds.filter((a) => advertisers.some((adv) => adv.id === a.advertiser.id));

  const proven = isProven(item);
  const cover = product.imageUrls[0] ?? null;

  return (
    <div className="flex flex-col">
      <Link href="/ganadores?categoria=todos" className="inline-flex items-center gap-1.5 text-sm font-medium text-dim hover:text-text">
        <ArrowLeft className="h-4 w-4" /> Volver a ganadores
      </Link>

      <div className="mt-3 flex justify-center">
        <DemoBanner show={data.provider.isDemo} />
      </div>

      {/* Hero */}
      <div className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="relative aspect-square w-full bg-surface-2">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-faint">Sin imagen</div>
          )}
          <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white backdrop-blur">
            🔥 {score.winnerScore}/100
          </div>
          {proven && (
            <div className="absolute bottom-3 left-3 rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-bold text-white">
              PROVEN WINNER
            </div>
          )}
        </div>
        <div className="p-5">
          <h1 className="text-xl font-bold leading-snug text-text sm:text-2xl">{product.name}</h1>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-dim">
            <span>👥 {advertisers.length} vendedores</span>
            <span>📢 {adCount} anuncios</span>
            <span>⏱ {daysLabel(item)}</span>
            <span>🌍 {marketCount} mercados</span>
          </div>
        </div>
      </div>

      {/* Por qué es ganador */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text">¿Por qué está aquí?</h2>
        <div className="mt-3 space-y-2 rounded-2xl border border-border bg-surface p-4">
          {reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className={r.positive ? "text-emerald-400" : "text-rose-400"}>
                {r.positive ? "✓" : "⚠"}
              </span>
              <span className="text-text">{r.text}</span>
            </div>
          ))}
          <p className="flex items-start gap-1.5 pt-2 text-xs text-faint">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Esto no garantiza ventas. Son señales observables de actividad publicitaria.
          </p>
        </div>
      </section>

      {/* Precio */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text">💰 Precio de mercado</h2>
        <div className="mt-3 rounded-2xl border border-border bg-surface p-5">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[11px] text-faint">Mínimo observado</div>
              <div className="mt-1 text-lg font-semibold text-text">{formatSingleEur(pv.min)}</div>
            </div>
            <div>
              <div className="text-[11px] text-faint">Precio habitual</div>
              <div className="mt-1 text-lg font-semibold text-accent2">{formatSingleEur(pv.typical)}</div>
            </div>
            <div>
              <div className="text-[11px] text-faint">Máximo observado</div>
              <div className="mt-1 text-lg font-semibold text-text">{formatSingleEur(pv.max)}</div>
            </div>
          </div>
          <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-dim">Coste del producto</span>
              <span className="font-medium text-text">{pv.cost}</span>
            </div>
            {pv.margin ? (
              <div className="flex justify-between">
                <span className="text-dim">Margen bruto posible</span>
                <span className="font-semibold text-emerald-400">{pv.margin}</span>
              </div>
            ) : null}
          </div>
          <p className="mt-3 text-[11px] text-faint">
            {pv.cost !== "No disponible" && "Coste y margen estimados antes de publicidad, impuestos, envío y otros gastos."}
          </p>
        </div>
      </section>

      {/* Saturación */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text">🔥 ¿Está quemado?</h2>
        <div className="mt-3 rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{sat.emoji}</span>
            <span className="text-lg font-bold text-text">SATURACIÓN: {sat.label}</span>
          </div>
          <p className="mt-2 text-sm text-dim">{sat.summary}</p>
          <div className="mt-4 space-y-3">
            <Bar value={sat.competition} label="Competencia" />
            <Bar value={sat.activity} label="Actividad" />
            <Bar value={sat.trend} label="Tendencia" />
          </div>
        </div>
      </section>

      {/* Vendedores */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text">👥 Vendedores</h2>
        <div className="mt-3 rounded-2xl border border-border bg-surface p-4">
          {advertisers.length === 0 ? (
            <p className="text-sm text-dim">No disponible.</p>
          ) : (
            <div className="space-y-2">
              {advertisers.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2">
                  <span className="text-sm text-text">{a.name}</span>
                  <span className="text-xs text-faint">{a.pageName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Anuncios */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text">📢 Anuncios encontrados</h2>
        <p className="mt-1 text-xs text-dim">
          {activeAds}/{adCount} activos ahora
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {ads.slice(0, 12).map((adsRow) => (
            <div key={adsRow.id} className="overflow-hidden rounded-xl border border-border bg-surface">
              {adsRow.creatives[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={adsRow.creatives[0].url} alt="" loading="lazy" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center text-faint">—</div>
              )}
              <div className="px-2 py-1.5 text-[10px] text-faint">
                {adsRow.market} · {adsRow.isActive ? "Activo" : "Inactivo"}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA principal */}
      <Link
        href={`/crear-anuncio/${product.id}`}
        className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-semibold text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.98] hover:brightness-110"
      >
        <Bot className="h-5 w-5" />
        CREAR ANUNCIO CON IA
      </Link>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-faint">
        <Sparkles className="h-3.5 w-3.5" />
        Señal observada de {daysLabel(item)}. {trendLabel(item)}.
      </p>
    </div>
  );
}
