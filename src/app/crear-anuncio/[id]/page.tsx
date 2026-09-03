import { notFound } from "next/navigation";
import { getPipelineData } from "@/lib/repository";
import { categoryIdFor } from "@/lib/present";
import CrearAnuncio from "@/components/crear-anuncio";

export async function generateStaticParams() {
  const data = await getPipelineData();
  return data.scored.map((s) => ({ id: s.product.id }));
}

export default async function CrearAnuncioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getPipelineData();
  const item = data.scored.find((s) => s.product.id === id);
  if (!item) notFound();

  return (
    <CrearAnuncio
      productId={item.product.id}
      productName={item.product.name}
      category={categoryIdFor(item.product.category)}
      cover={item.product.imageUrls[0] ?? null}
      isDemo={data.provider.isDemo}
    />
  );
}
