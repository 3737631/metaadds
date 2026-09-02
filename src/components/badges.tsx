import type { WinnerCategory } from "@/lib/types";
import { categoryTone, toneClasses } from "@/lib/ui";

export function CategoryBadge({ category }: { category: WinnerCategory }) {
  const tone = toneClasses[categoryTone(category)];
  return (
    <span
      className={
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 " +
        tone.badge
      }
    >
      {category}
    </span>
  );
}

export function SaturationBadge({
  level,
}: {
  level: "LOW" | "MEDIUM" | "HIGH" | "EXTREME";
}) {
  const tone = toneClasses[
    level === "LOW"
      ? "emerald"
      : level === "MEDIUM"
      ? "sky"
      : level === "HIGH"
      ? "amber"
      : "rose"
  ];
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 " +
        tone.badge
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full " + tone.dot} />
      {level}
    </span>
  );
}
