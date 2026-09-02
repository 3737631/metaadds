import type { WinnerCategory, SaturationLevel } from "@/lib/types";

export function categoryTone(cat: WinnerCategory): string {
  switch (cat) {
    case "PROVEN":
      return "emerald";
    case "STRONG":
      return "green";
    case "EMERGING":
      return "amber";
    case "WATCHLIST":
      return "sky";
    case "LOW":
      return "slate";
  }
}

export function saturationTone(level: SaturationLevel): string {
  switch (level) {
    case "EXTREME":
      return "rose";
    case "HIGH":
      return "amber";
    case "MEDIUM":
      return "sky";
    case "LOW":
      return "emerald";
  }
}

export const toneClasses: Record<string, { badge: string; text: string; bar: string; dot: string }> = {
  emerald: {
    badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
    text: "text-emerald-300",
    bar: "bg-emerald-400",
    dot: "bg-emerald-400",
  },
  green: {
    badge: "bg-green-500/15 text-green-300 ring-green-400/30",
    text: "text-green-300",
    bar: "bg-green-400",
    dot: "bg-green-400",
  },
  amber: {
    badge: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
    text: "text-amber-300",
    bar: "bg-amber-400",
    dot: "bg-amber-400",
  },
  sky: {
    badge: "bg-sky-500/15 text-sky-300 ring-sky-400/30",
    text: "text-sky-300",
    bar: "bg-sky-400",
    dot: "bg-sky-400",
  },
  slate: {
    badge: "bg-slate-500/15 text-slate-300 ring-slate-400/30",
    text: "text-slate-300",
    bar: "bg-slate-400",
    dot: "bg-slate-400",
  },
  rose: {
    badge: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
    text: "text-rose-300",
    bar: "bg-rose-400",
    dot: "bg-rose-400",
  },
  violet: {
    badge: "bg-violet-500/15 text-violet-300 ring-violet-400/30",
    text: "text-violet-300",
    bar: "bg-violet-400",
    dot: "bg-violet-400",
  },
  cyan: {
    badge: "bg-cyan-500/15 text-cyan-300 ring-cyan-400/30",
    text: "text-cyan-300",
    bar: "bg-cyan-400",
    dot: "bg-cyan-400",
  },
};

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function pluralize(n: number, word: string, plural?: string): string {
  return n === 1 ? `${n} ${word}` : `${n} ${plural ?? word + "s"}`;
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.floor((now - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
