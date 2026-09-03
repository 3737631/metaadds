import { Suspense } from "react";
import { getPipelineData } from "@/lib/repository";
import GanadoresClient from "@/components/ganadores";

export default async function GanadoresPage() {
  const data = await getPipelineData();
  return (
    <Suspense>
      <GanadoresClient scored={data.scored} isDemo={data.provider.isDemo} />
    </Suspense>
  );
}
