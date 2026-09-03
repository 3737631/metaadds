import Link from "next/link";
import { Search, Flame } from "lucide-react";
import { getPipelineData } from "@/lib/repository";
import { CATEGORIES } from "@/lib/present";
import { DemoBadge } from "@/components/demo-badge";
import ProductCard from "@/components/product-card";

export default async function HomePage() {
  const data = await getPipelineData();
  const { scored, provider } = data;
  const top = scored.slice(0, 3);

  return (
    <div className="flex flex-col">
      <header className="text-center">
        <div className="inline-flex items-center justify-center gap-2 text-2xl font-bold tracking-tight text-text sm:text-3xl">
          <Flame className="h-7 w-7 text-accent2" />
          META WINNERS
        </div>
        <p className="mx-auto mt-2 max-w-sm text-sm text-dim sm:text-base">
          Encuentra productos que están funcionando en Meta.
        </p>
        <div className="mt-4 flex justify-center">
          <DemoBadge show={provider.isDemo} />
        </div>
      </header>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text">¿Qué quieres buscar?</h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {CATEGORIES.map((c) => (
            <Link
              key={c.id}
              href={`/ganadores?categoria=${c.id}`}
              className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-4 text-center transition-colors hover:border-accent/40 hover:bg-surface-2"
            >
              <span className="text-3xl">{c.emoji}</span>
              <span className="text-xs font-medium text-text">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-text">País</h2>
        <div className="mt-3 flex gap-2">
          {[
            { id: "es", label: "🇪🇸 España", chip: true },
            { id: "todos", label: "🌍 Todos los países", chip: false },
          ].map((c) => (
            <Link
              key={c.id}
              href={`/ganadores?categoria=todos&pais=${c.id}`}
              className="rounded-full border border-border bg-surface px-4 py-2.5 text-sm text-dim transition-colors hover:border-accent/40 hover:text-text"
            >
              {c.label}
            </Link>
          ))}
        </div>
      </section>

      <Link
        href="/ganadores?categoria=todos"
        className="mt-8 flex items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-semibold text-white shadow-lg shadow-accent/25 transition-transform active:scale-[0.98] hover:brightness-110"
      >
        <Search className="h-5 w-5" />
        ENCONTRAR GANADORES
      </Link>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">🔥 Ganadores destacados</h2>
          <Link href="/ganadores?categoria=todos" className="text-sm font-medium text-accent2 hover:underline">
            Ver todos
          </Link>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {top.map((p, i) => (
            <ProductCard key={p.product.id} item={p} rank={i + 1} />
          ))}
        </div>
      </section>
    </div>
  );
}
