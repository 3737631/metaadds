import { getPipelineData } from "@/lib/repository";
import type { ScoredProduct } from "@/lib/types";
import SavedList from "@/components/saved-list";
import { DemoBadge } from "@/components/demo-badge";

export default async function GuardadosPage() {
  const data = await getPipelineData();
  return (
    <div className="flex flex-col">
      <div className="flex justify-center">
        <DemoBadge show={data.provider.isDemo} />
      </div>
      <h1 className="mt-4 text-center text-2xl font-bold tracking-tight text-text sm:text-3xl">
        ❤️ Guardados
      </h1>
      <p className="mx-auto mt-2 max-w-sm text-center text-sm text-dim">
        Los productos que has guardado para revisar luego.
      </p>
      <div className="mt-6">
        <SavedList scored={data.scored} />
      </div>
    </div>
  );
}
