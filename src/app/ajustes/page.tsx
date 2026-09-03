import { getPipelineData } from "@/lib/repository";

export default async function AjustesPage() {
  const data = await getPipelineData();
  const { provider, scored } = data;

  return (
    <div className="flex flex-col">
      <h1 className="text-center text-2xl font-bold tracking-tight text-text sm:text-3xl">
        ⚙️ Ajustes
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm text-dim">
        Configuración de la aplicación.
      </p>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Fuente de datos</h2>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-text">{provider.name}</div>
            <div className="mt-0.5 text-sm text-dim">
              {provider.isDemo
                ? "Estás viendo datos de demostración, no anuncios reales de Meta."
                : "Este es un snapshot real de la Meta Ad Library."}
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-faint">Cómo obtener datos reales</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-dim">
          <li>Verifica tu identidad en facebook.com/ID (autorización pendiente de Meta).</li>
          <li>Genera un token en Meta for Developers.</li>
          <li>Ponlo en tu archivo <code className="rounded bg-surface-2 px-1 text-text">.env.local</code>.</li>
          <li>Ejecuta <code className="rounded bg-surface-2 px-1 text-text">npm run ingest</code>.</li>
        </ol>
        <p className="mt-3 text-xs text-faint">
          Mientras tanto la aplicación funciona en modo demo para que puedas probar todo el flujo.
        </p>
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
