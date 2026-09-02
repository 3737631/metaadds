"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Compass,
  Trophy,
  Bookmark,
  Package,
  Megaphone,
  Building2,
  BarChart3,
  Settings,
  Sparkles,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/winners", label: "Winners", icon: Trophy },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/products", label: "Products", icon: Package },
  { href: "/ads", label: "Ads", icon: Megaphone },
  { href: "/advertisers", label: "Advertisers", icon: Building2 },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-bg-soft">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 ring-1 ring-accent/40">
          <Sparkles className="h-4 w-4 text-accent2" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-text">
            Meta Winner
          </div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
            Intelligence
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "bg-surface-2 text-text ring-1 ring-border-strong"
                  : "text-dim hover:bg-surface hover:text-text")
              }
            >
              <Icon className={"h-[18px] w-[18px] " + (active ? "text-accent2" : "")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2.5 rounded-lg bg-surface px-3 py-2.5 ring-1 ring-border">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <div className="leading-tight">
            <div className="text-xs font-medium text-text">Demo data</div>
            <div className="text-[10px] text-faint">Illustrative dataset</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
