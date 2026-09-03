"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings, Flame, Store } from "lucide-react";

/**
 * Navegación de la app simplificada:
 * Tienda (crear tu tienda) · Ajustes (conectar tu tienda Shopify).
 * Barra inferior en móvil, barra lateral compacta en escritorio.
 */

const NAV = [
  { href: "/crear-tienda", label: "Crear tienda", icon: Store },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[220px] flex-col border-r border-border bg-bg-soft md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 ring-1 ring-accent/40">
            <Flame className="h-5 w-5 text-accent2" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-text">Meta Winners</div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
              Señales de Meta
            </div>
          </div>
        </Link>
        <nav className="flex-1 space-y-1 px-3 py-2">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors " +
                  (active
                    ? "bg-surface-2 text-text ring-1 ring-border-strong"
                    : "text-dim hover:bg-surface hover:text-text")
                }
              >
                <Icon className={"h-[18px] w-[18px] shrink-0 " + (active ? "text-accent2" : "")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 text-[11px] text-faint">
          Señales publicitarias reales consultadas en vivo desde la biblioteca de anuncios de Meta.
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-bg-soft/90 backdrop-blur-md md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium"
              style={{ color: active ? "var(--accent-2)" : "var(--text-faint)" }}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
