"use client";

import { Heart } from "lucide-react";
import { useIsSaved, toggleSaved } from "@/lib/watchlist-store";

export default function SaveButton({ productId }: { productId: string }) {
  const saved = useIsSaved(productId);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSaved(productId);
      }}
      className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur transition-transform active:scale-90"
      aria-label={saved ? "Quitar de guardados" : "Guardar producto"}
    >
      <Heart className={"h-4 w-4 " + (saved ? "fill-rose-400 text-rose-400" : "text-white")} />
    </button>
  );
}
