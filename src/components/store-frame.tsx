"use client";

import { useEffect, useRef, useState } from "react";
import { Store, Loader2 } from "lucide-react";

/**
 * Vista en miniatura de la web REAL de la tienda, renderizada en un iframe
 * aislado (sandbox sin scripts ni forms). El HTML ya viene capturado con su
 * CSS incrustado, así que se ve EXACTAMENTE igual que la tienda original.
 */
const BASE_WIDTH = 1200; // ancho lógico sobre el que está maquetada la miniweb

export default function StoreFrame({
  html,
  title,
  shopify,
  domain,
}: {
  html: string;
  title: string;
  shopify: boolean;
  domain: string;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState<number>(380);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = width > 0 ? width / BASE_WIDTH : 1;
  const viewportH = 520; // alto "visual" de la miniatura

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-sm text-dim">
          <Store className="h-4 w-4 shrink-0 text-accent2" />
          <span className="truncate">{domain || title}</span>
        </div>
        {shopify && (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
            Shopify
          </span>
        )}
      </div>

      <div ref={wrapRef} className="relative w-full" style={{ height: viewportH }}>
        {width === 0 ? (
          <div className="flex items-center justify-center rounded-2xl border border-border bg-surface text-sm text-dim">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cargando mini web…
          </div>
        ) : (
          <div
            className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xl"
            style={{ height: viewportH, width: "100%" }}
          >
            <iframe
              title={title || domain || "Vista de la tienda"}
              sandbox=""
              scrolling="yes"
              srcDoc={html}
              style={{
                width: BASE_WIDTH,
                height: Math.ceil(viewportH / scale),
                transform: `scale(${scale})`,
                transformOrigin: "top left",
                border: "none",
                background: "#ffffff",
                pointerEvents: "auto",
              }}
            />
          </div>
        )}
      </div>
      <p className="text-[11px] text-faint">Vista fiel de la web real (no editable). Puedes hacer scroll dentro.</p>
    </div>
  );
}