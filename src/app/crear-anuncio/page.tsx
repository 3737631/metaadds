import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getPipelineData } from "@/lib/repository";
import { DemoBadge } from "@/components/demo-badge";

export default async function CrearAnuncioHome() {
  const data = await getPipelineData();
  const list = data.scored.slice(0, 12);

  return (
    <div className="flex flex-col">
      <div className="flex justify-center">
        <DemoBadge show={data.provider.isDemo} />
      </div>
      <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-text sm:text-3xl">
        ✨ Crear anuncio con IA
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm text-dim">
        Elige un producto o introduce uno nuevo y la IA generará las escenas y el copy.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {list.length === 0 ? (
          <p className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-dim">
            No hay productos disponibles todavía.
          </p>
        ) : (
          list.map((p) => (
            <Link
              key={p.product.id}
              href={`/crear-anuncio/${p.product.id}`}
              className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition-colors hover:border-accent/40"
            >
              {p.product.imageUrls[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.product.imageUrls[0]}
                  alt=""
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-xl bg-surface-2" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-text">{p.product.name}</div>
                <div className="mt-0.5 text-xs text-dim">
                  🔥 {p.score.winnerScore}/100 · {p.advertisers.length} vendedores · {p.adCount} anuncios
                </div>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
