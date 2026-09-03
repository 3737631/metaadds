import { Sparkles } from "lucide-react";

/** Indicador de datos demo, claramente visible mientras no haya datos reales. */
export function DemoBadge({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-400/30">
      <Sparkles className="h-3.5 w-3.5" />
      Datos demo
    </span>
  );
}

export function DemoBanner({ show = true }: { show?: boolean }) {
  if (!show) return null;
  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-200/90">
      <p className="font-medium">Esto es una demostración con datos de ejemplo.</p>
      <p className="mt-0.5 text-amber-200/70">
        Cuando conectes la fuente real de Meta, aquí aparecerán productos reales.
      </p>
    </div>
  );
}
