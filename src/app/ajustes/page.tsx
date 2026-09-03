import { getPipelineData } from "@/lib/repository";
import ShopifyConnect from "@/components/shopify-connect";

export const dynamic = "force-dynamic";

export default async function AjustesPage() {
  const data = await getPipelineData();
  const { provider, scored } = data;

  return (
    <div className="flex flex-col">
      <h1 className="text-center text-2xl font-bold tracking-tight text-text sm:text-3xl">
        Ajustes
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm text-dim">
        Conecta tu tienda y revisa la fuente de datos.
      </p>

      <section className="mt-8">
        <ShopifyConnect />
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Fuente de datos</h2>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-text">{provider.name}</div>
            <div className="mt-0.5 text-sm text-dim">
              {provider.isDemo
                ? "Estás viendo anuncios de demostración, no datos en directo."
                : "Anuncios reales de la Meta Ad Library."}
            </div>
          </div>
          <span
            className={
              "shrink-0 rounded-full px-3 py-1 text-xs font-bold " +
              (provider.isDemo ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300")
            }
          >
            {provider.isDemo ? "DEMO" : "REAL"}
          </span>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 text-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Estadísticas</h2>
        <div className="mt-3 space-y-2 text-dim">
          <div className="flex justify-between">
            <span>Productos detectados</span>
            <span className="font-semibold text-text">{scored.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Última ingesta</span>
            <span className="font-semibold text-text">{data.lastSync.finishedAt ? new Date(data.lastSync.finishedAt).toLocaleString("es-ES") : "—"}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
