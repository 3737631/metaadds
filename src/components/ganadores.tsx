"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { ScoredProduct } from "@/lib/types";
import ProductCard from "@/components/product-card";
import { DemoBadge } from "@/components/demo-badge";
import { CATEGORIES } from "@/lib/present";
import { filteredProducts, categoryOptions, COUNTRY_OPTIONS, SATURATION_OPTIONS } from "@/lib/filter";

function Chip({ active, href, children }: { active: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        "rounded-full px-3 py-1 text-xs transition-colors " +
        (active ? "bg-accent text-white" : "bg-surface-2 text-dim hover:text-text")
      }
    >
      {children}
    </Link>
  );
}

export default function GanadoresClient({ scored, isDemo }: { scored: ScoredProduct[]; isDemo: boolean }) {
  const sp = useSearchParams();
  const categoria = sp.get("categoria") || "todos";
  const pais = sp.get("pais") || "todos";
  const saturacion = sp.get("saturacion") || "todas";

  const cat = CATEGORIES.find((c) => c.id === categoria) ?? CATEGORIES[CATEGORIES.length - 1];
  const title = categoria === "todos" ? "Ganadores" : `Ganadores de ${cat.label}`;
  const list = filteredProducts(scored, { categoria, pais, saturacion });

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const merged = { categoria, pais, saturacion, ...over };
    if (merged.categoria && merged.categoria !== "todos") p.set("categoria", merged.categoria);
    if (merged.pais && merged.pais !== "todos") p.set("pais", merged.pais);
    if (merged.saturacion && merged.saturacion !== "todas") p.set("saturacion", merged.saturacion);
    const s = p.toString();
    return s ? `/ganadores?${s}` : "/ganadores";
  };

  return (
    <div className="flex flex-col">
      <div className="flex justify-center">
        <DemoBadge show={isDemo} />
      </div>

      <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-text sm:text-3xl">
        🔥 {title}
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm text-dim">
        Ordenados por fuerza de las señales publicitarias observadas en Meta.
      </p>

      <div className="mt-6 space-y-3">
        <div className="rounded-2xl border border-border bg-surface p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-faint">Categoría</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[...categoryOptions(), { id: "todos", label: "🔥 Todos" }].map((o) => (
              <Chip key={o.id} active={categoria === o.id} href={qs({ categoria: o.id })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-faint">País</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {COUNTRY_OPTIONS.map((o) => (
              <Chip key={o.id} active={pais === o.id} href={qs({ pais: o.id })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-faint">Saturación</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SATURATION_OPTIONS.map((o) => (
              <Chip key={o.id} active={saturacion === o.id} href={qs({ saturacion: o.id })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-6 text-sm text-dim">
        {list.length === 0 ? (
          "No hay productos que coincidan con estos filtros."
        ) : (
          <>
            <span className="font-semibold text-text">{list.length}</span>{" "}
            {list.length === 1 ? "producto encontrado" : "productos encontrados"}
          </>
        )}
      </p>

      <div className="mt-4 flex flex-col gap-4">
        {list.map((p, i) => (
          <ProductCard key={p.product.id} item={p} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
