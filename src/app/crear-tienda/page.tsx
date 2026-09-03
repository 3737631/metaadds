import CrearTienda from "@/components/crear-tienda";
import { CATEGORIES } from "@/lib/present";

export default async function CrearTiendaPage() {
  const cats = CATEGORIES.filter((c) => c.id !== "todos").map((c) => ({
    id: c.id,
    label: c.label,
    emoji: c.emoji,
  }));

  return <CrearTienda categories={cats} />;
}
